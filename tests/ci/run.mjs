// ci/dev-flow/contract.mjs 與 ci/lawful/contract.mjs 的回歸:--lint-only 對各自的夾具跑一次,看 exit code 與關鍵訊息。
// 建置與整套測試那兩步要專案自己的工具鏈,夾具沒有,不在這裡跑。
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = (plugin) => path.join(here, '..', '..', 'ci', plugin, 'contract.mjs');
const fixture = (plugin, name) => path.join(here, '..', plugin, 'fixtures', name);

// [plugin, 夾具, 預期 exit, 輸出裡要有的字串]
const CASES = [
  ['dev-flow', 'shop', 0, ['## lint ids:通過', '✓ 契約對帳通過']],
  ['dev-flow', 'fullstack', 0, ['✓ 契約對帳通過']],
  ['dev-flow', 'shaky', 1, ['## lint ids:', '✗ 契約對帳有紅']],
  // team 有一份 draft(F-100 還是模板):它的紅只印不擋,整體要綠
  ['dev-flow', 'team', 0, ['## draft 文檔的紅(只印不擋)', 'F-100-wishlist', '✓ 契約對帳通過']],
  ['lawful', 'save-game', 0, ['✓ 契約對帳通過']],
  ['lawful', 'broken', 1, ['✗ 契約對帳有紅']],
  // templated 的 draft(P-003)只印不擋;它另有 ready 文檔與需求 Law 的紅,整體仍紅
  ['lawful', 'templated', 1, ['## draft 文檔的紅(只印不擋)', 'P-003-report-tabulate', '✗ 契約對帳有紅']],
];

let failed = 0;
for (const [plugin, name, exit, needles] of CASES) {
  const r = spawnSync(process.execPath, [bin(plugin), '--root', fixture(plugin, name), '--lint-only'], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const missing = needles.filter((n) => !out.includes(n));
  if (r.status === exit && !missing.length) console.log(`✓ ${plugin}/${name}`);
  else {
    failed++;
    console.log(`✗ ${plugin}/${name}:exit ${r.status}(預期 ${exit})${missing.length ? `,少了 ${missing.join('、')}` : ''}\n${out}`);
  }
}

// 沒有 .design/ 或 .lawful/ 的目錄 → 一句話與 exit 1;--help → 用法與 exit 0
for (const plugin of ['dev-flow', 'lawful']) {
  const r = spawnSync(process.execPath, [bin(plugin), '--root', here], { encoding: 'utf8' });
  const h = spawnSync(process.execPath, [bin(plugin), '--help'], { encoding: 'utf8' });
  if (r.status === 1 && /底下沒有/.test(r.stderr) && h.status === 0 && /用法/.test(h.stdout)) console.log(`✓ ${plugin} 沒有樹與 --help`);
  else { failed++; console.log(`✗ ${plugin} 沒有樹與 --help\n${r.stderr}${h.stdout}`); }
}

console.log(failed ? `\n${failed} 個不符` : '\n全部通過');
process.exitCode = failed ? 1 : 0;
