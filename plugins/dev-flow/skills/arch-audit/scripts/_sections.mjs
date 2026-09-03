/**
 * _sections.mjs — markdown **標題段落**的唯一解析器(不可執行,只給同目錄的腳本 import)。
 *
 * 為什麼獨立成一支:這件事原本在 `scan-status.mjs` 與 `id-map.mjs` 各寫了一個 `section()`,
 * 而兩支對同一份檔案給出**不同答案**:
 *   scan-status —— 認 `##`~`######`、**保留標題那一行**、到同級或更高級標題為止、找不到回 `null`
 *   id-map      —— 只認 `##`、**丟掉標題那一行**、找不到回 `""`
 *
 * 「含不含標題行」是最惡劣的一項:兩邊都回傳字串、都不出聲,而差的那一行剛好是節名本身 ——
 * 拿去數編號時,標題裡帶 id 的節(`## GAP-1(F002 / qa)`)一支數得到、一支數不到。
 * 「起始層級」則讓 `### Laws` 這種寫法在一支眼裡整節消失、在另一支眼裡正常。
 * 這正是 `_gap-status.mjs` 檔頭記過的同一種事故,換一個格式再發生一次:
 * **格式只准有一個解析器**,否則漂移不會被發現,只會被兩邊各自吸收成不同的事實。
 *
 * 回傳**物件**而不是字串,是刻意的:呼叫端必須明講要 `heading` 還是 `body`,
 * 沒有「預設含不含標題」這個可以猜錯的東西。
 */

const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
/** 程式碼圍欄的開頭 / 結尾(``` 或 ~~~,允許前導空白) */
const FENCE = /^\s*(?:```|~~~)/;

/**
 * 掃過每一行,標出哪些行在程式碼圍欄**裡面**。
 *
 * 圍欄裡的 `## …` **不是標題**,是被引用的格式範例。不濾掉的話有兩種後果,都不出聲:
 *   1. `--list` 把範例列成章節,讀的人以為那是一節
 *   2. 更糟 —— 一節會在範例出現的那一行被**提前切斷**。`spec-roles.md` 的
 *      〈spec-gaps 協議〉底下就貼著 `## GAP-1(F002 / qa)` 當格式範例,
 *      不濾掉的話那一節剛好斷在範例前面,把要教的格式整段丟掉。
 */
function fenceMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let open = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      mask[i] = true;      // 圍欄那一行本身也不是標題
      open = !open;
      continue;
    }
    mask[i] = open;
  }
  return mask;
}

/** 一行是不是 markdown 標題;是的話回 { level, title },否則 null */
export function heading(line) {
  const m = String(line).match(HEADING);
  return m ? { level: m[1].length, title: m[2] } : null;
}

/**
 * 這份文檔有哪些標題(含層級與行號)。給「節名打錯時印出實際有哪些節」用 ——
 * 找不到就靜默回空,是這支模組存在的理由之一,呼叫端要有東西可以報。
 * @returns {{level:number, title:string, line:number}[]}
 */
export function headings(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const fenced = fenceMask(lines);
  const out = [];
  lines.forEach((l, i) => {
    if (fenced[i]) return;
    const h = heading(l);
    if (h) out.push({ ...h, line: i + 1 });
  });
  return out;
}

/**
 * 取出**第一個**標題符合 `titleRe` 的段落,到「下一個同級或更高級標題」為止。
 *
 * @param {string} text 文檔全文
 * @param {RegExp} titleRe 比對標題文字(不含 `#` 與空白)
 * @param {{minLevel?:number, maxLevel?:number}} [opt]
 *        起始標題的層級範圍,預設 `2..6`(不把 H1 文件標題當節)
 * @returns {{level:number, heading:string, title:string, body:string, text:string, line:number}|null}
 *          `heading` 標題那一行原文;`body` 標題以下到節末;`text` 兩者相接。找不到回 `null`
 */
export function section(text, titleRe, { minLevel = 2, maxLevel = 6 } = {}) {
  const lines = String(text ?? "").split(/\r?\n/);
  const fenced = fenceMask(lines);
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    if (fenced[i]) continue;
    const h = heading(lines[i]);
    if (!h) continue;
    if (start < 0) {
      if (h.level >= minLevel && h.level <= maxLevel && titleRe.test(h.title)) {
        start = i;
        level = h.level;
      }
    } else if (h.level <= level) {
      return make(lines, start, i, level);
    }
  }
  return start < 0 ? null : make(lines, start, lines.length, level);
}

function make(lines, start, end, level) {
  const headingLine = lines[start];
  const body = lines.slice(start + 1, end).join("\n").trimEnd();
  return {
    level,
    heading: headingLine,
    title: heading(headingLine).title,
    body,
    text: `${headingLine}\n${body}`.trimEnd(),
    line: start + 1,
  };
}
