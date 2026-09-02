#!/usr/bin/env node
/**
 * id-map.mjs — 把整套流程的「編號與縮寫」畫成樹狀圖。
 *
 * 兩種模式:
 *   慣例模式(不給路徑):畫**編號體系本身** —— 哪一層的哪個命令會鑄出哪些號、
 *                        每個號住在哪、誰配、活多久。回答「這些縮寫到底是什麼」。
 *   專案模式(給 .design 路徑):把那個專案**實際存在的號**掛進同一棵樹,
 *                        並標出流程走到哪一步。回答「這個專案過去跑過什麼」。
 *
 * 為什麼要有這支:編號分散在九個地方鑄造,註冊表是一張平表,看不出「誰先誰後、誰生誰」。
 * 樹狀圖把命名空間還原成它真正的形狀 —— 流程的形狀。
 *
 * 用法:
 *   node id-map.mjs                    畫慣例樹
 *   node id-map.mjs .design            畫某專案的實際編號樹
 *   node id-map.mjs .design --legend   實際樹之後附上慣例說明
 *
 * Exit code:0 一律成功(這是說明工具,不做驗收)/ 2 = 路徑不存在
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------- 慣例樹(與 doc-lifecycle.md 註冊表同步)

/**
 * 每個節點:label(顯示)、meta(作用域 / 誰配 / 壽命)、kids(子節點)。
 * 「壽命」只有兩種:永久(規劃或成果的一部分)、用完即棄(某一次執行的調度痕跡)。
 */
const CONVENTION = {
  label: "編號與縮寫體系",
  meta: "唯一鑄號機關:_shared/doc-lifecycle.md「編號與縮寫註冊表」",
  kids: [
    {
      label: "Level 1  /system-design",
      meta: "產出 .design/system.md + ADR",
      kids: [
        { label: "S0、S1…", meta: "開發階段 · 全專案唯一 · /system-design 配 · 永久", note: "產品級分母:「還差什麼」只有它答得出來" },
        { label: "ADR-001", meta: "架構決策 · 全局一組 · 建檔時掃描 · 永久" },
        { label: "<subsystem-slug>", meta: "子系統名冊 · 全專案唯一 · /system-design 定 · 永久", note: "含還沒建 design.md 的" },
      ],
    },
    {
      label: "Level 2  /subsys-design",
      meta: "產出 subsystems/<slug>/design.md、contracts/G-C00x",
      kids: [
        { label: "G-C001", meta: "全域共用契約 · 全域一組 · 建檔時掃描 · 永久", note: "引用時寫到條目:G-C001#SessionToken" },
        { label: "模組群名(WorldSim…)", meta: "子系統內的平行領域 · 該 design.md 內唯一 · 永久", note: "planned 的那幾群不進進度分母" },
        { label: "#1、#2…", meta: "功能規劃表的項次 · 該表內唯一 · 永久", note: "「依賴」欄用它互相引用" },
        { label: "A1–A10 / B1–B4", meta: "契約就緒度檢查條 · contract-readiness.md 內 · 固定不配號", note: "引用一定帶檔名:contract-readiness.md A5" },
      ],
    },
    {
      label: "Level 3  /spec-design → /spec-qa ∥ /spec-impl · /bugfix",
      meta: "產出 features/ enhancements/ bugfixes/ 的任務文檔 + 骨架",
      kids: [
        { label: "F001 / E001 / B001", meta: "任務文檔 id · 子系統內各一組 · 建檔時掃描 · 永久", note: "一份 = 一個 feature / 優化 / 缺陷的 spec;份數是「已建檔」,分母是 design.md 功能規劃的項數" },
        { label: "G-E001 / G-B001", meta: "跨子系統的全域優化 / 修復 · 全域各一組 · 永久" },
        { label: "LAW-1", meta: "行為性質 · 單一 spec 檔內 · spec 角色配 · 永久", note: "qa 一條翻一個 property test —— 條數 = 測試的分母,不是跑出來的測試數" },
        { label: "REG-1", meta: "回歸 law(enhance 專用)· 單一 spec 檔內 · 永久", note: "保護改完必須一模一樣的現有行為" },
        { label: "EX-1", meta: "具體範例 · 單一 spec 檔內 · spec 角色配 · 永久", note: "qa 一個翻一個 example test;LAW + EX 就是「這份 spec 應該有幾個測試」" },
        { label: "STEP-1", meta: "bugfix TodoList 步驟 · 單一 bugfix 檔內 · 永久", note: "dep: 欄互相引用" },
        { label: "GAP-1", meta: "spec 疑問 · 單一 spec-gaps.md 內 · 編排者單線配 · 永久", note: "有 open 的就代表有項目卡著" },
      ],
    },
    {
      label: "編排層  /spec-build · /subsys-build",
      meta: "產出 build-log.md;以下全部是**過程**的編號,不是產品的一部分",
      kids: [
        { label: "WAVE-1", meta: "波次 · 單一次展開內 · 編排者算出來 · 用完即棄", note: "把 feature 分幾批送出(同批平行、批間有依賴)—— 不是 feature 數,波次數 <= feature 數" },
        { label: "DEC-1", meta: "批次澄清的裁決 · 單一 build-log 內 · 編排者配 · 永久(供事後查)" },
        { label: "ASM-1", meta: "待確認假設 · 單一 spec 檔內 · spec subagent 配 · 上閘門後結案", note: "契約層級:設計者自己判斷後繼續推進,閘門再裁" },
        { label: "SELF-1", meta: "自裁記錄 · 單一回報 / 自裁清單內 · spec subagent 配 · 供抽查", note: "實作層級:不進文檔、不上閘門" },
      ],
    },
    {
      label: "永遠不給的",
      meta: "留白比佔用重要",
      kids: [
        { label: "L1 / L2 / L3", meta: "禁用", note: "Level 一律寫全名;L 會撞專案的 Layer 與舊寫法的 law" },
        { label: "單字母+數字(表外)", meta: "禁用", note: "只留給文檔 id(三位數)與開發階段(S<n>);其餘一律詞首碼" },
      ],
    },
  ],
};

// ---------------------------------------------------------------- 畫樹

const C = { dim: "\x1b[2m", off: "\x1b[0m", bold: "\x1b[1m" };
const plain = !process.stdout.isTTY;
const dim = (s) => (plain ? s : `${C.dim}${s}${C.off}`);
const bold = (s) => (plain ? s : `${C.bold}${s}${C.off}`);

function draw(node, prefix = "", isLast = true, isRoot = false) {
  if (isRoot) {
    console.log(bold(node.label));
    if (node.meta) console.log(dim(`  ${node.meta}`));
  } else {
    console.log(`${prefix}${isLast ? "└─ " : "├─ "}${bold(node.label)}`);
    const pad = `${prefix}${isLast ? "   " : "│  "}`;
    if (node.meta) console.log(dim(`${pad}${node.meta}`));
    if (node.note) console.log(dim(`${pad}↳ ${node.note}`));
  }
  const kids = node.kids ?? [];
  const childPrefix = isRoot ? "" : `${prefix}${isLast ? "   " : "│  "}`;
  kids.forEach((k, i) => draw(k, childPrefix, i === kids.length - 1));
}

// ---------------------------------------------------------------- 專案模式:掃出實際存在的號

function frontmatter(path) {
  try {
    const t = readFileSync(path, "utf8");
    const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return { meta: {}, body: t };
    const meta = {};
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2].trim();
    }
    return { meta, body: t };
  } catch {
    return { meta: {}, body: "" };
  }
}

const listMd = (d) => {
  try {
    return readdirSync(d).filter((n) => n.endsWith(".md")).sort();
  } catch {
    return [];
  }
};

/**
 * 取出某個 `## 章節` 到下一個 `##` 之間的內文。找不到回空字串。
 * 編號只在它該住的章節裡數 —— 全檔亂數會把表格裡的數值、程式碼片段一起算進來,
 * 而報一個你證明不了的數字,比不報還糟。
 */
function section(body, titleRe) {
  const lines = body.split(/\r?\n/);
  const out = [];
  let inside = false;
  for (const line of lines) {
    const h = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (h) {
      if (h[1].length === 2) inside = titleRe.test(h[2]);
      else if (!inside) continue;
      if (h[1].length === 2) continue;
    }
    if (inside) out.push(line);
  }
  return out.join("\n");
}

/**
 * 數某個編號在檔案內被**定義**了幾次。只認三種「定義位置」,不認散落在內文的提及:
 *   清單項  `- LAW-1: …` / `- [ ] STEP-1: …`
 *   小標題  `## GAP-1(…)`
 *   表格首欄 `| EX-1 | … |`(Examples 與 build-log 的表都長這樣)
 * 新舊制都收(`LAW-1` 與舊的 `L1`),回傳去重後的序號個數。
 */
function countIds(body, ...prefixes) {
  const alt = prefixes.join("|");
  const em = "[*`_]{0,2}"; // 容忍 `- **LAW-1**(…)` 這種強調寫法 —— 實際文檔大量這樣寫
  const seen = new Set();
  const listOrHead = new RegExp(
    `(?:^|\\n)[ \\t]*(?:[-*][ \\t]*(?:\\[[ x]\\][ \\t]*)?|#{2,4}[ \\t]*)${em}(?:${alt})-?(\\d+)${em}\\s*[::.)\\s(（]`,
    "g",
  );
  const tableCell = new RegExp(`(?:^|\\n)[ \\t]*\\|[ \\t]*${em}(?:${alt})-?(\\d+)${em}[ \\t]*\\|`, "g");
  for (const re of [listOrHead, tableCell]) for (const m of body.matchAll(re)) seen.add(m[1]);
  return seen.size;
}

/**
 * 數 design.md「功能規劃」表有幾列 feature —— 那是這個子系統的**分母**,
 * features/ 裡的檔案數只是已經展開的部分(分子)。
 */
function countRoadmapRows(body) {
  const road = section(body, /功能規劃/);
  let col = null;
  let n = 0;
  for (const line of road.split(/\r?\n/)) {
    if (line.match(/^#{3,6}\s/)) {
      col = null;
      continue;
    }
    if (!line.trim().startsWith("|")) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) continue;
    const keys = cells.map((c) => c.replace(/[`*_\s]/g, "").toLowerCase());
    const docCol = keys.indexOf("doc");
    if (docCol >= 0) {
      const fc = keys.findIndex((c) => c === "feature" || c.includes("功能"));
      col = fc >= 0 ? { feature: fc } : null;
      continue;
    }
    if (!col) continue;
    const f = (cells[col.feature] ?? "").replace(/[`*_]/g, "").trim();
    if (f && f !== "-" && !/^<.+>$/.test(f)) n++;
  }
  return n;
}

function buildProjectTree(designDir) {
  const sysPath = join(designDir, "system.md");
  const sys = frontmatter(sysPath);
  const roster = (sys.meta.subsystems ?? "[]").replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);

  // 開發階段:與 scan-status.mjs 的 parseStages 同一套判準 —— 必須先看到同時含
  // 「階段」與「狀態」兩欄的表頭才開始收列,否則同一個 H2 底下的別張表(例如搬遷對照)會被誤收
  const stages = [];
  let inStage = false;
  let col = null;
  for (const line of sys.body.split(/\r?\n/)) {
    const h = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (h) {
      if (h[1].length === 2) inStage = /開發階段/.test(h[2]);
      col = null;
      continue;
    }
    if (!inStage || !line.trim().startsWith("|")) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) continue;
    const keys = cells.map((c) => c.replace(/[`*_\s]/g, "").toLowerCase());
    const stageCol = keys.indexOf("階段");
    if (stageCol >= 0) {
      const statusCol = keys.findIndex((c) => c === "狀態" || c === "status");
      col = statusCol >= 0 ? { stage: stageCol, status: statusCol } : null;
      continue; // 表頭列
    }
    if (!col) continue;
    const title = (cells[col.stage] ?? "").replace(/[`*_]/g, "").trim();
    const id = title.split(/\s+/)[0];
    if (!id || id === "-" || /^<.+>$/.test(id)) continue;
    const st = (cells[col.status] ?? "").replace(/[`*_]/g, "");
    stages.push({ id, title, status: /未開始|未啟動|尚未/.test(st) ? "未開始" : /進行中/.test(st) ? "進行中" : /已達成|已完成/.test(st) ? "已達成" : "?" });
  }

  const adrs = listMd(join(designDir, "adr"));
  const contracts = listMd(join(designDir, "contracts"));

  // ---- 收集成表格列。階層靠第一欄縮排表達:子系統 → 模組群 ----
  const rows = [];
  let built = 0;

  for (const slug of roster) {
    const dir = join(designDir, "subsystems", slug);
    if (!existsSync(join(dir, "design.md"))) {
      rows.push({ name: slug, status: "未建", f: "-", e: "-", b: "-", law: "-", ex: "-", asm: "-", gap: "-", wave: "-" });
      continue;
    }
    built++;
    const d = frontmatter(join(dir, "design.md"));
    const feats = listMd(join(dir, "features"));
    const enh = listMd(join(dir, "enhancements"));
    const bugs = listMd(join(dir, "bugfixes"));

    // 模組群:子系統內的平行領域。planned 的那幾群沒有契約,不在進度分母裡
    const groups = [];
    {
      const g = section(d.body, /模組群/);
      let col = null;
      for (const line of g.split(/\r?\n/)) {
        if (!line.trim().startsWith("|")) continue;
        const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) continue;
        const keys = cells.map((c) => c.replace(/[`*_\s]/g, "").toLowerCase());
        const nameCol = keys.indexOf("模組群");
        if (nameCol >= 0) {
          const stCol = keys.findIndex((c) => c === "狀態" || c === "status");
          col = stCol >= 0 ? { name: nameCol, status: stCol } : null;
          continue;
        }
        if (!col) continue;
        const name = (cells[col.name] ?? "").replace(/[`*_]/g, "").trim();
        if (!name || name === "-" || /^<.+>$/.test(name)) continue;
        groups.push({ name, planned: /planned|規劃|未建|未寫/i.test(cells[col.status] ?? "") });
      }
    }

    // spec 檔內的條目。序號在**單一檔案內**去重,跨檔相加;只在該住的章節裡數
    let law = 0, ex = 0, asm = 0, legacy = 0;
    for (const f of [...feats, ...enh]) {
      const b = frontmatter(join(dir, f.startsWith("F") ? "features" : "enhancements", f)).body;
      const laws = section(b, /^Laws/);
      const exs = section(b, /^Examples/);
      if (!laws && !exs) legacy++; // 舊版模板(TodoList 制),沒有可被 qa 一比一投影的條文
      law += countIds(laws, "LAW", "REG", "L", "R");
      ex += countIds(exs, "EX", "E");
      asm += countIds(section(b, /待確認假設/), "ASM", "A");
    }

    let gapCell = "-";
    const gapPath = join(dir, "spec-gaps.md");
    if (existsSync(gapPath)) {
      const g = frontmatter(gapPath);
      const open = (g.body.match(/^\s*[-*]\s*狀態\s*[::]\s*open/gim) ?? []).length;
      gapCell = `${open}/${countIds(g.body, "GAP", "G")}`;
    }

    let waveCell = "-";
    if (existsSync(join(dir, "build-log.md"))) {
      const b = frontmatter(join(dir, "build-log.md")).body;
      const sched = section(b, /排程/);
      waveCell = String(new Set([...sched.matchAll(/\|[^|]*?\b(?:WAVE-|W)(\d+)\b/g)].map((m) => m[1])).size || "-");
    }

    const planned = countRoadmapRows(d.body);
    rows.push({
      name: slug,
      status: d.meta.status ?? "active",
      f: planned ? `${feats.length}/${planned}` : String(feats.length || "-"),
      e: String(enh.length || "-"),
      b: String(bugs.length || "-"),
      law: legacy && !law ? "舊模板" : String(law || "-"),
      ex: legacy && !ex ? "舊模板" : String(ex || "-"),
      asm: String(asm || "-"),
      gap: gapCell,
      wave: waveCell,
    });

    // 模組群各一列,縮排掛在子系統底下
    groups.forEach((g, i) => {
      const branch = i === groups.length - 1 ? "└ " : "├ ";
      rows.push({
        name: `  ${branch}${g.name}`,
        status: g.planned ? "planned" : "active",
        f: "-", e: "-", b: "-", law: "-", ex: "-", asm: "-", gap: "-", wave: "-",
      });
    });
  }

  // ---- 全域任務文檔(G-E / G-B):它們不屬於任何子系統,所以上面的迴圈一列都看不到。
  // 少了這一列,一個有九份跨子系統優化的專案在這張表上看起來像「全域什麼都沒有」。
  {
    const genh = listMd(join(designDir, "enhancements"));
    const gbugs = listMd(join(designDir, "bugfixes"));
    let law = 0, ex = 0, asm = 0, legacy = 0;
    for (const f of genh) {
      const b = frontmatter(join(designDir, "enhancements", f)).body;
      const laws = section(b, /^Laws/);
      const exs = section(b, /^Examples/);
      if (!laws && !exs) legacy++;
      law += countIds(laws, "LAW", "REG", "L", "R");
      ex += countIds(exs, "EX", "E");
      asm += countIds(section(b, /待確認假設/), "ASM", "A");
    }
    let gapCell = "-";
    const gapPath = join(designDir, "spec-gaps.md");
    if (existsSync(gapPath)) {
      const g = frontmatter(gapPath);
      const open = (g.body.match(/^\s*[-*]\s*狀態\s*[::]\s*open/gim) ?? []).length;
      gapCell = `${open}/${countIds(g.body, "GAP", "G")}`;
    }
    if (genh.length || gbugs.length || gapCell !== "-") {
      rows.push({
        name: "(全域 G-)",
        status: "—",
        f: "-",
        e: String(genh.length || "-"),
        b: String(gbugs.length || "-"),
        law: legacy && !law ? "舊模板" : String(law || "-"),
        ex: legacy && !ex ? "舊模板" : String(ex || "-"),
        asm: String(asm || "-"),
        gap: gapCell,
        wave: "-",
      });
    }
    var globalCounts = { enh: genh.length, bugs: gbugs.length };
  }

  return { sys, roster, stages, adrs, contracts, rows, built, globalCounts };
}

/** 顯示寬度(CJK 全形字算 2)—— 與 scan-status.mjs 同一份實作 */
function dispWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return w;
}

function padTo(s, n, right = false) {
  const gap = " ".repeat(Math.max(0, n - dispWidth(s)));
  return right ? gap + s : s + gap;
}

function renderProject(designDir) {
  const { sys, roster, stages, adrs, contracts, rows, built, globalCounts } = buildProjectTree(designDir);

  // 抬頭:專案 → 階段 → 總計。三行講完「這是什麼、走到哪、有多大」
  console.log(bold(`${sys.meta.title ?? designDir}  ${sys.meta.description ?? ""}`));
  if (stages.length) {
    const gr = [];
    for (const s of stages) {
      const last = gr[gr.length - 1];
      if (last && last.status === s.status) last.ids.push(s.id);
      else gr.push({ status: s.status, ids: [s.id] });
    }
    const fmt = gr.map((g) => `${g.ids.length > 2 ? `${g.ids[0]}–${g.ids[g.ids.length - 1]}` : g.ids.join(" ")} ${g.status}`).join("  ·  ");
    console.log(`階段  ${fmt}`);
  } else {
    console.log("階段  ⚠ system.md 沒有可解析的「開發階段」表,答不出「還差什麼」");
  }
  // 全域的三種東西各報各的:「全域契約 0」單獨出現時會被讀成「全域什麼都沒有」,
  // 而同一個專案可能有九份跨子系統的 G-E 正在跑。
  console.log(
    dim(
      `子系統 ${built}/${roster.length} 已建  ·  ADR ${adrs.length}  ·  全域契約 G-C ${contracts.length}` +
        `  ·  全域優化 G-E ${globalCounts?.enh ?? 0}  ·  全域修復 G-B ${globalCounts?.bugs ?? 0}\n`,
    ),
  );

  const cols = [
    { k: "name", h: "子系統 / 模組群", right: false },
    { k: "status", h: "狀態", right: false },
    { k: "f", h: "F", right: true },
    { k: "e", h: "E", right: true },
    { k: "b", h: "B", right: true },
    { k: "law", h: "LAW", right: true },
    { k: "ex", h: "EX", right: true },
    { k: "asm", h: "ASM", right: true },
    { k: "gap", h: "GAP", right: true },
    { k: "wave", h: "WAVE", right: true },
  ];
  for (const c of cols) c.w = Math.max(dispWidth(c.h), ...rows.map((r) => dispWidth(r[c.k])));
  const line = (cells) => cells.join("  ").replace(/\s+$/, "");
  console.log(bold(line(cols.map((c) => padTo(c.h, c.w, c.right)))));
  console.log(dim(line(cols.map((c) => "-".repeat(c.w)))));
  for (const r of rows) console.log(line(cols.map((c) => padTo(r[c.k], c.w, c.right))));

  console.log(
    dim(
      "\nF 已建/規劃 · E 優化 · B 缺陷(份數) │ LAW+EX = 照 spec 應有的測試數(分母,非實跑數)" +
        "\nASM 待閘門裁決的假設 · GAP 未結/總數(未結 = 有項目卡著) · WAVE 委派分幾批送出(非 feature 數)",
    ),
  );
}

// ---------------------------------------------------------------- main

const argv = process.argv.slice(2);
const withLegend = argv.includes("--legend");
const target = argv.find((a) => !a.startsWith("--"));

if (!target) {
  draw(CONVENTION, "", true, true);
  console.log(dim("\n實際專案跑過什麼:node id-map.mjs <專案的 .design 目錄>"));
  process.exit(0);
}

if (!existsSync(target)) {
  console.error(`路徑不存在: ${target}`);
  process.exit(2);
}
if (!statSync(target).isDirectory()) {
  console.error(`需要的是 .design 目錄,不是檔案: ${target}`);
  process.exit(2);
}

renderProject(target);
if (withLegend) {
  console.log("");
  draw(CONVENTION, "", true, true);
} else {
  console.log(dim("每個編號怎麼來的:node id-map.mjs(不帶參數),或加 --legend 一起看"));
}
process.exit(0);
