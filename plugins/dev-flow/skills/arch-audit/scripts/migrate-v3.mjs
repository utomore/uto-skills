#!/usr/bin/env node
/**
 * migrate-v3.mjs — 把不合規章的 `.design/` 樹遷到合規(規章:doc-lifecycle.md「六種分類與分流判準」「修訂(rev 與 REV)」「`done` 的收束」)。
 *
 * 規章要求四件事,不合的樹要跟上:
 *   1. **E 不再是「優化既有功能」,是「拿掉它子系統照樣運作」的擴充功能。** 舊的 E 大多是改既有 F 的
 *      行為 / 介面 / 效能 —— 那在新模型裡是那份 F 的一次**修訂**(REV),不該是第二份檔。
 *   2. **F 多了 `rev` 欄與「核心判準」行**,分類的證據要寫在檔上。
 *   3. **GAP 結案即刪、ASM 裁完即刪**:`spec-gaps.md` 只裝 open 的,`## 待確認假設` 只裝還沒裁的。
 *      舊專案裡標 resolved 的 GAP 與帶「裁決」欄的 ASM 是墓碑,--apply 一次清掉(證據在 REV / 契約)。
 *   4. **build-log 只活在委派期間**:子系統的 F / E 全 done、spec-gaps.md 不在、待確認假設全空 = 收線,
 *      --apply 刪掉它(第四道「自裁清單抽查過或接受」是人的事,跑 --apply 視為接受)。
 *
 * 判斷不在腳本裡。每一份既有 E 要人決定三選一(摺回 F / 留 E / 拆),腳本只做兩件事:
 *   - **列清單、給提示**(介面表幾列「修改 / 移除」、related-feature 指誰、幾條觀察點在別份 F 介面上的 law),印下一份未決的原文
 *   - **--apply 做機械的那一半**:搬檔、frontmatter、REV 條目、契約骨架;Laws 合併留給人
 *
 * 決定住在**帳本** `<design>/migration-v3.md`(type: migration,不編號、不進分母):一份 E 一列,
 * 「決定」欄由人填(摺回 / 留 E / 拆),「目標」欄填摺回的 F 全名。帳本讓決定**落地、可續、可查**:
 * 這是跨好幾個 session 慢慢做的事,狀態不能只活在對話裡。本腳本不帶旗標時會建 / 補帳本(那是它
 * 自己的狀態檔),但**不碰任何 F / E 文檔**;動文檔只有 `--apply`,而且只處理帳本裡「決定已下、狀態
 * 未完成」的列。
 *
 * 用法:
 *   node migrate-v3.mjs [design目錄]                      掃描、補帳本、印下一份未決的(不動文檔)
 *   node migrate-v3.mjs [design目錄] --apply              依帳本的決定做機械的那半,回寫狀態欄
 *   node migrate-v3.mjs [design目錄] --today YYYY-MM-DD   REV 與帳本的日期以這一天為準(golden 測試用)
 *   node migrate-v3.mjs --help
 *
 * Exit code:0 = 沒有東西要遷、或全部做完(可以刪帳本)/ 1 = 還有未決或未做的列、或有 F 要補欄 /
 *           2 = design 目錄不存在、還是 v1(先跑 migrate-v2.mjs)、或帳本格式讀不懂
 *
 * 對帳:摺回不會改變任何 F 的 `done` 份數(摺回只加 REV;E 未 done 才把 F 退回 specced);帳本每一列
 * 都「完成」才准刪帳本。判準與流程見 arch-audit/SKILL.md「遷移」與 wip 設計稿 6.1 / 6.2。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { parseFrontmatter, asList } from "./_frontmatter.mjs";
import { section } from "./_sections.mjs";
import { dataCells } from "./_tables.mjs";
import { countIds, countRulings } from "./_counts.mjs";
import { parseGapBlocks } from "./_gap-status.mjs";
import { printHelpIfAsked, usageBlock } from "./_help.mjs";

const USAGE = usageBlock(import.meta.url);
const argv = process.argv.slice(2);
printHelpIfAsked(argv, import.meta.url);
let designDir = "./.design";
let apply = false;
let todayArg = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--apply") apply = true;
  else if (a === "--today") todayArg = argv[++i] ?? null;
  else if (a.startsWith("--")) {
    console.error(`未知選項: ${a}\n\n${USAGE}`);
    process.exit(2);
  } else designDir = a;
}
if (!existsSync(designDir)) {
  console.error(`找不到 design 目錄: ${designDir}`);
  process.exit(2);
}
const today = todayArg ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error(`--today 要寫成 YYYY-MM-DD,收到:${today}`);
  process.exit(2);
}
const rel = (p) => relative(designDir, p).replaceAll("\\", "/");
const listMd = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : []);
const listDirs = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith(".") && existsSync(join(dir, f, "design.md"))).sort() : []);
const nlOf = (s) => (s.includes("\r\n") ? "\r\n" : "\n");

// ---------------------------------------------------------------- 讀樹

/** 一份任務文檔:frontmatter + 幾個給提示用的數字 */
function readTask(path, subsystem) {
  const text = readFileSync(path, "utf8");
  const { meta } = parseFrontmatter(text);
  const id = meta?.id ?? basename(path).match(/^(G-[FEB]\d{3}|[FEB]\d{3})/)?.[1] ?? "?";
  const slug = basename(path).replace(/\.md$/, "").replace(/^(?:G-[FEB]\d{3}|[FEB]\d{3})-?/, "");
  const full = `${subsystem ? `${subsystem}/` : ""}${id}-${slug}`;
  const iface = section(text, /數據與介面變動|^介面$/);
  let modified = 0, removed = 0, added = 0;
  if (iface) {
    let header = null;
    for (const line of iface.body.split(/\r?\n/)) {
      const cells = dataCells(line);
      if (!cells) continue;
      if (!header) { header = cells.map((c) => c.replace(/[*`_]/g, "").trim()); continue; }
      const iA = header.findIndex((c) => /動作/.test(c));
      if (iA < 0) continue;
      const act = String(cells[iA] ?? "").trim();
      if (/修改/.test(act)) modified++;
      else if (/移除|刪除/.test(act)) removed++;
      else if (/新增/.test(act)) added++;
    }
  }
  const laws = section(text, /^Laws/)?.body ?? "";
  return {
    path, text, meta, id, slug, full, subsystem,
    type: meta?.type ?? "?",
    status: String(meta?.status ?? "?"),
    hasContract: /^##\s+契約\s*$/m.test(text),
    hasCriterion: /^-\s+\*\*(核心判準|非核心判準)\*\*/m.test(text),
    hasRev: meta?.rev !== undefined && meta?.rev !== null && String(meta.rev).trim() !== "",
    related: asList(meta?.["related-feature"]),
    modified, removed, added,
    reg: countIds(laws, "REG", "R"),
    law: countIds(laws, "LAW", "L"),
    description: meta?.description ? String(meta.description) : "-",
  };
}

// v1 判斷:design.md 還有「功能規劃」表 / 「Feature 契約卡」章節 → 先跑 migrate-v2
const subsysRoot = join(designDir, "subsystems");
const subsystems = listDirs(subsysRoot);
for (const slug of subsystems) {
  const t = readFileSync(join(subsysRoot, slug, "design.md"), "utf8");
  if (/^##\s+功能規劃/m.test(t) || /^##\s+Feature 契約卡/m.test(t)) {
    console.error(`subsystems/${slug}/design.md 還是 v1(有「功能規劃」表或「Feature 契約卡」)—— 先跑 migrate-v2.mjs,再回來跑本腳本`);
    process.exit(2);
  }
}

const feats = []; // 子系統 F
const ehs = [];   // 子系統 E
for (const slug of subsystems) {
  for (const f of listMd(join(subsysRoot, slug, "features"))) feats.push(readTask(join(subsysRoot, slug, "features", f), slug));
  for (const f of listMd(join(subsysRoot, slug, "enhancements"))) ehs.push(readTask(join(subsysRoot, slug, "enhancements", f), slug));
}
const gfeats = listMd(join(designDir, "features")).map((f) => readTask(join(designDir, "features", f), null));
const gehs = listMd(join(designDir, "enhancements")).map((f) => readTask(join(designDir, "enhancements", f), null));
const allF = [...feats, ...gfeats];
const allE = [...ehs, ...gehs];
const byFull = new Map([...allF, ...allE].map((d) => [d.full, d]));
/** 全名或 `<slug>/F00x` → doc */
function findDoc(ref) {
  const bare = String(ref ?? "").trim().split("#")[0];
  if (!bare) return null;
  if (byFull.has(bare)) return byFull.get(bare);
  const m = bare.match(/^((?:[a-z0-9-]+\/)?)(G-[FEB]\d{3}|[FEB]\d{3})/);
  if (!m) return null;
  return [...byFull.values()].find((d) => `${d.subsystem ? `${d.subsystem}/` : ""}${d.id}` === `${m[1]}${m[2]}`) ?? null;
}

// ---------------------------------------------------------------- 帳本

const LEDGER = join(designDir, "migration-v3.md");
const COLS = ["文檔", "提示", "決定", "目標", "狀態", "日期"];
const DECISIONS = new Set(["摺回", "留 E", "拆", "升 G-F", "未決", ""]);

function readLedger() {
  if (!existsSync(LEDGER)) return { rows: [], nl: "\n", head: null };
  const text = readFileSync(LEDGER, "utf8");
  const rows = [];
  let header = null;
  for (const line of text.split(/\r?\n/)) {
    const cells = dataCells(line);
    if (!cells) continue;
    if (!header) {
      header = cells.map((c) => c.replace(/[*`_]/g, "").trim());
      if (COLS.some((c) => !header.includes(c))) {
        console.error(`帳本 ${rel(LEDGER)} 的表頭要有:${COLS.join(" | ")}`);
        process.exit(2);
      }
      continue;
    }
    const get = (name) => String(cells[header.indexOf(name)] ?? "").replace(/`/g, "").trim();
    const row = Object.fromEntries(COLS.map((c) => [c, get(c)]));
    if (!DECISIONS.has(row.決定)) {
      console.error(`帳本 ${rel(LEDGER)}:「${row.文檔}」的決定「${row.決定}」不在 摺回 / 留 E / 拆 / 升 G-F / 未決 之內`);
      process.exit(2);
    }
    rows.push(row);
  }
  return { rows, nl: nlOf(text) };
}

function writeLedger(rows, nl) {
  const lines = [
    "---",
    "id: migration-v3",
    "type: migration",
    "title: migration-v3",
    "description: 核心功能模型遷移:既有 E 的分流帳本",
    `status: ${rows.every((r) => r.狀態 === "完成") && rows.length ? "done" : "open"}`,
    `created: ${existsSync(LEDGER) ? readLedgerCreated() : today}`,
    `updated: ${today}`,
    "---",
    "",
    "# 遷移帳本(migrate-v3)",
    "",
    "一份既有 E 一列。「決定」由人填:**摺回**(它改了既有功能 → 併回那份 F 成一條 REV)/ **留 E**(可獨立拿掉的新能力 → 補契約)/ **拆**(兩者混,人工處理)/ G-E 另可 **升 G-F**(其實是跨子系統核心功能 → 重新配號)。",
    "「目標」填摺回的 F 全名;「狀態」由 `migrate-v3.mjs --apply` 回寫。每一列都「完成」才准刪這份帳本。判準見 doc-lifecycle.md「六種分類與分流判準」。",
    "",
    `| ${COLS.join(" | ")} |`,
    `|${COLS.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${COLS.map((c) => r[c] || (c === "決定" ? "未決" : "")).join(" | ")} |`),
    "",
  ];
  writeFileSync(LEDGER, lines.join(nl));
}
function readLedgerCreated() {
  const { meta } = parseFrontmatter(readFileSync(LEDGER, "utf8"));
  return meta?.created ?? today;
}

const hintOf = (e) => {
  const parts = [];
  if (!e.hasContract) parts.push("無契約");
  parts.push(`修改 ${e.modified}、移除 ${e.removed}、新增 ${e.added}`);
  if (e.reg) parts.push(`REG- ${e.reg}(要按觀察點歸到各 F,改寫成 LAW-)`);
  parts.push(e.related.length ? `related ${e.related.join("、")}` : "無 related");
  if (!e.subsystem) parts.push(`subsystems ${asList(e.meta?.subsystems).join("、") || "-"}`);
  parts.push(`status ${e.status}`);
  return parts.join(";");
};

const ledger = readLedger();
const rows = ledger.rows;
const known = new Set(rows.map((r) => r.文檔));
let added = 0;
for (const e of allE) {
  if (known.has(e.full)) continue;
  // 已經是新格式(有契約、有判準、planned 起跳)的 E 不用分流
  if (e.hasContract && e.hasCriterion) continue;
  rows.push({ 文檔: e.full, 提示: hintOf(e), 決定: "未決", 目標: "", 狀態: "", 日期: "" });
  added++;
}
// 提示隨文檔現況更新(未決的列才更新;已決的保留人寫的東西)
for (const r of rows) {
  const e = findDoc(r.文檔);
  if (e && (r.決定 === "未決" || r.決定 === "")) r.提示 = hintOf(e);
}

// ---------------------------------------------------------------- F 要補的欄

const fNeeds = allF.filter((f) => !f.hasRev || (f.hasContract && !f.hasCriterion) || !f.hasContract);

// ---------------------------------------------------------------- --apply

// ---------------------------------------------------------------- 墓碑:resolved 的 GAP、裁完沒刪的 ASM

const tombstones = { gaps: [], asms: [] };
for (const p of [...subsystems.map((s) => join(subsysRoot, s, "spec-gaps.md")), join(designDir, "spec-gaps.md")]) {
  if (!existsSync(p)) continue;
  const resolved = parseGapBlocks(readFileSync(p, "utf8")).filter((g) => g.resolved).length;
  if (resolved) tombstones.gaps.push({ path: p, resolved });
}
for (const d of [...allF, ...allE]) {
  const r = countRulings(section(d.text, /待確認假設/)?.body);
  if (r.ruled) tombstones.asms.push({ path: d.path, full: d.full, ruled: r.ruled });
}

// ---------------------------------------------------------------- build-log:收線即刪(四道確認)

const buildLogs = [];
for (const slug of subsystems) {
  const p = join(subsysRoot, slug, "build-log.md");
  if (!existsSync(p)) continue;
  const docs = [...feats, ...ehs].filter((d) => d.subsystem === slug);
  const notDone = docs.filter((d) => !/^(done|closed)$/.test(d.status)).map((d) => d.full);
  const gapsLeft = existsSync(join(subsysRoot, slug, "spec-gaps.md"));
  const asmLeft = docs.filter((d) => countRulings(section(d.text, /待確認假設/)?.body).total > 0).map((d) => d.full);
  const blockers = [];
  if (notDone.length) blockers.push(`還沒 done:${notDone.join("、")}`);
  if (gapsLeft) blockers.push("spec-gaps.md 還在");
  if (asmLeft.length) blockers.push(`待確認假設還有條目:${asmLeft.join("、")}`);
  buildLogs.push({ slug, path: p, blockers });
}

const doneBefore = allF.filter((f) => /^(done|closed)$/.test(f.status)).length;
const applied = [];
const manual = [];
let retreated = 0; // 摺回讓 done 的 F 退回 specced 的份數:對帳時唯一合法的「少掉」

function bumpFrontmatter(text, edits) {
  // edits: { set: {key: value}, insertAfter: [key, line] }
  const nl = nlOf(text);
  const lines = text.split(/\r?\n/);
  const end = lines.indexOf("---", 1);
  if (lines[0] !== "---" || end < 0) throw new Error("沒有 frontmatter");
  for (const [k, v] of Object.entries(edits.set ?? {})) {
    const i = lines.findIndex((l, idx) => idx > 0 && idx < end && l.startsWith(`${k}:`));
    if (i >= 0) lines[i] = `${k}: ${v}`;
    else {
      const after = lines.findIndex((l, idx) => idx > 0 && idx < end && l.startsWith("status:"));
      lines.splice((after >= 0 ? after : end - 1) + 1, 0, `${k}: ${v}`);
    }
  }
  return lines.join(nl);
}
function ensureCriterion(text, type, subsystem, isGlobal) {
  if (/^-\s+\*\*(核心判準|非核心判準)\*\*/m.test(text)) return text;
  const nl = nlOf(text);
  const line = type === "feature"
    ? `- **核心判準**:待補(少了它,${isGlobal ? "S?(<階段名稱>)無法達成" : `${subsystem} 就無法「<system.md 職責原句>」`})`
    : `- **非核心判準**:待補(少了它,${isGlobal ? "階段照樣達成" : `${subsystem} 照樣 <做什麼>`};它加的是 <什麼>)`;
  const lines = text.split(/\r?\n/);
  const h = lines.findIndex((l) => /^##\s+契約\s*$/.test(l));
  if (h < 0) {
    // 沒有契約節:在第一個 ## 之前插一整節骨架
    const first = lines.findIndex((l, i) => i > 0 && /^##\s+/.test(l));
    const skeleton = ["## 契約", "", line, `- **階段**:${type === "enhance" ? "不掛階段" : ""}`, "- **負責模組**:", "- **實作的 Level 2 介面**:", "- **資料流管線段落**:", "- **驗收標準**:", "- **明確不做**:", ""];
    if (first < 0) lines.push("", ...skeleton);
    else lines.splice(first, 0, ...skeleton);
    return lines.join(nl);
  }
  let i = h + 1;
  while (i < lines.length && lines[i].trim() === "") i++;
  lines.splice(i, 0, line);
  return lines.join(nl);
}
function appendRevision(fText, n, source) {
  const nl = nlOf(fText);
  const entry = [
    `- REV-${n}(${today},依 遷移自 ${source.full}):${source.description}`,
    `  - 動到:待人合併 —— ${source.full} 的 Laws(LAW- ${source.law} 條、REG- ${source.reg} 條,REG 要改寫成 LAW-)與介面表(修改 ${source.modified}、移除 ${source.removed}、新增 ${source.added})要併進本檔`,
    `  - 保護:${source.reg ? `${source.full} 的 REG-(併入時改寫成本檔的 LAW-,用下一個沒用過的號;已被既有 LAW 覆蓋的丟掉)` : "無"}`,
    "  - 重委派:待人填(Laws 合併後才知道動到哪幾條)",
    `  - 連動:無(摺回時 ${source.full} 已搬進 archive/)`,
  ];
  if (/^##\s+修訂記錄/m.test(fText)) return fText.replace(/\s*$/, "") + nl + entry.join(nl) + nl;
  return fText.replace(/\s*$/, "") + nl + nl + "## 修訂記錄" + nl + entry.join(nl) + nl;
}

if (apply) {
  for (const r of rows) {
    if (r.狀態 === "完成" || r.決定 === "未決" || r.決定 === "") continue;
    const e = findDoc(r.文檔);
    if (!e) { manual.push(`${r.文檔}:帳本有列,但樹裡找不到這份文檔(已經搬走了?把狀態改成「完成」或刪掉這一列)`); continue; }
    if (r.決定 === "摺回") {
      const target = findDoc(r.目標);
      if (!target || target.type !== "feature") { manual.push(`${r.文檔}:決定是摺回,但目標「${r.目標}」指不到任何 F(寫全名,如 auth/F002-token-refresh)`); continue; }
      if (r.狀態 && /已搬檔/.test(r.狀態)) continue; // 機械的那半做過了,剩 Laws 待人合併
      // 1) 目標 F:rev +1、REV 條目、E 未 done 則 F 退回 specced
      let ft = readFileSync(target.path, "utf8");
      const curRev = target.hasRev ? Number(target.meta.rev) || 0 : 0;
      const set = { rev: String(curRev + 1), updated: today };
      if (!/^(done|closed)$/.test(e.status) && /^(done|closed)$/.test(target.status)) {
        set.status = "specced";
        retreated++;
      }
      ft = bumpFrontmatter(ft, { set });
      ft = ensureCriterion(ft, "feature", target.subsystem, !target.subsystem);
      ft = appendRevision(ft, curRev + 1, e);
      writeFileSync(target.path, ft);
      // 2) E 搬進 archive/,號永久空缺
      const archDir = e.subsystem ? join(subsysRoot, e.subsystem, "archive") : join(designDir, "archive");
      mkdirSync(archDir, { recursive: true });
      const dest = join(archDir, `${basename(e.path, ".md")}-migrated.md`);
      let et = readFileSync(e.path, "utf8");
      et = bumpFrontmatter(et, { set: { type: "archive", updated: today, ...(e.subsystem ? { parent: e.subsystem } : {}) } });
      et = et.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, (fm) => fm + `${nlOf(et)}> 遷移:本檔已摺回 ${target.full}(REV-${curRev + 1}),號 ${e.id} 永久空缺。留在 archive 只為查「當初怎麼寫的」。${nlOf(et)}`);
      writeFileSync(dest, et);
      unlinkSync(e.path); // 存檔寫成功才刪原檔:半途失敗頂多兩份都在,不會一份都不在
      r.狀態 = `已搬檔,Laws 待合併(→ ${target.full} REV-${curRev + 1}${set.status ? ",F 退回 specced" : ""})`;
      r.日期 = today;
      applied.push(`${e.full} → ${target.full} REV-${curRev + 1};E 搬到 ${rel(dest)}`);
    } else if (r.決定 === "留 E") {
      let et = readFileSync(e.path, "utf8");
      et = bumpFrontmatter(et, { set: { ...(e.hasRev ? {} : { rev: "0" }), updated: today } });
      et = ensureCriterion(et, "enhance", e.subsystem, !e.subsystem);
      writeFileSync(e.path, et);
      r.狀態 = "契約待填(骨架已補)";
      r.日期 = today;
      applied.push(`${e.full}:補 rev / 契約骨架與非核心判準,留作擴充功能`);
    } else if (r.決定 === "拆") {
      r.狀態 = r.狀態 || "人工:拆(能獨立拿掉的留 E,其餘摺回 F;拆完把兩半各自填回帳本)";
      manual.push(`${e.full}:決定是「拆」,腳本不動它 —— 人工拆完後,把留下的 E 那一半改決定「留 E」、摺回的那一半另起一列「摺回」`);
    } else if (r.決定 === "升 G-F") {
      r.狀態 = r.狀態 || "人工:重新配號 G-F";
      manual.push(`${e.full}:決定是「升 G-F」—— 用 scan-ids.mjs --claim G-F 重新配號建檔、把契約與分工表搬過去、原 G-E 搬 archive/,做完把狀態改「完成」`);
    }
  }
  // 墓碑:resolved 的 GAP 與裁完沒刪的 ASM(結案 / 裁決即刪,證據在 REV;spec-roles.md、delegation-design.md)
  for (const t of tombstones.gaps) {
    let text = readFileSync(t.path, "utf8");
    const nl = nlOf(text);
    const parts = text.split(/^(?=##\s+)/m);
    const kept = parts.filter((b, i) => i === 0 || !/^##\s+(?:GAP-\d+|G\d+)/.test(b) || !/^[ \t]*[-*][ \t]+[*`_]{0,2}狀態[*`_]{0,2}[ \t]*[::][ \t]*`?resolved/mi.test(b));
    const remaining = kept.filter((b, i) => i > 0 && /^##\s+(?:GAP-\d+|G\d+)/.test(b)).length;
    if (remaining === 0) {
      unlinkSync(t.path);
      applied.push(`${rel(t.path)}:${t.resolved} 條 resolved 的 GAP 刪掉後沒有 open 的,整個檔刪掉`);
    } else {
      writeFileSync(t.path, kept.join("").replace(/\s*$/, "") + nl);
      applied.push(`${rel(t.path)}:刪掉 ${t.resolved} 條 resolved 的 GAP,留下 ${remaining} 條 open`);
    }
  }
  for (const t of tombstones.asms) {
    let text = readFileSync(t.path, "utf8");
    const nl = nlOf(text);
    const lines = text.split(/\r?\n/);
    const h = lines.findIndex((l) => /^##\s+待確認假設/.test(l));
    if (h < 0) continue;
    let end = lines.findIndex((l, i) => i > h && /^##\s+/.test(l));
    if (end < 0) end = lines.length;
    const body = lines.slice(h + 1, end);
    const entries = [];
    for (const line of body) {
      if (/^[ \t]*[-*][ \t]*[*`_]{0,2}ASM-\d+/.test(line)) entries.push([line]);
      else if (entries.length) entries[entries.length - 1].push(line);
      else entries.push([line]); // 節首的說明文字
    }
    const keep = entries.filter((e) => !(/^[ \t]*[-*][ \t]*[*`_]{0,2}ASM-\d+/.test(e[0]) && e.some((l) => /^[ \t]+[-*][ \t]*[*`_]{0,2}裁決[*`_]{0,2}[ \t]*[::][ \t]*(?!未裁)\S/.test(l))));
    const remainingAsm = keep.filter((e) => /^[ \t]*[-*][ \t]*[*`_]{0,2}ASM-\d+/.test(e[0])).length;
    const newBody = remainingAsm ? keep.flat() : [];
    const rebuilt = remainingAsm ? [...lines.slice(0, h + 1), ...newBody, ...lines.slice(end)] : [...lines.slice(0, h), ...lines.slice(end)];
    writeFileSync(t.path, rebuilt.join(nl).replace(/\s*$/, "") + nl);
    applied.push(`${t.full}:刪掉 ${t.ruled} 條裁完沒刪的 ASM${remainingAsm ? `,留下 ${remainingAsm} 條還沒裁的` : ",整節拿掉"}`);
  }
  // build-log:四道確認都過的刪(第四道「自裁清單抽查過或接受」是人的事,跑 --apply 視為接受)
  for (const b of buildLogs) {
    const nowDocs = [...listMd(join(subsysRoot, b.slug, "features")).map((f) => readTask(join(subsysRoot, b.slug, "features", f), b.slug)), ...listMd(join(subsysRoot, b.slug, "enhancements")).map((f) => readTask(join(subsysRoot, b.slug, "enhancements", f), b.slug))];
    const stillOpen = nowDocs.some((d) => !/^(done|closed)$/.test(d.status)) || existsSync(join(subsysRoot, b.slug, "spec-gaps.md")) || nowDocs.some((d) => countRulings(section(d.text, /待確認假設/)?.body).total > 0);
    if (stillOpen) continue;
    unlinkSync(b.path);
    applied.push(`subsystems/${b.slug}/build-log.md:委派已收線(F / E 全 done、沒有 gap、沒有待裁 ASM),刪掉`);
    b.deleted = true;
  }
  // F 補欄:**重讀現況**再判 —— 上面的摺回可能剛把同一份 F 的 rev 推到 1,拿掃描時的旗標會把它蓋回 0
  for (const f of fNeeds) {
    const now = readTask(f.path, f.subsystem);
    if (now.hasRev && now.hasCriterion) continue;
    let ft = now.text;
    if (!now.hasRev) ft = bumpFrontmatter(ft, { set: { rev: "0" } });
    ft = ensureCriterion(ft, "feature", f.subsystem, !f.subsystem);
    writeFileSync(f.path, ft);
    applied.push(`${f.full}:補 ${[!now.hasRev ? "rev: 0" : null, !now.hasCriterion ? "核心判準(待補)" : null].filter(Boolean).join("、")}`);
  }
}
// ---------------------------------------------------------------- 寫帳本、印報告

const pending = rows.filter((r) => r.狀態 !== "完成");
const undecided = rows.filter((r) => r.決定 === "未決" || r.決定 === "");
if (rows.length || existsSync(LEDGER)) writeLedger(rows, ledger.nl);

console.log(`=== migrate-v3:核心功能模型遷移(${apply ? "--apply" : "dry-run,不動 F / E 文檔"})===`);
console.log(`帳本  ${rel(LEDGER)}${rows.length ? `(${rows.length} 列:未決 ${undecided.length}、已決未完成 ${pending.length - undecided.length}、完成 ${rows.length - pending.length}${added ? `;本次新增 ${added} 列` : ""})` : "(沒有要分流的 E,不建帳本)"}`);
console.log(`F 要補欄  ${fNeeds.length} 份${fNeeds.length ? `(缺 rev 或核心判準):${fNeeds.map((f) => f.full).join("、")}` : ""}${apply && fNeeds.length ? " —— 已補 rev: 0 / 核心判準「待補」,判準的內容要人填" : ""}`);
console.log(
  `墓碑  resolved 的 GAP ${tombstones.gaps.reduce((n, t) => n + t.resolved, 0)} 條(${tombstones.gaps.length} 個檔)、裁完沒刪的 ASM ${tombstones.asms.reduce((n, t) => n + t.ruled, 0)} 條(${tombstones.asms.length} 份)` +
    (tombstones.gaps.length || tombstones.asms.length ? (apply ? " —— 已刪(結案 / 裁決即刪,證據在 REV)" : " —— --apply 會刪:結案 / 裁決的結論早已在契約與 REV 裡,條目留著只是干擾") : ""),
);
if (buildLogs.length) {
  console.log(`build-log  ${buildLogs.length} 份(只活在委派期間,收線即刪):`);
  for (const b of buildLogs)
    console.log(`- subsystems/${b.slug}/build-log.md:${b.deleted ? "已刪" : b.blockers.length ? `留著 —— ${b.blockers.join(";")}` : "四道確認都過,可刪(自裁清單要不要抽查由開發者說;--apply 視為接受)"}`);
}

if (applied.length) {
  console.log("\n=== 本次 --apply 做了 ===");
  for (const l of applied) console.log(`- ${l}`);
}
if (manual.length) {
  console.log("\n=== 要人接手的 ===");
  for (const l of manual) console.log(`- ${l}`);
}

const next = undecided[0] ? findDoc(undecided[0].文檔) : null;
if (next) {
  console.log(`\n=== 下一份未決:${next.full} ===`);
  console.log(`提示  ${hintOf(next)}`);
  console.log("問一句:**這份 E 能不能被描述成「拿掉它,原功能還在、行為不變」?** 能 → 留 E;不能(它改了既有功能)→ 摺回那份 F;兩者混 → 拆。決定寫進帳本的「決定」欄(摺回要填「目標」),再跑 --apply。");
  const c = section(next.text, /^契約$|現況分析|Scope/);
  const i = section(next.text, /數據與介面變動|^介面$/);
  for (const sec of [c, i]) if (sec) console.log(`\n${sec.text.split(/\r?\n/).slice(0, 25).join("\n")}`);
} else if (rows.length && pending.length) {
  console.log("\n沒有未決的列;已決的跑 --apply,或把人工處理完的列狀態改成「完成」。");
}

if (apply) {
  const doneAfter = [...listDirs(subsysRoot).flatMap((s) => listMd(join(subsysRoot, s, "features")).map((f) => readTask(join(subsysRoot, s, "features", f), s))), ...listMd(join(designDir, "features")).map((f) => readTask(join(designDir, "features", f), null))]
    .filter((f) => /^(done|closed)$/.test(f.status)).length;
  console.log(`\n對帳  done 的 F:遷移前 ${doneBefore} → 後 ${doneAfter}${doneBefore === doneAfter ? "(相等)" : doneBefore - doneAfter === retreated ? `(少 ${retreated} 份 = 摺回讓 F 退回 specced,實作要重做 REV 點名的部分)` : " ⚠ 不相等而且不是退回造成的,停下來看"}`);
}
if (rows.length && !pending.length) console.log("\n帳本每一列都完成了:確認 done 的 F 份數與遷移前相等後,刪掉 migration-v3.md。");

process.exit(pending.length || fNeeds.length ? 1 : 0);
