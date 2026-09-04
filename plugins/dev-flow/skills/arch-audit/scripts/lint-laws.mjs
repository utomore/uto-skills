#!/usr/bin/env node
/**
 * lint-laws.mjs — spec 文檔「介面表 + Laws」的機械檢查。
 *
 * 檢查對象是含「## Laws」段的 **markdown 文檔**(專案的 `.design/` 全樹,或本 plugin 自己的模板)。
 * 它強制執行 spec-design 的三條規則:
 *
 *   1. **四格齊全**:每條 `LAW-n` / `REG-n` 底下必須有「量詞 / 定義域 / 前提 / 觀察點」四個子項。
 *      這四格不是隨便挑的,是 property test 的四個組成部件(量詞→forall 變數、定義域→產生器、
 *      前提→precondition、觀察點→斷言)。**填不滿 = 這條 law 翻不成測試**。
 *   2. **觀察點可觀察**:觀察點至少要引用一個出現在同一份文檔「介面」表裡的識別碼。
 *      引用不到 = 這條性質從公開介面看不出來,那是**介面設計缺陷**,不是 qa 的問題
 *      (`_shared/testing-policy.md`:不開後門就測不到 = 介面設計缺陷)。
 *   3. **骨架位置寫符號、不寫行號**:介面表有「骨架位置」欄時,每一列必須是 `檔案#符號`(或 `-`)。
 *      行號在 impl 把未實作標記換成本體的那一刻就往下移,而流程裡沒有任何角色負責回頭修它 ——
 *      於是每份跑完的 spec 都留著一欄過期的座標,愈是後來的讀者愈會被它帶到錯的地方。
 *      符號名不會因為本體變長而改變,而且它跟簽名一起被「介面 ↔ 骨架」一致性檢查盯著。
 *   4. **骨架指得到**(`--skeleton` 才啟用):`檔案#符號` 的檔案真的存在,而且那個符號名真的
 *      出現在檔案裡;同一列簽名開頭的識別碼要與 `#符號` 相同。這是 `/spec-design` 步驟 7 第 1 條
 *      「介面 ↔ 骨架」對帳的**機械下限** —— 逐字比對簽名是跨語言的事,機器判不了,
 *      但「這一列指到一個不存在的檔案 / 不存在的符號 / 別的符號」判得了,而那三種漂移
 *      **不會產生任何錯誤訊息**:骨架照樣編得過,只是文檔指到了別的地方。
 *
 * 為什麼要有這支腳本:四格是文檔紀律,而文檔靠自覺遵守;這套流程的每一條紀律最後都要落到
 * 「有機器在查」,否則下一次修訂還是會漏。
 *
 * **它是下限不是上限**。第 2 條只驗「觀察點有沒有引用到一個真的存在的介面」——引用了**不代表**
 * 那個介面看得見這件事。例如「`rotate` 兩次與一次造成失效的集合相同」提到了 `rotate`,機械上就過得了,
 * 但「失效的集合」實際上無從觀察。那一關只能靠填格的人。腳本的價值是讓「懶得填」與「填不出來」
 * 這兩件事再也混不過去,不是取代判斷。
 *
 * 用法:
 *   node lint-laws.mjs [目錄...]       預設掃當前目錄
 *   node lint-laws.mjs --quiet         只印違規,不印摘要
 *   node lint-laws.mjs .design --skeleton <專案根>
 *                                      追加規則 4:把「骨架位置」拿去專案樹裡對
 *                                      (省略 `<專案根>` 時取 `.design` 的上一層)
 *
 * Exit code:0 = 沒有違規 / 1 = 有違規 / 2 = 路徑不存在
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { tableCells, isSeparatorRow } from "./_tables.mjs";
import { printHelpIfAsked } from "./_help.mjs";

// ---------------------------------------------------------------- 規格常數

/** 四格。順序就是翻譯成測試時的取用順序,改這裡之前先改 spec-design/SKILL.md 與兩份模板。 */
const SLOTS = ["量詞", "定義域", "前提", "觀察點"];

/** law 條目的開頭。`無law <介面名>:<理由>` 是模板允許的豁免寫法,不當成 law 解析。 */
const LAW_HEAD = /^(\s*)[-*]\s*((?:LAW|REG)-\d+)\s*[:：]/;
const SLOT_LINE = /^\s+[-*]\s*(量詞|定義域|前提|觀察點)\s*[:：]\s*(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;

/** 介面表所在的段落標題(feature 模式 / enhance 模式)。 */
const IFACE_HEADING = /^(介面|數據與介面變動)/;

/** 「骨架位置」欄:合規值 = `檔案#符號`,或 `-`(enhance 的「移除」列沒有骨架)。 */
const SKELETON_COL = "骨架位置";
const NO_SKELETON = new Set(["", "-", "—", "–", "N/A", "n/a", "無"]);
const HAS_LINENO = /:\d+\s*$/;
const LAWS_HEADING = /^Laws/;

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "dist-newstyle", "archive"]);

// ---------------------------------------------------------------- 參數

const argv = process.argv.slice(2);
printHelpIfAsked(argv, import.meta.url);
const quiet = argv.includes("--quiet");
const skIdx = argv.indexOf("--skeleton");
const skeletonOn = skIdx >= 0;
const skeletonArg = skeletonOn && argv[skIdx + 1] && !argv[skIdx + 1].startsWith("--") ? argv[skIdx + 1] : null;
const roots = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--quiet") continue;
  if (a === "--skeleton") {
    if (skeletonArg) i++;              // 它的參數不是掃描根目錄
    continue;
  }
  if (a.startsWith("--")) {
    console.error(`未知選項: ${a}`);
    process.exit(2);
  }
  roots.push(a);
}
if (roots.length === 0) roots.push(".");

/** 規則 4 的專案根:`--skeleton <路徑>` 給了就用它,沒給就取第一個掃描根的上一層。 */
const projectRoot = skeletonOn ? (skeletonArg ?? join(roots[0], "..")) : null;
const srcCache = new Map();
function srcText(rel) {
  if (srcCache.has(rel)) return srcCache.get(rel);
  const p = join(projectRoot, rel);
  let t = null;
  try { t = existsSync(p) && statSync(p).isFile() ? readFileSync(p, "utf8") : null; } catch { t = null; }
  srcCache.set(rel, t);
  return t;
}

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

const files = [];
for (const r of roots) {
  if (!existsSync(r)) {
    console.error(`路徑不存在: ${r}`);
    process.exit(2);
  }
  statSync(r).isDirectory() ? walk(r, files) : files.push(r);
}

// ---------------------------------------------------------------- 解析

/** 反引號範圍裡的內容(識別碼與簽名都寫在反引號裡)。 */
function backticked(line) {
  return [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

/** 從一段簽名文字取開頭的識別碼:`rotate :: TokenId -> ...` → rotate。 */
function leadingIdent(text) {
  const m = text.trim().match(/^[A-Za-z_][A-Za-z0-9_'.]*/);
  return m ? m[0] : null;
}

/**
 * 把一份文檔切成「段落標題 → 行區間」,再取出:
 *   - ifaceIdents:介面表裡宣告過的識別碼集合
 *   - skeletonCells:介面表「骨架位置」欄的每一格(有這欄才有值)
 *   - laws:每條 law 的編號、起始行、四格內容
 * 模板把整份 spec 包在 ```markdown 圍欄裡,所以**不跳過圍欄**——那樣模板自己也會被檢查到。
 */
function parseDoc(lines) {
  let section = null;
  const ifaceIdents = new Set();
  const skeletonCells = [];
  const laws = [];
  let cur = null;
  let skeletonCol = -1;   // 介面表裡「骨架位置」的欄索引;-1 = 這份文檔沒有這一欄

  const closeLaw = () => {
    if (cur) laws.push(cur);
    cur = null;
  };

  lines.forEach((raw, i) => {
    const h = raw.match(HEADING);
    if (h) {
      closeLaw();
      const title = h[1].trim();
      section = IFACE_HEADING.test(title) ? "iface" : LAWS_HEADING.test(title) ? "laws" : "other";
      return;
    }

    if (section === "iface") {
      // 介面表的每一列:取每個反引號片段開頭的識別碼
      if (raw.trimStart().startsWith("|")) {
        for (const cell of backticked(raw)) {
          const id = leadingIdent(cell);
          if (id) ifaceIdents.add(id);
        }
        const cells = tableCells(raw);
        if (skeletonCol < 0) {
          const at = cells.findIndex((c) => c.includes(SKELETON_COL));
          if (at >= 0) skeletonCol = at;           // 這一列是表頭
        } else if (!isSeparatorRow(cells) && cells.length > skeletonCol) {
          skeletonCells.push({ line: i + 1, value: cells[skeletonCol], row: raw.trim() });
        }
      }
      return;
    }

    if (section !== "laws") {
      closeLaw();
      return;
    }

    const head = raw.match(LAW_HEAD);
    if (head) {
      closeLaw();
      cur = { id: head[2], line: i + 1, text: raw.trim(), slots: new Map() };
      return;
    }

    if (cur) {
      const slot = raw.match(SLOT_LINE);
      if (slot) {
        cur.slots.set(slot[1], { line: i + 1, value: slot[2].trim() });
        return;
      }
      // 空行不結束條目(允許 law 之間留白);其他非縮排內容結束它
      if (raw.trim() !== "" && !/^\s/.test(raw)) closeLaw();
    }
  });

  closeLaw();
  return { ifaceIdents, skeletonCells, laws };
}

// ---------------------------------------------------------------- 檢查

const violations = [];
let checkedDocs = 0;
let checkedLaws = 0;
let checkedSkeletons = 0;
let checkedSkeletonRefs = 0;

for (const f of files) {
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  if (!lines.some((l) => LAWS_HEADING.test((l.match(HEADING)?.[1] ?? "").trim()))) continue;

  const { ifaceIdents, skeletonCells, laws } = parseDoc(lines);
  if (laws.length === 0) continue;
  checkedDocs++;
  // 分隔號一律正規化成 `/`:Windows 上 `relative` 回 `a\b\c`,同一份輸出在不同平台長得不一樣,
  // 釘 golden 的回歸測試會因為平台而紅,而那是雜訊不是回歸。
  const rel = relative(process.cwd(), f).split(/[\\/]/).join("/");

  // 規則 3:骨架位置寫符號、不寫行號(沒有這一欄的舊文檔跳過,不回頭強制改)
  for (const cell of skeletonCells) {
    checkedSkeletons++;
    const bare = cell.value.replace(/`/g, "").trim();
    if (NO_SKELETON.has(bare)) continue;
    const rule = HAS_LINENO.test(bare)
      ? "骨架位置寫了行號(impl 填完本體就會漂掉,沒有人負責回頭修);改寫 `檔案#符號`"
      : bare.includes("#")
        ? null
        : "骨架位置不是 `檔案#符號` 形式(指不到骨架裡的哪一個符號)";
    if (rule) { violations.push({ file: rel, line: cell.line, id: SKELETON_COL, rule, text: cell.row }); continue; }

    // 規則 4:骨架真的指得到(只在 --skeleton 開啟時)
    if (!skeletonOn || !bare.includes("#")) continue;
    const [srcRel, sym] = [bare.slice(0, bare.indexOf("#")).trim(), bare.slice(bare.indexOf("#") + 1).trim()];
    checkedSkeletonRefs++;
    const text = srcText(srcRel);
    if (text === null) {
      violations.push({ file: rel, line: cell.line, id: SKELETON_COL, rule: `骨架檔案不存在:${srcRel}(相對於 ${projectRoot})`, text: cell.row });
      continue;
    }
    if (sym && !text.includes(sym)) {
      violations.push({ file: rel, line: cell.line, id: SKELETON_COL, rule: `${srcRel} 裡找不到符號 \`${sym}\`(骨架被改名、或這一列指到了別的地方)`, text: cell.row });
      continue;
    }
    // 同一列簽名開頭的識別碼,要與 `#符號` 是同一個。指到別的符號時骨架照樣編得過,
    // 只有這一關看得出來文檔指錯了地方。
    const first = backticked(cell.row).map(leadingIdent).find(Boolean);
    if (sym && first && first !== sym) {
      violations.push({ file: rel, line: cell.line, id: SKELETON_COL, rule: `這一列的簽名是 \`${first}\`,骨架位置卻指向 \`${sym}\``, text: cell.row });
    }
  }

  for (const law of laws) {
    checkedLaws++;

    // 規則 1:四格齊全
    const missing = SLOTS.filter((s) => !law.slots.has(s) || law.slots.get(s).value === "");
    if (missing.length > 0) {
      violations.push({
        file: rel,
        line: law.line,
        id: law.id,
        rule: `缺格:${missing.join("、")}`,
        text: law.text,
      });
    }

    // 規則 2:觀察點要引用得到介面表裡的識別碼(介面表是空的就沒得比對,跳過)
    const obs = law.slots.get("觀察點");
    if (obs && obs.value !== "" && ifaceIdents.size > 0) {
      const referenced = backticked(obs.value)
        .map(leadingIdent)
        .filter(Boolean)
        .some((id) => ifaceIdents.has(id));
      if (!referenced) {
        violations.push({
          file: rel,
          line: obs.line,
          id: law.id,
          rule: "觀察點沒有引用任何介面表裡的識別碼(從公開介面觀察不到 = 介面設計缺陷)",
          text: obs.value,
        });
      }
    }
  }
}

// ---------------------------------------------------------------- 輸出

if (violations.length > 0) {
  console.log(`=== spec 文檔違規(${violations.length})===`);
  console.log("每條 LAW- / REG- 底下要有「量詞 / 定義域 / 前提 / 觀察點」四個子項,");
  console.log("觀察點必須用反引號引用一個介面表裡有的識別碼,");
  console.log("介面表的「骨架位置」欄一律寫 `檔案#符號`(移除的列寫 `-`)。格式見 spec-design/templates/。");
  if (skeletonOn) console.log("`--skeleton` 開著,所以「骨架位置」還要在專案樹裡指得到:檔案在、符號在、且與同一列的簽名同名。");
  console.log("");
  for (const v of violations) {
    console.log(`- ${v.file}:${v.line}  ${v.id}  ${v.rule}`);
    console.log(`  ${v.text.slice(0, 140)}`);
  }
  process.exit(1);
}

if (!quiet) {
  console.log(
    `掃了 ${files.length} 份 markdown,其中 ${checkedDocs} 份有 Laws 段、共 ${checkedLaws} 條 law、` +
      `${checkedSkeletons} 列骨架位置,全部合規。`,
  );
  console.log(
    skeletonOn
      ? `骨架對帳:${checkedSkeletonRefs} 列的 \`檔案#符號\` 拿去 ${projectRoot} 底下對過,檔案與符號都找得到。`
      : `(**沒有跑骨架對帳**。加 \`--skeleton <專案根>\` 才會把「骨架位置」拿去專案樹裡對 —— 沒跑跟對得上,在這行上面看起來一樣。)`,
  );
}
process.exit(0);
