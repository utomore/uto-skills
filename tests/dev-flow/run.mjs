// golden 回歸：對每個夾具跑 plugins/dev-flow/bin/devflow.mjs 的每道子命令，比對 golden/<名字>.txt。--update 重產。
// 會寫檔的子命令在夾具的暫存副本上跑，golden 收「輸出 + 改動後的檔」。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '..', '..', 'plugins', 'dev-flow', 'bin', 'devflow.mjs');
const goldenDir = path.join(here, 'golden');
const update = process.argv.includes('--update');
const DATE = '2026-09-07';

// [名字，夾具，argv，寫檔後要收進 golden 的檔（相對夾具），環境變數]
const CASES = [
  // shop：一份健康的樹；settle 與它的 law 住在 F-001-checkout，F-002-refund 的 Steps 表引用它
  ['shop-lint-all', 'shop', ['lint', 'all']],
  ['shop-lint-global', 'shop', ['lint', 'global']],
  ['shop-status', 'shop', ['status']],
  ['shop-status-tests', 'shop', ['status', '--tests', 'test.log']],
  ['shop-status-doc', 'shop', ['status', '--doc', 'F-001-checkout', '--tests', 'test.log']],
  ['shop-status-doc-ref', 'shop', ['status', '--doc', 'F-002-refund', '--tests', 'test.log']],
  ['shop-status-module', 'shop', ['status', '--module', 'src/domain/**', '--tests', 'test.log']],
  ['shop-status-json', 'shop', ['status', '--json', '--tests', 'test.log']],
  // 上線從 git tag 推：夾具不是 git repo 的根，release 講不出來而 exit 1；真的開一個 repo 的檢查在後面
  ['shop-release-no-git', 'shop', ['release', '--tests', 'test.log']],
  ['shop-brief-incident', 'shop', ['brief', 'incident', '--args', 'F-002-refund 退款金額多退了 --no-rules']],
  ['shop-section', 'shop', ['section', '.design/features/F-001-checkout.md', 'Brief', 'Laws']],
  ['shop-section-verify', 'shop', ['section', '.design/features/F-001-checkout.md', 'Brief', '沒有的節', '--verify']],
  ['shop-claim-feature', 'shop', ['claim', 'feature', 'ship', '--description', '把已付款的訂單交給物流', '--milestone', 'M-2-refund', '--date', DATE], ['.design/features/F-003-ship.md', '.design/system.md', '.design/requirements/R-1-money-correct.md']],
  ['shop-claim-feature-no-milestone', 'shop', ['claim', 'feature', 'ship', '--description', '把已付款的訂單交給物流', '--date', DATE], ['.design/system.md']],
  ['shop-claim-feature-bad-milestone', 'shop', ['claim', 'feature', 'ship', '--milestone', 'M-9', '--date', DATE]],
  ['shop-requirement-add', 'shop', ['requirement', 'add', 'money-traceable', '每一筆錢都查得到來源', '--priority', '2', '--accept', '任一筆訂單都查得到它的每一筆金額從哪一列品項來', '--date', DATE], ['.design/requirements/R-2-money-traceable.md']],
  ['shop-requirement-add-no-accept', 'shop', ['requirement', 'add', 'money-traceable', '每一筆錢都查得到來源', '--priority', '2', '--date', DATE], ['.design/requirements/R-2-money-traceable.md']],
  ['shop-requirement-add-bad-priority', 'shop', ['requirement', 'add', 'money-traceable', '每一筆錢都查得到來源', '--priority', '7']],
  ['shop-requirement-add-bad-slug', 'shop', ['requirement', 'add', 'Money_Traceable', '每一筆錢都查得到來源', '--priority', '2']],
  ['shop-requirement-add-no-priority', 'shop', ['requirement', 'add', 'money-traceable', '每一筆錢都查得到來源']],
  ['shop-requirement-milestone', 'shop', ['requirement', 'milestone', 'R-1', 'ship', '出貨走通', '--bind', 'F-002-refund'], ['.design/requirements/R-1-money-correct.md']],
  ['shop-requirement-milestone-unbound', 'shop', ['requirement', 'milestone', 'R-1', 'ship', '出貨走通'], ['.design/requirements/R-1-money-correct.md']],
  ['shop-requirement-milestone-bad-slug', 'shop', ['requirement', 'milestone', 'R-1', '出貨走通', '一句話']],
  ['shop-requirement-milestone-missing-requirement', 'shop', ['requirement', 'milestone', 'R-9', 'ship', '出貨走通']],
  // 人工審核：status 只算證據，已驗收那一列只由 requirement accept 寫；怎麼驗欄由 requirement verify 補（整合從決策紀錄的 Entry 搬過來）
  ['shop-requirement-accept', 'shop', ['requirement', 'accept', 'R-1', '--by', 'dev@example.com', '--evidence', 'R-1#ACCEPT green，三條 demo 都跑過', '--date', DATE], ['.design/requirements/R-1-money-correct.md']],
  ['shop-requirement-accept-no-by', 'shop', ['requirement', 'accept', 'R-1', '--evidence', '跑過了']],
  ['shop-requirement-accept-no-evidence', 'shop', ['requirement', 'accept', 'R-1', '--by', 'dev@example.com']],
  ['shop-requirement-accept-missing', 'shop', ['requirement', 'accept', 'R-9', '--by', 'dev@example.com', '--evidence', '跑過了']],
  ['shop-requirement-verify', 'shop', ['requirement', 'verify', 'M-2-refund', 'npx ts-node demo/refund.ts --verbose'], ['.design/requirements/R-1-money-correct.md']],
  ['shop-requirement-verify-missing', 'shop', ['requirement', 'verify', 'M-9-nope', 'npm run demo']],
  ['shop-requirement-verify-no-command', 'shop', ['requirement', 'verify', 'M-2-refund']],
  ['shop-invariant-add', 'shop', ['invariant', 'add', '退回的錢不超過付過的錢', '--kind', 'bound'], ['.design/system.md']],
  ['shop-invariant-add-bad-kind', 'shop', ['invariant', 'add', '退回的錢不超過付過的錢', '--kind', 'nonsense']],
  // 綁一份已經被別條里程碑綁過的 feature：這條里程碑靠修訂它達成，下一步是 scope-revise，REV 的依欄寫這條里程碑的全名
  ['shop-requirement-milestone-revise', 'shop', ['requirement', 'milestone', 'R-1', 'checkout-fast', '結帳一秒內完成', '--bind', 'F-001-checkout'], ['.design/requirements/R-1-money-correct.md']],
  ['shop-requirement-milestone-missing', 'shop', ['requirement', 'milestone', 'R-1', 'ship', '出貨走通', '--bind', 'F-009-nope']],
  ['shop-claim-kind-rejected', 'shop', ['claim', 'abstract', 'audit-log', '--description', '共用的稽核紀錄', '--date', DATE], ['.design/abstracts/A-001-audit-log.md']],
  ['shop-claim-adr', 'shop', ['claim', 'adr', 'single-currency', '--description', '金額只在單一幣別內計算', '--date', DATE], ['.design/adr/ADR-001-single-currency.md']],
  ['shop-claim-bad-kind', 'shop', ['claim', 'bugfix', 'oops']],
  ['shop-modules-gen', 'shop', ['modules', '--gen']],

  // team:system.md 有號段行的樹；claim 從自己的區間配號並寫 owner，email 不在號段行上就停
  ['team-lint-ids', 'team', ['lint', 'ids']],
  ['team-claim-feature', 'team', ['claim', 'feature', 'ship', '--description', '把已付款的訂單交給物流', '--milestone', 'M-2', '--date', DATE], ['.design/features/F-101-ship.md', '.design/system.md'], { GIT_AUTHOR_EMAIL: 'amy@corp.com' }],
  ['team-claim-adr', 'team', ['claim', 'adr', 'cbor', '--description', '對外的序列化用 CBOR', '--date', DATE], ['.design/adr/ADR-200-cbor.md'], { GIT_AUTHOR_EMAIL: 'bob@corp.com' }],
  ['team-claim-unknown', 'team', ['claim', 'feature', 'ship', '--date', DATE], ['.design/system.md'], { GIT_AUTHOR_EMAIL: 'carol@corp.com' }],

  // blank：剛從模板複製出來、一個字都還沒填的樹；佔位符列不准被當成真的
  ['blank-status', 'blank', ['status']],
  ['blank-lint-all', 'blank', ['lint', 'all']],
  ['blank-claim', 'blank', ['claim', 'feature', 'login', '--description', '使用者以憑證換取工作階段', '--date', DATE], ['.design/features/F-001-login.md', '.design/system.md']],
  ['blank-requirement-add', 'blank', ['requirement', 'add', 'login-sees-own', '使用者登入後看得到自己的東西', '--priority', '1', '--accept', '任一使用者登入後列出的東西都是自己的', '--date', DATE], ['.design/requirements/R-1-login-sees-own.md']],
  ['blank-invariant-add', 'blank', ['invariant', 'add', '任何人只看得到自己的東西'], ['.design/system.md']],
  ['blank-requirement-milestone', 'blank', ['requirement', 'milestone', 'R-1', 'login', '登入走通']],

  // shaky：每一種紅與警訊各出現一次
  ['shaky-lint-boundary', 'shaky', ['lint', 'boundary']],
  ['shaky-lint-sig', 'shaky', ['lint', 'sig']],
  ['shaky-lint-laws', 'shaky', ['lint', 'laws']],
  ['shaky-lint-trace', 'shaky', ['lint', 'trace']],
  ['shaky-lint-io', 'shaky', ['lint', 'io']],
  ['shaky-lint-invariants', 'shaky', ['lint', 'invariants']],
  ['shaky-lint-global', 'shaky', ['lint', 'global']],
  ['shaky-lint-ids', 'shaky', ['lint', 'ids']],
  ['shaky-status', 'shaky', ['status']],
  ['shaky-status-json', 'shaky', ['status', '--json']],
  ['shaky-status-stale-log', 'shaky', ['status', '--tests', 'stale.log']],
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

  // fullstack：前端 TypeScript 加後端 Python 住同一棵樹，language 欄是「目錄 = adapter」清單，三道指令每側一組；
  // 三條需求各綁自己的 feature，R-3 的 F-002-refund 引用 R-1 的 F-001-checkout，status 的「依賴」欄印得出 R-1
  ['fullstack-lint-all', 'fullstack', ['lint', 'all']],
  ['fullstack-status', 'fullstack', ['status', '--tests', 'web=web.log,api=api.log']],
  ['fullstack-status-one-log', 'fullstack', ['status', '--tests', 'api.log']],
  ['fullstack-status-bad-side', 'fullstack', ['status', '--tests', 'mobile=api.log']],
  ['fullstack-status-doc', 'fullstack', ['status', '--doc', 'F-003-basket', '--tests', 'web=web.log,api=api.log']],
  ['fullstack-status-module', 'fullstack', ['status', '--module', 'api/cart/basket.py', '--tests', 'web=web.log,api=api.log']],
  // 綁別條需求的里程碑做出來的 feature 也不擋：這條里程碑靠修訂它達成
  ['fullstack-requirement-milestone-other-requirement', 'fullstack', ['requirement', 'milestone', 'R-3', 'fee-over-refund', '手續費大過要退的金額也退得出來', '--bind', 'F-001-checkout'], ['.design/requirements/R-3-refund-correct.md']],

  // shared-doc：一份不被里程碑綁定的文檔被兩份 feature 引用；status 與 lint sig 照讀，里程碑不綁它
  ['shared-doc-status', 'shared-doc', ['status']],
  ['shared-doc-status-doc', 'shared-doc', ['status', '--doc', 'A-001-title']],
  ['shared-doc-lint-sig', 'shared-doc', ['lint', 'sig']],
  ['shared-doc-requirement-milestone-not-feature', 'shared-doc', ['requirement', 'milestone', 'R-1', 'title-shared', '標題共用', '--bind', 'A-001-title']],

  // flat：里程碑還擠在一份 objectives.md、system.md 也還沒有「全域 Law」區的樹；goals：需求住 system.md「## 需求」節、里程碑住 objectives/ 的樹
  // （一條需求有兩個目標檔、一條沒有、一個目標檔對不到需求）。兩種樹 status 都照讀，migrate requirements 換成 requirements/
  ['flat-status', 'flat', ['status']],
  ['flat-migrate-laws', 'flat', ['migrate', 'laws']],
  ['flat-migrate-laws-write', 'flat', ['migrate', 'laws', '--write'], ['.design/system.md']],
  ['shop-migrate-laws', 'shop', ['migrate', 'laws']],
  ['flat-migrate-requirements', 'flat', ['migrate', 'requirements', '--date', DATE]],
  ['flat-migrate-requirements-write', 'flat', ['migrate', 'requirements', '--write', '--date', DATE], ['.design/system.md', '.design/requirements/R-1-checkout.md', '.design/objectives.md']],
  ['flat-requirement-add', 'flat', ['requirement', 'add', 'money-traceable', '每一筆錢都查得到來源', '--priority', '2']],
  ['goals-status', 'goals', ['status']],
  ['goals-lint-laws', 'goals', ['lint', 'laws']],
  ['goals-migrate-requirements', 'goals', ['migrate', 'requirements', '--date', DATE]],
  ['goals-migrate-requirements-write', 'goals', ['migrate', 'requirements', '--write', '--date', DATE], ['.design/system.md', '.design/requirements/R-1-refund-correct.md', '.design/requirements/R-2-unnamed.md', '.design/objectives/R-1-O-1-money-correct.md', '.design/objectives/R-9-O-3-loyalty.md', '.design/features/F-001-checkout.md']],
  ['goals-requirement-milestone', 'goals', ['requirement', 'milestone', 'R-1', 'ship', '出貨走通']],
  ['goals-brief-spike-impl', 'goals', ['brief', 'spike-impl', 'M-3-partial-refund', '--no-rules']],
  ['shop-migrate-requirements', 'shop', ['migrate', 'requirements']],
  // tuned：已經是 requirements/ 而需求檔還帶調整表的樹（shop 加兩張調整表，F-001-checkout 的 REV-1 依欄引用 RF-1）。
  // status 照讀（每一列讀成一條綁既有文檔的里程碑：REV 引用了的達成、沒引用的待修訂）、警訊指到 migrate requirements；寫需求檔的指令停下；
  // migrate requirements 把每一列換成里程碑表的一列、REV 依欄的編號跟著改寫
  ['tuned-status', 'tuned', ['status', '--tests', 'test.log']],
  ['tuned-requirement-milestone', 'tuned', ['requirement', 'milestone', 'R-1', 'ship', '出貨走通']],
  ['tuned-requirement-add', 'tuned', ['requirement', 'add', 'ships-on-time', '每一筆訂單準時出貨', '--priority', '3']],
  ['tuned-migrate-requirements', 'tuned', ['migrate', 'requirements']],
  ['tuned-migrate-requirements-write', 'tuned', ['migrate', 'requirements', '--write'], ['.design/requirements/R-1-money-correct.md', '.design/requirements/R-2-money-traceable.md', '.design/features/F-001-checkout.md', '.design/features/F-002-refund.md']],

  // subsystems/ 體系的遷移帳本
  ['legacy-migrate', 'legacy', ['migrate', '.design', '--language', 'typescript']],
  ['legacy-migrate-no-lang', 'legacy', ['migrate', '.design']],

  // brief：一個角色開工要的東西一次印完。golden 用 --no-rules，才不會規章每改一次就跟著變；規章的節另外查（下面的「brief 的規章節」）
  ['shop-brief-qa', 'shop', ['brief', 'qa', 'F-001-checkout', '--no-rules']],
  ['shop-brief-qa-requirement', 'shop', ['brief', 'qa', 'R-1', '--no-rules']],
  ['shop-brief-qa-invariant', 'shop', ['brief', 'qa', 'INV-1', '--no-rules']],
  ['shop-brief-refactor', 'shop', ['brief', 'refactor', 'F-002-refund', '--no-rules']],
  ['shop-brief-refactor-requirement', 'shop', ['brief', 'refactor', 'R-1', '--no-rules']],
  ['shop-brief-fingerprint', 'shop', ['brief', 'qa', 'F-001-checkout', '--fingerprint']],
  ['shop-brief-no-target', 'shop', ['brief', 'qa', '--no-rules']],
  ['shop-brief-missing', 'shop', ['brief', 'qa', 'F-009-nope', '--no-rules']],
  ['shop-brief-bad-skill', 'shop', ['brief', 'nope']],
  ['py-brief-qa', 'py-svc', ['brief', 'qa', 'F-001-basket', '--no-rules']],
  ['go-brief-qa', 'go-svc', ['brief', 'qa', 'F-001-queue', '--no-rules']],
  ['rs-brief-qa', 'rs-svc', ['brief', 'qa', 'F-001-span', '--no-rules']],
  ['fullstack-brief-qa', 'fullstack', ['brief', 'qa', 'F-003-basket', '--no-rules']],
  ['blank-brief-qa', 'blank', ['brief', 'qa', 'F-001', '--no-rules']],
  // 指揮階段：每個 skill 各有自己那幾塊；目標的種類不合就講它收哪幾種
  // 有 status 那一塊的案例一律明講 --tests：沒講的時候 brief 會照檔案時間自己挑根目錄的那一份，而檔案時間每台機器不同
  ['shop-brief-build', 'shop', ['brief', 'build', 'F-001-checkout', '--tests', 'test.log', '--no-rules']],
  ['shop-brief-build-milestone', 'shop', ['brief', 'build', 'M-2-refund', '--tests', 'test.log', '--no-rules']],
  ['shop-brief-build-requirement', 'shop', ['brief', 'build', 'R-1', '--tests', 'test.log', '--no-rules']],
  ['shop-brief-build-no-target', 'shop', ['brief', 'build', '--no-rules']],
  ['shaky-brief-build', 'shaky', ['brief', 'build', 'F-001-score', '--tests', 'stale.log', '--no-rules']],
  ['shop-brief-scope-laws-doc', 'shop', ['brief', 'scope-laws', 'F-002-refund', '--tests', 'test.log', '--no-rules']],
  ['shop-brief-scope-revise', 'shop', ['brief', 'scope-revise', 'F-002-refund', '--tests', 'test.log', '--no-rules']],
  // 靠修訂這一份達成的里程碑在「這份文檔朝向哪裡」照樣列：REV 的依欄引用了 (shop)、還沒引用 (shaky)
  ['shop-brief-scope-revise-cited', 'shop', ['brief', 'scope-revise', 'F-001-checkout', '--tests', 'test.log', '--no-rules']],
  ['shaky-brief-scope-revise-pending', 'shaky', ['brief', 'scope-revise', 'F-001-score', '--tests', 'stale.log', '--no-rules']],
  ['shop-brief-scope-revise-milestone', 'shop', ['brief', 'scope-revise', 'M-2-refund', '--no-rules']],
  ['shop-brief-global-laws', 'shop', ['brief', 'global-laws', '--tests', 'test.log', '--no-rules']],
  ['shop-brief-global-laws-invariant', 'shop', ['brief', 'global-laws', 'INV-1', '--tests', 'test.log', '--no-rules']],
  // scope-laws 帶著全域的候選接過來：目標是那條里程碑，候選的出處（它綁的文檔全文與逐條狀態）與決策紀錄都在
  ['shop-brief-global-laws-milestone', 'shop', ['brief', 'global-laws', 'M-2-refund', '--tests', 'test.log', '--no-rules']],
  ['shop-brief-scope-laws', 'shop', ['brief', 'scope-laws', 'M-2-refund', '--no-rules']],
  ['shop-brief-spike-impl', 'shop', ['brief', 'spike-impl', 'M-1-checkout', '--tests', 'test.log', '--no-rules']],
  ['shop-brief-spike-impl-wrong-kind', 'shop', ['brief', 'spike-impl', 'F-001-checkout', '--no-rules']],
  ['shop-brief-integrate', 'shop', ['brief', 'integrate', '--no-rules']],
  ['shop-brief-status', 'shop', ['brief', 'status', '--no-rules']],
  ['shop-brief-audit', 'shop', ['brief', 'audit', '--tests', 'test.log', '--no-rules']],
  ['shop-brief-require-design', 'shop', ['brief', 'require-design', '--tests', 'test.log', '--no-rules']],
  ['shop-brief-kickoff', 'shop', ['brief', 'kickoff', '--no-rules']],
  ['shop-brief-study', 'shop', ['brief', 'study', '--no-rules']],
  ['blank-brief-require-design', 'blank', ['brief', 'require-design', '--no-rules']],
  // skill 載入時的寫法：整串參數是自由文字，目標與旗標從裡面認
  ['shop-brief-args', 'shop', ['brief', 'build', '--args', '幫我 build F-001-checkout (先看 log) --tests test.log --no-rules']],
  ['shop-brief-args-empty', 'shop', ['brief', 'status', '--args', '看板 --no-rules']],
];

function snapshot(root, files) {
  return files.map((f) => {
    const p = path.join(root, f);
    return `--- ${f}\n${fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '（不存在）'}`;
  }).join('\n');
}

let failed = 0;
for (const [name, fixture, argv, files, env] of CASES) {
  let root = path.join(here, 'fixtures', fixture);
  let tmp = null;
  if (files) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-'));
    fs.cpSync(root, tmp, { recursive: true });
    root = tmp;
  }
  // GIT_AUTHOR_EMAIL 預設清空：沒指定 env 的案例不受這台機器的 git 設定影響
  const r = spawnSync(process.execPath, [bin, ...argv, '--root', root], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '', ...env } });
  const envText = env ? Object.entries(env).map(([k, v]) => `${k}=${v} `).join('') : '';
  let actual = `$ ${envText}devflow ${argv.join(' ')}\n${(r.stdout + r.stderr).replace(/\r\n/g, '\n').trimEnd()}\nexit ${r.status}\n`;
  // brief 的指紋帶規章的雜湊：規章每改一次就變，golden 不追它
  actual = actual.replace(/ rules:[0-9a-f]{8}/g, ' rules:<雜湊>');
  // 測試輸出新不新看的是檔案時間，每台機器不同
  actual = actual.replace(/^(- \S+)  (?:比每一個原始碼與測試檔都新|比 \S+ 舊[:：].*)$/gm, '$1  <新舊看檔案時間>');
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
if (h.status !== 0 || !/lint ids \| boundary/.test(h.stdout) || !/claim feature/.test(h.stdout) || !/requirement add/.test(h.stdout) || /requirement refinement/.test(h.stdout) || /refinement|RF-/i.test(h.stdout) || !/invariant add/.test(h.stdout) || !/requirement milestone <R-n> <slug>/.test(h.stdout) || /objective (add|milestone|refinement)/.test(h.stdout) || /^\s+spike\b/m.test(h.stdout) || !/brief <skill>/.test(h.stdout) || !/migrate requirements/.test(h.stdout) || !/migrate laws/.test(h.stdout) || !/invariants \| global/.test(h.stdout) || !/^  release \[--tests/m.test(h.stdout)) {
  failed++;
  console.log('✗ --help');
} else console.log('✓ --help');

// brief 的規章節：每個 skill 點名的節都要真的在 rules/ 裡，節改了名這裡會紅
{
  const skills = (/skill[:：]([^\n]+)/.exec(h.stdout) || [null, ''])[1].split('、').map((s) => s.trim()).filter(Boolean);
  let ok = skills.length > 0;
  for (const s of skills) {
    const r = spawnSync(process.execPath, [bin, 'brief', s, '--root', path.join(here, 'fixtures', 'shop')], { encoding: 'utf8' });
    if (r.status !== 0 || !/^brief /.test(r.stdout) || !/^### \S+\.md「/m.test(r.stdout) || /裡沒有「/.test(r.stdout)) ok = false;
  }
  if (!ok) {
    failed++;
    console.log('✗ brief 的規章節');
  } else console.log('✓ brief 的規章節');

  // 規章的字數上限：一個 skill 開工背的規章有上界。超過就是它拿了別人的工作，回 brief.mjs 的 RULES 表把不是它做決定要用的節拿掉，
  // 或把那一節拆成各讀者只拿自己那一塊。每一場 session 都要背一次，所以這個數字是流程的固定成本。
  const RULES_BUDGET = 34000;
  {
    const over = [];
    for (const s of skills) {
      const run = (...extra) => spawnSync(process.execPath, [bin, 'brief', s, ...extra, '--root', path.join(here, 'fixtures', 'shop')], { encoding: 'utf8' }).stdout;
      const n = [...run()].length - [...run('--no-rules')].length;
      if (n > RULES_BUDGET) over.push(`${s} ${n} 字`);
    }
    if (over.length || skills.length === 0) {
      failed++;
      console.log(`✗ 規章的字數上限（每個 skill ${RULES_BUDGET} 字）：${over.join('、') || '一個 skill 都沒查到'}`);
    } else console.log('✓ 規章的字數上限');
  }

  // 交叉引用：規章與 SKILL.md 裡寫成「<檔>.md「<節>」」的每一處，那一節都要真的在那個檔裡。節改了名、搬了家，這裡會紅
  {
    const rulesDir = path.join(here, '..', '..', 'plugins', 'dev-flow', 'rules');
    const skillsDir = path.join(here, '..', '..', 'plugins', 'dev-flow', 'skills');
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
        if (!titles[file]) continue; // 不是規章檔（system.md、CLAUDE.md …），這裡不管
        seen++;
        if (!titles[file].has(sec)) dangling.push(`${label} → ${file}「${sec}」`);
      }
    }
    if (dangling.length || seen === 0) {
      failed++;
      console.log(`✗ 規章的交叉引用：${dangling.join('、') || '一條都沒查到'}`);
    } else console.log('✓ 規章的交叉引用');
  }

  // brief 的分段：skill 載入時一道指令的輸出超過約 30KB 會被存成檔，所以每一段都要在上限以內，而且接起來一個字都不少
  const TARGETS = { build: 'F-001-checkout', qa: 'F-001-checkout', refactor: 'F-002-refund', 'scope-revise': 'F-002-refund', 'scope-laws': 'M-2-refund', 'spike-impl': 'M-1-checkout' };
  let parted = skills.length > 0;
  for (const s of skills) {
    const run = (...extra) => spawnSync(process.execPath, [bin, 'brief', s, ...(TARGETS[s] ? [TARGETS[s]] : []), ...extra, '--root', path.join(here, 'fixtures', 'shop')], { encoding: 'utf8' }).stdout.replace(/\r\n/g, '\n');
    const whole = run().trimEnd();
    const parts = [1, 2, 3, 4].map((k) => run('--part', String(k), '--of', '4').trimEnd());
    if (parts.some((p) => Buffer.byteLength(p) > 29000)) parted = false;
    // 第 2 段起的第一行是「（brief <skill> 第 k 段，接上一段）」，接回去之前拿掉
    const joined = parts.filter(Boolean).map((p) => p.replace(/^.brief \S+ 第 \d+ 段[^\n]*\n\n/, '')).join('\n');
    // 段與段之間的空行在切的時候會掉，比的是非空行
    const solid = (t) => t.split('\n').filter((l) => l.trim()).join('\n');
    if (solid(joined) !== solid(whole)) parted = false;
  }
  if (!parted) {
    failed++;
    console.log('✗ brief 的分段');
  } else console.log('✓ brief 的分段');

  // 每份 SKILL.md:skills/ 底下的資料夾與 brief 的 skill 名單一一對上；frontmatter 的 name 等於資料夾名；
  // description 是單行的純量，裡面不准有「冒號加空白」（YAML 會讀成另一個鍵，整份 frontmatter 壞掉、skill 不會被載入）；
  // 四道注入行寫對；免批准的 allowed-tools 在 frontmatter
  const skillsDir = path.join(here, '..', '..', 'plugins', 'dev-flow', 'skills');
  const dirs = fs.readdirSync(skillsDir).filter((d) => fs.existsSync(path.join(skillsDir, d, 'SKILL.md'))).sort();
  const wrong = [];
  if (dirs.join(',') !== [...skills].sort().join(',')) wrong.push(`skills/ 是 ${dirs.join('、')}；brief 的名單是 ${[...skills].sort().join('、')}`);
  for (const s of dirs) {
    const md = fs.readFileSync(path.join(skillsDir, s, 'SKILL.md'), 'utf8');
    const fm = (/^---\r?\n([\s\S]*?)\r?\n---/.exec(md) || [, ''])[1];
    const desc = (/^description: (.*)$/m.exec(fm) || [, ''])[1];
    if (!new RegExp(`^name: ${s}$`, 'm').test(fm)) wrong.push(`${s}:name 不等於資料夾名`);
    if (!desc || /: /.test(desc) || /^['"[{>|]/.test(desc)) wrong.push(`${s}:description 會讓 frontmatter 讀不成（空的、含「冒號加空白」、或以引號括號開頭）`);
    const lines = md.split(/\r?\n/).filter((l) => l.startsWith('!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief '));
    const want = [1, 2, 3, 4].map((k) => `!\`node "\${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief ${s} --args '$ARGUMENTS' --part ${k} --of 4\``);
    if (lines.join('\n') !== want.join('\n')) wrong.push(`${s}：注入行不是四道 brief ${s} --part 1..4 --of 4`);
    if (!/^allowed-tools: Bash\(node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/devflow\.mjs":\*\)$/m.test(fm)) wrong.push(`${s}:frontmatter 沒有免批准的 allowed-tools`);
  }
  if (wrong.length) {
    failed++;
    console.log('✗ SKILL.md 的 frontmatter 與注入行');
    for (const w of wrong) console.log(`  ${w}`);
  } else console.log('✓ SKILL.md 的 frontmatter 與注入行');
}

// 兩道 migrate 以任何先後接連跑，落地的樹都一樣；跑過的樹再跑一次是「不用換」，status 不再指到 migrate
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
    walk(path.join(root, '.design'));
    return out.join('\n');
  };
  const wrong = [];
  for (const fixture of ['flat', 'goals', 'tuned']) {
    const got = [['laws', 'requirements'], ['requirements', 'laws']].map((order) => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-order-'));
      fs.cpSync(path.join(here, 'fixtures', fixture), tmp, { recursive: true });
      const exits = order.map((sub) => run(tmp, 'migrate', sub, '--write', '--date', DATE).status);
      const again = order.map((sub) => run(tmp, 'migrate', sub).stdout);
      const tree = treeOf(tmp);
      const status = run(tmp, 'status').stdout;
      fs.rmSync(tmp, { recursive: true, force: true });
      return { order, exits, again, tree, status };
    });
    for (const g of got) {
      if (g.exits.some((x) => x !== 0)) wrong.push(`${fixture}:${g.order.join(' → ')} 有一道 exit 不是 0(${g.exits.join('、')})`);
      if (g.tree !== got[0].tree) wrong.push(`${fixture}:${g.order.join(' → ')} 落地的樹與 ${got[0].order.join(' → ')} 不一樣`);
      if (!g.again.every((t) => /這棵樹不用換/.test(t))) wrong.push(`${fixture}:${g.order.join(' → ')} 跑完之後再跑一次，還有東西要換`);
      if (/devflow migrate (laws|requirements)/.test(g.status)) wrong.push(`${fixture}:${g.order.join(' → ')} 跑完之後 status 還指到 migrate`);
      if (!/\n--- \.design\/requirements\/R-1-/.test(`\n${g.tree}`) || /\n--- \.design\/objectives\.md\n/.test(g.tree) || `\n${g.tree}`.split('\n--- ').some((s) => s.startsWith('.design/requirements/') && /\n\| 調整 \|/.test(s))) wrong.push(`${fixture}:${g.order.join(' → ')} 落地的樹沒有 requirements/、還留著 objectives.md、或需求檔還有調整表`);
    }
  }
  if (wrong.length) {
    failed++;
    console.log('✗ migrate 的先後');
    for (const w of wrong) console.log(`  ${w}`);
  } else console.log('✓ migrate 的先後');
}

// 名詞住專案根目錄 CLAUDE.md 的「## 名詞」節：檔案在而沒有這一節，與檔案不存在是同一條警訊；這一節以外寫什麼都不影響讀表
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-glossary-'));
  fs.cpSync(path.join(here, 'fixtures', 'shop'), tmp, { recursive: true });
  const run = (...argv) => spawnSync(process.execPath, [bin, ...argv, '--root', tmp], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '' } }).stdout;
  const file = path.join(tmp, 'CLAUDE.md');
  const WARN = '| CLAUDE.md | 沒有 ## 名詞 節，領域名詞沒有地方定義 | dev-flow:kickoff 補上這一節 |';
  const whole = fs.readFileSync(file, 'utf8');
  const withSection = run('status', '--tests', 'test.log');
  fs.writeFileSync(file, `# shop\n\n## 開發須知\n| 名詞 | 定義 | 型別 |\n|---|---|---|\n| 不是名詞表 | 這張表不住「## 名詞」節 | \`Nope\` |\n\n${whole.replace(/^# shop\r?\n/, '')}\n## 其他\n開發者自己寫的東西。\n`);
  const surrounded = run('status', '--json', '--tests', 'test.log');
  const lint = run('lint', 'laws');
  fs.writeFileSync(file, '# shop\n\n開發者自己寫的東西，沒有名詞節。\n');
  const noSection = run('status', '--tests', 'test.log');
  fs.rmSync(file);
  const noFile = run('status', '--tests', 'test.log');
  fs.rmSync(tmp, { recursive: true, force: true });
  const ok = !withSection.includes(WARN) && noSection.includes(WARN) && noFile.includes(WARN)
    && /"term": "結算金額"/.test(surrounded) && !/不是名詞表/.test(surrounded) && /## lint laws[:：]通過/.test(lint);
  if (!ok) {
    failed++;
    console.log('✗ CLAUDE.md 的名詞節');
  } else console.log('✓ CLAUDE.md 的名詞節');
}

// --html：一個自帶資料的單檔網頁，佔位符要被換掉、資料要灌得進去。檔太大不收 golden，只檢查這幾件事
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-html-'));
  const out = path.join(tmp, 'board.html');
  const r = spawnSync(process.execPath, [bin, 'status', '--html', out, '--tests', 'test.log', '--root', path.join(here, 'fixtures', 'shop')], { encoding: 'utf8' });
  const html = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const data = /<script id="data" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  // exit code 帶的是報告判定（有沒有全部達成），不是寫檔成敗；寫成功了就一定讀得到資料區塊。
  // 資料區塊裡一個生的 < 都不該有：全部逃成 <，文檔寫了什麼都關不掉這個標籤
  const ok = !html.includes('__STATUS_JSON__') && !!data
    && /"tool": "devflow"/.test(data[1]) && /F-001-checkout/.test(data[1]) && !data[1].includes('<')
    && /^file:\/\/\/.*board\.html$/m.test(r.stdout)
    && r.stdout.includes('# devflow status');   // --html 是額外產出，報告照印
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!ok) {
    failed++;
    console.log('✗ status --html');
  } else console.log('✓ status --html');
}

// --html 不給檔名：寫進暫存區的 devflow-board/，專案資料夾裡一個字都不留
{
  const fixtureDir = path.join(here, 'fixtures', 'shop');
  const before = new Set(fs.readdirSync(fixtureDir));
  const r = spawnSync(process.execPath, [bin, 'status', '--html', '--root', fixtureDir], { encoding: 'utf8' });
  const m = /^(file:\/\/\/.*)$/m.exec(r.stdout);
  const after = new Set(fs.readdirSync(fixtureDir));
  const wrote = m ? fileURLToPath(m[1]) : '';
  const ok = !!m && /devflow-board/.test(wrote) && fs.existsSync(wrote)
    && [...after].every((n) => before.has(n));
  if (!ok) {
    failed++;
    console.log('✗ status --html 沒給檔名');
  } else console.log('✓ status --html 沒給檔名');
}

// 合進主線的 build 分支是殘留，不是有人在建：不算建構中，改列成警訊。真的開一個 repo 來問 git
{
  const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
  if (!hasGit) console.log('· 沒有 git，跳過殘留 build 分支的檢查');
  else {
    const { branchState } = await import('../../plugins/dev-flow/lib/commands/status.mjs');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'branch-'));
    const git = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: tmp, encoding: 'utf8' });
    fs.cpSync(path.join(here, 'fixtures', 'shop'), tmp, { recursive: true });
    git('init', '-b', 'main');
    git('add', '-A');
    git('commit', '-m', 'base');
    git('switch', '-c', 'build/F-001-checkout');
    fs.writeFileSync(path.join(tmp, 'done.txt'), 'done');
    git('add', '-A');
    git('commit', '-m', 'done');
    git('switch', 'main');
    git('merge', '--no-ff', 'build/F-001-checkout', '-m', 'merge');
    git('switch', '-c', 'build/F-002-refund');
    fs.writeFileSync(path.join(tmp, 'wip.txt'), 'wip');
    git('add', '-A');
    git('commit', '-m', 'wip');
    git('switch', 'main');
    const s = branchState(tmp);
    const r = spawnSync(process.execPath, [bin, 'status', '--root', tmp], { encoding: 'utf8' });
    const ok = !s.building.has('F-001-checkout') && s.stale.has('F-001-checkout')
      && s.building.has('F-002-refund') && !s.stale.has('F-002-refund')
      && r.stdout.includes('| build/F-001-checkout | 已合進主線卻還在 |')
      && !r.stdout.includes('| build/F-002-refund | 已合進主線卻還在 |');
    fs.rmSync(tmp, { recursive: true, force: true });
    if (!ok) {
      failed++;
      console.log('✗ 殘留的 build 分支');
    } else console.log('✓ 殘留的 build 分支');
  }
}

// 切片：里程碑的 build 分支住自己的工作樹。status 從那棵樹讀它走到哪一步；claim 配號看得到別棵樹上 claim 走的號
{
  const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
  if (!hasGit) console.log('· 沒有 git，跳過切片工作樹的檢查');
  else {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'slice-'));
    const main = path.join(base, 'repo');
    const tree = path.join(base, 'repo.worktrees', 'M-4-ship');
    const git = (cwd, ...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, encoding: 'utf8' });
    const devflow = (cwd, ...a) => spawnSync(process.execPath, [bin, ...a, '--root', cwd], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '' } });
    fs.cpSync(path.join(here, 'fixtures', 'shop'), main, { recursive: true });
    devflow(main, 'requirement', 'milestone', 'R-1', 'ship', '出貨走通');
    git(main, 'init', '-b', 'main');
    git(main, 'add', '-A');
    git(main, 'commit', '-m', 'base');
    const before = devflow(main, 'status', '--tests', 'test.log').stdout;
    git(main, 'worktree', 'add', '-b', 'build/M-4-ship', tree, 'HEAD');
    const opened = devflow(main, 'status', '--tests', 'test.log').stdout;
    fs.mkdirSync(path.join(tree, '.design', 'journal'), { recursive: true });
    fs.writeFileSync(path.join(tree, '.design', 'journal', 'M-4-ship.md'), '---\nkey: M-4-ship\nbranch: build/M-4-ship\nverdict: feasible\n---\n# 開發日誌：M-4-ship\n');
    const sliced = devflow(main, 'status', '--tests', 'test.log').stdout;
    const claimed = devflow(tree, 'claim', 'feature', 'ship', '--milestone', 'M-4-ship', '--date', DATE).stdout;
    const talking = devflow(main, 'status', '--tests', 'test.log').stdout;
    const other = devflow(main, 'claim', 'feature', 'wishlist', '--date', DATE).stdout;
    const ok = before.includes('- M-4-ship：dev-flow:spike-impl M-4-ship（R-1 優先 1 · 出貨走通）')
      && opened.includes('- M-4-ship：建構中，分支 build/M-4-ship；切片中') && !opened.includes('| build/M-4-ship | 已合進主線卻還在 |')
      && sliced.includes('- M-4-ship：建構中，分支 build/M-4-ship；切片完成，等 dev-flow:scope-laws')
      && claimed.includes('F-003-ship') && claimed.includes('綁進 M-4-ship') && talking.includes('build/M-4-ship；Law 討論中')
      && other.includes('F-004-wishlist');
    git(main, 'worktree', 'remove', '--force', tree);
    fs.rmSync(base, { recursive: true, force: true });
    if (!ok) {
      failed++;
      console.log('✗ 切片的工作樹');
      console.log([before, opened, sliced, claimed, talking, other].map((t) => t.split('\n').filter((l) => /M-4-ship|F-00[34]/.test(l)).join('\n')).join('\n---\n'));
    } else console.log('✓ 切片的工作樹');
  }
}

// 專案的第一條切片單獨走完：全域 Law 三區都還是空的、而且已經有一條切片的分支在建構中，別條需求的切片不列成能開的線，改印那一句；
// 全域 Law 區有了東西（這裡立一條領域不變量）就照常列
{
  const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
  if (!hasGit) console.log('· 沒有 git，跳過第一條切片的檢查');
  else {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'first-'));
    const main = path.join(base, 'repo');
    const tree = path.join(base, 'repo.worktrees', 'M-1-login');
    const git = (cwd, ...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, encoding: 'utf8' });
    const devflow = (cwd, ...a) => spawnSync(process.execPath, [bin, ...a, '--root', cwd], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '' } });
    fs.cpSync(path.join(here, 'fixtures', 'blank'), main, { recursive: true });
    devflow(main, 'requirement', 'add', 'login-sees-own', '使用者登入後看得到自己的東西', '--priority', '1', '--accept', '任一使用者登入後列出的東西都是自己的', '--date', DATE);
    devflow(main, 'requirement', 'add', 'export-own', '使用者匯出自己的東西', '--priority', '2', '--accept', '匯出的檔案裡只有自己的東西', '--date', DATE);
    devflow(main, 'requirement', 'milestone', 'R-1', 'login', '登入走通');
    devflow(main, 'requirement', 'milestone', 'R-2', 'export', '匯出走通');
    git(main, 'init', '-b', 'main');
    git(main, 'add', '-A');
    git(main, 'commit', '-m', 'base');
    const before = devflow(main, 'status').stdout;
    git(main, 'worktree', 'add', '-b', 'build/M-1-login', tree, 'HEAD');
    const opened = devflow(main, 'status').stdout;
    devflow(main, 'invariant', 'add', '任何人只看得到自己的東西');
    const released = devflow(main, 'status').stdout;
    const NOTE = '專案的第一條切片單獨走完：build/M-1-login 抽出全域 Law 並合進主線之後才開下一條（等著的：M-2-export）';
    const LINE = '- M-2-export：dev-flow:spike-impl M-2-export（';
    const ok = before.includes('- M-1-login：dev-flow:spike-impl M-1-login（') && before.includes(LINE) && !before.includes('專案的第一條切片單獨走完')
      && opened.includes('- M-1-login：建構中，分支 build/M-1-login') && !opened.includes(LINE) && !opened.includes('dev-flow:spike-impl M-2-export（') && opened.includes(`- ${NOTE}`) && new RegExp(`^\\d+\\. ${NOTE.replace(/[()]/g, '\\$&')}$`, 'm').test(opened)
      && released.includes(LINE) && !released.includes('專案的第一條切片單獨走完');
    git(main, 'worktree', 'remove', '--force', tree);
    fs.rmSync(base, { recursive: true, force: true });
    if (!ok) {
      failed++;
      console.log('✗ 第一條切片單獨走完');
      console.log([before, opened, released].map((t) => t.split('\n').filter((l) => /M-[12]-|第一條切片/.test(l)).join('\n')).join('\n---\n'));
    } else console.log('✓ 第一條切片單獨走完');
  }
}

// 層表還沒有列的樹（層還沒從第一條切片抽上去）：lint boundary 印一行說明而不紅；lint sig 不拿層欄對層表與模組表；
// lint laws 讓 law 引用程式碼裡任何一個匯出。層表一有列，模組表的層欄空著就照常紅
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-nolayers-'));
  fs.cpSync(path.join(here, 'fixtures', 'shop'), tmp, { recursive: true });
  const run = (...argv) => spawnSync(process.execPath, [bin, ...argv, '--root', tmp], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '' } });
  const sysFile = path.join(tmp, '.design', 'system.md');
  const modFile = path.join(tmp, '.design', 'modules.md');
  const sysText = fs.readFileSync(sysFile, 'utf8');
  fs.writeFileSync(modFile, fs.readFileSync(modFile, 'utf8').replace(/^(\| `src\/[^|]*\|)[^|\r\n]*\|/gm, '$1  |'));
  const withLayers = run('lint', 'boundary');
  fs.writeFileSync(sysFile, sysText.replace(/^\| (?:domain|application|entry) \|.*\r?\n/gm, ''));
  const boundary = run('lint', 'boundary');
  const sig = run('lint', 'sig');
  const laws = run('lint', 'laws');
  const status = run('status', '--tests', 'test.log');
  fs.rmSync(tmp, { recursive: true, force: true });
  const ok = withLayers.status === 1 && /不在 system\.md 的層表裡/.test(withLayers.stdout)
    && boundary.status === 0 && /「架構[:：]層」表沒有列[,，]沒有依賴方向可對/.test(boundary.stdout)
    && sig.status === 0 && laws.status === 0
    && status.stdout.includes('| 架構 | 全域 Law › 架構：層 | devflow lint boundary | 0 層，通過 |') && !status.stdout.includes('| 全域 Law：架構 |');
  if (!ok) {
    failed++;
    console.log('✗ 層表還沒有列的樹');
    console.log([withLayers, boundary, sig, laws].map((r) => `exit ${r.status}\n${r.stdout.trimEnd()}`).join('\n---\n'));
  } else console.log('✓ 層表還沒有列的樹');
}

// 靠修訂達成的里程碑也可以是 build 分支的鍵：綁的文檔還沒有引用它的 REV 是「待修訂」（不因為文檔本來就 verified 而算做完、也不因為沒有決策紀錄而算切片中），
// 工作樹上寫了引用它的 REV、文檔重開之後照一般的字
{
  const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
  if (!hasGit) console.log('· 沒有 git，跳過靠修訂達成的里程碑的工作樹檢查');
  else {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'revise-'));
    const main = path.join(base, 'repo');
    const tree = path.join(base, 'repo.worktrees', 'M-4-checkout-fast');
    const git = (cwd, ...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, encoding: 'utf8' });
    const devflow = (cwd, ...a) => spawnSync(process.execPath, [bin, ...a, '--root', cwd], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '' } });
    fs.cpSync(path.join(here, 'fixtures', 'shop'), main, { recursive: true });
    devflow(main, 'requirement', 'milestone', 'R-1', 'checkout-fast', '結帳一秒內完成', '--bind', 'F-001-checkout');
    git(main, 'init', '-b', 'main');
    git(main, 'add', '-A');
    git(main, 'commit', '-m', 'base');
    const before = devflow(main, 'status', '--tests', 'test.log').stdout;
    git(main, 'worktree', 'add', '-b', 'build/M-4-checkout-fast', tree, 'HEAD');
    const opened = devflow(main, 'status', '--tests', 'test.log').stdout;
    const doc = path.join(tree, '.design', 'features', 'F-001-checkout.md');
    fs.writeFileSync(doc, `${fs.readFileSync(doc, 'utf8').replace(/^status: verified$/m, 'status: ready').replace(/\s+$/, '')}\n- REV-2（${DATE}，依 M-4-checkout-fast）：結帳一秒內完成，補一條 bound 的 law\n`);
    const revised = devflow(main, 'status', '--tests', 'test.log').stdout;
    const inTree = devflow(tree, 'status', '--tests', 'test.log').stdout;
    const ok = before.includes('- M-4-checkout-fast：dev-flow:scope-revise F-001-checkout（') && before.includes('REV 的依欄寫 M-4-checkout-fast')
      && opened.includes('- M-4-checkout-fast：建構中，分支 build/M-4-checkout-fast；待修訂')
      && revised.includes('- M-4-checkout-fast：建構中，分支 build/M-4-checkout-fast；調整中')
      && !inTree.includes('F-001-checkout 待修訂');
    git(main, 'worktree', 'remove', '--force', tree);
    fs.rmSync(base, { recursive: true, force: true });
    if (!ok) {
      failed++;
      console.log('✗ 靠修訂達成的里程碑的工作樹');
      console.log([before, opened, revised, inTree].map((t) => t.split('\n').filter((l) => /M-4-checkout-fast/.test(l)).join('\n')).join('\n---\n'));
    } else console.log('✓ 靠修訂達成的里程碑的工作樹');
  }
}

// 上線：已驗收的需求，它用到的每份文檔在主線上最新的 commit 都進了同一個發布的 tag。
// 沒有 tag 是未上線（status 第 3 段點名）；打了 tag 是那個 tag；tag 之後又改了那幾個檔，回到未上線；「發布」行的樣式以外的 tag 不算
{
  const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
  if (!hasGit) console.log('· 沒有 git，跳過上線的檢查');
  else {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'release-'));
    const main = path.join(base, 'repo');
    const git = (cwd, ...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, encoding: 'utf8' });
    const devflow = (cwd, ...a) => spawnSync(process.execPath, [bin, ...a, '--root', cwd], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '' } });
    fs.cpSync(path.join(here, 'fixtures', 'shop'), main, { recursive: true });
    const sysFile = path.join(main, '.design', 'system.md');
    fs.writeFileSync(sysFile, fs.readFileSync(sysFile, 'utf8').replace(/^- 號段[:：].*$/m, '$&\n- 發布：`v*`'));
    git(main, 'init', '-b', 'main');
    git(main, 'add', '-A');
    git(main, 'commit', '-m', 'base');
    const ROW = (word) => `| R-1 | 1 | 每一筆結帳與退款的金額都算對 | 已驗收（2026-09-07 dev@example.com） | ${word} |`;
    const untagged = devflow(main, 'status', '--tests', 'test.log').stdout;
    git(main, 'tag', 'rc-1');
    const rcOnly = devflow(main, 'release', '--tests', 'test.log');
    git(main, 'tag', 'v1.0.0');
    const tagged = devflow(main, 'release', '--tests', 'test.log');
    const taggedStatus = devflow(main, 'status', '--tests', 'test.log').stdout;
    const refund = path.join(main, 'src', 'app', 'refund.ts');
    fs.appendFileSync(refund, '\n// 改過\n');
    git(main, 'commit', '-am', 'change refund');
    const changed = devflow(main, 'release', '--tests', 'test.log');
    fs.rmSync(base, { recursive: true, force: true });
    const ok = untagged.includes(ROW('未上線')) && /^- R-1 已驗收而還沒上線[:：]F-001-checkout[(（]最新的 commit [0-9a-f]{7} 還沒進發布的 tag[)）]、F-002-refund/m.test(untagged)
      && rcOnly.status === 0 && rcOnly.stdout.includes('符合 `v*` 的共 0 個') && rcOnly.stdout.includes('| R-1 | 每一筆結帳與退款的金額都算對 | 已驗收 | 未上線 |')
      && tagged.stdout.includes('| R-1 | 每一筆結帳與退款的金額都算對 | 已驗收 | v1.0.0 | - |') && tagged.stdout.includes('- v1.0.0:R-1 每一筆結帳與退款的金額都算對')
      && taggedStatus.includes(ROW('v1.0.0')) && !taggedStatus.includes('已驗收而還沒上線')
      && /\| 已驗收 \| 未上線 \| F-002-refund[(（]最新的 commit [0-9a-f]{7} 還沒進發布的 tag[)）] \|/.test(changed.stdout) && !/F-001-checkout[(（]最新的 commit/.test(changed.stdout);
    if (!ok) {
      failed++;
      console.log('✗ 上線');
      console.log([untagged, rcOnly.stdout, tagged.stdout, taggedStatus, changed.stdout].map((t) => t.split('\n').filter((l) => /R-1|上線|符合|v1\.0\.0/.test(l)).join('\n')).join('\n---\n'));
    } else console.log('✓ 上線');
  }
}

// 建議路線的 draft：照需求的優先排（優先 1 的在優先 2 的前面），而且只有切片在的那幾份推 scope-laws。
// claim 了卻沒有決策紀錄、也沒有分支的那一份，推的是綁它的里程碑的切片（scope-laws 的前置要決策紀錄）
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sliceless-'));
  const templates = path.join(here, '..', '..', 'plugins', 'dev-flow', 'templates');
  const devflow = (...a) => spawnSync(process.execPath, [bin, ...a, '--root', tmp], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '' } });
  fs.mkdirSync(path.join(tmp, '.design', 'journal'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.design', 'system.md'), fs.readFileSync(path.join(templates, 'system.md'), 'utf8').replace(/^language: .*$/m, 'language: typescript').replace(/^- 語言[:：].*$/m, '- 語言：typescript'));
  fs.copyFileSync(path.join(templates, 'modules.md'), path.join(tmp, '.design', 'modules.md'));
  devflow('requirement', 'add', 'late-one', '優先 2 的需求', '--priority', '2', '--accept', '看得到', '--date', DATE);
  devflow('requirement', 'add', 'early-one', '優先 1 的需求', '--priority', '1', '--accept', '看得到', '--date', DATE);
  devflow('requirement', 'milestone', 'R-1', 'late', '優先 2 那條的里程碑');
  devflow('requirement', 'milestone', 'R-2', 'early', '優先 1 那條的里程碑');
  devflow('claim', 'feature', 'late-flow', '--milestone', 'M-1-late', '--date', DATE);
  devflow('claim', 'feature', 'early-flow', '--milestone', 'M-2-early', '--date', DATE);
  const journal = (key) => fs.writeFileSync(path.join(tmp, '.design', 'journal', `${key}.md`), `---\nkey: ${key}\nbranch: build/${key}\nverdict: feasible\nupdated: ${DATE}\n---\n`);
  journal('M-1-late');
  journal('M-2-early');
  const route = () => (devflow('status').stdout.split('## 8. 建議路線')[1] || '');
  const sliced = route();
  fs.rmSync(path.join(tmp, '.design', 'journal', 'M-1-late.md'));
  const sliceless = route();
  const at = (t, s) => t.indexOf(s);
  const ok = at(sliced, 'dev-flow:scope-laws F-002-early-flow') > -1 && at(sliced, 'dev-flow:scope-laws F-001-late-flow') > -1
    && at(sliced, 'dev-flow:scope-laws F-002-early-flow') < at(sliced, 'dev-flow:scope-laws F-001-late-flow')
    && sliceless.includes('dev-flow:scope-laws F-002-early-flow')
    && !sliceless.includes('dev-flow:scope-laws F-001-late-flow')
    && /dev-flow:spike-impl M-1-late/.test(sliceless);
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!ok) {
    failed++;
    console.log('✗ 建議路線的 draft');
    console.log([sliced, sliceless].join('---'));
  } else console.log('✓ 建議路線的 draft');
}

// 文檔寫全形標點與寫半形標點讀出同一棵樹：夾具的 .design/ 與根目錄 CLAUDE.md 裡貼著中文的 , : ; ( ) 換成全形之後，
// status、lint 與 brief 的輸出（全形換回半形再比）與原樹逐字相同。反引號裡的程式碼、frontmatter、圍欄裡的不換。
{
  const HALF_TO_FULL = { ',': '，', ':': '：', ';': '；', '(': '（', ')': '）' };
  const FULL_TO_HALF = Object.fromEntries(Object.entries(HALF_TO_FULL).map(([h, f]) => [f, h]));
  const CJK = /[㐀-鿿「」、。，：；（）]/;
  const toFull = (text) => {
    let fm = false;
    let fence = false;
    return text.split('\n').map((line, i) => {
      if (i === 0 && line.trim() === '---') { fm = true; return line; }
      if (fm) { if (line.trim() === '---') fm = false; return line; }
      if (/^\s*```/.test(line)) { fence = !fence; return line; }
      if (fence) return line;
      return line.split(/(`[^`]*`)/).map((part) => {
        if (part.startsWith('`')) return part;
        const a = [...part];
        const b = [];
        a.forEach((c, k) => {
          // 括號看裡面有沒有中文；其餘看左邊（已經換過的）或右邊有沒有貼著中文
          if (c === '(') { const j = a.indexOf(')', k); b.push(j > 0 && a.slice(k, j).some((x) => CJK.test(x)) ? HALF_TO_FULL[c] : c); }
          else if (c === ')') { const j = a.lastIndexOf('(', k); b.push(j >= 0 && a.slice(j, k).some((x) => CJK.test(x)) ? HALF_TO_FULL[c] : c); }
          else if (HALF_TO_FULL[c]) b.push(CJK.test(b[k - 1] || '') || CJK.test(a[k + 1] || '') ? HALF_TO_FULL[c] : c);
          else b.push(c);
        });
        return b.join('');
      }).join('');
    }).join('\n');
  };
  const mdFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? mdFiles(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : [])) : []);
  const runs = [
    ['shop', ['status', '--tests', 'test.log']],
    ['shop', ['lint', 'all']],
    ['shop', ['brief', 'build', 'F-001-checkout', '--tests', 'test.log', '--no-rules']],
    ['team', ['status']],
    ['team', ['lint', 'ids']],
    ['shaky', ['status', '--tests', 'stale.log']],
    ['shaky', ['lint', 'all']],
  ];
  const bad = [];
  let converted = '';
  for (const [fixture, argv] of runs) {
    const outs = [];
    for (const full of [false, true]) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-fullwidth-'));
      fs.cpSync(path.join(here, 'fixtures', fixture), tmp, { recursive: true });
      if (full) {
        for (const f of [...mdFiles(path.join(tmp, '.design')), path.join(tmp, 'CLAUDE.md')].filter((f) => fs.existsSync(f))) {
          const text = toFull(fs.readFileSync(f, 'utf8'));
          fs.writeFileSync(f, text);
          converted += text;
        }
      }
      const r = spawnSync(process.execPath, [bin, ...argv, '--root', tmp], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_EMAIL: '' } });
      fs.rmSync(tmp, { recursive: true, force: true });
      outs.push(`${(r.stdout + r.stderr).split(tmp).join('<root>').split(tmp.replace(/\\/g, '/')).join('<root>').replace(/\r\n/g, '\n')
        .replace(/[，：；（）]/g, (c) => FULL_TO_HALF[c]).replace(/^(- \S+)  (?:比每一個原始碼與測試檔都新|比 \S+ 舊[:：].*)$/gm, '$1')
        .replace(/ @doc:[0-9a-f]+/g, ' @doc:<文檔雜湊>')}\nexit ${r.status}`);
    }
    if (outs[0] !== outs[1]) {
      const a = outs[0].split('\n');
      const b = outs[1].split('\n');
      const i = a.findIndex((l, k) => l !== b[k]);
      bad.push(`${fixture} devflow ${argv.join(' ')}：第 ${i + 1} 行\n  半形：${a[i]}\n  全形：${b[i]}`);
    }
  }
  // 換過的文檔真的碰到了腳本要解析的欄位，這道測試才有意義
  const touched = ['- 驗收：', '- 建置：', '- 測試（整套）：', '### 架構：層', '### 契約：對外 I/O', '（見 F-001-checkout）', '- 號段：'].filter((s) => !converted.includes(s));
  if (bad.length || touched.length) {
    failed++;
    console.log('✗ 全形標點的文檔');
    for (const b of bad) console.log(b);
    if (touched.length) console.log(`換成全形之後找不到：${touched.join('、')}`);
  } else console.log('✓ 全形標點的文檔');
}

// 看板的頁面兩個 plugin 共用同一份，逐位元組相同；改了一邊就要複製到另一邊
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
