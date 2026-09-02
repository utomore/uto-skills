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
 *
 * Exit code:0 = 沒有撞號 / 1 = 有撞號 / 2 = 路徑不存在或不是 git repo
 */
import { readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------- 參數

const argv = process.argv.slice(2);
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
const positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--group");
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
  const m = name.match(/^(G-[CEB]\d{3}|ADR-\d{3}|[FEB]\d{3})-([a-z0-9-]+)\.md$/);
  if (!m) return null;
  const [, id, slug] = m;
  const num = Number(id.slice(-3));
  const archived = parts.includes("archive");
  if (id.startsWith("G-") || id.startsWith("ADR-")) {
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
const nextIdOf = (g) => (g.includes("/") ? `${g.split("/")[1]}${pad3(nextFree.get(g))}` : `${g}${g === "ADR" ? "-" : ""}${pad3(nextFree.get(g))}`);

if (OPT_NEXT) {
  for (const g of groups) console.log(`${g}\t${nextIdOf(g)}`);
  process.exit(collisions.length ? 1 : 0);
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
        console.log(`  ${id}  ${slug.padEnd(28)} ${placeLabel(places)}${mark}`);
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
    console.log(`  ${c.id} 同時是:`);
    for (const [slug, places] of c.bySlug) console.log(`    ${slug}  (${placeLabel(places)})`);
  }
  console.log("\n兩份同號文檔的檔名不同,merge 時不會衝突 —— 必須手動改號並回頭修所有引用。");
  process.exit(1);
}

if (!OPT_QUIET) console.log("\n沒有撞號。");
process.exit(0);
