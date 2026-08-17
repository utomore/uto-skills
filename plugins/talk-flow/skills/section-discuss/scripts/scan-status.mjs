#!/usr/bin/env node
/**
 * scan-status.mjs — 掃描 docs/topic.md 與 docs/section-*.md 的 frontmatter metadata,
 * 列出各段落狀態並比對 topic.md 的 sections 權威清單。只讀每檔開頭 2KB,不載入全文。
 *
 * 用法: node scan-status.mjs [docs目錄]   (預設 ./docs)
 * Exit code: 0 = 全部段落完成(done/rejected)且清單一致 / 1 = 有未完成、metadata 缺失或清單不一致
 */
import { readdirSync, openSync, readSync, closeSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const docsDir = process.argv[2] ?? "./docs";
const HEAD_BYTES = 2048;
const FINAL_STATUSES = new Set(["done", "rejected"]);
const DESC_WIDTH = 44; // 主軸(description)欄顯示寬度上限(全形字算 2)

if (!existsSync(docsDir)) {
  console.error(`找不到 docs 目錄: ${docsDir}`);
  process.exit(1);
}

/** 只讀檔案開頭 HEAD_BYTES bytes */
function readHead(path) {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const n = readSync(fd, buf, 0, HEAD_BYTES, 0);
    return buf.toString("utf8", 0, n);
  } finally {
    closeSync(fd);
  }
}

/** 解析第一組 --- ... --- 之間的 key: value(淺層,夠用即可) */
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const meta = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "---") return meta;
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (m) meta[m[1]] = parseValue(m[2]);
  }
  return null; // 沒有結尾 --- 視為無 frontmatter
}

/** 取值:引號字串取引號內容,否則去掉行尾 # 註解 */
function parseValue(raw) {
  const v = raw.trim();
  const q = v.match(/^(['"])([\s\S]*?)\1/);
  if (q) return q[2];
  return v.replace(/\s+#.*$/, "").trim();
}

/** 解析行內陣列 "[a, b]" → ["a", "b"] */
function parseList(raw) {
  const v = String(raw ?? "").trim();
  const m = v.match(/^\[([\s\S]*)\]$/);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
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

// --- topic.md ---
const topicPath = join(docsDir, "topic.md");
let topicMeta = null;
if (existsSync(topicPath)) {
  topicMeta = parseFrontmatter(readHead(topicPath));
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
  const meta = parseFrontmatter(readHead(path));
  const rel = relative(docsDir, path).replaceAll("\\", "/");
  const description = meta?.description ? truncate(meta.description, DESC_WIDTH) : "-";
  const status = meta?.status ?? "⚠ missing-metadata";
  if (meta?.status && meta.status !== "rejected") totalMinutes += Number(meta["est-minutes"] ?? 0) || 0;
  rows.push({
    description,
    id: meta?.id ?? "-",
    order: meta?.order ?? "-",
    status,
    min: meta?.["est-minutes"] ?? "-",
    pages: meta?.pages ?? "-",
    file: rel,
  });
}

if (rows.length === 0) {
  console.log(`docs 目錄(${docsDir})下沒有任何 section-*.md 檔案。`);
  process.exit(topicMeta ? 0 : 1);
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

// 與 topic.md 的 sections 權威清單比對
let mismatch = 0;
if (topicMeta) {
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

if (unfinished.length > 0 || noDesc.length > 0 || mismatch > 0) process.exit(1);
console.log("\n全部段落皆已完成(done/rejected),metadata 完整且清單一致。");
process.exit(0);
