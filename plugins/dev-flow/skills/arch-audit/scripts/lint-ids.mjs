#!/usr/bin/env node
/**
 * lint-ids.mjs — 編號與縮寫註冊表的機械檢查。
 *
 * 檢查對象是 **markdown 文檔**(skill 自己的 .md,或某個專案的 .design/ 全樹)。
 * 它強制執行 `_shared/doc-lifecycle.md`「編號與縮寫註冊表」的三條鐵律,其中兩條可機械驗證:
 *
 *   1. 「單字母+數字」只保留給:文檔 id(F/E/B/C + 三位數、ADR-)與開發階段(S + 一~二位數)、
 *      以及 contract-readiness 的固定檢查條(A1–A10、B1–B4)。
 *   2. 其餘一律用詞首碼(LAW- / REG- / EX- / GAP- / ASM- / SELF- / DEC- / WAVE- / STEP-)。
 *
 * **反引號規則**:被禁的形式**只准出現在反引號裡**(`L1`),因為那是「在講這個寫法」的引用;
 * 裸寫(A1、A2…)就是真的拿它當識別碼在用 —— 那才是違規。這條規則讓「說明文字」與「實際使用」
 * 機械分得開,不必靠人判斷語氣。
 *
 * 為什麼要有這支腳本:註冊表本身是文檔,而文檔靠自覺遵守。這套流程的每一條紀律最後都要落到
 * 「有機器在查」,否則下一次修訂還是會漏 —— 本檔就是那次漏掉之後補的。
 *
 * 用法:
 *   node lint-ids.mjs [目錄...]        預設掃當前目錄
 *   node lint-ids.mjs --quiet          只印違規,不印摘要
 *
 * Exit code:0 = 沒有違規 / 1 = 有違規 / 2 = 路徑不存在
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { printHelpIfAsked } from "./_help.mjs";

// ---------------------------------------------------------------- 註冊表(與 doc-lifecycle.md 同步)

/** 合法的「單字母+數字」形式。改這裡之前先改 doc-lifecycle.md 的註冊表,兩邊必須一致。 */
const REGISTERED = [
  { re: /^[FEB]\d{3}$/, what: "任務文檔 id" },
  { re: /^C\d{3}$/, what: "全域契約 id(G-C001 的後半)" },
  { re: /^S\d{1,2}$/, what: "開發階段 id" },
  { re: /^A([1-9]|10)$/, what: "contract-readiness A 段檢查條" },
  { re: /^B[1-4]$/, what: "contract-readiness B 段檢查條" },
];

/**
 * 明確例外:不是識別碼、但形狀像的。每一條都要寫理由 —— 沒有理由的例外會慢慢變成後門。
 */
const EXCEPTIONS = [
  { token: "L42", why: "codegraph.md 的 source_location 範例值(檔案行號,不是編號系統)" },
  { token: "Q3", why: "talk-flow styles.md 的內容範例(某一季),不是識別碼" },
  { token: "P99", why: "talk-flow wording.md 的內容範例(延遲百分位),不是識別碼" },
];

/**
 * 明確跳過的路徑(比對路徑片段)。同樣每條要寫理由。
 */
const SKIP_PATHS = [
  { frag: "smoke-spec-flow", why: "舊制編號的相容性夾具:它的價值就是驗證 L<n> / E<n> / G<n> 舊制照樣讀得到" },
];

const isRegistered = (t) => REGISTERED.some((r) => r.re.test(t));
const exceptionFor = (t) => EXCEPTIONS.find((e) => e.token === t);
const skipReason = (p) => SKIP_PATHS.find((s) => p.replace(/\\/g, "/").includes(s.frag));

// ---------------------------------------------------------------- 掃描

const argv = process.argv.slice(2);
printHelpIfAsked(argv, import.meta.url);
const quiet = argv.includes("--quiet");
const roots = [];
const extraAllow = []; // --allow <regex>:讓別的 plugin / 專案帶自己的合法形式進來
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--allow") extraAllow.push({ re: new RegExp(argv[++i]), what: `--allow ${argv[i]}` });
  else if (argv[i] === "--quiet") continue;
  else if (argv[i].startsWith("--")) {
    console.error(`未知選項: ${argv[i]}`);
    process.exit(2);
  } else roots.push(argv[i]);
}
REGISTERED.push(...extraAllow);
if (roots.length === 0) roots.push(".");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "dist-newstyle", "archive"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else if (extname(name) === ".md") out.push(p);
  }
  return out;
}

/**
 * 把一行裡所有**反引號範圍**標成遮罩,之後只在遮罩外找 token。
 * `L1` 是在講這個寫法(合法),裸寫 L1 是拿它當識別碼(違規)。
 */
function maskInlineCode(line) {
  const chars = [...line];
  let inCode = false;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === "`") {
      inCode = !inCode;
      chars[i] = " ";
    } else if (inCode) {
      chars[i] = " ";
    }
  }
  return chars.join("");
}

const files = [];
for (const r of roots) {
  if (!existsSync(r)) {
    console.error(`路徑不存在: ${r}`);
    process.exit(2);
  }
  statSync(r).isDirectory() ? walk(r, files) : files.push(r);
}

const violations = [];
const skipped = [];
const TOKEN = /\b([A-Z]\d{1,3})\b/g;

for (const f of files) {
  const skip = skipReason(f);
  if (skip) {
    skipped.push({ file: relative(process.cwd(), f), why: skip.why });
    continue;
  }
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = maskInlineCode(raw);
    for (const m of line.matchAll(TOKEN)) {
      const token = m[1];
      if (isRegistered(token) || exceptionFor(token)) continue;
      violations.push({ file: relative(process.cwd(), f), line: i + 1, token, text: raw.trim() });
    }
  });
}

// ---------------------------------------------------------------- 輸出

if (violations.length > 0) {
  console.log(`=== 編號違規(${violations.length})===`);
  console.log("裸寫的「單字母+數字」不在註冊表裡。改成詞首碼(LAW- / EX- / GAP- / ASM- / SELF- / DEC- / WAVE- / STEP-),");
  console.log("或者這一處只是在「講這個寫法」—— 那就把它放進反引號。註冊表見 _shared/doc-lifecycle.md。\n");
  for (const v of violations) {
    console.log(`- ${v.file}:${v.line}  ${v.token}`);
    console.log(`  ${v.text.slice(0, 140)}`);
  }
  process.exit(1);
}

if (!quiet) {
  console.log(`掃了 ${files.length - skipped.length} 份 markdown,沒有編號違規。`);
  console.log(`合法形式:${REGISTERED.map((r) => r.what).join("、")};其餘一律詞首碼。`);
  if (skipped.length > 0) {
    console.log(`\n跳過 ${skipped.length} 份(路徑例外,理由寫在腳本的 SKIP_PATHS):`);
    for (const s of skipped) console.log(`- ${s.file}\n  ${s.why}`);
  }
}
process.exit(0);
