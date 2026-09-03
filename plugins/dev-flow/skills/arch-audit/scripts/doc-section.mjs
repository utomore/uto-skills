#!/usr/bin/env node
/**
 * doc-section.mjs — 只取一份 markdown 的指定章節,並**印出沒讀到的章節目錄**。
 *
 * 為什麼要有它:`_shared/` 的幾片分片很長,而任何一次呼叫只用得到其中幾節
 * (`doc-lifecycle.md` 一節 = 一種文檔的建檔規格、`spec-roles.md` 一節 = 一個角色)。
 * 原本 skill 的載入行只寫「讀〈某節〉〈某節〉,其餘不讀」—— 那是**紀律不是機制**:
 * 整份讀進來不會報錯,也沒有任何東西會抱怨,省不省完全看執行者願不願意節制。
 * 這支把它變成一道可以照抄執行的指令。
 *
 * **未讀章節目錄是重點,不是附加功能。** 章節式讀取最危險的失敗模式是「讀到空的,
 * 於是以為那條規則不存在」,以及「載入行的節次清單過期了,新加的那一節從此沒有人讀得到」
 * —— 兩者都不會出錯,只會靜默地少一條規則。所以每次都把沒回傳的章節**標題**列在最後
 * (只有標題,約一兩百字),讀的人永遠看得到還有什麼,覺得不對就再讀那一節。
 *
 * **只用在固定的 plugin 分片上,不要用在專案文檔上。** 切章節只在「章節的切分跟誰要用
 * 是同構」時才安全;專案的 `design.md` 是按主題切的,而且契約條目可能整段住在分冊裡,
 * 「讀該子系統 design.md 全文」那條規則不因為有了這支腳本而改變。
 *
 * 節名比對:去掉反引號後做**子字串**比對,所以 `description` 對得上
 * `### \`description\` 欄位規則(必填)`。對到兩節以上一律當錯誤 —— 靜默挑錯一節,
 * 比找不到更難發現。
 *
 * 用法:
 *   node doc-section.mjs <檔案> <節名>...   取出這幾節,末尾附未讀章節目錄
 *   node doc-section.mjs <檔案> --list      只印章節目錄(標題與行號),不印內容
 *   node doc-section.mjs --verify <skills目錄>
 *                                          掃所有 SKILL.md 裡對本腳本的呼叫,檢查每個節名
 *                                          都還對得到唯一一節(節被改名或刪掉時揪出來)
 *   node doc-section.mjs --help
 *
 * 節名含空白要用引號括起來(`"spec-gaps 協議"`)—— 不括會被 shell 拆成兩個節名,
 * 而拆開之後的碎片很可能對到別節或對到多節。`--verify` 抓得到這種寫法。
 *
 * Exit code:0 = 每個節名都對到唯一一節 / 1 = 有節名對不到或對到多節(會印出實際有哪些節)
 *           / 2 = 檔案讀不到,或沒給檔案與節名
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { printHelpIfAsked } from "./_help.mjs";
import { headings, section } from "./_sections.mjs";

const argv = process.argv.slice(2);
printHelpIfAsked(argv, import.meta.url);

const USAGE = `用法:
  node doc-section.mjs <檔案> <節名>...   取出這幾節,末尾附未讀章節目錄
  node doc-section.mjs <檔案> --list      只印章節目錄
  node doc-section.mjs --help`;

if (argv[0] === "--verify") {
  verify(argv[1] ?? ".");
}

const listOnly = argv.includes("--list");
const rest = argv.filter((a) => a !== "--list");
const file = rest[0];
const wanted = rest.slice(1);

if (!file) {
  console.error(`要給一個檔案路徑\n\n${USAGE}`);
  process.exit(2);
}
if (!listOnly && wanted.length === 0) {
  console.error(`要給至少一個節名(或用 --list 只看目錄)\n\n${USAGE}`);
  process.exit(2);
}

let text;
try {
  text = readFileSync(file, "utf8");
} catch {
  console.error(`讀不到檔案: ${file}`);
  process.exit(2);
}

/** 比對用:剝掉反引號與前後空白 */
const norm = (s) => String(s).replace(/`/g, "").trim();
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const all = headings(text).filter((h) => h.level >= 2); // H1 是文件標題,不算節
const tocLine = (h) => `${"  ".repeat(h.level - 2)}${h.title}`;

if (listOnly) {
  console.log(`=== ${file} 的章節(${all.length})===`);
  for (const h of all) console.log(`${String(h.line).padStart(5)}  ${tocLine(h)}`);
  process.exit(0);
}

// ---- 解析節名 → 標題;對不到、對到多個,都是錯誤 ----
const picked = [];
const problems = [];
for (const w of wanted) {
  const hits = all.filter((h) => norm(h.title).includes(norm(w)));
  if (hits.length === 0) problems.push(`找不到節名「${w}」`);
  else if (hits.length > 1) problems.push(`節名「${w}」對到 ${hits.length} 節:${hits.map((h) => h.title).join(" / ")}`);
  else picked.push(hits[0]);
}

if (problems.length > 0) {
  console.error(`=== 節名對不上(${problems.length})===`);
  for (const p of problems) console.error(`- ${p}`);
  console.error(`\n${file} 實際有這些節:`);
  for (const h of all) console.error(`  ${tocLine(h)}`);
  console.error("\n節名比對是去反引號後的子字串比對;寫得更完整一點就能唯一對上。");
  process.exit(1);
}

// ---- 依**檔案順序**輸出(不是參數順序):讀起來才是文檔本來的脈絡 ----
const order = new Map(all.map((h, i) => [h.line, i]));
picked.sort((a, b) => order.get(a.line) - order.get(b.line));

const seen = new Set();
for (const h of picked) {
  if (seen.has(h.line)) continue;
  seen.add(h.line);
  const sec = section(text, new RegExp(`^${escapeRe(h.title)}$`), { minLevel: h.level, maxLevel: h.level });
  console.log(sec ? sec.text : `${h.heading}\n(取不出內容,請整份讀 ${file})`);
  console.log("");
}

// ---- 未讀章節目錄 ----
// 巢狀在已讀章節底下的子節不算「沒讀」:它們的內容已經隨父節一起輸出了。
const covered = new Set();
for (const h of picked) {
  const idx = all.findIndex((x) => x.line === h.line);
  for (let i = idx; i < all.length; i++) {
    if (i > idx && all[i].level <= h.level) break;
    covered.add(all[i].line);
  }
}
const unread = all.filter((h) => !covered.has(h.line));
if (unread.length > 0) {
  console.log(`=== 這份檔還有這些節,你沒讀(${unread.length})===`);
  for (const h of unread) console.log(`- ${tocLine(h)}`);
  console.log("\n只列標題。覺得哪一節跟手上的事有關,就再跑一次把它讀進來 —— 載入行的節次清單可能已經過期,而過期不會報錯。");
} else {
  console.log(`(${file} 的章節都在上面了)`);
}

/**
 * `--verify`:掃 `<skills目錄>/*&#47;SKILL.md` 裡對本腳本的呼叫,逐個節名檢查還對不對得上。
 *
 * 這一關防的是**節次清單過期**:有人把分片裡的某一節改名或刪掉,載入行卻沒跟著改,
 * 那個 skill 從此讀到的東西就少一塊 —— 而少一塊不會報錯。有了這一關,改名至少會在
 * `/arch-audit` 跑到時被叫出來。
 */
function verify(skillsDir) {
  const call = /doc-section\.mjs"? (\S+\.md)((?: +(?:"[^"]+"|[^\s`"]+))*)`/g;
  const rows = [];
  let bad = 0;
  // 遞迴找:呼叫端傳進來的可能是 skills/,也可能是它的上一層。找不到就往下找,
  // 別讓「路徑傳錯」與「全部合格」在輸出上長得一樣(那正是本關要防的失效)。
  const skills = [];
  (function walk(dir, depth) {
    if (depth > 4) return;
    let ents;
    try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const d of ents) {
      if (!d.isDirectory() || d.name === "node_modules" || d.name === ".git") continue;
      const sk = join(dir, d.name, "SKILL.md");
      if (existsSync(sk)) skills.push(sk);
      walk(join(dir, d.name), depth + 1);
    }
  })(skillsDir, 0);
  for (const sk of skills) {
    const d = { name: sk.split("/").slice(-2)[0] };
    const t = readFileSync(sk, "utf8");
    for (const m of t.matchAll(call)) {
      const docPath = resolve(dirname(sk), m[1]);
      const names = (m[2].match(/"[^"]+"|[^\s]+/g) ?? []).map((x) => x.replace(/^"|"$/g, ""));
      if (!existsSync(docPath)) {
        rows.push(`✗ ${d.name}  讀不到 ${m[1]}`);
        bad++;
        continue;
      }
      const hs = headings(readFileSync(docPath, "utf8")).filter((h) => h.level >= 2);
      const miss = names.filter((n) => hs.filter((h) => h.title.replace(/`/g, "").includes(n.replace(/`/g, "").trim())).length !== 1);
      if (miss.length) {
        rows.push(`✗ ${d.name}  ${m[1]}  對不上的節名:${miss.join("、")}`);
        bad++;
      } else {
        rows.push(`✓ ${d.name}  ${m[1]}  ${names.length} 節`);
      }
    }
  }
  console.log(`=== 載入行的節名檢查(${skills.length} 份 SKILL.md、${rows.length} 處呼叫)===`);
  for (const r of rows) console.log(r);
  if (rows.length === 0) {
    console.log(`\n在 ${skillsDir} 底下找不到任何對本腳本的呼叫。**這不是通過**——路徑傳錯與全部合格在輸出上長得一樣,所以這裡當失敗處理。把 skills 目錄傳進來。`);
    process.exit(1);
  }
  if (bad) console.log(`\n${bad} 處對不上。節被改名或刪掉時,載入行要跟著改 —— 不改不會報錯,只會少讀一塊。`);
  process.exit(bad ? 1 : 0);
}
