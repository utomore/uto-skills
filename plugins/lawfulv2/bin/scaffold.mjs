#!/usr/bin/env node
// lawfulv2 的鋪檔：把文件層（plugin 的 templates/）渲染進目標目錄；選了型錄的一格，再加上那一格的
// templates/ 與 scripts/，並寫 scripts/_layout.py。同一個路徑兩邊都有時用型錄那一格的。
// 已經存在的檔一律不覆蓋，逐一列出，由 lawfulv2:kickoff 跟使用者一個一個對。
//
// node scaffold.mjs --target <目錄> --project <專案名> --tagline "<一句話>"
//                   [--catalog <格> --package <套件名> --owner <帳號>] [--date YYYY-MM-DD] [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const baseTemplates = path.join(here, '..', 'templates');
const catalogRoot = path.join(here, '..', 'catalog');

function usage(msg) {
  if (msg) console.error(`scaffold: ${msg}`);
  console.error(
    '用法：node scaffold.mjs --target <目錄> --project <專案名> --tagline "<一句話>"\n' +
      '      [--catalog <格> --package <套件名> --owner <帳號>] [--date YYYY-MM-DD] [--dry-run]\n' +
      '  --project  專案名，小寫字母、數字、連字號，字母開頭\n' +
      '  --tagline  README 的第一句\n' +
      '  --catalog  型錄的一格（例 py-ports-adapters）；不給就只鋪文件層\n' +
      '  --package  選了型錄的一格才要：src/<套件名>/，小寫字母、數字、底線，字母開頭\n' +
      '  --owner    選了型錄的一格才要：CODEOWNERS 的帳號，不含 @\n' +
      '  --date     ADR 的日期，預設今天\n' +
      '  --dry-run  只列出會建哪些檔、跳過哪些檔，不寫',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') usage();
    else if (a.startsWith('--')) {
      const v = argv[++i];
      if (v === undefined) usage(`${a} 少了值`);
      out[a.slice(2)] = v;
    } else usage(`不認得的參數 ${a}`);
  }
  for (const k of ['target', 'project', 'tagline']) if (!out[k]) usage(`少了 --${k}`);
  if (!/^[a-z][a-z0-9-]*$/.test(out.project)) usage('--project 只能是小寫字母、數字、連字號，字母開頭');
  if (out.catalog) {
    for (const k of ['package', 'owner']) if (!out[k]) usage(`選了 --catalog 就要給 --${k}`);
    if (!/^[a-z][a-z0-9_]*$/.test(out.package)) usage('--package 只能是小寫字母、數字、底線，字母開頭');
    if (!/^[A-Za-z0-9-]+$/.test(out.owner)) usage('--owner 是帳號，不含 @');
  } else {
    for (const k of ['package', 'owner']) if (out[k]) usage(`--${k} 是型錄的一格才用得到的，要先給 --catalog`);
  }
  if (out.date && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) usage('--date 要是 YYYY-MM-DD');
  if (!out.date) out.date = new Date().toISOString().slice(0, 10);
  return out;
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out.sort();
}

function render(text, vars) {
  return text
    .replaceAll('__PACKAGE__', vars.package ?? '')
    .replaceAll('__PROJECT__', vars.project)
    .replaceAll('__TAGLINE__', vars.tagline)
    .replaceAll('__OWNER__', vars.owner ?? '')
    .replaceAll('<YYYY-MM-DD>', vars.date);
}

function rendered(templates, args) {
  return walk(templates).map((src) => ({
    rel: path.relative(templates, src).split(path.sep).join('/').replaceAll('__PACKAGE__', args.package ?? ''),
    content: render(fs.readFileSync(src, 'utf8'), args),
  }));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = path.resolve(args.target);

  const plan = [];
  if (args.catalog) {
    const cell = path.join(catalogRoot, args.catalog);
    const templates = path.join(cell, 'templates');
    const scripts = path.join(cell, 'scripts');
    if (!fs.existsSync(templates) || !fs.existsSync(scripts)) usage(`型錄沒有 ${args.catalog} 這一格`);
    plan.push(...rendered(templates, args));
    for (const src of walk(scripts)) {
      if (path.relative(scripts, src).includes(path.sep)) continue;
      const name = path.basename(src);
      let content = fs.readFileSync(src, 'utf8');
      if (name === '_layout.py') content = content.replace(/^PACKAGE = ".*"$/m, `PACKAGE = "${args.package}"`);
      plan.push({ rel: `scripts/${name}`, content });
    }
  }
  const fromCell = new Set(plan.map((p) => p.rel));
  plan.push(...rendered(baseTemplates, args).filter((p) => !fromCell.has(p.rel)));
  plan.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const created = [];
  const skipped = [];
  for (const { rel, content } of plan) {
    const dest = path.join(target, ...rel.split('/'));
    if (fs.existsSync(dest)) {
      skipped.push(rel);
      continue;
    }
    if (!args.dryRun) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content, 'utf8');
    }
    created.push(rel);
  }

  console.log(`# ${args.catalog ? `文件層加型錄的 ${args.catalog}` : '只有文件層'}`);
  console.log(`# ${args.dryRun ? '會建' : '建了'}（${created.length}）`);
  for (const r of created) console.log(`  ${r}`);
  console.log(`# 已存在、沒動（${skipped.length}）`);
  for (const r of skipped) console.log(`  ${r}`);
  if (!args.dryRun) {
    console.log('# 接下來');
    console.log('  檔案裡 <…> 的地方還是佔位符：照跟使用者談定的內容填，沒談到的回去問');
    if (args.catalog) console.log(`  cd ${args.target} && make sync && make check && make test`);
    console.log('  已存在、沒動的檔：逐一比對模板，該併的段落跟使用者確認之後手動併進去');
  }
}

main();
