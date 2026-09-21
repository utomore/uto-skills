// golden 回歸:對每個夾具跑 plugins/lawful/bin/lawful.mjs 的每道子命令,比對 golden/<名字>.txt。--update 重產。
// 會寫檔的子命令在夾具的暫存副本上跑,golden 收「輸出 + 改動後的檔」。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', '..', 'plugins', 'lawful', 'bin', 'lawful.mjs');
const goldenDir = path.join(here, 'golden');
const update = process.argv.includes('--update');
const DATE = '2026-09-05';

// [名字, 夾具, argv, 寫檔後要收進 golden 的檔(相對夾具), 環境變數]
const CASES = [
  ['save-game-lint-all', 'save-game', ['lint', 'all']],
  // team:Cone.md 有號段行的樹;claim 從自己的區間配號並寫 owner,email 不在號段行上就停
  ['team-lint-ids', 'team', ['lint', 'ids']],
  ['team-claim', 'team', ['claim', 'save-load', '--description', '把存檔讀回 World', '--kind', 'subflow', '--milestone', 'M-1', '--date', DATE], ['.lawful/pipelines/P-101-save-load.md', '.lawful/requirements/R-1-save-roundtrip.md'], { GIT_AUTHOR_EMAIL: 'amy@corp.com' }],
  ['team-claim-other', 'team', ['claim', 'save-load', '--description', '把存檔讀回 World', '--kind', 'subflow', '--date', DATE], ['.lawful/pipelines/P-200-save-load.md'], { GIT_AUTHOR_EMAIL: 'bob@corp.com' }],
  ['team-claim-unknown', 'team', ['claim', 'save-load', '--date', DATE], ['.lawful/pipelines/P-101-save-load.md'], { GIT_AUTHOR_EMAIL: 'carol@corp.com' }],
  ['broken-lint-ids', 'broken', ['lint', 'ids']],
  ['broken-lint-boundary', 'broken', ['lint', 'boundary']],
  ['broken-lint-sig', 'broken', ['lint', 'sig']],
  ['broken-lint-laws', 'broken', ['lint', 'laws']],
  ['broken-lint-trace', 'broken', ['lint', 'trace']],
  ['broken-lint-io', 'broken', ['lint', 'io']],
  ['broken-lint-invariants', 'broken', ['lint', 'invariants']],
  ['save-game-lint-global', 'save-game', ['lint', 'global']],
  // preflow:需求住 Cone.md「## 需求」節還寫著 Law、里程碑住 objectives/(一條需求有兩個目標檔、一條沒有、一個目標檔對不到需求)、
  // 邊界與對外 I/O 住 modules.md、里程碑只有編號、kind 寫著中文值、frozen、還留著 spikes/ 的樹:migrate laws 與 migrate requirements 的輸入,
  // 也驗這種樹照讀得出同一份報告、寫檔的指令停下來
  ['preflow-status', 'preflow', ['status', '--tests', 'test.log']],
  ['preflow-migrate-laws', 'preflow', ['migrate', 'laws']],
  ['preflow-migrate-laws-write', 'preflow', ['migrate', 'laws', '--write'], ['.lawful/Cone.md', '.lawful/modules.md', '.lawful/objectives/R-1-O-1-save-roundtrip.md', '.lawful/objectives/R-1-O-2-save-list.md', '.lawful/pipelines/P-001-save-write.md']],
  ['preflow-migrate-requirements', 'preflow', ['migrate', 'requirements']],
  ['preflow-migrate-requirements-write', 'preflow', ['migrate', 'requirements', '--write', '--date', DATE], ['.lawful/Cone.md', '.lawful/requirements/R-1-save-roundtrip.md', '.lawful/requirements/R-2-unnamed.md', '.lawful/objectives/R-1-O-1-save-roundtrip.md', '.lawful/objectives/R-1-O-2-save-list.md', '.lawful/objectives/R-9-O-3-save-cloud.md', '.lawful/pipelines/P-001-save-write.md']],
  ['preflow-requirement-add', 'preflow', ['requirement', 'add', 'save-upgrade', '換了版本的存檔在新版讀得回來', '--priority', '2']],
  ['preflow-claim-milestone', 'preflow', ['claim', 'save-load', '--milestone', 'M-1']],
  ['preflow-brief-spike-impl', 'preflow', ['brief', 'spike-impl', 'M-2', '--tests', 'test.log', '--no-rules']],
  ['save-game-migrate-laws', 'save-game', ['migrate', 'laws']],
  ['save-game-migrate-requirements', 'save-game', ['migrate', 'requirements']],
  ['save-game-section', 'save-game', ['section', '.lawful/pipelines/P-001-save-write.md', 'Brief', 'Laws']],
  ['save-game-section-verify', 'save-game', ['section', '.lawful/pipelines/P-001-save-write.md', 'Brief', '沒有的節', '--verify']],
  ['save-game-status', 'save-game', ['status']],
  ['save-game-status-tests', 'save-game', ['status', '--tests', 'test.log']],
  ['save-game-status-pipeline', 'save-game', ['status', '--pipeline', 'P-001-save-write', '--tests', 'test.log']],
  ['save-game-status-module', 'save-game', ['status', '--module', 'Game.Save.Core.Codec', '--tests', 'test.log']],
  ['save-game-status-module-unit', 'save-game', ['status', '--module', 'Game.Save', '--tests', 'test.log']],
  ['save-game-status-json', 'save-game', ['status', '--json', '--tests', 'test.log']],
  ['broken-status', 'broken', ['status']],
  ['broken-status-stale-log', 'broken', ['status', '--tests', 'stale.log']],
  ['save-game-status-tasty', 'save-game', ['status', '--tests', 'test-tasty.log']],
  ['devflow-migrate', 'devflow', ['migrate', 'from-dev-flow', '.design', '--ignore', 'old']],
  // refs:R-1 的 P-001-cli-run 引用 R-2 的 P-002-syntax-parse,需求表的「依賴」欄印得出東西
  ['refs-status', 'refs', ['status']],
  ['refs-status-json', 'refs', ['status', '--json']],
  ['refs-lint-sig', 'refs', ['lint', 'sig']],
  ['verified-ref-status', 'verified-ref', ['status']],
  ['verified-ref-status-tests', 'verified-ref', ['status', '--tests', 'test.log']],
  ['run-cmd-status-run', 'run-cmd', ['status', '--run']],
  ['run-cmd-status-empty', 'run-cmd', ['status', '--tests', 'empty.log']],
  ['templated-status', 'templated', ['status', '--tests', 'test.log']],
  ['templated-lint-sig', 'templated', ['lint', 'sig']],
  ['templated-lint-laws', 'templated', ['lint', 'laws']],
  ['save-game-module', 'save-game', ['module', 'Audio', '--layers', 'types,effect,core,shell', '--responsibility', '音效的描述與播放'], ['.lawful/modules.md']],
  ['save-game-module-facade', 'save-game', ['module', 'Audio', '--layers', 'types,effect,shell', '--responsibility', '音效的描述與播放', '--facade'], ['.lawful/modules.md', 'src-effect/Game/Audio.hs']],
  ['save-game-module-facade-layer', 'save-game', ['module', 'Audio', '--layers', 'types,core', '--responsibility', '音效', '--facade', 'types'], ['src-types/Game/Audio.hs']],
  ['save-game-module-facade-taken', 'save-game', ['module', 'Save', '--layers', 'types', '--facade', 'types']],
  ['save-game-module-dry', 'save-game', ['module', 'Audio', '--layers', 'types,core', '--responsibility', '音效', '--dry-run'], ['.lawful/modules.md']],
  ['save-game-module-existing', 'save-game', ['module', 'Game.Save', '--layers', 'effect'], ['.lawful/modules.md']],
  ['save-game-module-bad-layer', 'save-game', ['module', 'Audio', '--layers', 'pure']],
  ['save-game-module-nested', 'save-game', ['module', 'Game.Save.Extra', '--layers', 'core', '--responsibility', '多的']],
  ['broken-module-no-responsibility', 'broken', ['module', 'Input', '--layers', 'types'], ['.lawful/modules.md']],
  ['save-game-claim', 'save-game', ['claim', 'save-load', '--description', '把存檔讀回 World', '--kind', 'subflow', '--milestone', 'M-1-save-write', '--date', DATE], ['.lawful/pipelines/P-002-save-load.md', '.lawful/requirements/R-1-save-roundtrip.md']],
  ['save-game-claim-no-milestone', 'save-game', ['claim', 'save-load', '--description', '把存檔讀回 World', '--date', DATE], ['.lawful/pipelines/P-002-save-load.md']],
  ['save-game-claim-bad-kind', 'save-game', ['claim', 'save-load', '--kind', '介面']],
  ['save-game-claim-bad-domain', 'save-game', ['claim', 'game-load', '--description', '把存檔讀回 World']],
  ['save-game-claim-one-word', 'save-game', ['claim', 'load']],
  ['save-game-requirement-add', 'save-game', ['requirement', 'add', 'save-upgrade', '換了版本的存檔在新版讀得回來', '--priority', '2', '--accept', '任一前一版的存檔,新版讀回的投影與前一版一樣', '--date', DATE], ['.lawful/requirements/R-2-save-upgrade.md']],
  ['save-game-requirement-add-no-accept', 'save-game', ['requirement', 'add', 'save-upgrade', '換了版本的存檔在新版讀得回來', '--priority', '2', '--date', DATE], ['.lawful/requirements/R-2-save-upgrade.md']],
  ['save-game-requirement-add-bad-slug', 'save-game', ['requirement', 'add', 'Save_Upgrade', '換了版本的存檔在新版讀得回來', '--priority', '2']],
  ['save-game-requirement-add-no-priority', 'save-game', ['requirement', 'add', 'save-upgrade', '換了版本的存檔在新版讀得回來']],
  ['templated-requirement-add', 'templated', ['requirement', 'add', 'report-print', '報表印得出來', '--priority', '1', '--accept', '任一段文字都印得出一份報表', '--date', DATE], ['.lawful/requirements/R-1-report-print.md']],
  ['save-game-invariant-add', 'save-game', ['invariant', 'add', '存檔裡的實體 id 不重複'], ['.lawful/Cone.md']],
  ['save-game-invariant-add-bad-kind', 'save-game', ['invariant', 'add', '存檔裡的實體 id 不重複', '--kind', 'always']],
  ['templated-invariant-add', 'templated', ['invariant', 'add', '報表的行數不為負', '--kind', 'bound'], ['.lawful/Cone.md']],
  // 綁別條需求的里程碑做出來的 pipeline 也不擋:這條里程碑靠修訂它達成,下一步是 scope-revise,REV 的依欄寫這條里程碑的全名
  ['broken-requirement-milestone-other-requirement', 'broken', ['requirement', 'milestone', 'R-2', 'save-stream', '存檔寫入改成串流', '--bind', 'P-001-game-save'], ['.lawful/requirements/R-2-load-report.md']],
  // tuned:已經是 requirements/ 而需求檔還帶調整表的樹(verified-ref 加一張調整表,P-002-count-tally 的 REV-1 依欄引用 RF-1)。
  // status 照讀(每一列讀成一條綁既有 pipeline 的里程碑:REV 引用了的達成、沒引用的待修訂)、警訊指到 migrate requirements;寫需求檔的指令停下;
  // migrate requirements 把每一列換成里程碑表的一列、REV 依欄的編號跟著改寫
  ['tuned-status', 'tuned', ['status', '--tests', 'test.log']],
  ['tuned-requirement-milestone', 'tuned', ['requirement', 'milestone', 'R-1', 'report-csv', '報表匯得出 CSV']],
  ['tuned-requirement-add', 'tuned', ['requirement', 'add', 'report-fast', '報表一秒內印完', '--priority', '3']],
  ['tuned-claim', 'tuned', ['claim', 'report-export', '--description', '把報表匯成 CSV', '--milestone', 'M-2-report-render', '--date', DATE]],
  ['tuned-migrate-requirements', 'tuned', ['migrate', 'requirements']],
  ['tuned-migrate-requirements-write', 'tuned', ['migrate', 'requirements', '--write'], ['.lawful/requirements/R-1-report-correct.md', '.lawful/pipelines/P-002-count-tally.md', '.lawful/pipelines/P-001-report-render.md']],
  ['legacy-migrate-cone', 'legacy', ['migrate', 'cone']],
  ['legacy-migrate-cone-write', 'legacy', ['migrate', 'cone', '--write', '--date', DATE], ['.lawful/Cone.md', '.lawful/objectives/R-1-O-1-save-write.md', '.lawful/objectives.md', '.lawful/modules.md', '.lawful/pipelines/P-001-save-write.md', '.lawful/system.md']],
  ['legacy-migrate-requirements', 'legacy', ['migrate', 'requirements']],
  ['legacy-status', 'legacy', ['status']],
  ['save-game-requirement-milestone', 'save-game', ['requirement', 'milestone', 'R-1', 'save-load', '讀檔還原世界', '--bind', 'P-001-save-write'], ['.lawful/requirements/R-1-save-roundtrip.md']],
  // 人工審核:status 只算證據,已驗收那一列只由 requirement accept 寫;怎麼驗欄由 requirement verify 補(整合從決策紀錄的 Entry 搬過來)
  ['save-game-requirement-accept', 'save-game', ['requirement', 'accept', 'R-1', '--by', 'dev@example.com', '--evidence', 'R-1#ACCEPT green,存檔讀回一模一樣', '--date', DATE], ['.lawful/requirements/R-1-save-roundtrip.md']],
  ['save-game-requirement-accept-no-by', 'save-game', ['requirement', 'accept', 'R-1', '--evidence', '跑過了']],
  ['save-game-requirement-accept-no-evidence', 'save-game', ['requirement', 'accept', 'R-1', '--by', 'dev@example.com']],
  ['save-game-requirement-accept-missing', 'save-game', ['requirement', 'accept', 'R-9', '--by', 'dev@example.com', '--evidence', '跑過了']],
  ['save-game-requirement-verify', 'save-game', ['requirement', 'verify', 'M-2-save-inspect', 'cabal run save-demo -- check /tmp/a.sav'], ['.lawful/requirements/R-1-save-roundtrip.md']],
  ['save-game-requirement-verify-missing', 'save-game', ['requirement', 'verify', 'M-9-nope', 'cabal run save-demo']],
  ['save-game-requirement-verify-no-command', 'save-game', ['requirement', 'verify', 'M-2-save-inspect']],
  ['save-game-requirement-milestone-missing', 'save-game', ['requirement', 'milestone', 'R-1', 'save-load', '讀檔還原世界', '--bind', 'P-002-save-load']],
  ['save-game-requirement-milestone-unbound', 'save-game', ['requirement', 'milestone', 'R-1', 'save-repair', '存檔壞了修得回來'], ['.lawful/requirements/R-1-save-roundtrip.md']],
  ['save-game-requirement-milestone-bad-slug', 'save-game', ['requirement', 'milestone', 'R-1', '存檔壞了修得回來']],
  ['save-game-requirement-milestone-no-requirement', 'save-game', ['requirement', 'milestone', 'R-9', 'save-repair', '存檔壞了修得回來']],
  ['broken-sync', 'broken', ['sync', '--date', DATE], ['.lawful/pipelines/P-001-game-save.md']],
  ['broken-modules-gen', 'broken', ['modules', '--gen'], ['.lawful/modules.md']],
  // brief:一個 skill 開工要的東西一次印完。golden 用 --no-rules,才不會規章每改一次就跟著變;規章的節另外查(下面的「brief 的規章節」)
  ['save-game-brief-qa', 'save-game', ['brief', 'qa', 'P-001-save-write', '--no-rules']],
  ['save-game-brief-qa-requirement', 'save-game', ['brief', 'qa', 'R-1', '--no-rules']],
  ['save-game-brief-qa-invariant', 'save-game', ['brief', 'qa', 'INV-1', '--no-rules']],
  ['save-game-brief-refactor', 'save-game', ['brief', 'refactor', 'P-001', '--no-rules']],
  ['save-game-brief-refactor-wrong-kind', 'save-game', ['brief', 'refactor', 'R-1', '--no-rules']],
  ['save-game-brief-fingerprint', 'save-game', ['brief', 'qa', 'P-001-save-write', '--fingerprint']],
  ['save-game-brief-no-target', 'save-game', ['brief', 'qa', '--no-rules']],
  ['save-game-brief-missing', 'save-game', ['brief', 'qa', 'P-009-nope', '--no-rules']],
  ['save-game-brief-bad-skill', 'save-game', ['brief', 'nope']],
  // 有 status 那一塊的案例一律明講 --tests:沒講的時候 brief 會照檔案時間自己挑根目錄的那一份,而檔案時間每台機器不同
  ['save-game-brief-build', 'save-game', ['brief', 'build', 'P-001-save-write', '--tests', 'test.log', '--no-rules']],
  ['save-game-brief-build-milestone', 'save-game', ['brief', 'build', 'M-1-save-write', '--tests', 'test.log', '--no-rules']],
  ['save-game-brief-build-requirement', 'save-game', ['brief', 'build', 'R-1', '--tests', 'test.log', '--no-rules']],
  ['broken-brief-build', 'broken', ['brief', 'build', 'P-001-game-save', '--tests', 'stale.log', '--no-rules']],
  ['save-game-brief-spike-impl', 'save-game', ['brief', 'spike-impl', 'M-2-save-inspect', '--tests', 'test.log', '--no-rules']],
  ['save-game-brief-spike-impl-wrong-kind', 'save-game', ['brief', 'spike-impl', 'P-001-save-write', '--no-rules']],
  ['save-game-brief-scope-laws', 'save-game', ['brief', 'scope-laws', 'M-1-save-write', '--no-rules']],
  ['save-game-brief-scope-laws-doc', 'save-game', ['brief', 'scope-laws', 'P-001-save-write', '--tests', 'test.log', '--no-rules']],
  ['templated-brief-scope-laws', 'templated', ['brief', 'scope-laws', 'M-1', '--no-rules']],
  ['refs-brief-scope-revise', 'refs', ['brief', 'scope-revise', 'P-002', '--tests', 'none.log', '--no-rules']],
  // 靠修訂這一條達成的里程碑在「這條 pipeline 朝向哪裡」照樣列:REV 的依欄引用了(verified-ref)、還沒引用(save-game)
  ['verified-ref-brief-scope-revise-cited', 'verified-ref', ['brief', 'scope-revise', 'P-002-count-tally', '--tests', 'test.log', '--no-rules']],
  ['save-game-brief-scope-revise-pending', 'save-game', ['brief', 'scope-revise', 'P-001-save-write', '--tests', 'test.log', '--no-rules']],
  ['save-game-brief-scope-revise-wrong-kind', 'save-game', ['brief', 'scope-revise', 'M-1-save-write', '--no-rules']],
  ['save-game-brief-global-laws-invariant', 'save-game', ['brief', 'global-laws', 'INV-1', '--tests', 'test.log', '--no-rules']],
  ['broken-brief-global-laws', 'broken', ['brief', 'global-laws', '--tests', 'stale.log', '--no-rules']],
  // scope-laws 帶著全域的候選接過來:目標是那條里程碑,候選的出處(它綁的 pipeline 全文與逐條狀態)與決策紀錄都在
  ['save-game-brief-global-laws-milestone', 'save-game', ['brief', 'global-laws', 'M-1-save-write', '--tests', 'test.log', '--no-rules']],
  ['save-game-brief-require-design', 'save-game', ['brief', 'require-design', '--tests', 'test.log', '--no-rules']],
  ['save-game-brief-kickoff', 'save-game', ['brief', 'kickoff', '--no-rules']],
  ['save-game-brief-module', 'save-game', ['brief', 'module', '--no-rules']],
  ['save-game-brief-integrate', 'save-game', ['brief', 'integrate', '--no-rules']],
  ['save-game-brief-status', 'save-game', ['brief', 'status', '--no-rules']],
  ['save-game-brief-audit', 'save-game', ['brief', 'audit', '--tests', 'test.log', '--no-rules']],
  ['save-game-brief-study', 'save-game', ['brief', 'study', '--no-rules']],
  // skill 載入時 $ARGUMENTS 是自由文字:目標與旗標從裡面認,其餘的字不理
  ['save-game-brief-args', 'save-game', ['brief', 'build', '--args', '幫我 build P-001-save-write (先看 log) --tests test.log --no-rules']],
  ['save-game-brief-args-empty', 'save-game', ['brief', 'status', '--args', '看板 --no-rules']],
];

function snapshot(root, files) {
  return files.map((f) => {
    const p = path.join(root, f);
    return `--- ${f}\n${fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '(不存在)'}`;
  }).join('\n');
}

let failed = 0;
for (const [name, fixture, argv, files, env] of CASES) {
  let root = path.join(here, 'fixtures', fixture);
  let tmp = null;
  if (files) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lawful-'));
    fs.cpSync(root, tmp, { recursive: true });
    root = tmp;
  }
  // GIT_AUTHOR_EMAIL 預設清空:沒指定 env 的案例不受這台機器的 git 設定影響
  const r = spawnSync(process.execPath, [bin, ...argv, '--root', root], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '', ...env } });
  const envText = env ? Object.entries(env).map(([k, v]) => `${k}=${v} `).join('') : '';
  let actual = `$ ${envText}lawful ${argv.join(' ')}\n${(r.stdout + r.stderr).replace(/\r\n/g, '\n').trimEnd()}\nexit ${r.status}\n`;
  // brief 的指紋帶規章的雜湊:規章每改一次就變,golden 不追它
  actual = actual.replace(/ rules:[0-9a-f]{8}/g, ' rules:<雜湊>');
  // 測試輸出新不新看的是檔案時間,每台機器不同
  actual = actual.replace(/^(- \S+)  (?:比每一個原始碼與測試檔都新|比 \S+ 舊:.*)$/gm, '$1  <新舊看檔案時間>');
  if (files) actual += snapshot(root, files) + '\n';
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  const file = path.join(goldenDir, `${name}.txt`);
  if (update || !fs.existsSync(file)) {
    fs.writeFileSync(file, actual);
    console.log(`寫入 ${name}.txt`);
    continue;
  }
  const expected = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (expected === actual) console.log(`✓ ${name}`);
  else {
    failed++;
    console.log(`✗ ${name}\n--- 預期\n${expected}\n--- 實際\n${actual}`);
  }
}

const h = spawnSync(process.execPath, [bin, '--help'], { encoding: 'utf8' });
if (h.status !== 0 || !/lint ids \| boundary/.test(h.stdout) || !/status/.test(h.stdout) || !/brief <skill>/.test(h.stdout) || !/invariant add/.test(h.stdout) || !/requirement add <slug>/.test(h.stdout) || !/requirement milestone <R-n> <slug>/.test(h.stdout) || /refinement|RF-/i.test(h.stdout) || /objective (add|milestone|refinement)/.test(h.stdout) || /IO 介面|子流/.test(h.stdout) || !/--kind <io \| subflow>/.test(h.stdout) || !/migrate requirements/.test(h.stdout) || !/migrate laws/.test(h.stdout) || !/invariants \| global/.test(h.stdout) || /^\s+spike\b/m.test(h.stdout) || /^\s+rename\b/m.test(h.stdout)) {
  failed++;
  console.log('✗ --help');
} else console.log('✓ --help');

// brief 的規章節:每個 skill 點名的節都要真的在 rules/ 裡,節改了名這裡會紅
{
  const skills = (/skill:([^\n]+)/.exec(h.stdout) || [null, ''])[1].split('、').map((s) => s.trim()).filter(Boolean);
  let ok = skills.length > 0;
  for (const s of skills) {
    const r = spawnSync(process.execPath, [bin, 'brief', s, '--root', path.join(here, 'fixtures', 'save-game')], { encoding: 'utf8' });
    if (r.status !== 0 || !/^brief /.test(r.stdout) || !/^### \S+\.md「/m.test(r.stdout) || /裡沒有「/.test(r.stdout)) ok = false;
  }
  if (!ok) {
    failed++;
    console.log('✗ brief 的規章節');
  } else console.log('✓ brief 的規章節');

  // 規章的字數上限:一個 skill 開工背的規章有上界。超過就是它拿了別人的工作,回 brief.mjs 的 RULES 表把不是它做決定要用的節拿掉,
  // 或把那一節拆成各讀者只拿自己那一塊。每一場 session 都要背一次,所以這個數字是流程的固定成本。
  const RULES_BUDGET = 38000;
  {
    const over = [];
    for (const s of skills) {
      const run = (...extra) => spawnSync(process.execPath, [bin, 'brief', s, ...extra, '--root', path.join(here, 'fixtures', 'save-game')], { encoding: 'utf8' }).stdout;
      const n = [...run()].length - [...run('--no-rules')].length;
      if (n > RULES_BUDGET) over.push(`${s} ${n} 字`);
    }
    if (over.length || skills.length === 0) {
      failed++;
      console.log(`✗ 規章的字數上限(每個 skill ${RULES_BUDGET} 字):${over.join('、') || '一個 skill 都沒查到'}`);
    } else console.log('✓ 規章的字數上限');
  }

  // 交叉引用:規章與 SKILL.md 裡寫成「<檔>.md「<節>」」的每一處,那一節都要真的在那個檔裡。節改了名、搬了家,這裡會紅
  {
    const rulesDir = path.join(here, '..', '..', 'plugins', 'lawful', 'rules');
    const skillsDir = path.join(here, '..', '..', 'plugins', 'lawful', 'skills');
    const titles = {};
    for (const f of fs.readdirSync(rulesDir)) {
      const set = new Set();
      let fenced = false;
      for (const line of fs.readFileSync(path.join(rulesDir, f), 'utf8').replace(/\r\n/g, '\n').split('\n')) {
        if (/^\s*```/.test(line)) fenced = !fenced;
        if (!fenced && /^## /.test(line)) set.add(line.slice(3).trim());
      }
      titles[f] = set;
    }
    const sources = fs.readdirSync(rulesDir).map((f) => [`rules/${f}`, path.join(rulesDir, f)])
      .concat(fs.readdirSync(skillsDir).map((s) => [`skills/${s}/SKILL.md`, path.join(skillsDir, s, 'SKILL.md')]));
    const dangling = [];
    let seen = 0;
    for (const [label, abs] of sources) {
      for (const [, file, sec] of fs.readFileSync(abs, 'utf8').matchAll(/([A-Za-z._-]+\.md)「([^」]+)」/g)) {
        if (!titles[file]) continue; // 不是規章檔(Cone.md、CLAUDE.md …),這裡不管
        seen++;
        if (!titles[file].has(sec)) dangling.push(`${label} → ${file}「${sec}」`);
      }
    }
    if (dangling.length || seen === 0) {
      failed++;
      console.log(`✗ 規章的交叉引用:${dangling.join('、') || '一條都沒查到'}`);
    } else console.log('✓ 規章的交叉引用');
  }

  // brief 的分段:skill 載入時一道指令的輸出超過約 30KB 會被存成檔,所以每一段都要在上限以內,而且接起來一個字都不少
  const TARGETS = { build: 'P-001-save-write', qa: 'P-001-save-write', refactor: 'P-001-save-write', 'scope-revise': 'P-001-save-write', 'scope-laws': 'M-1-save-write', 'spike-impl': 'M-2-save-inspect' };
  const PARTS = [1, 2, 3, 4, 5, 6];
  let parted = skills.length > 0;
  for (const s of skills) {
    const run = (...extra) => spawnSync(process.execPath, [bin, 'brief', s, ...(TARGETS[s] ? [TARGETS[s]] : []), ...extra, '--root', path.join(here, 'fixtures', 'save-game')], { encoding: 'utf8' }).stdout.replace(/\r\n/g, '\n');
    const whole = run().trimEnd();
    const parts = PARTS.map((k) => run('--part', String(k), '--of', String(PARTS.length)).trimEnd());
    if (parts.some((p) => Buffer.byteLength(p) > 29000)) parted = false;
    // 第 2 段起的第一行是「(brief <skill> 第 k 段,接上一段)」,接回去之前拿掉
    const joined = parts.filter(Boolean).map((p) => p.replace(/^.brief \S+ 第 \d+ 段[^\n]*\n\n/, '')).join('\n');
    // 段與段之間的空行在切的時候會掉,比的是非空行
    const solid = (t) => t.split('\n').filter((l) => l.trim()).join('\n');
    if (solid(joined) !== solid(whole)) parted = false;
  }
  if (!parted) {
    failed++;
    console.log('✗ brief 的分段');
  } else console.log('✓ brief 的分段');

  // 每份 SKILL.md:skills/ 底下的資料夾與 brief 的 skill 名單一一對上;frontmatter 的 name 等於資料夾名;
  // description 是單行的純量,裡面不准有「冒號加空白」(YAML 會讀成另一個鍵,整份 frontmatter 壞掉、skill 不會被載入);
  // 六道注入行寫對;免批准的 allowed-tools 在 frontmatter
  const skillsDir = path.join(here, '..', '..', 'plugins', 'lawful', 'skills');
  const dirs = fs.readdirSync(skillsDir).filter((d) => fs.existsSync(path.join(skillsDir, d, 'SKILL.md'))).sort();
  const wrong = [];
  if (dirs.join(',') !== [...skills].sort().join(',')) wrong.push(`skills/ 是 ${dirs.join('、')};brief 的名單是 ${[...skills].sort().join('、')}`);
  for (const s of dirs) {
    const md = fs.readFileSync(path.join(skillsDir, s, 'SKILL.md'), 'utf8');
    const fm = (/^---\r?\n([\s\S]*?)\r?\n---/.exec(md) || [, ''])[1];
    const desc = (/^description: (.*)$/m.exec(fm) || [, ''])[1];
    if (!new RegExp(`^name: ${s}$`, 'm').test(fm)) wrong.push(`${s}:name 不等於資料夾名`);
    if (!desc || /: /.test(desc) || /^['"[{>|]/.test(desc)) wrong.push(`${s}:description 會讓 frontmatter 讀不成(空的、含「冒號加空白」、或以引號括號開頭)`);
    const lines = md.split(/\r?\n/).filter((l) => l.startsWith('!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief '));
    const want = PARTS.map((k) => `!\`node "\${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief ${s} --args '$ARGUMENTS' --part ${k} --of ${PARTS.length}\``);
    if (lines.join('\n') !== want.join('\n')) wrong.push(`${s}:注入行不是六道 brief ${s} --part 1..${PARTS.length} --of ${PARTS.length}`);
    if (!/^allowed-tools: Bash\(node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/lawful\.mjs":\*\)$/m.test(fm)) wrong.push(`${s}:frontmatter 沒有免批准的 allowed-tools`);
  }
  if (wrong.length) {
    failed++;
    console.log('✗ SKILL.md 的 frontmatter 與注入行');
    for (const w of wrong) console.log(`  ${w}`);
  } else console.log('✓ SKILL.md 的 frontmatter 與注入行');
}

// 三道 migrate 以任何先後接連跑,落地的樹都一樣;跑過的樹再跑一次是「不用換」;只有 kind 要換的樹也換得了
{
  const run = (root, ...argv) => spawnSync(process.execPath, [bin, ...argv, '--root', root], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '' } });
  const treeOf = (root) => {
    const out = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((p, q) => p.name.localeCompare(q.name))) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) walk(abs);
        else out.push(`--- ${path.relative(root, abs).split(path.sep).join('/')}\n${fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')}`);
      }
    };
    walk(path.join(root, '.lawful'));
    return out.join('\n');
  };
  const after = (fixture, orders) => orders.map((order) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lawful-order-'));
    fs.cpSync(path.join(here, 'fixtures', fixture), tmp, { recursive: true });
    const exits = order.map((sub) => run(tmp, 'migrate', sub, '--write', '--date', DATE).status);
    const again = order.map((sub) => run(tmp, 'migrate', sub).stdout);
    const tree = treeOf(tmp);
    const status = run(tmp, 'status').stdout;
    fs.rmSync(tmp, { recursive: true, force: true });
    return { order, exits, again, tree, status };
  });
  const wrong = [];
  const sets = [
    ['preflow', [['laws', 'requirements'], ['requirements', 'laws'], ['cone', 'requirements', 'laws']]],
    ['legacy', [['cone', 'laws', 'requirements'], ['cone', 'requirements', 'laws']]],
    ['tuned', [['laws', 'requirements'], ['requirements', 'laws']]],
  ];
  for (const [fixture, orders] of sets) {
    const got = after(fixture, orders);
    for (const g of got) {
      if (g.exits.some((x) => x !== 0)) wrong.push(`${fixture}:${g.order.join(' → ')} 有一道 exit 不是 0(${g.exits.join('、')})`);
      if (g.tree !== got[0].tree) wrong.push(`${fixture}:${g.order.join(' → ')} 落地的樹與 ${got[0].order.join(' → ')} 不一樣`);
      if (!g.again.every((t) => !/^- /m.test(t.split('人要判的')[0]))) wrong.push(`${fixture}:${g.order.join(' → ')} 跑完之後再跑一次,還有東西要換`);
      if (/lawful migrate (cone|laws|requirements)/.test(g.status)) wrong.push(`${fixture}:${g.order.join(' → ')} 跑完之後 status 還指到 migrate`);
      if (!/\n--- \.lawful\/requirements\/R-1-/.test(`\n${g.tree}`) || /\n--- \.lawful\/objectives\.md\n/.test(g.tree) || /\nkind: (IO 介面|子流)\n/.test(g.tree) || `\n${g.tree}`.split('\n--- ').some((s) => s.startsWith('.lawful/requirements/') && /\n\| 調整 \|/.test(s))) wrong.push(`${fixture}:${g.order.join(' → ')} 落地的樹沒有 requirements/、還留著 objectives.md、kind 沒換、或需求檔還有調整表`);
    }
  }
  // 只有 system.md 的樹:laws 與 requirements 都講先跑 cone,不動任何檔
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lawful-order-'));
    fs.cpSync(path.join(here, 'fixtures', 'legacy'), tmp, { recursive: true });
    const before = treeOf(tmp);
    for (const sub of ['laws', 'requirements']) {
      const r = run(tmp, 'migrate', sub, '--write');
      if (r.status !== 1 || !/lawful migrate cone --write/.test(r.stdout + r.stderr)) wrong.push(`legacy:migrate ${sub} 在只有 system.md 的樹上沒有講先跑 migrate cone`);
    }
    if (treeOf(tmp) !== before) wrong.push('legacy:講了先跑 migrate cone,卻動了檔');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  // 已經有 requirements/、只有 kind 要換的樹
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lawful-order-'));
    fs.cpSync(path.join(here, 'fixtures', 'team'), tmp, { recursive: true });
    const file = path.join(tmp, '.lawful', 'pipelines', 'P-100-save-verify.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^kind: subflow(\r?)$/m, 'kind: 子流$1'));
    const read = run(tmp, 'status').stdout;
    const r = run(tmp, 'migrate', 'requirements', '--write');
    const text = fs.readFileSync(file, 'utf8');
    if (!/\| P-100-save-verify \| subflow \|/.test(read)) wrong.push('team:kind 的另一種寫法沒有照讀成 subflow');
    if (r.status !== 0 || !/P-100-save-verify\.md:kind「子流」改成 subflow/.test(r.stdout) || !/^kind: subflow\r?$/m.test(text)) wrong.push('team:只有 kind 要換的樹,migrate requirements --write 沒有把它換掉');
    if (!/不用換/.test(run(tmp, 'migrate', 'requirements').stdout)) wrong.push('team:kind 換完之後再跑一次,還有東西要換');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (wrong.length) {
    failed++;
    console.log('✗ migrate 的先後');
    for (const w of wrong) console.log(`  ${w}`);
  } else console.log('✓ migrate 的先後');
}

// 名詞住專案根目錄 CLAUDE.md 的「## 名詞」節:檔案在而沒有這一節,與檔案不存在是同一條警訊;這一節以外寫什麼都不影響讀表
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lawful-glossary-'));
  fs.cpSync(path.join(here, 'fixtures', 'save-game'), tmp, { recursive: true });
  const run = (...argv) => spawnSync(process.execPath, [bin, ...argv, '--root', tmp], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '' } }).stdout;
  const file = path.join(tmp, 'CLAUDE.md');
  const WARN = '| CLAUDE.md | 沒有 ## 名詞 節,領域名詞沒有地方定義 | lawful:kickoff 補上這一節 |';
  const whole = fs.readFileSync(file, 'utf8');
  const withSection = run('status', '--tests', 'test.log');
  fs.writeFileSync(file, `# save-game\n\n## 開發須知\n| 名詞 | 定義 | 型別 |\n|---|---|---|\n| 不是名詞表 | 這張表不住「## 名詞」節 | \`Nope\` |\n\n${whole.replace(/^# save-game\r?\n/, '')}\n## 其他\n開發者自己寫的東西。\n`);
  const surrounded = run('status', '--json', '--tests', 'test.log');
  const lint = run('lint', 'laws');
  fs.writeFileSync(file, '# save-game\n\n開發者自己寫的東西,沒有名詞節。\n');
  const noSection = run('status', '--tests', 'test.log');
  fs.rmSync(file);
  const noFile = run('status', '--tests', 'test.log');
  fs.rmSync(tmp, { recursive: true, force: true });
  const ok = !withSection.includes(WARN) && noSection.includes(WARN) && noFile.includes(WARN)
    && /"term": "解碼錯誤"/.test(surrounded) && !/不是名詞表/.test(surrounded) && /## lint laws:通過/.test(lint);
  if (!ok) {
    failed++;
    console.log('✗ CLAUDE.md 的名詞節');
  } else console.log('✓ CLAUDE.md 的名詞節');
}

// --html:一個自帶資料的單檔網頁,佔位符要被換掉、資料要灌得進去。檔太大不收 golden,只檢查這幾件事
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lawful-html-'));
  const out = path.join(tmp, 'board.html');
  const r = spawnSync(process.execPath, [bin, 'status', '--html', out, '--tests', 'test.log', '--root', path.join(here, 'fixtures', 'save-game')], { encoding: 'utf8' });
  const html = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const data = /<script id="data" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  // exit code 帶的是報告判定(有沒有全部達成),不是寫檔成敗;寫成功了就一定讀得到資料區塊。
  // 資料區塊裡一個生的 < 都不該有:全部逃成 <,文檔寫了什麼都關不掉這個標籤
  const ok = !html.includes('__STATUS_JSON__') && !!data
    && /"tool": "lawful"/.test(data[1]) && /P-001-save-write/.test(data[1]) && !data[1].includes('<')
    && /^file:\/\/\/.*board\.html$/m.test(r.stdout)
    && r.stdout.includes('# lawful status');   // --html 是額外產出,報告照印
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!ok) {
    failed++;
    console.log('✗ status --html');
  } else console.log('✓ status --html');
}

// --html 不給檔名:寫進暫存區的 lawful-board/,專案資料夾裡一個字都不留
{
  const fixtureDir = path.join(here, 'fixtures', 'save-game');
  const before = new Set(fs.readdirSync(fixtureDir));
  const r = spawnSync(process.execPath, [bin, 'status', '--html', '--root', fixtureDir], { encoding: 'utf8' });
  const m = /^(file:\/\/\/.*)$/m.exec(r.stdout);
  const after = new Set(fs.readdirSync(fixtureDir));
  const wrote = m ? fileURLToPath(m[1]) : '';
  const ok = !!m && /lawful-board/.test(wrote) && fs.existsSync(wrote)
    && [...after].every((n) => before.has(n));
  if (!ok) {
    failed++;
    console.log('✗ status --html 沒給檔名');
  } else console.log('✓ status --html 沒給檔名');
}

// 合進主線的 build 分支是殘留,不是有人在建:不算建構中,改列成警訊。真的開一個 repo 來問 git
{
  const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
  if (!hasGit) console.log('· 沒有 git,跳過殘留 build 分支的檢查');
  else {
    const { branchState } = await import('../../plugins/lawful/lib/commands/status.mjs');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'branch-'));
    const git = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: tmp, encoding: 'utf8' });
    fs.cpSync(path.join(here, 'fixtures', 'save-game'), tmp, { recursive: true });
    git('init', '-b', 'main');
    git('add', '-A');
    git('commit', '-m', 'base');
    git('switch', '-c', 'build/P-001-save-game');
    fs.writeFileSync(path.join(tmp, 'done.txt'), 'done');
    git('add', '-A');
    git('commit', '-m', 'done');
    git('switch', 'main');
    git('merge', '--no-ff', 'build/P-001-save-game', '-m', 'merge');
    git('switch', '-c', 'build/P-002-load-game');
    fs.writeFileSync(path.join(tmp, 'wip.txt'), 'wip');
    git('add', '-A');
    git('commit', '-m', 'wip');
    git('switch', 'main');
    const s = branchState(tmp);
    const r = spawnSync(process.execPath, [bin, 'status', '--root', tmp], { encoding: 'utf8' });
    const ok = !s.building.has('P-001-save-game') && s.stale.has('P-001-save-game')
      && s.building.has('P-002-load-game') && !s.stale.has('P-002-load-game')
      && r.stdout.includes('| build/P-001-save-game | 已合進主線卻還在 |')
      && !r.stdout.includes('| build/P-002-load-game | 已合進主線卻還在 |');
    fs.rmSync(tmp, { recursive: true, force: true });
    if (!ok) {
      failed++;
      console.log('✗ 殘留的 build 分支');
    } else console.log('✓ 殘留的 build 分支');
  }
}

// 靠修訂達成的里程碑也可以是 build 分支的鍵:綁的 pipeline 還沒有引用它的 REV 是「待修訂」(不因為 pipeline 本來就 verified 而算做完、也不因為沒有決策紀錄而算切片中),
// 工作樹上寫了引用它的 REV、pipeline 重開之後照一般的字。verified-ref 的 M-4-tally-unicode 就是這樣一條
{
  const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
  if (!hasGit) console.log('· 沒有 git,跳過靠修訂達成的里程碑的工作樹檢查');
  else {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'revise-'));
    const main = path.join(base, 'repo');
    const tree = path.join(base, 'repo.worktrees', 'M-4-tally-unicode');
    const git = (cwd, ...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, encoding: 'utf8' });
    const lawful = (cwd, ...a) => spawnSync(process.execPath, [bin, ...a, '--root', cwd], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '' } });
    fs.cpSync(path.join(here, 'fixtures', 'verified-ref'), main, { recursive: true });
    git(main, 'init', '-b', 'main');
    git(main, 'add', '-A');
    git(main, 'commit', '-m', 'base');
    const before = lawful(main, 'status', '--tests', 'test.log').stdout;
    git(main, 'worktree', 'add', '-b', 'build/M-4-tally-unicode', tree, 'HEAD');
    const opened = lawful(main, 'status', '--tests', 'test.log').stdout;
    const doc = path.join(tree, '.lawful', 'pipelines', 'P-002-count-tally.md');
    fs.writeFileSync(doc, `${fs.readFileSync(doc, 'utf8').replace(/^status: verified(\r?)$/m, 'status: ready$1').replace(/\s+$/, '')}\n- REV-2(${DATE},依 M-4-tally-unicode):全形字也算一個字\n`);
    const revised = lawful(main, 'status', '--tests', 'test.log').stdout;
    const inTree = lawful(tree, 'status', '--tests', 'test.log').stdout;
    const ok = before.includes('- M-4-tally-unicode:lawful:scope-revise P-002-count-tally(') && before.includes('REV 的依欄寫 M-4-tally-unicode')
      && opened.includes('- M-4-tally-unicode:建構中,分支 build/M-4-tally-unicode;待修訂')
      && /- M-4-tally-unicode:建構中,分支 build\/M-4-tally-unicode;(調整中|Law 已定,等 qa)/.test(revised)
      && !inTree.includes('P-002-count-tally 待修訂');
    git(main, 'worktree', 'remove', '--force', tree);
    fs.rmSync(base, { recursive: true, force: true });
    if (!ok) {
      failed++;
      console.log('✗ 靠修訂達成的里程碑的工作樹');
      console.log([before, opened, revised, inTree].map((t) => t.split('\n').filter((l) => /M-4-tally-unicode/.test(l)).join('\n')).join('\n---\n'));
    } else console.log('✓ 靠修訂達成的里程碑的工作樹');
  }
}

// 專案的第一條切片單獨走完:一棵剛照模板開出來的樹(領域不變量「無」、四層「裝什麼」那一句還是佔位符、對外 I/O 表只有表頭),
// 已經有一條切片的分支在建構中時,別條需求的切片不列成能開的線,改印那一句;全域 Law 區有了東西(這裡立一條領域不變量)就照常列。
// 空的全域 Law 區不紅、不列警訊
{
  const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
  if (!hasGit) console.log('· 沒有 git,跳過第一條切片的檢查');
  else {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'first-'));
    const main = path.join(base, 'repo');
    const tree = path.join(base, 'repo.worktrees', 'M-1-save');
    const git = (cwd, ...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, encoding: 'utf8' });
    const lawful = (cwd, ...a) => spawnSync(process.execPath, [bin, ...a, '--root', cwd], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '' } });
    const templates = path.join(here, '..', '..', 'plugins', 'lawful', 'templates');
    fs.mkdirSync(path.join(main, '.lawful'), { recursive: true });
    fs.writeFileSync(path.join(main, '.lawful', 'Cone.md'), fs.readFileSync(path.join(templates, 'Cone.md'), 'utf8').replace(/^language: .*$/m, 'language: haskell').replace(/^- 語言:.*$/m, '- 語言:haskell'));
    fs.copyFileSync(path.join(templates, 'modules.md'), path.join(main, '.lawful', 'modules.md'));
    lawful(main, 'requirement', 'add', 'save-roundtrip', '存出去的世界讀得回來', '--priority', '1', '--accept', '任一個世界存檔再讀檔都還原', '--date', DATE);
    lawful(main, 'requirement', 'add', 'world-report', '世界的現況印得出來', '--priority', '2', '--accept', '任一個世界都印得出一份報表', '--date', DATE);
    lawful(main, 'requirement', 'milestone', 'R-1', 'save', '存檔走通');
    lawful(main, 'requirement', 'milestone', 'R-2', 'report', '報表走通');
    git(main, 'init', '-b', 'main');
    git(main, 'add', '-A');
    git(main, 'commit', '-m', 'base');
    const before = lawful(main, 'status').stdout;
    const lintGlobal = lawful(main, 'lint', 'global');
    git(main, 'worktree', 'add', '-b', 'build/M-1-save', tree, 'HEAD');
    const opened = lawful(main, 'status').stdout;
    lawful(main, 'invariant', 'add', '任何一個世界裡實體 id 都不重複');
    const released = lawful(main, 'status').stdout;
    const NOTE = '專案的第一條切片單獨走完:build/M-1-save 抽出全域 Law 並合進主線之後才開下一條(等著的:M-2-report)';
    const LINE = '- M-2-report:lawful:spike-impl M-2-report(';
    const ok = before.includes('- M-1-save:lawful:spike-impl M-1-save(') && before.includes(LINE) && !before.includes('專案的第一條切片單獨走完')
      && !before.includes('| 全域 Law:') && lintGlobal.status === 0
      && opened.includes('- M-1-save:建構中,分支 build/M-1-save') && !opened.includes('lawful:spike-impl M-2-report(') && opened.includes(`- ${NOTE}`) && new RegExp(`^\\d+\\. ${NOTE.replace(/[()]/g, '\\$&')}$`, 'm').test(opened)
      && released.includes(LINE) && !released.includes('專案的第一條切片單獨走完');
    git(main, 'worktree', 'remove', '--force', tree);
    fs.rmSync(base, { recursive: true, force: true });
    if (!ok) {
      failed++;
      console.log('✗ 第一條切片單獨走完');
      console.log(`lint global exit ${lintGlobal.status}\n${lintGlobal.stdout.trimEnd()}`);
      console.log([before, opened, released].map((t) => t.split('\n').filter((l) => /M-[12]-|第一條切片|全域 Law:/.test(l)).join('\n')).join('\n---\n'));
    } else console.log('✓ 第一條切片單獨走完');
  }
}

// 看板的頁面兩個 plugin 共用同一份,逐位元組相同;改了一邊就要複製到另一邊
{
  const mine = path.join(here, '..', '..', 'plugins', 'lawful', 'templates', 'status-board.html');
  const other = path.join(here, '..', '..', 'plugins', 'dev-flow', 'templates', 'status-board.html');
  if (!fs.existsSync(other) || fs.readFileSync(mine, 'utf8') !== fs.readFileSync(other, 'utf8')) {
    failed++;
    console.log('✗ status-board.html 與 dev-flow 的那份不一致');
  } else console.log('✓ status-board.html 兩個 plugin 一致');
}

console.log(failed ? `\n${failed} 個不符` : '\n全部通過');
process.exitCode = failed ? 1 : 0;
