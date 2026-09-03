#!/usr/bin/env node
/**
 * migrate-v2.mjs — `.design/` 從 v1 遷移到 v2。
 *
 * v1:一個 feature 的知識散在三處 —— `design.md` 功能規劃表的一列、`design.md` 的
 *    Feature 契約卡、`features/F00x-*.md`,靠 `doc` 欄當 join key 串起來。做完之後
 *    契約卡還要搬去 `archive/cards-done.md`。
 * v2:一個 feature ＝ 一份檔,從被想到的那一刻就存在。三個狀態:
 *      planned  有 `## 契約`,沒有 `## Laws`   ← 由內容決定,不可能說謊
 *      specced  兩節都有                      ← 由內容決定,不可能說謊
 *      done     frontmatter 明寫             ← 只能靠人寫,但腳本交叉檢查(見下)
 *
 * `done` 本來想用「code-paths 非空」當判準,實測不可行:ge-adk-slide 43 份 done 裡有 42 份
 * 的 code-paths 是空的(收尾一直沒回寫)。所以 done 維持明寫,由 scan-status 交叉檢查
 * 「說 done 卻沒有 ## Laws」「說 planned 卻有 Laws」「done 而 code-paths 空」三種矛盾。
 *
 * 預設 dry-run,只印會發生什麼;`--apply` 才落地。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { readFrontmatter, parseValue } from "./_frontmatter.mjs";

const ARGS = process.argv.slice(2);
if (ARGS.includes("--help") || ARGS.includes("-h")) {
  console.log(`用法: node migrate-v2.mjs [design目錄] [--apply] [--subsys <slug>]

  design目錄   預設 ./.design
  --apply      真的寫入(預設只印計畫,不動任何檔案)
  --subsys     只遷移某一個子系統(反覆驗證時用)

Exit code: 0 = 計畫產得出來 / 1 = 有阻擋遷移的問題(卡片找不到、編號衝突)`);
  process.exit(0);
}
const APPLY = ARGS.includes("--apply");
const ONLY = ARGS[ARGS.indexOf("--subsys") + 1] && ARGS.includes("--subsys") ? ARGS[ARGS.indexOf("--subsys") + 1] : null;
const ROOT = ARGS.find((a) => !a.startsWith("--") && a !== ONLY) ?? "./.design";

const plan = [];   // {kind, file, note, write?}
const blockers = [];
const warnings = [];  // 不擋遷移,但遷移後要有人補的
const cleanups = [];   // 遷移順手修掉的髒資料(舊腳本靜默吃掉的)

/** 取 `## <名>` 到下一個 `## ` 之間(含標題行);找不到回 null */
function section(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === heading || l.trim().startsWith(heading));
  if (start < 0 || !/^## /.test(lines[start])) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { end = i; break; }
  }
  return { start, end, text: lines.slice(start, end).join("\n") };
}

/** `## Feature 契約卡` 底下每張 `### <slug>` 的原文 */
function parseCards(text) {
  const sec = section(text, "## Feature 契約卡");
  const out = new Map();
  if (!sec) return out;
  let cur = null, buf = [];
  for (const line of sec.text.split(/\r?\n/).slice(1)) {
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h) {
      if (cur) out.set(cur, buf.join("\n").trim());
      cur = h[1].trim(); buf = [];
      continue;
    }
    if (cur) buf.push(line);
  }
  if (cur) out.set(cur, buf.join("\n").trim());
  return out;
}

/**
 * 功能規劃表:每一列 + 它所屬的 `### 階段…(S3)` 標題。
 *
 * **欄位靠表頭認,不靠位置**:實測到的表頭至少兩種
 * (`# | feature | 一句話說明 | 模組 | 依賴 | doc` 與 `# | feature | 模組群 | 目標 | 依賴 | doc`),
 * 位置式解析會把「模組群」讀成說明、把「目標」讀成模組,而且不會出聲。
 */
function parseRoadmap(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === "## 功能規劃");
  if (start < 0) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^## /.test(lines[i])) { end = i; break; }
  const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((x) => x.trim().replace(/^\*\*|\*\*$/g, ""));
  const COLS = { feature: /^feature$/i, desc: /說明|目標|摘要/, modules: /^模組$|^負責模組$/, group: /模組群/, deps: /依賴/, doc: /^doc$/i };
  let map = null, stage = null;
  const rows = [];
  for (const line of lines.slice(start + 1, end)) {
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h) { stage = h[1].match(/\((S\d+)\)/)?.[1] ?? h[1].trim(); continue; }
    if (!/^\s*\|/.test(line)) continue;
    const c = cells(line);
    if (c.some((x) => /^feature$/i.test(x))) {           // 表頭:建欄名 → 索引的對照
      map = {};
      for (const [key, re] of Object.entries(COLS)) {
        const i = c.findIndex((x) => re.test(x));
        if (i >= 0) map[key] = i;
      }
      continue;
    }
    if (!map || !/^\d+$/.test(c[0])) continue;
    const at = (k) => (map[k] !== undefined ? c[map[k]] : "");
    // doc 欄實測到的髒值:反引號(`F001`)、`-` 殘留(-F009)、寫成全名(auth/F001-login)。
    // 三種舊腳本都靜默吃掉 —— 前兩種查不到 id,第三種被當成「還沒建檔」。
    const rawDoc = at("doc");
    const doc = (rawDoc.replace(/`/g, "").replace(/^-+\s*/, "").split("/").pop() ?? "").match(/^([FEB]\d{3})/)?.[1] ?? "-";
    rows.push({ num: c[0], slug: at("feature"), desc: at("desc"), modules: at("modules"),
                group: at("group"), deps: at("deps"), doc, rawDoc, stage });
  }
  return rows;
}

/** 卡片裡的 `- **欄位**:值`(值可跨行,到下一個 `- **` 為止) */
function cardField(card, name) {
  const lines = String(card ?? "").split(/\r?\n/);
  const i = lines.findIndex((l) => new RegExp(`^-\\s+\\*\\*${name}\\*\\*[::]`).test(l));
  if (i < 0) return null;
  const buf = [lines[i].replace(new RegExp(`^-\\s+\\*\\*${name}\\*\\*[::]\\s*`), "")];
  for (let j = i + 1; j < lines.length && !/^-\s+\*\*/.test(lines[j]); j++) buf.push(lines[j]);
  return buf.join("\n").trim();
}

const isStub = (card) => /本卡為存根/.test(String(card ?? ""));

/**
 * 「負責模組」欄實測會夾整段散文(deck-engine/theme-full 的那一欄有 200 多字的閘門說明)。
 * 索引只要模組名,散文留在 `## 契約` 的原文行裡 —— 所以在第一個句號/括號/粗體處截斷,
 * 再切成 token。截掉的部分沒有消失,只是不進 frontmatter。
 */
function cleanModules(raw) {
  const head = String(raw ?? "").split(/[。((]|\*\*/)[0];
  return [...new Set(head.split(/[、,,]/).map((x) => x.trim()).filter((x) => x && x.length <= 20 && !/\s{2}/.test(x)))];
}

/** 既有 F/E/B 檔的新 status */
function newStatus(meta, body) {
  const s = String(meta.status ?? "").trim();
  if (s === "closed") return "dropped";
  if (s === "done") return "done";
  return /^## Laws/m.test(body) ? "specced" : "planned";
}

/** 改寫 frontmatter:套用 patch(值為 null 代表刪除),維持欄位順序、新欄位插在 updated 之後 */
function patchFrontmatter(body, patch) {
  const lines = body.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return body;
  let end = lines.indexOf("---", 1);
  if (end < 0) return body;
  const done = new Set();
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m || !(m[1] in patch)) continue;
    done.add(m[1]);
    lines[i] = `${m[1]}: ${patch[m[1]]}`;
  }
  const add = Object.entries(patch).filter(([k]) => !done.has(k)).map(([k, v]) => `${k}: ${v}`);
  if (add.length) {
    const at = lines.findIndex((l, i) => i > 0 && i < end && /^updated\s*:/.test(l));
    lines.splice(at >= 0 ? at + 1 : end, 0, ...add);
  }
  return lines.join("\n");
}

const fmtList = (v) => `[${(Array.isArray(v) ? v : []).join(", ")}]`;
const lines0 = (t) => t.split(/\r?\n/);

// ─────────────────────────────────────────────────────────────────────────────

const subsysRoot = join(ROOT, "subsystems");
if (!existsSync(subsysRoot)) { console.error(`找不到 ${subsysRoot}`); process.exit(1); }
const slugs = readdirSync(subsysRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  .filter((s) => !ONLY || s === ONLY);

let doneBefore = 0, doneAfter = 0;

for (const slug of slugs) {
  const dir = join(subsysRoot, slug);
  const designFile = join(dir, "design.md");
  if (!existsSync(designFile)) continue;
  const design = readFileSync(designFile, "utf8");
  const rows = parseRoadmap(design);
  const cards = parseCards(design);
  const archFile = join(dir, "archive", "cards-done.md");
  const archived = existsSync(archFile) ? parseCards(`## Feature 契約卡\n${readFileSync(archFile, "utf8")}`) : new Map();

  // 已佔用的 F 號 → 待展開的列從最大號往下配
  const featDir = join(dir, "features");
  const files = existsSync(featDir) ? readdirSync(featDir).filter((f) => /^F\d{3}-.*\.md$/.test(f)) : [];
  let next = Math.max(0, ...files.map((f) => Number(f.slice(1, 4))));

  const index = [];

  for (const row of rows) {
    let card = cards.get(row.slug);
    if (!card || isStub(card)) card = archived.get(row.slug) ?? card;
    // 契約卡是後來才加進流程的,舊專案的 design.md 可能整章都沒有。那不是錯誤,也不該擋住
    // 遷移 —— 照樣建 `## 契約`,把表格上僅有的資訊寫進去並標成待補。之後 contract-readiness
    // A2 會如實判它「六欄沒填實質內容 → 還不能委派」,那正是這個 feature 的真實狀態。
    if (!card) {
      warnings.push(`${slug}/${row.slug}:沒有契約卡,## 契約 只填得出階段與負責模組,其餘標待補`);
      card = [`- **階段**:${row.stage ?? ""}`, `- **負責模組**:${row.modules ?? ""}`,
              "- **實作的 Level 2 介面**:TODO(v1 沒有契約卡,遷移補不出來)",
              "- **資料流管線段落**:TODO", "- **驗收標準**:TODO", "- **明確不做**:TODO"].join("\n");
    }
    if (isStub(card)) blockers.push(`${slug}/${row.slug}:契約卡只有存根,archive/cards-done.md 撈不到原文`);

    // 契約區寫**原文**,frontmatter 寫清洗過的值。清洗只為了讓索引可讀,不可以拿它覆蓋卡片
    // —— theme-full 的「負責模組」欄夾著 200 字的閘門說明,那是真知識。
    const rawStage = cardField(card, "階段") ?? row.stage ?? "";
    const rawModules = cardField(card, "負責模組") ?? row.modules ?? "";
    const stage = rawStage.match(/\((S\d+)\)/)?.[1] ?? row.stage ?? "";
    const modules = cleanModules(rawModules);
    const accept = cardField(card, "驗收標準");
    const notDo = cardField(card, "明確不做");

    if (row.doc !== row.rawDoc && row.doc !== "-") cleanups.push(`${slug}/${row.slug}:doc 欄 \`${row.rawDoc}\` → ${row.doc}`);
    if (row.doc && row.doc !== "-") {
      // ── 已建檔:契約接進同一份檔
      const f = files.find((x) => x.startsWith(`${row.doc}-`));
      if (!f) { blockers.push(`${slug}:功能規劃指向 ${row.doc},features/ 找不到`); continue; }
      const path = join(featDir, f);
      let body = readFileSync(path, "utf8");
      const { meta } = readFrontmatter(path);
      const wasDone = String(meta.status).trim() === "done";
      if (wasDone) doneBefore++;

      const sec = section(body, "## 對應的 Level 2 契約");
      const lines = body.split(/\r?\n/);
      if (sec) {
        // 這一節已經是「本 feature 涵蓋了 Level 2 的哪幾條」,而且實測連「明確不做」原文都抄了
        // 進來 —— 換個標題就位,不必重排文件結構。契約卡多出來的三欄補在最前面。
        const head = ["## 契約", "", `- **階段**:${rawStage}`, `- **負責模組**:${rawModules}`,
                      accept ? `- **驗收標準**(契約卡原文):${accept}` : null].filter((x) => x !== null);
        if (lines[sec.start + 1]?.trim() !== "") head.push("");
        lines.splice(sec.start, 1, ...head);
        body = lines.join("\n");
        if (notDo && !/\*\*明確不做\*\*/.test(section(body, "## 契約")?.text ?? "")) {
          const s2 = section(body, "## 契約");
          const l2 = body.split(/\r?\n/);
          l2.splice(s2.end, 0, `- **明確不做**(契約卡原文):${notDo}`, "");
          body = l2.join("\n");
        }
      } else {
        // 沒有那一節(不是每個專案的 spec 模板都有):契約整段是新的,插在標題之後、第一節之前
        let at = lines.findIndex((l, i) => i > 0 && /^## /.test(l));
        if (at < 0) at = lines.length;
        lines.splice(at, 0, "## 契約", "", card, "");
        body = lines.join("\n");
      }
      const st = newStatus(meta, body);
      body = patchFrontmatter(body, { status: st, stage, modules: fmtList(modules), ...(row.group ? { group: row.group } : {}) });
      if (st === "done") doneAfter++;
      plan.push({ kind: "patch", file: path, note: `${sec ? "## 對應的 Level 2 契約 → ## 契約" : "插入 ## 契約"}(階段/負責模組/驗收標準),status ${meta.status} → ${st}`, write: body });
      index.push({ id: row.doc, slug: row.slug, stage, modules: modules.join("、"), group: row.group, status: st });
    } else {
      // ── 待展開:鑄號建檔,只有 ## 契約
      const id = `F${String(++next).padStart(3, "0")}`;
      const today = new Date().toISOString().slice(0, 10);
      const deps = (row.deps ?? "").match(/#\d+/g)?.map((r) => {
        const target = rows.find((x) => x.num === r.slice(1));
        return target && target.doc !== "-" ? `${slug}/${target.doc}` : null;
      }).filter(Boolean) ?? [];
      const body = ["---", `id: ${id}`, "type: feature", `title: ${row.slug}`,
        `description: ${row.desc}`, "status: planned", `stage: ${stage}`, `modules: ${fmtList(modules)}`,
        ...(row.group ? [`group: ${row.group}`] : []),
        `created: ${today}`, `updated: ${today}`, `depends-on: ${fmtList(deps)}`,
        "related-adr: []", "related-feature: []", "code-paths: []", "---", "",
        `# ${id}: ${row.slug}`, "", "## 契約", "", card, ""].join("\n");
      plan.push({ kind: "create", file: join(featDir, `${id}-${row.slug}.md`),
        note: `待展開的列 #${row.num} → planned 文檔(依賴 ${deps.join(", ") || "無"})`, write: body });
      index.push({ id, slug: row.slug, stage, modules: modules.join("、"), group: row.group, status: "planned" });
    }
  }

  // ── design.md:砍掉功能規劃 + Feature 契約卡,換成生成的功能總覽
  const dl = design.split(/\r?\n/);
  const from = dl.findIndex((l) => l.trim() === "## 功能規劃");
  if (from >= 0) {
    // 功能規劃底下的小結散文(「#12 是依 ADR-014 追加的」「編號是 id 不是順序」之類)
    // 是真知識,不在表格裡也不在卡片裡。連同章節一起砍掉會靜默丟失,所以原文搬過來。
    let to = dl.length;
    for (let i = from + 1; i < dl.length; i++) if (/^## /.test(dl[i])) { to = i; break; }
    const prose = dl.slice(from + 1, to).filter((l) => !/^\s*\|/.test(l) && !/^###\s/.test(l)).join("\n").trim();
    // 模組群欄只有那個子系統真的分了平行領域才印 —— 它是進度分母的一部分,不能在遷移裡蒸發
    const hasGroup = index.some((r) => r.group);
    const idx = ["## 功能總覽", "",
      "<!-- BEGIN FEATURE INDEX:由 scan-status.mjs --write-index 產生,不要手改 -->",
      `| id | feature | 階段 |${hasGroup ? " 模組群 |" : ""} 模組 | 狀態 |`,
      `|---|---|---|${hasGroup ? "---|" : ""}---|---|`,
      ...index.map((r) => `| ${r.id} | ${r.slug} | ${r.stage} |${hasGroup ? ` ${r.group} |` : ""} ${r.modules} | ${r.status} |`),
      "<!-- END FEATURE INDEX -->", "",
      ...(prose ? ["### 規劃註記(v1「功能規劃」小結原文搬移;文中的 #n 是已廢除的列號)", "", prose, ""] : [])];
    plan.push({ kind: "patch", file: designFile,
      note: `砍掉「## 功能規劃」與「## Feature 契約卡」(${rows.length} 列 / ${cards.size} 張卡),換成生成的「## 功能總覽」`,
      write: [...dl.slice(0, from), ...idx].join("\n") });
  }
  if (existsSync(archFile)) plan.push({ kind: "delete", file: archFile, note: "契約卡不再搬家,存檔機制取消" });

  // ── E/B:只換 status 值域
  for (const sub of ["enhancements", "bugfixes"]) {
    const d = join(dir, sub);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith(".md"))) {
      const path = join(d, f);
      const body = readFileSync(path, "utf8");
      const { meta } = readFrontmatter(path);
      if (String(meta.status).trim() === "done") { doneBefore++; doneAfter++; }
      const st = newStatus(meta, body);
      if (st === String(meta.status).trim()) continue;
      plan.push({ kind: "patch", file: path, note: `status ${meta.status} → ${st}`, write: patchFrontmatter(body, { status: st }) });
    }
  }
}

// ── 全域 G-E / G-B:不在任何子系統底下,但一樣要換 status 值域
for (const sub of ["enhancements", "bugfixes"]) {
  const d = join(ROOT, sub);
  if (!existsSync(d) || ONLY) continue;
  for (const f of readdirSync(d).filter((x) => x.endsWith(".md"))) {
    const path = join(d, f);
    const body = readFileSync(path, "utf8");
    const { meta } = readFrontmatter(path);
    if (String(meta.status).trim() === "done") { doneBefore++; doneAfter++; }
    const st = newStatus(meta, body);
    if (st === String(meta.status).trim()) continue;
    plan.push({ kind: "patch", file: path, note: `status ${meta.status} → ${st}`, write: patchFrontmatter(body, { status: st }) });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const by = (k) => plan.filter((p) => p.kind === k);
console.log(`=== 遷移計畫(${APPLY ? "APPLY" : "dry-run"})===`);
console.log(`新建 ${by("create").length}  ·  改寫 ${by("patch").length}  ·  刪除 ${by("delete").length}\n`);
for (const kind of ["create", "patch", "delete"]) {
  if (!by(kind).length) continue;
  console.log(`--- ${{ create: "新建", patch: "改寫", delete: "刪除" }[kind]} ---`);
  for (const p of by(kind)) console.log(`  ${p.file}\n      ${p.note}`);
  console.log();
}
console.log(`驗收:已實作(done)遷移前 ${doneBefore} / 遷移後 ${doneAfter}${doneBefore === doneAfter ? "  ✓" : "  ✗ 不相等,遷移改變了完成度"}`);
if (doneBefore !== doneAfter) blockers.push("done 份數遷移前後不一致");
if (warnings.length) {
  console.log(`\n=== 遷移後要補的(${warnings.length})===`);
  for (const w of warnings) console.log(`- ${w}`);
}
if (cleanups.length) {
  console.log(`\n=== 順手修掉的髒資料(${cleanups.length})===`);
  for (const c of cleanups) console.log(`- ${c}`);
}
if (blockers.length) {
  console.log(`\n=== 阻擋遷移(${blockers.length})===`);
  for (const b of blockers) console.log(`- ${b}`);
}

if (APPLY && !blockers.length) {
  for (const p of plan) {
    if (p.kind === "delete") { rmSync(p.file, { force: true }); continue; }
    mkdirSync(join(p.file, ".."), { recursive: true });
    writeFileSync(p.file, p.write);
  }
  console.log("\n已寫入。");
} else if (APPLY) {
  console.log("\n有阻擋項目,沒有寫入任何檔案。");
}
process.exit(blockers.length ? 1 : 0);
