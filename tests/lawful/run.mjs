// golden 回歸:對每個夾具跑 plugins/lawful/bin/lawful.mjs 的每道子命令,比對 golden/<名字>.txt。--update 重產。
// 會寫檔的子命令在夾具的暫存副本上跑,golden 收「輸出 + 改動後的檔」。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', '..', 'plugins', 'lawful', 'bin', 'lawful.mjs');
const goldenDir = path.join(here, 'golden');
const update = process.argv.includes('--update');
const DATE = '2026-09-05';

// [名字, 夾具, argv, 寫檔後要收進 golden 的檔(相對夾具)]
const CASES = [
  ['save-game-lint-all', 'save-game', ['lint', 'all']],
  ['broken-lint-boundary', 'broken', ['lint', 'boundary']],
  ['broken-lint-sig', 'broken', ['lint', 'sig']],
  ['broken-lint-laws', 'broken', ['lint', 'laws']],
  ['broken-lint-trace', 'broken', ['lint', 'trace']],
  ['save-game-section', 'save-game', ['section', '.lawful/pipelines/P-001-save-game.md', 'Brief', 'Laws']],
  ['save-game-section-verify', 'save-game', ['section', '.lawful/pipelines/P-001-save-game.md', 'Brief', '沒有的節', '--verify']],
  ['save-game-status', 'save-game', ['status']],
  ['save-game-status-tests', 'save-game', ['status', '--tests', 'test.log']],
  ['save-game-status-pipeline', 'save-game', ['status', '--pipeline', 'P-001-save-game', '--tests', 'test.log']],
  ['save-game-status-module', 'save-game', ['status', '--module', 'Save.Codec', '--tests', 'test.log']],
  ['save-game-status-json', 'save-game', ['status', '--json', '--tests', 'test.log']],
  ['broken-status', 'broken', ['status']],
  ['save-game-status-tasty', 'save-game', ['status', '--tests', 'test-tasty.log']],
  ['devflow-migrate', 'devflow', ['migrate', 'from-dev-flow', '.design', '--ignore', 'old']],
  ['refs-status', 'refs', ['status']],
  ['refs-status-json', 'refs', ['status', '--json']],
  ['refs-lint-sig', 'refs', ['lint', 'sig']],
  ['frozen-ref-status', 'frozen-ref', ['status']],
  ['frozen-ref-status-tests', 'frozen-ref', ['status', '--tests', 'test.log']],
  ['run-cmd-status-run', 'run-cmd', ['status', '--run']],
  ['run-cmd-status-empty', 'run-cmd', ['status', '--tests', 'empty.log']],
  ['templated-status', 'templated', ['status', '--tests', 'test.log']],
  ['templated-lint-sig', 'templated', ['lint', 'sig']],
  ['templated-lint-laws', 'templated', ['lint', 'laws']],
  ['save-game-claim', 'save-game', ['claim', 'load-game', '--description', '把存檔讀回 World', '--milestone', 'M-1', '--date', DATE], ['.lawful/pipelines/P-002-load-game.md', '.lawful/system.md', '.lawful/objectives.md']],
  ['save-game-claim-no-milestone', 'save-game', ['claim', 'load-game', '--description', '把存檔讀回 World', '--date', DATE], ['.lawful/system.md']],
  ['save-game-objective-add', 'save-game', ['objective', 'add', '讀檔不會壞掉舊存檔', '--priority', '2', '--criteria', '舊版存檔讀得回來'], ['.lawful/objectives.md']],
  ['save-game-objective-milestone', 'save-game', ['objective', 'milestone', 'O-1', '讀檔還原世界', '--bind', 'P-001-save-game'], ['.lawful/objectives.md']],
  ['save-game-objective-milestone-missing', 'save-game', ['objective', 'milestone', 'O-1', '讀檔還原世界', '--bind', 'P-002-load-game']],
  ['templated-objective-add', 'templated', ['objective', 'add', '報表印得出來', '--priority', '1'], ['.lawful/objectives.md']],
  ['broken-sync', 'broken', ['sync', '--date', DATE], ['.lawful/pipelines/P-001-save-game.md']],
  ['broken-modules-gen', 'broken', ['modules', '--gen'], ['.lawful/modules.md']],
  ['broken-spike-close-dry', 'broken', ['spike', 'close', 'SPK-001', '--dry-run']],
  ['broken-spike-close', 'broken', ['spike', 'close', 'SPK-001'], ['spike/SPK-001-cbor-size/Main.hs']],
  ['broken-spike-close-open', 'broken', ['spike', 'close', 'SPK-002']],
];

function snapshot(root, files) {
  return files.map((f) => {
    const p = path.join(root, f);
    return `--- ${f}\n${fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '(不存在)'}`;
  }).join('\n');
}

let failed = 0;
for (const [name, fixture, argv, files] of CASES) {
  let root = path.join(here, 'fixtures', fixture);
  let tmp = null;
  if (files) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lawful-'));
    fs.cpSync(root, tmp, { recursive: true });
    root = tmp;
  }
  const r = spawnSync(process.execPath, [bin, ...argv, '--root', root], { encoding: 'utf8' });
  let actual = `$ lawful ${argv.join(' ')}\n${(r.stdout + r.stderr).replace(/\r\n/g, '\n').trimEnd()}\nexit ${r.status}\n`;
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
if (h.status !== 0 || !/lint boundary/.test(h.stdout) || !/status/.test(h.stdout)) {
  failed++;
  console.log('✗ --help');
} else console.log('✓ --help');

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
    && /"tool": "lawful"/.test(data[1]) && /P-001-save-game/.test(data[1]) && !data[1].includes('<')
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
  const m = /^file:\/\/\/(.*)$/m.exec(r.stdout);
  const after = new Set(fs.readdirSync(fixtureDir));
  const wrote = m ? decodeURIComponent(m[1]) : '';
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
