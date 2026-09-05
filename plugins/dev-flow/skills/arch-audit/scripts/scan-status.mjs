#!/usr/bin/env node
/**
 * scan-status.mjs — 掃描 .design/ 樹狀設計文檔。兩種模式:
 *   盤點模式(不給 --subsys / --doc / --file):任務狀態與各子系統進度,全樹視角
 *   查詢模式(--subsys / --doc):聚焦單一子系統或單一文檔,額外給出**反向依賴**
 *   反查模式(--file):給一條程式碼路徑,回頭問「它是哪些文檔做出來的」
 *
 * 掃描範圍:
 *   .design/system.md                                  主架構:frontmatter subsystems 是**完整名冊**
 *                                                      (含尚未建檔者)+ 內文「開發階段」表
 *   .design/subsystems/<slug>/design.md                子系統架構(「模組群」表;「功能總覽」是本腳本 --write-index 生成的)
 *   .design/subsystems/<slug>/spec-gaps.md             qa / impl 提出的 spec 模糊處(未結條目影響 exit code)
 *   .design/subsystems/<slug>/{features,enhancements,bugfixes}/*.md   子系統任務文檔
 *   .design/{enhancements,bugfixes}/*.md               全域任務文檔(G-E / G-B)
 *   .design/contracts/*.md                             跨子系統共用契約(G-C;非任務文檔,不計入進度)
 *   .design/spikes/*.md                                可行性驗證紀錄(SPK;非任務文檔,open 的算待辦、不進百分比)
 *   .design/adr/*.md                                   ADR
 *
 * 盤點模式下任務文檔只讀每檔開頭 4KB;design.md 與 system.md 需讀全文才能解析
 * 「模組群」與「開發階段」/「子系統劃分」;feature 的分母來自 features/ 底下的檔案本身。
 * 查詢模式**只對被查的那一份與直接關聯的文檔**讀全文(要取「介面」/「數據」段與契約條目),
 * 盤點模式一個位元組都不多讀。
 *
 * **盤點模式的任務文檔表只列未完成的**(要全表用 `--all`):已完成的文檔答不出「現在能做
 * 什麼」,而它們的份數已經收進子系統狀態表的進度欄。一份一行全印出來,只會讓真正卡著的
 * 那幾條沉在幾十列裡 —— 那正是這張表要回答的東西。
 *
 * **分母紀律(本腳本的存在理由)**:進度的分母來自 system.md(名冊 + 開發階段)與
 * design.md(模組群)與 features/ 的檔案,**不是**來自「已經存在的資料夾」。名冊列了卻沒有資料夾
 * = 已規劃、未建檔,那是**待辦**不是不一致。分母若由已完成的東西定義,報表只會愈做愈接近
 * 100%,而永遠看不見還沒開工的那一大半。
 * 清單欄位(depends-on / related-adr / related-feature / subsystems)一律**行內陣列** `[a, b]`;
 * 寫成 YAML 區塊列表會被列為格式不合規並以 exit code 1 收場。
 *
 * 用法:
 *   node scan-status.mjs [design目錄]                  盤點全樹(預設 ./.design),任務文檔只列未完成
 *   node scan-status.mjs [design目錄] --all            同上,但任務文檔表改列全部(含已完成)
 *   node scan-status.mjs [design目錄] --today YYYY-MM-DD 停滯天數以這一天為準(預設今天;golden 測試用)
 *   node scan-status.mjs .design --subsys <slug>       聚焦子系統:它的文檔 + 進出依賴 + 反向依賴
 *   node scan-status.mjs .design --doc <文檔>          聚焦文檔:歸屬 / 介面 / 契約 / 正反向依賴
 *                                                     吃全名 auth/F003-token-cache,也吃 auth/F003 與 F003
 *   node scan-status.mjs .design --file <path>         反查程式碼路徑:哪個子系統、被哪些 F/E/B 動過
 *   node scan-status.mjs .design --write-index         把各 design.md 的「功能總覽」重新生成一次(會寫檔)
 *   node scan-status.mjs --help
 *
 * Exit code(**兩種模式語意不同**,呼叫端不要混用):
 *   盤點 / --subsys : 0 = 範圍內全部完成(或無檔案) / 1 = 有未完成項目、metadata 缺失或架構不一致
 *   --doc           : 0 = 查到 / 2 = 查無此文檔(查到但未完成仍是 0——查詢不是驗收)
 *   --file          : 0 = 有文檔的 code-paths 涵蓋它 / 2 = 沒有任何文檔認領這條路徑
 *   --write-index   : 0 = 全部寫成功 / 1 = 有 design.md 找不到 FEATURE INDEX 標記
 *   任一模式        : 2 = design 目錄或 --subsys 的 slug 不存在
 *
 * **`--file` 反查的資料來源是各文檔 frontmatter 的 `code-paths`**,現掃現算,不另存索引。
 * 任務文檔(F/E/B)的這一欄由 impl / bugfix 在收尾**與 `status: done` 同一個動作**回寫,
 * 所以它跟狀態一樣新;沒回寫的文檔在反查裡看不見(那是回寫漏了,不是查詢壞了)。
 * 子系統 `design.md` 的 `code-paths` 是路徑**前綴**,答的是「這條路徑歸哪個子系統」。
 *
 * **本腳本只產生索引,不下判斷**:它答得出「哪份文檔、什麼狀態、誰依賴誰」,
 * 答不出「那份文檔寫的對不對」。紀律與各角色的使用界線見 _shared/design-query.md。
 *
 * **印出去的每一個編號都是全名**(`auth/F002-token-refresh`、`auth/GAP-1`、`G-C001-session`):
 * 每個子系統各有一組 F001/E001/B001,而輸出的每一行都會被複製到別處(回報、閘門、issue),
 * 到了那裡就沒有「這是哪個子系統的表」這個上下文。規則見 _shared/conventions.md「指稱紀律」。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseGapBlocks } from "./_gap-status.mjs";
import { parseFrontmatter, readFrontmatter, asList } from "./_frontmatter.mjs";
import { section } from "./_sections.mjs";
import { dataCells, isSeparatorRow } from "./_tables.mjs";
import { printHelpIfAsked, usageBlock } from "./_help.mjs";
import { countIds, countRulings } from "./_counts.mjs";

/** 用法字串取自本檔檔頭(唯一產地),不另寫一份 —— 兩份只會在改旗標時分岔 */
const USAGE = usageBlock(import.meta.url);

const argv = process.argv.slice(2);
printHelpIfAsked(argv, import.meta.url);
const query = { subsys: null, doc: null, file: null };
const writeIndex = argv.includes("--write-index");
const showAll = argv.includes("--all");
let todayArg = null;
let designDirArg = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--help" || a === "-h") {
    console.log(USAGE);
    process.exit(0);
  } else if (a === "--subsys") query.subsys = argv[++i] ?? null;
  else if (a === "--doc") query.doc = argv[++i] ?? null;
  else if (a === "--file") query.file = argv[++i] ?? null;
  else if (a === "--today") todayArg = argv[++i] ?? null;
  else if (a === "--write-index" || a === "--all") { /* 已在上面讀掉 */ }
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
if (query.file === null && argv.includes("--file")) {
  console.error(`--file 需要一條程式碼路徑\n\n${USAGE}`);
  process.exit(2);
}
if ([query.subsys, query.doc, query.file].filter((x) => x !== null).length > 1) {
  console.error(`--subsys / --doc / --file 一次只能用一個\n\n${USAGE}`);
  process.exit(2);
}
if (query.subsys && query.doc) {
  console.error(`--subsys 與 --doc 不能同時使用(--doc 的輸出已經帶出該文檔所屬的子系統)\n\n${USAGE}`);
  process.exit(2);
}

const designDir = designDirArg ?? "./.design";
const DONE_STATUSES = new Set(["done", "closed"]);
/** 決定不做:既不算完成,也不佔分母(v2 取代 v1 的 closed) */
const DROPPED_STATUSES = new Set(["dropped"]);
/**
 * `## 契約` 的欄位。少一欄就是「還不能被無訪談委派」(contract-readiness.md A2)。
 * 第一行是分類的證據(核心 / 非核心判準,doc-lifecycle.md「六種分類與分流判準」);
 * 子系統 F/E 六欄,跨子系統 G-F/G-E 換成分工表與端到端介面。
 */
const CONTRACT_FIELDS = ["階段", "負責模組", "實作的 Level 2 介面", "資料流管線段落", "驗收標準", "明確不做"];
const GLOBAL_CONTRACT_FIELDS = ["端到端介面", "驗收標準", "明確不做"];
const CRITERION = { feature: "核心判準", enhance: "非核心判準" };
/** 佔位字樣:填了等於沒填 */
const PLACEHOLDER = /^(TODO|TBD|待定|待補|-|\?+)\b/i;
/** 骨架留下的 `<…>` 佔位還在 = 沒填 */
const TEMPLATE_HOLE = /<[^<>]{1,60}>/;

/** `## 契約` 裡哪幾欄還沒有實質內容 */
function contractGaps(text, type, isGlobal) {
  const fields = [CRITERION[type] ?? "核心判準", ...(isGlobal ? GLOBAL_CONTRACT_FIELDS : CONTRACT_FIELDS)];
  const sec = section(text, /^契約$/);
  if (!sec) return isGlobal ? [...fields, "分工表"] : fields;
  const gaps = fields.filter((f) => {
    const m = sec.text.match(new RegExp(`^-\\s+\\*\\*${f}\\*\\*[::]\\s*(.*)$`, "m"));
    const v = m ? m[1].trim() : "";
    return !m || !v || PLACEHOLDER.test(v) || TEMPLATE_HOLE.test(v);
  });
  if (isGlobal && parseAssignments(text).length === 0) gaps.push("分工表");
  return gaps;
}

/**
 * G-F / G-E `## 契約` 的分工表:| 子系統 | 負責的段 | 承接的 feature |。
 * 回傳 [{ subsystem, part, ref }];ref 是承接 F 的全名或 `<slug>/F00x`。分工表是權威,子 F 的 part-of 是索引。
 */
function parseAssignments(text) {
  const sec = section(text, /^契約$/);
  if (!sec) return [];
  const out = [];
  let header = null;
  for (const line of sec.body.split(/\r?\n/)) {
    const cells = dataCells(line.trim());
    if (!cells) { if (!isTableRowLike(line)) header = null; continue; }
    if (!header) {
      header = cells.map((c) => c.replace(/[*`_]/g, "").trim());
      continue;
    }
    const iS = header.findIndex((c) => /子系統/.test(c));
    const iF = header.findIndex((c) => /feature|功能/i.test(c));
    if (iS < 0 || iF < 0) continue;
    const ref = String(cells[iF] ?? "").replace(/[`*]/g, "").trim();
    const sub = String(cells[iS] ?? "").replace(/[`*]/g, "").trim();
    if (!sub || !ref || /^<.+>$/.test(ref) || /^<.+>$/.test(sub)) continue;
    out.push({ subsystem: sub, part: String(cells[1] ?? "").trim(), ref });
  }
  return out;
}
const isTableRowLike = (line) => /^\s*\|/.test(line);

/**
 * `## 修訂記錄` 的 REV 條目:{ count, last: { n, date, touches: [law id], linked: [文字] } | null }。
 * 一輪一條 `- REV-n(YYYY-MM-DD,依 …):…`,子彈點「動到」列 law / 介面,「連動」列同步過的下游。
 * rev 欄只是 count 的快取;兩者對不上就是不一致(doc-lifecycle.md「修訂(rev 與 REV)」)。
 */
function parseRevisions(text) {
  const sec = section(text, /^修訂記錄/);
  if (!sec) return { count: 0, last: null };
  const lines = sec.body.split(/\r?\n/);
  const entries = [];
  for (const line of lines) {
    const m = line.match(/^[ \t]*[-*][ \t]*[*`_]{0,2}REV-(\d+)[*`_]{0,2}[ \t]*[((]\s*(\d{4}-\d{2}-\d{2})?/);
    if (m) entries.push({ n: Number(m[1]), date: m[2] ?? null, touches: [], linked: [] });
    else if (entries.length) {
      const cur = entries[entries.length - 1];
      const sub = line.match(/^[ \t]+[-*][ \t]*[*`_]{0,2}(動到|連動)[*`_]{0,2}[ \t]*[::][ \t]*(.*)$/);
      if (!sub) continue;
      if (sub[1] === "動到") cur.touches.push(...[...sub[2].matchAll(/\b(LAW|REG)-(\d+)\b/g)].map((x) => `${x[1]}-${x[2]}`));
      else cur.linked.push(sub[2]);
    }
  }
  const last = entries.length ? entries.reduce((a, b) => (b.n >= a.n ? b : a)) : null;
  return { count: entries.length, last };
}
/** Laws 一節裡定義了哪些 LAW-/REG- 編號 */
function lawIdsIn(text) {
  const sec = section(text, /^Laws/);
  const out = new Set();
  if (!sec) return out;
  for (const m of sec.body.matchAll(/(?:^|\n)[ \t]*[-*][ \t]*[*`_]{0,2}(LAW|REG)-(\d+)/g)) out.add(`${m[1]}-${m[2]}`);
  return out;
}
/** 介面 / 數據表有幾列資料(不含表頭與分隔列)—— 「規格寫到幾成」的介面數 */
function countTableRows(body) {
  let n = 0;
  let header = true;
  for (const line of String(body ?? "").split(/\r?\n/)) {
    const cells = dataCells(line);
    if (!cells) continue;
    if (header) { header = false; continue; }
    n++;
  }
  return n;
}
const DESC_WIDTH = 44; // 主軸(description)欄顯示寬度上限(全形字算 2)

// 各資料夾的檔名規則與預期 type
const TASK_KINDS = {
  features: { pattern: /^(F\d{3})-[a-z0-9-]+\.md$/, type: "feature" },
  enhancements: { pattern: /^(E\d{3})-[a-z0-9-]+\.md$/, type: "enhance" },
  bugfixes: { pattern: /^(B\d{3})-[a-z0-9-]+\.md$/, type: "bugfix" },
};
const GLOBAL_KINDS = {
  features: { pattern: /^(G-F\d{3})-[a-z0-9-]+\.md$/, type: "feature", example: "G-F001" },
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

const rows = []; // { description, id, subsystem, type, status, created, dependsOn(raw list), codePaths, file }

function scanTaskDoc(path, subsystem, kind) {
  // v2 的狀態前兩格由**內文**決定(有沒有 `## Laws`),所以這裡要整份讀,不能只讀 frontmatter
  const text = readFileSync(path, "utf8");
  const { meta, blockListKeys } = parseFrontmatter(text);
  const relPath = rel(path);
  if (blockListKeys.length) badFormat.push({ file: relPath, keys: blockListKeys });
  const fileName = path.split(/[\\/]/).pop();
  const fileId = fileName.match(/^(G-[CFEB]\d{3}|[FEB]\d{3})/)?.[1] ?? null;
  // 檔名 slug:全名 `auth/F002-token-refresh` 的最後一段。裸 id 指不到東西(每個子系統各有一組 F001),
  // 所以印給人看的每一行都用全名,不用 id(conventions.md「指稱紀律」)。
  const fileSlug = fileName.replace(/\.md$/, "").replace(/^(?:G-[CFEB]\d{3}|[FEB]\d{3})-?/, "");
  const metaId = fmtValue(meta?.id);
  if (meta && fileId && metaId !== "-" && metaId !== fileId)
    archIssues.push(`${relPath}:frontmatter id(${metaId})與檔名編號(${fileId})不一致`);
  if (meta && meta.type && meta.type !== kind.type)
    archIssues.push(`${relPath}:type(${meta.type})與所在資料夾預期(${kind.type})不一致`);
  const row = {
    description: meta?.description ? truncate(meta.description, DESC_WIDTH) : "-",
    id: metaId !== "-" ? metaId : fileId ?? "-",
    slug: fileSlug,
    subsystem: subsystem ?? "global",
    type: meta?.type || kind.type,
    status: !meta || !meta.status ? "⚠ missing-metadata" : String(meta.status),
    created: fmtValue(meta?.created),
    updated: fmtValue(meta?.updated),
    dependsOn: asList(meta?.["depends-on"]),
    affects: asList(meta?.subsystems),
    codePaths: asList(meta?.["code-paths"]),
    stage: fmtValue(meta?.stage),
    modules: asList(meta?.modules),
    group: meta?.group ? String(meta.group) : "",
    rev: meta?.rev === undefined || meta?.rev === null || String(meta.rev).trim() === "" ? null : Number(meta.rev),
    partOf: asList(meta?.["part-of"]),
    revisions: parseRevisions(text),
    lawIds: lawIdsIn(text),
    contractRefs: contractRefsIn(text),
    assignments: subsystem ? [] : parseAssignments(text),
    hasLaws: /^##\s+Laws/m.test(text),
    citedSpikes: [...new Set([...text.matchAll(/\bSPK-(\d{3})\b/g)].map((x) => `SPK-${x[1]}`))],
    hasContract: /^##\s+契約\s*$/m.test(text),
    contractGaps: contractGaps(text, meta?.type || kind.type, !subsystem),
    relatedAdr: asList(meta?.["related-adr"]),
    // 規格寫到幾成:唯一計數器在 _counts.mjs(與 id-map.mjs 共用)
    laws: countIds(section(text, /^Laws/)?.body, "LAW", "REG", "L", "R"),
    examples: countIds(section(text, /^Examples/)?.body, "EX", "E"),
    ifaces: countTableRows(section(text, /^介面$|^數據$|數據與介面變動/)?.body),
    asm: countRulings(section(text, /待確認假設/)?.body),
    file: relPath,
  };
  // 收尾漏回寫 code-paths:程式碼寫好了、狀態也回了,只有「這是誰做的」這一格沒填 ——
  // 沒有這一條提示,--file 反查會安靜地少掉這份文檔,而少掉的那一份看起來就像「不存在」。
  // 列為提示不列為不一致:舊專案的既有文檔本來就沒有這一欄,不該讓它們把 exit code 變成 1。
  if (DONE_STATUSES.has(row.status) && row.codePaths.length === 0)
    archNotes.push(`${relPath}:status 是 ${row.status},但 code-paths 是空的(收尾漏回寫 —— --file 反查看不到這份文檔)`);
  rows.push(row);
  return row;
}

// 子系統
const subsysRoot = join(designDir, "subsystems");
const subsysDirs = listDirs(subsysRoot);
const subsysDocs = new Map(); // slug → { designMeta, designFile, groups, parts, ids: Map(id → row) }

/** 子系統資料夾根層的固定檔案;其餘 .md 只能是 design.md 的分冊。 */
const SUBSYS_CORE_FILES = new Set(["design.md", "build-log.md", "spec-gaps.md"]);
/** 分冊的合法 type(doc-lifecycle.md「子系統文檔的分冊」是權威,改這裡之前先改那份)。 */
const PART_TYPES = new Set(["contract-part", "decisions"]);

for (const slug of subsysDirs) {
  const dir = join(subsysRoot, slug);
  const entry = { designMeta: null, designFile: null, groups: [], parts: [], ids: new Map() };
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
    entry.groups = parseGroups(text);
  }

  // ---- design.md 的分冊:契約章節太大時拆出去的檔案(type: contract-part / decisions)
  // 它們沒有編號、由 `parent` 指回子系統。不認得它們的話,子系統契約有一半是隱形的 ——
  // A3 的契約對帳、/subsys 的契約檢查都會在 design.md 裡找不到條目而誤判「契約缺漏」。
  for (const f of listMd(dir)) {
    if (SUBSYS_CORE_FILES.has(f)) continue;
    const p = join(dir, f);
    const relP = rel(p);
    const { meta } = parseFrontmatter(readFileSync(p, "utf8"));
    if (!meta || !PART_TYPES.has(String(meta.type))) {
      archIssues.push(
        `${relP}:子系統資料夾下的檔案不在慣例內 —— 是 design.md 的分冊就補 frontmatter` +
          `(type: contract-part 或 decisions、parent: ${slug}),否則搬到 features/ 或 enhancements/ 並鑄號`,
      );
      continue;
    }
    if (meta.parent !== slug) archIssues.push(`${relP}:parent(${meta.parent ?? "缺"})與所在子系統(${slug})不一致`);
    entry.parts.push({ file: relP, type: String(meta.type), description: meta.description ?? "" });
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
      slug: name.replace(/\.md$/, "").replace(/^G-C\d{3}-?/, ""),
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
const adrNames = new Map(); // id → `ADR-001-<slug>`
const adrCounts = {};
for (const name of listMd(join(designDir, "adr"))) {
  const path = join(designDir, "adr", name);
  const m = name.match(ADR_PATTERN);
  if (!m) archNotes.push(`${rel(path)}:檔名不符 ADR 命名規則(如 ADR-001-slug.md)`);
  const { meta, blockListKeys } = readFrontmatter(path);
  if (blockListKeys.length) badFormat.push({ file: rel(path), keys: blockListKeys });
  const id = fmtValue(meta?.id) !== "-" ? String(meta.id) : m?.[1] ?? name.replace(/\.md$/, "");
  adrIds.add(id);
  adrNames.set(id, name.replace(/\.md$/, "")); // 全名 `ADR-001-jwt`:印給人看時帶 slug
  if (!meta?.description) archIssues.push(`${rel(path)}:缺 description / 主軸`);
  const st = meta?.status ? String(meta.status) : "missing-status";
  adrCounts[st] = (adrCounts[st] ?? 0) + 1;
}

// ---------------------------------------------------------------- spike

/**
 * spike 不是任務文檔:它替某個決定生產證據,不進任何百分比。但 `open` 的 spike 是一個
 * 還沒答完的問題,它的下游決定(ADR、契約、feature 的不可逆決定)正在等 —— 所以列出來、計入
 * exit code。`concluded` 而 `feeds` 空的是**結論沒有下游**,列為不一致:沒有人會去讀一份
 * 沒有指向任何決定的驗證紀錄,它跟沒寫一樣。文檔與 spike/ 資料夾成不成對、產品程式碼有沒有
 * import 它,是 lint-spikes.mjs 的事(要掃專案樹,本腳本只看 .design/)。
 */
const SPIKE_PATTERN = /^(SPK-\d{3})-([a-z0-9-]+)\.md$/;
const SPIKE_STATUSES = new Set(["open", "concluded", "dropped"]);
const SPIKE_VERDICTS = new Set(["feasible", "infeasible", "partial"]);
const spikes = []; // { id, slug, description, status, verdict, feeds, affects, question, file }
for (const name of listMd(join(designDir, "spikes"))) {
  const path = join(designDir, "spikes", name);
  const relPath = rel(path);
  const m = name.match(SPIKE_PATTERN);
  if (!m) archNotes.push(`${relPath}:檔名不符 spike 命名規則(如 SPK-001-slug.md)`);
  const text = readFileSync(path, "utf8");
  const { meta, blockListKeys } = parseFrontmatter(text);
  if (blockListKeys.length) badFormat.push({ file: relPath, keys: blockListKeys });
  const fileId = m?.[1] ?? null;
  const metaId = fmtValue(meta?.id);
  if (meta && fileId && metaId !== "-" && metaId !== fileId)
    archIssues.push(`${relPath}:frontmatter id(${metaId})與檔名編號(${fileId})不一致`);
  if (meta && meta.type && meta.type !== "spike") archIssues.push(`${relPath}:type(${meta.type})應為 spike`);
  if (!meta?.description) archIssues.push(`${relPath}:缺 description / 主軸`);
  const status = meta?.status ? String(meta.status) : "⚠ missing-metadata";
  if (meta?.status && !SPIKE_STATUSES.has(status))
    archIssues.push(`${relPath}:status(${status})不在 open / concluded / dropped 之內`);
  const verdict = fmtValue(meta?.verdict);
  const feeds = asList(meta?.feeds);
  if (status === "concluded") {
    if (verdict === "-" || !SPIKE_VERDICTS.has(verdict))
      archIssues.push(`${relPath}:status 是 concluded 但 verdict(${verdict})不在 feasible / infeasible / partial 之內`);
    if (feeds.length === 0)
      archIssues.push(`${relPath}:status 是 concluded 但 feeds 是空的 —— 結論沒有下游,沒有任何決定會讀到這份驗證`);
  }
  for (const cp of asList(meta?.["code-paths"]))
    if (!/^spike\//.test(cp)) archIssues.push(`${relPath}:code-paths 的 ${cp} 不在 spike/ 底下 —— spike 程式碼只准住在那裡`);
  const id = metaId !== "-" ? metaId : fileId ?? name.replace(/\.md$/, "");
  const question = (text.match(/^-\s*\*\*要回答什麼\*\*\s*[::]\s*(.+)$/m)?.[1] ?? "").trim();
  spikes.push({
    id,
    slug: m?.[2] ?? name.replace(/\.md$/, ""),
    description: meta?.description ? truncate(meta.description, DESC_WIDTH) : "-",
    status,
    verdict,
    feeds,
    affects: asList(meta?.subsystems),
    updated: fmtValue(meta?.updated),
    question: question && !/^<.+>$/.test(question) ? question : "",
    file: relPath,
  });
}
const spikeName = (sp) => `${sp.id}-${sp.slug}`;
/** 一份 spike 的 feeds 有沒有指到某份文檔:吃 `auth/F002`、`auth/F002-token-refresh`、`G-E001-cache`、`G-C001-session#Token` */
const feedKey = (f) => {
  const m = f.split("#")[0].match(/^((?:[a-z0-9-]+\/)?)(G-[CFEB]\d{3}|ADR-\d{3}|SPK-\d{3}|[FEB]\d{3})(?:-[a-z0-9-]+)?$/);
  return m ? `${m[1]}${m[2]}` : f.split("#")[0];
};
const spikeFeeds = (sp, subsystem, id) =>
  sp.feeds.some((f) => {
    const k = feedKey(f);
    return k === `${subsystem}/${id}` || k === id;
  });
const spikeLine = (sp) =>
  `- ${spikeName(sp)}  [${sp.status}${sp.verdict !== "-" ? ` · ${sp.verdict}` : ""}]  ${sp.description}  ${sp.file}` +
  (sp.question ? `\n    要回答:${sp.question}` : "") +
  (sp.feeds.length ? `\n    餵給:${sp.feeds.join("、")}` : "");
const openSpikes = spikes.filter((sp) => sp.status === "open" || sp.status === "⚠ missing-metadata");

// ---------------------------------------------------------------- spec-gaps

/**
 * 解析 spec-gaps.md:每個條目是 `## GAP-<n>(<來源> / <角色>)`(舊制 `## G<n>` 照收),
 * 底下有一行 `- 狀態:open|resolved`,resolved 的另有一行 `- 修訂:<文檔 id> §<章節>(<日期>);<改了什麼>`。
 * 未結(open)的條目代表有項目正卡著等 spec 修訂,列進輸出並影響 exit code;
 * resolved 的條目改查「結案有沒有證據」(修訂行、指得到的文檔、updated 有沒有跟上)。
 *
 * 格式本身由 `_gap-status.mjs` 認(**唯一**解析器,`id-map.mjs` 用的是同一支),
 * 它認不出來的寫法一律進 `archIssues`:讀不到狀態就默默當 `open`,錯的只有
 * 「已經結案卻一直被算成未結」那幾條會現形,真的還 open 的條目寫錯了看起來完全正常 ——
 * 於是格式漂移的實際發生率永遠比看得到的高。不出聲的檢查等於沒有檢查。
 */
function parseSpecGaps(path, scope) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const file = rel(path);
  // 條目本身沒有日期,「停了多久」只能精確到檔案級:取 spec-gaps.md 的 updated
  const fileUpdated = fmtValue(parseFrontmatter(text).meta?.updated);
  const out = [];
  for (const g of parseGapBlocks(text)) {
    for (const issue of g.issues) archIssues.push(`${file}:${issue}`);
    out.push({ scope, file, fileUpdated, id: g.id, head: g.head, topic: g.topic, fix: g.fix, resolved: g.resolved });
  }
  return out;
}

const allGaps = [];
for (const slug of subsysDirs) allGaps.push(...parseSpecGaps(join(subsysRoot, slug, "spec-gaps.md"), slug));
allGaps.push(...parseSpecGaps(join(designDir, "spec-gaps.md"), "global"));
const openGaps = allGaps.filter((g) => !g.resolved);

/**
 * 未結 gap 標回它卡住的那一份文檔。
 *
 * 進度與阻塞是**兩個正交的維度**:`status` 累加式地往前走(open → in-progress → done),
 * gap 則是從**任何一格**都會發射的中斷 —— qa 寫不出斷言時撞到、impl 發現非改簽名不可時撞到。
 * 把它印在獨立區塊,讀的人要自己把兩張表交叉比對才知道某一行的 `in-progress`
 * 究竟是「正在做」還是「卡死等 spec 修訂」,而那兩件事的下一步完全相反。
 *
 * 這裡不新增任何 frontmatter 欄位:gap 的歸屬本來就寫在條目標題 `## GAP-1(auth/F002-token-refresh / qa)` 裡,
 * 腳本也早就在解析 `spec-gaps.md`,只是沒把兩邊接起來。
 */
const gapDocRef = (head) => head.match(/\b(G-[CFEB]\d{3}|[FEB]\d{3})\b/)?.[1] ?? null;
/** 標題括號裡的角色:`## GAP-1(auth/F002-token-refresh / qa)` → `qa` */
const gapRole = (head) => head.match(/[((]([^)）]*)[)）]/)?.[1]?.split(/[/／]/).pop()?.trim() ?? "";
const blockedBy = new Map(); // docKey → [gap id]
for (const g of openGaps) {
  const docId = gapDocRef(g.head);
  if (!docId) {
    archNotes.push(
      `${g.file}:${g.id} 的標題沒寫這條 gap 卡住哪份文檔` +
        `(格式:\`## ${g.id}(auth/F002-token-refresh / qa)\`)—— ${g.scope}/${g.id} 不會被標到任何 feature 上`,
    );
    continue;
  }
  const k = g.scope === "global" ? docId : `${g.scope}/${docId}`;
  if (!blockedBy.has(k)) blockedBy.set(k, []);
  blockedBy.get(k).push(g.id);
}
for (const r of rows) {
  const k = r.subsystem === "global" ? r.id : `${r.subsystem}/${r.id}`;
  r.blockedBy = blockedBy.get(k) ?? [];
}
for (const [k, ids] of blockedBy) {
  if (!rows.some((r) => (r.subsystem === "global" ? r.id : `${r.subsystem}/${r.id}`) === k))
    archNotes.push(`spec-gaps:${ids.join("、")} 的標題指向 ${k},但 .design/ 裡找不到這份文檔(標題裡的 id 打錯,或文檔被搬走了)`);
}

/**
 * 阻塞旗標:接在 status 後面印。沒有未結 gap 就是空字串,不佔版面。
 * 條目一律帶擁有它的 `spec-gaps.md` 是哪一個子系統的(`auth/GAP-1`)—— 每個子系統各有一份
 * `spec-gaps.md`,各自從 GAP-1 起算,裸寫 `GAP-1` 指不到任何一條。
 */
const gapFlag = (r) => (r.blockedBy?.length ? ` ⚠卡${r.blockedBy.map((g) => `${r.subsystem}/${g}`).join(",")}` : "");

// 結案就刪(spec-roles.md「spec-gaps 協議」):spec-gaps.md 只裝 open 的條目,結案 = 寫 REV 並刪條目。
// 還留著 resolved 的是墓碑 —— 證據已由那份 spec 的 REV 承接,留著只是干擾。列提示不列不一致:
// 舊專案清一次(migrate-v3.mjs --apply)就好,不該讓它們的 exit code 變成 1。
for (const g of allGaps.filter((x) => x.resolved))
  archNotes.push(`${g.file}:${g.id} 標了 resolved 還留在檔上 —— 結案就刪(證據在被修訂那份 spec 的 REV「依」欄),migrate-v3.mjs --apply 可一次清掉`);
{
  const files = new Map();
  for (const g of allGaps) files.set(g.file, (files.get(g.file) ?? 0) + (g.resolved ? 0 : 1));
  for (const [file, open] of files) if (open === 0) archNotes.push(`${file}:沒有任何 open 的條目 —— 這個檔只裝未結的 gap,空了就刪檔`);
}

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
/**
 * 專案模式(`boundary-rules.md`「專案模式」):`greenfield` = 全新建立,`brownfield` = 維護型。
 * 這一欄決定**整類問題該不該問**(migration / 向後相容),所以缺了不能默默跳過:
 * 沒有它,每一場對話都得重新猜一次,而猜錯的人不會知道自己猜錯。
 * 列為提示不列為不一致:舊專案的 system.md 本來就沒有這一欄,不該讓它們的 exit code 變成 1。
 */
const MODES = new Set(["greenfield", "brownfield"]);
const projectMode = systemMeta ? String(systemMeta.mode ?? "").trim() : "";
if (systemMeta && !projectMode)
  archNotes.push("system.md:缺 mode 欄(greenfield 全新建立 / brownfield 維護型)——問開發者一次再回寫,不要自己假設(boundary-rules.md「專案模式」)");
else if (systemMeta && projectMode && !MODES.has(projectMode))
  archIssues.push(`system.md:mode 的值「${projectMode}」不合法,只能是 greenfield(全新建立)或 brownfield(維護型)`);

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
const unbuiltSetEarly = new Set(plannedSubsys);
const stages = systemText ? parseStages(systemText, roster) : [];
/** 開發階段講給人聽時帶名稱:`S1(帳務上線)`;名稱與 id 相同(表格沒填名稱)時只印 id */
const stageName = (st) => (st.title && st.title !== st.id ? `${st.id}(${st.title})` : st.id);
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

/** 標準化名稱:去掉 markdown 強調符號與前後空白,讓表格與 frontmatter 的值對得上 */
function normName(s) {
  return String(s).replace(/[`*_]/g, "").trim();
}

/** 表頭一列正規化成比對用的鍵(去空白、轉小寫)——欄位靠名字認,不靠位置 */
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
    const cells = dataCells(line);
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
    const cells = dataCells(line);
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
      // slug 本身是 kebab-case,不能拿 `-` 當切分字元(magic-farmer 會被切成 magic)。
      // 改成「名冊 slug 出現在標題開頭,後面接結尾/空白/破折號」,多個命中時取最長的。
      const name = normName(heading[2]).toLowerCase();
      cur =
        roster
          .filter((r) => name === r || new RegExp(`^${r}(?:[\\s—–]|-\\s)`).test(name))
          .sort((a, b) => b.length - a.length)[0] ?? null;
      continue;
    }
    if (!inSection || !cur || briefs.has(cur)) continue;
    const m = line.match(/^-\s+\*\*職責\*\*[::]\s*(.+)$/);
    if (m) briefs.set(cur, normName(m[1]));
  }
  return briefs;
}

const subsysRows = [];
const featureIndex = new Map(); // slug → 生成「功能總覽」用的資料
const pendingFeatures = []; // status: planned —— 有編號與契約、還沒寫 spec 的 feature
const noGroupTable = []; // 沒有「模組群」表的子系統(只有一個領域時屬正常,合併成一條提示)

for (const slug of subsysDirs) {
  const entry = subsysDocs.get(slug);
  const meta = entry.designMeta;

  // v2:分母就是 features/ 底下的檔案。沒有路線圖的一列、沒有 doc 欄,所以「表上有列卻沒建檔」
  // 與「建了檔卻沒被認領」這兩種 v1 專屬的對不上狀態,在這裡不可能發生。
  const feats = [...entry.ids.values()].filter((r) => r.type === "feature" && !DROPPED_STATUSES.has(r.status));
  const exts = [...entry.ids.values()].filter((r) => r.type === "enhance" && !DROPPED_STATUSES.has(r.status));
  const done = feats.filter((r) => DONE_STATUSES.has(r.status)).length;
  const extDone = exts.filter((r) => DONE_STATUSES.has(r.status)).length;
  const plannedFeats = [...feats, ...exts].filter((r) => r.status === "planned");
  for (const r of plannedFeats) pendingFeatures.push({ subsystem: slug, ...r });

  // 狀態與內容對帳:planned / specced 兩格由內文決定,說謊抓得到;done 只能明寫,所以更要查。
  // F 與 E 走同一條漏斗(doc-lifecycle.md「六種分類與分流判準」);2.2.1 之前的 E 沒有契約,
  // 那是舊格式(優化既有功能的產物),列為提示並指向遷移,不當成紅燈。
  for (const r of [...feats, ...exts]) {
    if (!r.hasContract) {
      if (r.type === "feature" || r.status === "planned")
        archIssues.push(`${r.file}:沒有「## 契約」—— Level 2 的邊界沒有落地(/subsys-design 建檔當下就該寫)`);
      else
        archNotes.push(`${r.file}:E 沒有「## 契約」—— 無法分類;用 migrate-v3.mjs 分流:它改的是既有 F 就摺回那份 F 成一條 REV,是可獨立拿掉的能力就補契約留作擴充功能`);
    }
    if (r.status === "planned" && r.hasLaws)
      archIssues.push(`${r.file}:status 是 planned,卻已經有「## Laws」(規格寫過了,狀態沒跟上)`);
    if (r.status !== "planned" && !r.hasLaws)
      archIssues.push(`${r.file}:status 是 ${r.status},卻沒有「## Laws」(規格還沒寫,或章節被改名)`);
  }
  // E 不准被任何 F 依賴:F 依賴 E 就代表 E 其實是核心(分類錯了)
  for (const r of feats)
    for (const ref of r.dependsOn) {
      const k = refKey(ref, slug);
      const [sub, id] = k.includes("/") ? k.split("/") : [slug, k];
      if (/^E\d{3}$/.test(id) && subsysDocs.get(sub)?.ids.has(id))
        archIssues.push(`${r.file}:核心功能依賴了擴充功能 ${sub}/${id} —— 拿掉 E 這份 F 就動不了,那 E 其實是核心,回 /subsys-design 重分類`);
    }

  // 契約就緒度:planned 的檔契約填滿才委派得動。分母只算 planned(F 與 E 都算)——
  // specced / done 早就走完那道門了,再判一次只會製造雜訊(contract-readiness.md A2)。
  const carded = plannedFeats.filter((r) => r.contractGaps.length === 0).length;
  for (const r of plannedFeats) {
    if (r.contractGaps.length)
      archNotes.push(`${r.file}:「## 契約」還缺 ${r.contractGaps.join("、")}(該項無法委派展開)`);
  }
  // 核心判準是分類的證據:specced / done 的 F/E 也要有(planned 的已經在上面的契約缺欄裡)
  for (const r of [...feats, ...exts].filter((x) => x.status !== "planned" && x.hasContract && x.contractGaps.includes(CRITERION[x.type])))
    archNotes.push(`${r.file}:「## 契約」缺「${CRITERION[r.type]}」—— 分類的證據要寫在檔上(contract-readiness.md A10;缺這一行的 F 分不出是不是真的核心)`);

  const openE = exts.length - extDone;
  const openB = [...entry.ids.values()].filter((r) => r.type === "bugfix" && !DONE_STATUSES.has(r.status)).length;

  const total = feats.length;
  if (entry.designFile && total === 0)
    archNotes.push(`${entry.designFile}:features/ 底下一份文檔都沒有,無法估算子系統進度(用 /subsys-design 規劃並建檔)`);

  // ---- 模組群:子系統內部的領域劃分。planned 的那幾群沒有 feature,不能被算成「這個子系統做完了」
  const groups = entry.groups;
  const activeGroups = groups.filter((g) => g.status === "active");
  const plannedGroups = groups.filter((g) => g.status === "planned");
  const groupNames = new Set(groups.map((g) => g.name.toLowerCase()));
  const featuresOf = (name) => feats.filter((r) => r.group.toLowerCase() === name.toLowerCase());
  for (const g of groups) {
    const fs = featuresOf(g.name);
    g.total = fs.length;
    g.done = fs.filter((r) => DONE_STATUSES.has(r.status)).length;
    g.subsystem = slug;
  }
  if (groups.length > 0) {
    // 只有一個模組群時,feature 檔可以不填 group:整個子系統就是那一群
    if (groups.length === 1 && groups[0].total === 0) {
      groups[0].total = total;
      groups[0].done = done;
    }
    for (const r of feats) {
      if (r.group && !groupNames.has(r.group.toLowerCase()))
        archIssues.push(`${r.file}:frontmatter 的 group「${r.group}」不在 ${slug}/design.md 的「模組群」表裡`);
    }
    if (groups.length > 1) {
      const ungrouped = feats.filter((r) => !r.group);
      if (ungrouped.length > 0)
        archIssues.push(
          `${entry.designFile}:有 ${groups.length} 個模組群,但 ${ungrouped.length} 份 feature 檔沒填 frontmatter 的 group` +
            `(${ungrouped.map((r) => rowName(r)).join("、")})——分不清楚它們算哪一群的進度`,
        );
    }
    for (const g of plannedGroups)
      archNotes.push(
        `${entry.designFile}:模組群 ${slug}/${g.name} 還是 planned(契約章節未寫、feature 檔未建)` +
          `${g.brief ? `——${g.brief}` : ""};${slug}/${g.name} 不在 ${slug} 子系統的進度分母裡`,
      );
    for (const g of activeGroups) {
      if (g.total === 0)
        archIssues.push(`${entry.designFile}:模組群「${g.name}」標 active,但沒有任何 feature 檔掛在它底下(標錯狀態,或漏建檔)`);
    }
  } else if (entry.designFile && total > 0) {
    noGroupTable.push(slug);
  }

  featureIndex.set(slug, { designFile: entry.designFile, feats: [...entry.ids.values()].filter((r) => r.type === "feature") });

  subsysRows.push({
    description: meta?.description ? truncate(meta.description, DESC_WIDTH) : "-",
    id: slug,
    status: !meta || !meta.status ? "⚠ missing-metadata" : String(meta.status),
    groups: groups.length === 0 ? "-" : `${activeGroups.length}/${groups.length}`,
    phases: total === 0 ? "-" : String(new Set(feats.map((r) => r.stage).filter((x) => x && x !== "-")).size || 1),
    features: total === 0 ? "-" : String(total),
    cards: plannedFeats.length === 0 ? "-" : `${carded}/${plannedFeats.length}`,
    onlyPlanned: total === 0 ? "-" : String(feats.filter((r) => r.status === "planned").length),
    specced: total === 0 ? "-" : String(feats.filter((r) => r.status === "specced").length),
    done: total === 0 ? "-" : String(done),
    openB: String(openB),
    exts: exts.length === 0 ? "-" : String(exts.length),
    progress: total === 0 ? "-" : `${done}/${total} (${Math.round((done / total) * 100)}%)`,
    ext: exts.length === 0 ? "-" : `${extDone}/${exts.length}`,
    extOpen: openE,
    parts: entry.parts,
    hasFeatures: total > 0,
    built: true,
    groupRows: groups,
    plannedGroups: plannedGroups.length,
    // 「可運作」只看核心:每一份 F 都 done,而且**沒有還沒開工的模組群**(E 不進這個分母,也不擋階段)
    runnable: total > 0 && done === total && plannedGroups.length === 0,
    // 「全部完成」再加上 E 全 done、沒有未結 B
    complete: total > 0 && done === total && openE === 0 && openB === 0 && plannedGroups.length === 0,
  });
}

if (noGroupTable.length > 0)
  archNotes.push(
    `沒有「模組群」表的子系統:${noGroupTable.join("、")}。只有一個領域時屬正常;` +
      `子系統內有多個平行領域、而其中幾個還沒開工時,不寫這張表會讓進度只算得到已落地的那一群`,
  );

// build-log 只活在委派期間:F / E 全 done、沒有 gap、沒有待裁 ASM 而它還在 = 收線漏刪(doc-lifecycle.md「done 的收束」)
for (const s of subsysRows.filter((x) => x.built && x.complete)) {
  if (!existsSync(join(subsysRoot, s.id, "build-log.md"))) continue;
  const asmLeft = [...(subsysDocs.get(s.id)?.ids.values() ?? [])].some((r) => r.asm.total > 0);
  const gapsLeft = existsSync(join(subsysRoot, s.id, "spec-gaps.md"));
  if (!asmLeft && !gapsLeft) archNotes.push(`subsystems/${s.id}/build-log.md:委派已收線(F / E 全 done、沒有 gap、沒有待裁 ASM)但檔還在 —— 它只活在委派期間,收線就刪(migrate-v3.mjs --apply 可代刪)`);
}
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
    openB: "-",
    exts: "-",
    progress: "未展開",
    ext: "-",
    extOpen: 0,
    onlyPlanned: "-",
    hasFeatures: false,
    built: false,
    groupRows: [],
    plannedGroups: 0,
    runnable: false,
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
    // 同子系統寫成裸 id:解析得到,但這一欄會被印進別的子系統的反向依賴清單,
    // 到了那裡就沒有「所在檔案」這個上下文,`F001` 指不到任何東西(doc-lifecycle.md「文檔引用格式」)。
    if (r.subsystem !== "global" && !ref.includes("/") && !/^(G-|ADR-)/.test(ref) && resolveRef(ref, r.subsystem))
      archNotes.push(`${r.file}:depends-on 的 ${ref} 寫成裸 id —— 改寫成 ${r.subsystem}/${ref}(同一個子系統內部也要帶前綴)`);
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

// ---------------------------------------------------------------- G-F 分工表、rev / REV、契約縮窄(對帳)

/** 全名或 `<slug>/F00x` → row;解析不到回 null */
function rowByRef(ref, contextSubsys = null) {
  const bare = String(ref).split("#")[0].replace(/^((?:[a-z0-9-]+\/)?(?:G-[FEB]\d{3}|[FEB]\d{3}))-[a-z0-9-]+$/, "$1");
  if (globalIds.has(bare)) return globalIds.get(bare);
  const [slug, id] = bare.includes("/") ? bare.split("/") : [contextSubsys, bare];
  return slug ? subsysDocs.get(slug)?.ids.get(id) ?? null : null;
}
const globalFeatures = rows.filter((r) => r.subsystem === "global" && (r.type === "feature" || r.type === "enhance"));
/** G-F 全名 → 它分工表指到的 rows */
const assignedRows = new Map();
for (const g of globalFeatures) {
  if (g.hasContract && g.status === "planned" && g.contractGaps.length)
    archNotes.push(`${g.file}:「## 契約」還缺 ${g.contractGaps.join("、")}(該項無法展開)`);
  if (!g.hasContract) {
    if (g.type === "feature" || g.status === "planned")
      archIssues.push(`${g.file}:沒有「## 契約」(核心判準與分工表都住在那一節)`);
    else archNotes.push(`${g.file}:G-E 沒有「## 契約」—— 無法分類;用 migrate-v3.mjs 分流:摺回原 F 成 REV,或補契約留作跨子系統擴充功能`);
  }
  if (g.status === "planned" && g.hasLaws) archIssues.push(`${g.file}:status 是 planned,卻已經有「## Laws」`);
  if (g.status !== "planned" && !g.hasLaws && g.hasContract) archIssues.push(`${g.file}:status 是 ${g.status},卻沒有「## Laws」`);
  if (g.type === "feature" && (!g.stage || g.stage === "-"))
    archNotes.push(`${g.file}:G-F 缺 stage —— 它是某個開發階段的達成條件,沒有 stage 就不在任何階段的分母裡`);
  const targets = [];
  for (const a of g.assignments) {
    const t = rowByRef(a.ref, a.subsystem);
    if (!t) {
      if (unbuiltSetEarly.has(a.subsystem)) archNotes.push(`${g.file}:分工表列了 ${a.subsystem} 的 ${a.ref},但 ${a.subsystem} 還沒建 design.md —— 那一段要等 /subsys-design ${a.subsystem}`);
      else archIssues.push(`${g.file}:分工表的 ${a.ref} 指不到任何 feature 檔`);
      continue;
    }
    if (t.type !== "feature") archIssues.push(`${g.file}:分工表指到 ${rowName(t)},但它不是 F —— 承接跨子系統核心功能的一段一定是核心`);
    if (!t.partOf.some((x) => x.split("#")[0].replace(/-[a-z0-9-]+$/, "") === g.id))
      archIssues.push(`${t.file}:被 ${rowName(g)} 的分工表列為承接方,但 part-of 沒回鏈(寫 part-of: [${g.id}])`);
    targets.push(t);
  }
  assignedRows.set(g.id, targets);
  if (DONE_STATUSES.has(g.status)) {
    const notDone = targets.filter((t) => !DONE_STATUSES.has(t.status));
    if (notDone.length) archIssues.push(`${g.file}:status 是 ${g.status},但分工的 ${notDone.map(rowName).join("、")} 還沒 done —— 跨子系統功能要分工 F 全 done 才算完成`);
  }
}
// 反向:子系統 F 的 part-of 指到的 G-F 要存在,而且分工表列了它
for (const r of rows.filter((x) => x.subsystem !== "global" && x.partOf.length)) {
  for (const ref of r.partOf) {
    const gid = String(ref).split("#")[0].replace(/-[a-z0-9-]+$/, "");
    const g = globalIds.get(gid);
    if (!g) archIssues.push(`${r.file}:part-of 的 ${ref} 指不到任何 G-F`);
    else if (!(assignedRows.get(g.id) ?? []).includes(r))
      archIssues.push(`${r.file}:part-of 指到 ${rowName(g)},但那份的分工表沒列 ${rowName(r)}(分工表是權威,回 /subsys-design 補列或拿掉 part-of)`);
  }
}
// rev 與 REV:rev 只是條數的快取,對不上就是有人手改了一邊
for (const r of rows) {
  const { count, last } = r.revisions;
  if (r.rev !== null && Number.isNaN(r.rev)) archIssues.push(`${r.file}:rev 不是數字`);
  else if (r.rev !== null && r.rev !== count) archIssues.push(`${r.file}:rev 是 ${r.rev},但「## 修訂記錄」有 ${count} 條 REV —— 兩者要相等(rev 只是條數的快取)`);
  else if (r.rev === null && count > 0) archIssues.push(`${r.file}:有 ${count} 條 REV 但 frontmatter 沒有 rev 欄(補 rev: ${count})`);
  if (last?.date && DONE_STATUSES.has(r.status) && r.updated !== "-" && last.date > r.updated)
    archIssues.push(`${r.file}:status 是 ${r.status},但最後一條 REV-${last.n}(${last.date})晚於 updated(${r.updated})—— 修訂後要退回 specced 並同步 updated`);
  if (last && r.lawIds.size)
    for (const id of last.touches) if (!r.lawIds.has(id)) archIssues.push(`${r.file}:REV-${last.n}「動到」點名 ${id},但 Laws 裡沒有這一條`);
}
// ASM:done 不准還有沒裁的(裁完就刪,所以「還有條目」就是「還沒裁」);帶已填「裁決」欄的是舊格式墓碑
for (const r of rows) {
  const open = r.asm.total - r.asm.ruled;
  if (DONE_STATUSES.has(r.status) && open > 0)
    archIssues.push(`${r.file}:status 是 ${r.status},但「## 待確認假設」還有 ${open} 條沒裁 —— 裁完(結論寫進契約 / 不可逆決定,記 REV)刪掉條目才能 done`);
  if (r.asm.ruled > 0)
    archNotes.push(`${r.file}:${r.asm.ruled} 條 ASM 帶著已填的「裁決」欄還留在檔上 —— 裁完就刪(結論搬進契約修訂行 / 不可逆決定,記 REV),migrate-v3.mjs --apply 可一次清掉`);
}
// 下游對帳(提示,不進 exit code):上游修訂晚於下游 updated、而那條 REV 的「連動」沒點名下游
for (const x of rows) {
  const ups = [...depTargets(x).filter((t) => t.kind === "task").map((t) => t.row), ...x.partOf.map((ref) => rowByRef(ref)).filter(Boolean)];
  for (const y of ups) {
    const last = y.revisions.last;
    if (!last?.date || x.updated === "-" || last.date <= x.updated) continue;
    const named = last.linked.some((l) => l.includes(x.id) || l.includes(rowName(x)));
    if (!named) archNotes.push(`${x.file}:上游 ${rowName(y)} 修訂到 rev ${y.revisions.count}(REV-${last.n},${last.date})時「連動」沒點名 ${rowName(x)},${rowName(x)} 也沒對過帳(updated ${x.updated})`);
  }
}
// 契約縮窄:只被一份 G-F 或一個子系統用的條目該搬回;G-F 引用別份 G-F 的型別該升格
for (const c of contractIds.values()) {
  const users = new Set(rows.filter((r) => r.contractRefs.some((ref) => ref.split("#")[0] === c.id)).map((r) => (r.subsystem === "global" ? r.id : r.subsystem)));
  if (users.size === 1) archNotes.push(`${c.file}:只有 ${[...users][0]} 引用這份契約的條目 —— 只被一份 G-F 或一個子系統用的型別該搬回那裡(doc-lifecycle.md「全域契約文檔」縮窄規則)`);
}
for (const g of globalFeatures)
  for (const m of readFileSync(join(designDir, g.file), "utf8").matchAll(/\b(G-F\d{3})(?:-[a-z0-9-]+)?#([A-Za-z0-9_.-]+)/g))
    if (m[1] !== g.id) archNotes.push(`${g.file}:引用了 ${m[1]} 的型別 ${m[2]} —— 第二個消費者出現了,該升格成 G-C 條目(doc-lifecycle.md「全域契約文檔」)`);

// ---------------------------------------------------------------- 查詢模式(--subsys / --doc)

/** 文檔的正規化鍵:子系統文檔 `<slug>/<id>`,全域文檔 `<id>`。只當索引用,不印給人看 */
const docKey = (subsystem, id) => (subsystem && subsystem !== "global" ? `${subsystem}/${id}` : id);

/**
 * 文檔的**全名**:`<子系統>/<id>-<檔名 slug>`(全域文檔沒有子系統那一段)。
 * 印給人看的一律用這個,不用裸 id —— 每個子系統各有一組 F001/E001/B001,
 * 單獨一個 `E001` 答不出「哪個子系統的哪一份、在改什麼」,而問這句話的成本由讀的人付。
 * 規則見 `_shared/conventions.md`「指稱紀律」與 `doc-lifecycle.md`「文檔引用格式」。
 */
function fullName(subsystem, id, slug) {
  return `${subsystem && subsystem !== "global" ? `${subsystem}/` : ""}${id}${slug ? `-${slug}` : ""}`;
}
function rowName(r) {
  return fullName(r.subsystem, r.id, r.slug);
}

/** 一條引用(`auth/F002` / `F002` / `G-E001`)解析成全名;解析不到就原樣回傳 */
function refFullName(ref, contextSubsys) {
  const bare = ref.split("#")[0];
  const [slug, id] = bare.includes("/") ? bare.split("/") : [contextSubsys, bare];
  if (/^G-C/.test(bare)) {
    const c = contractIds.get(bare);
    return c ? `${c.id}-${c.slug}` : bare;
  }
  const g = globalIds.get(bare);
  if (g) return rowName(g);
  const r = slug && slug !== "global" ? subsysDocs.get(slug)?.ids.get(id) : null;
  return r ? rowName(r) : bare;
}

/** 一條未結 gap 印成一行:條目全名 → 卡住哪份文檔 → 誰提的 → 模糊點 → 檔案 */
function gapLine(g) {
  const docId = gapDocRef(g.head);
  const target = docId ? refFullName(docId, g.scope) : "(標題沒寫卡住哪份文檔)";
  const role = gapRole(g.head);
  return `- ${g.scope}/${g.id}  卡住 ${target}${role ? `(${role} 提出)` : ""}  ${g.topic}  ${g.file}`;
}

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

/** 掃全文裡出現的全域契約引用(frontmatter 之外的內文也算),回傳去重後的 ref 清單 */
function contractRefsIn(text) {
  const out = new Set();
  for (const m of text.matchAll(/G-C\d{3}(?:#[A-Za-z0-9_.\-]+)?/g)) out.add(m[0]);
  return [...out];
}

/** 一條引用印成一行:目標的狀態與檔案,解析不到就標明 */
function fmtRef(key, viaRef) {
  const bare = key.split("#")[0];
  const item = (viaRef ?? "").includes("#") ? `#${viaRef.split("#")[1]}` : "";
  const full = `${refFullName(bare, null)}${item}`;
  // 一律印全名。原文寫成**裸 id**(沒有子系統前綴)時把原文一起帶出來:那種寫法印到別的
  // 子系統的清單裡就指不到東西,讀的人要知道該回哪一行補前綴(doc-lifecycle.md「文檔引用格式」)。
  const bareRef = viaRef && !/^(G-|ADR-)/.test(viaRef) && !viaRef.includes("/");
  const shown = bareRef ? `${full}(引用方的 depends-on 只寫了裸 id ${viaRef},建議補成 ${bare})` : full;
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

// ---------------------------------------------------------------- spike 的 feeds 對帳(兩個方向)
//
// `feeds` 是 spike 唯一的下游紀錄,跟 depends-on 一樣要指得到東西:寫錯全名就靜默指到空氣,
// 而「結論沒有下游」跟「結論寫錯下游」對讀的人是同一件事。反向:任務文檔引用了 SPK-00x
// (不可逆決定的證據)而那份 spike 的 feeds 沒回鏈它,是回寫漏了一邊 —— 列為提示,因為引用
// 不一定等於下游(可能只是「另見」);引用了不存在的 spike 才是不一致。
const feedResolves = (f) => {
  const raw = f.split("#")[0];
  if (raw === "system.md" || raw === "system") return existsSync(join(designDir, "system.md"));
  const dm = raw.match(/^([a-z0-9-]+)\/design\.md$/);
  if (dm) return Boolean(subsysDocs.get(dm[1])?.designFile);
  const k = feedKey(f);
  if (/^ADR-\d{3}$/.test(k)) return adrIds.has(k);
  if (/^G-C\d{3}$/.test(k)) return contractIds.has(k);
  if (/^G-[EB]\d{3}$/.test(k)) return globalIds.has(k);
  const sm = k.match(/^([a-z0-9-]+)\/([FEB]\d{3})$/);
  if (sm) return Boolean(subsysDocs.get(sm[1])?.ids.has(sm[2]));
  return false;
};
for (const sp of spikes)
  for (const f of sp.feeds)
    if (!feedResolves(f)) archIssues.push(`${sp.file}:feeds 的 ${f} 指不到任何文檔(寫全名:auth/F002、ADR-001、G-C001、auth/design.md、system.md)`);
for (const r of rows)
  for (const id of r.citedSpikes) {
    const sp = spikes.find((x) => x.id === id);
    if (!sp) archIssues.push(`${r.file}:引用了 ${id},但 .design/spikes/ 沒有這份 spike`);
    else if (!spikeFeeds(sp, r.subsystem, r.id))
      archNotes.push(`${r.file}:引用了 ${spikeName(sp)} 當證據,但那份 spike 的 feeds 沒回鏈 ${rowName(r)}(回寫漏了一邊?)`);
  }

// ---------------------------------------------------------------- 派工狀態(PM 視角的機械推導)
//
// `status` 講的是**文檔寫到哪**(planned / specced / done),派工要的是**這件事今天能不能動**:
// 一份 specced 可能卡在 gap,一份 planned 可能契約齊全能直接委派。兩者正交,所以另算一格。
// 全部從既有欄位推:depends-on、blockedBy(gap)、契約欄、spike 的 feeds、ASM 條目(存在即未裁)。
// 腳本只算「能不能動」,「該不該先動它」是人的判斷 —— 這裡給的是候選與理由,不是決定。

const today = (() => {
  const t = todayArg ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    console.error(`--today 要寫成 YYYY-MM-DD,收到:${t}`);
    process.exit(2);
  }
  return t;
})();
/** 距今幾天;日期讀不到回 null。停滯天數只印不判 —— 什麼算太久是專案自己的事 */
const daysSince = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? Math.round((Date.parse(today) - Date.parse(d)) / 86400000) : null);
const ago = (d) => {
  const n = daysSince(d);
  return n === null ? "日期不明" : n <= 0 ? "今天" : `${n} 天`;
};

/** status 講給人聽:已規劃(planned)。附錄表格仍印原字,這裡只給 § 段落用 */
const STATUS_ZH = { planned: "已規劃", specced: "規格已寫", done: "已實作", closed: "已結", dropped: "不做", "in-progress": "進行中" };
const zh = (s) => STATUS_ZH[s] ?? s;

const isUnfinished = (r) => !DONE_STATUSES.has(r.status) && !DROPPED_STATUSES.has(r.status);
const unbuiltSet = new Set(plannedSubsys);
const plannedGroupRows = subsysRows.flatMap((s) => s.groupRows.filter((g) => g.status === "planned"));

/** depends-on 的每一條解析成目標:任務文檔 / 契約 / ADR / 解析不到 */
function depTargets(r) {
  return r.dependsOn.map((ref) => {
    const key = refKey(ref, r.subsystem);
    const bare = key.split("#")[0];
    if (/^ADR-/.test(bare)) return { ref, key, kind: adrIds.has(bare) ? "adr" : "unknown" };
    if (/^G-C/.test(bare)) return { ref, key, kind: contractIds.has(bare) ? "contract" : "unknown", contract: contractIds.get(bare) };
    const row = globalIds.get(bare) ?? (bare.includes("/") ? subsysDocs.get(bare.split("/")[0])?.ids.get(bare.split("/")[1]) : null);
    return row ? { ref, key, kind: "task", row } : { ref, key, kind: "unknown" };
  });
}

/** 誰直接依賴這份文檔(只算未完成的 —— 做完的不會被任何事解鎖);承接 G-F 的一段時,那份 G-F 也算 */
const dependents = (r) => {
  const out = (reverseDeps.get(docKey(r.subsystem, r.id)) ?? []).map((x) => x.row).filter(isUnfinished);
  for (const g of globalFeatures) if (isUnfinished(g) && (assignedRows.get(g.id) ?? []).includes(r) && !out.includes(g)) out.push(g);
  return out;
};

/** 可開工的文檔該下哪條命令(參數一律全名) */
function commandFor(r) {
  const name = rowName(r);
  if (r.type === "feature" && r.status === "planned") return `/spec-design ${name}`;
  return `/spec-build ${name}`;
}

const STATE_LABEL = { ready: "可開工", half: "半步可開工", blocked: "卡住", deciding: "等決定", unbuilt: "未開工" };
const gapScope = (r) => (r.subsystem === "global" ? "global" : r.subsystem);

/**
 * 每份未完成文檔一格:{ state, why: [{what, since, fix}], command, releases, partial, stale }
 * 優先序 卡住 > 等決定 > 半步 > 可開工:一份文檔同時有 gap 與未裁 ASM 時,先報會擋住工作的那個。
 */
const dispatch = new Map();
for (const r of rows) {
  if (!isUnfinished(r)) continue;
  const name = rowName(r);
  const targets = depTargets(r);
  const waiting = targets.filter((t) => t.kind === "task" && isUnfinished(t.row));
  const parts = (assignedRows.get(r.id) ?? []).filter(isUnfinished);
  const unknown = targets.filter((t) => t.kind === "unknown");
  const gaps = r.blockedBy ?? [];
  const feeds = openSpikes.filter((sp) => spikeFeeds(sp, r.subsystem, r.id));
  const asmOpen = r.asm.total - r.asm.ruled; // 條目存在即未裁;帶已填「裁決」欄的是舊格式墓碑,另列提示、不算未裁
  const half = r.type === "feature" && r.status === "planned" && r.contractGaps.length > 0;
  const why = [];
  let state;
  if (gaps.length || waiting.length || unknown.length || (parts.length && r.status !== "planned")) {
    state = "blocked";
    for (const t of parts) why.push({ what: `等分工 ${rowName(t)} 做完(現在 ${zh(t.status)})`, since: t.updated, fix: `先做 ${rowName(t)}` });
    for (const g of gaps) {
      const gg = openGaps.find((x) => x.id === g && x.scope === gapScope(r));
      const role = gg ? gapRole(gg.head) : "";
      why.push({ what: `${gapScope(r)}/${g}「${gg?.topic ?? "-"}」${role ? `(${role} 提出)` : ""}`, since: gg?.fileUpdated, fix: `/spec-redesign ${name}` });
    }
    for (const t of waiting) why.push({ what: `等 ${rowName(t.row)} 做完(現在 ${zh(t.row.status)})`, since: t.row.updated, fix: `先做 ${rowName(t.row)}` });
    for (const t of unknown) why.push({ what: `depends-on 的 ${t.ref} 指不到任何文檔`, since: r.updated, fix: `修 ${name} 的 depends-on` });
  } else if (feeds.length || asmOpen) {
    state = "deciding";
    for (const sp of feeds) why.push({ what: `${spikeName(sp)} 還沒有結論${sp.question ? `:${sp.question}` : ""}`, since: sp.updated, fix: `/spike ${spikeName(sp)}` });
    if (asmOpen) why.push({ what: `${asmOpen} 條契約級假設(ASM)還沒裁`, since: r.updated, fix: `/spec-redesign ${name}(裁 ASM:結論寫進契約 / 不可逆決定,記 REV,刪條目)` });
  } else if (half) {
    state = "half";
    why.push({ what: `契約缺 ${r.contractGaps.join("、")}`, since: r.updated, fix: `/subsys-design ${r.subsystem}` });
  } else {
    state = "ready";
  }
  dispatch.set(docKey(r.subsystem, r.id), {
    row: r,
    state,
    why,
    command: state === "ready" ? commandFor(r) : why[0].fix,
    releases: dependents(r),
    asmOpen,
    partial: r.subsystem === "global" ? r.affects.filter((s) => unbuiltSet.has(s)) : [],
    stale: daysSince(r.updated),
  });
}
const byState = (st, filter = () => true) => [...dispatch.values()].filter((d) => d.state === st && filter(d.row));

/**
 * 平行道:可開工 + 半步 + 未開工,每一列是一個能派出去的動作。
 * 平行判準(全部機械):不同子系統 → 獨立;同子系統不同模組群 → 可平行;同模組群 → 看 `modules`
 * 有沒有交集,有就串行,沒有就標「要人判」。同一個子系統要下同一條 `/subsys-design` 的合併成一列。
 */
function buildLanes(inScope = () => true) {
  const lanes = [];
  for (const st of ["ready", "half"]) {
    for (const d of byState(st, inScope)) {
      const r = d.row;
      lanes.push({ items: [rowName(r)], state: st, command: d.command, subsystem: r.subsystem, group: r.group, modules: r.modules, affects: r.affects, partial: d.partial, note: r.type === "enhance" ? "擴充功能,不擋階段;" : "" });
    }
  }
  for (const slug of plannedSubsys.filter((s) => inScope({ subsystem: s }))) {
    const st = stages.find((x) => x.subsys.includes(slug));
    lanes.push({ items: [`${slug} 子系統`], state: "unbuilt", command: `/subsys-design ${slug}`, subsystem: slug, group: "", modules: [], partial: [], note: st ? `${stageName(st)} 的前置;` : "" });
  }
  for (const g of plannedGroupRows.filter((g) => inScope({ subsystem: g.subsystem })))
    lanes.push({ items: [`${g.subsystem}/${g.name} 模組群`], state: "unbuilt", command: `/subsys-design ${g.subsystem}`, subsystem: g.subsystem, group: g.name, modules: [], partial: [], note: "", planned: true });
  // 同子系統、同一條 /subsys-design 命令 → 一趟做完,合併成一列
  const merged = [];
  for (const l of lanes) {
    const same = merged.find((m) => m.subsystem === l.subsystem && m.command === l.command && /^\/subsys-design /.test(l.command));
    if (same) {
      same.items.push(...l.items);
      if (l.state === "unbuilt" && same.state !== "unbuilt") same.state = same.state; // 半步優先顯示
      continue;
    }
    merged.push({ ...l, items: [...l.items] });
  }
  for (const l of merged) {
    const sibs = merged.filter((m) => m !== l && m.subsystem === l.subsystem);
    const notes = [];
    if (l.partial.length) notes.push(`受影響子系統 ${l.partial.join("、")} 未建檔,只能先做已建檔的那一半`);
    if (sibs.length === 0) notes.push("與其他道獨立");
    for (const s of sibs) {
      const sname = s.items[0];
      if (l.subsystem === "global") {
        const shared = (l.affects ?? []).filter((x) => (s.affects ?? []).includes(x));
        notes.push(shared.length ? `與「${sname}」都動到 ${shared.join("、")},先後要人判` : `與「${sname}」子系統不重疊,可平行`);
        continue;
      }
      if (l.group && s.group && l.group.toLowerCase() !== s.group.toLowerCase()) notes.push(`與「${sname}」不同模組群,可平行`);
      else {
        const shared = l.modules.filter((m) => s.modules.map((x) => x.toLowerCase()).includes(m.toLowerCase()));
        if (shared.length) notes.push(`與「${sname}」共用模組 ${shared.join("、")},要串行`);
        else if (l.modules.length && s.modules.length) notes.push(`與「${sname}」同模組群、模組不重疊,可平行`);
        else notes.push(`與「${sname}」同模組群,共不共用模組要人判`);
      }
    }
    l.note = (l.note + notes.join(";")).replace(/;$/, "");
  }
  return merged;
}
const laneLabel = (i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : "");
function printLanes(lanes) {
  if (lanes.length === 0) {
    console.log("(無)今天沒有任何能直接派出去的工作 —— 先看下面卡住的與等決定的。");
    return;
  }
  printTable(
    { lane: "道", items: "項目", state: "派工狀態", command: "命令", note: "備註" },
    lanes.map((l, i) => ({ lane: laneLabel(i), items: l.items.join(" + "), state: STATE_LABEL[l.state], command: l.command, note: l.note || "-" })),
  );
  // 契約就緒滿格的子系統可以整批委派,不必一份一份跑
  const batch = subsysRows.filter((s) => s.built && s.cards !== "-" && s.cards.split("/")[0] === s.cards.split("/")[1] && lanes.some((l) => l.subsystem === s.id));
  for (const s of batch) console.log(`${s.id} 的 planned feature 契約就緒 ${s.cards}:可以 /subsys-build ${s.id} 一次委派,不必逐份 /spec-design。`);
}

/** 卡住的表:一份文檔一條原因一列;先排解開後釋放最多的,再排停最久的 */
function blockedRows(inScope = () => true, withOutside = false) {
  const out = [];
  for (const d of byState("blocked", inScope)) {
    for (const w of d.why) {
      const rel = d.releases.map((x) => rowName(x));
      const outside = d.releases.filter((x) => x.subsystem !== d.row.subsystem).map((x) => rowName(x));
      out.push({
        doc: rowName(d.row),
        by: w.what,
        since: ago(w.since),
        fix: w.fix,
        releases: rel.length ? rel.join("、") : "無下游",
        outside: outside.length ? outside.join("、") : "無",
        _n: rel.length,
        _s: daysSince(w.since) ?? -1,
      });
    }
  }
  out.sort((a, b) => b._n - a._n || b._s - a._s || a.doc.localeCompare(b.doc));
  return out.map(({ _n, _s, outside, ...r }) => (withOutside ? { ...r, outside } : r));
}
function printBlocked(rowsB, withOutside = false) {
  if (rowsB.length === 0) {
    console.log("(無)沒有任何文檔被 gap 或上游擋住。");
    return;
  }
  printTable(
    withOutside
      ? { doc: "被卡的", by: "卡它的", since: "停了", fix: "解法", releases: "解開後釋放", outside: "卡到外部誰" }
      : { doc: "被卡的", by: "卡它的", since: "停了", fix: "解法", releases: "解開後釋放" },
    rowsB,
  );
}

/** 等決定的:open spike(不管有沒有下游)+ 未裁 ASM。決定的人是開發者,不是工程師 */
function decisionLines(inScope = () => true, spikeScope = () => true) {
  const lines = [];
  for (const sp of openSpikes.filter(spikeScope)) {
    const fed = rows.filter((r) => spikeFeeds(sp, r.subsystem, r.id));
    const others = sp.feeds.filter((f) => !fed.some((r) => feedKey(f) === docKey(r.subsystem, r.id) || feedKey(f) === r.id));
    const impact = [...fed.map((r) => `${rowName(r)}(${STATE_LABEL[dispatch.get(docKey(r.subsystem, r.id))?.state] ?? zh(r.status)})`), ...others];
    lines.push(
      `- ${spikeName(sp)}(open 了 ${ago(sp.updated)})${sp.question ? ` 要回答:${sp.question}` : ""}` +
        `\n    影響:${impact.length ? impact.join("、") : "feeds 是空的,目前沒有任何文檔在等它 —— 不擋任何線"}` +
        `\n    建議:/spike ${spikeName(sp)} 做完,或標 dropped 並寫一句為什麼`,
    );
  }
  for (const d of [...dispatch.values()].filter((d) => d.asmOpen > 0 && inScope(d.row))) {
    lines.push(
      `- ${rowName(d.row)} 還有 ${d.asmOpen} 條契約級假設(ASM)沒裁` +
        `\n    影響:${rowName(d.row)} 的實作照「暫採」蓋上去,沒有人簽過` +
        `\n    建議:${d.state === "blocked" ? `與 gap 一起在 /spec-redesign ${rowName(d.row)} 裁` : `/spec-redesign ${rowName(d.row)}(裁 ASM)`}`,
    );
  }
  return lines;
}

/** 子系統的建檔 / 完成狀態,講給契約影響面用 */
function subsysBrief(slug) {
  if (unbuiltSet.has(slug)) return `${slug}(未建檔)`;
  const s = subsysRows.find((x) => x.id === slug);
  if (!s) return `${slug}(不在名冊)`;
  const open = rows.filter((r) => r.subsystem === slug && isUnfinished(r)).length;
  return open ? `${slug}(未完成 ${open} 份)` : `${slug}(已展開的全部完成)`;
}

/** 依賴鏈:每份文檔往上游走的最長路徑(含已完成的上游,鏈的形狀要看得到起點) */
const chainMemo = new Map();
function chainTo(r, visiting = new Set()) {
  const k = docKey(r.subsystem, r.id);
  if (chainMemo.has(k)) return chainMemo.get(k);
  if (visiting.has(k)) return [r]; // 有環:斷在這裡,環本身由 depends-on 對帳報
  visiting.add(k);
  let best = [];
  for (const t of depTargets(r)) {
    if (t.kind !== "task") continue;
    const c = chainTo(t.row, visiting);
    if (c.length > best.length) best = c;
  }
  visiting.delete(k);
  const out = [...best, r];
  chainMemo.set(k, out);
  return out;
}
const chainLabel = (r) => `${rowName(r)}(${isUnfinished(r) ? STATE_LABEL[dispatch.get(docKey(r.subsystem, r.id))?.state] ?? zh(r.status) : zh(r.status)})`;
function impactLines(inScope = () => true) {
  const lines = [];
  for (const c of [...contractIds.values()].filter((c) => c.affects.some((s) => inScope({ subsystem: s })))) {
    const unbuilt = c.affects.filter((s) => unbuiltSet.has(s));
    const refs = [...reverseDeps.entries()].filter(([k]) => k.split("#")[0] === c.id).flatMap(([, l]) => l.map((x) => rowName(x.row)));
    lines.push(
      `- ${c.id}-${c.slug}(共用契約)被 ${c.affects.map(subsysBrief).join("、")} 使用${refs.length ? `,${[...new Set(refs)].join("、")} 直接引用` : ""}。` +
        (unbuilt.length ? `${unbuilt.join("、")} 還沒建檔,現在改條目代價最低;建檔後每改一次要通知 ${c.affects.length} 邊。` : `改任何條目都要通知 ${c.affects.length} 個子系統。`),
    );
  }
  for (const d of [...dispatch.values()].filter((d) => d.row.subsystem === "global" && d.row.affects.some((s) => inScope({ subsystem: s })))) {
    lines.push(
      `- ${rowName(d.row)}(${zh(d.row.status)})橫跨 ${d.row.affects.join(" + ")},是跨子系統的任務文檔` +
        (d.partial.length ? `;${d.partial.join("、")} 的設計會決定它的另一半長什麼樣,建檔前只能做已建檔的部分。` : "。"),
    );
  }
  for (const sp of spikes.filter((sp) => sp.status === "concluded" && sp.feeds.length && (sp.affects.some((s) => inScope({ subsystem: s })) || rows.some((r) => inScope(r) && spikeFeeds(sp, r.subsystem, r.id))))) {
    lines.push(`- ${spikeName(sp)}(concluded · ${sp.verdict})的結論餵給 ${sp.feeds.join("、")}:這些決定有證據,改方向要回頭看它。`);
  }
  // 依賴鏈與 hub
  const chains = [];
  for (const r of rows.filter((r) => isUnfinished(r) && inScope(r))) {
    const c = chainTo(r);
    if (c.length >= 2) chains.push(c);
  }
  const keyOf = (c) => c.map((r) => docKey(r.subsystem, r.id)).join(">");
  const maximal = chains.filter((c) => !chains.some((o) => o.length > c.length && keyOf(o).startsWith(keyOf(c))));
  maximal.sort((a, b) => b.length - a.length || keyOf(a).localeCompare(keyOf(b)));
  if (maximal.length === 0) lines.push("- 依賴鏈:沒有任何跨文檔的依賴鏈,每一份都可以獨立排程。");
  else {
    const top = maximal.slice(0, 3);
    lines.push(`- 依賴鏈(最長 ${maximal[0].length} 步,共 ${maximal.length} 條):`);
    for (const c of top) lines.push(`    ${c.map(chainLabel).join(" → ")}`);
  }
  const hubs = rows
    .filter((r) => inScope(r))
    .map((r) => ({ r, deps: dependents(r) }))
    .filter((x) => x.deps.length >= 2)
    .sort((a, b) => b.deps.length - a.deps.length);
  if (hubs.length) for (const h of hubs) lines.push(`- ${rowName(h.r)}(${chainLabel(h.r).match(/\((.*)\)$/)?.[1]})被 ${h.deps.length} 份未完成文檔依賴:${h.deps.map(rowName).join("、")} —— 先做它解鎖最多。`);
  else lines.push("- 沒有任何節點被兩份以上的未完成文檔依賴,不存在單點瓶頸。");
  return lines;
}

/**
 * 警訊分兩類:**影響派工的**(依賴指不到、狀態說謊、結案沒證據、名冊漏列…)逐條列;
 * **格式類**(id 與檔名、缺 description、裸 id、檔名規則…)只報數量,全文放附錄。
 * 分類靠訊息樣式:訊息都是本檔產的,規則就住在同一份檔裡。
 */
const DISPATCH_WARN = [
  /depends-on 的 .* 無法解析/, /feeds 的 .* 指不到/, /status 是 .*(卻|但)/, /沒有「## 契約」/,
  /但 subsystems\/ 沒有這個子系統/, /缺 design\.md/,
  /找不到 \.design\/system\.md/, /涵蓋子系統寫了/, /標 active,但沒有任何 feature/, /group「.*」不在/, /沒填 frontmatter 的 group/,
  /引用了 SPK-\d+,但/, /缺「狀態」行|狀態值「/, /標題沒寫這條 gap|標題指向/, /concluded 但 feeds 是空的/, /未被 system\.md 的 subsystems 名冊列入/,
  /沒有「開發階段」表格/, /缺 mode 欄/,
];
const affectsDispatch = (m) => DISPATCH_WARN.some((re) => re.test(m));
function printWarnings(issues, notes, bad) {
  const hot = [...issues.filter(affectsDispatch), ...notes.filter(affectsDispatch)];
  const cold = issues.length + notes.length - hot.length + bad.length;
  console.log(`影響派工的(${hot.length}):`);
  if (hot.length === 0) console.log("(無)");
  for (const m of hot) console.log(`- ${m}`);
  console.log(`格式類(${cold}):不影響今天的派工;全文見附錄「警訊全文」。`);
}

/** 建議路線(機械排序):主線 = 解最便宜的 blocker;同時 = 與主線不同子系統的第一條道;之後 = 其餘 */
function routeLines(lanes, blocked) {
  const out = [];
  const main = blocked[0] ? { cmd: blocked[0].fix, why: `解 ${blocked[0].doc} 的 blocker(${blocked[0].by})` } : lanes[0] ? { cmd: lanes[0].command, why: `${lanes[0].items.join(" + ")} ${STATE_LABEL[lanes[0].state]},沒有人擋它` } : null;
  if (!main) {
    out.push("沒有任何可派的工作,也沒有卡住的:看上面「等決定的」與警訊。");
    return out;
  }
  out.push(`1. 主線:${main.cmd} —— ${main.why}`);
  const mainSub = blocked[0] ? dispatch.get([...dispatch.keys()].find((k) => rowName(dispatch.get(k).row) === blocked[0].doc))?.row.subsystem : lanes[0]?.subsystem;
  const side = lanes.find((l) => l.subsystem !== mainSub && l.command !== main.cmd);
  if (side) out.push(`2. 同時開:${side.command} —— ${side.items.join(" + ")} 在${side.subsystem === "global" ? "全域" : ` ${side.subsystem}`},與主線互不影響`);
  const rest = lanes.filter((l) => l !== side && l.command !== main.cmd).slice(0, 2);
  if (rest.length) out.push(`${side ? 3 : 2}. 之後:${rest.map((l) => `${l.command}(${l.items.join(" + ")})`).join(";")}`);
  return out;
}

/** 一個階段的「已展開 / 還沒展開 / 達成還差什麼」 */
function stageDetail(st) {
  const built = st.subsys.filter((s) => !unbuiltSet.has(s));
  const unbuilt = st.subsys.filter((s) => unbuiltSet.has(s));
  const expanded = built.map((s) => {
    const row = subsysRows.find((x) => x.id === s);
    return row && row.hasFeatures ? `${s} 核心 ${row.done}/${row.features}${row.runnable ? "(可運作)" : ""}` : `${s} 沒有 F 檔`;
  });
  const pg = plannedGroupRows.filter((g) => st.subsys.includes(g.subsystem)).map((g) => `${g.subsystem}/${g.name} 模組群`);
  const notExpanded = [...unbuilt.map((s) => `${s} 未建 design.md`), ...pg];
  const inStage = (r) => (r.subsystem !== "global" && st.subsys.includes(r.subsystem)) || (r.stage && r.stage === st.id);
  // 只有核心(F / G-F)擋階段;E / G-E 另報,不進「還差」
  const todo = [
    ...rows.filter((r) => isUnfinished(r) && r.type === "feature" && inStage(r)).map((r) => `${rowName(r)}(${STATE_LABEL[dispatch.get(docKey(r.subsystem, r.id))?.state]})`),
    ...pg.map((x) => `${x} 開工`),
    ...unbuilt.map((s) => `${s} 建 design.md`),
  ];
  const ext = rows.filter((r) => isUnfinished(r) && r.type === "enhance" && inStage(r)).length;
  return { expanded: expanded.length ? expanded.join(";") : "-", notExpanded: notExpanded.length ? notExpanded.join(";") : "-", todo, ext };
}

const QUERY_TAIL =
  "\n本腳本只產生索引,不下判斷:它答得出「哪份文檔、什麼狀態、誰依賴誰、今天能不能動」,答不出「那份文檔寫的對不對」。\n" +
  "要寫進 spec 的每一條介面,仍須打開該文檔讀原文。各角色的使用界線見 _shared/design-query.md。";

if (query.doc) {
  const want = query.doc.trim();
  // 全名 `auth/F002-token-refresh` 是回報與定錨區塊裡的寫法,直接貼進 --doc 就要查得到:
  // 剝掉 id 後面的 slug,`auth/F002` 與 `F002` 也照樣吃。
  const bare = want
    .split("#")[0]
    .replace(/^((?:[a-z0-9-]+\/)?(?:G-[CFEB]\d{3}|ADR-\d{3}|[FEB]\d{3}))-[a-z0-9-]+$/, "$1");

  // 1) 全域契約
  if (contractIds.has(bare)) {
    const c = contractIds.get(bare);
    const text = readFileSync(c.path, "utf8");
    console.log(`=== 全域契約 ${c.id}-${c.slug}(${c.description})===`);
    console.log(`歸屬  全域共用契約(不屬於任何單一子系統)  |  status ${c.status}`);
    console.log(`檔案  ${c.file}`);

    console.log("\n=== §1 改它會牽動誰 ===");
    if (c.affects.length === 0) console.log("⚠ 未列 subsystems —— 不知道誰在用,改了不知道要通知誰");
    else {
      printTable(
        { s: "使用的子系統", st: "狀態", note: "改條目的代價" },
        c.affects.map((s) => ({
          s,
          st: unbuiltSet.has(s) ? "未建 design.md" : subsysBrief(s).replace(/^[^(]+\(|\)$/g, ""),
          note: unbuiltSet.has(s) ? "還沒有任何 feature 依賴它,現在改最便宜" : "已展開,改條目要回頭對它的 feature 與骨架",
        })),
      );
    }
    const users = [];
    for (const [k, list] of reverseDeps) {
      if (k.split("#")[0] !== bare) continue;
      for (const { row, ref } of list) users.push(`- ${rowName(row)}  [${zh(row.status)}]  引用 ${ref}  ${row.file}`);
    }
    printBlock("誰引用這份契約(反向依賴)—— 改條目要逐份通知", users.sort());

    const entries = section(text, /契約條目/);
    printBlock("附錄:契約條目(原文)", entries ? entries.text.split("\n") : ["(這份契約沒有「契約條目」章節——格式見 doc-lifecycle.md「全域契約文檔」)"]);
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
    console.error(`查無此文檔: ${want}`);
    console.error(`(子系統文檔寫全名 auth/F003-token-cache,寫 auth/F003 或 F003 也吃;全域寫 G-E001-cache;共用契約寫 G-C001-session)`);
    process.exit(2);
  }

  const key = docKey(hit.subsystem, hit.id);
  const full = readFileSync(join(designDir, hit.file), "utf8");
  const entry = hit.subsystem !== "global" ? subsysDocs.get(hit.subsystem) : null;
  const d = dispatch.get(key) ?? null;
  const stageOf = hit.stage && hit.stage !== "-" ? stages.find((s) => s.id === hit.stage) : stages.find((s) => s.subsys.includes(hit.subsystem));

  // 身份卡
  console.log(`=== 文檔 ${rowName(hit)}(${hit.description})===`);
  console.log(
    `歸屬  ${hit.subsystem === "global" ? "全域(跨子系統)" : `子系統 ${hit.subsystem}`}` +
      (hit.group ? `  |  模組群 ${hit.subsystem}/${hit.group}` : "") +
      (hit.partOf.length ? `  |  承接 ${hit.partOf.map((x) => refFullName(String(x).split("#")[0].replace(/-[a-z0-9-]+$/, ""), null)).join("、")}` : "") +
      (stageOf ? `  |  階段 ${stageName(stageOf)} ${stageOf.status}` : hit.type === "feature" ? "  |  階段 未填" : "") +
      `  |  type ${hit.type}${hit.subsystem === "global" && hit.type !== "bugfix" ? "(跨子系統)" : hit.type === "enhance" ? "(擴充,不擋階段)" : ""}  |  ${zh(hit.status)}${hit.rev ? `(rev ${hit.rev})` : ""}`,
  );
  console.log(`更新  ${hit.updated}(${ago(hit.updated)}${daysSince(hit.updated) !== null && daysSince(hit.updated) > 0 ? "前" : ""})`);
  if (hit.subsystem === "global") console.log(`受影響  ${hit.affects.length ? hit.affects.map(subsysBrief).join("、") : "⚠ 未列 subsystems"}`);
  else if (entry?.designFile) console.log(`上層  ${entry.designFile}`);
  console.log(`檔案  ${hit.file}`);

  // §1 能不能開工
  console.log("\n=== §1 能不能開工 ===");
  if (!d) console.log(`${zh(hit.status)}。沒有待派的工作。`);
  else {
    console.log(`**${STATE_LABEL[d.state]}。** ` + (d.why.length ? d.why.map((w) => w.what).join(";") + "。" : "依賴全部就緒、沒有 gap、契約齊全。"));
    if (d.partial.length) console.log(`受影響子系統 ${d.partial.join("、")} 還沒建檔:只能先做已建檔的那一半。`);
  }

  // §2 上游
  console.log("\n=== §2 上游:它在等什麼 ===");
  const up = [];
  for (const w of d?.why ?? []) up.push({ what: w.what, st: w.since ? `${ago(w.since)}` : "-", fix: w.fix });
  for (const t of depTargets(hit)) {
    if (t.kind === "task" && !isUnfinished(t.row)) up.push({ what: rowName(t.row), st: zh(t.row.status), fix: "不用等" });
    if (t.kind === "contract") up.push({ what: `${t.contract.id}-${t.contract.slug}${t.ref.includes("#") ? `#${t.ref.split("#")[1]}` : ""}(共用契約)`, st: t.contract.status, fix: "契約條目是不可逆決定,改動要走 /spec-redesign" });
    if (t.kind === "adr") up.push({ what: `${adrNames.get(t.key) ?? t.key}(ADR)`, st: "-", fix: "不用等" });
  }
  const cited = new Set([...full.matchAll(/\bSPK-(\d{3})\b/g)].map((x) => `SPK-${x[1]}`));
  const relSpikes = spikes.filter((sp) => spikeFeeds(sp, hit.subsystem, hit.id) || cited.has(sp.id));
  for (const sp of relSpikes.filter((sp) => sp.status !== "open")) up.push({ what: `${spikeName(sp)}(spike)`, st: `${sp.status}${sp.verdict !== "-" ? ` · ${sp.verdict}` : ""}`, fix: "證據已在,不用等;改方向要回頭讀它的結論" });
  for (const t of assignedRows.get(hit.id) ?? []) if (!isUnfinished(t)) up.push({ what: `分工 ${rowName(t)}`, st: zh(t.status), fix: "不用等" });
  if (up.length === 0) console.log("(無)不依賴任何文檔,也沒有人擋它。");
  else printTable({ what: "等什麼", st: "狀態", fix: "誰解 / 怎麼解" }, up);

  // §3 下游
  console.log("\n=== §3 下游:誰在等它 ===");
  const back = (reverseDeps.get(key) ?? []).map(({ row, ref }) => ({ row, ref }));
  if (back.length === 0) console.log("沒有文檔依賴它。");
  else
    for (const { row, ref } of back.sort((a, b) => rowName(a.row).localeCompare(rowName(b.row)))) {
      const dd = dispatch.get(docKey(row.subsystem, row.id));
      console.log(`- ${rowName(row)}(${dd ? STATE_LABEL[dd.state] : zh(row.status)})引用 ${ref}${isUnfinished(hit) && dd ? " —— 這份做完才能動" : ""}`);
    }
  if (stageOf && isUnfinished(hit)) console.log(`它是 ${stageName(stageOf)} 達成的條件之一(該階段目前 ${stageOf.status})。`);

  // §4 規格寫到幾成
  console.log("\n=== §4 規格寫到幾成 ===");
  const specRows = [];
  if (hit.type === "feature" || hit.type === "enhance")
    specRows.push({
      k: "契約",
      v: hit.hasContract ? (hit.contractGaps.length ? `缺 ${hit.contractGaps.length} 欄(${hit.contractGaps.join("、")})` : "齊(含" + CRITERION[hit.type] + ")") + (hit.status !== "planned" && hit.contractGaps.length ? " ⚠ 與 status 對不上:規格寫了、契約沒補" : "") : hit.type === "enhance" && hit.status !== "planned" ? "沒有「## 契約」—— 舊格式 E,走 migrate-v3.mjs 分流" : "沒有「## 契約」⚠",
    });
  specRows.push({ k: "介面 / 數據", v: hit.ifaces ? `${hit.ifaces} 條` : "沒有表格" });
  specRows.push({ k: "Laws / Examples", v: `${hit.laws} / ${hit.examples}${hit.laws + hit.examples ? `(照 spec 應有 ${hit.laws + hit.examples} 個測試)` : ""}` });
  specRows.push({ k: "契約級假設 ASM", v: hit.asm.total ? `${hit.asm.total - hit.asm.ruled} 條沒裁${hit.asm.ruled ? `,另 ${hit.asm.ruled} 條裁完沒刪 ⚠(結論搬進契約 / 不可逆決定,記 REV,刪條目)` : ""}` : "無(裁完即刪,沒有條目才是正常)" });
  specRows.push({ k: "code-paths", v: hit.codePaths.length ? `${hit.codePaths.length} 個(${hit.codePaths.join("、")})` : DONE_STATUSES.has(hit.status) ? "空 ⚠ 收尾漏回寫" : "空(實作收尾時回寫)" });
  {
    const { count, last } = hit.revisions;
    specRows.push({ k: "修訂", v: count ? `rev ${hit.rev ?? "?"}(REV ${count} 條,最後 REV-${last.n} ${last.date ?? "日期不明"}${last.touches.length ? `,動到 ${last.touches.join("、")}` : ""})` : "初版(rev 0),沒有修訂過" });
  }
  if (hit.assignments.length)
    specRows.push({ k: "分工", v: hit.assignments.map((a) => { const t = rowByRef(a.ref, a.subsystem); return `${a.subsystem} → ${t ? `${rowName(t)}(${zh(t.status)})` : `${a.ref} ⚠ 指不到`}`; }).join(";") });
  printTable({ k: "項目", v: "狀況" }, specRows);

  // §5 改它會牽動誰
  console.log("\n=== §5 改它會牽動誰 ===");
  const imp = [];
  if (back.length) imp.push(`- ${back.length} 份文檔依賴它(${back.map((b) => rowName(b.row)).join("、")}):改介面要逐份通知。`);
  else imp.push("- 沒有人依賴它,改介面不必通知任何下游。");
  const usedContracts = contractRefsIn(full);
  if (usedContracts.length) imp.push(`- 引用共用契約 ${usedContracts.map((r) => refFullName(r.split("#")[0], null) + (r.includes("#") ? `#${r.split("#")[1]}` : "")).join("、")}:那邊改條目時這份要跟著對。`);
  if (hit.relatedAdr.length) imp.push(`- 相關 ADR:${hit.relatedAdr.map((a) => adrNames.get(a) ?? a).join("、")}。`);
  for (const sp of relSpikes) imp.push(`- 引用 ${spikeName(sp)}(${sp.status}${sp.verdict !== "-" ? ` · ${sp.verdict}` : ""})當證據:改「不可逆決定」要回頭看它。`);
  const overlap = [];
  for (const r of rows) {
    if (r === hit) continue;
    const shared = hit.codePaths.filter((a) => r.codePaths.some((b) => pathRel(a, b)));
    if (shared.length) overlap.push(`${rowName(r)}(${zh(r.status)};${shared.join("、")})`);
  }
  if (overlap.length) imp.push(`- code-paths 與 ${overlap.join("、")} 重疊:改實作要一起回歸。`);
  else if (hit.codePaths.length) imp.push("- code-paths 沒有和其他文檔重疊。");
  for (const l of imp) console.log(l);

  // §6 下一步
  console.log("\n=== §6 下一步 ===");
  if (!d) console.log(`${zh(hit.status)},沒有下一步。${hit.type === "feature" && DONE_STATUSES.has(hit.status) ? "要改它走 /spec-redesign 修訂原檔(rev +1,done 退回 specced),不另開檔。" : ""}`);
  else console.log(`${d.command}` + (d.state === "blocked" ? " —— 先解 blocker,不要繼續做:兩種相反的實作都會全綠,測試證明不了什麼。" : d.state === "half" ? " —— 補齊契約後才能 /spec-design。" : d.state === "deciding" ? " —— 決定的人是開發者,不是工程師。" : ""));

  // 附錄:原文索引(給要寫 spec 的人)
  for (const [title, re] of [
    ["數據", /^數據$|數據與介面變動/],
    ["介面", /^介面$/],
  ]) {
    const sec = section(full, re);
    if (sec) printBlock(`附錄:${title}(原文)`, sec.text.split("\n"));
  }
  if (!section(full, /^數據$|數據與介面變動/) && !section(full, /^介面$/))
    printBlock("附錄:介面 / 數據", ["(這份文檔沒有「數據」或「介面」段——模板見 spec-design/templates/)"]);
  if (relSpikes.length) printBlock("附錄:相關 spike(這份文檔的決定有哪些證據)", relSpikes.map(spikeLine));

  console.log(QUERY_TAIL);
  process.exit(0);
}

// ---------------------------------------------------------------- 反查模式(--file)

/**
 * 路徑正規化:去掉前導 `./`、統一分隔符、去掉結尾 `/`。
 * 專案根目錄相對路徑是 `code-paths` 的唯一寫法(doc-lifecycle.md),兩邊都照這個攤平再比。
 */
function normPath(p) {
  return String(p ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
}

/**
 * 一條 code-paths 條目與被查路徑的關係:
 *   exact  完全相同
 *   prefix 條目是目錄,涵蓋被查的檔案(子系統 design.md 的寫法就是這種)
 *   under  被查的是目錄,條目落在它底下(查一整個資料夾時用)
 */
function pathRel(entry, want) {
  const e = normPath(entry);
  const w = normPath(want);
  if (!e || !w) return null;
  if (e === w) return "exact";
  if (w.startsWith(`${e}/`)) return "prefix";
  if (e.startsWith(`${w}/`)) return "under";
  return null;
}

const REL_LABEL = { exact: "完全相符", prefix: "路徑前綴涵蓋", under: "在查詢目錄底下" };

if (query.file) {
  const want = normPath(query.file);
  console.log(`=== 程式碼路徑 ${want} ===`);

  // 1) 歸屬:子系統 design.md 的 code-paths 是路徑前綴
  const owners = [];
  for (const [slug, entry] of subsysDocs) {
    for (const cp of asList(entry.designMeta?.["code-paths"])) {
      const r = pathRel(cp, want);
      if (r) owners.push(`- ${slug}  (${entry.designFile} 的 code-paths ${cp} ${REL_LABEL[r]})`);
    }
  }
  const anySubsysCodePaths = [...subsysDocs.values()].some((e) => asList(e.designMeta?.["code-paths"]).length > 0);
  printBlock(
    "子系統歸屬",
    owners.length
      ? owners
      : [
          anySubsysCodePaths
            ? "(無)沒有子系統的 code-paths 涵蓋這條路徑"
            : "(無)全樹沒有任何 design.md 填了 code-paths —— 這一欄是選填的,補上才問得出歸屬",
        ],
  );

  // 2) 認領:任務文檔的 code-paths 由 impl / bugfix 在收尾與 status 一起回寫
  const hits = [];
  for (const r of rows) {
    let best = null;
    for (const cp of r.codePaths) {
      const rel2 = pathRel(cp, want);
      if (!rel2) continue;
      if (!best || rel2 === "exact") best = { rel: rel2, cp };
    }
    if (best) hits.push({ row: r, ...best });
  }
  hits.sort((a, b) => (a.row.created || "").localeCompare(b.row.created || "") || rowName(a.row).localeCompare(rowName(b.row)));

  printBlock(
    `動過這條路徑的任務文檔(${hits.length})`,
    hits.map(({ row, rel: r2, cp }) => {
      const kind = row.type === "feature" ? "建立" : row.type === "enhance" ? "優化" : "修復";
      return `- ${rowName(row)}  [${row.status}]  ${kind}  ${row.created}  ${row.file}\n    ${row.description}  (${REL_LABEL[r2]}:${cp})`;
    }),
  );

  const anyTaskCodePaths = rows.some((r) => r.codePaths.length > 0);
  if (hits.length === 0) {
    console.log(
      anyTaskCodePaths
        ? "\n沒有任何 F/E/B 的 code-paths 涵蓋這條路徑。兩種可能:這段程式碼不是走本流程產生的,\n" +
            "或動過它的文檔收尾時沒回寫 code-paths(那一欄應該與 status: done 同一個動作寫進去)。"
        : "\n全樹沒有任何任務文檔填了 code-paths —— 反查在這個專案還沒有資料可用。\n" +
            "這一欄由 /spec-impl 與 /bugfix 在收尾回寫;既有文檔要補的話,打開該文檔的實作範圍逐份補上。",
    );
  }

  console.log(QUERY_TAIL);
  process.exit(hits.length ? 0 : 2);
}

if (query.subsys) {
  const slug = query.subsys.trim();
  if (!subsysDocs.has(slug) && plannedSubsys.includes(slug)) {
    // 名冊上有、還沒建 design.md:這是「還沒做」,不是「查無此物」
    const st = stages.find((x) => x.subsys.includes(slug));
    console.log(`=== 子系統 ${slug}(${subsysBriefs.get(slug) ?? "-"})===`);
    console.log(`狀態  已列入 system.md 的 subsystems 名冊,**尚未建 design.md**${st ? `(${stageName(st)} ${st.status})` : ""}`);
    console.log(`檔案  subsystems/${slug}/design.md 不存在`);
    console.log(`\n=== §1 能不能開工 ===\n**未開工。** ${slug} 的職責與邊界只寫在 system.md 的「子系統劃分」;沒有契約、也沒有任何 feature 文檔,不在任何進度分母裡。`);
    const waiting = [...contractIds.values()].filter((c) => c.affects.includes(slug)).map((c) => `${c.id}-${c.slug}(共用契約)`)
      .concat(rows.filter((r) => r.subsystem === "global" && r.affects.includes(slug)).map((r) => `${rowName(r)}(${zh(r.status)})`));
    printBlock("§2 誰在等它建檔", waiting.map((w) => `- ${w}:它的 ${slug} 那一半在建檔前動不了`));
    console.log(`\n=== §3 下一步 ===\n/subsys-design ${slug} —— 與其他子系統的工作互不影響,可以同時開。`);
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
  const scope = (x) => x.subsystem === slug;
  const st = stages.find((x) => x.subsys.includes(slug));
  const myGroups = entry.groups;
  const plannedHere = myGroups.filter((g) => g.status === "planned");
  const openEB = mine.filter((r) => r.type !== "feature" && isUnfinished(r));

  // 身份卡
  console.log(`=== 子系統 ${slug}(${srow?.description ?? "-"})${st ? ` · ${stageName(st)} ${st.status}` : ""} ===`);
  console.log(`職責  ${subsysBriefs.get(slug) ?? srow?.description ?? "-"}(system.md「子系統劃分」)`);
  console.log(`狀態  status ${srow?.status ?? "-"}  |  模組群 ${srow?.groups ?? "-"}  |  契約就緒 ${srow?.cards ?? "-"}  |  核心 ${srow?.progress ?? "-"}${srow?.runnable ? "(可運作)" : ""}  |  擴充 ${srow?.ext ?? "-"}(核心的分母只有已建 F 檔的部分;可運作只看核心)`);
  console.log(`檔案  ${entry.designFile ?? "⚠ 缺 design.md"}`);
  if (entry.parts.length)
    console.log(
      `分冊  ${entry.parts.length} 份(design.md 的延伸,契約條目可能住在這裡,對帳要一起讀):\n` +
        entry.parts.map((p) => `      ${p.file}  [${p.type}]${p.description ? `  ${p.description}` : ""}`).join("\n"),
    );
  const remaining = [
    ...mine.filter((r) => r.type === "feature" && isUnfinished(r)).map((r) => `${rowName(r)}(${STATE_LABEL[dispatch.get(docKey(slug, r.id))?.state]})`),
    ...plannedHere.map((g) => `${slug}/${g.name} 模組群開工`),
    ...openEB.map((r) => `${rowName(r)}(${r.type === "enhance" ? "擴充,不擋階段" : "缺陷"},${STATE_LABEL[dispatch.get(docKey(slug, r.id))?.state]})`),
  ];
  const coreLeft = remaining.length - openEB.filter((r) => r.type === "enhance").length;
  console.log(remaining.length ? `${srow?.runnable ? "已可運作;" : `可運作還差 ${coreLeft} 項核心;`}全部完成還差 ${remaining.length} 項:${remaining.join("、")}` : "全部完成(核心 F 全 done、無未結 E/B、無 planned 模組群)");

  // §1 漏斗
  console.log(`\n=== §1 完成度漏斗(模組群 ${myGroups.length || 1})===`);
  const feats = mine.filter((r) => r.type === "feature" && !DROPPED_STATUSES.has(r.status));
  const funnel = (fs) => ({
    planned: String(fs.filter((r) => r.status === "planned").length),
    specced: String(fs.filter((r) => r.status === "specced").length),
    done: String(fs.filter((r) => DONE_STATUSES.has(r.status)).length),
    note: fs.filter(isUnfinished).map((r) => `${r.id} ${STATE_LABEL[dispatch.get(docKey(slug, r.id))?.state]}`).join("、") || (fs.length ? "全部完成" : "-"),
  });
  if (myGroups.length === 0) {
    printTable({ name: "模組群", status: "狀態", planned: "已規劃", specced: "規格已寫", done: "已實作", note: "未完成的" }, [{ name: `${slug}(單一領域)`, status: "active", ...funnel(feats) }]);
  } else {
    printTable(
      { name: "模組群", status: "狀態", planned: "已規劃", specced: "規格已寫", done: "已實作", note: "未完成的 / 備註" },
      myGroups.map((g) => {
        const fs = myGroups.length === 1 ? feats : feats.filter((r) => r.group.toLowerCase() === g.name.toLowerCase());
        return g.status === "planned"
          ? { name: `${slug}/${g.name}`, status: "planned", planned: "-", specced: "-", done: "-", note: `未開工:契約章節未寫、feature 檔未建${g.brief ? `(${g.brief})` : ""}` }
          : { name: `${slug}/${g.name}`, status: "active", ...funnel(fs) };
      }),
    );
    if (plannedHere.length) console.log(`planned 的模組群沒有契約、沒有 feature 檔,**不在上面「進度 ${srow?.progress ?? "-"}」那個分母裡**。`);
  }

  // §2 子系統之間
  console.log("\n=== §2 子系統之間 ===");
  const out = [];
  for (const r of mine)
    for (const ref of r.dependsOn) {
      const k = refKey(ref, slug);
      if (k.startsWith(`${slug}/`)) continue; // 子系統內部依賴,漏斗已經看得到
      out.push(`- ${rowName(r)} → ${fmtRef(k, ref).slice(2)}`);
    }
  printBlock("我等誰(對外依賴)", out);
  const back = [];
  for (const [k, list] of reverseDeps) {
    if (!k.startsWith(`${slug}/`)) continue;
    for (const { row, ref } of list) {
      if (row.subsystem === slug) continue; // 內部依賴不算反向跨界
      const dd = dispatch.get(docKey(row.subsystem, row.id));
      back.push(`- ${rowName(row)}(${dd ? STATE_LABEL[dd.state] : zh(row.status)})依賴 ${refFullName(k, null)}(該文檔的 depends-on 寫成 ${ref})  ${row.file}`);
    }
  }
  printBlock("誰等我(反向依賴)—— B1 的候選清單", back.sort());
  const cross = rows.filter((r) => r.subsystem === "global" && r.affects.includes(slug));
  printBlock(
    "跨子系統的任務文檔(G-F / G-E / G-B 掛在本子系統身上的)",
    cross.map((r) => {
      const dd = dispatch.get(docKey("global", r.id));
      return `- ${rowName(r)}(${dd ? STATE_LABEL[dd.state] : zh(r.status)})橫跨 ${r.affects.join(" + ")}${dd?.partial.length ? `;${dd.partial.join("、")} 未建檔,只能先做本子系統這一半` : ""}`;
    }),
  );
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
      const c = contractIds.get(bare);
      const others = c ? c.affects.filter((s) => s !== slug).map(subsysBrief) : [];
      return fmtRef(bare, bare) + (others.length ? `\n  另一邊:${others.join("、")} —— 改條目要通知它們` : "") + (items.length ? `\n  用到的條目:${items.join("、")}` : "\n  ⚠ 只引用了文檔 id,沒寫到條目(引用格式見 doc-lifecycle.md)");
    }),
  );

  // §3 平行道
  const lanes = buildLanes(scope);
  console.log(`\n=== §3 本子系統能開幾條線(${lanes.length})===`);
  printLanes(lanes);

  // §4 卡住
  const blocked = blockedRows(scope, true);
  console.log(`\n=== §4 卡住的,誰卡誰(${blocked.length})===`);
  printBlocked(blocked, true);

  // §5 等決定
  const decisions = decisionLines(scope, (sp) => sp.affects.includes(slug) || mine.some((r) => spikeFeeds(sp, r.subsystem, r.id)));
  console.log(`\n=== §5 等決定的(${decisions.length})===`);
  if (decisions.length === 0) console.log("(無)");
  for (const l of decisions) console.log(l);

  // §6 牽動
  console.log("\n=== §6 動一個牽動誰 ===");
  for (const l of impactLines(scope)) console.log(l);

  // §7 警訊
  const issues = archIssues.filter(inScope);
  const notes = archNotes.filter(inScope);
  const bad = badFormat.filter((b) => b.file.includes(`subsystems/${slug}/`));
  console.log("\n=== §7 警訊 ===");
  printWarnings(issues, notes, bad);

  // §8 建議路線
  console.log("\n=== §8 建議路線(機械排序,理由由人補)===");
  for (const l of routeLines(lanes, blocked)) console.log(l);

  // 附錄
  console.log(`\n=== 附錄 A:本子系統的文檔(${mine.length})===`);
  if (mine.length === 0) console.log("(還沒有任何 feature / enhance / bugfix 文檔)");
  else
    printTable(
      { description: "主軸", name: "文檔(全名)", type: "type", status: "status", dependsOn: "depends-on", updated: "updated", file: "file" },
      mine.map((r) => ({ ...r, name: rowName(r), status: `${r.status}${gapFlag(r)}`, dependsOn: fmtValue(r.dependsOn) })),
    );
  const relSpikes = spikes.filter((sp) => sp.affects.includes(slug) || mine.some((r) => spikeFeeds(sp, r.subsystem, r.id)));
  if (relSpikes.length) printBlock(`附錄 B:相關 spike(${relSpikes.length})—— 這個子系統的決定有哪些證據`, relSpikes.map(spikeLine));
  const pend = pendingFeatures.filter((f) => f.subsystem === slug);
  const gaps = openGaps.filter((g) => g.scope === slug);
  printBlock(
    `附錄 C:警訊全文 —— 不一致(${issues.length})/ 提示(${notes.length})/ frontmatter(${bad.length})`,
    [...issues.map((m) => `- ${m}`), ...notes.map((m) => `- ${m}`), ...bad.map((b) => `- ${b.file}:${b.keys.join("、")} 寫成 YAML 區塊列表`)],
  );

  console.log(QUERY_TAIL);

  const unfinishedHere = mine.filter((r) => !DONE_STATUSES.has(r.status));
  process.exit(unfinishedHere.length || issues.length || bad.length || gaps.length || pend.length || plannedHere.length ? 1 : 0);
}

// ---------------------------------------------------------------- --write-index

if (writeIndex) {
  // 「功能總覽」是**生成**的:手改無效。它存在的唯一理由是讓人一眼看完子系統,
  // 每一格的權威都在各自的 F00x 檔 —— 所以這裡只覆寫兩個標記之間,不碰 design.md 的其他部分。
  const BEGIN = "<!-- BEGIN FEATURE INDEX";
  const END = "<!-- END FEATURE INDEX -->";
  let failed = 0;
  for (const [slug, { designFile, feats }] of featureIndex) {
    if (!designFile) continue;
    const path = join(designDir, designFile.replace(/^.*?subsystems\//, "subsystems/"));
    const text = readFileSync(path, "utf8");
    const lines = text.split(/\r?\n/);
    const b = lines.findIndex((l) => l.includes(BEGIN));
    const e = lines.findIndex((l) => l.includes(END));
    if (b < 0 || e < 0 || e < b) {
      console.log(`✗ ${designFile}:找不到 FEATURE INDEX 標記,請先補一節「## 功能總覽」並放入 ${BEGIN}…-->/${END}`);
      failed++;
      continue;
    }
    const sorted = [...feats].sort((x, y) => x.id.localeCompare(y.id));
    const hasGroup = sorted.some((r) => r.group);
    const block = [
      `| id | feature | 階段 |${hasGroup ? " 模組群 |" : ""} 模組 | 狀態 |`,
      `|---|---|---|${hasGroup ? "---|" : ""}---|---|`,
      ...sorted.map((r) => `| ${r.id} | ${r.slug} | ${r.stage === "-" ? "" : r.stage} |${hasGroup ? ` ${r.group} |` : ""} ${r.modules.join("、")} | ${r.status} |`),
    ];
    lines.splice(b + 1, e - b - 1, ...block);
    writeFileSync(path, lines.join("\n"));
    console.log(`✓ ${designFile}:${sorted.length} 個 feature`);
  }
  process.exit(failed ? 1 : 0);
}

// ---------------------------------------------------------------- 輸出(盤點模式)
//
// 版面是「位置 → 能動的 → 卡住的 → 等決定的 → 牽動誰 → 警訊 → 路線 → 附錄」:
// 前面七段回答「今天派哪幾條線」,原始表格全部退到附錄當證據。三種模式共用同一個骨架,
// 只差縮放層級(產品 / 子系統 / 一份文檔)。

if (rows.length === 0 && subsysRows.length === 0 && !systemMeta) {
  console.log(`design 目錄(${designDir})下沒有任何文檔。`);
  process.exit(0);
}

const unfinished = rows.filter((r) => !DONE_STATUSES.has(r.status));
const listed = showAll ? rows : unfinished;
const counts = {};
for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
const stageCnt = { 已達成: 0, 進行中: 0, 未開始: 0, "?": 0 };
for (const st of stages) stageCnt[st.status]++;
const nState = (st) => byState(st).length;
const builtN = subsysRows.filter((s) => s.built).length;

// 標題與一句話
const title = systemMeta ? `${fmtValue(systemMeta.title)}(${fmtValue(systemMeta.description)})` : "(找不到 system.md)";
console.log(`=== ${title} 專案狀態 · ${today} ===`);
const modeLabel = projectMode
  ? `${projectMode}(${projectMode === "greenfield" ? "全新建立:禁問 migration 與向後相容" : "維護型:migration 與既有呼叫端必問"})`
  : "⚠ 未宣告(問開發者一次再回寫 system.md)";
if (systemMeta) console.log(`專案模式  ${modeLabel}`);
console.log(
  `一句話  ` +
    (stages.length ? `開發階段 已達成 ${stageCnt["已達成"]} / 進行中 ${stageCnt["進行中"]} / 未開始 ${stageCnt["未開始"]}(共 ${stages.length})` : "沒有開發階段表,產品完成度無法量化") +
    ` · 子系統建檔 ${builtN}/${subsysRows.length} · 可運作 ${subsysRows.filter((s) => s.runnable).length}/${subsysRows.length}` +
    ` · 可開工 ${nState("ready")} · 半步 ${nState("half")} · 卡住 ${nState("blocked")} · 等決定 ${nState("deciding")}` +
    ` · 未開工 ${plannedSubsys.length + plannedGroupRows.length}(子系統 ${plannedSubsys.length}、模組群 ${plannedGroupRows.length})`,
);

// §1 產品走到哪
console.log("\n=== §1 產品走到哪(分母是規劃,不是已建的資料夾)===");
if (!systemMeta) console.log("找不到 system.md(尚未執行 /system-design):沒有名冊、沒有開發階段,答不出「還差什麼」。");
else if (stages.length === 0) console.log("system.md 沒有「開發階段」表:產品完成度無法量化,只有下面已展開部分的百分比。先用 /system-design 補上。");
else {
  const details = stages.map((st) => ({ st, ...stageDetail(st) }));
  printTable(
    { id: "階段", title: "名稱", status: "狀態", subsys: "涵蓋子系統", expanded: "已展開的部分", notExpanded: "還沒展開的部分" },
    details.map(({ st, expanded, notExpanded }) => ({ id: st.id, title: truncate(st.title, DESC_WIDTH), status: st.status, subsys: st.subsys.join("、") || "-", expanded, notExpanded })),
  );
  for (const { st, todo, ext } of details) {
    if (st.status === "已達成") continue;
    console.log(
      (todo.length ? `${stageName(st)} 要達成還差 ${todo.length} 件(只數核心 F / G-F):${todo.join("、")}` : `${stageName(st)} 標 ${st.status},但底下已經沒有任何未完成的核心項目 —— 該改成已達成,或涵蓋子系統漏列了`) +
        (ext ? `;另有擴充 E ${ext} 件不擋階段` : ""),
    );
  }
  if (stageCnt["未開始"] + stageCnt["進行中"] > 0) console.log("**專案還沒做完**:下面所有百分比只涵蓋已展開的部分,未開始的階段完全不在那些分母裡。");
}
if (subsysRows.length) console.log(`子系統建檔 ${builtN}/${subsysRows.length}(名冊列了 ${subsysRows.length} 個,${plannedSubsys.length} 個還沒有 design.md)`);

// §2 平行道
const lanes = buildLanes();
console.log(`\n=== §2 今天能開幾條線(${lanes.length})===`);
printLanes(lanes);

// §3 卡住
const blocked = blockedRows();
console.log(`\n=== §3 卡住的,誰卡誰(${blocked.length})===`);
printBlocked(blocked);

// §4 等決定
const decisions = decisionLines();
console.log(`\n=== §4 等決定的(${decisions.length})===`);
if (decisions.length === 0) console.log("(無)");
for (const l of decisions) console.log(l);

// §5 牽動
console.log("\n=== §5 動一個牽動誰 ===");
for (const l of impactLines()) console.log(l);

// §6 警訊
const noDesc = rows.filter((r) => r.description === "-");
console.log("\n=== §6 警訊 ===");
printWarnings(archIssues, archNotes, badFormat);
if (noDesc.length) console.log(`缺少 description / 主軸(${noDesc.length}):${noDesc.map(rowName).join("、")}`);

// §7 路線
console.log("\n=== §7 建議路線(機械排序,理由由人補)===");
for (const l of routeLines(lanes, blocked)) console.log(l);

// ---- 附錄:原始表格,都是上面各段的證據 ----
if (rows.length === 0) {
  console.log(`\n=== 附錄 A:任務文檔 ===\ndesign 目錄(${designDir})下沒有任何任務文檔(features / enhancements / bugfixes)。`);
} else {
  const doneCount = rows.length - unfinished.length;
  console.log(`\n=== 附錄 A:任務文檔:${showAll ? `全部(${rows.length} 份)` : `未完成(${unfinished.length}/${rows.length} 份)`}===`);
  console.log(`狀態統計:${Object.entries(counts).sort().map(([st, n]) => `${st} ${n}`).join("、")}`);
  if (listed.length === 0) {
    console.log("沒有未完成的任務文檔(全部收束成 done / closed);要看完整清單跑 --all。");
  } else {
    // 欄位順序:主軸(description)優先,文檔全名次之。全名自帶子系統,所以不另立子系統欄
    printTable(
      { description: "主軸", name: "文檔(全名)", type: "type", status: "status", dispatch: "派工", revCol: "rev", updated: "updated", dependsOn: "depends-on", file: "file" },
      listed.map((r) => ({ ...r, name: rowName(r), status: `${r.status}${gapFlag(r)}`, dispatch: STATE_LABEL[dispatch.get(docKey(r.subsystem, r.id))?.state] ?? "-", revCol: r.rev === null ? "-" : String(r.rev), dependsOn: fmtValue(r.dependsOn) })),
    );
    if (!showAll && doneCount > 0) console.log(`(已完成的 ${doneCount} 份不列在這裡 —— 它們已經算進附錄 B 的進度欄;要全表跑 --all)`);
  }
}

console.log("\n=== 附錄 B:子系統狀態 ===");
if (systemMeta) console.log(`主架構 system:${fmtValue(systemMeta.description)}  [${fmtValue(systemMeta.status)}]  subsystems: ${fmtValue(systemMeta.subsystems)}`);
else console.log("主架構:找不到 system.md(尚未執行 /system-design)");
if (subsysRows.length === 0) {
  console.log("(subsystems/ 下沒有任何子系統;專案未拆子系統時屬正常,否則請用 /subsys-design 建立)");
} else {
  printTable(
    { description: "主軸", id: "子系統", status: "status", groups: "模組群", phases: "階段", features: "F", exts: "E", cards: "契約就緒", onlyPlanned: "僅規劃", specced: "已寫spec", done: "已實作", openB: "未結B", progress: "核心", ext: "擴充" },
    subsysRows,
  );
  const built = subsysRows.filter((s) => s.built);
  const tracked = built.filter((s) => s.hasFeatures);
  const unknown = built.length - tracked.length;
  console.log(
    `可運作:${tracked.filter((s) => s.runnable).length}/${subsysRows.length} 個子系統的核心 F 全部實作完且無 planned 模組群(E 不進這個分母);全部完成(含 E 與 B):${tracked.filter((s) => s.complete).length}/${subsysRows.length}` +
      (unknown > 0 ? `(另有 ${unknown} 個已建 design.md 但 features/ 是空的,進度未知)` : ""),
  );
  console.log("(「核心」欄的分母只是**該子系統 features/ 底下的檔案數**,不是產品完成度;產品完成度看 §1 的開發階段。「擴充」是 E 的 done/總數,不擋階段)");
  if (plannedSubsys.length)
    console.log(
      `已規劃、未建 design.md 的子系統(${plannedSubsys.length}):` +
        plannedSubsys.map((s) => `${s}${subsysBriefs.get(s) ? `(${subsysBriefs.get(s)})` : ""}`).join("、"),
    );
  if (plannedGroupRows.length)
    console.log(`已規劃、契約未寫的模組群(${plannedGroupRows.length}):` + plannedGroupRows.map((g) => `${g.subsystem}/${g.name}${g.brief ? `(${g.brief})` : ""}`).join("、"));
}

const appendixC = [];
if (Object.keys(adrCounts).length > 0) appendixC.push(`ADR:${Object.entries(adrCounts).sort().map(([s, n]) => `${s} ${n}`).join("、")}(共 ${adrIds.size} 份)`);
if (contractIds.size > 0) {
  appendixC.push(`全域契約(${contractIds.size}),不是任務文檔、不計入進度;查單一份用 --doc G-C001-<slug>:`);
  for (const c of contractIds.values()) appendixC.push(`- ${c.id}-${c.slug}  [${c.status}]  使用:${c.affects.join("、") || "-"}  ${c.file}  ${c.description}`);
}
if (spikes.length > 0) {
  appendixC.push(`spike(${spikes.length},open ${openSpikes.length}),不進任何百分比:`);
  for (const sp of spikes) appendixC.push(spikeLine(sp));
}
if (appendixC.length) printBlock("附錄 C:ADR / 全域契約 / spike", appendixC);

printBlock(
  `附錄 D:警訊全文 —— 不一致(${archIssues.length})/ 提示(${archNotes.length})/ frontmatter 格式(${badFormat.length})`,
  [
    ...archIssues.map((m) => `- ${m}`),
    ...archNotes.map((m) => `- ${m}`),
    ...badFormat.flatMap((b) => [`- ${b.file}:${b.keys.join("、")} 寫成 YAML 區塊列表`, ...b.keys.map((k) => `  改成 → ${k}: [item-a, item-b]`)]),
  ],
);

const openSubsysRows = subsysRows.filter((s) => !s.complete);
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
  openGaps.length > 0 ||
  openSpikes.length > 0
) {
  process.exit(1);
}
console.log(
  "\n全部項目皆已完成(done/closed)、名冊上每個子系統都已建檔且跑完路線圖、" +
    "沒有 planned 模組群、開發階段全數已達成、沒有 open 的 spike,且 metadata 完整。",
);
process.exit(0);
