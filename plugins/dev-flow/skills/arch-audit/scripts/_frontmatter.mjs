/**
 * _frontmatter.mjs — `.design/` 文檔 **YAML frontmatter** 的唯一解析器
 * (不可執行,只給同目錄的腳本 import)。
 *
 * 為什麼獨立成一支:原本 `scan-status.mjs` 與 `id-map.mjs` 各有一份,而兩份**寬嚴不同**:
 *   scan-status —— 認行內陣列、剝引號、去行尾註解,並把 YAML **區塊列表**抓出來報成不合規
 *   id-map      —— 裸 `key: value` 比對,`subsystems: [a, b]` 讀成字串 `"[a, b]"`,
 *                  區塊列表**靜默讀成空值**
 *
 * 實測到的分岔:`description: "示範專案:含冒號的描述"` —— scan-status 印出去掉引號的值,
 * id-map 印出**連引號一起**的值。引號是 YAML 語法(`doc-lifecycle.md`:值含 `:` 或 `#` 時要括起來),
 * 不是描述的一部分,所以同一份 `system.md` 的同一個欄位,兩支報表寫出兩個不同的字串。
 * 更危險的是 id-map 那支對 YAML **區塊列表**完全無感:讀成空值又不出聲,而 `subsystems`
 * 是進度的分母(`doc-lifecycle.md`「分母必須來自規劃」),讀成空的後果是整個未開工的部分
 * 從報表上消失 —— 那條慣例當初要修的洞,會從解析層漏回來。
 *
 * 讀值寬鬆、判格式嚴格,與 `_gap-status.mjs` 同一套設計:區塊列表**讀得到也照樣回報**,
 * 由呼叫端計入 exit code。不出聲的檢查等於沒有檢查。
 */
import { readFileSync, openSync, readSync, closeSync } from "node:fs";

/** frontmatter 通常很短;超過這個大小才需要放大重讀(見 readFrontmatter) */
export const HEAD_BYTES = 4096;

/** 只讀檔案開頭 bytes,回傳 { text, full }(full = 整份都讀完了) */
export function readHead(path, bytes = HEAD_BYTES) {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return { text: buf.toString("utf8", 0, n), full: n < bytes };
  } finally {
    closeSync(fd);
  }
}

/**
 * 解析第一組 `---` … `---` 之間的 metadata(淺層,夠用即可)。
 * 只認 `key: value` 與行內陣列 `key: [a, b]`;縮排的 key 視為巢狀,不當成頂層欄位。
 * 遇到 YAML 區塊列表(`key:` 後接縮排 `- item`)**不解析**,而是把該 key 記進
 * `blockListKeys` 讓呼叫端報錯 —— 那種寫法會讓清單被讀成空值,相依關係與名冊就對不上。
 * @returns {{meta: object|null, blockListKeys: string[]}} 沒有 frontmatter 時 meta 為 null
 */
export function parseFrontmatter(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { meta: null, blockListKeys: [] };
  const meta = {};
  const blockListKeys = [];
  let pending = null; // 上一個「值為空」的頂層 key
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "---") return { meta, blockListKeys };
    if (/^\s+-\s/.test(line)) {
      if (pending && !blockListKeys.includes(pending)) blockListKeys.push(pending);
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const raw = m[2].trim();
    const isEmpty = raw === "" || raw.startsWith("#");
    meta[m[1]] = isEmpty ? "" : parseValue(m[2]);
    pending = isEmpty ? m[1] : null;
  }
  return { meta: null, blockListKeys: [] }; // 沒有結尾 --- 視為無 frontmatter
}

/** 取值:引號字串取引號內容;行內陣列轉陣列;否則去掉行尾 `#` 註解 */
export function parseValue(raw) {
  const v = String(raw ?? "").trim();
  const q = v.match(/^(['"])([\s\S]*?)\1/);
  if (q) return q[2];
  const arr = v.match(/^\[([\s\S]*)\]/);
  if (arr) return splitItems(arr[1]);
  return v.replace(/\s+#.*$/, "").trim();
}

/** 切開行內陣列內容 `"a, b"` → `["a", "b"]` */
export function splitItems(inner) {
  return String(inner ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^(['"])([\s\S]*)\1$/, "$2").trim())
    .filter(Boolean);
}

/** 一律轉成陣列(單值 → `[值]`,空值 → `[]`) */
export function asList(v) {
  if (Array.isArray(v)) return v;
  const s = String(v ?? "").trim();
  return s === "" ? [] : [s];
}

/**
 * 從檔案讀 frontmatter(只讀開頭,長 metadata 會自動放大一次重讀)。
 * 盤點大量文檔時用這支,不要整份讀進來。
 */
export function readFrontmatter(path) {
  let last = { meta: null, blockListKeys: [] };
  for (const bytes of [HEAD_BYTES, HEAD_BYTES * 4]) {
    const head = readHead(path, bytes);
    last = parseFrontmatter(head.text);
    if (last.meta || head.full) break;
  }
  return last;
}

/**
 * 讀整份文檔:frontmatter + 全文。需要內文(章節、表格、條目)時用這支。
 * 讀不到檔案時回 `{ meta: {}, blockListKeys: [], body: "" }` —— 呼叫端多半在盤點,
 * 少一個檔不該讓整趟掃描中斷。
 */
export function readDoc(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { meta: {}, blockListKeys: [], body: "" };
  }
  const { meta, blockListKeys } = parseFrontmatter(text);
  return { meta: meta ?? {}, blockListKeys, body: text };
}
