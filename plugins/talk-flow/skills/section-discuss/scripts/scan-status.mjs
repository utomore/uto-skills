#!/usr/bin/env node
/**
 * scan-status.mjs — 掃描 docs/topic.md 與 docs/section-*.md 的 frontmatter metadata,
 * 列出各段落狀態並比對 topic.md 的 sections 權威清單。只讀每檔開頭 4KB,不載入全文。
 * 清單欄位(sections / pages / depends-on)一律**行內陣列** `[a, b]`;寫成 YAML 區塊列表
 * 會被列為格式不合規並以 exit code 1 收場(不做兩種格式並存的容忍解析)。
 *
 * 用法: node scan-status.mjs [docs目錄]   (預設 ./docs)
 * Exit code: 0 = 全部段落完成(done/rejected)且清單一致 / 1 = 有未完成、metadata 缺失或清單不一致
 */
import { readdirSync, openSync, readSync, closeSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const docsDir = process.argv[2] ?? "./docs";
const HEAD_BYTES = 4096;
const FINAL_STATUSES = new Set(["done", "rejected"]);
const DESC_WIDTH = 44; // 主軸(description)欄顯示寬度上限(全形字算 2)

if (!existsSync(docsDir)) {
  console.error(`找不到 docs 目錄: ${docsDir}`);
  process.exit(1);
}

/** 只讀檔案開頭 bytes(預設 HEAD_BYTES) */
function readHead(path, bytes = HEAD_BYTES) {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return { text: buf.toString("utf8", 0, n), n, full: n < bytes };
  } finally {
    closeSync(fd);
  }
}

/**
 * 讀 frontmatter,回傳 { meta, blockListKeys };無 frontmatter 時 meta 為 null。
 * 開頭 HEAD_BYTES 內找不到結尾 --- 時放大一次再試,避免長 metadata 被誤判為缺失。
 */
function readFrontmatter(path) {
  let last = { meta: null, blockListKeys: [] };
  for (const bytes of [HEAD_BYTES, HEAD_BYTES * 4]) {
    const head = readHead(path, bytes);
    last = parseFrontmatter(head.text);
    if (last.meta || head.full) break;
  }
  return last;
}

/**
 * 解析第一組 --- ... --- 之間的 metadata(淺層,夠用即可)。
 * 只認 `key: value` 與行內陣列 `key: [a, b]`;縮排的 key 視為巢狀結構,不當成頂層欄位。
 * 遇到 YAML 區塊列表(`key:` 後接縮排 `- item`)不解析,而是把該 key 記進 blockListKeys 讓呼叫端報錯。
 */
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
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

/** 取值:引號字串取引號內容;行內陣列轉陣列;否則去掉行尾 # 註解 */
function parseValue(raw) {
  const v = raw.trim();
  const q = v.match(/^(['"])([\s\S]*?)\1/);
  if (q) return q[2];
  const arr = v.match(/^\[([\s\S]*)\]/);
  if (arr) return splitItems(arr[1]);
  return v.replace(/\s+#.*$/, "").trim();
}

/** 切開行內陣列內容 "a, b" → ["a", "b"] */
function splitItems(inner) {
  return inner
    .split(",")
    .map((s) => s.trim().replace(/^(['"])([\s\S]*)\1$/, "$2").trim())
    .filter(Boolean);
}

/** 正規化清單欄位:陣列直接用,字串則容忍行內陣列或單一裸值 */
function parseList(v) {
  if (Array.isArray(v)) return v;
  const s = String(v ?? "").trim();
  if (!s) return [];
  const m = s.match(/^\[([\s\S]*)\]$/);
  return m ? splitItems(m[1]) : [s];
}

/** 表格顯示值:陣列印成 [a, b],空值印 - */
function fmtValue(v) {
  if (Array.isArray(v)) return v.length ? `[${v.join(", ")}]` : "[]";
  const s = String(v ?? "").trim();
  return s === "" ? "-" : s;
}

/** 顯示寬度(CJK 全形字算 2)*/
function dispWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return w;
}

/** 依顯示寬度截斷 */
function truncate(s, max) {
  const str = String(s);
  if (dispWidth(str) <= max) return str;
  let out = "";
  for (const ch of str) {
    if (dispWidth(out + ch) > max - 1) break;
    out += ch;
  }
  return out + "…";
}

/** 清單欄位寫成 YAML 區塊列表的檔案 */
const badFormat = [];
function checkFormat(rel, blockListKeys) {
  if (blockListKeys.length) badFormat.push({ file: rel, keys: blockListKeys });
}
function reportFormat() {
  if (badFormat.length === 0) return;
  console.log(`\n=== frontmatter 格式不合規:清單欄位請用行內陣列(${badFormat.length})===`);
  for (const b of badFormat) {
    console.log(`- ${b.file}:${b.keys.join("、")} 寫成 YAML 區塊列表`);
    for (const k of b.keys) console.log(`  改成 → ${k}: [item-a, item-b]`);
  }
}

// --- topic.md ---
const topicPath = join(docsDir, "topic.md");
let topicMeta = null;
let topicSectionsBlockList = false;
if (existsSync(topicPath)) {
  const parsed = readFrontmatter(topicPath);
  topicMeta = parsed.meta;
  topicSectionsBlockList = parsed.blockListKeys.includes("sections");
  checkFormat("topic.md", parsed.blockListKeys);
  if (topicMeta) {
    console.log(`Topic:${topicMeta.title ?? "-"} — ${topicMeta.description ?? "(缺 description)"}`);
    console.log(`時長:${topicMeta["duration-minutes"] ?? "-"} 分  類型:${topicMeta["event-type"] ?? "-"}  聽眾:${topicMeta["audience-level"] ?? "-"}\n`);
  } else {
    console.log("⚠ docs/topic.md 缺少 frontmatter metadata\n");
  }
} else {
  console.log("⚠ 找不到 docs/topic.md(建議先執行 /topic-design)\n");
}

// --- section-*.md ---
const files = readdirSync(docsDir)
  .filter((f) => /^section-\d{2,}-.*\.md$/.test(f))
  .sort();

const rows = [];
let totalMinutes = 0;
for (const name of files) {
  const path = join(docsDir, name);
  const parsed = readFrontmatter(path);
  const meta = parsed.meta;
  const rel = relative(docsDir, path).replaceAll("\\", "/");
  checkFormat(rel, parsed.blockListKeys);
  const description = meta?.description ? truncate(meta.description, DESC_WIDTH) : "-";
  const status = meta?.status ? String(meta.status) : "⚠ missing-metadata";
  if (meta?.status && meta.status !== "rejected") totalMinutes += Number(meta["est-minutes"] ?? 0) || 0;
  rows.push({
    description,
    id: meta?.id ? String(meta.id) : "-",
    order: fmtValue(meta?.order),
    status,
    min: fmtValue(meta?.["est-minutes"]),
    pages: fmtValue(meta?.pages),
    file: rel,
  });
}

if (rows.length === 0) {
  console.log(`docs 目錄(${docsDir})下沒有任何 section-*.md 檔案。`);
  reportFormat();
  process.exit(topicMeta && badFormat.length === 0 ? 0 : 1);
}

// 對齊表格輸出(主軸優先,id 次之)
const headers = { description: "主軸", id: "id", order: "order", status: "status", min: "分鐘", pages: "pages", file: "file" };
const cols = Object.keys(headers);
const width = {};
for (const c of cols) width[c] = Math.max(dispWidth(headers[c]), ...rows.map((r) => dispWidth(r[c])));
const pad = (v, w) => String(v) + " ".repeat(Math.max(0, w - dispWidth(v)));
const fmt = (r) => cols.map((c) => pad(r[c], width[c])).join("  ").trimEnd();
console.log(fmt(headers));
console.log(cols.map((c) => "-".repeat(width[c])).join("  "));
for (const r of rows) console.log(fmt(r));

// 統計
const counts = {};
for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
console.log("\n=== 統計 ===");
for (const [status, n] of Object.entries(counts).sort()) console.log(`${status}: ${n}`);
const duration = Number(topicMeta?.["duration-minutes"] ?? 0) || 0;
console.log(`時間帳:非 rejected 段落合計 ${totalMinutes} 分` + (duration ? ` / 總時長 ${duration} 分` : ""));

// frontmatter 格式問題先報:它會讓下面的清單比對失去意義
reportFormat();

// 與 topic.md 的 sections 權威清單比對
let mismatch = 0;
if (topicMeta && topicSectionsBlockList) {
  console.log("\n=== sections 清單無法比對 ===");
  console.log("- topic.md 的 sections 寫成 YAML 區塊列表,先改成行內陣列再重跑(見上方格式不合規)");
} else if (topicMeta) {
  const listed = parseList(topicMeta.sections);
  const found = rows.map((r) => r.id).filter((id) => id !== "-");
  const missingFiles = listed.filter((id) => !found.includes(id));
  const unlisted = found.filter((id) => !listed.includes(id));
  if (missingFiles.length || unlisted.length) {
    console.log("\n=== sections 清單不一致 ===");
    for (const id of missingFiles) console.log(`- topic.md 有列但找不到檔案:${id}`);
    for (const id of unlisted) console.log(`- 檔案存在但 topic.md 未列:${id}`);
    mismatch = missingFiles.length + unlisted.length;
  }
}

const unfinished = rows.filter((r) => !FINAL_STATUSES.has(r.status));
if (unfinished.length > 0) {
  console.log(`\n=== 未完成 / metadata 缺失(${unfinished.length})===`);
  for (const r of unfinished) console.log(`- ${r.description}  [${r.status}] ${r.id}  ${r.file}`);
}

const noDesc = rows.filter((r) => r.description === "-");
if (noDesc.length > 0) {
  console.log(`\n=== 缺少 description / 主軸(${noDesc.length})===`);
  for (const r of noDesc) console.log(`- ${r.id} ${r.file}`);
}

if (unfinished.length > 0 || noDesc.length > 0 || mismatch > 0 || badFormat.length > 0) process.exit(1);
console.log("\n全部段落皆已完成(done/rejected),metadata 完整且清單一致。");
process.exit(0);
