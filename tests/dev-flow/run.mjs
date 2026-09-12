// golden 回歸:對每個夾具跑 plugins/dev-flow/bin/devflow.mjs 的每道子命令,比對 golden/<名字>.txt。--update 重產。
// 會寫檔的子命令在夾具的暫存副本上跑,golden 收「輸出 + 改動後的檔」。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', '..', 'plugins', 'dev-flow', 'bin', 'devflow.mjs');
const goldenDir = path.join(here, 'golden');
const update = process.argv.includes('--update');
const DATE = '2026-09-07';

// [名字, 夾具, argv, 寫檔後要收進 golden 的檔(相對夾具)]
const CASES = [
  // shop:一份健康的樹,兩份 feature 共用一份 abstract
  ['shop-lint-all', 'shop', ['lint', 'all']],
  ['shop-status', 'shop', ['status']],
  ['shop-status-tests', 'shop', ['status', '--tests', 'test.log']],
  ['shop-status-doc', 'shop', ['status', '--doc', 'F-001-checkout', '--tests', 'test.log']],
  ['shop-status-abstract', 'shop', ['status', '--doc', 'A-001-settle', '--tests', 'test.log']],
  ['shop-status-module', 'shop', ['status', '--module', 'src/domain/**', '--tests', 'test.log']],
  ['shop-status-json', 'shop', ['status', '--json', '--tests', 'test.log']],
  ['shop-section', 'shop', ['section', '.design/features/F-001-checkout.md', 'Brief', 'Laws']],
  ['shop-section-verify', 'shop', ['section', '.design/features/F-001-checkout.md', 'Brief', '沒有的節', '--verify']],
  ['shop-claim-feature', 'shop', ['claim', 'feature', 'ship', '--description', '把已付款的訂單交給物流', '--milestone', 'M-2', '--date', DATE], ['.design/features/F-003-ship.md', '.design/system.md', '.design/objectives.md']],
  ['shop-claim-feature-no-milestone', 'shop', ['claim', 'feature', 'ship', '--description', '把已付款的訂單交給物流', '--date', DATE], ['.design/system.md']],
  ['shop-claim-feature-bad-milestone', 'shop', ['claim', 'feature', 'ship', '--milestone', 'M-9', '--date', DATE]],
  ['shop-objective-add', 'shop', ['objective', 'add', '退款也算對錢', '--priority', '2', '--criteria', '退款金額等於原訂單可退部分'], ['.design/objectives.md']],
  ['shop-objective-add-bad-priority', 'shop', ['objective', 'add', '退款也算對錢', '--priority', '7']],
  ['shop-objective-milestone', 'shop', ['objective', 'milestone', 'O-1', '出貨走通', '--bind', 'F-002-refund'], ['.design/objectives.md']],
  ['shop-objective-milestone-abstract', 'shop', ['objective', 'milestone', 'O-1', '結算共用', '--bind', 'A-001-settle']],
  ['shop-objective-milestone-missing', 'shop', ['objective', 'milestone', 'O-1', '出貨走通', '--bind', 'F-009-nope']],
  ['shop-claim-abstract', 'shop', ['claim', 'abstract', 'audit-log', '--description', '共用的稽核紀錄', '--date', DATE], ['.design/abstracts/A-002-audit-log.md']],
  ['shop-claim-spike', 'shop', ['claim', 'spike', 'cbor', '--description', 'CBOR 夠不夠快', '--date', DATE], ['.design/spikes/SPK-001-cbor.md']],
  ['shop-claim-bad-kind', 'shop', ['claim', 'bugfix', 'oops']],
  ['shop-modules-gen', 'shop', ['modules', '--gen']],

  // blank:剛從模板複製出來、一個字都還沒填的樹;佔位符列不准被當成真的
  ['blank-status', 'blank', ['status']],
  ['blank-lint-all', 'blank', ['lint', 'all']],
  ['blank-claim', 'blank', ['claim', 'feature', 'login', '--description', '使用者以憑證換取工作階段', '--date', DATE], ['.design/features/F-001-login.md', '.design/system.md']],
  ['blank-objective-add', 'blank', ['objective', 'add', '使用者登入後看得到自己的東西', '--priority', '1'], ['.design/objectives.md']],

  // shaky:每一種紅與警訊各出現一次
  ['shaky-lint-boundary', 'shaky', ['lint', 'boundary']],
  ['shaky-lint-sig', 'shaky', ['lint', 'sig']],
  ['shaky-lint-laws', 'shaky', ['lint', 'laws']],
  ['shaky-lint-trace', 'shaky', ['lint', 'trace']],
  ['shaky-lint-io', 'shaky', ['lint', 'io']],
  ['shaky-status', 'shaky', ['status']],
  ['shaky-status-json', 'shaky', ['status', '--json']],
  ['shaky-sync', 'shaky', ['sync', '--date', DATE], ['.design/features/F-001-score.md']],
  ['shaky-modules-gen', 'shaky', ['modules', '--gen'], ['.design/modules.md']],
  ['shaky-bad-lint', 'shaky', ['lint', 'nonsense']],

  // 三個語言 adapter 各一份
  ['py-lint-all', 'py-svc', ['lint', 'all']],
  ['py-status', 'py-svc', ['status', '--tests', 'test.log']],
  ['go-lint-all', 'go-svc', ['lint', 'all']],
  ['go-status', 'go-svc', ['status', '--tests', 'test.log']],
  ['rs-lint-all', 'rs-svc', ['lint', 'all']],
  ['rs-status', 'rs-svc', ['status', '--tests', 'test.log']],

  // 舊樹的遷移帳本
  ['legacy-migrate', 'legacy', ['migrate', '.design', '--language', 'typescript']],
  ['legacy-migrate-no-lang', 'legacy', ['migrate', '.design']],
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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-'));
    fs.cpSync(root, tmp, { recursive: true });
    root = tmp;
  }
  const r = spawnSync(process.execPath, [bin, ...argv, '--root', root], { encoding: 'utf8' });
  let actual = `$ devflow ${argv.join(' ')}\n${(r.stdout + r.stderr).replace(/\r\n/g, '\n').trimEnd()}\nexit ${r.status}\n`;
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
if (h.status !== 0 || !/lint boundary/.test(h.stdout) || !/claim feature/.test(h.stdout)) {
  failed++;
  console.log('✗ --help');
} else console.log('✓ --help');

// --html:一個自帶資料的單檔網頁,佔位符要被換掉、資料要灌得進去。檔太大不收 golden,只檢查這幾件事
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-html-'));
  const out = path.join(tmp, 'board.html');
  const r = spawnSync(process.execPath, [bin, 'status', '--html', out, '--tests', 'test.log', '--root', path.join(here, 'fixtures', 'shop')], { encoding: 'utf8' });
  const html = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const data = /<script id="data" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  // exit code 帶的是報告判定(有沒有全部達成),不是寫檔成敗;寫成功了就一定讀得到資料區塊。
  // 資料區塊裡一個生的 < 都不該有:全部逃成 <,文檔寫了什麼都關不掉這個標籤
  const ok = !html.includes('__STATUS_JSON__') && !!data
    && /"tool": "devflow"/.test(data[1]) && /F-001-checkout/.test(data[1]) && !data[1].includes('<');
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!ok) {
    failed++;
    console.log('✗ status --html');
  } else console.log('✓ status --html');
}

// 看板的頁面兩個 plugin 共用同一份,逐位元組相同;改了一邊就要複製到另一邊
{
  const mine = path.join(here, '..', '..', 'plugins', 'dev-flow', 'templates', 'status-board.html');
  const other = path.join(here, '..', '..', 'plugins', 'lawful', 'templates', 'status-board.html');
  if (!fs.existsSync(other) || fs.readFileSync(mine, 'utf8') !== fs.readFileSync(other, 'utf8')) {
    failed++;
    console.log('✗ status-board.html 與 lawful 的那份不一致');
  } else console.log('✓ status-board.html 兩個 plugin 一致');
}

console.log(failed ? `\n${failed} 個不符` : '\n全部通過');
process.exitCode = failed ? 1 : 0;
