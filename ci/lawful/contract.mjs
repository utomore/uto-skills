#!/usr/bin/env node
// lawful 專案的契約檢查：給 CI 跑的一道指令，也能在本機跑同一道。
//
//   node ci/lawful/contract.mjs [--root <專案根目錄>] [--lint-only]
//
// 做四件事，前三件任一紅就 exit 1:
//   1. lint ids / boundary / sig / laws / io / invariants（boundary、io、invariants 三道就是全域 Law 的三類）；
//      lint trace 只擋幽靈引用（測試引用的編號文檔裡沒有）與 verified 的 pipeline 沒有測試承接的 law，
//      其餘的 trace 紅與「領域不變量寫了三行卻沒有測試」只印不擋：測試可以晚一條 PR 才到（剛批准的領域不變量，測試在下一波 build）；
//      status: draft 的 pipeline 的紅只印不擋：draft 是還在討論的文檔，改成 ready 的那條 PR 起才擋；
//      lint ids 查的是檔案本身，不看 status，兩條 draft 同號照擋)
//   2. 跑 Cone.md「Constraint」的建置指令
//   3. 跑整套測試指令，輸出留檔
//   4. 拿測試輸出跑 lawful status 印一份派工報告（只印，exit code 不看：它答的是「全部達成了沒」，不是「這條 PR 對不對」）
//
// uto-skills 被 clone 在專案底下時，它自己的檔案會自動加進忽略目錄，不會被當成專案的原始碼掃到。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const utoSkills = path.resolve(here, '..', '..');
const plugin = path.join(utoSkills, 'plugins', 'lawful');
const mod = (f) => import(pathToFileURL(path.join(plugin, f)).href);

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { flags[a.slice(2)] = next; i++; } else flags[a.slice(2)] = true;
  }
  return flags;
}

const rel = (from, to) => path.relative(from, to).split(path.sep).join('/');
const heading = (s) => console.log(`\n# ${s}`);

function run(cmd, root) {
  console.log(`$ ${cmd}`);
  const r = spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const out = (r.stdout || '') + (r.stderr || '');
  if (out.trim()) console.log(out.trimEnd());
  return { out, exit: r.status == null ? 1 : r.status };
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log('用法：node ci/lawful/contract.mjs [--root <專案根目錄>] [--lint-only]');
    return 0;
  }
  const root = path.resolve(flags.root || process.cwd());
  const [{ readDesign }, { readSource }, { pickAdapter }, lint] = await Promise.all([mod('lib/design.mjs'), mod('lib/source.mjs'), mod('lib/adapters/index.mjs'), mod('lib/commands/lint.mjs')]);
  const design = readDesign(root);
  if (!design) { console.error(`${root} 底下沒有 .lawful/`); return 1; }
  const cone = design.cone;
  if (!cone) console.log(design.legacySystem ? '· 缺 .lawful/Cone.md；這棵樹只有 system.md，lawful migrate cone --write 換過來' : '· 缺 .lawful/Cone.md');
  const ignore = [...(cone ? cone.ignoreDirs : [])];
  const inside = rel(root, utoSkills);
  if (inside && !inside.startsWith('..') && !path.isAbsolute(inside)) ignore.push(inside, path.basename(utoSkills));
  const adapter = cone ? pickAdapter(cone.language) : null;
  if (cone && !adapter) console.log(`· Cone.md 的 language 還沒選到 adapter(${cone.language || '空'})，lint sig 與 lint boundary 跳過`);
  const source = adapter ? readSource(root, adapter, ignore, cone) : null;
  let failed = false;

  heading('契約對帳');
  const drafts = design.pipelines.filter((d) => d.status === 'draft').flatMap((d) => [d.file, d.fullName]);
  const aboutDraft = (msg) => drafts.some((k) => msg.includes(k));
  // 領域不變量寫了三行、測試還沒到：跟 trace 的其餘一樣只印不擋
  const lateTest = (msg) => /^INV-\d+#LAW 寫了三行卻沒有測試/.test(msg);
  // lint ids 查的是檔案本身（兩份同號、號不在 owner 的區間），跟文檔寫完沒有無關，不套 draft 過濾：claim 出來的新文檔一定是 draft
  const content = [
    lint.lintBoundary(design, source, adapter),
    lint.lintSig(design, source, adapter),
    lint.lintLaws(design, source, adapter),
    lint.lintIo(design, source, adapter),
    lint.lintInvariants(design, source, adapter),
  ].map((r) => ({ ...r, red: r.red.filter((m) => !aboutDraft(m) && !lateTest(m)), draft: r.red.filter(aboutDraft), late: r.red.filter((m) => !aboutDraft(m) && lateTest(m)) }));
  const results = [{ ...lint.lintIds(design), draft: [], late: [] }, ...content];
  const gated = lint.renderLint(results);
  console.log(gated.text);
  if (gated.exitCode) failed = true;
  const draftReds = results.flatMap((r) => r.draft);
  if (draftReds.length) {
    console.log(`## draft 文檔的紅（只印不擋）：${draftReds.length} 條`);
    for (const x of draftReds) console.log(`- · ${x}`);
  }
  // lint trace 拆兩段：幽靈引用（測試還在守一條文檔裡沒有的編號）什麼時候都是錯，擋；
  // verified 的 pipeline 的 law 沒有測試承接也擋 —— verified 是建置全綠後才改的，它的 law 理應都有測試；
  // 其餘（ready 的 pipeline 的 law 還沒翻譯、需求的驗收還沒有驗收測試、領域不變量還沒有測試）只印：測試可以晚一條 PR 才到
  const trace = lint.lintTrace(design, source);
  const verified = design.pipelines.filter((d) => d.status === 'verified' && d.id).map((d) => `${d.id}#`);
  const gatedTrace = trace.red.filter((m) => m.includes('幽靈引用') || verified.some((p) => m.startsWith(p)));
  const openTrace = [...trace.red.filter((m) => !gatedTrace.includes(m)), ...content.flatMap((r) => r.late)];
  const traced = lint.renderLint([{ title: 'lint trace（幽靈引用、verified 的 pipeline 的 law）', red: gatedTrace, info: [] }]);
  console.log(traced.text);
  if (traced.exitCode) failed = true;
  console.log(`## lint trace 其餘（只印不擋）：${openTrace.length ? `${openTrace.length} 條還沒有測試承接` : '全部有測試承接'}`);
  for (const x of openTrace) console.log(`- · ${x}`);

  if (flags['lint-only']) {
    console.log(failed ? '\n✗ 契約對帳有紅' : '\n✓ 契約對帳通過');
    return failed ? 1 : 0;
  }

  const commands = cone ? cone.commands : {};
  heading('建置');
  if (!commands['建置']) console.log('· Cone.md「Constraint」沒有建置指令，跳過');
  else if (run(commands['建置'], root).exit) { failed = true; console.log('✗ 建置失敗'); }

  heading('整套測試');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-'));
  let log = null;
  if (!commands['測試(整套)']) console.log('· Cone.md「Constraint」沒有整套測試指令，跳過');
  else {
    const r = run(commands['測試(整套)'], root);
    log = path.join(tmp, 'all.log');
    fs.writeFileSync(log, r.out);
    if (r.exit) { failed = true; console.log(`✗ 測試失敗 (exit ${r.exit})`); }
  }

  if (log) {
    heading('派工報告（只印不擋）');
    const r = spawnSync(process.execPath, [path.join(plugin, 'bin', 'lawful.mjs'), 'status', '--tests', log, '--root', root], { encoding: 'utf8' });
    console.log(((r.stdout || '') + (r.stderr || '')).trimEnd());
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(failed ? '\n✗ 契約、建置或測試有紅，不能合' : '\n✓ 契約對帳、建置、整套測試全部通過');
  return failed ? 1 : 0;
}

process.exitCode = await main();
