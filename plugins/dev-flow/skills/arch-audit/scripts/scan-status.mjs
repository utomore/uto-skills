#!/usr/bin/env node
/**
 * scan-status.mjs — 掃描 .design/ 樹狀設計文檔。兩種模式:
 *   盤點模式(不給 --subsys / --doc):任務狀態與各子系統進度,全樹視角
 *   查詢模式(--subsys / --doc):聚焦單一子系統或單一文檔,額外給出**反向依賴**
 *
 * 掃描範圍:
 *   .design/system.md                                  主架構:frontmatter subsystems 是**完整名冊**
 *                                                      (含尚未建檔者)+ 內文「開發階段」表
 *   .design/subsystems/<slug>/design.md                子系統架構(「模組群」表、「功能規劃」路線圖、「Feature 契約卡」)
 *   .design/subsystems/<slug>/spec-gaps.md             qa / impl 提出的 spec 模糊處(未結條目影響 exit code)
 *   .design/subsystems/<slug>/{features,enhancements,bugfixes}/*.md   子系統任務文檔
 *   .design/{enhancements,bugfixes}/*.md               全域任務文檔(G-E / G-B)
 *   .design/contracts/*.md                             跨子系統共用契約(G-C;非任務文檔,不計入進度)
 *   .design/adr/*.md                                   ADR
 *
 * 盤點模式下任務文檔只讀每檔開頭 4KB;design.md 與 system.md 需讀全文才能解析
 * 「模組群」/「功能規劃」/「Feature 契約卡」與「開發階段」/「子系統劃分」。
 * 查詢模式**只對被查的那一份與直接關聯的文檔**讀全文(要取「介面」/「數據」段與契約條目),
 * 盤點模式一個位元組都不多讀。
 *
 * **分母紀律(本腳本的存在理由)**:進度的分母來自 system.md(名冊 + 開發階段)與
 * design.md(模組群 + 功能規劃),**不是**來自「已經存在的資料夾」。名冊列了卻沒有資料夾
 * = 已規劃、未建檔,那是**待辦**不是不一致。分母若由已完成的東西定義,報表只會愈做愈接近
 * 100%,而永遠看不見還沒開工的那一大半。
 * 清單欄位(depends-on / related-adr / related-feature / subsystems)一律**行內陣列** `[a, b]`;
 * 寫成 YAML 區塊列表會被列為格式不合規並以 exit code 1 收場。
 *
 * 用法:
 *   node scan-status.mjs [design目錄]                  盤點全樹(預設 ./.design)
 *   node scan-status.mjs .design --subsys <slug>       聚焦子系統:它的文檔 + 進出依賴 + 反向依賴
 *   node scan-status.mjs .design --doc <id>            聚焦文檔:歸屬 / 介面 / 契約 / 正反向依賴
 *                                                     <id> 吃 F003、auth/F003、G-E001、G-C001
 *   node scan-status.mjs --help
 *
 * Exit code(**兩種模式語意不同**,呼叫端不要混用):
 *   盤點 / --subsys : 0 = 範圍內全部完成(或無檔案) / 1 = 有未完成項目、metadata 缺失或架構不一致
 *   --doc           : 0 = 查到 / 2 = 查無此 id(查到但未完成仍是 0——查詢不是驗收)
 *   任一模式        : 2 = design 目錄或 --subsys 的 slug 不存在
 *
 * **本腳本只產生索引,不下判斷**:它答得出「哪份文檔、什麼狀態、誰依賴誰」,
 * 答不出「那份文檔寫的對不對」。紀律與各角色的使用界線見 _shared/design-query.md。
 */
import { readdirSync, readFileSync, openSync, readSync, closeSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const USAGE = `用法:
  node scan-status.mjs [design目錄]                  盤點全樹(預設 ./.design)
  node scan-status.mjs .design --subsys <slug>       聚焦子系統:文檔 + 進出依賴 + 反向依賴
  node scan-status.mjs .design --doc <id>            聚焦文檔:歸屬 / 介面 / 契約 / 正反向依賴
                                                     <id> 吃 F003、auth/F003、G-E001、G-C001
Exit code:盤點 / --subsys → 0 全完成 / 1 有未完成;--doc → 0 查到 / 2 查無;2 目錄或 slug 不存在`;

const argv = process.argv.slice(2);
const query = { subsys: null, doc: null };
let designDirArg = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--help" || a === "-h") {
    console.log(USAGE);
    process.exit(0);
  } else if (a === "--subsys") query.subsys = argv[++i] ?? null;
  else if (a === "--doc") query.doc = argv[++i] ?? null;
  else if (a.startsWith("--")) {
    console.error(`未知選項: ${a}\n\n${USAGE}`);
    process.exit(2);
  } else if (designDirArg === null) designDirArg = a;
}
if (query.subsys === null && argv.includes("--subsys")) {
  console.error(`--subsys 需要一個子系統 slug\n\n${USAGE}`);
  process.exit(2);
}
if (query.doc === null && argv.includes("--doc")) {
  console.error(`--doc 需要一個文檔 id\n\n${USAGE}`);
  process.exit(2);
}
if (query.subsys && query.doc) {
  console.error(`--subsys 與 --doc 不能同時使用(--doc 已經帶出它所屬的子系統)\n\n${USAGE}`);
  process.exit(2);
}

const designDir = designDirArg ?? "./.design";
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
  enhancements: { pattern: /^(G-E\d{3})-[a-z0-9-]+\.md$/, type: "enhance", example: "G-E001" },
  bugfixes: { pattern: /^(G-B\d{3})-[a-z0-9-]+\.md$/, type: "bugfix", example: "G-B001" },
};
// 全域契約(G-C)不是任務文檔:不參與 F/E/B 進度統計,status 走 active/superseded/closed
const CONTRACT_KIND = { pattern: /^(G-C\d{3})-[a-z0-9-]+\.md$/, type: "contract", example: "G-C001" };
const ADR_PATTERN = /^(ADR-\d{3})-[a-z0-9-]+\.md$/;

if (!existsSync(designDir)) {
  console.error(`找不到 design 目錄: ${designDir}`);
  process.exit(2);
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
  const fileId = path.split(/[\\/]/).pop().match(/^(G-[CEB]\d{3}|[FEB]\d{3})/)?.[1] ?? null;
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
  const entry = { designMeta: null, designFile: null, roadmap: { phases: 0, features: [] }, cards: new Set(), groups: [], ids: new Map() };
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
    entry.groups = parseGroups(text);
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
      archNotes.push(`${rel(path)}:檔名不符全域命名規則(如 ${kind.example}-slug.md)`);
    const row = scanTaskDoc(path, null, kind);
    if (row.id !== "-") globalIds.set(row.id, row);
    if (row.affects.length === 0) archIssues.push(`${row.file}:全域文檔缺 subsystems 欄位(受影響子系統清單)`);
    for (const s of row.affects) {
      if (!subsysDirs.includes(s)) archIssues.push(`${row.file}:subsystems 列了 ${s},但 subsystems/ 沒有這個子系統`);
    }
  }
}

// 全域契約(G-C):非任務文檔,自成一組,不進 rows、不影響進度與 exit code
const contractIds = new Map(); // id → { id, description, status, affects, file, entries }
{
  const dir = join(designDir, "contracts");
  for (const name of listMd(dir)) {
    const path = join(dir, name);
    const relPath = rel(path);
    if (!CONTRACT_KIND.pattern.test(name))
      archNotes.push(`${relPath}:檔名不符全域契約命名規則(如 ${CONTRACT_KIND.example}-slug.md)`);
    const { meta, blockListKeys } = readFrontmatter(path);
    if (blockListKeys.length) badFormat.push({ file: relPath, keys: blockListKeys });
    const fileId = name.match(/^(G-C\d{3})/)?.[1] ?? null;
    const metaId = fmtValue(meta?.id);
    if (meta && fileId && metaId !== "-" && metaId !== fileId)
      archIssues.push(`${relPath}:frontmatter id(${metaId})與檔名編號(${fileId})不一致`);
    if (meta && meta.type && meta.type !== "contract")
      archIssues.push(`${relPath}:type(${meta.type})應為 contract`);
    if (!meta?.description) archIssues.push(`${relPath}:缺 description / 主軸`);
    const affects = asList(meta?.subsystems);
    // 少於兩個使用者的契約不該是全域的(doc-lifecycle.md「全域契約文檔」規則 1)
    if (affects.length < 2)
      archIssues.push(`${relPath}:subsystems 只列了 ${affects.length} 個子系統——共用契約至少要兩個,否則它屬於那個子系統的 design.md`);
    for (const s of affects) {
      if (!subsysDirs.includes(s)) archIssues.push(`${relPath}:subsystems 列了 ${s},但 subsystems/ 沒有這個子系統`);
    }
    const id = metaId !== "-" ? metaId : fileId ?? name.replace(/\.md$/, "");
    contractIds.set(id, {
      id,
      description: meta?.description ? truncate(meta.description, DESC_WIDTH) : "-",
      status: meta?.status ? String(meta.status) : "⚠ missing-metadata",
      affects,
      file: relPath,
      path,
    });
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
 * 解析 spec-gaps.md:每個條目是 `## GAP-<n>(<來源> / <角色>)`(舊制 `## G<n>` 照收),
 * 底下有一行 `- 狀態:open|resolved`。
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
    const id = head.match(/^(GAP-\d+|G\d+)/)?.[1];
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
let systemText = "";
if (existsSync(systemPath)) {
  const { meta, blockListKeys } = readFrontmatter(systemPath);
  if (blockListKeys.length) badFormat.push({ file: "system.md", keys: blockListKeys });
  systemMeta = meta;
  systemText = readFileSync(systemPath, "utf8");
  if (!meta) archIssues.push(`system.md:缺 frontmatter`);
  else if (!meta.description) archIssues.push(`system.md:缺 description / 主軸`);
} else if (subsysDirs.length > 0 || rows.length > 0) {
  archIssues.push(`找不到 .design/system.md(尚未執行 /system-design)`);
}

// subsystems 是**完整名冊**:列了但沒資料夾 = 已規劃未建檔(待辦,不是不一致);
// 有資料夾卻沒列 = 名冊漏回填(這一向才是不一致)。
const roster = systemMeta ? asList(systemMeta.subsystems) : [];
const plannedSubsys = roster.filter((s) => !subsysDirs.includes(s));
if (systemMeta) {
  for (const s of subsysDirs) {
    if (!roster.includes(s)) archIssues.push(`subsystems/${s}/ 未被 system.md 的 subsystems 名冊列入(要回填)`);
  }
  if (roster.length === subsysDirs.length && roster.length > 0)
    archNotes.push(
      `system.md:subsystems 名冊(${roster.length})與已建檔資料夾數目相同 —— 若「子系統劃分」還有規劃中、未建 design.md 的子系統,` +
        `要把它們的 slug 一起寫進名冊,否則整個未開工的部分不會出現在任何進度數字裡`,
    );
}

const subsysBriefs = systemText ? parseSubsysBriefs(systemText, roster) : new Map();
const stages = systemText ? parseStages(systemText, roster) : [];
if (systemMeta && stages.length === 0)
  archNotes.push(`system.md:沒有「開發階段」表格(或欄位不含「階段」與「狀態」),無法回答「這一階段還差什麼」`);
for (const st of stages) {
  if (st.status === "?")
    archNotes.push(`system.md 開發階段 ${st.id}:狀態欄看不懂,請用「未開始 / 進行中 / 已達成」三選一`);
  // 階段 id 撞到保留首碼(E/F/B/G/L/A/R/W/D + 數字):E0 會跟 E001 / EX- 混淆,L1 會跟 Level / law 混淆。
  // 舊專案照樣解析,但提示改用工具鏈保留的 S<n>(註冊表見 doc-lifecycle.md)
  if (/^[EFBGLARWD]\d+$/i.test(st.id))
    archNotes.push(
      `system.md 開發階段 ${st.id}:階段 id 撞到保留首碼(${st.id[0].toUpperCase()} 另有文檔或條目編號在用),` +
        `建議改用 S${st.id.replace(/^\D+/, "")}(階段 id 的保留首碼是 S,見 doc-lifecycle.md 編號與縮寫註冊表)`,
    );
  // 階段認了一個名冊不知道的子系統 = system.md 自己前後不一致,而且漏掉的正是還沒開工的那些
  for (const u of st.unknownSubsys)
    archIssues.push(
      `system.md 開發階段 ${st.id} 的涵蓋子系統寫了 ${u},但 subsystems 名冊沒有它` +
        `(名冊要含**規劃中、未建 design.md** 的子系統,否則 ${u} 不在任何進度分母裡)`,
    );
}

// ---------------------------------------------------------------- 功能規劃(roadmap)

/**
 * 從 design.md 內文抓「功能規劃」路線圖。
 * 結構:`## 功能規劃` 下數個 `### 階段…`,每階段一張表(欄位含 feature 與 doc,可選「模組群」)。
 * 回傳 { phases, features: [{ phase, feature, doc, group }] };doc 未建檔(`-`)時為空字串。
 * 沒有「模組群」欄時 group 為空字串 —— 單一模組群的子系統不必寫這欄。
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
      const groupCol = lower.findIndex((c) => c.replace(/\s/g, "") === "模組群");
      colIdx = featureCol >= 0 ? { feature: featureCol, doc: docCol, group: groupCol } : null;
      continue; // 表頭列
    }
    if (!colIdx) continue;
    const feature = cells[colIdx.feature] ?? "";
    if (!feature || feature === "-" || /^<.+>$/.test(feature)) continue; // 空列或模板列
    features.push({
      phase: phases.at(-1) ?? "-",
      feature: normName(feature),
      doc: (cells[colIdx.doc] ?? "").match(/F\d{3}/)?.[0] ?? "",
      group: colIdx.group >= 0 ? normName(cells[colIdx.group] ?? "") : "",
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

/** 把一行 markdown 切成表格 cells;不是表格列、或是分隔列時回傳 null */
function tableCells(line) {
  if (!line.trim().startsWith("|")) return null;
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  if (cells.every((c) => c === "" || /^:?-{2,}:?$/.test(c))) return null; // 分隔列
  return cells;
}

/** 表頭列的欄位比對用:去空白、轉小寫 */
function headerKeys(cells) {
  return cells.map((c) => normName(c).replace(/\s/g, "").toLowerCase());
}

/**
 * 從 design.md 內文抓「模組群」表 —— Level 2 內部的**領域劃分**,一個子系統可以有很多個。
 * 結構:`## 模組群` 下一張表,欄位至少含「模組群」與「狀態」(active | planned)。
 * 回傳 [{ name, status, brief }];沒有這個章節時回空陣列(單一模組群的子系統不必寫)。
 *
 * 這張表是子系統的**真分母**:只算 active 那幾群的 feature,會把 planned 的整群漏掉。
 */
function parseGroups(text) {
  const groups = [];
  let inSection = false;
  let colIdx = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (heading) {
      if (heading[1].length === 2) inSection = /模組群/.test(heading[2]);
      colIdx = null;
      continue;
    }
    if (!inSection) continue;
    const cells = tableCells(line);
    if (!cells) continue;
    const keys = headerKeys(cells);
    const nameCol = keys.indexOf("模組群");
    if (nameCol >= 0) {
      const statusCol = keys.findIndex((c) => c === "狀態" || c === "status");
      const briefCol = keys.findIndex((c) => c.includes("職責") || c.includes("一句話"));
      colIdx = statusCol >= 0 ? { name: nameCol, status: statusCol, brief: briefCol } : null;
      continue; // 表頭列
    }
    if (!colIdx) continue;
    const name = normName(cells[colIdx.name] ?? "");
    if (!name || name === "-" || /^<.+>$/.test(name)) continue; // 空列或模板列
    const raw = normName(cells[colIdx.status] ?? "").toLowerCase();
    groups.push({
      name,
      status: /planned|規劃|未建|未寫|未開始/.test(raw) ? "planned" : "active",
      brief: colIdx.brief >= 0 ? normName(cells[colIdx.brief] ?? "") : "",
    });
  }
  return groups;
}

/** 開發階段的狀態詞彙:三選一,認不出來一律 `?`(會被列為提示,請改用標準詞) */
function normStageStatus(raw) {
  const t = normName(String(raw));
  if (/未開始|未啟動|尚未/.test(t)) return "未開始";
  if (/進行中|in-progress/i.test(t)) return "進行中";
  if (/已達成|已完成|^done/i.test(t)) return "已達成";
  return "?";
}

/**
 * 從 system.md 內文抓「開發階段」表 —— **全專案唯一的產品級分母**。
 * 結構:`## 開發階段` 下一張表,欄位至少含「階段」與「狀態」;「涵蓋子系統」為選填。
 * 回傳 [{ id, title, subsys, unknownSubsys, status }];沒有這個章節時回空陣列。
 */
function parseStages(text, roster) {
  const stages = [];
  let inSection = false;
  let colIdx = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (heading) {
      if (heading[1].length === 2) inSection = /開發階段/.test(heading[2]);
      colIdx = null;
      continue;
    }
    if (!inSection) continue;
    const cells = tableCells(line);
    if (!cells) continue;
    const keys = headerKeys(cells);
    const stageCol = keys.indexOf("階段");
    if (stageCol >= 0) {
      const statusCol = keys.findIndex((c) => c === "狀態" || c === "status");
      const subsysCol = keys.findIndex((c) => c.includes("子系統"));
      colIdx = statusCol >= 0 ? { stage: stageCol, status: statusCol, subsys: subsysCol } : null;
      continue; // 表頭列
    }
    if (!colIdx) continue;
    const title = normName(cells[colIdx.stage] ?? "");
    if (!title || title === "-" || /^<.+>$/.test(title)) continue;
    const cell = colIdx.subsys >= 0 ? String(cells[colIdx.subsys] ?? "") : "";
    const named = cell.split(/[^A-Za-z0-9_-]+/).filter(Boolean);
    stages.push({
      id: title.split(/\s+/)[0],
      title,
      subsys: roster.filter((r) => named.includes(r)),
      unknownSubsys: named.filter((n) => /^[a-z][a-z0-9-]{2,}$/.test(n) && !roster.includes(n)),
      status: normStageStatus(cells[colIdx.status] ?? ""),
    });
  }
  return stages;
}

/**
 * 從 system.md 的「子系統劃分」章節撈每個子系統的一句話職責,給**名冊上還沒建檔**的項目當主軸。
 * 盡力而為:標題(### / ####)的第一個 token 對得上名冊 slug 時,取其下第一行 `- **職責**:…`。
 * 撈不到只是顯示 `-`,不影響任何判斷。
 */
function parseSubsysBriefs(text, roster) {
  const briefs = new Map();
  let cur = null;
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (heading) {
      if (heading[1].length === 2) {
        inSection = /子系統劃分/.test(heading[2]);
        cur = null;
        continue;
      }
      if (!inSection) continue;
      const token = normName(heading[2]).split(/[\s—–-]+/)[0].toLowerCase();
      cur = roster.includes(token) ? token : null;
      continue;
    }
    if (!inSection || !cur || briefs.has(cur)) continue;
    const m = line.match(/^-\s+\*\*職責\*\*[::]\s*(.+)$/);
    if (m) briefs.set(cur, normName(m[1]));
  }
  return briefs;
}

const subsysRows = [];
const pendingFeatures = []; // 功能規劃有列、尚未建 feature 文檔的項目
const noGroupTable = []; // 沒有「模組群」表的子系統(只有一個領域時屬正常,合併成一條提示)

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

  // ---- 模組群:子系統內部的領域劃分。planned 的那幾群沒有 feature,不能被算成「這個子系統做完了」
  const groups = entry.groups;
  const activeGroups = groups.filter((g) => g.status === "active");
  const plannedGroups = groups.filter((g) => g.status === "planned");
  const groupNames = new Set(groups.map((g) => g.name.toLowerCase()));
  const featuresOf = (name) => roadmap.features.filter((f) => f.group.toLowerCase() === name.toLowerCase());
  for (const g of groups) {
    const fs = featuresOf(g.name);
    g.total = fs.length;
    g.done = fs.filter((f) => f.doc && DONE_STATUSES.has(entry.ids.get(f.doc)?.status)).length;
    g.subsystem = slug;
  }
  if (groups.length > 0) {
    // 只有一個模組群時,功能規劃可以不寫「模組群」欄:整份路線圖就是那一群
    if (groups.length === 1 && groups[0].total === 0) {
      groups[0].total = total;
      groups[0].done = done;
    }
    for (const f of roadmap.features) {
      if (f.group && !groupNames.has(f.group.toLowerCase()))
        archIssues.push(`${entry.designFile}:功能規劃的 ${f.feature} 標了模組群「${f.group}」,但「模組群」表沒有這一群`);
    }
    if (groups.length > 1) {
      const ungrouped = roadmap.features.filter((f) => !f.group);
      if (ungrouped.length > 0)
        archIssues.push(
          `${entry.designFile}:有 ${groups.length} 個模組群,但功能規劃有 ${ungrouped.length} 列沒填「模組群」欄` +
            `(${ungrouped.map((f) => f.feature).join("、")})——分不清楚它們算哪一群的進度`,
        );
    }
    for (const g of plannedGroups)
      archNotes.push(
        `${entry.designFile}:模組群「${g.name}」還是 planned(契約章節與功能規劃未寫)` +
          `${g.brief ? `——${g.brief}` : ""};它不在本子系統的進度分母裡`,
      );
    for (const g of activeGroups) {
      if (g.total === 0)
        archIssues.push(`${entry.designFile}:模組群「${g.name}」標 active,但功能規劃一列都沒有(標錯狀態,或路線圖漏寫)`);
    }
  } else if (entry.designFile && total > 0) {
    noGroupTable.push(slug);
  }

  subsysRows.push({
    description: meta?.description ? truncate(meta.description, DESC_WIDTH) : "-",
    id: slug,
    status: !meta || !meta.status ? "⚠ missing-metadata" : String(meta.status),
    groups: groups.length === 0 ? "-" : `${activeGroups.length}/${groups.length}`,
    phases: total === 0 ? "-" : String(roadmap.phases || 1),
    features: total === 0 ? "-" : String(total),
    cards: total === 0 || cards.size === 0 ? "-" : `${carded}/${total}`,
    specced: total === 0 ? "-" : String(specced),
    done: total === 0 ? "-" : String(done),
    openEB: `${openE}E/${openB}B`,
    progress: total === 0 ? "-" : `${done}/${total} (${Math.round((done / total) * 100)}%)`,
    hasRoadmap: total > 0,
    built: true,
    groupRows: groups,
    plannedGroups: plannedGroups.length,
    // 「做完」的門檻:路線圖跑完、沒有未結 E/B,而且**沒有還沒開工的模組群**
    complete: total > 0 && done === total && openE === 0 && openB === 0 && plannedGroups.length === 0,
  });
}

if (noGroupTable.length > 0)
  archNotes.push(
    `沒有「模組群」表的子系統:${noGroupTable.join("、")}。只有一個領域時屬正常;` +
      `子系統內有多個平行領域、而其中幾個還沒開工時,不寫這張表會讓進度只算得到已落地的那一群`,
  );

// 名冊上有、還沒建 design.md 的子系統:它們是待辦,要進表、進分母,但不算「不一致」
for (const slug of plannedSubsys) {
  subsysRows.push({
    description: subsysBriefs.get(slug) ? truncate(subsysBriefs.get(slug), DESC_WIDTH) : "-",
    id: slug,
    status: "未建 design.md",
    groups: "-",
    phases: "-",
    features: "-",
    cards: "-",
    specced: "-",
    done: "-",
    openEB: "-",
    progress: "未展開",
    hasRoadmap: false,
    built: false,
    groupRows: [],
    plannedGroups: 0,
    complete: false,
  });
}

// ---------------------------------------------------------------- depends-on 解析

/** 解析引用:同子系統直寫 id;跨子系統 <slug>/<id>;全域 G-*(契約可帶 #條目);ADR-*。回傳 true = 可解析 */
function resolveRef(ref, contextSubsys) {
  if (/^ADR-\d+$/.test(ref)) return adrIds.has(ref);
  if (/^G-C\d{3}(#.+)?$/.test(ref)) return contractIds.has(ref.split("#")[0]);
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

// ---------------------------------------------------------------- 查詢模式(--subsys / --doc)

/** 文檔的正規化鍵:子系統文檔 `<slug>/<id>`,全域文檔 `<id>` */
const docKey = (subsystem, id) => (subsystem && subsystem !== "global" ? `${subsystem}/${id}` : id);

/** 把一條引用在它的 context 下正規化成 docKey(契約去掉 `#條目`) */
function refKey(ref, contextSubsys) {
  const bare = ref.split("#")[0];
  if (/^(ADR-|G-)/.test(bare) || bare.includes("/")) return bare;
  return contextSubsys && contextSubsys !== "global" ? `${contextSubsys}/${bare}` : bare;
}

/** 反向依賴索引:docKey → [{ row, ref }];這一半散在別的資料夾,靠路徑推不出來 */
const reverseDeps = new Map();
for (const r of rows) {
  for (const ref of r.dependsOn) {
    const k = refKey(ref, r.subsystem);
    if (!reverseDeps.has(k)) reverseDeps.set(k, []);
    reverseDeps.get(k).push({ row: r, ref });
  }
}

/** 取出 markdown 某個標題段落的全文(到下一個同級或更高級標題為止);找不到回傳 null */
function section(text, titleRe) {
  const lines = text.split(/\r?\n/);
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^(#{2,6})\s+(.+?)\s*$/);
    if (!h) continue;
    if (start < 0) {
      if (titleRe.test(h[2])) {
        start = i;
        level = h[1].length;
      }
    } else if (h[1].length <= level) {
      return lines.slice(start, i).join("\n").trimEnd();
    }
  }
  return start < 0 ? null : lines.slice(start).join("\n").trimEnd();
}

/** 掃全文裡出現的全域契約引用(frontmatter 之外的內文也算),回傳去重後的 ref 清單 */
function contractRefsIn(text) {
  const out = new Set();
  for (const m of text.matchAll(/G-C\d{3}(?:#[A-Za-z0-9_.\-]+)?/g)) out.add(m[0]);
  return [...out];
}

/** 一條引用印成一行:目標的狀態與檔案,解析不到就標明 */
function fmtRef(key, viaRef) {
  const shown = viaRef && viaRef !== key ? `${viaRef}` : key;
  const bare = key.split("#")[0];
  if (contractIds.has(bare)) {
    const c = contractIds.get(bare);
    return `- ${shown}  [${c.status}]  ${c.file}  ${c.description}`;
  }
  if (globalIds.has(bare)) {
    const g = globalIds.get(bare);
    return `- ${shown}  [${g.status}]  ${g.file}  ${g.description}`;
  }
  if (bare.includes("/")) {
    const [slug, id] = bare.split("/");
    const r = subsysDocs.get(slug)?.ids.get(id);
    if (r) return `- ${shown}  [${r.status}]  ${r.file}  ${r.description}`;
  }
  if (adrIds.has(bare)) return `- ${shown}  [adr]  adr/`;
  return `- ${shown}  ⚠ 解析不到(引用格式見 doc-lifecycle.md)`;
}

/** 印一段;內容為空時印 (無) */
function printBlock(title, lines) {
  console.log(`\n=== ${title} ===`);
  if (!lines || lines.length === 0) console.log("(無)");
  else for (const l of lines) console.log(l);
}

const QUERY_TAIL =
  "\n本腳本只產生索引,不下判斷:它答得出「哪份文檔、什麼狀態、誰依賴誰」,答不出「那份文檔寫的對不對」。\n" +
  "要寫進 spec 的每一條介面,仍須打開該文檔讀原文。各角色的使用界線見 _shared/design-query.md。";

if (query.doc) {
  const want = query.doc.trim();
  const bare = want.split("#")[0];

  // 1) 全域契約
  if (contractIds.has(bare)) {
    const c = contractIds.get(bare);
    const text = readFileSync(c.path, "utf8");
    console.log(`=== 全域契約 ${c.id} ===`);
    console.log(`主軸  ${c.description}`);
    console.log(`歸屬  全域共用契約(不屬於任何單一子系統)  |  status ${c.status}`);
    console.log(`使用  ${c.affects.length ? c.affects.join("、") : "⚠ 未列 subsystems"}`);
    console.log(`檔案  ${c.file}`);

    const entries = section(text, /契約條目/);
    printBlock("契約條目", entries ? entries.split("\n") : ["(這份契約沒有「契約條目」章節——格式見 doc-lifecycle.md「全域契約文檔」)"]);

    const users = [];
    for (const [k, list] of reverseDeps) {
      if (k.split("#")[0] !== bare) continue;
      for (const { row, ref } of list) users.push(`- ${docKey(row.subsystem, row.id)}  [${row.status}]  引用 ${ref}  ${row.file}`);
    }
    printBlock("誰引用這份契約(反向依賴)", users.sort());
    console.log(QUERY_TAIL);
    process.exit(0);
  }

  // 2) 全域任務文檔 / 子系統文檔
  let hit = null;
  if (globalIds.has(bare)) hit = globalIds.get(bare);
  else if (bare.includes("/")) {
    const [slug, id] = bare.split("/");
    hit = subsysDocs.get(slug)?.ids.get(id) ?? null;
  } else {
    const candidates = [];
    for (const [slug, entry] of subsysDocs) if (entry.ids.has(bare)) candidates.push(entry.ids.get(bare));
    if (candidates.length === 1) hit = candidates[0];
    else if (candidates.length > 1) {
      console.error(`id ${bare} 在多個子系統都存在,請帶上子系統:`);
      for (const c of candidates) console.error(`  --doc ${c.subsystem}/${c.id}   ${c.file}`);
      process.exit(2);
    }
  }
  if (!hit) {
    console.error(`查無此文檔 id: ${want}`);
    console.error(`(子系統文檔寫 F003 或 auth/F003;全域寫 G-E001 / G-B001;共用契約寫 G-C001)`);
    process.exit(2);
  }

  const key = docKey(hit.subsystem, hit.id);
  const full = readFileSync(join(designDir, hit.file), "utf8");
  const entry = hit.subsystem !== "global" ? subsysDocs.get(hit.subsystem) : null;
  const road = entry?.roadmap.features.find((f) => f.doc === hit.id) ?? null;

  console.log(`=== 文檔 ${key} ===`);
  console.log(`主軸  ${hit.description}`);
  console.log(
    `歸屬  ${hit.subsystem === "global" ? "全域(跨子系統)" : `子系統 ${hit.subsystem}`}` +
      (road ? `  |  ${road.phase}  |  功能規劃「${road.feature}」` : "") +
      `  |  type ${hit.type}  |  status ${hit.status}`,
  );
  if (hit.subsystem === "global") console.log(`受影響  ${hit.affects.length ? hit.affects.join("、") : "⚠ 未列 subsystems"}`);
  else if (entry?.designFile) console.log(`上層  ${entry.designFile}`);
  console.log(`檔案  ${hit.file}`);

  for (const [title, re] of [
    ["數據", /^數據$|數據與介面變動/],
    ["介面", /^介面$/],
  ]) {
    const sec = section(full, re);
    if (sec) printBlock(`${title}(原文)`, sec.split("\n"));
  }
  if (!section(full, /^數據$|數據與介面變動/) && !section(full, /^介面$/))
    printBlock("介面 / 數據", ["(這份文檔沒有「數據」或「介面」段——模板見 spec-design/templates/)"]);

  const usedContracts = contractRefsIn(full);
  printBlock("引用的全域契約", usedContracts.map((r) => fmtRef(r, r)));

  printBlock(
    "正向依賴(我依賴誰)",
    hit.dependsOn.map((ref) => fmtRef(refKey(ref, hit.subsystem), ref)),
  );

  const back = (reverseDeps.get(key) ?? []).map(
    ({ row, ref }) => `- ${docKey(row.subsystem, row.id)}  [${row.status}]  引用 ${ref}  ${row.file}`,
  );
  printBlock("反向依賴(誰依賴我)", back.sort());

  console.log(QUERY_TAIL);
  process.exit(0);
}

if (query.subsys) {
  const slug = query.subsys.trim();
  if (!subsysDocs.has(slug) && plannedSubsys.includes(slug)) {
    // 名冊上有、還沒建 design.md:這是「還沒做」,不是「查無此物」
    const st = stages.find((x) => x.subsys.includes(slug));
    console.log(`=== 子系統 ${slug} ===`);
    console.log(`主軸  ${subsysBriefs.get(slug) ?? "-"}`);
    console.log(`狀態  已列入 system.md 的 subsystems 名冊,**尚未建 design.md**${st ? `(${st.id} ${st.status})` : ""}`);
    console.log(`檔案  subsystems/${slug}/design.md 不存在`);
    console.log("\n它的職責與邊界只寫在 system.md 的「子系統劃分」;沒有契約、沒有功能規劃、沒有 feature 文檔。");
    console.log(`下一步:/subsys-design ${slug}`);
    console.log(QUERY_TAIL);
    process.exit(1);
  }
  if (!subsysDocs.has(slug)) {
    console.error(`查無此子系統: ${slug}`);
    console.error(`已建檔:${subsysDirs.length ? subsysDirs.join("、") : "(subsystems/ 下沒有任何子系統)"}`);
    if (plannedSubsys.length) console.error(`名冊上未建檔:${plannedSubsys.join("、")}`);
    process.exit(2);
  }
  const entry = subsysDocs.get(slug);
  const srow = subsysRows.find((s) => s.id === slug);
  const mine = rows.filter((r) => r.subsystem === slug);
  const inScope = (s) => s.includes(`subsystems/${slug}/`) || s.includes(` ${slug} `) || s.startsWith(`${slug}:`);

  console.log(`=== 子系統 ${slug} ===`);
  console.log(`主軸  ${srow?.description ?? "-"}`);
  console.log(`狀態  status ${srow?.status ?? "-"}  |  模組群 ${srow?.groups ?? "-"}  |  階段 ${srow?.phases ?? "-"}  |  features ${srow?.features ?? "-"}  |  契約卡 ${srow?.cards ?? "-"}  |  進度 ${srow?.progress ?? "-"}`);
  console.log(`檔案  ${entry.designFile ?? "⚠ 缺 design.md"}`);

  if (entry.groups.length > 0) {
    console.log(`\n=== 模組群(${entry.groups.length})===`);
    printTable(
      { name: "模組群", status: "狀態", prog: "進度", brief: "職責" },
      entry.groups.map((g) => ({
        name: g.name,
        status: g.status,
        prog: g.status === "planned" ? "未展開" : `${g.done}/${g.total}`,
        brief: truncate(g.brief || "-", DESC_WIDTH),
      })),
    );
    if (entry.groups.some((g) => g.status === "planned"))
      console.log("planned 的模組群沒有契約、沒有功能規劃,**不在上面那個進度分母裡**。");
  }

  console.log(`\n=== 本子系統的文檔(${mine.length})===`);
  if (mine.length === 0) console.log("(還沒有任何 feature / enhance / bugfix 文檔)");
  else
    printTable(
      { description: "主軸", id: "id", type: "type", status: "status", dependsOn: "depends-on", file: "file" },
      mine.map((r) => ({ ...r, dependsOn: fmtValue(r.dependsOn) })),
    );

  const out = [];
  for (const r of mine)
    for (const ref of r.dependsOn) {
      const k = refKey(ref, slug);
      if (k.startsWith(`${slug}/`)) continue; // 子系統內部依賴,上表已經看得到
      out.push(`- ${docKey(r.subsystem, r.id)} → ${ref}\n  ${fmtRef(k, ref).slice(2)}`);
    }
  printBlock("對外依賴(本子系統依賴誰)", out);

  const back = [];
  for (const [k, list] of reverseDeps) {
    if (!k.startsWith(`${slug}/`)) continue;
    for (const { row, ref } of list) {
      if (row.subsystem === slug) continue; // 內部依賴不算反向跨界
      back.push(`- ${docKey(row.subsystem, row.id)} → ${k}(寫成 ${ref})  [${row.status}]  ${row.file}`);
    }
  }
  printBlock("反向依賴(誰依賴本子系統)—— B1 的候選清單", back.sort());

  // 依契約 id 去重,把引用到的條目收在同一行(同一份契約常被多個條目引用)
  const cmap = new Map(); // bare id → Set(條目名)
  const noteContract = (ref) => {
    const [bare, item] = ref.split("#");
    if (!cmap.has(bare)) cmap.set(bare, new Set());
    if (item) cmap.get(bare).add(item);
  };
  for (const r of mine) for (const ref of r.dependsOn) if (/^G-C\d{3}/.test(ref)) noteContract(ref);
  for (const [, c] of contractIds) if (c.affects.includes(slug)) noteContract(c.id);
  printBlock(
    "相關的全域契約",
    [...cmap.keys()].sort().map((bare) => {
      const items = [...cmap.get(bare)].sort();
      return fmtRef(bare, bare) + (items.length ? `\n  用到的條目:${items.join("、")}` : "\n  ⚠ 只引用了文檔 id,沒寫到條目(引用格式見 doc-lifecycle.md)");
    }),
  );

  const pend = pendingFeatures.filter((f) => f.subsystem === slug);
  printBlock(
    `待展開的 feature(${pend.length})`,
    pend.map((f) => `- ${f.phase}:${f.feature}`),
  );

  const gaps = openGaps.filter((g) => g.scope === slug);
  printBlock(
    `未結的 spec-gaps(${gaps.length})`,
    gaps.map((g) => `- ${g.head}  ${g.topic}  ${g.file}`),
  );

  const issues = archIssues.filter(inScope);
  const notes = archNotes.filter(inScope);
  const bad = badFormat.filter((b) => b.file.includes(`subsystems/${slug}/`));
  printBlock(`架構 / 子系統不一致(${issues.length})`, issues.map((m) => `- ${m}`));
  if (notes.length) printBlock(`提示(${notes.length})`, notes.map((m) => `- ${m}`));
  if (bad.length) printBlock(`frontmatter 格式不合規(${bad.length})`, bad.map((b) => `- ${b.file}:${b.keys.join("、")} 寫成 YAML 區塊列表`));

  console.log(QUERY_TAIL);

  const unfinishedHere = mine.filter((r) => !DONE_STATUSES.has(r.status));
  const plannedHere = entry.groups.filter((g) => g.status === "planned").length;
  process.exit(unfinishedHere.length || issues.length || bad.length || gaps.length || pend.length || plannedHere ? 1 : 0);
}

// ---------------------------------------------------------------- 輸出(盤點模式)

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
    { description: "主軸", id: "id", status: "status", groups: "模組群", phases: "階段", features: "features", cards: "契約卡", specced: "已建文檔", done: "已完成", openEB: "未結E/B", progress: "進度" },
    subsysRows,
  );
  const built = subsysRows.filter((s) => s.built);
  const tracked = built.filter((s) => s.hasRoadmap);
  const unknown = built.length - tracked.length;
  console.log(
    `\n子系統建檔:${built.length}/${subsysRows.length}(名冊列了 ${subsysRows.length} 個,` +
      `${plannedSubsys.length} 個還沒有 design.md)`,
  );
  console.log(
    `子系統完成度:${tracked.filter((s) => s.complete).length}/${subsysRows.length} 個子系統跑完路線圖、無未結 E/B 且無 planned 模組群` +
      (unknown > 0 ? `(另有 ${unknown} 個已建檔但沒有功能規劃表格,進度未知)` : ""),
  );
  console.log("(「進度」欄的分母只是**該子系統自己的功能規劃**,不是產品完成度;產品完成度看下面的開發階段)");
}

// ---- 開發階段:全專案唯一的產品級分母 ----
if (stages.length > 0) {
  console.log(`\n=== 開發階段(${stages.length})===`);
  printTable(
    { id: "階段", title: "名稱", subsysList: "涵蓋子系統", status: "狀態" },
    stages.map((st) => ({ id: st.id, title: truncate(st.title, DESC_WIDTH), subsysList: st.subsys.join("、") || "-", status: st.status })),
  );
  const cnt = { 已達成: 0, 進行中: 0, 未開始: 0, "?": 0 };
  for (const st of stages) cnt[st.status]++;
  console.log(
    `\n階段進度:已達成 ${cnt["已達成"]} / 進行中 ${cnt["進行中"]} / 未開始 ${cnt["未開始"]}` +
      (cnt["?"] ? ` / 狀態不明 ${cnt["?"]}` : "") +
      `(共 ${stages.length} 階段)`,
  );
  if (cnt["未開始"] + cnt["進行中"] > 0)
    console.log("**專案還沒做完**:上面任務文檔的百分比只涵蓋已展開的部分,未開始的階段完全不在那些分母裡。");
}

// ---- 名冊上還沒建檔的子系統 ----
if (plannedSubsys.length > 0) {
  console.log(`\n=== 已規劃、未建 design.md 的子系統(${plannedSubsys.length})===`);
  console.log("system.md 的名冊列了它們,但還沒有 Level 2 設計 —— 它們的 feature 一個都還不存在,也不在任何進度分母裡。");
  for (const s of plannedSubsys) {
    const st = stages.find((x) => x.subsys.includes(s));
    console.log(`- ${s}  ${subsysBriefs.get(s) ?? "(system.md 子系統劃分沒撈到職責)"}${st ? `  [${st.id} ${st.status}]` : ""}`);
  }
  console.log("下一步:對其中一個跑 /subsys-design。");
}

// ---- 已建檔子系統裡、還沒開工的模組群 ----
const plannedGroupRows = subsysRows.flatMap((s) => s.groupRows.filter((g) => g.status === "planned"));
if (plannedGroupRows.length > 0) {
  console.log(`\n=== 已規劃、契約未寫的模組群(${plannedGroupRows.length})===`);
  console.log("子系統的 design.md 認了這些領域,但契約章節與功能規劃還沒寫 —— 它們不在該子系統的進度分母裡。");
  for (const g of plannedGroupRows) console.log(`- ${g.subsystem} / ${g.name}${g.brief ? `  ${g.brief}` : ""}`);
  console.log("下一步:對該子系統跑 /subsys-design 更新模式,把那一群的契約與功能規劃補上。");
}

if (Object.keys(adrCounts).length > 0) {
  console.log(`\nADR:${Object.entries(adrCounts).sort().map(([s, n]) => `${s} ${n}`).join("、")}(共 ${adrIds.size} 份)`);
}

if (contractIds.size > 0) {
  console.log(`\n=== 全域契約(${contractIds.size})===`);
  printTable(
    { description: "主軸", id: "id", status: "status", affects: "使用的子系統", file: "file" },
    [...contractIds.values()].map((c) => ({ ...c, affects: fmtValue(c.affects) })),
  );
  console.log("(契約不是任務文檔,不計入進度;查單一份用 --doc G-C00x)");
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

const openSubsysRows = subsysRows.filter((s) => !s.complete);
if (openSubsysRows.length > 0) {
  console.log(`\n=== 未完成的子系統(${openSubsysRows.length})===`);
  for (const s of openSubsysRows)
    console.log(
      `- ${s.description}  [${s.status}] ${s.id}  進度 ${s.progress}  未結 ${s.openEB}` +
        (s.plannedGroups > 0 ? `  ⚠ 還有 ${s.plannedGroups} 個模組群未開工` : ""),
    );
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

const openStages = stages.filter((st) => st.status !== "已達成");
if (
  unfinished.length > 0 ||
  openSubsysRows.length > 0 ||
  pendingFeatures.length > 0 ||
  plannedSubsys.length > 0 ||
  plannedGroupRows.length > 0 ||
  openStages.length > 0 ||
  noDesc.length > 0 ||
  archIssues.length > 0 ||
  badFormat.length > 0 ||
  openGaps.length > 0
) {
  process.exit(1);
}
console.log(
  "\n全部項目皆已完成(done/closed)、名冊上每個子系統都已建檔且跑完路線圖、" +
    "沒有 planned 模組群、開發階段全數已達成,且 metadata 完整。",
);
process.exit(0);
