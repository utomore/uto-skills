#!/usr/bin/env node
/**
 * spike-close.mjs — 結案時刪掉 spike 程式碼資料夾的**唯一**做法(預設 dry-run)。
 *
 * `/spike` 結案要 `git rm -r` 掉 `spike/SPK-00x-<slug>/`。這一步不准用手打:`git rm` 雖然只碰
 * 這個 repo 裡**已追蹤**的檔案(碰不到 repo 以外的東西、也碰不到未追蹤的檔案),但路徑打錯仍然
 * 刪得掉錯的東西 —— `spike/` 少打一段就是整個 sandbox 連共用環境一起消失。所以刪除的路徑
 * **由本腳本從文檔算出來**,人只給文檔全名;而且刪之前要過五道關,任一關不過就一個檔都不動:
 *
 *   1. 文檔存在,且 `status` 已是 concluded / dropped(先把文檔結案,再刪程式碼;順序反過來會
 *      刪掉一份還沒有結論的 spike)
 *   2. 算出來的資料夾 = `<.design 同層>/spike/<文檔全名>/`,realpath 落在 git 工作樹內、
 *      在 `spike/` 底下、basename 符合 `SPK-00x-<slug>`、不是 symlink。**永遠不會是 `spike/` 本身**
 *   3. 資料夾裡沒有未 commit 的改動(`git status --porcelain` 對它是空的)—— 刪掉的東西要撈得回來
 *   4. 文檔裡最後一輪 `RND-n` 記的 `sha` 存在於本 repo,而且那個 commit 真的含這個資料夾
 *      (`git ls-tree` 非空)—— sha 是結案後撈回程式碼的唯一鑰匙,漏記或記錯就不准刪
 *   5. 只用 `git rm -r --`(絕不 `rm -rf`),路徑一律相對於 git 工作樹根、帶 `--`
 *
 * 預設 **dry-run**:印出會刪哪些檔、五道關各自的結果。`--apply` 才真的 `git rm`;刪完**不 commit**,
 * 由 `/spike` 連文檔一起 commit(結案是一個 commit:文檔改成 concluded + 資料夾消失)。
 *
 * 用法:
 *   node spike-close.mjs <文檔全名>            dry-run:SPK-003-storage-engine(寫 SPK-003 也吃)
 *   node spike-close.mjs <文檔全名> --apply    真的 git rm -r(仍不 commit)
 *   --design <路徑>    .design 不在當前目錄底下時指定(預設 ./.design)
 *
 * Exit code:0 = 五道關都過(dry-run)或已刪 / 1 = 有一關沒過,一個檔都沒動 / 2 = 參數或路徑錯
 */
import { existsSync, lstatSync, realpathSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, relative, dirname, basename, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { readFrontmatter } from "./_frontmatter.mjs";
import { printHelpIfAsked } from "./_help.mjs";

const argv = process.argv.slice(2);
printHelpIfAsked(argv, import.meta.url);
let designOpt = null;
let apply = false;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--design") designOpt = argv[++i] ?? null;
  else if (argv[i] === "--apply") apply = true;
  else if (argv[i].startsWith("--")) {
    console.error(`未知選項: ${argv[i]}`);
    process.exit(2);
  } else positional.push(argv[i]);
}
if (positional.length !== 1) {
  console.error("要給一個文檔全名,例如 SPK-003-storage-engine(只給 SPK-003 也吃)");
  process.exit(2);
}
const designDir = resolve(designOpt ?? ".design");
if (!existsSync(join(designDir, "spikes"))) {
  console.error(`找不到 ${join(designDir, "spikes")}(用 --design 指定 .design 的位置)`);
  process.exit(2);
}
const toPosix = (p) => p.split(sep).join("/");
const git = (args, cwd) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------- 找文檔(只給 SPK-003 也吃)
const want = positional[0].trim();
const idOnly = want.match(/^(SPK-\d{3})(?:-[a-z0-9-]+)?$/)?.[1];
if (!idOnly) {
  console.error(`認不得的全名:${want}(要像 SPK-003-storage-engine)`);
  process.exit(2);
}
const docs = readdirSync(join(designDir, "spikes")).filter((f) => f.startsWith(`${idOnly}-`) && f.endsWith(".md"));
if (docs.length !== 1) {
  console.error(docs.length ? `${idOnly} 對到 ${docs.length} 份文檔:${docs.join("、")}` : `找不到 ${idOnly} 的文檔`);
  process.exit(2);
}
const fullName = docs[0].replace(/\.md$/, "");
const docPath = join(designDir, "spikes", docs[0]);

const checks = []; // { name, ok, detail }
const check = (name, ok, detail) => checks.push({ name, ok, detail });

// ---------------------------------------------------------------- 1. 文檔已結案
const { meta } = readFrontmatter(docPath);
const status = String(meta?.status ?? "");
check("文檔已結案", status === "concluded" || status === "dropped", `status: ${status || "(缺)"};要先把文檔改成 concluded / dropped 再刪程式碼`);

// ---------------------------------------------------------------- 2. 路徑由文檔算出來,且落在該落的地方
const codeDir = join(dirname(designDir), "spike", fullName);
const root = git(["rev-parse", "--show-toplevel"], dirname(designDir))?.trim();
let pathOk = false;
let pathDetail = "";
let relCode = null;
if (!root) pathDetail = "這裡不是 git repo";
else if (!existsSync(codeDir)) pathDetail = `${toPosix(relative(process.cwd(), codeDir))}/ 不存在(已經刪過了?那就沒事)`;
else if (lstatSync(codeDir).isSymbolicLink()) pathDetail = "是 symlink,不刪";
else {
  const real = realpathSync(codeDir);
  const realRoot = realpathSync(root);
  relCode = toPosix(relative(realRoot, real));
  const inside = !relCode.startsWith("..") && relCode !== "";
  const underSpike = relCode.split("/").length >= 2 && relCode.split("/").slice(-2)[0] === "spike";
  const nameOk = /^SPK-\d{3}-[a-z0-9-]+$/.test(basename(real));
  pathOk = inside && underSpike && nameOk;
  pathDetail = `${relCode}/(在工作樹內:${inside}、在 spike/ 底下:${underSpike}、名字合規:${nameOk})`;
}
check("路徑落在 spike/SPK-00x-<slug>/", pathOk, pathDetail);

// ---------------------------------------------------------------- 3. 沒有未 commit 的改動
let dirty = null;
if (pathOk) dirty = git(["status", "--porcelain", "--", relCode], root);
check("資料夾裡沒有未 commit 的東西", pathOk && dirty !== null && dirty.trim() === "", pathOk ? (dirty?.trim() ? `有未 commit 的改動:\n${dirty.trimEnd()}` : "乾淨") : "略過");

// ---------------------------------------------------------------- 4. 文檔記的 sha 撈得回這個資料夾
const text = readFileSync(docPath, "utf8");
const shas = [...text.matchAll(/^\s*-\s*\*{0,2}sha\*{0,2}\s*[::]\s*`?([0-9a-f]{7,40})`?/gim)].map((m) => m[1]);
const lastSha = shas[shas.length - 1] ?? null;
let shaOk = false;
let shaDetail = "文檔裡沒有任何一輪記了 sha(`- sha:<commit>`)—— 那是結案後撈回程式碼的唯一鑰匙";
if (lastSha && pathOk) {
  const exists = git(["cat-file", "-e", `${lastSha}^{commit}`], root) !== null;
  const tree = exists ? git(["ls-tree", "-r", "--name-only", lastSha, "--", relCode], root) ?? "" : "";
  shaOk = exists && tree.trim() !== "";
  shaDetail = !exists ? `sha ${lastSha} 不在本 repo` : shaOk ? `sha ${lastSha} 含 ${tree.trim().split("\n").length} 個檔` : `sha ${lastSha} 存在,但那個 commit 裡沒有 ${relCode}/(記錯輪次?)`;
} else if (lastSha) shaDetail = "略過(路徑那一關沒過)";
check("最後一輪的 sha 撈得回這個資料夾", shaOk, shaDetail);

// ---------------------------------------------------------------- 呈現與執行
const allOk = checks.every((c) => c.ok);
console.log(`spike-close ${fullName}${apply ? "  --apply" : "  (dry-run;加 --apply 才刪)"}`);
for (const c of checks) console.log(`${c.ok ? "✓" : "✗"} ${c.name}:${c.detail}`);

if (!allOk) {
  console.log("\n有一關沒過,一個檔都沒動。");
  process.exit(1);
}
const files = (git(["ls-files", "--", relCode], root) ?? "").trim().split("\n").filter(Boolean);
console.log(`\n會用 git rm -r -- ${relCode} 移除 ${files.length} 個已追蹤的檔案:`);
for (const f of files) console.log(`  ${f}`);
if (!apply) {
  console.log("\n(dry-run,沒有動任何東西;確認清單無誤後加 --apply)");
  process.exit(0);
}
try {
  execFileSync("git", ["rm", "-r", "-q", "--", relCode], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  console.error(`git rm 失敗:${e.stderr?.toString() ?? e.message}`);
  process.exit(1);
}
console.log(`\n已從索引與工作樹移除 ${files.length} 個檔案,**還沒 commit** —— 連同文檔一起 commit(訊息帶全名:spike: ${fullName} ${status})。`);
console.log(`撈回程式碼:git show ${lastSha}:${relCode}/<檔>`);
process.exit(0);
