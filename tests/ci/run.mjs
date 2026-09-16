// ci/dev-flow/contract.mjs 與 ci/lawful/contract.mjs 的回歸:--lint-only 對各自的夾具跑一次,看 exit code 與關鍵訊息;
// 夾具原樣跑一輪,再複製到暫存目錄各動一刀(兩份 draft 同號、幽靈引用、frozen 文檔沒有測試)看擋不擋。
// 建置與整套測試那兩步要專案自己的工具鏈,夾具沒有,不在這裡跑。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = (plugin) => path.join(here, '..', '..', 'ci', plugin, 'contract.mjs');
const fixture = (plugin, name) => path.join(here, '..', plugin, 'fixtures', name);

// [plugin, 夾具, 預期 exit, 輸出裡要有的字串]
const CASES = [
  ['dev-flow', 'shop', 0, ['## lint ids:通過', '✓ 契約對帳通過']],
  ['dev-flow', 'fullstack', 0, ['✓ 契約對帳通過']],
  // shaky 的測試守著文檔裡沒有的 F-001#LAW-9,frozen 的 F-001 又有 law 沒測試:兩種都在 lint trace 擋的那段
  ['dev-flow', 'shaky', 1, ['## lint ids:', '✗ test/score.test.ts 引用的 F-001#LAW-9', '✗ F-001#LAW-2 沒有測試承接', '✗ 契約對帳有紅']],
  // team 有一份 draft(F-100 還是模板):它的紅只印不擋,整體要綠
  ['dev-flow', 'team', 0, ['## draft 文檔的紅(只印不擋)', 'F-100-wishlist', '✓ 契約對帳通過']],
  ['lawful', 'save-game', 0, ['✓ 契約對帳通過']],
  ['lawful', 'broken', 1, ['✗ test/SaveGameSpec.hs 引用的 P-001#LAW-7', '✗ 契約對帳有紅']],
  // templated 的 draft(P-003)只印不擋;它另有 ready 文檔與需求 Law 的紅,整體仍紅
  ['lawful', 'templated', 1, ['## draft 文檔的紅(只印不擋)', 'P-003-report-tabulate', '✗ 契約對帳有紅']],
];

// 夾具複製到暫存目錄再動一刀:[plugin, 夾具, 動哪一刀, 怎麼動, 預期 exit, 輸出裡要有的字串]
const copyDoc = (root, from, to) => fs.copyFileSync(path.join(root, from), path.join(root, to));
const setStatus = (root, file, status) => {
  const f = path.join(root, file);
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/^status: .*$/m, `status: ${status}`));
};
const MUTATED = [
  // 兩份 draft 同號:claim 出來的新文檔一定是 draft,lint ids 不套 draft 過濾才抓得到兩個人各自 claim 到同一個號
  ['dev-flow', 'team', '兩份 draft 同號', (r) => copyDoc(r, '.design/features/F-100-wishlist.md', '.design/features/F-100-giftcard.md'), 1,
    ['## lint ids:1 條不合規', '✗ F-100 同號', 'F-100-giftcard', '✗ 契約對帳有紅']],
  ['lawful', 'team', '兩條 draft 同號', (r) => copyDoc(r, '.lawful/pipelines/P-100-save-verify.md', '.lawful/pipelines/P-100-save-check.md'), 1,
    ['## lint ids:1 條不合規', '✗ P-100 同號', 'P-100-save-check', '✗ 契約對帳有紅']],
  // 幽靈引用:全綠的樹裡加一條守著文檔沒有的編號的測試,照擋
  ['dev-flow', 'shop', '幽靈引用', (r) => fs.appendFileSync(path.join(r, 'test/settle.test.ts'), "\ndescribe('A-001#LAW-9 已刪', () => { it('holds', () => {}); });\n"), 1,
    ['✗ test/settle.test.ts 引用的 A-001#LAW-9 文檔裡沒有(幽靈引用)', '✗ 契約對帳有紅']],
  ['lawful', 'save-game', '幽靈引用', (r) => fs.appendFileSync(path.join(r, 'test/SaveGameSpec.hs'), '\n  describe "P-001#LAW-9" $\n    it "holds" $ True `shouldBe` True\n'), 1,
    ['✗ test/SaveGameSpec.hs 引用的 P-001#LAW-9 文檔裡沒有(幽靈引用)', '✗ 契約對帳有紅']],
  // frozen 文檔的 law 沒有測試承接:擋;同一份改成 ready 就只印
  ['dev-flow', 'shop', 'frozen 的 A-001 沒有測試', (r) => fs.rmSync(path.join(r, 'test/settle.test.ts')), 1,
    ['## lint trace(幽靈引用、frozen 文檔的 law):', '✗ A-001#LAW-1 沒有測試承接', '✗ 契約對帳有紅']],
  ['dev-flow', 'shop', 'ready 的 A-001 沒有測試', (r) => { fs.rmSync(path.join(r, 'test/settle.test.ts')); setStatus(r, '.design/abstracts/A-001-settle.md', 'ready'); }, 0,
    ['## lint trace 其餘(只印不擋):', '- · A-001#LAW-1 沒有測試承接', '✓ 契約對帳通過']],
  ['lawful', 'frozen-ref', 'frozen 的 P-002 沒有測試', (r) => fs.rmSync(path.join(r, 'test/CountSpec.hs')), 1,
    ['## lint trace(幽靈引用、frozen 文檔的 law):', '✗ P-002#LAW-1 沒有測試承接']],
];

let failed = 0;
function check(plugin, name, label, root, exit, needles) {
  const r = spawnSync(process.execPath, [bin(plugin), '--root', root, '--lint-only'], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const missing = needles.filter((n) => !out.includes(n));
  const tag = `${plugin}/${name}${label ? `(${label})` : ''}`;
  if (r.status === exit && !missing.length) console.log(`✓ ${tag}`);
  else {
    failed++;
    console.log(`✗ ${tag}:exit ${r.status}(預期 ${exit})${missing.length ? `,少了 ${missing.join('、')}` : ''}\n${out}`);
  }
}
for (const [plugin, name, exit, needles] of CASES) check(plugin, name, '', fixture(plugin, name), exit, needles);
for (const [plugin, name, label, mutate, exit, needles] of MUTATED) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-'));
  fs.cpSync(fixture(plugin, name), tmp, { recursive: true });
  mutate(tmp);
  check(plugin, name, label, tmp, exit, needles);
  fs.rmSync(tmp, { recursive: true, force: true });
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
