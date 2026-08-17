#!/usr/bin/env node
/**
 * scan-status.mjs — 掃描 docs/ 下 spec/bugfix/enhance 的 frontmatter metadata,
 * 並同步掃描 docs/arch/ 的子系統(architecture.md + subarch-*)狀態,
 * 判斷各任務完成狀態與各子系統的功能規劃進度。
 * spec/bugfix/enhance 只讀每檔開頭 4KB;subarch 需讀全文才能解析「功能規劃」表格。
 * 清單欄位(depends-on / related-adr / related-spec / subarchs)一律**行內陣列** `[a, b]`;
 * 寫成 YAML 區塊列表會被列為格式不合規並以 exit code 1 收場。
 *
 * 用法: node scan-status.mjs [docs目錄]   (預設 ./docs)
 * Exit code: 0 = 全部完成(或無檔案) / 1 = 有未完成項目、metadata 缺失或架構不一致
 */
import { readdirSync, readFileSync, openSync, readSync, closeSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const docsDir = process.argv[2] ?? "./docs";
const SCAN_DIRS = ["spec", "bugfix", "enhance"];
const ARCH_DIR = "arch";
const HEAD_BYTES = 4096;
const DONE_STATUSES = new Set(["done", "closed"]);
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
    return { text: buf.toString("utf8", 0, n), full: n < bytes };
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

/** 一律轉成陣列(單值 → [值],空值 → []) */
function asList(v) {
  if (Array.isArray(v)) return v;
  const s = String(v ?? "").trim();
  return s === "" ? [] : [s];
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

/** 對齊表格輸出 */
function printTable(headers, tableRows) {
  const cols = Object.keys(headers);
  const width = {};
  for (const c of cols) width[c] = Math.max(dispWidth(headers[c]), ...tableRows.map((r) => dispWidth(r[c])));
  const pad = (v, w) => String(v) + " ".repeat(Math.max(0, w - dispWidth(v)));
  const fmt = (r) => cols.map((c) => pad(r[c], width[c])).join("  ").trimEnd();
  console.log(fmt(headers));
  console.log(cols.map((c) => "-".repeat(width[c])).join("  "));
  for (const r of tableRows) console.log(fmt(r));
}

/** 清單欄位寫成 YAML 區塊列表的檔案 */
const badFormat = [];
function reportFormat() {
  if (badFormat.length === 0) return;
  console.log(`\n=== frontmatter 格式不合規:清單欄位請用行內陣列(${badFormat.length})===`);
  for (const b of badFormat) {
    console.log(`- ${b.file}:${b.keys.join("、")} 寫成 YAML 區塊列表`);
    for (const k of b.keys) console.log(`  改成 → ${k}: [item-a, item-b]`);
  }
}

// ---------------------------------------------------------------- 任務文檔掃描

const rows = [];
for (const sub of SCAN_DIRS) {
  const dir = join(docsDir, sub);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const path = join(dir, name);
    const { meta, blockListKeys } = readFrontmatter(path);
    const rel = relative(docsDir, path).replaceAll("\\", "/");
    if (blockListKeys.length) badFormat.push({ file: rel, keys: blockListKeys });
    const description = meta?.description ? truncate(meta.description, DESC_WIDTH) : "-";
    const base = {
      description,
      id: fmtValue(meta?.id),
      subarch: "-", // 子系統歸屬,由下方 subarch 的「功能規劃」回填
      relatedSpec: asList(meta?.["related-spec"]),
      created: fmtValue(meta?.created),
      dependsOn: fmtValue(meta?.["depends-on"]),
      file: rel,
    };
    if (!meta || !meta.status) {
      rows.push({ ...base, type: sub, status: "⚠ missing-metadata" });
    } else {
      rows.push({ ...base, type: meta.type || sub, status: String(meta.status) });
    }
  }
}

// ---------------------------------------------------------------- 子系統掃描

/**
 * 從 subarch 內文抓「功能規劃」路線圖。
 * 結構:`## 功能規劃` 下數個 `### 階段…`,每階段一張表(欄位含 feature 與 spec)。
 * 回傳 { phases, features: [{ phase, feature, spec }] };spec 未建檔(`-`)時為空字串。
 */
function parseRoadmap(text) {
  const phases = [];
  const features = [];
  let inSection = false;
  let colIdx = null; // 目前表格的 { feature, spec } 欄位索引
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (heading) {
      const level = heading[1].length;
      if (level === 2) inSection = /功能規劃/.test(heading[2]);
      else if (inSection && level === 3) phases.push(heading[2]);
      colIdx = null;
      continue;
    }
    if (!inSection || !line.trim().startsWith("|")) continue;
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (cells.every((c) => c === "" || /^:?-{2,}:?$/.test(c))) continue; // 分隔列
    const lower = cells.map((c) => c.toLowerCase());
    const specCol = lower.indexOf("spec");
    if (specCol >= 0) {
      const featureCol = lower.findIndex((c) => c === "feature" || c.includes("功能"));
      colIdx = featureCol >= 0 ? { feature: featureCol, spec: specCol } : null;
      continue; // 表頭列
    }
    if (!colIdx) continue;
    const feature = cells[colIdx.feature] ?? "";
    if (!feature || feature === "-" || /^<.+>$/.test(feature)) continue; // 空列或模板列
    features.push({
      phase: phases.at(-1) ?? "-",
      feature,
      spec: (cells[colIdx.spec] ?? "").match(/(?:func|enhance)-\d{4}/)?.[0] ?? "",
    });
  }
  return { phases: phases.length, features };
}

const specIndex = new Map(rows.filter((r) => r.id !== "-").map((r) => [r.id, r]));
const archIssues = []; // 架構同步問題(計入 exit code)
const archNotes = []; // 提示(不計入 exit code)
const subarchRows = [];
const pendingFeatures = []; // 功能規劃中尚未建立規格的 feature
const specOwner = new Map(); // spec id → subarch id

const archDir = join(docsDir, ARCH_DIR);
const archFile = [join(archDir, "architecture.md"), join(docsDir, "architecture.md")].find(existsSync) ?? null;
const subarchFiles = existsSync(archDir)
  ? readdirSync(archDir).filter((f) => /^subarch-.*\.md$/.test(f)).sort()
  : [];

let archMeta = null;
if (archFile) {
  const relArch = relative(docsDir, archFile).replaceAll("\\", "/");
  const { meta, blockListKeys } = readFrontmatter(archFile);
  if (blockListKeys.length) badFormat.push({ file: relArch, keys: blockListKeys });
  archMeta = meta;
  if (!meta) archIssues.push(`${relArch}:缺 frontmatter`);
  else if (!meta.description) archIssues.push(`${relArch}:缺 description / 主軸`);
}

for (const name of subarchFiles) {
  const path = join(archDir, name);
  const rel = relative(docsDir, path).replaceAll("\\", "/");
  const text = readFileSync(path, "utf8");
  const { meta, blockListKeys } = parseFrontmatter(text);
  if (blockListKeys.length) badFormat.push({ file: rel, keys: blockListKeys });
  const metaId = fmtValue(meta?.id);
  const id = metaId === "-" ? name.match(/^subarch-\d+/)?.[0] ?? name.replace(/\.md$/, "") : metaId;
  const roadmap = parseRoadmap(text);

  let done = 0;
  let specced = 0;
  for (const f of roadmap.features) {
    if (!f.spec) {
      pendingFeatures.push({ subarch: id, ...f });
      continue;
    }
    specced++;
    const row = specIndex.get(f.spec);
    if (!row) archIssues.push(`${rel}:功能規劃的 ${f.spec}(${f.feature})在 spec/enhance 找不到對應文檔`);
    else if (DONE_STATUSES.has(row.status)) done++;
    const owner = specOwner.get(f.spec);
    if (owner && owner !== id) archIssues.push(`${f.spec} 同時被 ${owner} 與 ${id} 的功能規劃認領`);
    specOwner.set(f.spec, id);
  }

  const total = roadmap.features.length;
  if (total === 0) archNotes.push(`${rel}:沒有「功能規劃」表格,無法估算子系統進度(建議用 /subarch-design 補上)`);
  if (meta && !meta["parent-arch"]) archIssues.push(`${rel}:缺 parent-arch(應為 architecture)`);

  subarchRows.push({
    description: meta?.description ? truncate(meta.description, DESC_WIDTH) : "-",
    id,
    status: !meta || !meta.status ? "⚠ missing-metadata" : String(meta.status),
    phases: total === 0 ? "-" : String(roadmap.phases || 1),
    features: total === 0 ? "-" : String(total),
    specced: total === 0 ? "-" : String(specced),
    done: total === 0 ? "-" : String(done),
    progress: total === 0 ? "-" : `${done}/${total} (${Math.round((done / total) * 100)}%)`,
    hasRoadmap: total > 0,
    complete: total > 0 && done === total,
    file: rel,
  });
}

// 主架構 subarchs 清單 vs 實際檔案(雙向比對)
if (archMeta) {
  const listed = asList(archMeta.subarchs);
  const actual = subarchRows.map((s) => s.id);
  for (const id of listed) {
    if (!actual.includes(id)) archIssues.push(`architecture.md 的 subarchs 列了 ${id},但 ${ARCH_DIR}/ 找不到對應檔案`);
  }
  for (const s of subarchRows) {
    if (!listed.includes(s.id)) archIssues.push(`${s.file} 未被 architecture.md 的 subarchs 列入(權威清單要回填)`);
  }
} else if (subarchFiles.length > 0) {
  archIssues.push(`有 subarch 檔案卻找不到 architecture.md(docs/arch/architecture.md 或舊版 docs/architecture.md)`);
}

// 子系統歸屬回填任務文檔:spec 直接查,bug/enhance 透過 related-spec 推導
for (const r of rows) {
  const own = specOwner.get(r.id);
  if (own) {
    r.subarch = own;
    continue;
  }
  const via = r.relatedSpec.map((s) => specOwner.get(s)).find(Boolean);
  if (via) r.subarch = `${via}*`; // * = 經 related-spec 推導
}

// ---------------------------------------------------------------- 輸出

if (rows.length === 0 && subarchRows.length === 0) {
  console.log(`docs 目錄(${docsDir})下的 ${SCAN_DIRS.join("/")} 與 ${ARCH_DIR}/ 沒有任何文檔。`);
  process.exit(0);
}

if (rows.length === 0) {
  console.log(`docs 目錄(${docsDir})下的 ${SCAN_DIRS.join("/")} 沒有任何 .md 檔案。`);
} else {
  // 欄位順序:主軸(description)優先,id 次之,再來是子系統歸屬
  printTable(
    { description: "主軸", id: "id", subarch: "子系統", type: "type", status: "status", created: "created", dependsOn: "depends-on", file: "file" },
    rows,
  );
}

const counts = {};
for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
if (rows.length > 0) {
  console.log("\n=== 統計 ===");
  for (const [status, n] of Object.entries(counts).sort()) console.log(`${status}: ${n}`);
}

console.log("\n=== 子系統狀態 ===");
if (archMeta) {
  console.log(`架構 ${fmtValue(archMeta.id)}:${fmtValue(archMeta.description)}  [${fmtValue(archMeta.status)}]  subarchs: ${fmtValue(archMeta.subarchs)}`);
} else {
  console.log("架構:找不到 architecture.md(尚未執行 /arch-design)");
}
if (subarchRows.length === 0) {
  console.log("(沒有任何 subarch-* 檔案;專案未拆子系統時屬正常,否則請用 /subarch-design 建立)");
} else {
  printTable(
    { description: "主軸", id: "id", status: "status", phases: "階段", features: "features", specced: "已建規格", done: "已完成", progress: "進度", file: "file" },
    subarchRows,
  );
  const tracked = subarchRows.filter((s) => s.hasRoadmap);
  const unknown = subarchRows.length - tracked.length;
  console.log(
    `\n子系統完成度:${tracked.filter((s) => s.complete).length}/${tracked.length} 個子系統的功能規劃全數完成` +
      (unknown > 0 ? `(另有 ${unknown} 個沒有功能規劃表格,進度未知)` : ""),
  );
}

if (pendingFeatures.length > 0) {
  console.log(`\n=== 子系統待展開的 feature:功能規劃有列、尚未建規格(${pendingFeatures.length})===`);
  for (const f of pendingFeatures) console.log(`- ${f.subarch} ${f.phase}:${f.feature}`);
}

const unfinished = rows.filter((r) => !DONE_STATUSES.has(r.status));
if (unfinished.length > 0) {
  console.log(`\n=== 未完成 / metadata 缺失(${unfinished.length})===`);
  for (const r of unfinished) console.log(`- ${r.description}  [${r.status}] ${r.id}  ${r.subarch !== "-" ? r.subarch + "  " : ""}${r.file}`);
}

const openSubarchRows = subarchRows.filter((s) => s.hasRoadmap && !s.complete);
if (openSubarchRows.length > 0) {
  console.log(`\n=== 未完成的子系統(${openSubarchRows.length})===`);
  for (const s of openSubarchRows) console.log(`- ${s.description}  [${s.status}] ${s.id}  進度 ${s.progress}  ${s.file}`);
}

const noDesc = [...rows, ...subarchRows].filter((r) => r.description === "-");
if (noDesc.length > 0) {
  console.log(`\n=== 缺少 description / 主軸(${noDesc.length})===`);
  for (const r of noDesc) console.log(`- ${r.id} ${r.file}`);
}

if (archIssues.length > 0) {
  console.log(`\n=== 架構 / 子系統不一致(${archIssues.length})===`);
  for (const m of archIssues) console.log(`- ${m}`);
}

if (archNotes.length > 0) {
  console.log(`\n=== 子系統提示(${archNotes.length})===`);
  for (const m of archNotes) console.log(`- ${m}`);
}

reportFormat();

if (unfinished.length > 0 || openSubarchRows.length > 0 || pendingFeatures.length > 0 || noDesc.length > 0 || archIssues.length > 0 || badFormat.length > 0) {
  process.exit(1);
}
console.log("\n全部項目皆已完成(done/closed)、子系統功能規劃全數完成,且 metadata 完整。");
process.exit(0);
