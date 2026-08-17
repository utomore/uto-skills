#!/usr/bin/env node
/**
 * scan-coherence.mjs — 演講一致性機械檢查(供 /review 使用,唯讀,不寫任何檔案)
 *
 * 讀 docs/topic.md、docs/section-*.md、talk/scripts.md、talk/slide.html、talk/assets/svg-*.svg,
 * 交叉比對:頁碼五處同步、段落覆蓋、先備知識順序、節奏(講稿字數對時)、銜接標記,
 * 並輸出各頁投影片的文字摘要,讓審查時不必逐檔開 SVG。
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
const ASSETS = join(TALK, "assets");
const HEAD_BYTES = 4096;
const CJK_CPM = 225; // 中文口語每分鐘字數(conventions:200–250 取中值)
const LATIN_WPM = 140; // 英文口語每分鐘字數
const PACE_TOLERANCE = 0.25; // 講稿對時與 est-minutes 的容許偏差
const SEC_PER_PAGE_MIN = 20; // 每頁停留過短門檻(秒)
const SEC_PER_PAGE_MAX = 180; // 每頁停留過長門檻(秒)
const TEXT_DIGEST_WIDTH = 100; // 各頁文字摘要顯示寬度上限

let hard = 0; // 硬性不一致計數
const problem = (msg) => {
  hard++;
  console.log(`✗ ${msg}`);
};
const warn = (msg) => console.log(`△ ${msg}`);
const ok = (msg) => console.log(`✓ ${msg}`);
/** 清單欄位格式不合規時不能宣告「一致」— 那些欄位根本沒讀到值 */
const okUnless = (unreliable, msg) =>
  unreliable ? warn("清單欄位格式不合規,本節結果不可信 — 先修格式再重跑") : ok(msg);

// ---------- 通用工具 ----------

/** 只讀檔案開頭 bytes */
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

/** 正規化清單欄位 */
function parseList(v) {
  if (Array.isArray(v)) return v;
  const s = String(v ?? "").trim();
  if (!s) return [];
  const m = s.match(/^\[([\s\S]*)\]$/);
  return m ? splitItems(m[1]) : [s];
}

/**
 * 解析 key: value 區塊(YAML frontmatter 或註解內的 metadata)。
 * 只認 `key: value` 與行內陣列;遇到 YAML 區塊列表記進 blockListKeys 讓呼叫端報錯。
 */
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

/** markdown frontmatter(--- ... ---) */
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { meta: null, blockListKeys: [] };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end < 0) return { meta: null, blockListKeys: [] };
  return parseMetaLines(lines.slice(1, end));
}

/** HTML / XML 註解內的 metadata(檔案開頭第一組 <!-- ... -->) */
function parseCommentMeta(text) {
  const m = text.match(/<!--([\s\S]*?)-->/);
  if (!m) return { meta: null, blockListKeys: [] };
  const parsed = parseMetaLines(m[1].split(/\r?\n/));
  return { meta: parsed.meta, blockListKeys: parsed.blockListKeys };
}

/** 讀 markdown frontmatter,檔頭不足時放大重讀一次 */
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

/** 顯示寬度(CJK 全形字算 2)*/
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

/** 口語字數 → 估算分鐘 */
function speechMinutes(text) {
  const cjk = (text.match(/[㐀-鿿぀-ヿ가-힯]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z0-9][A-Za-z0-9'’\-]*/g) ?? []).length;
  return { cjk, latin, minutes: cjk / CJK_CPM + latin / LATIN_WPM };
}

const pageNo = (n) => String(n).padStart(2, "0");

// ---------- SVG 視覺規格分析 ----------

/** 色值正規化:#abc → #aabbcc,一律小寫;none / transparent / currentColor 不算色票 */
function normColor(raw) {
  const v = raw.trim().toLowerCase();
  if (!v || v === "none" || v === "transparent" || v === "currentcolor" || v.startsWith("url(")) return null;
  const hex = v.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    if (h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`; // 忽略 alpha
    if (h.length === 8) return `#${h.slice(0, 6)}`;
    return `#${h}`;
  }
  return v.replace(/\s+/g, "");
}

/** 粗估文字顯示寬度(px):CJK 約 1 個字寬,西文約 0.55 */
function textPixelWidth(value, size) {
  let w = 0;
  for (const ch of value) w += /[㐀-鿿぀-ヿ가-힯，。、：;！？（）「」]/.test(ch) ? 1 : 0.55;
  return w * size;
}

/**
 * 解析 path 的 d 屬性成頂點序列(曲線只取端點,用於粗估方向變化)。
 * 回傳 { pts, closed };closed 代表有 Z(閉合形狀,不是連接線)。
 */
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

/** 數轉折次數:相鄰線段夾角 > 20° 算一折(忽略 <2px 的雜訊段) */
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

/**
 * 抽出流程圖/架構圖的連接線(無填色、有描邊、未閉合的 path/polyline)並數轉折。
 * 兩折是人眼能快速追完的極限,3 折以上就該重畫布局。
 */
function findConnectors(body) {
  const out = [];
  for (const m of body.matchAll(/<(path|polyline)\b([^>]*?)\/?>/g)) {
    const tag = m[1];
    const attrs = m[2];
    const fill = attrs.match(/fill\s*[:=]\s*["']?([^"';\s>]+)/)?.[1]?.toLowerCase() ?? "";
    const stroke = attrs.match(/stroke\s*[:=]\s*["']?([^"';\s>]+)/)?.[1]?.toLowerCase() ?? "";
    if (fill && fill !== "none") continue; // 有填色 → 是形狀不是線
    if (!stroke || stroke === "none") continue; // 沒描邊 → 看不見
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

/**
 * 抽出可機械驗證的視覺規格:viewBox、寫死尺寸、字級、字體、色票、元素數、
 * 連接線轉折、外部資源、emoji、粗估文字溢出。
 * 判斷 Layout 好壞仍要開檔目視,這裡只給證據。
 */
function analyzeStyle(body, textNodes) {
  const svgTag = body.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const viewBox = svgTag.match(/viewBox\s*=\s*["']([^"']+)["']/)?.[1]?.trim().replace(/\s+/g, " ") ?? "";
  const hardWidth = /\bwidth\s*=\s*["'][^"']*["']/.test(svgTag);
  const hardHeight = /\bheight\s*=\s*["'][^"']*["']/.test(svgTag);

  const fontSizes = [...body.matchAll(/font-size\s*[:=]\s*["']?(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  const fontFamilies = [
    ...new Set(
      [...body.matchAll(/font-family\s*[:=]\s*["']?([^"';>]+)/g)].map((m) => m[1].trim().replace(/\s+/g, " ")),
    ),
  ];
  const colors = [
    ...new Set(
      [...body.matchAll(/(?:fill|stroke|stop-color|flood-color)\s*[:=]\s*["']?([^"';>\s]+)/g)]
        .map((m) => normColor(m[1]))
        .filter(Boolean),
    ),
  ];
  const gradients = (body.match(/<(?:linear|radial)Gradient\b/g) ?? []).length;
  const shapes = (body.match(/<(?:rect|circle|ellipse|path|polygon|polyline|line)\b/g) ?? []).length;
  const chars = textNodes.reduce((n, t) => n + t.value.length, 0);
  const emoji = (body.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu) ?? []).length;
  const hasImage = /<image\b/.test(body);
  const external = [...body.matchAll(/(?:href|src)\s*=\s*["'](https?:\/\/[^"']+)["']/g)].map((m) => m[1]);
  const base64 = /data:[^;]+;base64,/.test(body);

  // 粗估溢出:考慮 text-anchor
  const overflow = [];
  for (const t of textNodes) {
    if (!t.value) continue;
    const x = Number(t.attrs.match(/\bx\s*=\s*["']([-\d.]+)/)?.[1] ?? NaN);
    const y = Number(t.attrs.match(/\by\s*=\s*["']([-\d.]+)/)?.[1] ?? NaN);
    const size = Number(t.attrs.match(/font-size\s*[:=]\s*["']?(\d+(?:\.\d+)?)/)?.[1] ?? 32);
    const anchor = t.attrs.match(/text-anchor\s*[:=]\s*["']?(start|middle|end)/)?.[1] ?? "start";
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    const w = textPixelWidth(t.value, size);
    const left = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    const right = left + w;
    if (left < -4 || right > 1284 || y > 724 || y < 0) {
      overflow.push(`「${truncate(t.value, 20)}」x${Math.round(left)}→${Math.round(right)} y${y}`);
    }
  }

  const connectors = findConnectors(body);

  return { viewBox, hardWidth, hardHeight, fontSizes, fontFamilies, colors, gradients, shapes, chars, emoji, hasImage, external, base64, overflow, connectors };
}

// ---------- 讀取素材 ----------

if (!existsSync(DOCS)) {
  console.error(`找不到 docs 目錄:${DOCS}(請在演講專案根目錄執行,或帶入根目錄路徑)`);
  process.exit(1);
}

console.log("=== 檢查範圍 ===");

// topic.md
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

// section-*.md
const sections = [];
for (const name of readdirSync(DOCS).filter((f) => /^section-\d{2,}-.*\.md$/.test(f)).sort()) {
  const path = join(DOCS, name);
  const parsed = readFrontmatter(path);
  checkFormat(`docs/${name}`, parsed.blockListKeys);
  const meta = parsed.meta ?? {};
  sections.push({
    file: `docs/${name}`,
    id: String(meta.id ?? "-"),
    title: String(meta.title ?? "-"),
    description: String(meta.description ?? ""),
    status: String(meta.status ?? "⚠ missing"),
    order: Number(meta.order ?? 0) || 0,
    est: Number(meta["est-minutes"] ?? 0) || 0,
    pages: parseList(meta.pages).map((p) => Number(p)).filter((n) => !Number.isNaN(n)),
    dependsOn: parseList(meta["depends-on"]),
  });
}
sections.sort((a, b) => a.order - b.order);
const live = sections.filter((s) => s.status !== "rejected");

// svg-*.svg
const svgs = [];
if (existsSync(ASSETS)) {
  for (const name of readdirSync(ASSETS).filter((f) => /^svg-\d{2,}-.*\.svg$/.test(f)).sort()) {
    const path = join(ASSETS, name);
    const filePage = Number(name.match(/^svg-(\d+)-/)[1]);
    const body = readFileSync(path, "utf8");
    const parsed = parseCommentMeta(body.slice(0, HEAD_BYTES * 2));
    checkFormat(`talk/assets/${name}`, parsed.blockListKeys);
    const meta = parsed.meta ?? {};
    const textNodes = [...body.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => ({
      attrs: m[1],
      value: m[2].replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ").replace(/\s+/g, " ").trim(),
    }));
    svgs.push({
      name,
      filePage,
      metaPage: meta.page === undefined || meta.page === "" ? null : Number(meta.page),
      section: String(meta.section ?? ""),
      description: String(meta.description ?? ""),
      status: String(meta.status ?? "⚠ missing"),
      hasMeta: Boolean(parsed.meta),
      texts: textNodes.map((t) => t.value).filter(Boolean),
      style: analyzeStyle(body, textNodes),
    });
  }
}
svgs.sort((a, b) => a.filePage - b.filePage);

// scripts.md
const scriptsPath = join(TALK, "scripts.md");
let scriptsMeta = null;
const scriptSections = []; // { id, order, pages[], words, minutes, hasIntro, hasHandoff }
if (existsSync(scriptsPath)) {
  const body = readFileSync(scriptsPath, "utf8");
  const parsed = parseFrontmatter(body.slice(0, HEAD_BYTES * 4));
  scriptsMeta = parsed.meta;
  checkFormat("talk/scripts.md", parsed.blockListKeys);
  const lines = body.split(/\r?\n/);
  let cur = null;
  for (const line of lines) {
    const h = line.match(/^##\s*Section\s*(\d{1,3})/i);
    if (h) {
      cur = {
        id: `section-${pageNo(Number(h[1]))}`,
        heading: line.replace(/^##\s*/, "").trim(),
        pages: [],
        narration: "",
        hasIntro: false,
        hasHandoff: false,
      };
      scriptSections.push(cur);
      continue;
    }
    if (!cur) continue;
    const marks = [...line.matchAll(/\(\s*(?:→|->)\s*page\s*(\d{1,3})\s*\)/gi)];
    for (const m of marks) cur.pages.push(Number(m[1]));
    if (/^>\s*銜接/.test(line.trim())) cur.hasIntro = true;
    if (/^>\s*交棒/.test(line.trim())) cur.hasHandoff = true;
    if (/^>/.test(line.trim()) || /^#/.test(line.trim())) continue;
    cur.narration += " " + line.replace(/\(\s*(?:→|->)\s*page\s*\d{1,3}\s*\)/gi, " ");
  }
  for (const s of scriptSections) {
    const { cjk, latin, minutes } = speechMinutes(s.narration);
    s.words = cjk + latin;
    s.minutes = minutes;
  }
}

// slide.html
const slidePath = join(TALK, "slide.html");
let slideMeta = null;
let slidePages = [];
if (existsSync(slidePath)) {
  const body = readFileSync(slidePath, "utf8");
  const parsed = parseCommentMeta(body.slice(0, HEAD_BYTES * 2));
  slideMeta = parsed.meta;
  checkFormat("talk/slide.html", parsed.blockListKeys);
  slidePages = [...body.matchAll(/assets\/svg-(\d+)-[^"'\s>]*\.svg/g)].map((m) => Number(m[1]));
}

console.log(`topic.md:${topic ? "有" : "缺"}  section 文檔:${sections.length} 份(非 rejected ${live.length})`);
console.log(`SVG 頁面:${svgs.length} 頁  scripts.md:${existsSync(scriptsPath) ? `${scriptSections.length} 段` : "缺"}  slide.html:${existsSync(slidePath) ? `${slidePages.length} 頁` : "缺"}`);
if (!existsSync(TALK) || !statSync(TALK).isDirectory()) {
  warn("talk/ 尚未建立 — 只能審查設計文檔,講稿與投影片的一致性無法檢查(建議先跑 /section-impl)");
}

// ---------- 格式 ----------

if (badFormat.length) {
  console.log("\n=== frontmatter 格式不合規:清單欄位請用行內陣列 ===");
  for (const b of badFormat) {
    problem(`${b.file}:${b.keys.join("、")} 寫成 YAML 區塊列表 → 改成 ${b.keys[0]}: [item-a, item-b]`);
  }
  console.log("(清單欄位讀不到內容時,下面的比對結果不可信 — 先修格式再重跑)");
}

// ---------- 段落覆蓋 ----------

console.log("\n=== 段落覆蓋 ===");
const unreliable = badFormat.length > 0;
const hasTalk = existsSync(TALK) && statSync(TALK).isDirectory();
const beforeCover = hard;
const sectionIds = sections.map((s) => s.id);
for (const id of topicSections) if (!sectionIds.includes(id)) problem(`topic.md 的 sections 有 ${id},但找不到對應檔案`);
for (const s of sections) if (topicSections.length && !topicSections.includes(s.id)) problem(`${s.file} 存在,但 topic.md 的 sections 未列 ${s.id}`);
for (const s of sections) if (s.status === "⚠ missing") problem(`${s.file} 缺 frontmatter 或 status`);
for (const s of live) if (!s.description) problem(`${s.id} 缺 description(主軸)— 無法判斷它對核心訊息的貢獻`);

if (existsSync(scriptsPath)) {
  const scriptIds = scriptSections.map((s) => s.id);
  for (const s of live) {
    if (!scriptIds.includes(s.id)) {
      if (s.status === "done") problem(`${s.id} 標記 done,但 talk/scripts.md 沒有對應段落`);
      else warn(`${s.id}(${s.status})尚未寫進 talk/scripts.md`);
    }
  }
  for (const id of scriptIds) if (!sectionIds.includes(id)) problem(`talk/scripts.md 有 ${id} 的講稿,但找不到對應 section 文檔`);
  for (const s of sections) if (s.status === "rejected" && scriptIds.includes(s.id)) problem(`${s.id} 已 rejected,但講稿還留著這一段`);
  const covers = parseList(scriptsMeta?.["covers-sections"]);
  if (covers.length) {
    for (const id of covers) if (!scriptIds.includes(id)) problem(`scripts.md 的 covers-sections 列了 ${id},但內文沒有這段`);
    for (const id of scriptIds) if (!covers.includes(id)) problem(`scripts.md 內文有 ${id},但 covers-sections 沒列`);
  } else if (scriptIds.length) {
    warn("scripts.md 的 covers-sections 為空,但內文已有段落 — 回填以便追蹤");
  }
  const scriptOrder = scriptSections.map((s) => s.id);
  const expected = live.map((s) => s.id).filter((id) => scriptOrder.includes(id));
  if (scriptOrder.filter((id) => expected.includes(id)).join(",") !== expected.join(",")) {
    problem(`scripts.md 的段落順序(${scriptOrder.join(" → ")})與 section order(${expected.join(" → ")})不一致`);
  }
}
if (hard === beforeCover) okUnless(unreliable, "段落覆蓋一致");

// ---------- 頁碼五處同步 ----------

console.log("\n=== 頁碼五處同步(SVG 檔名 / SVG metadata / section.pages / scripts 標記 / slide.html)===");
const before = hard;
if (!hasTalk) {
  warn("talk/ 尚未建立,略過頁碼同步檢查(等 /section-impl 產出講稿與 SVG 後再驗)");
} else {
  const svgPages = svgs.map((s) => s.filePage);

  // 1) 檔名 vs metadata page
  for (const s of svgs) {
    if (!s.hasMeta) problem(`talk/assets/${s.name} 開頭沒有 metadata 註解`);
    else if (s.metaPage === null) problem(`talk/assets/${s.name} metadata 缺 page`);
    else if (s.metaPage !== s.filePage) problem(`talk/assets/${s.name} 檔名頁碼 ${pageNo(s.filePage)} 與 metadata page ${pageNo(s.metaPage)} 不符`);
    if (s.hasMeta && !s.section) problem(`talk/assets/${s.name} metadata 缺 section(不知道這頁屬於哪一段)`);
    if (s.hasMeta && !s.description) problem(`talk/assets/${s.name} 缺 description`);
  }

  // 2) 頁碼連續且不重複
  const dupes = svgPages.filter((p, i) => svgPages.indexOf(p) !== i);
  for (const p of new Set(dupes)) problem(`頁碼 ${pageNo(p)} 有多個 SVG 檔案(全域頁碼必須唯一)`);
  for (let i = 0; i < svgPages.length; i++) {
    if (svgPages[i] !== i + 1) {
      problem(`頁碼不連續:第 ${i + 1} 頁的檔案是 ${pageNo(svgPages[i])}(全域頁碼須從 01 連續遞增)`);
      break;
    }
  }

  // 3) SVG.section ↔ section.pages 雙向
  const pagesBySection = new Map(sections.map((s) => [s.id, s.pages]));
  for (const s of svgs) {
    if (!s.section) continue;
    if (!pagesBySection.has(s.section)) problem(`talk/assets/${s.name} 的 section: ${s.section} 找不到對應 section 文檔`);
    else if (!pagesBySection.get(s.section).includes(s.filePage)) problem(`第 ${pageNo(s.filePage)} 頁自稱屬於 ${s.section},但該 section 的 pages 沒有列 ${pageNo(s.filePage)}`);
  }
  for (const sec of sections) {
    for (const p of sec.pages) {
      const svg = svgs.find((s) => s.filePage === p);
      if (!svg) problem(`${sec.id} 的 pages 列了 ${pageNo(p)},但 talk/assets/ 沒有這頁 SVG`);
      else if (svg.section && svg.section !== sec.id) problem(`${sec.id} 的 pages 列了 ${pageNo(p)},但該頁 metadata 的 section 是 ${svg.section}`);
    }
  }

  // 4) scripts 標記 ↔ SVG
  if (existsSync(scriptsPath) && scriptSections.length) {
    const marked = scriptSections.flatMap((s) => s.pages);
    for (const p of svgPages) if (!marked.includes(p)) problem(`第 ${pageNo(p)} 頁沒有任何講稿標記((→ page ${pageNo(p)}))— 孤兒頁`);
    for (const p of marked) if (!svgPages.includes(p)) problem(`講稿標記了 (→ page ${pageNo(p)}),但沒有這頁 SVG`);
    const dupMark = marked.filter((p, i) => marked.indexOf(p) !== i);
    for (const p of new Set(dupMark)) warn(`第 ${pageNo(p)} 頁在講稿被標記多次(回頭頁?確認是刻意的)`);
    for (const s of scriptSections) {
      const sec = sections.find((x) => x.id === s.id);
      if (!sec) continue;
      for (const p of s.pages) {
        if (sec.pages.length && !sec.pages.includes(p)) problem(`${s.id} 的講稿標記了 ${pageNo(p)},但該 section 的 pages 是 [${sec.pages.map(pageNo).join(", ")}]`);
      }
    }
    const flat = marked.filter((p, i) => marked.indexOf(p) === i);
    const ascending = flat.every((p, i) => i === 0 || p > flat[i - 1]);
    if (!ascending) problem(`講稿的翻頁標記非遞增(${flat.map(pageNo).join(" → ")})— 播放順序會與講稿對不上`);
  }

  // 5) slide.html ↔ SVG
  if (existsSync(slidePath)) {
    for (const p of svgPages) if (!slidePages.includes(p)) problem(`第 ${pageNo(p)} 頁的 SVG 沒有被 slide.html 嵌入`);
    for (const p of slidePages) if (!svgPages.includes(p)) problem(`slide.html 嵌入了第 ${pageNo(p)} 頁,但檔案不存在`);
    const ascending = slidePages.every((p, i) => i === 0 || p > slidePages[i - 1]);
    if (!ascending) problem(`slide.html 的頁面順序非遞增(${slidePages.map(pageNo).join(" → ")})`);
    const declared = Number(slideMeta?.pages ?? NaN);
    if (!Number.isNaN(declared) && declared !== slidePages.length) problem(`slide.html metadata 寫 pages: ${declared},實際嵌入 ${slidePages.length} 頁`);
  }
  if (hard === before) okUnless(unreliable, svgs.length ? "頁碼五處同步" : "尚無 SVG 頁面,略過");
}

// ---------- 先備知識順序 ----------

console.log("\n=== 先備知識順序(depends-on)===");
const beforeDep = hard;
const byId = new Map(sections.map((s) => [s.id, s]));
for (const s of live) {
  for (const dep of s.dependsOn) {
    const d = byId.get(dep);
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
let scriptTotal = 0;
for (const s of live) {
  const sc = scriptSections.find((x) => x.id === s.id);
  const est = s.est;
  const actual = sc?.minutes ?? 0;
  estTotal += est;
  scriptTotal += actual;
  const dev = est > 0 && sc ? (actual - est) / est : null;
  const pages = s.pages.length;
  const secPerPage = pages > 0 && est > 0 ? Math.round((est * 60) / pages) : null;
  const flags = [];
  if (dev !== null && Math.abs(dev) > PACE_TOLERANCE) flags.push(dev > 0 ? "講稿超支" : "講稿偏短");
  if (secPerPage !== null && secPerPage < SEC_PER_PAGE_MIN) flags.push("翻頁過快");
  if (secPerPage !== null && secPerPage > SEC_PER_PAGE_MAX) flags.push("單頁停留過久");
  if (pages === 0) flags.push("純口述");
  paceRows.push({
    id: s.id,
    desc: truncate(s.description || s.title, 28),
    est: est ? `${est}` : "-",
    words: sc ? String(sc.words) : "-",
    script: sc ? actual.toFixed(1) : "-",
    dev: dev === null ? "-" : `${dev > 0 ? "+" : ""}${Math.round(dev * 100)}%`,
    pages: String(pages),
    perPage: secPerPage === null ? "-" : `${secPerPage}s`,
    flags: flags.join("/") || "",
  });
}
if (paceRows.length) {
  printTable(
    { id: "id", desc: "主軸", est: "est分", words: "講稿字", script: "對時分", dev: "偏差", pages: "頁", perPage: "每頁", flags: "旗標" },
    paceRows,
  );
}
console.log(`\nest-minutes 合計 ${estTotal} 分` + (duration ? ` / 總時長 ${duration} 分` : "(topic.md 缺 duration-minutes)"));
if (duration) {
  const ratio = estTotal / duration;
  if (ratio > 1) problem(`段落時間合計超出總時長 ${(estTotal - duration).toFixed(0)} 分(${Math.round(ratio * 100)}%)— 一定講不完`);
  else if (ratio > 0.95) warn(`段落時間吃掉總時長 ${Math.round(ratio * 100)}%,沒有留 5–10% 緩衝給開場與 Q&A 銜接`);
  else if (ratio < 0.8) warn(`段落時間只佔總時長 ${Math.round(ratio * 100)}%,有 ${(duration - estTotal).toFixed(0)} 分未規劃`);
  else ok(`時間帳健康(佔 ${Math.round(ratio * 100)}%,留了緩衝)`);
}
if (scriptTotal > 0) {
  console.log(`講稿字數對時合計 ${scriptTotal.toFixed(1)} 分(${CJK_CPM} 字/分、${LATIN_WPM} 詞/分推估)`);
  if (duration && scriptTotal > duration) problem(`講稿全文對時 ${scriptTotal.toFixed(1)} 分 > 總時長 ${duration} 分 — 逐字照講會超時`);
}

// ---------- 銜接標記 ----------

console.log("\n=== 段落銜接標記 ===");
if (!scriptSections.length) {
  warn("尚無講稿,無法檢查銜接");
} else {
  const missing = [];
  scriptSections.forEach((s, i) => {
    const isFirst = i === 0;
    const isLast = i === scriptSections.length - 1;
    if (!s.hasIntro && !isFirst) missing.push(`${s.id} 缺「> 銜接:」(怎麼接上一段)`);
    if (!s.hasHandoff && !isLast) missing.push(`${s.id} 缺「> 交棒:」(怎麼帶到下一段)`);
  });
  for (const m of missing) warn(m);
  if (!missing.length) ok("每段都有銜接與交棒標記");
  console.log("(標記存在只代表有寫;銜接理由是否成立要由審查者讀內容判斷)");
}

// ---------- 視覺規格(機械可驗部分)----------

if (svgs.length) {
  console.log("\n=== 視覺規格(逐頁;Layout 好壞與 AI 感仍須開檔目視)===");
  const rows = svgs.map((s) => {
    const v = s.style;
    const minSize = v.fontSizes.length ? Math.min(...v.fontSizes) : null;
    const flags = [];
    if (v.viewBox !== "0 0 1280 720") flags.push(`viewBox=${v.viewBox || "缺"}`);
    if (v.hardWidth || v.hardHeight) flags.push("寫死尺寸");
    if (minSize !== null && minSize < 18) flags.push(`字級${minSize}px`);
    else if (minSize !== null && minSize < 24) flags.push(`小字${minSize}px`);
    if (v.overflow.length) flags.push(`溢出?${v.overflow.length}`);
    const maxTurns = v.connectors.length ? Math.max(...v.connectors.map((c) => c.turns)) : 0;
    if (maxTurns >= 3) flags.push(`折${maxTurns}`);
    if (v.external.length) flags.push("外部資源");
    if (v.hasImage || v.base64) flags.push("點陣圖");
    if (v.emoji) flags.push(`emoji${v.emoji}`);
    return {
      page: pageNo(s.filePage),
      section: s.section || "-",
      texts: String(s.texts.length),
      chars: String(v.chars),
      shapes: String(v.shapes),
      colors: String(v.colors.length),
      grad: String(v.gradients),
      lines: v.connectors.length
        ? `${v.connectors.length}/${Math.max(...v.connectors.map((c) => c.turns))}`
        : "-",
      size: v.fontSizes.length ? `${minSize}–${Math.max(...v.fontSizes)}` : "-",
      flags: flags.join(" ") || "",
    };
  });
  printTable(
    { page: "頁", section: "section", texts: "text", chars: "字數", shapes: "圖形", colors: "色數", grad: "漸層", lines: "連線/最大折", size: "字級", flags: "旗標" },
    rows,
  );

  for (const s of svgs) {
    const v = s.style;
    const p = pageNo(s.filePage);
    if (v.viewBox !== "0 0 1280 720") problem(`第 ${p} 頁 viewBox 是「${v.viewBox || "缺"}」,慣例要求 0 0 1280 720`);
    if (v.hardWidth || v.hardHeight) problem(`第 ${p} 頁 <svg> 寫死了 width/height,會影響縮放`);
    const tooSmall = v.fontSizes.filter((n) => n < 18);
    if (tooSmall.length) problem(`第 ${p} 頁有 ${tooSmall.length} 處字級 < 18px(${[...new Set(tooSmall)].join("/")})— 現場看不到`);
    const smallish = v.fontSizes.filter((n) => n >= 18 && n < 24);
    if (smallish.length) warn(`第 ${p} 頁有 ${smallish.length} 處字級 18–23px — 只有備註/來源可以這麼小,開檔確認`);
    if (v.external.length) problem(`第 ${p} 頁引用外部資源(${truncate(v.external[0], 40)})— slide.html 必須離線可用`);
    if (v.hasImage || v.base64) warn(`第 ${p} 頁含點陣圖(<image> 或 base64)— 確認是必要的截圖而非拿圖代替 <text>`);
    if (s.texts.length === 0) warn(`第 ${p} 頁沒有任何 <text>(確認不是把文字轉成圖形或圖片)`);
    if (v.emoji) warn(`第 ${p} 頁有 ${v.emoji} 個 emoji — 檢查是否符合 topic.md 的風格,常見的 AI 感來源`);
    for (const o of v.overflow) warn(`第 ${p} 頁文字可能超出畫面:${o}(粗估,開檔確認)`);
    for (const c of v.connectors.filter((c) => c.turns >= 3).sort((a, b) => b.turns - a.turns)) {
      const where = `(${c.from[0]},${c.from[1]})→(${c.to[0]},${c.to[1]})`;
      if (c.arrow) warn(`第 ${p} 頁連接線 ${where} 有 ${c.turns} 次轉折(有箭頭,確定是連接線)— 兩折是人眼能追完的極限,圖解可讀性必扣分,要靠重排節點解決`);
      else warn(`第 ${p} 頁有 ${c.turns} 折的線條 ${where} — 若是流程圖/架構圖的連接線就扣分(兩折為極限);裝飾線不算,開檔確認`);
    }
  }

  // 全簡報收斂度
  console.log("\n--- 全簡報一致性(配色與字體)---");
  const colorPages = new Map();
  for (const s of svgs) for (const c of s.style.colors) {
    if (!colorPages.has(c)) colorPages.set(c, []);
    colorPages.get(c).push(pageNo(s.filePage));
  }
  const palette = [...colorPages.entries()].sort((a, b) => b[1].length - a[1].length);
  if (palette.length === 0) warn("沒有任何 fill/stroke 色值 — 全簡報都走瀏覽器預設黑,不可能符合 topic.md 的配色方向");
  else console.log(`色票 ${palette.length} 種:` + palette.map(([c, ps]) => `${c}(${ps.length}頁)`).join(" "));
  if (palette.length > 10) warn(`色票 ${palette.length} 種,配色發散 — 主色/輔色/強調色/背景/文字五類以內才看得出系統`);
  const outliers = palette.filter(([, ps]) => ps.length === 1);
  if (outliers.length && palette.length > 5) {
    warn(`只出現在單一頁的離群色 ${outliers.length} 種:` + outliers.map(([c, ps]) => `${c}@${ps[0]}`).join(" ") + " — 確認是刻意強調還是隨手挑的");
  }
  const familyPages = new Map();
  for (const s of svgs) for (const f of s.style.fontFamilies) {
    const key = f.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
    if (!familyPages.has(key)) familyPages.set(key, []);
    familyPages.get(key).push(pageNo(s.filePage));
  }
  if (familyPages.size === 0) warn("沒有任何頁面寫 font-family — 中文字體 fallback 必須寫入,否則換機器就變形");
  else {
    console.log(`字體 ${familyPages.size} 種:` + [...familyPages.entries()].map(([f, ps]) => `${f}(${ps.length}頁)`).join(" "));
    if (familyPages.size > 2) warn(`字體 ${familyPages.size} 種,跨頁不一致 — 標題與正文各一種就夠`);
    const missingFamily = svgs.filter((s) => s.style.fontFamilies.length === 0 && s.texts.length);
    if (missingFamily.length) warn(`有文字但沒寫 font-family 的頁:${missingFamily.map((s) => pageNo(s.filePage)).join(", ")}`);
  }
  const charCounts = svgs.map((s) => s.style.chars);
  if (charCounts.length >= 3) {
    const avg = charCounts.reduce((a, b) => a + b, 0) / charCounts.length;
    const dense = svgs.filter((s) => s.style.chars > avg * 1.8);
    if (dense.length) warn(`字數明顯高於平均(${Math.round(avg)} 字)的頁:` + dense.map((s) => `${pageNo(s.filePage)}(${s.style.chars})`).join(" ") + " — 資訊超載候選,開檔確認是否該拆頁");
  }

  console.log("\n=== 各頁文字索引(逐頁開檔時對照講稿與用語)===");
  const textRows = svgs.map((s) => ({
    page: pageNo(s.filePage),
    section: s.section || "-",
    st: s.status,
    digest: truncate(s.texts.join(" | "), TEXT_DIGEST_WIDTH) || "(無 <text>,純圖形頁)",
  }));
  printTable({ page: "頁", section: "section", st: "status", digest: "頁面文字" }, textRows);
}

// ---------- 結論 ----------

console.log("\n=== 機械檢查結論 ===");
if (hard > 0) console.log(`硬性不一致 ${hard} 項(上面標 ✗ 的項目)。這些先修掉,再談判斷題。`);
else console.log("無硬性不一致。");
const bendy = svgs.reduce((n, s) => n + s.style.connectors.filter((c) => c.turns >= 3).length, 0);
if (bendy) console.log(`連接線轉折 ≥3 的線條共 ${bendy} 條 — 逐頁開檔時確認哪些真的是流程圖/架構圖的連接線,那些要計入圖解可讀性扣分。`);
console.log(`Layout、配色統一、用語/概念一致、AI 感這四項算不出來 — /review 必須逐頁開 ${svgs.length} 個 SVG 目視判斷,上表只是證據與檢查清單。`);
process.exit(hard > 0 ? 1 : 0);
