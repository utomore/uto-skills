#!/usr/bin/env node
/**
 * scan-ids.mjs — 跨分支 / 跨 worktree 的文檔編號盤點。
 *
 * `doc-lifecycle.md`「命名與編號規則」要求建新檔前「先掃描該資料夾現有檔名,取最大編號 +1」。
 * 那條規則只掃**當前工作區**,而工作區只看得到當前分支已 checkout 的檔案 —— 平行開發時它一定漏:
 *
 *   - 另一條分支上已經鑄出 G-C003,還沒 merge → 工作區看不到 → 你也鑄一個 G-C003
 *   - 另一個 worktree 正在寫 G-C003,**還沒 commit** → 連 ref 都還沒有 → 一樣看不到
 *
 * 兩份 `G-C003-<不同 slug>.md` 是**不同檔名**,merge 時 git 不會衝突,兩個都會落地 ——
 * 這是**靜默**的撞號,要等到有人引用 `G-C003` 才發現它指向兩份文檔。全域(G-)最危險:
 * F/E/B 是每個子系統各一組,兩個人做不同子系統永遠不會撞;G- 是全專案共用一組計數器。
 *
 * 為什麼不是「檢查分支名稱有沒有 g- 開頭」:分支名不帶號碼(`g-shared-token` 看不出 G-C003
 * 被佔走),而且要靠每個未來的人都記得照那個規則命名 —— 這條路的準確度取決於自覺。
 * ref 與 worktree 是 git 自己記的事實,不需要任何新慣例。
 *
 * 三個來源(取聯集):
 *   1. 當前工作區的 .design/            —— 含未 commit 的新檔
 *   2. `git worktree list` 的每個 worktree 的 .design/  —— **未 commit 的平行工作**,只有這一條看得到
 *   3. `git for-each-ref` 每條分支的 ls-tree —— 已 commit 未 merge 的分支(本地與已 fetch 的遠端)
 *
 * worktree 之所以要單獨掃:同一個 repo 的所有 worktree **共用 ref 與物件庫**,所以來源 3 已經
 * 涵蓋它們「已 commit」的部分;但每個 worktree 有自己的檔案系統,未 commit 的檔案不在任何 ref 裡。
 *
 * 掃不到的最後一個縫:**別台機器上未 push 的工作**。沒有任何本地掃描看得到它 ——
 * 那個縫由 `lint-ids.mjs` 的撞號檢查在 merge 後補上(讓它響,而不是靜默)。
 *
 * **`archive/` 底下不算數**:存檔是舊設計樹的快照,它的號碼已經被現役文檔接手了
 * (`.design/archive/<日期>/` 整棵樹、`subsystems/<slug>/archive/` 都算)。把存檔算進來會把
 * 「同一個號在存檔與現役各一份」報成撞號 —— 那是正常的世代交替,不是撞號。略過幾份會明說。
 *
 * 用法:
 *   node scan-ids.mjs [.design 路徑]     預設 ./.design
 *   --fetch            掃描前先 git fetch --quiet(預設不做:離線可用,也不擅自連網)
 *   --group <前綴>     只看某一組(G-C、G-E、G-B、ADR、<subsys>/F …)
 *   --next             只印每組的下一個可用號,一行一組(建檔時用這個)
 *   --quiet            只印撞號與下一個可用號,不印全表
 *   --verbose          出處印完整清單(預設:已進主 branch 的只印「已在 main」,
 *                      因為那些是已定案的號;真正要看的是還沒進主 branch 的那些)
 *   --include-archive  連 archive/ 底下的存檔文檔一起算
 *   --claim <組> --slug <kebab-slug>
 *                      **配號並當場鎖住**:算出該組下一個可用號,把檔案建在慣例位置
 *                      (只寫 frontmatter 骨架),印出路徑。組寫 `G-C` / `G-E` / `G-B` /
 *                      `ADR` / `SPK` / `<子系統>/F` / `<子系統>/E` / `<子系統>/B`。
 *                      `SPK` 另建同名的程式碼資料夾 `<.design 同層>/spike/SPK-00x-<slug>/`(附一份指回
 *                      文檔的 README.md;`spike/` 根層的 sandbox README 第一次一起建)—— 文檔與資料夾
 *                      同一個動作建。資料夾只活到結案,結案由 /spike 用 git rm 刪、sha 留在文檔。
 *
 * **`--claim` 是這套流程唯一的鑄號動作**,所有角色、所有分支、所有 worktree 都走它。
 * 「先算號、待會再建檔」中間那段空窗就是撞號發生的地方 —— 掃描看得到的是**檔案**,
 * 你腦中記著的號碼別人看不到。所以配號與建檔必須是同一個動作,不留空窗。
 *
 * 它只管**文檔 id**(F / E / B / G-C / G-E / G-B / ADR / SPK)。檔案**內部**的條目編號
 * (LAW- / REG- / EX- / ASM- / GAP- / DEC- / SELF- / WAVE- / STEP- / RND-)不歸它管,
 * 那不是限制而是正確:那些號只在單一檔案內唯一,兩條分支各自在自己的 spec 裡寫 LAW-3
 * 本來就不是撞號,寫的人手上就有那個檔案,繞一趟腳本只是多一次 I/O。
 * 開發階段 `S0`–`Sn` 同理:它們住在 `system.md` 同一張表裡,兩條分支各加一個 S4 會產生
 * **真的 merge 衝突** —— 會響的東西不需要腳本。
 *
 * Exit code:0 = 沒有撞號 / 1 = 有撞號 / 2 = 路徑不存在或不是 git repo
 */
import { readdirSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { printHelpIfAsked } from "./_help.mjs";

// ---------------------------------------------------------------- 參數

const argv = process.argv.slice(2);
printHelpIfAsked(argv, import.meta.url);
const flag = (name) => argv.includes(name);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};
const OPT_FETCH = flag("--fetch");
const OPT_NEXT = flag("--next");
const OPT_QUIET = flag("--quiet");
const OPT_VERBOSE = flag("--verbose");
const OPT_ARCHIVE = flag("--include-archive");
const OPT_GROUP = opt("--group");
const OPT_CLAIM = opt("--claim");
const OPT_SLUG = opt("--slug");
const VALUE_FLAGS = new Set(["--group", "--claim", "--slug"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(argv[i - 1]));
const DESIGN_DIR = resolve(positional[0] ?? ".design");

// ---------------------------------------------------------------- git 薄封裝

const git = (args, cwd) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
};

const toPosix = (p) => p.split(sep).join("/");

// ---------------------------------------------------------------- 檔名 → 編號

/**
 * 把一條 repo 相對路徑解析成 { group, id, num, slug }。認不得的回 null。
 * group 是**編號的作用域**:全域各一組(G-C / G-E / G-B / ADR),子系統的 F/E/B 各自一組,
 * 所以子系統的 group 要帶上子系統 slug —— auth/F 與 billing/F 撞號是正常的,不是問題。
 */
function parseDocPath(relPath) {
  const parts = toPosix(relPath).split("/");
  const name = parts[parts.length - 1];
  const m = name.match(/^(G-[CEB]\d{3}|ADR-\d{3}|SPK-\d{3}|[FEB]\d{3})-([a-z0-9-]+)\.md$/);
  if (!m) return null;
  const [, id, slug] = m;
  const num = Number(id.slice(-3));
  const archived = parts.includes("archive");
  if (id.startsWith("G-") || id.startsWith("ADR-") || id.startsWith("SPK-")) {
    return { group: id.slice(0, -3).replace(/-$/, ""), id, num, slug, archived };
  }
  const i = parts.lastIndexOf("subsystems");
  const subsys = i >= 0 && parts.length > i + 1 ? parts[i + 1] : "?";
  return { group: `${subsys}/${id[0]}`, id, num, slug, archived };
}

// ---------------------------------------------------------------- 三個來源

/** group -> id -> slug -> Set<出處> */
const found = new Map();
const archivedSeen = new Set();

function record(parsed, where) {
  if (!parsed) return;
  if (parsed.archived && !OPT_ARCHIVE) {
    archivedSeen.add(`${parsed.id}-${parsed.slug}`);
    return;
  }
  if (OPT_GROUP && parsed.group !== OPT_GROUP) return;
  const byId = found.get(parsed.group) ?? new Map();
  const bySlug = byId.get(parsed.id) ?? new Map();
  const places = bySlug.get(parsed.slug) ?? new Set();
  places.add(where);
  bySlug.set(parsed.slug, places);
  byId.set(parsed.id, bySlug);
  found.set(parsed.group, byId);
}

/** 走一個實體資料夾(工作區或某個 worktree 的 .design/)。 */
function walkFs(dir, base, where) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFs(full, base, where);
    else record(parseDocPath(relative(base, full)), where);
  }
}

if (!existsSync(DESIGN_DIR)) {
  console.error(`路徑不存在:${DESIGN_DIR}`);
  process.exit(2);
}

const root = git(["rev-parse", "--show-toplevel"], DESIGN_DIR)?.trim();
const designRel = root ? toPosix(relative(root, DESIGN_DIR)) : null;

// 來源 1:當前工作區(含未 commit)
walkFs(DESIGN_DIR, DESIGN_DIR, "工作區");

if (!root) {
  console.error("提醒:這裡不是 git repo,只掃得到當前工作區,分支與 worktree 一概沒看。");
} else {
  if (OPT_FETCH) git(["fetch", "--quiet", "--all"], root);

  // 來源 2:其他 worktree 的檔案系統(未 commit 的平行工作只有這一條看得到)
  const wtOut = git(["worktree", "list", "--porcelain"], root) ?? "";
  for (const line of wtOut.split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    const wtPath = line.slice("worktree ".length).trim();
    if (!wtPath || resolve(wtPath) === resolve(root)) continue; // 當前 worktree 已由來源 1 掃過
    const wtDesign = join(wtPath, designRel);
    walkFs(wtDesign, wtDesign, `worktree:${toPosix(wtPath).split("/").pop()}`);
  }

  // 來源 3:每條分支的樹(已 commit 未 merge)
  const refs = (git(["for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes"], root) ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((r) => !r.endsWith("/HEAD"));
  for (const ref of refs) {
    const tree = git(["ls-tree", "-r", "--name-only", ref, "--", designRel || "."], root);
    if (!tree) continue;
    for (const p of tree.split("\n")) {
      if (p.trim()) record(parseDocPath(p.trim()), ref);
    }
  }
}

// ---------------------------------------------------------------- 呈現

const GROUP_LABEL = {
  "G-C": "全域共用契約",
  "G-E": "全域優化",
  "G-B": "全域修復",
  ADR: "架構決策紀錄",
  SPK: "可行性驗證(spike)",
};

/** 主 branch:已經進去的號就是定案的號,不必列出它散佈在哪五十條分支上。 */
const baseBranch =
  git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], root ?? ".")
    ?.trim()
    .replace(/^origin\//, "") ||
  ["main", "master"].find((b) => git(["rev-parse", "--verify", "--quiet", b], root ?? ".")) ||
  null;

/**
 * 出處的顯示。實跑一個有五十條分支的專案才發現:每個號後面掛五十個 ref 名字,
 * 輸出會膨脹到十萬字元 —— 「直接呈現出來」就失效了。已進主 branch 的號是**已定案**的,
 * 出處沒有資訊量;真正要看的是**還沒進主 branch**的那些,而那一組永遠很短。
 */
function placeLabel(places) {
  const arr = [...places];
  if (OPT_VERBOSE) return arr.join(", ");
  if (baseBranch && (places.has(baseBranch) || places.has(`origin/${baseBranch}`))) {
    return `已在 ${baseBranch}`;
  }
  const locals = arr.filter((p) => !p.startsWith("origin/"));
  const shown = locals.length ? locals : arr;
  return shown.length > 5 ? `${shown.slice(0, 5).join(", ")} …+${shown.length - 5}` : shown.join(", ");
}

const groups = [...found.keys()].sort();
const collisions = [];
const nextFree = new Map();

for (const g of groups) {
  const byId = found.get(g);
  let max = 0;
  for (const [id, bySlug] of byId) {
    max = Math.max(max, Number(id.slice(-3)));
    if (bySlug.size > 1) collisions.push({ group: g, id, bySlug });
  }
  nextFree.set(g, max + 1);
}

const pad3 = (n) => String(n).padStart(3, "0");
const nextIdOf = (g) => (g.includes("/") ? `${g.split("/")[1]}${pad3(nextFree.get(g))}` : `${g}${g === "ADR" || g === "SPK" ? "-" : ""}${pad3(nextFree.get(g))}`);

if (OPT_NEXT) {
  for (const g of groups) console.log(`${g}\t${nextIdOf(g)}`);
  process.exit(collisions.length ? 1 : 0);
}

// ---------------------------------------------------------------- --claim:配號 + 建檔(同一個動作)

if (OPT_CLAIM) {
  if (!OPT_SLUG || !/^[a-z0-9][a-z0-9-]*$/.test(OPT_SLUG)) {
    console.error("--claim 要同時給 --slug <kebab-slug>(小寫英數與連字號)");
    process.exit(2);
  }
  // 該組還一個號都沒有時,nextFree 不會有它 —— 從 001 起算
  const g = OPT_CLAIM;
  if (!nextFree.has(g)) nextFree.set(g, 1);
  const id = nextIdOf(g);

  // 慣例位置與 frontmatter 欄位(doc-lifecycle.md「.design/ 資料夾樹」與「Metadata 標準」是權威,
  // 改這裡之前先改那份)。**建出來的骨架必須照那份規格逐欄寫齊**:少一欄,填內容的人就得自己
  // 想起來補,而漏補不會報錯 —— `code-paths` 就是這樣一路漏到收尾才被發現沒人回寫。
  const GLOBAL_DIR = { "G-C": "contracts", "G-E": "enhancements", "G-B": "bugfixes", ADR: "adr", SPK: "spikes" };
  const SUBSYS_DIR = { F: "features", E: "enhancements", B: "bugfixes" };
  const DOC_TYPE = { "G-C": "contract", "G-E": "enhance", "G-B": "bugfix", ADR: "adr", SPK: "spike", F: "feature", E: "enhance", B: "bugfix" };
  /** 任務文檔(F/E/B 與全域 G-E/G-B)的固定欄位;順序與 doc-lifecycle.md「任務文檔」一致 */
  const TASK_TAIL = [
    "depends-on: []            # 依賴的其他任務文檔,一律帶子系統前綴,如 [auth/F001]",
    "related-adr: []",
    "related-feature: []       # enhance / bugfix 回鏈到被優化 / 出問題的 feature",
    "code-paths: []            # 收尾時與 status 同一個動作回寫實際動到的程式碼路徑",
  ];
  let dir;
  let docType;
  let status;
  let tail;   // frontmatter 的其餘欄位
  if (GLOBAL_DIR[g]) {
    dir = join(DESIGN_DIR, GLOBAL_DIR[g]);
    docType = DOC_TYPE[g];
    if (g === "ADR") {
      status = "proposed";
      tail = [];
    } else if (g === "SPK") {
      // spike 不是任務文檔:狀態由結論決定(open → concluded / dropped),不進進度分母。
      // code-paths 固定指到同名資料夾 —— 文檔與程式碼成對,而且只准住在 spike/ 底下
      // (產品程式碼禁止 import 它,lint-spikes.mjs 查)。規格見 doc-lifecycle.md「spike 文檔」。
      status = "open";
      tail = [
        "verdict:                  # concluded 才填:feasible | infeasible | partial",
        "subsystems: []            # 相關子系統;還沒定子系統時留空",
        "feeds: []                 # 結論餵給哪些文檔(全名);concluded 時必填非空",
        "related-adr: []",
        `code-paths: [spike/${id}-${OPT_SLUG}]   # 固定同名資料夾;只准指到 spike/ 底下`,
      ];
    } else if (g === "G-C") {
      status = "active";
      tail = ["subsystems: []            # 使用這份契約的子系統,至少兩個", "related-adr: []"];
    } else {
      // 全域 G-E / G-B 沒有 planned 這一格:優化與缺陷是看著既有程式碼提出來的,
      // 沒有 Level 2 契約可抄,建檔當下就進 specced(doc-lifecycle.md「狀態與生命週期」)
      status = "specced";
      tail = ["subsystems: []            # 受影響的子系統,至少兩個", ...TASK_TAIL];
    }
  } else if (/^[^/]+\/[FEB]$/.test(g)) {
    const [, kind] = g.split("/");
    dir = join(DESIGN_DIR, "subsystems", g.split("/")[0], SUBSYS_DIR[kind]);
    docType = DOC_TYPE[kind];
    // feature 從 planned 起跳(這一步是 /subsys-design 在規劃當下建檔,還沒有規格);
    // E/B 沒有規劃階段,建檔即 specced。判準見 doc-lifecycle.md「狀態與生命週期」。
    status = kind === "F" ? "planned" : "specced";
    // 任務文檔**不寫 `parent`**:它屬於哪個子系統由檔案路徑決定(doc-lifecycle.md「任務文檔」)
    tail = kind === "F"
      ? ["stage:                    # 對應 system.md「開發階段」的階段 id,如 S1", "modules: []               # 負責模組(design.md「內部模組劃分」的模組名)", ...TASK_TAIL]
      : TASK_TAIL;
  } else {
    console.error(`認不得的組:${g}。用 G-C / G-E / G-B / ADR / SPK / <子系統>/F / <子系統>/E / <子系統>/B`);
    process.exit(2);
  }

  const file = join(dir, `${id}-${OPT_SLUG}.md`);
  if (existsSync(file)) {
    console.error(`已經存在:${file}`);
    process.exit(2);
  }
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; // 本地日期,不用 UTC(檔案日期跟開發者的日曆一致)
  const full = `${g.includes("/") ? `${g.split("/")[0]}/` : ""}${id}-${OPT_SLUG}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    file,
    [
      "---",
      `id: ${id}`,
      `type: ${docType}`,
      `title: ${OPT_SLUG}`,
      "description:              # 一句話,40 字內:這份文檔在做什麼(**建檔者現在就要填**)",
      `status: ${status}`,
      `created: ${today}`,
      `updated: ${today}`,
      ...tail,
      "---",
      "",
      `# ${full}`,
      "",
      "> 本檔由 scan-ids.mjs --claim 建立,只鑄了號與骨架。",
      "> 內容由對應的 design skill 填寫;frontmatter 的完整規格見 doc-lifecycle.md。",
      "",
      // feature 的 `## 契約` 節不是「之後補」的:planned 的定義就是「有契約、沒有 Laws」。
      // 骨架不帶這一節的話,剛建好的檔會立刻被 scan-status 判成結構不合規 —— 而那個狀態
      // 是本流程的正常起點,不該是紅燈。六欄的判準見 contract-readiness.md A2。
      ...(docType === "feature"
        ? ["## 契約", "",
           "- **階段**:",
           "- **負責模組**:",
           "- **實作的 Level 2 介面**:",
           "- **資料流管線段落**:",
           "- **驗收標準**:",
           "- **明確不做**:",
           ""]
        : []),
      // spike 的四個固定章節先立好標題:寫程式碼之前要先寫「問題」(要回答什麼 / 判準 / timebox),
      // 沒有這一節的 spike 只是隨手試。版面在 spike/templates/spike.md。
      ...(docType === "spike"
        ? ["## 問題", "",
           "- **要回答什麼**:",
           "- **為什麼讀原始碼答不出來**:",
           "- **判準**:feasible = ;infeasible = ;partial = ",
           "- **下游**:",
           "", "## 輪次", "", `### RND-1(${today})`, "",
           "- 這輪要驗:", "- 判準:", "- timebox:", "- 做法:", "- 結果:", "- sha:", "- 環境:",
           "", "## 結論", "",
           "- **verdict**:", "- **一句話結論**:", "- **學到什麼**:", "- **餵給哪裡**:", "- **沒驗到的**:",
           ""]
        : []),
    ].join("\n"),
    "utf8",
  );
  // spike 的程式碼資料夾與文檔同一個動作建:「先建檔、程式碼待會再放」中間那段空窗,
  // 跟「先算號、待會再建檔」是同一種洞 —— 資料夾沒建,別人就看不到這個號已經有程式碼要來。
  let codeDir = null;
  if (docType === "spike") {
    codeDir = join(dirname(DESIGN_DIR), "spike", `${id}-${OPT_SLUG}`);
    mkdirSync(codeDir, { recursive: true });
    writeFileSync(
      join(codeDir, "README.md"),
      [
        `# ${full}`,
        "",
        `可行性驗證的程式碼。問題、判準、每一輪的結果與結論在 \`.design/spikes/${id}-${OPT_SLUG}.md\`。`,
        "",
        "這個資料夾**只活到結案**:結案時會被 `git rm`,程式碼靠文檔裡每一輪記的 sha 撈回。",
        "open 期間產品程式碼與測試禁止 import 這裡;正式實作一律從 spec 寫。",
        "",
      ].join("\n"),
      "utf8",
    );
    // spike/ 根層是常駐的共用 sandbox(依賴檔、假資料、harness),第一次建 spike 時立起來,之後不動。
    // 沒有這份 README 的話,第二個人看到 spike/ 底下一堆東西,分不出哪些是環境、哪些是某次的實驗。
    const rootReadme = join(dirname(codeDir), "README.md");
    if (!existsSync(rootReadme)) {
      writeFileSync(
        rootReadme,
        [
          "# spike/ —— 可行性驗證的 sandbox",
          "",
          "根層放所有 spike 共用的環境:依賴檔(與專案自己的分開)、假資料產生器、量測 harness。這些**不刪**。",
          "",
          "每個 spike 一個 `SPK-00x-<slug>/` 資料夾,只活在 open 期間,結案時 `git rm`;程式碼靠 `.design/spikes/SPK-00x-<slug>.md` 裡每一輪記的 sha 撈回。",
          "",
          "產品程式碼與測試**禁止 import** 這裡的任何東西(`lint-spikes.mjs` 查);正式實作一律從 spec 寫。",
          "",
        ].join("\n"),
        "utf8",
      );
    }
  }
  // 路徑印相對的;.design 不在當前目錄底下時(`../../..` 那種)改印絕對路徑,免得印出一串沒人讀得懂的 `..`
  const relPath = toPosix(relative(process.cwd(), file));
  console.log(`${id}\t${relPath.startsWith("..") ? toPosix(file) : relPath}`);
  if (codeDir) {
    const relCode = toPosix(relative(process.cwd(), codeDir));
    console.log(`程式碼\t${relCode.startsWith("..") ? toPosix(codeDir) : relCode}/  ← spike 的程式碼只寫在這裡`);
  }
  // 全名是「講給人聽」時的唯一寫法:frontmatter 的 id 欄寫裸 id,回報、閘門、別份文檔的
  // 引用一律寫全名(_shared/conventions.md「指稱紀律」)。配號當下就把兩種寫法一起交出去,
  // 免得下一步只記得裸 id。
  console.log(`全名\t${full}\t← 寫進回報與別份文檔時用這個(frontmatter 的 id 欄仍寫 ${id})`);
  if (collisions.length) {
    console.error(`\n注意:掃描過程中發現 ${collisions.length} 組既有撞號(與本次配號無關,但要處理)。`);
    process.exit(1);
  }
  process.exit(0);
}

if (!OPT_QUIET) {
  if (!groups.length) console.log("沒有掃到任何已鑄號的文檔。");
  for (const g of groups) {
    const label = GROUP_LABEL[g] ? `  ${GROUP_LABEL[g]}` : "";
    console.log(`\n${g}${label}`);
    const byId = found.get(g);
    for (const id of [...byId.keys()].sort()) {
      const bySlug = byId.get(id);
      const dup = bySlug.size > 1;
      for (const [slug, places] of bySlug) {
        const mark = dup ? "  ← 撞號" : "";
        const full = `${g.includes("/") ? `${g.split("/")[0]}/` : ""}${id}-${slug}`;
        console.log(`  ${full.padEnd(38)} ${placeLabel(places)}${mark}`);
      }
    }
    console.log(`  下一個可用:${nextIdOf(g)}`);
  }
}

if (archivedSeen.size && !OPT_QUIET) {
  console.log(`\n(略過 archive/ 底下 ${archivedSeen.size} 份存檔文檔——它們的號已由現役文檔接手;要一起算加 --include-archive)`);
}

if (collisions.length) {
  console.log(`\n撞號 ${collisions.length} 組:`);
  for (const c of collisions) {
    const prefix = c.group.includes("/") ? `${c.group.split("/")[0]}/` : "";
    console.log(`  ${prefix}${c.id} 這個號同時被下面幾份文檔佔走:`);
    for (const [slug, places] of c.bySlug) console.log(`    ${prefix}${c.id}-${slug}  (${placeLabel(places)})`);
  }
  console.log("\n兩份同號文檔的檔名不同,merge 時不會衝突 —— 必須手動改號並回頭修所有引用。");
  process.exit(1);
}

if (!OPT_QUIET) console.log("\n沒有撞號。");
process.exit(0);
