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
    const texts = [...body.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    svgs.push({
      name,
      filePage,
      metaPage: meta.page === undefined || meta.page === "" ? null : Number(meta.page),
      section: String(meta.section ?? ""),
      description: String(meta.description ?? ""),
      status: String(meta.status ?? "⚠ missing"),
      hasMeta: Boolean(parsed.meta),
      texts,
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

// ---------- 各頁投影片文字摘要 ----------

if (svgs.length) {
  console.log("\n=== 各頁投影片文字摘要(用於比對講稿說法,異常頁再開原檔)===");
  const rows = svgs.map((s) => ({
    page: pageNo(s.filePage),
    section: s.section || "-",
    st: s.status,
    n: String(s.texts.length),
    digest: truncate(s.texts.join(" | "), TEXT_DIGEST_WIDTH) || "(無 <text>,純圖形頁)",
  }));
  printTable({ page: "頁", section: "section", st: "status", n: "字塊", digest: "頁面文字" }, rows);
  for (const s of svgs) if (s.texts.length === 0) warn(`第 ${pageNo(s.filePage)} 頁沒有任何 <text>(確認不是把文字轉成圖形或圖片)`);
}

// ---------- 結論 ----------

console.log("\n=== 機械檢查結論 ===");
if (hard === 0) {
  console.log("無硬性不一致。主軸貼合度、偏題比例、銜接理由、難度峰值屬於判斷題,由 /review 的審查流程接手。");
  process.exit(0);
}
console.log(`硬性不一致 ${hard} 項(上面標 ✗ 的項目)。這些先修掉,再談主軸與節奏的判斷題。`);
process.exit(1);
