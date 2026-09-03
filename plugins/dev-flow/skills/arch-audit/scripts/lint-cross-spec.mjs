#!/usr/bin/env node
/**
 * lint-cross-spec.mjs — **跨 spec 文檔**的機械對帳:同名不同定義、未宣告的新增依賴邊。
 *
 * 為什麼要有它:`/subsys-build` 3c 與 `/spec-build` 的閘門各有兩點,原文自己寫著
 * 「**這是機械比對,不需要判斷力**」——
 *   - 同一波各份 spec 的「數據」/「介面」表,凡是**同名**的型別、欄位、常數、簽名,
 *     定義是否逐字相同
 *   - 各份 spec「依賴方向」段的「新增的依賴邊」,與 `design.md` 宣告的依賴 diff
 * 然後叫編排者用眼睛逐字比。那正好是機器該做的事:同名不同定義**不會產生任何錯誤訊息**——
 * 兩份 spec 各自內部自洽、各自的測試也各自全綠,矛盾要到兩個 feature 真的接起來才爆,
 * 那時兩邊的 impl 都已經蓋上去了。
 *
 * **只有編排者站得到這個位置**:spec subagent 互相不可見,qa 與 impl 各自只讀分到的那一份。
 * 這支腳本把「編排者記不記得比、比得夠不夠仔細」變成一道跑得出 exit code 的關。
 *
 * 檢查兩件事:
 *   1. **同名不同定義**(影響 exit code):兩份文檔都以「新增」宣告同一個名字,而定義文字不同。
 *      一邊是「修改 / 移除」的成對出現屬正常演進,只列進提示不算違規。
 *   2. **新增的依賴邊**(只列清單,不影響 exit code):把各份 spec 宣告的新增邊蒐集起來,
 *      標出兩端名字有沒有出現在所屬子系統的 `design.md` 裡。**這是候選清單不是判決**——
 *      `design.md` 可能用別的寫法表達同一條邊,要不要納進宣告是人的裁決。
 *
 * 用法:
 *   node lint-cross-spec.mjs [design目錄]        預設 ./.design
 *   node lint-cross-spec.mjs .design --subsys auth   只比對一個子系統內的 spec
 *   node lint-cross-spec.mjs .design --docs F003,F005,F007   只比對指定的幾份(一波)
 *   node lint-cross-spec.mjs --quiet             只印違規與清單,不印摘要
 *
 * Exit code:0 = 沒有同名衝突 / 1 = 有同名衝突 / 2 = 路徑不存在或旗標不認得
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { dataCells, tableCells, isSeparatorRow } from "./_tables.mjs";
import { section, headings } from "./_sections.mjs";
import { readFrontmatter } from "./_frontmatter.mjs";
import { printHelpIfAsked } from "./_help.mjs";

const argv = process.argv.slice(2);
printHelpIfAsked(argv, import.meta.url);

const KNOWN = new Set(["--quiet", "--subsys", "--docs"]);
for (const a of argv) {
  if (a.startsWith("--") && !KNOWN.has(a.split("=")[0])) {
    console.error(`不認得的選項: ${a}\n旗標見 --help`);
    process.exit(2);
  }
}
const flag = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  return argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};

const quiet = argv.includes("--quiet");
const onlySubsys = flag("--subsys");
const onlyDocs = (flag("--docs") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const root = argv.find((a) => !a.startsWith("--") && a !== onlySubsys && a !== flag("--docs")) ?? ".design";

if (!existsSync(root)) {
  console.error(`路徑不存在: ${root}`);
  process.exit(2);
}

const SKIP_DIRS = new Set(["node_modules", ".git", "archive"]);

/** 只看 spec 文檔:features/ 與 enhancements/ 底下的 .md */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".md") && /\/(features|enhancements)\//.test(`/${p.replace(/\\/g, "/")}/`)) out.push(p);
  }
  return out;
}

/** 反引號裡的第一段文字;沒有反引號就取整格。用來把「| `TokenPair` | 新增 | …」的名字取出來 */
const nameOf = (cell) => {
  const m = String(cell).match(/`([^`]+)`/);
  return (m ? m[1] : String(cell)).trim();
};
const norm = (s) => String(s).replace(/`/g, "").replace(/\s+/g, " ").trim();

/**
 * 從一份 spec 取出「這份文檔宣告了哪些名字、各自的定義原文與動作」。
 *
 * 三種表都收,因為同名衝突可以發生在任何一種上:
 *   數據(feature)         | 型別 | 動作 | 定義 | 擁有的知識 |
 *   介面(feature)         | 簽名 | 語意 | 骨架位置 |
 *   數據與介面變動(enhance)| 項目 | 動作 | 簽名 / 定義 | 語意 | 受影響呼叫端 | 骨架位置 |
 *
 * 欄位是**按表頭名字**找的,不是按位置——欄序在兩份模板之間就不一樣,寫死位置會靜默取錯格。
 */
function declarations(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let head = null;      // 目前表格的表頭儲存格
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(?:```|~~~)/.test(line)) { inFence = !inFence; head = null; continue; }
    if (inFence) continue;
    if (/^#{1,6}\s/.test(line)) { head = null; continue; }
    const cells = tableCells(line);
    if (!line.trimStart().startsWith("|")) { head = null; continue; }
    if (isSeparatorRow(cells)) continue;
    if (!head) { head = cells.map(norm); continue; }

    const col = (...names) => {
      for (const n of names) {
        const i = head.findIndex((h) => h === n || h.startsWith(n));
        if (i >= 0) return cells[i];
      }
      return null;
    };
    const nameCell = col("型別", "項目", "簽名");
    if (nameCell == null) continue;
    const defCell = col("定義", "簽名 / 定義", "簽名") ?? nameCell;
    const act = norm(col("動作") ?? "新增");
    const name = nameOf(nameCell);
    if (!name || name === "-") continue;
    const kind = head.some((h) => h === "型別") ? "數據" : head.some((h) => h === "項目") ? "變動" : "介面";
    out.push({ name, def: norm(defCell), action: act, kind });
  }
  return out;
}

/** 「依賴方向」段裡的「新增的依賴邊」那一行 */
function newEdges(text) {
  const sec = section(text, /^(依賴|相依性)/);
  const body = sec ? sec.text : text;
  const m = body.match(/^\s*[-*]\s*\*\*新增的依賴邊\*\*\s*[:：]\s*(.*)$/m);
  if (!m) return [];
  const raw = m[1].trim();
  if (!raw || /^(無|—|-|none)$/i.test(norm(raw))) return [];
  return raw.split(/[;;、]/).map((s) => norm(s)).filter(Boolean);
}

// ---------------------------------------------------------------- 蒐集

const files = walk(root).filter((f) => {
  const p = f.replace(/\\/g, "/");
  if (onlySubsys && !p.includes(`/subsystems/${onlySubsys}/`)) return false;
  return true;
});

const docs = [];
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const fm = readFrontmatter(f) ?? {};
  const id = String(fm.id ?? basename(f).split("-")[0]);
  if (onlyDocs.length && !onlyDocs.includes(id)) continue;
  const sub = (f.replace(/\\/g, "/").match(/\/subsystems\/([^/]+)\//) ?? [])[1] ?? "global";
  docs.push({ id, file: relative(process.cwd(), f), subsys: sub, decls: declarations(text), edges: newEdges(text) });
}

// ---------------------------------------------------------------- 1. 同名不同定義

const byName = new Map();
for (const d of docs) {
  for (const x of d.decls) {
    if (!byName.has(x.name)) byName.set(x.name, []);
    byName.get(x.name).push({ ...x, id: d.id, file: d.file });
  }
}

const EVOLVING = /^(修改|變更|移除|刪除)/;
const conflicts = [];
const notes = [];
for (const [name, rows] of byName) {
  const across = new Map();          // 文檔 id → 這份文檔對這個名字的定義
  for (const r of rows) across.set(r.id, r);
  if (across.size < 2) continue;     // 同一份文檔內部的重複不是本腳本的題目
  const list = [...across.values()];

  // **兩種情況分開判,不可互相遮蔽**:一份 enhance 宣告「修改」不該讓兩份 feature
  // 之間真正的「新增 vs 新增」衝突變成提示 —— 那正是這支腳本要抓的那一格。
  const added = list.filter((r) => !EVOLVING.test(r.action));
  if (new Set(added.map((r) => r.def)).size > 1) conflicts.push({ name, rows: added });

  const evolving = list.filter((r) => EVOLVING.test(r.action));
  if (evolving.length > 0 && new Set(list.map((r) => r.def)).size > 1) notes.push({ name, rows: list });
}

// ---------------------------------------------------------------- 2. 新增的依賴邊

const designCache = new Map();
function designText(subsys) {
  if (designCache.has(subsys)) return designCache.get(subsys);
  const p = join(root, "subsystems", subsys, "design.md");
  const t = existsSync(p) ? readFileSync(p, "utf8") : null;
  designCache.set(subsys, t);
  return t;
}
const EDGE_SPLIT = /\s*(?:→|->|=>)\s*/;
const edgeRows = [];
for (const d of docs) {
  for (const e of d.edges) {
    const ends = e.split(EDGE_SPLIT).map((s) => s.trim()).filter(Boolean);
    const dm = designText(d.subsys);
    const seen = ends.length >= 2 && dm ? ends.every((x) => dm.includes(x)) : false;
    edgeRows.push({ id: d.id, subsys: d.subsys, edge: e, ends: ends.length, seen, hasDesign: !!dm });
  }
}

// ---------------------------------------------------------------- 輸出

if (conflicts.length > 0) {
  console.log(`=== 同名不同定義(${conflicts.length})===`);
  console.log("兩份 spec 都以「新增」宣告同一個名字,而定義文字不同。這種矛盾不會產生任何錯誤訊息:");
  console.log("兩邊各自內部自洽、各自的測試也各自全綠,要到兩個 feature 接起來才爆。\n");
  for (const c of conflicts) {
    console.log(`- \`${c.name}\``);
    for (const r of c.rows) console.log(`    ${r.id}(${r.kind}/${r.action})  ${r.def}`);
  }
  console.log("");
}

if (notes.length > 0) {
  console.log(`=== 同名但有一邊是修改 / 移除(${notes.length},提示,不算違規)===`);
  console.log("這通常是正常演進(enhance 改了 feature 定義的東西),但仍要確認改的是同一個東西。\n");
  for (const c of notes) {
    console.log(`- \`${c.name}\``);
    for (const r of c.rows) console.log(`    ${r.id}(${r.kind}/${r.action})  ${r.def}`);
  }
  console.log("");
}

if (edgeRows.length > 0) {
  console.log(`=== 新增的依賴邊(${edgeRows.length},待判清單,不影響 exit code)===`);
  console.log("「design.md 找不到」不等於違規 —— 那份文檔可能用別的寫法表達同一條邊。");
  console.log("要不要納進宣告是閘門上的裁決,腳本只負責一條都不漏掉。\n");
  for (const r of edgeRows) {
    const mark = !r.hasDesign ? "?  該子系統沒有 design.md" : r.seen ? "✓  兩端都在 design.md 裡" : "✗  design.md 找不到兩端";
    console.log(`- ${r.id}  ${r.edge}    ${mark}`);
  }
  console.log("");
}

if (!quiet) {
  const names = byName.size;
  console.log(
    `掃了 ${docs.length} 份 spec(${new Set(docs.map((d) => d.subsys)).size} 個子系統)、${names} 個宣告過的名字、${edgeRows.length} 條新增依賴邊。`,
  );
  if (conflicts.length === 0) {
    console.log(notes.length > 0
      ? "沒有「新增 vs 新增」的同名衝突(有修改 / 移除的成對出現,列在提示裡)。"
      : "跨文檔同名的定義全部逐字相同。");
  }
  if (docs.length < 2) console.log("(**只有一份 spec 在範圍內,跨文檔對帳本來就比不出東西** —— 這不是通過,是沒得比)");
}

process.exit(conflicts.length > 0 ? 1 : 0);
