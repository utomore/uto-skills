/**
 * _gap-status.mjs — `spec-gaps.md` 條目的**唯一**解析器(不可執行,只給同目錄的腳本 import)。
 *
 * 為什麼要獨立成一支:這份格式原本在 `scan-status.mjs` 與 `id-map.mjs` 各寫一次正則,
 * 兩份寫法對「認不出來的狀態行」給出**相反**的答案 —— scan-status 比對不到就默認 `open`
 * (當成未結),id-map 只數 `狀態:open` 出現幾次(認不出來 = 0 個 open = 全部已結)。
 * 同一份檔案、同一個條目,一支說還卡著、一支說做完了,而且兩支都不出聲。
 * 格式只准有一個解析器,否則漂移不會被發現,只會被兩邊各自吸收成不同的事實。
 *
 * 讀值與判格式分成兩層:
 *   **讀值寬鬆** —— `- 狀態:open`、`**狀態**:closed`、值被反引號包住,都讀得出來。
 *   **判格式嚴格** —— 讀得出來但不是標準寫法,回報進 `issues`,由呼叫端計入 exit code。
 * 只有寬鬆沒有嚴格,格式會一路漂到沒人看得懂;只有嚴格沒有寬鬆,就是原本那個靜默漏讀 ——
 * 而靜默漏讀最惡劣的地方是它只在「內容已結案」的條目上現形,真的還 open 的條目寫錯了
 * 看起來完全正常,所以實際發生率永遠比看得到的高。
 */

/**
 * 寬鬆:抓得到就抓。第 1 組 = 列表符號(沒有代表不是列表項),第 2 組 = 冒號後的原文。
 * 列表符號後面**必須**跟空白:`*` 同時是列表符號與強調符號,不要求空白的話
 * `**狀態**:open` 的第一個 `*` 會被當成列表符號,於是最該抓的那一種寫法反而判成合格。
 */
const field = (name) =>
  new RegExp(`^[ \\t]*(?:([-*])[ \\t]+)?[*\`_]{0,2}[ \\t]*${name}[ \\t]*[*\`_]{0,2}[ \\t]*[:：][ \\t]*(.*)$`, "m");

const STATE = field("狀態");
const TOPIC = field("模糊點");
const FIX = field("修訂");

/** 標準寫法:`- 狀態:open`(值外圍容忍反引號,其餘一律回報) */
const STATE_CANONICAL = /^[ \t]*[-*][ \t]+狀態[ \t]*[:：][ \t]*`?(?:open|resolved)`?[ \t]*$/;

/** 從原文取出狀態值:剝掉前導的強調 / 反引號,只取第一個詞(`closed`(2026-…) → closed) */
function stateValue(raw) {
  const s = String(raw ?? "").trim().replace(/^[*`_]+/, "");
  return (s.match(/^([A-Za-z][A-Za-z-]*|[\u4e00-\u9fff]+)/)?.[1] ?? "").toLowerCase();
}

/**
 * 解析一份 `spec-gaps.md` 的全文,回傳每個 `## GAP-<n>` / 舊制 `## G<n>` 條目:
 *   `{ id, head, topic, fix, state, resolved, issues }`
 * `resolved` 照 `spec-roles.md`「spec-gaps 協議」:**只有** `resolved` 算結案。
 * `issues` 是這個條目的格式問題(字串陣列),呼叫端負責把它報出來並計入 exit code ——
 * 不出聲的格式檢查等於沒有檢查,而這正是這支模組存在的理由。
 */
export function parseGapBlocks(text) {
  const out = [];
  for (const b of String(text ?? "").split(/^##\s+/m).slice(1)) {
    const head = b.split("\n", 1)[0].trim();
    const id = head.match(/^(GAP-\d+|G\d+)/)?.[1];
    if (!id) continue;

    const st = b.match(STATE);
    const state = st ? stateValue(st[2]) : "";
    const issues = [];
    if (!st) {
      issues.push(`${id}:缺「狀態」行(格式:\`- 狀態:open\`)`);
    } else if (!STATE_CANONICAL.test(st[0])) {
      if (!st[1])
        issues.push(`${id}:「狀態」寫成了段落而不是列表項,盤點腳本讀不到(要寫 \`- 狀態:…\`,不要寫 \`**狀態**:…\`)`);
      if (!/^(open|resolved)$/.test(state))
        issues.push(
          `${id}:狀態值「${state || "(空白)"}」不是 open / resolved` +
            `(gap 的結案值只有 \`resolved\`;\`done\` / \`closed\` 是任務文檔的詞彙,不通用)`,
        );
    }

    out.push({
      id,
      head,
      state,
      resolved: /^resolved/i.test(state),
      topic: b.match(TOPIC)?.[2]?.trim() || "-",
      fix: b.match(FIX)?.[2]?.trim() || null,
      issues,
    });
  }
  return out;
}
