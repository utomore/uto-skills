#!/usr/bin/env node
/**
 * lint-spikes.mjs — spike 的三道機械對帳:資料夾只活在 open 期間、frontmatter 合規、產品程式碼沒有 import。
 *
 * spike(`/spike`)的鐵律是「產出是結論,不是程式碼」:程式碼只在 open 期間活在
 * `spike/SPK-00x-<slug>/`(`spike/` 是常駐的共用 sandbox),結案時 `git rm`、每輪的 sha 留在文檔裡。
 * open 期間**產品程式碼與測試禁止 import 它**,任務文檔的 `code-paths` 也不得指進去 ——
 * 那段程式碼沒有經過契約與測試,任何一條 law 都不保護它。這條規則違反時**編譯器不會報錯**,
 * 測試也照樣綠(spike 程式碼通常真的能跑),所以只有文字比對抓得到。本腳本就是那道比對。
 *
 * 三件事:
 *   1. **生命週期**:`spike/SPK-00x-<slug>/` 只活在 open 期間。open 沒資料夾(建了沒程式碼,或被人
 *      提早清了)、concluded / dropped 還有資料夾(**沒清** —— 留著的程式碼一定會被人 import)、
 *      有資料夾沒文檔(沒有紀錄的實驗)三種都是不一致。`spike/` 根層其他東西是共用環境,不管
 *   2. **frontmatter**:`concluded` 要有 `verdict`(feasible / infeasible / partial)與非空 `feeds`;
 *      spike 的 `code-paths` 只准指到 `spike/` 底下;F/E/B 的 `code-paths` **不准**指進 `spike/`
 *   3. **import**:掃 `spike/` 以外的原始碼,任何一行 import / require / from / include / use
 *      指到 `spike/`(或 python 的 `spikes.`)都列出來,附 `檔案:行號`
 *
 * 第 3 條是**下限不是上限**:它只認得常見語言的 import 寫法,不知道建置設定有沒有把 `spike/`
 * 排除在編譯圖之外(tsconfig 的 exclude、cabal 的 hs-source-dirs、go.work …)—— 那一項機器判不了,
 * 輸出會明說。摘要一律印出掃了幾個檔:「掃到 0 處」與「全部合格」在輸出上長得一樣。
 *
 * 用法:
 *   node lint-spikes.mjs [專案根目錄]     預設 .(底下要有 .design/;sandbox spike/ 與 .design/ 同層)
 *   --design <路徑>    .design 不在專案根底下時指定;spike/ 一律取 .design 的上一層
 *   --quiet            只印違規,不印摘要
 *
 * Exit code:0 = 三道都乾淨 / 1 = 有不一致或 import 違規 / 2 = 路徑不存在
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative, extname, dirname, resolve } from "node:path";
import { readFrontmatter, asList } from "./_frontmatter.mjs";
import { printHelpIfAsked } from "./_help.mjs";

const argv = process.argv.slice(2);
printHelpIfAsked(argv, import.meta.url);
const quiet = argv.includes("--quiet");
let designOpt = null;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--design") designOpt = argv[++i] ?? null;
  else if (argv[i] === "--quiet") continue;
  else if (argv[i].startsWith("--")) {
    console.error(`未知選項: ${argv[i]}`);
    process.exit(2);
  } else positional.push(argv[i]);
}
const projectRoot = resolve(positional[0] ?? ".");
const designDir = resolve(designOpt ?? join(projectRoot, ".design"));
if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
  console.error(`路徑不存在: ${projectRoot}`);
  process.exit(2);
}
if (!existsSync(designDir)) {
  console.error(`找不到 .design 目錄: ${designDir}(用 --design 指定)`);
  process.exit(2);
}
const spikesDir = join(dirname(designDir), "spike");
const rel = (p) => relative(projectRoot, p).replaceAll("\\", "/");

const issues = []; // 計入 exit code
const notes = []; // 不計入
const SPIKE_PATTERN = /^(SPK-\d{3})-([a-z0-9-]+)\.md$/;
const VERDICTS = new Set(["feasible", "infeasible", "partial"]);

// ---------------------------------------------------------------- 1. 成對 + 2. spike 的 frontmatter

const docDir = join(designDir, "spikes");
const docNames = new Set(); // SPK-001-slug
const listMd = (d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".md")).sort() : []);
const listDirs = (d) => (existsSync(d) ? readdirSync(d).filter((f) => statSync(join(d, f)).isDirectory()).sort() : []);

for (const name of listMd(docDir)) {
  const path = join(docDir, name);
  const r = rel(path);
  const m = name.match(SPIKE_PATTERN);
  if (!m) {
    notes.push(`${r}:檔名不符 spike 命名規則(如 SPK-001-slug.md),成對檢查略過`);
    continue;
  }
  const full = name.replace(/\.md$/, "");
  docNames.add(full);
  const { meta } = readFrontmatter(path);
  if (!meta) {
    issues.push(`${r}:缺 frontmatter`);
    continue;
  }
  if (meta.id && String(meta.id) !== m[1]) issues.push(`${r}:frontmatter id(${meta.id})與檔名編號(${m[1]})不一致`);
  if (meta.type && meta.type !== "spike") issues.push(`${r}:type(${meta.type})應為 spike`);
  const status = String(meta.status ?? "");
  if (status === "concluded") {
    const v = String(meta.verdict ?? "");
    if (!VERDICTS.has(v)) issues.push(`${r}:concluded 但 verdict(${v || "空"})不在 feasible / infeasible / partial 之內`);
    if (asList(meta.feeds).length === 0) issues.push(`${r}:concluded 但 feeds 是空的 —— 結論沒有下游,沒有任何決定會讀到這份驗證`);
  }
  for (const cp of asList(meta["code-paths"]))
    if (!/^spike\//.test(cp)) issues.push(`${r}:code-paths 的 ${cp} 不在 spike/ 底下 —— spike 程式碼只准住在那裡`);
  const codeDir = join(spikesDir, full);
  const hasDir = existsSync(codeDir);
  if (status === "open" && !hasDir)
    issues.push(`${r}:status 是 open 但沒有 ${rel(codeDir)}/ —— 還沒開工就建了檔,或資料夾被提早清掉;open 的 spike 要有程式碼資料夾`);
  if ((status === "concluded" || status === "dropped") && hasDir)
    issues.push(`${r}:status 是 ${status} 但 ${rel(codeDir)}/ 還在 —— 結案沒清;跑 spike-close.mjs <全名> --apply(它會先驗 sha 撈不撈得回來);留著一定會被人 import`);
}
// 只認 SPK-00x-<slug> 形狀的資料夾;spike/ 根層的其他東西(依賴檔、harness、假資料、.venv)是共用環境
for (const d of listDirs(spikesDir)) {
  if (docNames.has(d) || !/^SPK-\d{3}-[a-z0-9-]+$/.test(d)) continue;
  issues.push(`${rel(join(spikesDir, d))}/:沒有對應的 .design/spikes/${d}.md —— 沒有紀錄的實驗;用 scan-ids.mjs --claim SPK 補建文檔,或把資料夾移走`);
}
const spikeDirs = listDirs(spikesDir).filter((d) => /^SPK-\d{3}-[a-z0-9-]+$/.test(d));

// ---------------------------------------------------------------- 2b. 任務文檔的 code-paths 不准指進 spike/

const TASK_DIRS = ["enhancements", "bugfixes"];
function checkTaskDoc(path) {
  const { meta } = readFrontmatter(path);
  if (!meta) return;
  for (const cp of asList(meta["code-paths"]))
    if (/^spike\//.test(cp)) issues.push(`${rel(path)}:code-paths 指進 ${cp} —— 任務文檔的實作不得落在 spike/ 底下,正式實作一律從 spec 寫進原始碼樹`);
}
for (const sub of TASK_DIRS) for (const f of listMd(join(designDir, sub))) checkTaskDoc(join(designDir, sub, f));
const subsysRoot = join(designDir, "subsystems");
for (const slug of listDirs(subsysRoot))
  for (const sub of ["features", ...TASK_DIRS])
    for (const f of listMd(join(subsysRoot, slug, sub))) checkTaskDoc(join(subsysRoot, slug, sub, f));

// ---------------------------------------------------------------- 3. 產品程式碼的 import

const SKIP_DIRS = new Set([
  "spike", ".design", "node_modules", ".git", "dist", "build", "target", "out", "vendor",
  "dist-newstyle", ".stack-work", "__pycache__", ".venv", "venv", ".mypy_cache", ".pytest_cache", ".next", ".cache", "coverage",
]);
const CODE_EXT = new Set([
  ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".mts", ".cts", ".py", ".rb", ".go", ".rs", ".hs", ".java", ".kt", ".kts",
  ".scala", ".cs", ".fs", ".swift", ".c", ".cc", ".cpp", ".h", ".hpp", ".m", ".mm", ".php", ".ex", ".exs", ".erl", ".clj",
  ".cljs", ".ml", ".mli", ".dart", ".lua", ".zig", ".nim", ".vue", ".svelte",
]);
// 一行同時滿足兩件事才算:長得像 import,而且指到 spike/(或 python 的 spikes.)
const IMPORT_LINE = /^\s*(?:import\b|from\b|export\b.*\bfrom\b|#include\b|require\b|use\b|open\b|mod\b|using\b|@import\b|load\b|require_relative\b|const\b.*=\s*require\(|let\b.*=\s*require\(|var\b.*=\s*require\()/;
const SPIKE_REF = /(?:^|[\s"'`(<./\\])spike(?:[\/\\]|\.[A-Za-z_])/;

const hits = [];
let scanned = 0;
(function walk(dir) {
  let ents;
  try {
    ents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of ents) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name));
      continue;
    }
    if (!CODE_EXT.has(extname(e.name))) continue;
    const p = join(dir, e.name);
    scanned++;
    let text;
    try {
      text = readFileSync(p, "utf8");
    } catch {
      continue;
    }
    text.split(/\r?\n/).forEach((line, i) => {
      if (IMPORT_LINE.test(line) && SPIKE_REF.test(line)) hits.push({ file: rel(p), line: i + 1, text: line.trim() });
    });
  }
})(projectRoot);
for (const h of hits) issues.push(`${h.file}:${h.line}:import 了 spike/ —— ${h.text.slice(0, 120)}`);

// ---------------------------------------------------------------- 輸出

if (issues.length) {
  console.log(`=== spike 不一致(${issues.length})===`);
  console.log("spike 程式碼只供參考:沒有契約、沒有測試,任何一條 law 都不保護它。產品程式碼依賴它的每一處都是一段沒人保護的行為。\n");
  for (const m of issues) console.log(`- ${m}`);
}
if (notes.length) {
  console.log(`\n=== 提示(${notes.length})===`);
  for (const m of notes) console.log(`- ${m}`);
}
if (!quiet) {
  console.log(
    `\n掃了 ${docNames.size} 份 spike 文檔、${spikeDirs.length} 個 spike/SPK-* 資料夾、${scanned} 個原始碼檔(${rel(projectRoot) || "."})` +
      (hits.length ? `,${hits.length} 處 import 指到 spike/。` : ",沒有 import 指到 spike/。"),
  );
  console.log("(只查 import 寫法;建置設定有沒有把 spike/ 排除在編譯圖之外,機器判不了 —— 那一項要人看)");
}
process.exit(issues.length ? 1 : 0);
