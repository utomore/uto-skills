#!/usr/bin/env node
/**
 * scan-coherence.mjs — 演講一致性機械檢查(供 /review 使用,唯讀,不寫任何檔案)
 *
 * 讀 docs/topic.md、docs/section-*.md、talk/src/(deck-header、section-*.md、theme.css)、
 * talk/assets/diagram-*.svg,交叉比對:段落覆蓋、deck↔docs 對應與頁數同步、圖形引用完整性、
 * 先備知識順序、時間帳,並輸出頁面地圖(版型/內文形式/圖/備註)與圖形 SVG 分析表。
 *
 * 清單欄位一律行內陣列 `[a, b]`(見 _shared/conventions.md);寫成 YAML 區塊列表會被列為格式不合規。
 *
 * 用法: node scan-coherence.mjs [專案根目錄]   (預設 .)
 * Exit code: 0 = 無硬性不一致 / 1 = 有硬性不一致、缺檔或格式不合規
 */
import { readdirSync, readFileSync, openSync, readSync, closeSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] ?? ".";
const DOCS = join(ROOT, "docs");
const TALK = join(ROOT, "talk");
const SRC = join(TALK, "src");
const ASSETS = join(TALK, "assets");
const DIST = join(TALK, "dist");
const HEAD_BYTES = 4096;
const SEC_PER_PAGE_MIN = 20; // 每頁停留過短門檻(秒)
const SEC_PER_PAGE_MAX = 180; // 每頁停留過長門檻(秒)
const NOTE_MAX_CHARS = 200; // 備註超過此字數視為逐字稿化候選
const TEXT_DIGEST_WIDTH = 80; // 頁面文字摘要顯示寬度上限

const PAGE_CLASSES = new Set(["title", "divider", "center"]);
const LAYOUT_CLASSES = new Set(["cols-2", "cols-2-1", "cols-1-2", "cols-3", "rows-2", "grid-2x2", "grid-3x2", "grid-2x3", "rows-3-2"]);
const DIRECTIVE_KEYS = new Set([
  "class", "paginate", "header", "footer", "color", "backgroundcolor", "backgroundimage",
  "backgroundposition", "backgroundrepeat", "backgroundsize", "theme", "style", "size", "math", "transition",
]);

let hard = 0;
const problem = (msg) => { hard++; console.log(`✗ ${msg}`); };
const warn = (msg) => console.log(`△ ${msg}`);
const ok = (msg) => console.log(`✓ ${msg}`);
const okUnless = (unreliable, msg) =>
  unreliable ? warn("清單欄位格式不合規,本節結果不可信 — 先修格式再重跑") : ok(msg);

// ---------- 通用工具 ----------

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

function parseValue(raw) {
  const v = raw.trim();
  const q = v.match(/^(['"])([\s\S]*?)\1/);
  if (q) return q[2];
  const arr = v.match(/^\[([\s\S]*)\]/);
  if (arr) return splitItems(arr[1]);
  return v.replace(/\s+#.*$/, "").trim();
}

function splitItems(inner) {
  return inner
    .split(",")
    .map((s) => s.trim().replace(/^(['"])([\s\S]*)\1$/, "$2").trim())
    .filter(Boolean);
}

function parseList(v) {
  if (Array.isArray(v)) return v;
  const s = String(v ?? "").trim();
  if (!s) return [];
  const m = s.match(/^\[([\s\S]*)\]$/);
  return m ? splitItems(m[1]) : [s];
}

function parseMetaLines(lines) {
  const meta = {};
  const blockListKeys = [];
  let pending = null;
  for (const line of lines) {
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
  return { meta, blockListKeys };
}

function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { meta: null, blockListKeys: [], end: -1 };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end < 0) return { meta: null, blockListKeys: [], end: -1 };
  return { ...parseMetaLines(lines.slice(1, end)), end };
}

function parseCommentMeta(text) {
  const m = text.match(/<!--([\s\S]*?)-->/);
  if (!m) return { meta: null, blockListKeys: [] };
  return parseMetaLines(m[1].split(/\r?\n/));
}

function readFrontmatter(path) {
  let last = { meta: null, blockListKeys: [] };
  for (const bytes of [HEAD_BYTES, HEAD_BYTES * 4]) {
    const head = readHead(path, bytes);
    last = parseFrontmatter(head.text);
    if (last.meta || head.full) break;
  }
  return last;
}

const badFormat = [];
function checkFormat(label, blockListKeys) {
  if (blockListKeys?.length) badFormat.push({ file: label, keys: blockListKeys });
}

function dispWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return w;
}

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

function printTable(headers, rows) {
  const cols = Object.keys(headers);
  const width = {};
  for (const c of cols) width[c] = Math.max(dispWidth(headers[c]), ...rows.map((r) => dispWidth(r[c] ?? "")));
  const pad = (v, w) => String(v ?? "") + " ".repeat(Math.max(0, w - dispWidth(v ?? "")));
  const fmt = (r) => cols.map((c) => pad(r[c], width[c])).join("  ").trimEnd();
  console.log(fmt(headers));
  console.log(cols.map((c) => "-".repeat(width[c])).join("  "));
  for (const r of rows) console.log(fmt(r));
}

const pageNo = (n) => String(n).padStart(2, "0");

// ---------- 色值 / SVG 分析(圖形 SVG 用)----------

function normColor(raw) {
  const v = raw.trim().toLowerCase();
  if (!v || v === "none" || v === "transparent" || v === "currentcolor" || v.startsWith("url(") || v.startsWith("var(")) return null;
  const hex = v.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    if (h.length === 8) return `#${h.slice(0, 6)}`;
    return `#${h}`;
  }
  return v.replace(/\s+/g, "");
}

function textPixelWidth(value, size) {
  let w = 0;
  for (const ch of value) w += /[㐀-鿿぀-ヿ가-힯,。、:;!?()「」]/.test(ch) ? 1 : 0.55;
  return w * size;
}

function pathVertices(d) {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const pts = [];
  let cur = [0, 0];
  let start = [0, 0];
  let cmd = null;
  let closed = false;
  let i = 0;
  const num = () => Number(tokens[i++] ?? 0);
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) cmd = tokens[i++];
    if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const move = (x, y) => {
      cur = rel ? [cur[0] + x, cur[1] + y] : [x, y];
      pts.push([...cur]);
    };
    if (C === "Z") { closed = true; cur = [...start]; continue; }
    if (C === "M") { const x = num(), y = num(); move(x, y); start = [...cur]; cmd = rel ? "l" : "L"; }
    else if (C === "L" || C === "T") { const x = num(), y = num(); move(x, y); }
    else if (C === "H") { const x = num(); cur = [rel ? cur[0] + x : x, cur[1]]; pts.push([...cur]); }
    else if (C === "V") { const y = num(); cur = [cur[0], rel ? cur[1] + y : y]; pts.push([...cur]); }
    else if (C === "C") { i += 4; const x = num(), y = num(); move(x, y); }
    else if (C === "S" || C === "Q") { i += 2; const x = num(), y = num(); move(x, y); }
    else if (C === "A") { i += 5; const x = num(), y = num(); move(x, y); }
    else i++;
  }
  return { pts, closed };
}

function countTurns(pts) {
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    if (Math.hypot(dx, dy) >= 2) segs.push([dx, dy]);
  }
  let turns = 0;
  for (let i = 1; i < segs.length; i++) {
    const [ax, ay] = segs[i - 1];
    const [bx, by] = segs[i];
    const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
    const ang = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
    if (ang > 20) turns++;
  }
  return turns;
}

function findConnectors(body) {
  const out = [];
  for (const m of body.matchAll(/<(path|polyline)\b([^>]*?)\/?>/g)) {
    const tag = m[1];
    const attrs = m[2];
    const fill = attrs.match(/fill\s*[:=]\s*["']?([^"';\s>]+)/)?.[1]?.toLowerCase() ?? "";
    const stroke = attrs.match(/stroke\s*[:=]\s*["']?([^"';\s>]+)/)?.[1]?.toLowerCase() ?? "";
    if (fill && fill !== "none") continue;
    if (!stroke || stroke === "none") continue;
    let pts = [];
    let closed = false;
    if (tag === "polyline") {
      const raw = attrs.match(/points\s*=\s*["']([^"']+)["']/)?.[1] ?? "";
      pts = [...raw.matchAll(/(-?\d*\.?\d+)[\s,]+(-?\d*\.?\d+)/g)].map((p) => [Number(p[1]), Number(p[2])]);
    } else {
      const d = attrs.match(/\bd\s*=\s*["']([^"']+)["']/)?.[1] ?? "";
      ({ pts, closed } = pathVertices(d));
    }
    if (closed || pts.length < 2) continue;
    out.push({
      turns: pts.length < 3 ? 0 : countTurns(pts),
      arrow: /marker-(end|start)/.test(attrs),
      from: pts[0].map(Math.round),
      to: pts[pts.length - 1].map(Math.round),
    });
  }
  return out;
}

/** 圖形 SVG 分析:viewBox、字級、色票、節點候選、連接線轉折、外部資源、相對自身 viewBox 的溢出 */
function analyzeDiagram(body) {
  const svgTag = body.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const viewBox = svgTag.match(/viewBox\s*=\s*["']([^"']+)["']/)?.[1]?.trim().replace(/\s+/g, " ") ?? "";
  const vb = viewBox.split(" ").map(Number);
  const textNodes = [...body.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => ({
    attrs: m[1],
    value: m[2].replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ").replace(/\s+/g, " ").trim(),
  }));
  const fontSizes = [...body.matchAll(/font-size\s*[:=]\s*["']?(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  const fontFamilies = [...new Set([...body.matchAll(/font-family\s*[:=]\s*["']?([^"';>]+)/g)].map((m) => m[1].trim().replace(/\s+/g, " ")))];
  const colors = [...new Set(
    [...body.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?([^"';>\s]+)/g)].map((m) => normColor(m[1])).filter(Boolean),
  )];
  const nodes = (body.match(/<(?:rect|circle|ellipse|polygon)\b/g) ?? []).length;
  const emoji = (body.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu) ?? []).length;
  const external = [...body.matchAll(/(?:href|src)\s*=\s*["'](https?:\/\/[^"']+)["']/g)].map((m) => m[1]);
  const hasImage = /<image\b/.test(body) || /data:[^;]+;base64,/.test(body);

  const overflow = [];
  if (vb.length === 4 && vb.every((n) => !Number.isNaN(n))) {
    const [vx, vy, vw, vh] = vb;
    for (const t of textNodes) {
      if (!t.value) continue;
      const x = Number(t.attrs.match(/\bx\s*=\s*["']([-\d.]+)/)?.[1] ?? NaN);
      const y = Number(t.attrs.match(/\by\s*=\s*["']([-\d.]+)/)?.[1] ?? NaN);
      const size = Number(t.attrs.match(/font-size\s*[:=]\s*["']?(\d+(?:\.\d+)?)/)?.[1] ?? 16);
      const anchor = t.attrs.match(/text-anchor\s*[:=]\s*["']?(start|middle|end)/)?.[1] ?? "start";
      if (Number.isNaN(x) || Number.isNaN(y)) continue;
      const w = textPixelWidth(t.value, size);
      const left = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
      if (left < vx - 4 || left + w > vx + vw + 4 || y > vy + vh + 4 || y < vy) {
        overflow.push(`「${truncate(t.value, 16)}」x${Math.round(left)}→${Math.round(left + w)} y${Math.round(y)}`);
      }
    }
  }

  return { viewBox, fontSizes, fontFamilies, colors, nodes, emoji, external, hasImage, overflow, connectors: findConnectors(body), texts: textNodes.map((t) => t.value).filter(Boolean) };
}

// ---------- Marp deck 解析 ----------

/** 判斷 HTML 註解是 Marp 指令(全是 directive 行)還是備註 */
function isDirectiveComment(inner) {
  const lines = inner.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return false;
  return lines.every((l) => {
    const m = l.match(/^_?([A-Za-z-]+)\s*:/);
    return m && DIRECTIVE_KEYS.has(m[1].toLowerCase());
  });
}

/** 拆一個 deck 檔(已剝 frontmatter)成頁,抽每頁的版型/內文形式/圖/備註/文字摘要 */
function parseSlides(content) {
  const body = content.replace(/\r\n/g, "\n").trim();
  const chunks = body ? body.split(/\n---\n/) : [];
  return chunks.map((chunk) => {
    const comments = [...chunk.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1]);
    const directives = comments.filter((c) => isDirectiveComment(c));
    const notes = comments.filter((c) => !isDirectiveComment(c)).map((c) => c.trim());
    const classDirective = directives.map((d) => d.match(/_?class\s*:\s*([^\n]+)/)?.[1]).find(Boolean)?.trim() ?? "";
    const pageClass = classDirective.split(/\s+/).find((c) => PAGE_CLASSES.has(c)) ?? "";
    const layouts = [...new Set([...chunk.matchAll(/<div\s+class="([^"]+)"/g)]
      .flatMap((m) => m[1].split(/\s+/))
      .filter((c) => LAYOUT_CLASSES.has(c)))];
    const images = [...chunk.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]);
    const noComments = chunk.replace(/<!--[\s\S]*?-->/g, " ");
    const hasTable = /^\s*\|.*\|/m.test(noComments);
    const hasBullets = /^\s*[-*+]\s+/m.test(noComments);
    const inlineHex = [...new Set([...noComments.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((m) => m[0].toLowerCase()))];
    const emoji = (noComments.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length;
    const external = [...noComments.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)/g)].map((m) => m[1]);
    const digest = noComments
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/^#+\s*/gm, "")
      .replace(/[|*_`>-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const forms = [];
    if (hasBullets) forms.push("條列");
    if (hasTable) forms.push("表格");
    if (!hasBullets && !hasTable && digest) forms.push("段落");
    return { pageClass, layouts, images, notes, noteChars: notes.join("").replace(/\s+/g, "").length, forms, inlineHex, emoji, external, digest };
  });
}

// ---------- 讀取素材 ----------

if (!existsSync(DOCS)) {
  console.error(`找不到 docs 目錄:${DOCS}(請在演講專案根目錄執行,或帶入根目錄路徑)`);
  process.exit(1);
}

console.log("=== 檢查範圍 ===");

const topicPath = join(DOCS, "topic.md");
let topic = null;
if (existsSync(topicPath)) {
  const parsed = readFrontmatter(topicPath);
  topic = parsed.meta;
  checkFormat("docs/topic.md", parsed.blockListKeys);
}
if (!topic) problem("docs/topic.md 缺少或無 frontmatter — 沒有燈塔無法審查主軸貼合度");
const duration = Number(topic?.["duration-minutes"] ?? 0) || 0;
const topicSections = parseList(topic?.sections);

const sections = [];
for (const name of readdirSync(DOCS).filter((f) => /^section-\d{2,}-.*\.md$/.test(f)).sort()) {
  const parsed = readFrontmatter(join(DOCS, name));
  checkFormat(`docs/${name}`, parsed.blockListKeys);
  const meta = parsed.meta ?? {};
  sections.push({
    file: `docs/${name}`,
    base: name.replace(/\.md$/, ""),
    id: String(meta.id ?? "-"),
    title: String(meta.title ?? "-"),
    description: String(meta.description ?? ""),
    status: String(meta.status ?? "⚠ missing"),
    order: Number(meta.order ?? 0) || 0,
    est: Number(meta["est-minutes"] ?? 0) || 0,
    slides: Number(meta.slides ?? 0) || 0,
    diagrams: parseList(meta.diagrams),
    dependsOn: parseList(meta["depends-on"]),
  });
}
sections.sort((a, b) => a.order - b.order);
const live = sections.filter((s) => s.status !== "rejected");

// talk/src deck 檔
const decks = [];
const hasSrc = existsSync(SRC) && statSync(SRC).isDirectory();
if (hasSrc) {
  for (const name of readdirSync(SRC).filter((f) => /^section-\d{2,}-.*\.md$/.test(f)).sort()) {
    const raw = readFileSync(join(SRC, name), "utf8");
    const fm = parseFrontmatter(raw);
    checkFormat(`talk/src/${name}`, fm.blockListKeys);
    const meta = fm.meta ?? {};
    const content = fm.end >= 0 ? raw.split(/\r?\n/).slice(fm.end + 1).join("\n") : raw;
    decks.push({
      file: `talk/src/${name}`,
      name,
      base: name.replace(/\.md$/, ""),
      num: Number(name.match(/^section-(\d+)-/)[1]),
      hasMeta: Boolean(fm.meta),
      id: String(meta.id ?? "-"),
      section: String(meta.section ?? ""),
      description: String(meta.description ?? ""),
      status: String(meta.status ?? "⚠ missing"),
      declaredSlides: meta.slides === undefined || meta.slides === "" ? null : Number(meta.slides),
      slides: parseSlides(content),
    });
  }
}

// talk/assets 圖形
const diagrams = [];
if (existsSync(ASSETS)) {
  for (const name of readdirSync(ASSETS).filter((f) => /^diagram-\d{2,}-\d+-.*\.svg$/.test(f)).sort()) {
    const body = readFileSync(join(ASSETS, name), "utf8");
    const parsed = parseCommentMeta(body.slice(0, HEAD_BYTES * 2));
    checkFormat(`talk/assets/${name}`, parsed.blockListKeys);
    const meta = parsed.meta ?? {};
    diagrams.push({
      name,
      file: `talk/assets/${name}`,
      hasMeta: Boolean(parsed.meta),
      id: String(meta.id ?? name.match(/^(diagram-\d+-\d+)-/)[1]),
      section: String(meta.section ?? ""),
      type: String(meta["diagram-type"] ?? "-"),
      description: String(meta.description ?? ""),
      status: String(meta.status ?? "⚠ missing"),
      style: analyzeDiagram(body),
    });
  }
  const strays = readdirSync(ASSETS).filter((f) => f.endsWith(".svg") && !/^diagram-\d{2,}-\d+-.*\.svg$/.test(f));
  for (const f of strays) warn(`talk/assets/${f} 不符合 diagram-<section>-<序號>-<slug>.svg 命名`);
}

const totalPages = decks.reduce((n, d) => n + d.slides.length, 0);
console.log(`topic.md:${topic ? "有" : "缺"}  section 文檔:${sections.length} 份(非 rejected ${live.length})`);
console.log(`deck 檔:${decks.length} 份、共 ${totalPages} 頁  圖形 SVG:${diagrams.length} 張`);
if (!hasSrc) warn("talk/src/ 尚未建立 — 只能審查設計文檔,投影片相關檢查全部略過(建議先跑 /topic-design 與 /section-impl)");

// ---------- 格式 ----------

if (badFormat.length) {
  console.log("\n=== frontmatter 格式不合規:清單欄位請用行內陣列 ===");
  for (const b of badFormat) {
    problem(`${b.file}:${b.keys.join("、")} 寫成 YAML 區塊列表 → 改成 ${b.keys[0]}: [item-a, item-b]`);
  }
  console.log("(清單欄位讀不到內容時,下面的比對結果不可信 — 先修格式再重跑)");
}
const unreliable = badFormat.length > 0;

// ---------- 段落覆蓋 ----------

console.log("\n=== 段落覆蓋(topic.sections ↔ docs ↔ talk/src)===");
const beforeCover = hard;
const sectionIds = sections.map((s) => s.id);
for (const id of topicSections) if (!sectionIds.includes(id)) problem(`topic.md 的 sections 有 ${id},但找不到對應檔案`);
for (const s of sections) if (topicSections.length && !topicSections.includes(s.id)) problem(`${s.file} 存在,但 topic.md 的 sections 未列 ${s.id}`);
for (const s of sections) if (s.status === "⚠ missing") problem(`${s.file} 缺 frontmatter 或 status`);
for (const s of live) if (!s.description) problem(`${s.id} 缺 description(主軸)— 無法判斷它對核心訊息的貢獻`);

if (hasSrc) {
  const byBase = new Map(sections.map((s) => [s.base, s]));
  for (const d of decks) {
    if (!d.hasMeta) problem(`${d.file} 缺 frontmatter metadata`);
    const doc = byBase.get(d.base);
    if (!doc) problem(`${d.file} 沒有對應的 docs/${d.base}.md(deck 與設計文件必須同編號同 slug)`);
    else {
      if (doc.status === "rejected") problem(`${doc.id} 已 rejected,但 talk/src/ 還留著 ${d.name}`);
      if (d.section && d.section !== doc.id) problem(`${d.file} frontmatter 的 section: ${d.section} 與對應設計文件 ${doc.id} 不符`);
    }
    if (d.hasMeta && !d.description) problem(`${d.file} 缺 description`);
  }
  const deckBases = new Set(decks.map((d) => d.base));
  for (const s of live) {
    if (!deckBases.has(s.base)) {
      if (s.status === "done") problem(`${s.id} 標記 done,但 talk/src/ 沒有對應 deck 檔(純口述段落 slides 應為 0 且不標 done 於 deck 缺席的矛盾狀態)`);
      else if (s.slides > 0) problem(`${s.id} 的 slides: ${s.slides},但 talk/src/ 沒有對應 deck 檔`);
      else warn(`${s.id}(${s.status})尚未有 deck 檔(純口述段落可忽略)`);
    }
  }
  for (const need of ["deck-header.md", "theme.css", "build.mjs"]) {
    if (!existsSync(join(SRC, need))) problem(`talk/src/${need} 不存在 — Marp 鷹架不完整,無法 build`);
  }
}
if (hard === beforeCover) okUnless(unreliable, "段落覆蓋一致");

// ---------- 頁數同步與頁面地圖 ----------

if (hasSrc && decks.length) {
  console.log("\n=== 頁數同步(deck 實際張數 ↔ deck.slides ↔ docs.slides)===");
  const beforeSync = hard;
  const byId = new Map(sections.map((s) => [s.id, s]));
  for (const d of decks) {
    const actual = d.slides.length;
    if (d.declaredSlides === null) problem(`${d.file} frontmatter 缺 slides`);
    else if (d.declaredSlides !== actual) problem(`${d.file} frontmatter 寫 slides: ${d.declaredSlides},實際 ${actual} 頁`);
    const doc = byId.get(d.section) ?? sections.find((s) => s.base === d.base);
    if (doc && doc.slides !== actual) problem(`${doc.id} 的 docs slides: ${doc.slides} 與 deck 實際 ${actual} 頁不符`);
    if (actual === 0) problem(`${d.file} 沒有任何頁(空 deck 檔)`);
  }
  if (hard === beforeSync) okUnless(unreliable, "頁數三處同步");

  console.log("\n=== 頁面地圖(逐頁開 dist 檢視時對照;版型見 _shared/layouts.md)===");
  let page = 0;
  const rows = [];
  for (const d of decks) {
    for (let i = 0; i < d.slides.length; i++) {
      const sl = d.slides[i];
      page++;
      const flags = [];
      if (!sl.notes.length) flags.push("無備註");
      if (sl.noteChars > NOTE_MAX_CHARS) flags.push(`備註${sl.noteChars}字`);
      if (sl.inlineHex.length) flags.push(`寫死色${sl.inlineHex.length}`);
      if (sl.emoji) flags.push(`emoji${sl.emoji}`);
      if (sl.external.length) flags.push("外部圖");
      if (sl.layouts.length > 1) flags.push("多版型");
      rows.push({
        page: pageNo(page),
        section: d.section || d.base,
        idx: `${i + 1}/${d.slides.length}`,
        layout: sl.pageClass || sl.layouts.join("+") || "(無)",
        forms: sl.forms.join("+") || "-",
        img: sl.images.length ? String(sl.images.length) : "-",
        note: sl.notes.length ? `${sl.noteChars}字` : "✗",
        digest: truncate(sl.digest, TEXT_DIGEST_WIDTH) || "(無文字)",
        flags: flags.join(" "),
      });
    }
  }
  printTable(
    { page: "頁", section: "section", idx: "段內", layout: "版型", forms: "內文", img: "圖", note: "備註", digest: "頁面文字", flags: "旗標" },
    rows,
  );

  // 版型收斂度
  const layoutCount = new Map();
  for (const r of rows) layoutCount.set(r.layout, (layoutCount.get(r.layout) ?? 0) + 1);
  console.log("版型使用:" + [...layoutCount.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l}(${n})`).join(" "));

  // ---------- 備註 ----------
  console.log("\n=== 備註(講稿已簡化為頁內提醒)===");
  const beforeNotes = hard;
  for (const d of decks) {
    const missing = d.slides.map((sl, i) => (sl.notes.length ? null : i + 1)).filter(Boolean);
    if (missing.length) {
      if (d.status === "done") problem(`${d.file} 第 ${missing.join("、")} 頁(段內)沒有備註 — 每頁都要有提醒`);
      else warn(`${d.file}(${d.status})第 ${missing.join("、")} 頁(段內)尚無備註`);
    }
    const first = d.slides[0];
    const last = d.slides[d.slides.length - 1];
    if (first?.notes.length && !/銜接/.test(first.notes.join(" "))) warn(`${d.file} 第 1 頁備註沒有「銜接:」提醒(怎麼接上一段)`);
    if (last?.notes.length && !/交棒/.test(last.notes.join(" "))) warn(`${d.file} 末頁備註沒有「交棒:」提醒(怎麼帶到下一段)`);
    for (let i = 0; i < d.slides.length; i++) {
      if (d.slides[i].noteChars > NOTE_MAX_CHARS) warn(`${d.file} 第 ${i + 1} 頁備註 ${d.slides[i].noteChars} 字 — 備註是提醒不是逐字稿,超過 ${NOTE_MAX_CHARS} 字就該精簡`);
    }
  }
  if (hard === beforeNotes) ok("備註覆蓋合格(△ 項仍請逐條確認)");

  // ---------- 圖形引用 ----------
  console.log("\n=== 圖形引用完整性 ===");
  const beforeDia = hard;
  const referenced = new Map(); // 檔名 → [引用頁]
  let pg = 0;
  for (const d of decks) {
    for (const sl of d.slides) {
      pg++;
      for (const src of sl.images) {
        if (/^https?:\/\//.test(src)) { problem(`第 ${pageNo(pg)} 頁引用外部圖片 ${truncate(src, 40)} — 離線必掛`); continue; }
        const base = src.replace(/^(\.\.\/)?assets\//, "");
        if (!src.includes("assets/")) warn(`第 ${pageNo(pg)} 頁圖片路徑 ${src} 不在 ../assets/ 下,確認是否刻意`);
        if (!referenced.has(base)) referenced.set(base, []);
        referenced.get(base).push(pg);
        if (src.includes("assets/") && !existsSync(join(ASSETS, base))) problem(`第 ${pageNo(pg)} 頁引用 ${src},但檔案不存在`);
      }
    }
  }
  const diagramNames = new Set(diagrams.map((x) => x.name));
  for (const dg of diagrams) {
    if (!referenced.has(dg.name)) warn(`${dg.file} 沒有被任何頁面引用 — 孤兒圖形`);
    if (!dg.hasMeta) problem(`${dg.file} 開頭沒有 metadata 註解`);
    else {
      if (!dg.section) problem(`${dg.file} metadata 缺 section`);
      if (!dg.description) problem(`${dg.file} 缺 description`);
      const numInName = dg.name.match(/^diagram-(\d+)-/)[1];
      if (dg.section && dg.section !== `section-${numInName}`) problem(`${dg.file} 檔名屬 section-${numInName},metadata 卻寫 ${dg.section}`);
    }
  }
  // docs.diagrams ↔ 檔案
  for (const s of live) {
    for (const id of s.diagrams) {
      if (!diagrams.some((dg) => dg.id === id)) problem(`${s.id} 的 diagrams 列了 ${id},但 talk/assets/ 沒有這張圖`);
    }
  }
  for (const dg of diagrams) {
    const owner = sections.find((s) => s.id === dg.section);
    if (owner && !owner.diagrams.includes(dg.id)) problem(`${dg.file} 自稱屬於 ${dg.section},但該 section 的 diagrams 沒有列 ${dg.id}`);
  }
  if (hard === beforeDia) okUnless(unreliable, diagrams.length || referenced.size ? "圖形引用一致" : "本簡報沒有圖形");

  // ---------- 圖形 SVG 分析 ----------
  if (diagrams.length) {
    console.log("\n=== 圖形 SVG 分析(可讀性證據;是否成立要開檔/開頁目視)===");
    const drows = diagrams.map((dg) => {
      const v = dg.style;
      const maxTurns = v.connectors.length ? Math.max(...v.connectors.map((c) => c.turns)) : 0;
      const flags = [];
      if (!v.viewBox) flags.push("缺viewBox");
      if (maxTurns >= 3) flags.push(`折${maxTurns}`);
      if (v.nodes > 9) flags.push(`節點${v.nodes}`);
      if (v.external.length) flags.push("外部資源");
      if (v.hasImage) flags.push("點陣圖");
      if (v.emoji) flags.push(`emoji${v.emoji}`);
      if (v.overflow.length) flags.push(`溢出?${v.overflow.length}`);
      if (!v.texts.length) flags.push("無文字");
      return {
        id: dg.id,
        type: dg.type,
        st: dg.status,
        viewBox: v.viewBox || "缺",
        size: v.fontSizes.length ? `${Math.min(...v.fontSizes)}–${Math.max(...v.fontSizes)}` : "-",
        colors: String(v.colors.length),
        nodes: String(v.nodes),
        lines: v.connectors.length ? `${v.connectors.length}/${maxTurns}` : "-",
        flags: flags.join(" "),
      };
    });
    printTable({ id: "id", type: "類型", st: "status", viewBox: "viewBox", size: "字級", colors: "色數", nodes: "節點候選", lines: "連線/最大折", flags: "旗標" }, drows);
    console.log("(字級是 SVG 座標系的名目值;實際可讀性取決於嵌入格大小,逐頁開 dist 目視確認)");
    for (const dg of diagrams) {
      const v = dg.style;
      if (v.external.length) problem(`${dg.file} 引用外部資源(${truncate(v.external[0], 40)})— 離線必掛`);
      for (const c of v.connectors.filter((c) => c.turns >= 3).sort((a, b) => b.turns - a.turns)) {
        const where = `(${c.from[0]},${c.from[1]})→(${c.to[0]},${c.to[1]})`;
        warn(`${dg.id} 有 ${c.turns} 折的線條 ${where}${c.arrow ? "(有箭頭,確定是連接線)" : "(開檔確認是否連接線)"} — 兩折是人眼極限,要靠重排節點解決`);
      }
      for (const o of v.overflow) warn(`${dg.id} 文字可能超出 viewBox:${o}(粗估,開檔確認)`);
    }

    // 圖形配色收斂
    const colorMap = new Map();
    for (const dg of diagrams) for (const c of dg.style.colors) {
      if (!colorMap.has(c)) colorMap.set(c, []);
      colorMap.get(c).push(dg.id);
    }
    if (colorMap.size) console.log(`圖形色票 ${colorMap.size} 種:` + [...colorMap.entries()].map(([c, ids]) => `${c}(${ids.length})`).join(" "));
    if (colorMap.size > 8) warn(`圖形色票 ${colorMap.size} 種,發散 — 圖形應沿用 theme.css tokens 的色值`);
  }

  // ---------- theme 與寫死色值 ----------
  console.log("\n=== 主題與色彩紀律 ===");
  const themePath = join(SRC, "theme.css");
  if (existsSync(themePath)) {
    const css = readFileSync(themePath, "utf8");
    const tokens = [...css.matchAll(/--([a-z-]+)\s*:\s*([^;]+);/g)].map((m) => `--${m[1]}=${m[2].trim()}`);
    console.log(`theme tokens:${tokens.join("  ") || "(無)"}`);
    const themeColors = new Set([...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => normColor(m[0])).filter(Boolean));
    const tokenColors = new Set(tokens.map((t) => normColor(t.split("=")[1] ?? "")).filter(Boolean));
    const deckHex = new Map();
    for (const d of decks) for (const sl of d.slides) for (const h of sl.inlineHex) {
      const n = normColor(h);
      if (!n) continue;
      if (!deckHex.has(n)) deckHex.set(n, []);
      deckHex.get(n).push(d.base);
    }
    for (const [c, files] of deckHex) {
      warn(`deck 內寫死色值 ${c}(${[...new Set(files)].join(", ")})— 色值應只住在 theme.css tokens${tokenColors.has(c) ? "(且與 token 重複)" : ""}`);
    }
    const diaColors = new Set(diagrams.flatMap((dg) => dg.style.colors));
    const offTheme = [...diaColors].filter((c) => c.startsWith("#") && !themeColors.has(c));
    if (offTheme.length) warn(`圖形用了 theme.css 沒有的色值:${offTheme.join(" ")} — 確認是刻意語意色還是隨手挑的`);
  } else if (hasSrc) {
    problem("talk/src/theme.css 不存在");
  }

  // ---------- 產物新鮮度 ----------
  console.log("\n=== 產物新鮮度 ===");
  const srcFiles = readdirSync(SRC).filter((f) => f.endsWith(".md") || f.endsWith(".css")).map((f) => join(SRC, f));
  const assetFiles = existsSync(ASSETS) ? readdirSync(ASSETS).filter((f) => f.endsWith(".svg")).map((f) => join(ASSETS, f)) : [];
  const newestSrc = Math.max(0, ...[...srcFiles, ...assetFiles].map((f) => statSync(f).mtimeMs));
  const outs = existsSync(DIST) ? readdirSync(DIST).filter((f) => /^slides\./.test(f)) : [];
  if (!outs.length) warn("talk/dist/ 沒有任何輸出 — 逐頁檢視前先在 talk/src/ 跑 node build.mjs");
  for (const o of outs) {
    const m = statSync(join(DIST, o)).mtimeMs;
    if (m < newestSrc) warn(`talk/dist/${o} 比原始碼舊 — 重 build 後再逐頁檢視,別審過期產物`);
    else ok(`talk/dist/${o} 是最新的`);
  }
}

// ---------- 先備知識順序 ----------

console.log("\n=== 先備知識順序(depends-on)===");
const beforeDep = hard;
const byId2 = new Map(sections.map((s) => [s.id, s]));
for (const s of live) {
  for (const dep of s.dependsOn) {
    const d = byId2.get(dep);
    if (!d) problem(`${s.id} 依賴 ${dep},但找不到該 section`);
    else if (d.status === "rejected") problem(`${s.id} 依賴 ${dep},但 ${dep} 已 rejected — 先備知識沒人鋪陳`);
    else if (d.order >= s.order) problem(`${s.id}(order ${s.order})依賴 ${dep}(order ${d.order})— 先備知識排在後面,順序倒置`);
  }
}
if (hard === beforeDep) okUnless(unreliable, live.some((s) => s.dependsOn.length) ? "依賴都在前面且存在" : "沒有段落宣告 depends-on(確認是真的沒有先備知識依賴)");

// ---------- 節奏與時間帳 ----------

console.log("\n=== 節奏與時間帳 ===");
const paceRows = [];
let estTotal = 0;
for (const s of live) {
  estTotal += s.est;
  const deck = decks.find((d) => d.base === s.base);
  const pages = deck ? deck.slides.length : s.slides;
  const secPerPage = pages > 0 && s.est > 0 ? Math.round((s.est * 60) / pages) : null;
  const flags = [];
  if (secPerPage !== null && secPerPage < SEC_PER_PAGE_MIN) flags.push("翻頁過快");
  if (secPerPage !== null && secPerPage > SEC_PER_PAGE_MAX) flags.push("單頁停留過久");
  if (pages === 0) flags.push("純口述");
  paceRows.push({
    id: s.id,
    desc: truncate(s.description || s.title, 28),
    st: s.status,
    est: s.est ? `${s.est}` : "-",
    pages: String(pages),
    perPage: secPerPage === null ? "-" : `${secPerPage}s`,
    flags: flags.join("/"),
  });
}
if (paceRows.length) {
  printTable({ id: "id", desc: "主軸", st: "status", est: "est分", pages: "頁", perPage: "每頁", flags: "旗標" }, paceRows);
}
console.log(`\nest-minutes 合計 ${estTotal} 分` + (duration ? ` / 總時長 ${duration} 分` : "(topic.md 缺 duration-minutes)"));
if (duration) {
  const ratio = estTotal / duration;
  if (ratio > 1) problem(`段落時間合計超出總時長 ${(estTotal - duration).toFixed(0)} 分(${Math.round(ratio * 100)}%)— 一定講不完`);
  else if (ratio > 0.95) warn(`段落時間吃掉總時長 ${Math.round(ratio * 100)}%,沒有留 5–10% 緩衝給開場與 Q&A 銜接`);
  else if (ratio < 0.8) warn(`段落時間只佔總時長 ${Math.round(ratio * 100)}%,有 ${(duration - estTotal).toFixed(0)} 分未規劃`);
  else ok(`時間帳健康(佔 ${Math.round(ratio * 100)}%,留了緩衝)`);
}

// ---------- 結論 ----------

console.log("\n=== 機械檢查結論 ===");
if (hard > 0) console.log(`硬性不一致 ${hard} 項(上面標 ✗ 的項目)。這些先修掉,再談判斷題。`);
else console.log("無硬性不一致。");
const bendy = diagrams.reduce((n, dg) => n + dg.style.connectors.filter((c) => c.turns >= 3).length, 0);
if (bendy) console.log(`連接線轉折 ≥3 的線條共 ${bendy} 條 — 開檔確認哪些真的是連接線,計入圖解可讀性扣分。`);
console.log(`版面、配色統一、用語/概念一致、AI 感、備註品質算不出來 — /review 必須 build 後逐頁開 ${totalPages} 頁目視判斷,上表只是證據與檢查清單。`);
process.exit(hard > 0 ? 1 : 0);
