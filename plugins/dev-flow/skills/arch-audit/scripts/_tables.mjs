/**
 * _tables.mjs — markdown **表格**的唯一解析器(不可執行,只給同目錄的腳本 import)。
 *
 * 為什麼獨立成一支:`tableCells()` 原本在 `scan-status.mjs` 與 `lint-laws.mjs` 各一份,
 * 而**同名不同約**:
 *   scan-status —— 不是表格列、或是分隔列時回 `null`,順便把「整列都空」也當分隔列
 *   lint-laws   —— 永遠回陣列,分隔列由呼叫端自己判,而它的判法不認「整列都空」
 *
 * 一個回 `null` 一個回 `[]`,呼叫端寫 `cells.length` 就會在其中一支上炸掉或靜默略過。
 * 表格是「功能規劃」「模組群」「開發階段」「介面」四種對帳的載體,少讀一列就是少一個項目,
 * 而少讀不會報錯。所以這裡把兩種語意拆成**兩個名字**,不留「預設回什麼」可以猜錯的東西:
 *   `tableCells()` 純切格,永遠回陣列;`dataCells()` 只回資料列,其餘一律 `null`。
 */

/** 把表格列切成儲存格:`| a | b |` → `["a", "b"]` */
export function tableCells(line) {
  const t = String(line ?? "").trim().replace(/^\|/, "").replace(/\|$/, "");
  return t.split("|").map((c) => c.trim());
}

/**
 * 分隔列(`|---|---|`)或整列皆空(`| | |`)—— 兩者都不是資料列。
 * 「整列皆空」要一起認:漏認的話它會被當成一列資料,欄位全空,
 * 於是對帳多出一個叫「」的項目,而那個項目在原始檔裡看起來只是一條排版空行。
 */
export function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((c) => c === "" || /^:?-{2,}:?$/.test(c));
}

/** 一行是不是表格列(第一個非空白字元是 `|`) */
export function isTableRow(line) {
  return String(line ?? "").trimStart().startsWith("|");
}

/**
 * 只取**資料列**的儲存格:不是表格列、是分隔列、或整列皆空時一律回 `null`。
 * 掃表格找項目時用這支;要連表頭一起處理時用 `tableCells()` + `isSeparatorRow()`。
 */
export function dataCells(line) {
  if (!isTableRow(line)) return null;
  const cells = tableCells(line);
  return isSeparatorRow(cells) ? null : cells;
}
