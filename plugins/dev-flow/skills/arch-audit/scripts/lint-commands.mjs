#!/usr/bin/env node
/**
 * lint-commands.mjs — 檢查 markdown 裡寫的腳本指令,腳本本人還認不認得。
 *
 * skill 文檔會把常用指令**整行內聯**在該步驟裡(內聯比叫執行者跑一次 `--help` 少一趟
 * round-trip)。代價是那些字散在十幾份文檔裡:腳本改名、旗標改名或刪掉,文檔不會報錯,
 * 只會讓照著抄的執行者跑出「未知選項」——或者更糟,旗標還在但語意變了,指令跑得動、
 * 答案卻不是文檔以為的那個。
 *
 * 這一關把它變成機器抓得到的東西,判準來自**腳本自己的 `--help`**(而 `--help` 印的是
 * 該檔檔頭,見 `_help.mjs`),所以不需要另外維護一份旗標清單 —— 另外維護的那份就是
 * 下一個會漂的東西。
 *
 * 檢查三件事:
 *   1. 指令指到的 `.mjs` 存在
 *   2. 用到的每個 `--旗標` 都出現在該腳本的 `--help` 裡
 *   3. `_` 開頭的模組沒有被當成可執行腳本寫進文檔(它們只給 import)
 *
 * **只查路徑裡有 `scripts/` 的呼叫**,而且腳本是從掃描範圍內**所有** `scripts/` 目錄建索引
 * 找出來的,不綁死在某一個 plugin。兩者都是必要的:
 *   - 不看 `scripts/` 就會把 `node build.mjs` 這種**專案檔**(talk-flow 產生到使用者
 *     `talk/` 底下的建置腳本)當成 plugin 腳本,報一堆「找不到」——而那些檔案本來就不在 repo 裡
 *   - 綁死單一目錄就會把 talk-flow 的 `scan-coherence.mjs` 誤判成不存在
 *   兩種誤報都會讓這一關變成雜訊,而變成雜訊的檢查等於沒有檢查
 *
 * **只查認不認得,不查用得對不對。** 旗標存在不代表這一步該用它,那是人的判斷。
 *
 * 用法:
 *   node lint-commands.mjs [目錄...]   預設掃當前目錄底下所有 .md
 *   node lint-commands.mjs --quiet     只印違規,不印摘要
 *   node lint-commands.mjs --help
 *
 * Exit code:0 = 沒有違規 / 1 = 有違規 / 2 = 路徑不存在
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, relative, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { printHelpIfAsked } from "./_help.mjs";

const argv = process.argv.slice(2);
printHelpIfAsked(argv, import.meta.url);

const quiet = argv.includes("--quiet");
const roots = argv.filter((a) => !a.startsWith("--"));
if (roots.length === 0) roots.push(".");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "dist-newstyle", "golden"]);

/**
 * 文檔裡的指令長這樣(路徑前綴各文檔不同,一律只取檔名):
 *   node "<arch-audit skill 目錄>/scripts/scan-status.mjs" .design --subsys <slug>
 *   node "<本 SKILL.md 所在目錄>/scripts/lint-ids.mjs" .design
 * 路徑前綴裡有空白(那是中文佔位符),所以不能把空白排除在路徑之外 —— 排除掉就一處都抓不到,
 * 而「抓到 0 處」跟「全部合格」在輸出上長得一模一樣。摘要因此一律印出處數。
 */
const CALL = /node\s+"?([^"\n`]*?scripts\/)([A-Za-z_][A-Za-z0-9_-]*\.mjs)"?([^\n`]*)/g;

function walk(dir, mds = [], scripts = new Map()) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, mds, scripts);
    else if (extname(name) === ".md") mds.push(p);
    // 掃描範圍內每一個 scripts/ 底下的 .mjs 都進索引,以檔名為鍵 ——
    // 文檔寫的路徑前綴是中文佔位符(`<arch-audit skill 目錄>`),對不出實際路徑,只能靠檔名
    else if (extname(name) === ".mjs" && basename(dir) === "scripts" && !scripts.has(name)) scripts.set(name, p);
  }
  return mds;
}

const files = [];
const known = new Map(); // 檔名 → 實際路徑
for (const r of roots) {
  if (!existsSync(r)) {
    console.error(`路徑不存在: ${r}`);
    process.exit(2);
  }
  statSync(r).isDirectory() ? walk(r, files, known) : files.push(r);
}

/** 某支腳本的 `--help` 裡出現過哪些旗標。跑不動就回 null,由呼叫端當成「無法檢查」。 */
const flagCache = new Map();
function acceptedFlags(script) {
  if (flagCache.has(script)) return flagCache.get(script);
  let set = null;
  try {
    const out = execFileSync("node", [known.get(script), "--help"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10000,
    });
    set = new Set([...out.matchAll(/--[A-Za-z][A-Za-z0-9-]*/g)].map((m) => m[0]));
    set.add("--help");
  } catch {
    set = null;
  }
  flagCache.set(script, set);
  return set;
}

const violations = [];
const notes = [];
let checkedCalls = 0;

for (const f of files) {
  const text = readFileSync(f, "utf8");
  const rel = relative(process.cwd(), f);
  for (const m of text.matchAll(CALL)) {
    const script = basename(m[2]);
    const args = m[3];
    checkedCalls++;

    if (script.startsWith("_")) {
      violations.push({ file: rel, script, rule: "`_` 開頭的是只給 import 的模組,不是可執行腳本" });
      continue;
    }
    if (!known.has(script)) {
      violations.push({ file: rel, script, rule: "掃描範圍內任何 scripts/ 底下都沒有這支腳本(改名或刪掉了?)" });
      continue;
    }
    const ok = acceptedFlags(script);
    if (!ok) {
      // 腳本在,但問不出旗標。**不當違規**:它可能只是還沒接 `--help`(talk-flow 幾支就是),
      // 那是那支腳本的待辦,不是這份文檔寫錯。但也**不靜默跳過** —— 無法檢查要說出來,
      // 否則「檢查過了」與「沒檢查到」在輸出上長得一模一樣。
      notes.push({ file: rel, script, rule: "這支沒有 `--help`,旗標無法檢查(補上 `--help` 才查得到)" });
      continue;
    }
    // 只看真正的旗標;`<slug>`、`.design`、`--` 後面的說明文字不算
    for (const g of args.matchAll(/(?<![A-Za-z0-9-])--[A-Za-z][A-Za-z0-9-]*/g)) {
      if (!ok.has(g[0])) violations.push({ file: rel, script, rule: `旗標 ${g[0]} 不在 ${script} 的 --help 裡` });
    }
  }
}

if (notes.length > 0) {
  console.log(`=== 查不了的(${notes.length})===`);
  for (const n of notes) console.log(`- ${n.file}  [${n.script}]  ${n.rule}`);
  console.log("");
}

if (violations.length > 0) {
  console.log(`=== 文檔裡的指令對不上腳本(${violations.length})===`);
  console.log("判準是腳本自己的 `--help`。腳本改名或旗標改名時,文檔不會報錯,只會讓照抄的人跑出未知選項。\n");
  for (const v of violations) console.log(`- ${v.file}  [${v.script}]  ${v.rule}`);
  process.exit(1);
}

if (!quiet) {
  const names = [...flagCache.keys()].sort().join("、");
  console.log(`掃了 ${files.length} 份 markdown、${checkedCalls} 處 scripts/ 指令,涉及 ${flagCache.size} 支腳本(${names}),旗標全部對得上。`);
  console.log(`(路徑不含 scripts/ 的呼叫不算 —— 那些是專案自己的檔案,不在本 repo 裡)`);
}
process.exit(0);
