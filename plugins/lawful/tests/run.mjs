// golden 回歸:對每個夾具跑每道子命令,比對 tests/golden/<名字>.txt。--update 重產。
// 會寫檔的子命令在夾具的暫存副本上跑,golden 收「輸出 + 改動後的檔」。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'lawful.mjs');
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
  ['save-game-section', 'save-game', ['section', '.design/pipelines/P-001-save-game.md', 'Brief', 'Laws']],
  ['save-game-section-verify', 'save-game', ['section', '.design/pipelines/P-001-save-game.md', 'Brief', '沒有的節', '--verify']],
  ['save-game-status', 'save-game', ['status']],
  ['save-game-status-tests', 'save-game', ['status', '--tests', 'test.log']],
  ['save-game-status-pipeline', 'save-game', ['status', '--pipeline', 'P-001-save-game', '--tests', 'test.log']],
  ['save-game-status-module', 'save-game', ['status', '--module', 'Save.Codec', '--tests', 'test.log']],
  ['broken-status', 'broken', ['status']],
  ['save-game-status-tasty', 'save-game', ['status', '--tests', 'test-tasty.log']],
  ['devflow-migrate', 'devflow', ['migrate', 'from-dev-flow', '.design', '--ignore', 'old']],
  ['save-game-claim', 'save-game', ['claim', 'load-game', '--description', '把存檔讀回 World', '--date', DATE], ['.design/pipelines/P-002-load-game.md', '.design/system.md']],
  ['broken-sync', 'broken', ['sync', '--date', DATE], ['.design/pipelines/P-001-save-game.md']],
  ['broken-modules-gen', 'broken', ['modules', '--gen'], ['.design/modules.md']],
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

console.log(failed ? `\n${failed} 個不符` : '\n全部通過');
process.exitCode = failed ? 1 : 0;
