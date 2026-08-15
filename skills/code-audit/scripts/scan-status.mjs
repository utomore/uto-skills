#!/usr/bin/env node
/**
 * scan-status.mjs — 掃描 docs/ 下 spec/bugfix/enhance 的 frontmatter metadata,
 * 判斷各任務完成狀態。只讀每檔開頭 2KB,不載入全文。
 *
 * 用法: node scan-status.mjs [docs目錄]   (預設 ./docs)
 * Exit code: 0 = 全部完成(或無檔案) / 1 = 有未完成項目或 metadata 缺失
 */
import { readdirSync, openSync, readSync, closeSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const docsDir = process.argv[2] ?? "./docs";
const SCAN_DIRS = ["spec", "bugfix", "enhance"];
const HEAD_BYTES = 2048;
const DONE_STATUSES = new Set(["done", "closed"]);

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
    if (m) meta[m[1]] = m[2].replace(/\s+#.*$/, "").trim();
  }
  return null; // 沒有結尾 --- 視為無 frontmatter
}

const rows = [];
for (const sub of SCAN_DIRS) {
  const dir = join(docsDir, sub);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const path = join(dir, name);
    const meta = parseFrontmatter(readHead(path));
    const rel = relative(docsDir, path).replaceAll("\\", "/");
    if (!meta || !meta.status) {
      rows.push({ id: meta?.id ?? "-", type: sub, status: "⚠ missing-metadata", created: meta?.created ?? "-", dependsOn: meta?.["depends-on"] ?? "-", file: rel });
    } else {
      rows.push({ id: meta.id ?? "-", type: meta.type ?? sub, status: meta.status, created: meta.created ?? "-", dependsOn: meta["depends-on"] ?? "-", file: rel });
    }
  }
}

if (rows.length === 0) {
  console.log(`docs 目錄(${docsDir})下的 ${SCAN_DIRS.join("/")} 沒有任何 .md 檔案。`);
  process.exit(0);
}

// 對齊表格輸出
const headers = { id: "id", type: "type", status: "status", created: "created", dependsOn: "depends-on", file: "file" };
const cols = Object.keys(headers);
const width = {};
for (const c of cols) width[c] = Math.max(headers[c].length, ...rows.map((r) => String(r[c]).length));
const fmt = (r) => cols.map((c) => String(r[c]).padEnd(width[c])).join("  ");
console.log(fmt(headers));
console.log(cols.map((c) => "-".repeat(width[c])).join("  "));
for (const r of rows) console.log(fmt(r));

// 統計
const counts = {};
for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
console.log("\n=== 統計 ===");
for (const [status, n] of Object.entries(counts).sort()) console.log(`${status}: ${n}`);

const unfinished = rows.filter((r) => !DONE_STATUSES.has(r.status));
if (unfinished.length > 0) {
  console.log(`\n=== 未完成 / metadata 缺失(${unfinished.length})===`);
  for (const r of unfinished) console.log(`- [${r.status}] ${r.id} ${r.file}`);
  process.exit(1);
}
console.log("\n全部項目皆已完成(done/closed)。");
process.exit(0);
