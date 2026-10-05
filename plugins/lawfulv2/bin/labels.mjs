#!/usr/bin/env node
// lawfulv2 的標籤表：把一個 GitHub repo 的標籤對到固定的九個（名稱、顏色、說明）。
// 不加 --apply 只印計畫；標籤表以外的標籤不動，除非用 --delete 點名。
//
// node labels.mjs [--repo <OWNER/REPO>] [--delete <標籤>]... [--apply]
import { spawnSync } from 'node:child_process';

// 說明欄就是「用在」：GitHub 的標籤清單與選單會顯示它。
const LABELS = [
  { name: 'feature', color: 'a2eeef', description: '新增的能力或 API' },
  { name: 'bug', color: 'd73a4a', description: '修正壞掉的行為' },
  { name: 'refactor', color: 'fbca04', description: '不改行為的重構、搬家、改名' },
  { name: 'docs', color: '0075ca', description: '只動文件、ADR、計畫或設計稿' },
  { name: 'test', color: '0e8a16', description: '只動測試或驗證' },
  { name: 'chore', color: 'c5def5', description: '建置、CI、腳本、依賴、工具設定' },
  { name: 'decision', color: 'd876e3', description: '待決題（只用在 issue）' },
  { name: 'duplicate', color: 'cfd3d7', description: '關 issue 時用：重複' },
  { name: 'wontfix', color: 'ffffff', description: '關 issue 時用：不處理' },
];

// GitHub 替每個新 repo 建的標籤裡，意思與標籤表某一個相同的：改名，issue 與 PR 上的標籤跟著走。
const RENAMES = { enhancement: 'feature', documentation: 'docs' };

function usage(msg) {
  if (msg) console.error(`labels: ${msg}`);
  console.error(
    '用法：node labels.mjs [--repo <OWNER/REPO>] [--delete <標籤>]... [--apply]\n' +
      '  --repo    要設標籤的 repo，預設是目前目錄的 repo\n' +
      '  --delete  刪掉一個標籤表以外的標籤（它會從所有 issue 與 PR 上消失），可以寫多次\n' +
      '  --apply   真的動 GitHub；不加只印計畫\n' +
      '標籤表：\n' +
      LABELS.map((l) => `  ${l.name.padEnd(10)}${l.description}`).join('\n'),
  );
  process.exit(2);
}

function parseArgs(argv) {
  const out = { apply: false, delete: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--help' || a === '-h') usage();
    else if (a === '--repo' || a === '--delete') {
      const v = argv[++i];
      if (v === undefined) usage(`${a} 少了值`);
      if (a === '--repo') out.repo = v;
      else out.delete.push(v);
    } else usage(`不認得的參數 ${a}`);
  }
  return out;
}

// 測試把 LAWFULV2_GH 指到一支 .mjs 當假的 gh；平常就是 PATH 上的 gh。
function gh(args) {
  const fake = process.env.LAWFULV2_GH;
  const r = fake
    ? spawnSync(process.execPath, [fake, ...args], { encoding: 'utf8' })
    : spawnSync('gh', args, { encoding: 'utf8' });
  if (r.error) return { ok: false, out: '', err: `gh 跑不起來（${r.error.code ?? r.error.message}）` };
  return { ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim() };
}

function stop(what, r, note) {
  console.error(`labels: ${what}失敗`);
  if (r.err) console.error(r.err.replace(/^/gm, '  '));
  if (note) console.error(note);
  process.exit(1);
}

const key = (s) => s.toLowerCase();

function plan(existing, deletes) {
  const byKey = new Map(existing.map((l) => [key(l.name), l]));
  const used = new Set();
  const out = { create: [], rename: [], edit: [], same: [], remove: [], extra: [] };
  for (const want of LABELS) {
    const have = byKey.get(key(want.name));
    if (have) {
      used.add(key(have.name));
      const same =
        have.name === want.name && key(have.color) === want.color && (have.description ?? '') === want.description;
      (same ? out.same : out.edit).push({ from: have.name, want });
      continue;
    }
    const source = Object.keys(RENAMES).find((k) => RENAMES[k] === want.name && byKey.has(k));
    if (source) {
      used.add(source);
      out.rename.push({ from: byKey.get(source).name, want });
    } else out.create.push({ want });
  }
  const dropping = new Map(deletes.map((d) => [key(d), d]));
  for (const have of existing) {
    if (used.has(key(have.name))) continue;
    if (dropping.delete(key(have.name))) out.remove.push(have.name);
    else out.extra.push(have.name);
  }
  for (const d of dropping.values()) {
    let why = 'repo 沒有這個標籤';
    if (LABELS.some((l) => key(l.name) === key(d))) why = '它在標籤表裡，不刪';
    else if (used.has(key(d))) why = `它會改名成 ${RENAMES[key(d)]}，不刪`;
    console.error(`labels: --delete ${d}：${why}`);
    process.exit(2);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const at = args.repo ? ['--repo', args.repo] : [];

  const view = gh(['repo', 'view', ...(args.repo ? [args.repo] : []), '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  if (!view.ok) stop('讀 repo ', view);
  const list = gh(['label', 'list', ...at, '--json', 'name,color,description', '--limit', '1000']);
  if (!list.ok) stop('讀標籤', list);
  const p = plan(JSON.parse(list.out || '[]'), args.delete);

  const did = args.apply ? '' : '會';
  const steps = [
    ...p.rename.map(({ from, want }) => ({
      what: `改名 ${from}`,
      argv: ['label', 'edit', from, ...at, '--name', want.name, '--color', want.color, '--description', want.description],
    })),
    ...p.edit.map(({ from, want }) => ({
      what: `改 ${from}`,
      argv: [
        'label', 'edit', from, ...at,
        ...(from === want.name ? [] : ['--name', want.name]),
        '--color', want.color, '--description', want.description,
      ],
    })),
    ...p.create.map(({ want }) => ({
      what: `建 ${want.name}`,
      argv: ['label', 'create', want.name, ...at, '--color', want.color, '--description', want.description],
    })),
    ...p.remove.map((name) => ({ what: `刪 ${name}`, argv: ['label', 'delete', name, ...at, '--yes'] })),
  ];
  if (args.apply) {
    for (const [i, s] of steps.entries()) {
      const r = gh(s.argv);
      if (!r.ok) stop(`${s.what} `, r, `前面 ${i} 道已經做完；修好之後重跑，做完的不會重做`);
    }
  }

  console.log(`# repo：${view.out}`);
  console.log(`# ${did}建（${p.create.length}）`);
  for (const { want } of p.create) console.log(`  ${want.name}  ${want.description}`);
  console.log(`# ${did}改名（${p.rename.length}）`);
  for (const { from, want } of p.rename) console.log(`  ${from} → ${want.name}  ${want.description}`);
  console.log(`# ${did}改顏色或說明（${p.edit.length}）`);
  for (const { from, want } of p.edit) console.log(`  ${from === want.name ? from : `${from} → ${want.name}`}  ${want.description}`);
  console.log(`# ${did}刪（${p.remove.length}）`);
  for (const name of p.remove) console.log(`  ${name}`);
  console.log(`# 已經一致、沒動（${p.same.length}）`);
  for (const { want } of p.same) console.log(`  ${want.name}`);
  console.log(`# 不在標籤表、沒動（${p.extra.length}）`);
  for (const name of p.extra) console.log(`  ${name}`);
  if (!args.apply && steps.length > 0) {
    console.log('# 接下來');
    console.log('  加 --apply 才會動 GitHub');
  }
}

main();
