// migrate:盤點 subsystems/ 體系的 .design,印一份帳本,不改任何檔。
//
// 舊樹的一份 F / E / G-F 對應新樹的一份 feature 或(被兩份以上共用時)一份 abstract,
// 但「哪幾份該合成一條 feature」「哪一段該抽成 abstract」是判斷,不是查表:帳本只把
// 判斷需要的材料攤開——介面在程式碼裡對到幾條、四格 law 翻成三行的草稿、誰跟誰共用簽名。
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, sections, findSection, parseTable, parseList, stripTicks } from '../markdown.mjs';
import { parseSignature, renderSignature } from '../design.mjs';
import { readSource, findSignature } from '../source.mjs';
import { pickAdapter, adapterNames } from '../adapters/index.mjs';

function walkDocs(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'archive') continue;
      walkDocs(p, out);
    } else if (ent.name.endsWith('.md')) out.push(p);
  }
}

// 舊的四格 law:量詞 / 定義域 / 前提 / 觀察點。翻得成三行就翻,翻不成標「需形式化」。
function draftLaw(item) {
  const get = (k) => {
    const c = item.children.find((x) => x.startsWith(k));
    return c ? c.slice(k.length).replace(/^[::]\s*/, '').trim() : '';
  };
  const head = /^(LAW-\d+)\s*[::]?\s*(.*)$/.exec(item.text) || [null, 'LAW-?', item.text];
  const quant = get('量詞');
  const domain = get('定義域');
  const pre = get('前提');
  const obs = get('觀察點');
  const vars = [...quant.matchAll(/[對所有 ]*([a-z]\w*)/g)].map((m) => m[1]).filter((v) => v.length <= 3);
  const dom = /([A-Z]\w*)/.exec(domain);
  const ascii = (s) => /^[\x20-\x7e]*$/.test(s) && /[(=<>]/.test(s);
  const lines = [`- ${head[1]} [<種類>] ${head[2]}`];
  lines.push(`  - forall ${vars.length && dom ? vars.map((v) => `${v} in ${dom[1]}`).join(', ') : `<變數> in <型別>`}`);
  if (pre) lines.push(`  - given ${ascii(pre) ? pre : `<需形式化:${pre}>`}`);
  lines.push(`  - |- ${ascii(obs) ? obs : `<需形式化:${obs}>`}`);
  return { text: lines.join('\n'), needsWork: !(ascii(obs) && dom && vars.length) };
}

function readOld(file, root) {
  const text = fs.readFileSync(file, 'utf8');
  const { fm, body } = parseFrontmatter(text);
  const secs = sections(body);
  const rel = path.relative(root, file).split(path.sep).join('/');
  const parts = rel.split('/');
  const si = parts.indexOf('subsystems');
  const subsys = si >= 0 ? parts[si + 1] : 'global';
  const ifaceSec = findSection(secs, '介面');
  const interfaces = [];
  if (ifaceSec) {
    const t = parseTable(ifaceSec.lines);
    if (t) for (const r of t.rows) {
      const raw = stripTicks(r[0] || '');
      if (!raw || /^</.test(raw)) continue;
      interfaces.push({ raw, where: stripTicks(r[2] || '') });
    }
  }
  const lawSec = findSection(secs, 'Laws');
  const laws = lawSec ? parseList(lawSec.lines).filter((i) => /^LAW-\d+/.test(i.text)).map(draftLaw) : [];
  const contract = findSection(secs, '契約');
  const accept = contract ? (parseList(contract.lines).find((i) => /驗收標準/.test(i.text)) || { text: '' }).text : '';
  const revs = findSection(secs, '修訂記錄');
  return {
    file: rel,
    subsys,
    id: fm.id || path.basename(file, '.md').split('-')[0],
    fullName: `${subsys}/${path.basename(file, '.md')}`,
    type: fm.type || '',
    status: fm.status || '',
    stage: fm.stage || '',
    description: fm.description || '',
    interfaces,
    laws,
    accept: accept.replace(/^\s*\*\*驗收標準\*\*[::]\s*/, ''),
    revs: revs ? parseList(revs.lines).filter((i) => /^REV-\d+/.test(i.text)).length : 0,
  };
}

export function migrate(designPath, root, { language = null, ignore = [] } = {}) {
  if (!fs.existsSync(designPath)) return { text: `找不到 ${designPath}`, exitCode: 1 };
  const files = [];
  walkDocs(path.join(designPath, 'subsystems'), files);
  walkDocs(path.join(designPath, 'features'), files);
  walkDocs(path.join(designPath, 'enhancements'), files);
  const tasks = files
    .filter((f) => /\/(F|E|G-F|G-E)\d*-|\/(F|E)\d{3}-|\/G-(F|E)\d{3}-/.test(f.split(path.sep).join('/')))
    .map((f) => readOld(f, root))
    .filter((d) => ['feature', 'enhance'].includes(d.type) || /^(F|E|G-F|G-E)/.test(d.id));
  const retired = [];
  for (const [dir, what] of [['bugfixes', 'bugfix 文檔'], ['contracts', '全域契約 G-C'], ['spec-gaps.md', 'spec-gaps'], ['migration-v3.md', '遷移帳本']]) {
    const p = path.join(designPath, dir);
    if (fs.existsSync(p)) retired.push(what);
  }
  const bugfixes = [];
  const others = [];
  walkDocs(designPath, others);
  for (const f of others) {
    const r = path.relative(root, f).split(path.sep).join('/');
    if (/\/bugfixes\//.test(r)) bugfixes.push(r);
    if (/build-log\.md$/.test(r)) retired.push(`build-log(${r})`);
    if (/spec-gaps\.md$/.test(r)) retired.push(`spec-gaps(${r})`);
  }

  const adapter = pickAdapter(language);
  const source = adapter ? readSource(root, adapter, ignore) : null;

  const out = [];
  out.push('# devflow migrate 帳本');
  out.push(`來源:${path.relative(root, designPath).split(path.sep).join('/')} · 任務文檔 ${tasks.length} 份 · 子系統 ${new Set(tasks.map((t) => t.subsys).filter((s) => s !== 'global')).size} 個`);
  out.push(adapter ? `· 程式碼用 ${adapter.name} adapter 掃了 ${source.files.size} 個檔` : `· 沒給 --language(${adapterNames.join(' / ')}),介面對不到程式碼`);
  out.push('', '**這份帳本不改任何檔。** 分組、feature / abstract 的切法、law 的形式化由人做。');

  out.push('', '## 1. 每份舊文檔');
  out.push('| 舊文檔 | type | status | 階段 | 介面 | 程式碼對到 | law | 要形式化的 law | REV |');
  out.push('|---|---|---|---|---|---|---|---|---|');
  for (const t of tasks) {
    const found = source ? t.interfaces.filter((i) => findSignature(source, parseSignature(i.raw).name).length).length : 0;
    out.push(`| ${t.fullName} | ${t.type} | ${t.status} | ${t.stage || '-'} | ${t.interfaces.length} | ${source ? found : '?'} | ${t.laws.length} | ${t.laws.filter((l) => l.needsWork).length} | ${t.revs} |`);
  }

  out.push('', '## 2. 共用簽名(abstract 的候選)');
  const byName = new Map();
  for (const t of tasks) for (const i of t.interfaces) {
    const n = parseSignature(i.raw).name;
    if (!n) continue;
    if (!byName.has(n)) byName.set(n, new Set());
    byName.get(n).add(t.fullName);
  }
  const shared = [...byName].filter(([, s]) => s.size >= 2).sort((a, b) => b[1].size - a[1].size);
  if (!shared.length) out.push('- 沒有兩份以上文檔寫到同一個簽名;abstract 要靠讀程式碼找共同部分');
  for (const [n, s] of shared) out.push(`- \`${n}\` 出現在 ${[...s].join('、')} → 抽成 abstract 的候選`);

  out.push('', '## 3. 建議的新樹');
  const byStage = new Map();
  for (const t of tasks) {
    const k = t.stage || '(沒有階段)';
    if (!byStage.has(k)) byStage.set(k, []);
    byStage.get(k).push(t);
  }
  for (const [stage, list] of [...byStage].sort()) {
    out.push(`- 階段 ${stage}`);
    for (const t of list) out.push(`  - ${t.fullName} → \`devflow claim feature <slug>\`(F 與 E 在新樹裡都是 feature;不擋交付的寫進 Features 表的階段欄)`);
  }
  out.push('- 一份舊文檔不必然對一份新 feature:同一條使用者路徑上的幾份合成一條,共用的那幾個 step 抽成 abstract。');

  out.push('', '## 4. law 草稿');
  for (const t of tasks) {
    if (!t.laws.length) continue;
    out.push(`### ${t.fullName}`);
    for (const l of t.laws) out.push(l.text);
  }
  if (!tasks.some((t) => t.laws.length)) out.push('- 舊樹沒有 law');

  out.push('', '## 5. 退場');
  const gone = [...new Set(retired)];
  if (bugfixes.length) gone.push(`bugfix 文檔 ${bugfixes.length} 份(新樹沒有 bug 文檔:law 在就修碼,law 不在就補 law 走 REV)`);
  if (!gone.length) out.push('- 無');
  for (const g of gone) out.push(`- ${g}`);
  out.push('- `planned / specced / done` 與 `rev` 欄:新樹的 status 只有 draft / ready / frozen,進度由 `devflow status` 從程式碼與測試推');
  out.push('- `code-paths` / `modules` / `part-of` / 功能總覽索引:靠簽名對帳查得到,不再寫進 frontmatter');

  out.push('', '## 6. 人要判的');
  out.push('1. 每條使用者路徑要幾份 feature:舊樹一個子系統切好幾份 F,新樹是一條端到端的資料流一份');
  out.push('2. 第 2 節的共用簽名哪些真的該抽成 abstract(判準:被兩份以上 feature 用)');
  out.push('3. 第 4 節標「需形式化」的 law 怎麼寫成三行;寫不出來的補觀察點');
  out.push('4. 層怎麼切:`system.md` 的層表由內而外,再用 `devflow modules --gen` 把檔案填進模組表');
  return { text: out.join('\n'), exitCode: 0 };
}
