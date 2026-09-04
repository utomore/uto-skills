/**
 * _counts.mjs — spec 檔內**條目編號**的唯一計數器(不可執行,只給同目錄的腳本 import)。
 *
 * 為什麼獨立成一支:LAW / EX / ASM 的份數原本只有 `id-map.mjs` 在數;`scan-status.mjs`
 * 改成 PM 版面後也要數同一批東西(規格寫到幾成、假設裁了幾條)。兩支各寫一次正則,
 * 就會重演 `_gap-status.mjs` 檔頭記過的事故:同一份檔、兩個答案、兩邊都不出聲。
 * 格式只准有一個解析器。
 */

/**
 * 數某個編號在一段內文裡被**定義**了幾次。只認三種「定義位置」,不認散落在內文的提及:
 *   清單項  `- LAW-1: …` / `- [ ] STEP-1: …`
 *   小標題  `## GAP-1(…)`
 *   表格首欄 `| EX-1 | … |`(Examples 與 build-log 的表都長這樣)
 * 新舊制都收(`LAW-1` 與舊的 `L1`),回傳去重後的序號個數。
 */
export function countIds(body, ...prefixes) {
  const alt = prefixes.join("|");
  const em = "[*`_]{0,2}"; // 容忍 `- **LAW-1**(…)` 這種強調寫法 —— 實際文檔大量這樣寫
  const seen = new Set();
  const listOrHead = new RegExp(
    `(?:^|\\n)[ \\t]*(?:[-*][ \\t]*(?:\\[[ x]\\][ \\t]*)?|#{2,4}[ \\t]*)${em}(?:${alt})-?(\\d+)${em}\\s*[::.)\\s(（]`,
    "g",
  );
  const tableCell = new RegExp(`(?:^|\\n)[ \\t]*\\|[ \\t]*${em}(?:${alt})-?(\\d+)${em}[ \\t]*\\|`, "g");
  for (const re of [listOrHead, tableCell]) for (const m of String(body ?? "").matchAll(re)) seen.add(m[1]);
  return seen.size;
}

/**
 * 數「待確認假設」一節的條目與裁決:`{ total, ruled, marked }`(傳入**節內文**,不含標題)。
 *
 * `裁決:` 欄是後來才補的(`delegation-design.md`)。**舊文檔一條 `裁決:` 都沒有,
 * 那代表「不知道」,不是「全部未裁」** —— 裁決結果當時寫在 build-log 的彙總表裡。
 * 分不出這兩者就會把一個早就裁完的子系統報成滿江紅,而報一個你證明不了的數字比不報還糟。
 * 所以 `marked` 為 0 時呼叫端要退回只印總數。
 */
export function countRulings(sectionBody) {
  const sec = String(sectionBody ?? "");
  const total = countIds(sec, "ASM", "A");
  const rulingLines = [...sec.matchAll(/^[ \t]*[-*][ \t]*[*`_]{0,2}裁決[*`_]{0,2}[ \t]*[::][ \t]*(.*)$/gm)];
  const marked = rulingLines.length;
  const ruled = rulingLines.filter((m) => m[1].trim() && !/^未裁/.test(m[1].trim())).length;
  return { total, ruled, marked };
}
