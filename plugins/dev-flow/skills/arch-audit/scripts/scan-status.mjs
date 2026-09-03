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
 *   node scan-status.mjs .design --doc <文檔>          聚焦文檔:歸屬 / 介面 / 契約 / 正反向依賴
 *                                                     吃全名 auth/F003-token-cache,也吃 auth/F003 與 F003
 *   node scan-status.mjs .design --file <path>         反查程式碼路徑:哪個子系統、被哪些 F/E/B 動過
 *   node scan-status.mjs --help
 *
 * Exit code(**兩種模式語意不同**,呼叫端不要混用):
 *   盤點 / --subsys : 0 = 範圍內全部完成(或無檔案) / 1 = 有未完成項目、metadata 缺失或架構不一致
 *   --doc           : 0 = 查到 / 2 = 查無此文檔(查到但未完成仍是 0——查詢不是驗收)
 *   --file          : 0 = 有文檔的 code-paths 涵蓋它 / 2 = 沒有任何文檔認領這條路徑
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
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseGapBlocks } from "./_gap-status.mjs";
import { parseFrontmatter, readFrontmatter, asList } from "./_frontmatter.mjs";
import { section } from "./_sections.mjs";
import { dataCells, isSeparatorRow } from "./_tables.mjs";
import { printHelpIfAsked, usageBlock } from "./_help.mjs";

/** 用法字串取自本檔檔頭(唯一產地),不另寫一份 —— 兩份只會在改旗標時分岔 */
const USAGE = usageBlock(import.meta.url);

const argv = process.argv.slice(2);
printHelpIfAsked(argv, import.meta.url);
const query = { subsys: null, doc: null, file: null };
let designDirArg = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--help" || a === "-h") {
    console.log(USAGE);
    process.exit(0);
  } else if (a === "--subsys") query.subsys = argv[++i] ?? null;
  else if (a === "--doc") query.doc = argv[++i] ?? null;
  else if (a === "--file") query.file = argv[++i] ?? null;
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
  const { meta, blockListKeys } = readFrontmatter(path);
  const relPath = rel(path);
  if (blockListKeys.length) badFormat.push({ file: relPath, keys: blockListKeys });
  const fileName = path.split(/[\\/]/).pop();
  const fileId = fileName.match(/^(G-[CEB]\d{3}|[FEB]\d{3})/)?.[1] ?? null;
  // 檔名 slug:全名 `auth/F002-token-refresh` 的最後一段。裸 id 指不到東西(每個子系統各有一組 F001),
  // 所以印給人看的每一行都用全名,不用 id(conventions.md「指稱紀律」)。
  const fileSlug = fileName.replace(/\.md$/, "").replace(/^(?:G-[CEB]\d{3}|[FEB]\d{3})-?/, "");
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
const subsysDocs = new Map(); // slug → { designMeta, designFile, roadmap, parts, ids: Map(id → row) }

/** 子系統資料夾根層的固定檔案;其餘 .md 只能是 design.md 的分冊。 */
const SUBSYS_CORE_FILES = new Set(["design.md", "build-log.md", "spec-gaps.md"]);
/** 分冊的合法 type(doc-lifecycle.md「子系統文檔的分冊」是權威,改這裡之前先改那份)。 */
const PART_TYPES = new Set(["contract-part", "decisions"]);

for (const slug of subsysDirs) {
  const dir = join(subsysRoot, slug);
  const entry = { designMeta: null, designFile: null, roadmap: { phases: 0, features: [] }, cards: new Set(), groups: [], parts: [], ids: new Map() };
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

  // ---- design.md 的分冊:契約章節太大時拆出去的檔案(type: contract-part / decisions)
  // 它們沒有編號、由 `parent` 指回子系統。不認得它們的話,子系統契約有一半是隱形的 ——
  // A3 的契約卡對帳、/subsys 的契約檢查都會在 design.md 裡找不到條目而誤判「契約缺漏」。
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
  const out = [];
  for (const g of parseGapBlocks(text)) {
    for (const issue of g.issues) archIssues.push(`${file}:${issue}`);
    out.push({ scope, file, id: g.id, head: g.head, topic: g.topic, fix: g.fix, resolved: g.resolved });
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
const gapDocRef = (head) => head.match(/\b(G-[CEB]\d{3}|[FEB]\d{3})\b/)?.[1] ?? null;
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

// 結案證據:標了 resolved 就要指得出「改的是哪份文檔、什麼時候改的」。
// 沒有證據的結案 = spec 可能根本沒改,只是把狀態改掉讓閘門放行(spec-roles.md「spec-gaps 協議」)。
const docUpdated = new Map(); // "<subsys>/<id>" 與裸 "<id>" 都放,寬鬆比對
for (const r of rows) {
  const u = r.updated && r.updated !== "-" ? r.updated : null;
  docUpdated.set(`${r.subsystem}/${r.id}`, u);
  if (!docUpdated.has(r.id)) docUpdated.set(r.id, u);
}
for (const g of allGaps.filter((x) => x.resolved)) {
  if (!g.fix) {
    archIssues.push(`${g.file}:${g.id} 標了 resolved 但沒有「修訂」行(結案沒有證據,無法確認 spec 真的改過)`);
    continue;
  }
  const docId = g.fix.match(/\b(G-[CEB]\d{3}|[FEB]\d{3})\b/)?.[1];
  if (!docId) {
    archIssues.push(`${g.file}:${g.id} 的「修訂」沒指出文檔 id(格式:<文檔 id> §<章節>(<日期>);<改了什麼>)`);
    continue;
  }
  const key = `${g.scope}/${docId}`;
  const known = docUpdated.has(key) ? key : docUpdated.has(docId) ? docId : null;
  if (!known) {
    archIssues.push(`${g.file}:${g.id} 的「修訂」指向 ${docId},但找不到這份文檔`);
    continue;
  }
  const fixedAt = g.fix.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  const updated = docUpdated.get(known);
  if (fixedAt && updated && updated < fixedAt)
    archIssues.push(`${g.file}:${g.id} 結案於 ${fixedAt},但 ${docId} 的 updated 是 ${updated}(spec 沒在結案當天或之後改過)`);
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
    if (isSeparatorRow(cells)) continue;
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
    if (claimed.has(f.doc)) archIssues.push(`${entry.designFile}:功能規劃有兩列都指向 ${slug}/${f.doc}`);
    claimed.add(f.doc);
    const row = entry.ids.get(f.doc);
    if (!row) archIssues.push(`${entry.designFile}:功能規劃的 ${slug}/${f.doc}(${f.feature})在 ${slug}/features/ 找不到對應文檔`);
    else if (DONE_STATUSES.has(row.status)) done++;
  }
  // features/ 有文檔、但功能規劃沒認領 → 提示回填路線圖
  for (const [id, row] of entry.ids) {
    if (/^F\d{3}$/.test(id) && !claimed.has(id))
      archNotes.push(`${row.file}:${rowName(row)} 沒有出現在 ${slug}/design.md 的功能規劃裡(建議回填該表的 doc 欄)`);
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
        `${entry.designFile}:模組群 ${slug}/${g.name} 還是 planned(契約章節與功能規劃未寫)` +
          `${g.brief ? `——${g.brief}` : ""};${slug}/${g.name} 不在 ${slug} 子系統的進度分母裡`,
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
    parts: entry.parts,
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

// ---------------------------------------------------------------- 查詢模式(--subsys / --doc)

/** 文檔的正規化鍵:子系統文檔 `<slug>/<id>`,全域文檔 `<id>`。只當索引用,不印給人看 */
const docKey = (subsystem, id) => (subsystem && subsystem !== "global" ? `${subsystem}/${id}` : id);

/**
 * 文檔的**全名**:`<子系統>/<id>-<檔名 slug>`(全域文檔沒有子系統那一段)。
 * 印給人看的一律用這個,不用裸 id —— 每個子系統各有一組 F001/E001/B001,
 * 單獨一個 `E001` 答不出「哪個子系統的哪一份、在改什麼」,而問這句話的成本由讀的人付。
 * 規則見 `_shared/conventions.md`「指稱紀律」與 `doc-lifecycle.md`「文檔引用格式」。
 */
const fullName = (subsystem, id, slug) =>
  `${subsystem && subsystem !== "global" ? `${subsystem}/` : ""}${id}${slug ? `-${slug}` : ""}`;
const rowName = (r) => fullName(r.subsystem, r.id, r.slug);

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

const QUERY_TAIL =
  "\n本腳本只產生索引,不下判斷:它答得出「哪份文檔、什麼狀態、誰依賴誰」,答不出「那份文檔寫的對不對」。\n" +
  "要寫進 spec 的每一條介面,仍須打開該文檔讀原文。各角色的使用界線見 _shared/design-query.md。";

if (query.doc) {
  const want = query.doc.trim();
  // 全名 `auth/F002-token-refresh` 是回報與定錨區塊裡的寫法,直接貼進 --doc 就要查得到:
  // 剝掉 id 後面的 slug,`auth/F002` 與 `F002` 也照樣吃。
  const bare = want
    .split("#")[0]
    .replace(/^((?:[a-z0-9-]+\/)?(?:G-[CEB]\d{3}|ADR-\d{3}|[FEB]\d{3}))-[a-z0-9-]+$/, "$1");

  // 1) 全域契約
  if (contractIds.has(bare)) {
    const c = contractIds.get(bare);
    const text = readFileSync(c.path, "utf8");
    console.log(`=== 全域契約 ${c.id}-${c.slug} ===`);
    console.log(`主軸  ${c.description}`);
    console.log(`歸屬  全域共用契約(不屬於任何單一子系統)  |  status ${c.status}`);
    console.log(`使用  ${c.affects.length ? c.affects.join("、") : "⚠ 未列 subsystems"}`);
    console.log(`檔案  ${c.file}`);

    const entries = section(text, /契約條目/);
    printBlock("契約條目", entries ? entries.text.split("\n") : ["(這份契約沒有「契約條目」章節——格式見 doc-lifecycle.md「全域契約文檔」)"]);

    const users = [];
    for (const [k, list] of reverseDeps) {
      if (k.split("#")[0] !== bare) continue;
      for (const { row, ref } of list) users.push(`- ${rowName(row)}  [${row.status}]  引用 ${ref}  ${row.file}`);
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
    console.error(`查無此文檔: ${want}`);
    console.error(`(子系統文檔寫全名 auth/F003-token-cache,寫 auth/F003 或 F003 也吃;全域寫 G-E001-cache;共用契約寫 G-C001-session)`);
    process.exit(2);
  }

  const key = docKey(hit.subsystem, hit.id);
  const full = readFileSync(join(designDir, hit.file), "utf8");
  const entry = hit.subsystem !== "global" ? subsysDocs.get(hit.subsystem) : null;
  const road = entry?.roadmap.features.find((f) => f.doc === hit.id) ?? null;

  console.log(`=== 文檔 ${rowName(hit)} ===`);
  console.log(`主軸  ${hit.description}`);
  console.log(
    `歸屬  ${hit.subsystem === "global" ? "全域(跨子系統)" : `子系統 ${hit.subsystem}`}` +
      (road ? `  |  ${road.phase}  |  功能規劃「${road.feature}」` : "") +
      `  |  type ${hit.type}  |  status ${hit.status}${gapFlag(hit)}`,
  );
  if (hit.subsystem === "global") console.log(`受影響  ${hit.affects.length ? hit.affects.join("、") : "⚠ 未列 subsystems"}`);
  else if (entry?.designFile) console.log(`上層  ${entry.designFile}`);
  console.log(`檔案  ${hit.file}`);

  for (const [title, re] of [
    ["數據", /^數據$|數據與介面變動/],
    ["介面", /^介面$/],
  ]) {
    const sec = section(full, re);
    if (sec) printBlock(`${title}(原文)`, sec.text.split("\n"));
  }
  if (!section(full, /^數據$|數據與介面變動/) && !section(full, /^介面$/))
    printBlock("介面 / 數據", ["(這份文檔沒有「數據」或「介面」段——模板見 spec-design/templates/)"]);

  // 阻塞維度:有未結 gap 的文檔,下一步是修 spec,不是繼續做 —— 這件事不能只印在盤點模式
  if (hit.blockedBy?.length)
    printBlock(
      `卡住這份文檔的未結 gap(${hit.blockedBy.length})`,
      openGaps
        .filter((g) => hit.blockedBy.includes(g.id) && gapDocRef(g.head) === hit.id)
        .map(gapLine)
        .concat(["", `下一步是**修 ${rowName(hit)} 這份 spec**,不是繼續做:兩種相反的實作都會全綠,測試證明不了什麼。`]),
    );

  const usedContracts = contractRefsIn(full);
  printBlock("引用的全域契約", usedContracts.map((r) => fmtRef(r, r)));

  printBlock(
    "正向依賴(我依賴誰)",
    hit.dependsOn.map((ref) => fmtRef(refKey(ref, hit.subsystem), ref)),
  );

  const back = (reverseDeps.get(key) ?? []).map(
    ({ row, ref }) => `- ${rowName(row)}  [${row.status}]  引用 ${ref}  ${row.file}`,
  );
  printBlock("反向依賴(誰依賴我)", back.sort());

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
    console.log(`=== 子系統 ${slug} ===`);
    console.log(`主軸  ${subsysBriefs.get(slug) ?? "-"}`);
    console.log(`狀態  已列入 system.md 的 subsystems 名冊,**尚未建 design.md**${st ? `(${stageName(st)} ${st.status})` : ""}`);
    console.log(`檔案  subsystems/${slug}/design.md 不存在`);
    console.log(`\n${slug} 的職責與邊界只寫在 system.md 的「子系統劃分」;${slug} 沒有契約、沒有功能規劃、也沒有 feature 文檔。`);
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
  if (entry.parts.length)
    console.log(
      `分冊  ${entry.parts.length} 份(design.md 的延伸,契約條目可能住在這裡,對帳要一起讀):\n` +
        entry.parts.map((p) => `      ${p.file}  [${p.type}]${p.description ? `  ${p.description}` : ""}`).join("\n"),
    );

  if (entry.groups.length > 0) {
    console.log(`\n=== 模組群(${entry.groups.length})===`);
    printTable(
      { name: "模組群", status: "狀態", prog: "進度", brief: "職責" },
      entry.groups.map((g) => ({
        name: `${slug}/${g.name}`,
        status: g.status,
        prog: g.status === "planned" ? "未展開" : `${g.done}/${g.total}`,
        brief: truncate(g.brief || "-", DESC_WIDTH),
      })),
    );
    if (entry.groups.some((g) => g.status === "planned"))
      console.log(`planned 的模組群沒有契約、沒有功能規劃,**不在上面「進度 ${srow?.progress ?? "-"}」那個分母裡**。`);
  }

  console.log(`\n=== 本子系統的文檔(${mine.length})===`);
  if (mine.length === 0) console.log("(還沒有任何 feature / enhance / bugfix 文檔)");
  else
    printTable(
      { description: "主軸", name: "文檔(全名)", type: "type", status: "status", dependsOn: "depends-on", file: "file" },
      mine.map((r) => ({ ...r, name: rowName(r), status: `${r.status}${gapFlag(r)}`, dependsOn: fmtValue(r.dependsOn) })),
    );

  const out = [];
  for (const r of mine)
    for (const ref of r.dependsOn) {
      const k = refKey(ref, slug);
      if (k.startsWith(`${slug}/`)) continue; // 子系統內部依賴,上表已經看得到
      out.push(`- ${rowName(r)} → ${fmtRef(k, ref).slice(2)}`);
    }
  printBlock("對外依賴(本子系統依賴誰)", out);

  const back = [];
  for (const [k, list] of reverseDeps) {
    if (!k.startsWith(`${slug}/`)) continue;
    for (const { row, ref } of list) {
      if (row.subsystem === slug) continue; // 內部依賴不算反向跨界
      back.push(`- ${rowName(row)} 依賴 ${refFullName(k, null)}(該文檔的 depends-on 寫成 ${ref})  [${row.status}]  ${row.file}`);
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
    pend.map((f) => `- ${slug} 功能規劃「${f.feature}」${f.phase && f.phase !== "-" ? `(${f.phase})` : ""}—— 還沒建 feature 文檔,所以還沒有編號`),
  );

  const gaps = openGaps.filter((g) => g.scope === slug);
  printBlock(`未結的 spec-gaps(${gaps.length})`, gaps.map(gapLine));

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
  // 欄位順序:主軸(description)優先,文檔全名次之。全名自帶子系統,所以不另立子系統欄
  printTable(
    { description: "主軸", name: "文檔(全名)", type: "type", status: "status", created: "created", dependsOn: "depends-on", file: "file" },
    rows.map((r) => ({ ...r, name: rowName(r), status: `${r.status}${gapFlag(r)}`, dependsOn: fmtValue(r.dependsOn) })),
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
  const modeLabel = projectMode
    ? `${projectMode}(${projectMode === "greenfield" ? "全新建立:禁問 migration 與向後相容" : "維護型:migration 與既有呼叫端必問"})`
    : "⚠ 未宣告(問開發者一次再回寫 system.md)";
  console.log(`主架構 system:${fmtValue(systemMeta.description)}  [${fmtValue(systemMeta.status)}]  subsystems: ${fmtValue(systemMeta.subsystems)}`);
  console.log(`專案模式  mode: ${modeLabel}`);
} else {
  console.log("主架構:找不到 system.md(尚未執行 /system-design)");
}
if (subsysRows.length === 0) {
  console.log("(subsystems/ 下沒有任何子系統;專案未拆子系統時屬正常,否則請用 /subsys-design 建立)");
} else {
  printTable(
    { description: "主軸", id: "子系統", status: "status", groups: "模組群", phases: "階段", features: "features", cards: "契約卡", specced: "已建文檔", done: "已完成", openEB: "未結E/B", progress: "進度" },
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
  console.log("system.md 的名冊列了下面這幾個子系統,但每一個都還沒有 Level 2 設計 —— 這幾個子系統的 feature 一個都還不存在,也不在任何進度分母裡。");
  for (const s of plannedSubsys) {
    const st = stages.find((x) => x.subsys.includes(s));
    console.log(`- ${s}  ${subsysBriefs.get(s) ?? "(system.md 子系統劃分沒撈到職責)"}${st ? `  [${stageName(st)} ${st.status}]` : ""}`);
  }
  console.log("下一步:挑上面其中一個子系統,跑 /subsys-design <子系統>。");
}

// ---- 已建檔子系統裡、還沒開工的模組群 ----
const plannedGroupRows = subsysRows.flatMap((s) => s.groupRows.filter((g) => g.status === "planned"));
if (plannedGroupRows.length > 0) {
  console.log(`\n=== 已規劃、契約未寫的模組群(${plannedGroupRows.length})===`);
  console.log("子系統的 design.md 認了下面這幾個模組群,但契約章節與功能規劃還沒寫 —— 這幾群不在各自子系統的進度分母裡。");
  for (const g of plannedGroupRows) console.log(`- ${g.subsystem}/${g.name}${g.brief ? `  ${g.brief}` : ""}`);
  console.log("下一步:對上面模組群所屬的子系統跑 /subsys-design <子系統> 更新模式,把該模組群的契約與功能規劃補上。");
}

if (Object.keys(adrCounts).length > 0) {
  console.log(`\nADR:${Object.entries(adrCounts).sort().map(([s, n]) => `${s} ${n}`).join("、")}(共 ${adrIds.size} 份)`);
}

if (contractIds.size > 0) {
  console.log(`\n=== 全域契約(${contractIds.size})===`);
  printTable(
    { description: "主軸", name: "契約(全名)", status: "status", affects: "使用的子系統", file: "file" },
    [...contractIds.values()].map((c) => ({ ...c, name: `${c.id}-${c.slug}`, affects: fmtValue(c.affects) })),
  );
  console.log("(契約不是任務文檔,不計入進度;查單一份用 --doc G-C001-<slug>)");
}

if (pendingFeatures.length > 0) {
  console.log(`\n=== 待展開的 feature:功能規劃有列、尚未建文檔(${pendingFeatures.length})===`);
  for (const f of pendingFeatures)
    console.log(
      `- ${f.subsystem} 功能規劃「${f.feature}」${f.phase && f.phase !== "-" ? `(${f.phase})` : ""}—— 還沒建 feature 文檔,所以還沒有編號`,
    );
}

if (openGaps.length > 0) {
  console.log(`\n=== 未結的 spec-gaps:qa / impl 提出、spec 尚未修訂(${openGaps.length})===`);
  console.log("上面被標了 ⚠卡 的文檔就是卡在下面這幾條 gap;那幾份文檔的下一步是**修 spec**,不是繼續做。");
  console.log("每一條未結 gap 都代表有項目正卡著;修 spec 前不要繼續往下做,也不要委派展開。");
  for (const g of openGaps) console.log(gapLine(g));
}

const unfinished = rows.filter((r) => !DONE_STATUSES.has(r.status));
if (unfinished.length > 0) {
  console.log(`\n=== 未完成 / metadata 缺失(${unfinished.length})===`);
  for (const r of unfinished) console.log(`- ${r.description}  [${r.status}${gapFlag(r)}] ${rowName(r)}  ${r.file}`);
}

const openSubsysRows = subsysRows.filter((s) => !s.complete);
if (openSubsysRows.length > 0) {
  console.log(`\n=== 未完成的子系統(${openSubsysRows.length})===`);
  for (const s of openSubsysRows)
    console.log(
      `- ${s.description}  [${s.status}] 子系統 ${s.id}  進度 ${s.progress}  未結 ${s.openEB}` +
        (s.plannedGroups > 0 ? `  ⚠ ${s.id} 還有 ${s.plannedGroups} 個模組群未開工` : ""),
    );
}

const noDesc = rows.filter((r) => r.description === "-");
if (noDesc.length > 0) {
  console.log(`\n=== 缺少 description / 主軸(${noDesc.length})===`);
  for (const r of noDesc) console.log(`- ${rowName(r)}  ${r.file}`);
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
