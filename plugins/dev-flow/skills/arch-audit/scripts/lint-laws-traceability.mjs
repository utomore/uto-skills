#!/usr/bin/env node
/**
 * lint-laws-traceability.mjs — spec 的「Laws / Examples」↔ 測試檔的**編號對帳**。
 *
 * `lint-laws.mjs` 查的是 spec 那一側寫得夠不夠格(四格齊全、觀察點引用得到介面);
 * 這一支查的是**規格與測試之間那條線有沒有接上** —— 兩件事分開,因為它們的輸入不同:
 * 前者只看 `.design/`,後者要同時看 `.design/` 與測試樹。
 *
 * 為什麼要有它:Laws 與它的 property test 是**同一件事的兩份**,而這兩份的衰減速度不一樣 ——
 * 測試被 CI 逼著保持誠實,文檔沒有任何東西逼它。於是三種漂移全部**不會產生任何錯誤訊息**:
 *
 *   1. **未翻譯** —— spec 寫了 `LAW-7`,測試裡沒有任何地方引用它。可能 qa 漏翻,也可能翻了
 *      但沒標;兩種都讓「Laws 全綠 = 完成」這個判準失去意義,因為分母根本沒被驗證過。
 *   2. **幽靈引用** —— 測試引用 `LAW-23`,而那條 law 在某次 `/spec-redesign` 之後已經被刪掉
 *      或改號了。測試照樣綠,它只是在守一條沒有人再認得的性質。
 *   3. **無歸屬** —— 測試檔裡寫著 `LAW-2`,但它沒說是哪一份 spec 的 `LAW-2`。
 *      **law id 的命名空間是每份文檔一組**(每份 spec 都從 `LAW-1` 開始),所以不宣告歸屬的
 *      引用機械上對不起來 —— 看起來有標,實際上什麼都沒接上。
 *
 * **它只驗編號,不驗語意**。`LAW-2` 有一個叫 `LAW-2` 的測試引用它,不代表那個測試真的在測
 * `LAW-2` 講的性質 —— 那件事只有讀的人判得了(`/arch-audit feature` 的「Laws/Examples 與測試
 * 對照」仍然要做)。這支的價值是把「有沒有人翻譯過」與「翻的是不是還存在的東西」變成機械的,
 * 讓 B 桶那份重複從「可能靜默漂移的第二份」變成「有 checksum 的第二份」。
 *
 * ## 測試怎麼宣告歸屬(兩種寫法,擇一即可)
 *
 *   1. **限定式引用**:直接把文檔全名寫進引用 —— `auth/F002#LAW-2`。自帶歸屬,擺在哪裡都對得上。
 *   2. **檔案宣告**:檔案裡任何一行(通常是模組 docstring 或檔頭註解)寫 `spec: auth/F002`,
 *      該檔案裡的裸 `LAW-2` 就都算這份文檔的。一個檔案可以宣告多份 spec。
 *
 * 子系統前綴可以省略(`spec: F002`),但**只有在該短號全專案唯一時**才算數;撞號時報成歧義,
 * 因為猜錯的後果是把對帳結果算到別的子系統頭上,而那不會出聲。
 *
 * 裸引用支援**區間**寫法(`LAW-1–LAW-4`、`LAW-1~4`、`LAW-1..4`),會展開成每一條 ——
 * 真實專案的 docstring 就是這樣寫的,不展開會把中間幾條誤報成「未翻譯」。
 *
 * 用法:
 *   node lint-laws-traceability.mjs [design 目錄] [--tests <測試根>[,<測試根>…]]
 *                                     省略 design 目錄取當前目錄;省略 --tests 時
 *                                     取 `<design 的上一層>/tests`(不存在就以 2 收場)
 *   node lint-laws-traceability.mjs .design --subsys auth      只對帳單一子系統
 *   node lint-laws-traceability.mjs .design --ext .py,.ts      自訂測試檔副檔名(預設見 DEFAULT_EXT)
 *   node lint-laws-traceability.mjs .design --quiet            只印違規,不印摘要
 *
 * Exit code:0 = 沒有違規 / 1 = 有違規 / 2 = 參數或路徑不對
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, dirname, basename, extname, resolve } from "node:path";
import { section } from "./_sections.mjs";
import { dataCells } from "./_tables.mjs";
import { printHelpIfAsked } from "./_help.mjs";

printHelpIfAsked(process.argv.slice(2), import.meta.url);

// ---------------------------------------------------------------- 參數

const DEFAULT_EXT = ".py,.ts,.tsx,.js,.mjs,.cjs,.jsx,.go,.rs,.hs,.rb,.java,.kt,.ex,.exs,.cs,.swift,.scala,.php,.c,.cc,.cpp,.h,.hpp,.lua,.dart,.clj,.ml";
/** 掃測試樹時整個跳過的資料夾:產物與快取,裡面的「引用」都是複製品 */
const SKIP_DIRS = new Set([
  "node_modules", ".git", "__pycache__", ".venv", "venv", "dist", "build", "target",
  ".mypy_cache", ".pytest_cache", ".ruff_cache", ".hypothesis", ".tox", "vendor", ".next",
]);

const argv = process.argv.slice(2);
let designDir = null;
let testsArg = null;
let subsysOnly = null;
let quiet = false;
let extArg = DEFAULT_EXT;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--quiet") quiet = true;
  else if (a === "--tests") testsArg = argv[++i];
  else if (a === "--subsys") subsysOnly = argv[++i];
  else if (a === "--ext") extArg = argv[++i];
  else if (a.startsWith("--")) die(2, `未知選項:${a}(跑 --help 看用法)`);
  else if (designDir === null) designDir = a;
  else die(2, `多餘的參數:${a}(只吃一個 design 目錄)`);
}
designDir = designDir ?? ".";
if (!existsSync(designDir)) die(2, `design 目錄不存在:${designDir}`);

const EXTS = new Set(extArg.split(",").map((s) => s.trim()).filter(Boolean));
const projectRoot = basename(resolve(designDir)) === ".design" ? dirname(resolve(designDir)) : resolve(designDir);
const testRoots = (testsArg ? testsArg.split(",").map((s) => s.trim()).filter(Boolean) : [join(projectRoot, "tests")])
  .filter(Boolean);
const missingRoots = testRoots.filter((r) => !existsSync(r));
if (missingRoots.length > 0)
  die(
    2,
    `測試根不存在:${missingRoots.join("、")}\n` +
      `用 --tests <測試根>[,<測試根>…] 指定。**沒有測試樹就沒有對帳對象** —— ` +
      `這支腳本不會因為找不到測試而報「全部合規」,那是最糟的一種綠燈。`,
  );

function die(code, msg) {
  console.error(msg);
  process.exit(code);
}

// ---------------------------------------------------------------- 收集 spec 那一側

/** 定義位置認得的三種形狀:清單項、表格第一格、`####` 標題。其餘一律只算「提到」 */
const ID_RE = /(LAW|REG|EX)-(\d+)/;
const LIST_DEF = /^\s*[-*+]\s+\**((?:LAW|REG|EX)-\d+)\**/;
const HEAD_DEF = /^#{3,6}\s+\**((?:LAW|REG|EX)-\d+)\**/;
/** 文檔引用:`auth/F002-token-refresh` / `auth/F002` / `F002` / `G-E001`(slug 可有可無) */
const DOC_REF = "(?:([a-z0-9][a-z0-9-]*)\\/)?((?:G-)?[FEB]\\d{3})(?:-[a-z0-9-]+)?";

function walk(dir, pred, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name === "archive") continue; // archive/ 是退場區,不是規格
      walk(join(dir, e.name), pred, acc);
    } else if (pred(e.name)) acc.push(join(dir, e.name));
  }
  return acc;
}

/** docKey → { key, short, subsys, file, declared: Map<id, line>, laws:number } */
const docs = new Map();
const shortIndex = new Map(); // 短號 → docKey[]

for (const path of walk(designDir, (n) => extname(n) === ".md")) {
  const name = basename(path);
  const m = name.match(/^((?:G-)?[FEB]\d{3})-[a-z0-9-]+\.md$/);
  if (!m) continue;
  const short = m[1];
  const rel = relative(designDir, path).split(/[\\/]/);
  const si = rel.indexOf("subsystems");
  const subsys = si >= 0 && rel[si + 1] ? rel[si + 1] : null;
  if (subsysOnly && subsys !== subsysOnly) continue;

  const body = readFileSync(path, "utf8");
  const declared = new Map();
  for (const re of [/^Laws/, /^Examples/]) {
    const sec = section(body, re);
    if (!sec) continue;
    sec.body.split(/\r?\n/).forEach((line, idx) => {
      const hit = line.match(LIST_DEF) ?? line.match(HEAD_DEF);
      let id = hit?.[1] ?? null;
      if (!id) {
        const cells = dataCells(line);
        const first = cells?.[0]?.replace(/\*/g, "").trim() ?? "";
        const cm = first.match(new RegExp(`^${ID_RE.source}$`));
        if (cm) id = first;
      }
      if (id && !declared.has(id)) declared.set(id, sec.line + 1 + idx);
    });
  }
  if (declared.size === 0) continue; // 沒有 Laws/Examples 的(planned 檔)不在對帳範圍

  const key = subsys ? `${subsys}/${short}` : short;
  docs.set(key, { key, short, subsys, file: rel.join("/"), declared });
  if (!shortIndex.has(short)) shortIndex.set(short, []);
  shortIndex.get(short).push(key);
}

// ---------------------------------------------------------------- 收集測試那一側

const violations = [];   // { where, kind, detail }
const cited = new Map(); // docKey → Map<id, string(第一個引用它的檔案)>
let scannedTests = 0;
let declaringFiles = 0;

const QUALIFIED = new RegExp(`${DOC_REF}#((?:LAW|REG|EX)-\\d+)`, "g");
const DECLARE = new RegExp(`\\bspec\\s*[:=]\\s*${DOC_REF}`, "gi");
const RANGE = /\b(LAW|REG|EX)-(\d+)\s*(?:–|—|~|\.\.|-)\s*(?:(?:LAW|REG|EX)-)?(\d+)\b/g;
const BARE = /\b((?:LAW|REG|EX)-\d+)\b/g;

/** 把 `(subsys, short)` 解析成 docKey;解析不了時回 `{ error }` */
function resolveRef(subsys, short) {
  if (subsys) {
    const key = `${subsys}/${short}`;
    if (docs.has(key)) return { key };
    return { error: `指向不存在的 spec 文檔 \`${subsys}/${short}\`` };
  }
  const hits = shortIndex.get(short) ?? [];
  if (hits.length === 1) return { key: hits[0] };
  if (hits.length === 0) return { error: `指向不存在的 spec 文檔 \`${short}\`` };
  return { error: `\`${short}\` 在多個子系統都有(${hits.join("、")}),請寫成 \`<子系統>/${short}\`` };
}

function noteCite(key, id, where) {
  if (!cited.has(key)) cited.set(key, new Map());
  const m = cited.get(key);
  if (!m.has(id)) m.set(id, where);
}

for (const root of testRoots) {
  for (const path of walk(root, (n) => EXTS.has(extname(n)))) {
    scannedTests++;
    const where = relative(projectRoot, path).split(/[\\/]/).join("/");
    const text = readFileSync(path, "utf8");

    // 1) 限定式引用:自帶歸屬
    const scope = new Set();
    for (const m of text.matchAll(QUALIFIED)) {
      const r = resolveRef(m[1] ?? null, m[2]);
      if (r.error) { violations.push({ where, kind: "幽靈引用", detail: r.error }); continue; }
      scope.add(r.key);
      noteCite(r.key, m[3], where);
    }

    // 2) 檔案宣告:`spec: auth/F002`
    let declaresAny = false;
    for (const m of text.matchAll(DECLARE)) {
      declaresAny = true;
      const r = resolveRef(m[1] ?? null, m[2]);
      if (r.error) { violations.push({ where, kind: "宣告對不上", detail: r.error }); continue; }
      scope.add(r.key);
    }
    if (declaresAny) declaringFiles++;

    // 3) 裸引用(含區間展開)→ 落在這個檔案的歸屬範圍上
    const bare = new Set();
    for (const m of text.matchAll(RANGE)) {
      const [from, to] = [Number(m[2]), Number(m[3])];
      if (to >= from && to - from <= 200) for (let n = from; n <= to; n++) bare.add(`${m[1]}-${n}`);
    }
    for (const m of text.matchAll(BARE)) bare.add(m[1]);

    if (bare.size === 0) continue;
    if (scope.size === 0) {
      violations.push({
        where,
        kind: "無歸屬",
        detail:
          `引用了 ${[...bare].slice(0, 6).join("、")}${bare.size > 6 ? ` 等 ${bare.size} 個編號` : ""},` +
          "但這個檔案沒有宣告是哪一份 spec —— law id 每份文檔各有一組,對不起來。" +
          "加一行 `spec: <子系統>/F00x`,或把引用寫成 `<子系統>/F00x#LAW-n`",
      });
      continue;
    }
    for (const key of scope) for (const id of bare) noteCite(key, id, where);
  }
}

// ---------------------------------------------------------------- 對帳

let checkedIds = 0;
const perDoc = [];

for (const doc of [...docs.values()].sort((a, b) => a.key.localeCompare(b.key))) {
  checkedIds += doc.declared.size;
  const got = cited.get(doc.key) ?? new Map();

  if (got.size === 0) {
    perDoc.push({ doc, orphan: true, missing: [...doc.declared.keys()], ghosts: [] });
    continue;
  }
  const missing = [...doc.declared.keys()].filter((id) => !got.has(id));
  const ghosts = [...got.keys()].filter((id) => !doc.declared.has(id));
  if (missing.length > 0 || ghosts.length > 0) perDoc.push({ doc, orphan: false, missing, ghosts });
}

// ---------------------------------------------------------------- 輸出

const total = violations.length + perDoc.length;

if (total > 0) {
  console.log(`=== Laws/Examples ↔ 測試 對帳違規(${total} 份文檔 / 檔案)===`);
  console.log("每條 LAW- / REG- / EX- 都要在測試裡被引用到,而每個引用都要指得到一條還存在的條目。");
  console.log("歸屬寫法二選一:檔案裡一行 `spec: <子系統>/F00x`,或把引用寫成 `<子系統>/F00x#LAW-n`。");
  console.log("");

  for (const v of violations) console.log(`- ${v.where}  【${v.kind}】${v.detail}`);
  if (violations.length > 0 && perDoc.length > 0) console.log("");

  for (const r of perDoc) {
    console.log(`- ${r.doc.file}(${r.doc.key})`);
    if (r.orphan) {
      console.log(`  【無人認領】${r.doc.declared.size} 條 law/example,測試樹裡沒有任何檔案引用這份 spec`);
      continue;
    }
    if (r.missing.length > 0) {
      const lines = r.missing.map((id) => `${id}(:${r.doc.declared.get(id)})`);
      console.log(`  【未翻譯】${r.missing.length} 條沒有任何測試引用:${lines.join("、")}`);
    }
    if (r.ghosts.length > 0) {
      const got = cited.get(r.doc.key);
      console.log(
        `  【幽靈引用】${r.ghosts.length} 個編號測試引用得到、spec 裡卻沒有這一條:` +
          r.ghosts.map((id) => `${id}(${got.get(id)})`).join("、") +
          "\n    這通常是某次 /spec-redesign 刪掉的 law 還有測試在守。刪掉那些測試;**不要把號重用給新的 law**——號永久空缺,否則下次就分不出幽靈與現況(doc-lifecycle.md「修訂(rev 與 REV)」)",
      );
    }
  }
  process.exit(1);
}

if (!quiet) {
  console.log(
    `對帳了 ${docs.size} 份 spec、共 ${checkedIds} 條 law/example,` +
      `全部在 ${scannedTests} 個測試檔裡引用得到(其中 ${declaringFiles} 個檔案宣告了 spec 歸屬)。`,
  );
  console.log("(**只驗編號,不驗語意** —— 引用得到不代表那個測試真的在測這條性質,那一關在 `/arch-audit feature`。)");
}
process.exit(0);
