#!/usr/bin/env node
// rigid 的鋪框架：把型錄一格的 templates/ 渲染進目標目錄、複製 scripts/、寫 scripts/_layout.py。
// 已經存在的檔一律不覆蓋，逐一列出，由 rigid:scaffold 跟架構師一個一個對。
//
// node scaffold.mjs --target <目錄> --package <套件名> --project <專案名> --tagline "<一句話>" --owner <GitHub 帳號>
//                   [--catalog py-ports-adapters] [--date YYYY-MM-DD] [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogRoot = path.join(here, '..', 'catalog');

function usage(msg) {
  if (msg) console.error(`scaffold: ${msg}`);
  console.error(
    '用法：node scaffold.mjs --target <目錄> --package <套件名> --project <專案名> --tagline "<一句話>" --owner <GitHub 帳號>\n' +
      '      [--catalog py-ports-adapters] [--date YYYY-MM-DD] [--dry-run]\n' +
      '  --package  src/<套件名>/，小寫字母、數字、底線，字母開頭\n' +
      '  --project  pyproject 的 name 與 cli 指令名，小寫字母、數字、連字號，字母開頭\n' +
      '  --tagline  README 第一段、pyproject 的 description\n' +
      '  --owner    CODEOWNERS 的帳號，不含 @\n' +
      '  --date     ADR 的日期，預設今天\n' +
      '  --dry-run  只列出會建哪些檔、跳過哪些檔，不寫',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const out = { catalog: 'py-ports-adapters', dryRun: false };
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
  for (const k of ['target', 'package', 'project', 'tagline', 'owner']) if (!out[k]) usage(`少了 --${k}`);
  if (!/^[a-z][a-z0-9_]*$/.test(out.package)) usage('--package 只能是小寫字母、數字、底線，字母開頭');
  if (!/^[a-z][a-z0-9-]*$/.test(out.project)) usage('--project 只能是小寫字母、數字、連字號，字母開頭');
  if (!/^[A-Za-z0-9-]+$/.test(out.owner)) usage('--owner 是 GitHub 帳號，不含 @');
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
    .replaceAll('__PACKAGE__', vars.package)
    .replaceAll('__PROJECT__', vars.project)
    .replaceAll('__TAGLINE__', vars.tagline)
    .replaceAll('__OWNER__', vars.owner)
    .replaceAll('<YYYY-MM-DD>', vars.date);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cell = path.join(catalogRoot, args.catalog);
  const templates = path.join(cell, 'templates');
  const scripts = path.join(cell, 'scripts');
  if (!fs.existsSync(templates) || !fs.existsSync(scripts)) usage(`型錄沒有 ${args.catalog} 這一格`);
  const target = path.resolve(args.target);

  const plan = [];
  for (const src of walk(templates)) {
    const rel = path.relative(templates, src).split(path.sep).join('/').replaceAll('__PACKAGE__', args.package);
    plan.push({ rel, content: render(fs.readFileSync(src, 'utf8'), args) });
  }
  for (const src of walk(scripts)) {
    const name = path.basename(src);
    if (name.endsWith('.pyc') || src.includes('__pycache__')) continue;
    let content = fs.readFileSync(src, 'utf8');
    if (name === '_layout.py') content = content.replace(/^PACKAGE = ".*"$/m, `PACKAGE = "${args.package}"`);
    plan.push({ rel: `scripts/${name}`, content });
  }

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

  console.log(`# ${args.dryRun ? '會建' : '建了'}（${created.length}）`);
  for (const r of created) console.log(`  ${r}`);
  console.log(`# 已存在、沒動（${skipped.length}）`);
  for (const r of skipped) console.log(`  ${r}`);
  if (!args.dryRun) {
    console.log('# 接下來');
    console.log(`  cd ${args.target} && make sync && make check && make test`);
    console.log('  docs/adr/ADR-001 與 ADR-002 的「背景」還是佔位符，架構師填');
    console.log('  已存在、沒動的檔：逐一比對模板，該併的段落手動併進去');
  }
}

main();
