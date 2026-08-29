#!/usr/bin/env node
/**
 * scan-graph.mjs — 讀程式碼知識圖,把檔案級關係捲上子系統級,
 * 供 /arch-audit 的 system / subsys scope 使用。
 *
 * **與產生圖的工具無關**:只認 graph.json 的格式(契約見 _shared/codegraph.md),
 * 任何吐得出這個形狀的工具都能接。
 *
 *   nodes[]  必要 id / label / source_file,選填 source_location
 *   links[]  必要 source / target(節點 id)/ relation,選填 confidence
 *   頂層     選填 directed(預設當有向)、built_at_commit(新鮮度比對)
 *
 * 輸入:
 *   <圖檔>                                  預設依序找 GRAPH_CANDIDATES 下的路徑
 *   .design/subsystems/<slug>/design.md     子系統清單,以及 frontmatter 的 code-paths(檔案 → 子系統對映)
 *
 * 輸出五段:圖的可信度 → 對映覆蓋率 → 子系統依賴矩陣 → 循環依賴(含每條邊的檔案證據)→ 架構 hub。
 *
 * **本腳本只產生事實,不下判斷**:它不知道什麼是「對外契約」,所以跨界引用只列清單,
 * 由呼叫端對照 design.md 的契約章節判斷哪些是外洩。圖可能過期,任何結論都要回原始碼複驗。
 *
 * 用法: node scan-graph.mjs [design目錄] [選項]
 *   --graph <path>        圖檔路徑(不給就依序找 GRAPH_CANDIDATES)
 *   --subsys <slug>       聚焦單一子系統,額外列出它的進出邊明細(subsys scope 用)
 *   --top N               架構 hub 顯示幾個(預設 15)
 *   --examples N          每條子系統邊列幾個檔案級證據(預設 3)
 *   --include-relation R  把某個未分類的 relation 也算成依賴邊(可重複)
 *
 * Exit code: 0 = 無循環依賴 / 1 = 有循環依賴,或圖的可信度不足以下結論 / 2 = 圖不存在或無法解析
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------- 參數

/** 沒指定 --graph 時的搜尋順序:前兩個是工具無關的通用位置,最後一個是 graphify 的預設輸出 */
const GRAPH_CANDIDATES = ["./codegraph.json", "./.codegraph/graph.json", "./graphify-out/graph.json"];

const argv = process.argv.slice(2);
const opts = { graph: null, subsys: null, top: 15, examples: 3, include: [] };
let designDir = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--graph") opts.graph = argv[++i];
  else if (a === "--subsys") opts.subsys = argv[++i];
  else if (a === "--top") opts.top = Number(argv[++i]) || 15;
  else if (a === "--examples") opts.examples = Number(argv[++i]) || 3;
  else if (a === "--include-relation") opts.include.push(argv[++i]);
  else if (!a.startsWith("--")) designDir ??= a;
}
designDir ??= "./.design";

/**
 * 依賴關係:會讓「A 依賴 B」成立的邊。
 * 結構關係(檔案 contains 符號、類別 method 方法)不是依賴,算進去會製造假環。
 * 兩邊都沒列到的 relation 一律**排除並列印出來**,不靜默吞掉。
 */
const DEP_RELATIONS = new Set([
  "imports", "imports_from", "calls", "uses", "references",
  "extends", "implements", "inherits", "instantiates", "depends_on",
  ...opts.include,
]);
const STRUCTURAL_RELATIONS = new Set(["contains", "method", "defines", "declares", "rationale_for", "part_of"]);

// ---------------------------------------------------------------- 讀圖

const explicitGraph = opts.graph !== null;
opts.graph ??= GRAPH_CANDIDATES.find((p) => existsSync(p)) ?? GRAPH_CANDIDATES.at(-1);

if (!existsSync(opts.graph)) {
  if (explicitGraph) console.error(`找不到程式碼知識圖: ${opts.graph}`);
  else console.error(`找不到程式碼知識圖,已找過: ${GRAPH_CANDIDATES.join("、")}`);
  console.error(`本專案還沒建圖(或圖放在別的位置,用 --graph 指定)。`);
  console.error(`建圖工具與指令見 _shared/codegraph.md 的「目前的產生器」;`);
  console.error(`保留邊方向的選項不能省,無向圖偵測不到循環依賴。`);
  process.exit(2);
}

let graph;
try {
  graph = JSON.parse(readFileSync(opts.graph, "utf8"));
} catch (e) {
  console.error(`無法解析 ${opts.graph}: ${e.message}`);
  process.exit(2);
}

const nodes = graph.nodes ?? [];
const links = graph.links ?? graph.edges ?? [];
if (nodes.length === 0) {
  console.error(`${opts.graph} 沒有任何節點(建圖可能失敗了)。`);
  process.exit(2);
}

// 邊的 source/target 是節點 id;舊格式可能是節點陣列的索引,兩種都接
const byId = new Map(nodes.map((n) => [n.id, n]));
const nodeOf = (ref) => byId.get(ref) ?? (typeof ref === "number" ? nodes[ref] : undefined);

// ---------------------------------------------------------------- 圖的可信度

const trustIssues = []; // 會讓結論不可信的問題(影響 exit code)
const trustNotes = []; // 提醒但不影響結論

if (graph.directed === false) {
  trustIssues.push(
    "圖是**無向**建置(directed: false):A→B 與 B→A 會被合併成一條邊,循環依賴必然漏報。" +
      "請用保留邊方向的選項重建(指令見 _shared/codegraph.md)",
  );
}

// 新鮮度:圖記錄的 commit 與目前 HEAD 對不上時,圖描述的是舊的程式碼
const builtAt = graph.built_at_commit ?? null;
let head = null;
try {
  head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch {
  /* 不是 git repo 或沒裝 git,略過新鮮度檢查 */
}
if (builtAt && head && !head.startsWith(builtAt) && !builtAt.startsWith(head)) {
  trustIssues.push(
    `圖建於 commit ${builtAt.slice(0, 12)},目前 HEAD 是 ${head.slice(0, 12)}:圖描述的不是現在的程式碼,` +
      `請先更新圖(指令見 _shared/codegraph.md)`,
  );
}
const mtime = statSync(opts.graph).mtime;
const ageDays = (Date.now() - mtime.getTime()) / 86_400_000;
if (ageDays > 7) trustNotes.push(`圖已 ${Math.round(ageDays)} 天沒更新(${mtime.toISOString().slice(0, 10)});建議先更新圖`);

// ---------------------------------------------------------------- 子系統 → 路徑對映

/** 解析 frontmatter 的行內陣列欄位(格式規範見 _shared/doc-lifecycle.md) */
function readInlineList(path, key) {
  let text;
  try {
    text = readFileSync(path, "utf8").slice(0, 8192);
  } catch {
    return [];
  }
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") break;
    const m = lines[i].match(new RegExp(`^${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
    if (m) return m[1].split(",").map((s) => s.trim().replace(/^(['"])([\s\S]*)\1$/, "$2").trim()).filter(Boolean);
  }
  return [];
}

const subsysRoot = join(designDir, "subsystems");
const subsystems = []; // { slug, codePaths[] }
if (existsSync(subsysRoot)) {
  for (const e of readdirSync(subsysRoot, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const design = join(subsysRoot, e.name, "design.md");
    subsystems.push({ slug: e.name, codePaths: existsSync(design) ? readInlineList(design, "code-paths") : [] });
  }
}

const declaredCount = subsystems.filter((s) => s.codePaths.length > 0).length;
/**
 * 對映模式:
 *   declared  — 用 design.md 的 code-paths(唯一可信的對映;最長前綴優先,支援巢狀)
 *   heuristic — 沒有任何 code-paths 時,退回「路徑片段等於 slug」的猜測(結論僅供參考)
 *   dir       — 連 .design/subsystems/ 都沒有時,退回用前兩層目錄當假想子系統
 */
let mapMode = "declared";
if (subsystems.length === 0) mapMode = "dir";
else if (declaredCount === 0) mapMode = "heuristic";
else if (declaredCount < subsystems.length) {
  trustNotes.push(
    `${subsystems.length - declaredCount} 個子系統的 design.md 沒有 code-paths 欄位(${subsystems.filter((s) => !s.codePaths.length).map((s) => s.slug).join("、")}),` +
      `這些子系統的檔案會落進「未對映」,依賴矩陣會少算它們的邊`,
  );
}
if (mapMode === "heuristic")
  trustIssues.push(
    "沒有任何 design.md 填了 code-paths,對映靠「路徑片段 = 子系統 slug」猜測:" +
      "檔案歸屬可能整批錯,循環依賴的結論不可採信。請在各 design.md 的 frontmatter 補 `code-paths: [src/xxx]`",
  );
if (mapMode === "dir") trustNotes.push(`${designDir}/subsystems/ 下沒有子系統,改用前兩層目錄當假想子系統(僅供概覽)`);

// 前綴對映表,長的排前面 → 最長前綴優先
const prefixes = subsystems
  .flatMap((s) => s.codePaths.map((p) => ({ slug: s.slug, prefix: p.replace(/^\.\//, "").replace(/\/+$/, "") })))
  .sort((a, b) => b.prefix.length - a.prefix.length);

const unmappedPrefixCount = new Map();

/** 檔案路徑 → 子系統 slug(對不上回 null) */
function subsysOf(file) {
  if (!file) return null;
  const f = file.replace(/\\/g, "/").replace(/^\.\//, "");
  if (mapMode === "declared") {
    for (const { slug, prefix } of prefixes) if (f === prefix || f.startsWith(prefix + "/")) return slug;
    return null;
  }
  if (mapMode === "heuristic") {
    const segs = f.split("/");
    for (const s of subsystems) if (segs.includes(s.slug)) return s.slug;
    return null;
  }
  const segs = f.split("/");
  return segs.length > 1 ? segs.slice(0, 2).join("/") : segs[0];
}

// ---------------------------------------------------------------- 節點歸屬與覆蓋率

const codeFiles = new Set();
const mappedFiles = new Set();
for (const n of nodes) {
  if (!n.source_file) continue;
  const f = n.source_file.replace(/\\/g, "/");
  codeFiles.add(f);
  const s = subsysOf(f);
  if (s) mappedFiles.add(f);
  else {
    const key = f.split("/").slice(0, 2).join("/");
    unmappedPrefixCount.set(key, (unmappedPrefixCount.get(key) ?? 0) + 1);
  }
}
const coverage = codeFiles.size === 0 ? 0 : mappedFiles.size / codeFiles.size;
if (mapMode !== "dir" && coverage < 0.5)
  trustIssues.push(
    `只有 ${Math.round(coverage * 100)}% 的檔案對映得到子系統(${mappedFiles.size}/${codeFiles.size}):` +
      `多數程式碼不在任何子系統的 code-paths 內,依賴矩陣看到的只是局部`,
  );

// ---------------------------------------------------------------- 捲成子系統級的邊

const relationCounts = new Map();
const unknownRelations = new Map();
/** key `A→B` → { count, examples[], relations:Set } */
const subsysEdges = new Map();
let skippedSameSubsys = 0;
let skippedUnmapped = 0;
let skippedStructural = 0;

for (const e of links) {
  const rel = e.relation ?? "";
  relationCounts.set(rel, (relationCounts.get(rel) ?? 0) + 1);
  if (!DEP_RELATIONS.has(rel)) {
    if (!STRUCTURAL_RELATIONS.has(rel)) unknownRelations.set(rel, (unknownRelations.get(rel) ?? 0) + 1);
    skippedStructural++;
    continue;
  }
  const src = nodeOf(e.source);
  const tgt = nodeOf(e.target);
  if (!src || !tgt) continue;
  const a = subsysOf(src.source_file);
  const b = subsysOf(tgt.source_file);
  if (!a || !b) {
    skippedUnmapped++;
    continue;
  }
  if (a === b) {
    skippedSameSubsys++;
    continue;
  }
  const key = `${a} ${b}`;
  let rec = subsysEdges.get(key);
  if (!rec) subsysEdges.set(key, (rec = { from: a, to: b, count: 0, examples: [], relations: new Set() }));
  rec.count++;
  rec.relations.add(rel);
  if (rec.examples.length < opts.examples) {
    const loc = e.source_location ?? src.source_location ?? "";
    rec.examples.push(
      `${src.source_file}${loc ? `:${loc}` : ""} ${src.label} --${rel}[${e.confidence ?? "?"}]--> ${tgt.label} (${tgt.source_file})`,
    );
  }
}

if (unknownRelations.size > 0)
  trustNotes.push(
    `以下 relation 未分類、已排除在依賴計算外:${[...unknownRelations].map(([r, n]) => `${r}(${n})`).join("、")}。` +
      `確認它們代表依賴時,加 --include-relation <r> 重跑`,
  );

// ---------------------------------------------------------------- Tarjan 找強連通分量

const adj = new Map();
for (const { from, to } of subsysEdges.values()) {
  if (!adj.has(from)) adj.set(from, new Set());
  adj.get(from).add(to);
}
const allNodes = new Set([...adj.keys(), ...[...subsysEdges.values()].map((e) => e.to)]);

function tarjan() {
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [], out = [];
  let counter = 0;
  const strongConnect = (v) => {
    index.set(v, counter); low.set(v, counter); counter++;
    stack.push(v); onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) { strongConnect(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) {
      const comp = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
      out.push(comp);
    }
  };
  for (const v of allNodes) if (!index.has(v)) strongConnect(v);
  return out;
}
const cycles = tarjan().filter((c) => c.length > 1 || (adj.get(c[0])?.has(c[0]) ?? false));

// ---------------------------------------------------------------- 架構 hub(連通度最高的節點)

const degree = new Map();
for (const e of links) {
  if (STRUCTURAL_RELATIONS.has(e.relation)) continue; // 結構邊會讓每個檔案節點自動變 hub
  for (const ref of [e.source, e.target]) {
    const n = nodeOf(ref);
    if (n) degree.set(n.id, (degree.get(n.id) ?? 0) + 1);
  }
}
const hubs = [...degree.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, opts.top)
  .map(([id, d]) => ({ node: byId.get(id), degree: d }))
  .filter((h) => h.node);

// ---------------------------------------------------------------- 輸出

const pad = (s, w) => {
  const width = [...String(s)].reduce((a, c) => a + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/.test(c) ? 2 : 1), 0);
  return String(s) + " ".repeat(Math.max(0, w - width));
};

console.log("=== 圖的可信度 ===");
console.log(`圖檔:${opts.graph}`);
console.log(
  `節點 ${nodes.length}、邊 ${links.length}(依賴邊 ${[...subsysEdges.values()].reduce((a, e) => a + e.count, 0)} 跨子系統 / ` +
    `${skippedSameSubsys} 子系統內 / ${skippedUnmapped} 端點未對映 / ${skippedStructural} 非依賴關係)`,
);
console.log(`建置:${graph.directed === false ? "無向" : "有向"}${builtAt ? `,commit ${builtAt.slice(0, 12)}` : ""},檔案時間 ${mtime.toISOString().slice(0, 16).replace("T", " ")}`);
console.log(`關係分布:${[...relationCounts].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join("、")}`);
if (trustIssues.length > 0) {
  console.log("\n⚠ 影響結論可信度(先處理再採信下面的分析):");
  for (const t of trustIssues) console.log(`  - ${t}`);
}
if (trustNotes.length > 0) {
  console.log("\n提示:");
  for (const t of trustNotes) console.log(`  - ${t}`);
}

console.log("\n=== 子系統對映覆蓋率 ===");
console.log(`模式:${mapMode}(declared = 讀 design.md 的 code-paths;heuristic = 用 slug 猜;dir = 用目錄當假想子系統)`);
console.log(`覆蓋:${mappedFiles.size}/${codeFiles.size} 個檔案(${Math.round(coverage * 100)}%)`);
if (unmappedPrefixCount.size > 0) {
  const top = [...unmappedPrefixCount].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log("未對映的路徑(節點數;要納入分析就把它加進某個 design.md 的 code-paths):");
  for (const [p, n] of top) console.log(`  ${pad(p, 44)} ${n}`);
}

console.log("\n=== 子系統依賴矩陣 ===");
if (subsysEdges.size === 0) {
  console.log("沒有任何跨子系統的依賴邊(子系統彼此完全獨立,或對映沒接上)。");
} else {
  const sorted = [...subsysEdges.values()].sort((a, b) => b.count - a.count);
  for (const e of sorted) console.log(`  ${pad(`${e.from} → ${e.to}`, 46)} ${String(e.count).padStart(4)} 條  [${[...e.relations].join(",")}]`);
}

console.log("\n=== 循環依賴 ===");
if (cycles.length === 0) {
  console.log("未偵測到子系統層級的循環依賴。");
} else {
  console.log(`發現 ${cycles.length} 組循環(強連通分量),環上每一邊的具體證據如下:`);
  for (const [i, comp] of cycles.entries()) {
    console.log(`\n[環 ${i + 1}] ${comp.join(" ⇄ ")}`);
    const members = new Set(comp);
    for (const e of subsysEdges.values()) {
      if (!members.has(e.from) || !members.has(e.to)) continue;
      console.log(`  ${e.from} → ${e.to}(${e.count} 條,${[...e.relations].join(",")}):`);
      for (const ex of e.examples) console.log(`      ${ex}`);
    }
  }
}

if (opts.subsys) {
  console.log(`\n=== ${opts.subsys} 的跨界引用明細 ===`);
  const known = subsystems.some((s) => s.slug === opts.subsys) || allNodes.has(opts.subsys);
  if (!known) console.log(`(${opts.subsys} 不在子系統清單內,也沒有任何跨界邊)`);
  const inbound = [...subsysEdges.values()].filter((e) => e.to === opts.subsys);
  const outbound = [...subsysEdges.values()].filter((e) => e.from === opts.subsys);
  console.log(`\n-- 別人進來(對照 design.md 的「對外契約」:被引用的符號是否都在契約內?不在 = 邊界外洩)--`);
  if (inbound.length === 0) console.log("  (無)");
  for (const e of inbound) {
    console.log(`  ← ${e.from}(${e.count} 條,${[...e.relations].join(",")}):`);
    for (const ex of e.examples) console.log(`      ${ex}`);
  }
  console.log(`\n-- 本子系統出去(對照對方 design.md:是否只走了對方的對外契約?)--`);
  if (outbound.length === 0) console.log("  (無)");
  for (const e of outbound) {
    console.log(`  → ${e.to}(${e.count} 條,${[...e.relations].join(",")}):`);
    for (const ex of e.examples) console.log(`      ${ex}`);
  }
}

console.log(`\n=== 架構 hub(連通度前 ${opts.top};高連通不等於有問題,是 SRP 與上帝物件的**候選**)===`);
for (const h of hubs) {
  const s = subsysOf(h.node.source_file) ?? "-";
  console.log(`  ${String(h.degree).padStart(4)}  ${pad(h.node.label ?? h.node.id, 34)} ${pad(s, 18)} ${h.node.source_file ?? ""}${h.node.source_location ? `:${h.node.source_location}` : ""}`);
}

console.log(
  "\n提醒:以上全部來自圖,圖是索引不是事實。任何要寫進文檔的結論(簽名、相依、契約違反)" +
    "都必須回原始碼讀到原文再確認;confidence 為 INFERRED 的邊尤其只能當假設。",
);

process.exit(cycles.length > 0 || trustIssues.length > 0 ? 1 : 0);
