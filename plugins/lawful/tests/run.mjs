// golden 回歸:對每個夾具跑每道子命令,比對 tests/golden/<夾具>-<子命令>.txt。--update 重產。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', 'bin', 'lawful.mjs');
const goldenDir = path.join(here, 'golden');
const update = process.argv.includes('--update');

const CASES = [
  ['save-game', ['lint', 'all']],
  ['broken', ['lint', 'boundary']],
  ['broken', ['lint', 'sig']],
  ['broken', ['lint', 'laws']],
  ['broken', ['lint', 'trace']],
  ['save-game', ['section', '.design/pipelines/P-001-save-game.md', 'Brief', 'Laws']],
  ['save-game', ['section', '.design/pipelines/P-001-save-game.md', 'Brief', '沒有的節', '--verify']],
];

let failed = 0;
for (const [fixture, argv] of CASES) {
  const root = path.join(here, 'fixtures', fixture);
  const r = spawnSync(process.execPath, [bin, ...argv, '--root', root], { encoding: 'utf8' });
  const actual = `$ lawful ${argv.join(' ')}\n${(r.stdout + r.stderr).replace(/\r\n/g, '\n').trimEnd()}\nexit ${r.status}\n`;
  const name = `${fixture}-${argv.filter((a) => !a.startsWith('--') && !a.includes('/')).join('-')}.txt`;
  const file = path.join(goldenDir, name);
  if (update || !fs.existsSync(file)) {
    fs.writeFileSync(file, actual);
    console.log(`寫入 ${name}`);
    continue;
  }
  const expected = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (expected === actual) console.log(`✓ ${name}`);
  else {
    failed++;
    console.log(`✗ ${name}\n--- 預期\n${expected}\n--- 實際\n${actual}`);
  }
}

// --help 要能跑
const h = spawnSync(process.execPath, [bin, '--help'], { encoding: 'utf8' });
if (h.status !== 0 || !/lint all/.test(h.stdout)) {
  failed++;
  console.log('✗ --help');
} else console.log('✓ --help');

console.log(failed ? `\n${failed} 個不符` : '\n全部通過');
process.exitCode = failed ? 1 : 0;
