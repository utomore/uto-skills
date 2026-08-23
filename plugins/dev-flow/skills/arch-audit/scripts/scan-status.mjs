#!/usr/bin/env node
/**
 * scan-status.mjs — 掃描 .design/ 樹狀設計文檔,盤點任務狀態與各子系統進度。
 *
 * 掃描範圍:
 *   .design/system.md                                  主架構(frontmatter subsystems 為權威清單)
 *   .design/subsystems/<slug>/design.md                子系統架構(含「功能規劃」路線圖與「Feature 契約卡」)
 *   .design/subsystems/<slug>/spec-gaps.md             qa / impl 提出的 spec 模糊處(未結條目影響 exit code)
 *   .design/subsystems/<slug>/{features,enhancements,bugfixes}/*.md   子系統任務文檔
 *   .design/{enhancements,bugfixes}/*.md               全域任務文檔(G-E / G-B)
 *   .design/adr/*.md                                   ADR
 *
 * 任務文檔只讀每檔開頭 4KB;design.md 需讀全文才能解析「功能規劃」表格與「Feature 契約卡」。
 * 清單欄位(depends-on / related-adr / related-feature / subsystems)一律**行內陣列** `[a, b]`;
 * 寫成 YAML 區塊列表會被列為格式不合規並以 exit code 1 收場。
 *
 * 用法: node scan-status.mjs [design目錄]   (預設 ./.design)
 * Exit code: 0 = 全部完成(或無檔案) / 1 = 有未完成項目、metadata 缺失或架構不一致
 */
import { readdirSync, readFileSync, openSync, readSync, closeSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const designDir = process.argv[2] ?? "./.design";
const HEAD_BYTES = 4096;
const DONE_STATUSES = new Set(["done", "closed"]);
const DESC_WIDTH = 44; // 主軸(description)欄顯示寬度上限(全形字算 2)

// 各資料夾的檔名規則與預期 type
const TASK_KINDS = {
  features: { pattern: /^(F\d{3})-[a-z0-9-]+\.md$/, type: "feature" },
  enhancements: { pattern: /^(E\d{3})-[a-z0-9-]+\.md$/, type: "enhance" },
  bugfixes: { pattern: /^(B\d{3})-[a-z0-9-]+\.md$/, type: "bugfix" },
};
const GLOBAL_KINDS = {
  enhancements: { pattern: /^(G-E\d{3})-[a-z0-9-]+\.md$/, type: "enhance" },
  bugfixes: { pattern: /^(G-B\d{3})-[a-z0-9-]+\.md$/, type: "bugfix" },
};
const ADR_PATTERN = /^(ADR-\d{3})-[a-z0-9-]+\.md$/;

if (!existsSync(designDir)) {
  console.error(`找不到 design 目錄: ${designDir}`);
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

const rel = (p) => relative(designDir, p).replaceAll("\\", "/");
const listMd = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : []);
const listDirs = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory()).sort() : [];

const badFormat = []; // 清單欄位寫成 YAML 區塊列表的檔案
const archIssues = []; // 架構同步問題(計入 exit code)
const archNotes = []; // 提示(不計入 exit code)

// ---------------------------------------------------------------- 任務文檔掃描

const rows = []; // { description, id, subsystem, type, status, created, dependsOn(raw list), file, meta }

function scanTaskDoc(path, subsystem, kind) {
  const { meta, blockListKeys } = readFrontmatter(path);
  const relPath = rel(path);
  if (blockListKeys.length) badFormat.push({ file: relPath, keys: blockListKeys });
  const fileId = path.split(/[\\/]/).pop().match(/^((?:G-)?[FEB]\d{3})/)?.[1] ?? null;
  const metaId = fmtValue(meta?.id);
  if (meta && fileId && metaId !== "-" && metaId !== fileId)
    archIssues.push(`${relPath}:frontmatter id(${metaId})與檔名編號(${fileId})不一致`);
  if (meta && meta.type && meta.type !== kind.type)
    archIssues.push(`${relPath}:type(${meta.type})與所在資料夾預期(${kind.type})不一致`);
  const row = {
    description: meta?.description ? truncate(meta.description, DESC_WIDTH) : "-",
    id: metaId !== "-" ? metaId : fileId ?? "-",
    subsystem: subsystem ?? "global",
    type: meta?.type || kind.type,
    status: !meta || !meta.status ? "⚠ missing-metadata" : String(meta.status),
    created: fmtValue(meta?.created),
    dependsOn: asList(meta?.["depends-on"]),
    affects: asList(meta?.subsystems),
    file: relPath,
  };
  rows.push(row);
  return row;
}

// 子系統
const subsysRoot = join(designDir, "subsystems");
const subsysDirs = listDirs(subsysRoot);
const subsysDocs = new Map(); // slug → { designMeta, designFile, roadmap, ids: Map(id → row) }

for (const slug of subsysDirs) {
  const dir = join(subsysRoot, slug);
  const entry = { designMeta: null, designFile: null, roadmap: { phases: 0, features: [] }, cards: new Set(), ids: new Map() };
  subsysDocs.set(slug, entry);

  const designPath = join(dir, "design.md");
  if (!existsSync(designPath)) {
    archIssues.push(`subsystems/${slug}/:缺 design.md(請用 /subsys-design 建立)`);
  } else {
    const text = readFileSync(designPath, "utf8");
    const { meta, blockListKeys } = parseFrontmatter(text);
    entry.designMeta = meta;
    entry.designFile = rel(designPath);
    if (blockListKeys.length) badFormat.push({ file: entry.designFile, keys: blockListKeys });
    if (!meta) archIssues.push(`${entry.designFile}:缺 frontmatter`);
    else {
      if (!meta.description) archIssues.push(`${entry.designFile}:缺 description / 主軸`);
      if (meta.parent !== "system") archIssues.push(`${entry.designFile}:缺 parent(應為 system)`);
      if (meta.id && meta.id !== slug) archIssues.push(`${entry.designFile}:id(${meta.id})與資料夾名(${slug})不一致`);
    }
    entry.roadmap = parseRoadmap(text);
    entry.cards = parseCards(text);
  }

  for (const [sub, kind] of Object.entries(TASK_KINDS)) {
    const taskDir = join(dir, sub);
    for (const name of listMd(taskDir)) {
      const path = join(taskDir, name);
      if (!kind.pattern.test(name))
        archNotes.push(`${rel(path)}:檔名不符 ${sub}/ 命名規則(如 ${sub === "features" ? "F001" : sub === "enhancements" ? "E001" : "B001"}-slug.md)`);
      const row = scanTaskDoc(path, slug, kind);
      if (row.id !== "-") entry.ids.set(row.id, row);
    }
  }
}

// 全域任務文檔
const globalIds = new Map(); // id → row
for (const [sub, kind] of Object.entries(GLOBAL_KINDS)) {
  const dir = join(designDir, sub);
  for (const name of listMd(dir)) {
    const path = join(dir, name);
    if (!kind.pattern.test(name))
      archNotes.push(`${rel(path)}:檔名不符全域命名規則(如 ${sub === "enhancements" ? "G-E001" : "G-B001"}-slug.md)`);
    const row = scanTaskDoc(path, null, kind);
    if (row.id !== "-") globalIds.set(row.id, row);
    if (row.affects.length === 0) archIssues.push(`${row.file}:全域文檔缺 subsystems 欄位(受影響子系統清單)`);
    for (const s of row.affects) {
      if (!subsysDirs.includes(s)) archIssues.push(`${row.file}:subsystems 列了 ${s},但 subsystems/ 沒有這個子系統`);
    }
  }
}

// ADR
const adrIds = new Set();
const adrCounts = {};
for (const name of listMd(join(designDir, "adr"))) {
  const path = join(designDir, "adr", name);
  const m = name.match(ADR_PATTERN);
  if (!m) archNotes.push(`${rel(path)}:檔名不符 ADR 命名規則(如 ADR-001-slug.md)`);
  const { meta, blockListKeys } = readFrontmatter(path);
  if (blockListKeys.length) badFormat.push({ file: rel(path), keys: blockListKeys });
  const id = fmtValue(meta?.id) !== "-" ? String(meta.id) : m?.[1] ?? name.replace(/\.md$/, "");
  adrIds.add(id);
  if (!meta?.description) archIssues.push(`${rel(path)}:缺 description / 主軸`);
  const st = meta?.status ? String(meta.status) : "missing-status";
  adrCounts[st] = (adrCounts[st] ?? 0) + 1;
}

// ---------------------------------------------------------------- spec-gaps

/**
 * 解析 spec-gaps.md:每個條目是 `## G<n>(<來源> / <角色>)`,底下有一行 `- 狀態:open|resolved`。
 * 未結(open)的條目代表有項目正卡著等 spec 修訂,列進輸出並影響 exit code。
 */
function parseSpecGaps(path, scope) {
  const out = [];
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  const blocks = text.split(/^##\s+/m).slice(1);
  for (const b of blocks) {
    const head = b.split("\n", 1)[0].trim();
    const id = head.match(/^(G\d+)/)?.[1];
    if (!id) continue;
    const state = b.match(/^\s*[-*]\s*狀態\s*[::]\s*(\S+)/m)?.[1] ?? "open";
    if (/^resolved/i.test(state)) continue;
    const topic = b.match(/^\s*[-*]\s*模糊點\s*[::]\s*(.+)$/m)?.[1]?.trim() ?? "-";
    out.push({ scope, id, head, topic, file: rel(path) });
  }
  return out;
}

const openGaps = [];
for (const slug of subsysDirs) openGaps.push(...parseSpecGaps(join(subsysRoot, slug, "spec-gaps.md"), slug));
openGaps.push(...parseSpecGaps(join(designDir, "spec-gaps.md"), "global"));

// ---------------------------------------------------------------- 主架構

const systemPath = join(designDir, "system.md");
let systemMeta = null;
if (existsSync(systemPath)) {
  const { meta, blockListKeys } = readFrontmatter(systemPath);
  if (blockListKeys.length) badFormat.push({ file: "system.md", keys: blockListKeys });
  systemMeta = meta;
  if (!meta) archIssues.push(`system.md:缺 frontmatter`);
  else if (!meta.description) archIssues.push(`system.md:缺 description / 主軸`);
} else if (subsysDirs.length > 0 || rows.length > 0) {
  archIssues.push(`找不到 .design/system.md(尚未執行 /system-design)`);
}

// subsystems 權威清單 vs 實際資料夾(雙向比對)
if (systemMeta) {
  const listed = asList(systemMeta.subsystems);
  for (const s of listed) {
    if (!subsysDirs.includes(s)) archIssues.push(`system.md 的 subsystems 列了 ${s},但 subsystems/ 找不到對應資料夾`);
  }
  for (const s of subsysDirs) {
    if (!listed.includes(s)) archIssues.push(`subsystems/${s}/ 未被 system.md 的 subsystems 列入(權威清單要回填)`);
  }
}

// ---------------------------------------------------------------- 功能規劃(roadmap)

/**
 * 從 design.md 內文抓「功能規劃」路線圖。
 * 結構:`## 功能規劃` 下數個 `### 階段…`,每階段一張表(欄位含 feature 與 doc)。
 * 回傳 { phases, features: [{ phase, feature, doc }] };doc 未建檔(`-`)時為空字串。
 */
function parseRoadmap(text) {
  const phases = [];
  const features = [];
  let inSection = false;
  let colIdx = null; // 目前表格的 { feature, doc } 欄位索引
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
    const docCol = lower.indexOf("doc");
    if (docCol >= 0) {
      const featureCol = lower.findIndex((c) => c === "feature" || c.includes("功能"));
      colIdx = featureCol >= 0 ? { feature: featureCol, doc: docCol } : null;
      continue; // 表頭列
    }
    if (!colIdx) continue;
    const feature = cells[colIdx.feature] ?? "";
    if (!feature || feature === "-" || /^<.+>$/.test(feature)) continue; // 空列或模板列
    features.push({
      phase: phases.at(-1) ?? "-",
      feature: normName(feature),
      doc: (cells[colIdx.doc] ?? "").match(/F\d{3}/)?.[0] ?? "",
    });
  }
  return { phases: phases.length, features };
}

/** 標準化 feature 名稱:去掉 markdown 強調符號與前後空白,讓表格與卡片標題對得上 */
function normName(s) {
  return String(s).replace(/[`*_]/g, "").trim();
}

/**
 * 從 design.md 內文抓「Feature 契約卡」章節下的卡片標題(`### <feature-slug>`)。
 * 契約卡是 feature 可被 /subsys-build 無訪談委派的門檻。
 * 沒有這個章節時回傳空 Set —— 舊版 design.md 屬正常,只提示不算不一致。
 */
function parseCards(text) {
  const cards = new Set();
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (!heading) continue;
    const level = heading[1].length;
    if (level === 2) {
      inSection = /契約卡/.test(heading[2]);
      continue;
    }
    if (!inSection || level !== 3) continue;
    const name = normName(heading[2]);
    if (name && !/^<.+>$/.test(name)) cards.add(name); // 模板列不算
  }
  return cards;
}

const subsysRows = [];
const pendingFeatures = []; // 功能規劃有列、尚未建 feature 文檔的項目

for (const slug of subsysDirs) {
  const entry = subsysDocs.get(slug);
  const meta = entry.designMeta;
  const roadmap = entry.roadmap;

  let done = 0;
  let specced = 0;
  const claimed = new Set();
  for (const f of roadmap.features) {
    if (!f.doc) {
      pendingFeatures.push({ subsystem: slug, ...f });
      continue;
    }
    specced++;
    if (claimed.has(f.doc)) archIssues.push(`${entry.designFile}:功能規劃有兩列都指向 ${f.doc}`);
    claimed.add(f.doc);
    const row = entry.ids.get(f.doc);
    if (!row) archIssues.push(`${entry.designFile}:功能規劃的 ${f.doc}(${f.feature})在 ${slug}/features/ 找不到對應文檔`);
    else if (DONE_STATUSES.has(row.status)) done++;
  }
  // features/ 有文檔、但功能規劃沒認領 → 提示回填路線圖
  for (const [id, row] of entry.ids) {
    if (/^F\d{3}$/.test(id) && !claimed.has(id))
      archNotes.push(`${row.file}:未出現在 ${slug}/design.md 的功能規劃(建議回填 doc 欄)`);
  }

  // Feature 契約卡覆蓋率(/subsys-build 委派展開的門檻;缺卡只提示,不列為不一致)
  const cards = entry.cards;
  const carded = roadmap.features.filter((f) => cards.has(f.feature)).length;
  if (entry.designFile && roadmap.features.length > 0) {
    if (cards.size === 0) {
      archNotes.push(`${entry.designFile}:沒有「Feature 契約卡」章節,無法用 /subsys-build 委派展開(用 /subsys-design 更新模式補上)`);
    } else {
      for (const f of roadmap.features) {
        if (!cards.has(f.feature)) archNotes.push(`${entry.designFile}:功能規劃的 ${f.feature} 缺 Feature 契約卡(該項無法委派)`);
      }
      for (const c of cards) {
        if (!roadmap.features.some((f) => f.feature === c))
          archNotes.push(`${entry.designFile}:Feature 契約卡「${c}」不在功能規劃清單內(孤兒卡片,建議刪除或補進清單)`);
      }
    }
  }

  const openE = [...entry.ids.values()].filter((r) => r.type === "enhance" && !DONE_STATUSES.has(r.status)).length;
  const openB = [...entry.ids.values()].filter((r) => r.type === "bugfix" && !DONE_STATUSES.has(r.status)).length;

  const total = roadmap.features.length;
  if (entry.designFile && total === 0)
    archNotes.push(`${entry.designFile}:沒有「功能規劃」表格,無法估算子系統進度(建議用 /subsys-design 補上)`);

  subsysRows.push({
    description: meta?.description ? truncate(meta.description, DESC_WIDTH) : "-",
    id: slug,
    status: !meta || !meta.status ? "⚠ missing-metadata" : String(meta.status),
    phases: total === 0 ? "-" : String(roadmap.phases || 1),
    features: total === 0 ? "-" : String(total),
    cards: total === 0 || cards.size === 0 ? "-" : `${carded}/${total}`,
    specced: total === 0 ? "-" : String(specced),
    done: total === 0 ? "-" : String(done),
    openEB: `${openE}E/${openB}B`,
    progress: total === 0 ? "-" : `${done}/${total} (${Math.round((done / total) * 100)}%)`,
    hasRoadmap: total > 0,
    complete: total > 0 && done === total && openE === 0 && openB === 0,
  });
}

// ---------------------------------------------------------------- depends-on 解析

/** 解析引用:同子系統直寫 id;跨子系統 <slug>/<id>;全域 G-*;ADR-*。回傳 true = 可解析 */
function resolveRef(ref, contextSubsys) {
  if (/^ADR-\d+$/.test(ref)) return adrIds.has(ref);
  if (/^G-[EB]\d{3}$/.test(ref)) return globalIds.has(ref);
  if (ref.includes("/")) {
    const [slug, id] = ref.split("/");
    return subsysDocs.get(slug)?.ids.has(id) ?? false;
  }
  if (contextSubsys) return subsysDocs.get(contextSubsys)?.ids.has(ref) ?? false;
  return false; // 全域文檔不得用裸 id 引用子系統文檔
}

for (const r of rows) {
  for (const ref of r.dependsOn) {
    if (!resolveRef(ref, r.subsystem === "global" ? null : r.subsystem)) {
      archIssues.push(
        `${r.file}:depends-on 的 ${ref} 無法解析` +
          (r.subsystem === "global" && !ref.includes("/") && !/^(G-|ADR-)/.test(ref)
            ? "(全域文檔引用子系統文檔要寫 <subsystem>/<id>)"
            : "(同子系統直寫 id、跨子系統寫 <subsystem>/<id>、全域寫 G- id)"),
      );
    }
  }
}

// ---------------------------------------------------------------- 輸出

if (rows.length === 0 && subsysRows.length === 0 && !systemMeta) {
  console.log(`design 目錄(${designDir})下沒有任何文檔。`);
  process.exit(0);
}

if (rows.length === 0) {
  console.log(`design 目錄(${designDir})下沒有任何任務文檔(features / enhancements / bugfixes)。`);
} else {
  // 欄位順序:主軸(description)優先,id 次之,再來是子系統歸屬
  printTable(
    { description: "主軸", id: "id", subsystem: "子系統", type: "type", status: "status", created: "created", dependsOn: "depends-on", file: "file" },
    rows.map((r) => ({ ...r, dependsOn: fmtValue(r.dependsOn) })),
  );
}

const counts = {};
for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
if (rows.length > 0) {
  console.log("\n=== 統計 ===");
  for (const [status, n] of Object.entries(counts).sort()) console.log(`${status}: ${n}`);
}

console.log("\n=== 子系統狀態 ===");
if (systemMeta) {
  console.log(`主架構 system:${fmtValue(systemMeta.description)}  [${fmtValue(systemMeta.status)}]  subsystems: ${fmtValue(systemMeta.subsystems)}`);
} else {
  console.log("主架構:找不到 system.md(尚未執行 /system-design)");
}
if (subsysRows.length === 0) {
  console.log("(subsystems/ 下沒有任何子系統;專案未拆子系統時屬正常,否則請用 /subsys-design 建立)");
} else {
  printTable(
    { description: "主軸", id: "id", status: "status", phases: "階段", features: "features", cards: "契約卡", specced: "已建文檔", done: "已完成", openEB: "未結E/B", progress: "進度" },
    subsysRows,
  );
  const tracked = subsysRows.filter((s) => s.hasRoadmap);
  const unknown = subsysRows.length - tracked.length;
  console.log(
    `\n子系統完成度:${tracked.filter((s) => s.complete).length}/${tracked.length} 個子系統的功能規劃全數完成且無未結 E/B` +
      (unknown > 0 ? `(另有 ${unknown} 個沒有功能規劃表格,進度未知)` : ""),
  );
}

if (Object.keys(adrCounts).length > 0) {
  console.log(`\nADR:${Object.entries(adrCounts).sort().map(([s, n]) => `${s} ${n}`).join("、")}(共 ${adrIds.size} 份)`);
}

if (pendingFeatures.length > 0) {
  console.log(`\n=== 待展開的 feature:功能規劃有列、尚未建文檔(${pendingFeatures.length})===`);
  for (const f of pendingFeatures) console.log(`- ${f.subsystem} ${f.phase}:${f.feature}`);
}

if (openGaps.length > 0) {
  console.log(`\n=== 未結的 spec-gaps:qa / impl 提出、spec 尚未修訂(${openGaps.length})===`);
  console.log("每一條都代表有項目正卡著;修 spec 前不要繼續往下做,也不要委派展開。");
  for (const g of openGaps) console.log(`- [${g.scope}] ${g.head}  ${g.topic}  ${g.file}`);
}

const unfinished = rows.filter((r) => !DONE_STATUSES.has(r.status));
if (unfinished.length > 0) {
  console.log(`\n=== 未完成 / metadata 缺失(${unfinished.length})===`);
  for (const r of unfinished) console.log(`- ${r.description}  [${r.status}] ${r.subsystem}/${r.id}  ${r.file}`);
}

const openSubsysRows = subsysRows.filter((s) => s.hasRoadmap && !s.complete);
if (openSubsysRows.length > 0) {
  console.log(`\n=== 未完成的子系統(${openSubsysRows.length})===`);
  for (const s of openSubsysRows) console.log(`- ${s.description}  [${s.status}] ${s.id}  進度 ${s.progress}  未結 ${s.openEB}`);
}

const noDesc = rows.filter((r) => r.description === "-");
if (noDesc.length > 0) {
  console.log(`\n=== 缺少 description / 主軸(${noDesc.length})===`);
  for (const r of noDesc) console.log(`- ${r.id} ${r.file}`);
}

if (archIssues.length > 0) {
  console.log(`\n=== 架構 / 子系統不一致(${archIssues.length})===`);
  for (const m of archIssues) console.log(`- ${m}`);
}

if (archNotes.length > 0) {
  console.log(`\n=== 提示(${archNotes.length})===`);
  for (const m of archNotes) console.log(`- ${m}`);
}

if (badFormat.length > 0) {
  console.log(`\n=== frontmatter 格式不合規:清單欄位請用行內陣列(${badFormat.length})===`);
  for (const b of badFormat) {
    console.log(`- ${b.file}:${b.keys.join("、")} 寫成 YAML 區塊列表`);
    for (const k of b.keys) console.log(`  改成 → ${k}: [item-a, item-b]`);
  }
}

if (unfinished.length > 0 || openSubsysRows.length > 0 || pendingFeatures.length > 0 || noDesc.length > 0 || archIssues.length > 0 || badFormat.length > 0 || openGaps.length > 0) {
  process.exit(1);
}
console.log("\n全部項目皆已完成(done/closed)、子系統功能規劃全數完成,且 metadata 完整。");
process.exit(0);
