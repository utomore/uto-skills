// migrate：盤點 subsystems/ 體系的 .design，印一份帳本，不改任何檔。
//
// 舊樹的一份 F / E / G-F 對應新樹的一份 feature 或（被兩份以上共用時）一份 abstract，
// 但「哪幾份該合成一條 feature」「哪一段該抽成 abstract」是判斷，不是查表：帳本只把
// 判斷需要的材料攤開——介面在程式碼裡對到幾條、四格 law 翻成三行的草稿、誰跟誰共用簽名。
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, sections, findSection, parseTable, parseList, stripTicks, splitRow } from '../markdown.mjs';
import os from 'node:os';
import { parseSignature, renderSignature, readDesign } from '../design.mjs';
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

// 舊的四格 law：量詞 / 定義域 / 前提 / 觀察點。翻得成三行就翻，翻不成標「需形式化」。
function draftLaw(item) {
  const get = (k) => {
    const c = item.children.find((x) => x.startsWith(k));
    return c ? c.slice(k.length).replace(/^[:：]\s*/, '').trim() : '';
  };
  const head = /^(LAW-\d+)\s*[:：]?\s*(.*)$/.exec(item.text) || [null, 'LAW-?', item.text];
  const quant = get('量詞');
  const domain = get('定義域');
  const pre = get('前提');
  const obs = get('觀察點');
  const vars = [...quant.matchAll(/[對所有 ]*([a-z]\w*)/g)].map((m) => m[1]).filter((v) => v.length <= 3);
  const dom = /([A-Z]\w*)/.exec(domain);
  const ascii = (s) => /^[\x20-\x7e]*$/.test(s) && /[(=<>]/.test(s);
  const lines = [`- ${head[1]} [<種類>] ${head[2]}`];
  lines.push(`  - forall ${vars.length && dom ? vars.map((v) => `${v} in ${dom[1]}`).join(', ') : `<變數> in <型別>`}`);
  if (pre) lines.push(`  - given ${ascii(pre) ? pre : `<需形式化：${pre}>`}`);
  lines.push(`  - |- ${ascii(obs) ? obs : `<需形式化：${obs}>`}`);
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
    accept: accept.replace(/^\s*\*\*驗收標準\*\*[:：]\s*/, ''),
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
  out.push(`來源：${path.relative(root, designPath).split(path.sep).join('/')} · 任務文檔 ${tasks.length} 份 · 子系統 ${new Set(tasks.map((t) => t.subsys).filter((s) => s !== 'global')).size} 個`);
  out.push(adapter ? `· 程式碼用 ${adapter.name} adapter 掃了 ${source.files.size} 個檔` : `· 沒給 --language(${adapterNames.join(' / ')})，介面對不到程式碼`);
  out.push('', '**這份帳本不改任何檔。** 分組、feature 的切法、law 的形式化由人做。');

  out.push('', '## 1. 每份舊文檔');
  out.push('| 舊文檔 | type | status | 階段 | 介面 | 程式碼對到 | law | 要形式化的 law | REV |');
  out.push('|---|---|---|---|---|---|---|---|---|');
  for (const t of tasks) {
    const found = source ? t.interfaces.filter((i) => findSignature(source, parseSignature(i.raw).name).length).length : 0;
    out.push(`| ${t.fullName} | ${t.type} | ${t.status} | ${t.stage || '-'} | ${t.interfaces.length} | ${source ? found : '?'} | ${t.laws.length} | ${t.laws.filter((l) => l.needsWork).length} | ${t.revs} |`);
  }

  out.push('', '## 2. 共用簽名（只住一份文檔，其餘引用）');
  const byName = new Map();
  for (const t of tasks) for (const i of t.interfaces) {
    const n = parseSignature(i.raw).name;
    if (!n) continue;
    if (!byName.has(n)) byName.set(n, new Set());
    byName.get(n).add(t.fullName);
  }
  const shared = [...byName].filter(([, s]) => s.size >= 2).sort((a, b) => b[1].size - a[1].size);
  if (!shared.length) out.push('- 沒有兩份以上文檔寫到同一個簽名');
  for (const [n, s] of shared) out.push(`- \`${n}\` 出現在 ${[...s].join('、')} → 只寫進先做出它的那一份 feature，其餘的引用它`);

  out.push('', '## 3. 建議的新樹');
  const byStage = new Map();
  const NO_STAGE = '（沒有階段）';
  for (const t of tasks) {
    const k = t.stage || NO_STAGE;
    if (!byStage.has(k)) byStage.set(k, []);
    byStage.get(k).push(t);
  }
  // 沒有階段的那一組排第一，其餘照階段名排
  for (const [stage, list] of [...byStage].sort(([a], [b]) => (b === NO_STAGE) - (a === NO_STAGE) || (a < b ? -1 : a > b ? 1 : 0))) {
    out.push(`- 階段 ${stage}`);
    for (const t of list) out.push(`  - ${t.fullName} → \`devflow claim feature <slug>\`（F 與 E 在新樹裡都是 feature；這個階段是某條需求的一條里程碑：dev-flow:require-design 談出需求、devflow requirement milestone 切里程碑，feature 用 --milestone 綁進去）`);
  }
  out.push('- 一份舊文檔不必然對一份新 feature：同一條使用者路徑上的幾份合成一條，共用的那幾個 step 只住其中一份，其餘的引用它。');

  out.push('', '## 4. law 草稿');
  for (const t of tasks) {
    if (!t.laws.length) continue;
    out.push(`### ${t.fullName}`);
    for (const l of t.laws) out.push(l.text);
  }
  if (!tasks.some((t) => t.laws.length)) out.push('- 舊樹沒有 law');

  out.push('', '## 5. 退場');
  const gone = [...new Set(retired)];
  if (bugfixes.length) gone.push(`bugfix 文檔 ${bugfixes.length} 份（新樹沒有 bug 文檔：law 在就修碼，law 不在就補 law 走 REV）`);
  if (!gone.length) out.push('- 無');
  for (const g of gone) out.push(`- ${g}`);
  out.push('- `planned / specced / done` 與 `rev` 欄：新樹的 status 只有 draft / ready / verified，進度由 `devflow status` 從程式碼與測試推');
  out.push('- `code-paths` / `modules` / `part-of` / 功能總覽索引：靠簽名對帳查得到，不再寫進 frontmatter');

  out.push('', '## 6. 人要判的');
  out.push('1. 每條使用者路徑要幾份 feature：舊樹一個子系統切好幾份 F，新樹是一條端到端的資料流一份');
  out.push('2. 第 2 節的共用簽名各住哪一份 feature（先做出它的那一份），其餘的引用它');
  out.push('3. 第 4 節標「需形式化」的 law 怎麼寫成三行；寫不出來的補觀察點');
  out.push('4. 層怎麼切：`system.md` 的層表由內而外，再用 `devflow modules --gen` 把檔案填進模組表');
  return { text: out.join('\n'), exitCode: 0 };
}

// 一份 objectives.md 的樹先拆開（splitObjectivesFile，只在 migrate requirements 的暫存複本上跑）：
// 每個 ## O-n → 一條需求（一句話照抄、判準當驗收）寫進 system.md「需求」，並拆成 objectives/R-x-O-n-<slug>.md(需求、優先進 frontmatter；
// slug 從第一條綁定的 feature 推)；開頭的優先各級那行搬進「Constraint」；「目的」併成「願景」第二段；刪 objectives.md。
function sectionRange(lines, title) {
  const from = lines.findIndex((l) => new RegExp(`^## ${title}\\s*$`).test(l));
  if (from < 0) return null;
  let to = from + 1;
  while (to < lines.length && !/^## /.test(lines[to])) to++;
  return { from, to };
}

function splitObjectives(text, { assignRequirements = false, date } = {}) {
  const { body } = parseFrontmatter(text);
  const secs = sections(body);
  const head = secs.find((s) => s.level === 1) || secs[0];
  const noteLine = (head && !/^O-\d+/.test(head.title) ? head.lines : []).map((l) => l.replace(/^[-*]\s*/, '').trim()).find((l) => /^優先[:：]/.test(l)) || '';
  const priorityNote = noteLine.replace(/^優先[:：]\s*/, '').trim();
  const objs = [];
  for (let i = 0; i < secs.length; i++) {
    const s = secs[i];
    if (s.level !== 2) continue;
    const m = /^(O-\d+)\s*[:：]\s*(.*)$/.exec(s.title);
    if (!m) continue;
    const lines = [...s.lines];
    for (let j = i + 1; j < secs.length && secs[j].level > 2; j++) lines.push(`${'#'.repeat(secs[j].level)} ${secs[j].title}`, ...secs[j].lines);
    const field = (k) => {
      const l = lines.find((x) => new RegExp(`^- ${k}[:：]`).test(x));
      return l ? l.replace(/^- [^:：]*[:：]\s*/, '').trim() : '';
    };
    const id = m[1];
    const title = m[2].trim();
    const criteria = field('判準');
    const priority = field('優先') || '<1 到 4,1 最高>';
    const requirement = field('需求') || (assignRequirements ? `R-${objs.length + 1}` : 'R-0');
    const binds = lines.filter((l) => /^\s*\|/.test(l)).flatMap((l) => l.match(/F-\d{3}-[a-z0-9-]+/g) || []);
    const slug = binds.length ? binds[0].replace(/^F-\d{3}-/, '') : 'unnamed';
    const bodyLines = [];
    for (const l of lines) {
      if (/^- (需求|優先|判準)[:：]/.test(l)) continue;
      // 里程碑的第一格要是全名 M-n-<slug>：只有編號的列，英文名從它第一份綁定的 feature 推；沒綁的留給 dev-flow:objective 定
      const ms = /^(\s*\|\s*)(M-\d+)(\s*\|.*)$/.exec(l);
      const bound = ms ? /F-\d{3}-([a-z0-9-]+)/.exec(ms[3]) : null;
      bodyLines.push(ms && bound ? `${ms[1]}${ms[2]}-${bound[1]}${ms[3]}` : l);
    }
    while (bodyLines.length && !bodyLines[0].trim()) bodyLines.shift();
    const fullName = `${requirement}-${id}-${slug}`;
    const content = ['---', `id: ${id}`, `requirement: ${requirement}`, `priority: ${priority}`, `updated: ${date}`, '---', `# ${fullName}：${title}`, '', ...bodyLines].join('\n').replace(/\s+$/, '') + '\n';
    objs.push({ id, title, requirement, assigned: !field('需求'), law: /<[^>]*>/.test(criteria) ? '' : criteria, fullName, file: `${fullName}.md`, content, slug });
  }
  return { priorityNote, objs };
}

function splitObjectivesFile(root, { write = false, date = new Date().toISOString().slice(0, 10) } = {}) {
  const designDir = path.join(root, '.design');
  const sysFile = path.join(designDir, 'system.md');
  const objFile = path.join(designDir, 'objectives.md');
  const objDir = path.join(designDir, 'objectives');
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');
  if (!fs.existsSync(sysFile)) return { text: `${rel(designDir)} 裡沒有 system.md；dev-flow:project 建它`, exitCode: 1 };
  if (!fs.existsSync(objFile)) return { text: `${rel(objFile)} 不存在、目標已經在 objectives/，這棵樹不用換`, exitCode: 0 };
  const out = ['# migrate objectives 帳本', ''];
  const sysText = fs.readFileSync(sysFile, 'utf8');
  const lines = sysText.split(/\r?\n/);
  const reqRange = sectionRange(lines, '需求');
  const hasReal = !!reqRange && lines.slice(reqRange.from + 1, reqRange.to).some((l) => /^### R-\d+/.test(l) && !/<[^>]*>/.test(l));
  const split = splitObjectives(fs.readFileSync(objFile, 'utf8'), { assignRequirements: !hasReal, date });
  const notes = [];
  // 「目的」併成「願景」第二段
  const purpose = sectionRange(lines, '目的');
  const vision = sectionRange(lines, '願景');
  if (purpose && vision) {
    const text = lines.slice(purpose.from + 1, purpose.to).map((l) => l.trim()).filter(Boolean);
    const removed = lines.splice(purpose.from, purpose.to - purpose.from);
    const v = sectionRange(lines, '願景');
    let end = v.to;
    while (end > v.from + 1 && !lines[end - 1].trim()) end--;
    if (text.length && !text.every((l) => /<[^>]*>/.test(l))) lines.splice(end, 0, '', ...text, '');
    else if (removed.length) lines.splice(end, 0, '');
    notes.push('「目的」併成「願景」第二段');
  }
  // 「需求」節：沒有就在願景後面補；每個目標一條
  if (!hasReal) {
    const block = split.objs.length
      ? split.objs.flatMap((r, i) => [...(i ? [''] : []), `### ${r.requirement}：${r.title}`, `- 驗收：${r.law || '<一句可判定的話：這條需求達成時，什麼一定為真>'}`])
      : ['### R-1:<一句話：誰在什麼情況下要得到什麼>', '- 驗收：<一句可判定的話：這條需求達成時，什麼一定為真>'];
    const r = sectionRange(lines, '需求');
    if (r) lines.splice(r.from + 1, r.to - r.from - 1, ...block, '');
    else {
      const v = sectionRange(lines, '願景');
      const at = v ? v.to : lines.length;
      lines.splice(at, 0, '## 需求', ...block, '');
    }
    notes.push(`需求 ${split.objs.length} 條 (${split.objs.map((r) => `${r.requirement} ← ${r.id}${r.law ? '' : '，驗收留佔位符'}`).join('、') || '沒有目標，留一條模板'})`);
  }
  // 「Constraint」補一行優先
  if (split.priorityNote && !/^- 優先[:：]/m.test(lines.join('\n'))) {
    const t = sectionRange(lines, 'Constraint') || sectionRange(lines, '語言與工具');
    if (t) {
      let end = t.to;
      while (end > t.from + 1 && !lines[end - 1].trim()) end--;
      lines.splice(end, 0, `- 優先：${split.priorityNote}`);
      notes.push(`優先各級那行搬進「${lines[t.from].replace(/^## /, '').trim()}」`);
    }
  }
  const next = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  out.push(`- ${rel(sysFile)}：${notes.length ? notes.join('、') : '不動'}`);
  for (const o of split.objs) {
    const n = [o.assigned ? `需求配 ${o.requirement}` : '', o.requirement === 'R-0' ? 'frontmatter 的 requirement 與檔名的 R-0 要換成真的 R-n' : '', o.slug === 'unnamed' ? 'slug 沒有綁定的 feature 可推，先叫 unnamed，改名要連檔名一起改' : 'slug 從第一條綁定的 feature 推，不對就改檔名'].filter(Boolean);
    out.push(`- ${rel(path.join(objDir, o.file))}：建（${o.id}；${n.join('；')}）`);
  }
  if (!split.objs.length) out.push(`- ${rel(objFile)}：沒有任何目標`);
  out.push(`- ${rel(objFile)}：刪`);
  if (!write) {
    out.push('', '以上只是帳本；devflow migrate objectives --write 才落地');
    return { text: out.join('\n'), exitCode: 0 };
  }
  if (next !== sysText) fs.writeFileSync(sysFile, next);
  if (split.objs.length) fs.mkdirSync(objDir, { recursive: true });
  for (const o of split.objs) fs.writeFileSync(path.join(objDir, o.file), o.content);
  fs.unlinkSync(objFile);
  out.push('', '都寫了；接著 devflow status 看警訊，需求的驗收由 dev-flow:project 對談補齊，目標檔的 slug 由 dev-flow:objective 定');
  return { text: out.join('\n'), exitCode: 0 };
}

// 調整表（調整 | 做到什麼 | 動到）→ 里程碑表的列。調整 (RF-n) 就是一條綁既有文檔的里程碑：
// 每一列配一個新的 M-n（整棵樹的里程碑最大號往上，照需求編號、列序配，所以結果是確定的）、第一格只有編號（英文名由人補）、
// 綁定 = 「動到」欄、做到什麼照抄；調整表刪掉；每份文檔修訂記錄裡 REV 依欄的 RF-n 改寫成新的 M-n。
// 做到什麼還是模板佔位符的列讀不進來，跟著表一起刪。同一個 RF-n 出現兩列時各配各的新號，REV 的引用改寫成第一列的。
function planRefinements(requirements, extraMilestones = []) {
  const numOf = (m) => Number((/^M-(\d+)$/.exec(m.id) || [0, 0])[1]);
  let max = Math.max(0, ...requirements.flatMap((q) => q.milestones).map(numOf), ...extraMilestones.map(numOf));
  const ordered = [...requirements].sort((x, y) => Number(x.fileId.slice(2)) - Number(y.fileId.slice(2)) || x.fullName.localeCompare(y.fullName));
  const rows = [];
  const map = new Map();
  const twice = [];
  for (const q of ordered) for (const m of q.milestones) {
    if (!m.fromRefinement) continue;
    const row = { q, m, from: m.id, to: `M-${++max}` };
    rows.push(row);
    if (map.has(m.id)) twice.push(row);
    else map.set(m.id, row.to);
  }
  const newId = new Map(rows.map((r) => [r.m, r.to]));
  const nameOf = (m) => newId.get(m) || m.fullName;
  return {
    rows,
    map,
    twice,
    nameOf,
    // 一條里程碑在里程碑表上的那一列
    rowOf: (m) => `| ${nameOf(m)} | ${m.title} | ${m.binds.length ? m.binds.join('、') : '-'} |`,
  };
}

// 一個需求檔：調整表整張刪掉（連同它前面的一個空行），rows 接在里程碑表最後；沒有里程碑表就在調整表原本的位置補一張。行尾照原檔。
function foldRefinementTable(text, rows) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const headAt = (h) => lines.findIndex((l) => /^\s*\|/.test(l) && splitRow(l)[0] === h);
  let at = -1;
  for (let h = headAt('調整'); h >= 0; h = headAt('調整')) {
    let end = h;
    while (end + 1 < lines.length && /^\s*\|/.test(lines[end + 1])) end++;
    const from = h > 0 && !lines[h - 1].trim() ? h - 1 : h;
    lines.splice(from, end - from + 1);
    if (at < 0) at = from;
  }
  if (rows.length) {
    const m = headAt('里程碑');
    if (m >= 0) {
      let last = m;
      while (last + 1 < lines.length && /^\s*\|/.test(lines[last + 1])) last++;
      lines.splice(last + 1, 0, ...rows);
    } else lines.splice(at, 0, '', '| 里程碑 | 做到什麼 | 綁定 |', '|---|---|---|', ...rows);
  }
  return lines.join(eol);
}

// 文檔的修訂記錄：REV 那一行（依欄住在這一行）裡的 RF-n 照對照表改寫成新的 M-n。回 { text, hits:[[RF-n, M-n], …] }
function rewriteRevCites(text, map) {
  const hits = [];
  const next = text.replace(/^- REV-\d+.*$/gm, (line) => line.replace(/(?<![A-Za-z0-9])RF-\d+/g, (id) => {
    if (!map.has(id)) return id;
    hits.push([id, map.get(id)]);
    return map.get(id);
  }));
  return { text: next, hits };
}

// 帳本的三塊：逐列對照、動到的文檔、人要判的。docs 是 [{ file, abs }]；回 { ledger, judge, writes:[[相對路徑，新內容]] }
function refinementLedger(plan, docs) {
  const ledger = [];
  const judge = [];
  const writes = [];
  if (plan.rows.length) ledger.push('', '## 調整表換成里程碑');
  for (const r of plan.rows) ledger.push(`- ${r.from} → ${r.to}：${r.m.title}（${r.q.fullName}；綁定 ${r.m.binds.join('、') || '-'}）`);
  for (const d of docs) {
    const r = rewriteRevCites(fs.readFileSync(d.abs, 'utf8'), plan.map);
    if (!r.hits.length) continue;
    writes.push([d.file, r.text]);
    ledger.push(`- ${d.file}：修訂記錄依欄的 ${[...new Set(r.hits.map(([from, to]) => `${from} 改寫成 ${to}`))].join('、')}`);
  }
  for (const r of plan.rows) judge.push(`${r.to}（${r.q.fullName}，換自 ${r.from}「${r.m.title}」）：補英文名，dev-flow:require-design 把第一格寫成 ${r.to}-<slug>（kebab-case 英文），REV 依欄引用它的地方跟著寫成全名`);
  for (const r of plan.twice) judge.push(`${r.from} 在調整表出現不只一列：${r.to} 是後面那一列換來的，REV 依欄的 ${r.from} 一律改寫成 ${plan.map.get(r.from)}；引用的其實是 ${r.to} 就自己改`);
  return { ledger, judge, writes };
}

// 已經是 requirements/ 的樹：只剩調整表要換
function foldRefinements(root, { write = false } = {}) {
  const design = readDesign(root);
  const reqs = design.requirements.requirements;
  const withTable = reqs.filter((q) => q.hasRefinementTable);
  if (!withTable.length) return { text: `${design.requirements.dir} 已經在，每個需求檔只有一張里程碑表，這棵樹不用換`, exitCode: 0 };
  const plan = planRefinements(reqs);
  const out = ['# migrate requirements 帳本', ''];
  const writes = [];
  for (const q of withTable) {
    const rows = plan.rows.filter((r) => r.q === q);
    writes.push([q.file, foldRefinementTable(fs.readFileSync(q.abs, 'utf8'), rows.map((r) => plan.rowOf(r.m)))]);
    out.push(`- ${q.file}：調整表刪掉${rows.length ? `，${rows.length} 列換成里程碑表的列（${rows.map((r) => `${r.from} → ${r.to}`).join('、')}）` : '，表裡沒有要換的列'}`);
  }
  const led = refinementLedger(plan, design.docs);
  out.push(...led.ledger, '', '## 人要判的', ...(led.judge.length ? led.judge.map((j) => `- ${j}`) : ['- 無']));
  if (!write) {
    out.push('', '以上只是帳本；devflow migrate requirements --write 才落地');
    return { text: out.join('\n'), exitCode: 0 };
  }
  for (const [file, text] of [...writes, ...led.writes]) fs.writeFileSync(path.join(root, file), text);
  out.push('', '都寫了；接著 devflow status 看警訊，「人要判的」由 dev-flow:require-design 對談補齊');
  return { text: out.join('\n'), exitCode: 0 };
}

// migrate requirements [--write]：需求住 system.md「## 需求」節、里程碑住 objectives/（或一份 objectives.md）的樹，
// 換成 requirements/R-n-<slug>.md 一條需求一個檔（一句話、驗收、優先、里程碑表）。先印帳本，--write 才落地。
// 併法與 CLI 照讀這種樹時同一支（design.mjs 的 mergeRequirements）：slug 取第一個目標的，優先取最高的，里程碑依（優先、目標號）串接；
// 目標檔的調整表在同一道裡換成里程碑表的列 (planRefinements)。已經是 requirements/ 而需求檔還帶調整表的樹，只換那張表 (foldRefinements)。
// 整件事先在暫存的 .design 複本上做完，--write 才把結果搬回來；對不到需求的目標檔留著不動，列給人判。
export function migrateRequirements(root, { write = false, date = new Date().toISOString().slice(0, 10) } = {}) {
  const designDir = path.join(root, '.design');
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');
  if (!fs.existsSync(path.join(designDir, 'system.md'))) return { text: `${rel(designDir)} 裡沒有 system.md；dev-flow:kickoff 建它`, exitCode: 1 };
  if (fs.existsSync(path.join(designDir, 'requirements'))) return foldRefinements(root, { write });
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-migrate-'));
  try {
    const tmpDesign = path.join(tmpRoot, '.design');
    fs.cpSync(designDir, tmpDesign, { recursive: true });
    const out = ['# migrate requirements 帳本', ''];
    const sysNotes = [];
    const hadFile = fs.existsSync(path.join(tmpDesign, 'objectives.md'));
    if (hadFile) {
      const first = splitObjectivesFile(tmpRoot, { write: true, date });
      const line = first.text.split('\n').find((l) => /^- \.design\/system\.md[:：]/.test(l));
      if (line && !/[:：]不動$/.test(line)) sysNotes.push(line.replace(/^- \.design\/system\.md[:：]/, ''));
    }
    const design = readDesign(tmpRoot);
    const merged = design.requirements;
    if (!merged.merged) return { text: `${rel(path.join(designDir, 'system.md'))} 沒有「## 需求」節，也沒有 objectives.md：沒有需求可換；dev-flow:require-design 談第一條`, exitCode: 0 };
    // system.md：每條需求的原文（驗收連同三行）搬走，整節刪掉
    const sysFile = path.join(tmpDesign, 'system.md');
    const lines = fs.readFileSync(sysFile, 'utf8').replace(/\r\n/g, '\n').split('\n');
    const range = sectionRange(lines, '需求');
    const bodyOf = (id) => {
      let at = -1;
      for (let i = range.from + 1; i < range.to; i++) if (new RegExp(`^### ${id}\\s*[:：]`).test(lines[i])) at = i;
      if (at < 0) return [];
      let stop = at + 1;
      while (stop < range.to && !/^#{1,3} /.test(lines[stop])) stop++;
      const body = dropLawItems(lines.slice(at + 1, stop), { rename: true }).lines;
      while (body.length && !body[0].trim()) body.shift();
      while (body.length && !body[body.length - 1].trim()) body.pop();
      return body;
    };
    const files = [];
    const judge = [];
    const kept = merged.requirements.filter((q) => !q.placeholder);
    const plan = planRefinements(kept, merged.orphans.flatMap((o) => o.milestones));
    for (const q of kept) {
      const body = bodyOf(q.id);
      const accept = body.length ? body : ['- 驗收：<一句可判定的話：這條需求達成時，什麼一定為真>'];
      const content = [
        '---', `id: ${q.id}`, `priority: ${q.priority || '<1 到 4,1 最高>'}`, `updated: ${date}`, '---',
        `# ${q.fullName}：${q.title}`, '', ...accept, '',
        '| 里程碑 | 做到什麼 | 綁定 |', '|---|---|---|',
        ...q.milestones.map((m) => plan.rowOf(m)),
      ].join('\n') + '\n';
      files.push({ name: `${q.fullName}.md`, content, q });
      if (q.sources.length > 1) judge.push(`${q.id}：併了 ${q.sources.length} 個目標（${q.sources.map((o) => `${o.id}「${o.title}」：${o.milestones.map(plan.nameOf).join('、') || '沒有里程碑'}`).join(';')}），里程碑照（優先、目標號）串接、換自調整表的排最後；順序不對就改表的列序，其實是兩件事就拆成兩條需求`);
      if (!q.sources.length) judge.push(`${q.id}：沒有任何目標朝向它，檔名暫用 ${q.fullName}、沒有優先也沒有里程碑；dev-flow:require-design 補，改名要連檔名一起改`);
      else if (q.slug === 'unnamed') judge.push(`${q.id}：英文名沒有來源，檔名暫用 ${q.fullName}；改名要連檔名一起改`);
    }
    for (const o of merged.orphans) judge.push(`${o.file}：對到的 ${o.requirement} 不存在，留著沒動（里程碑 ${o.milestones.map((m) => m.fullName).join('、') || '無'}）；決定它屬於哪條需求，併進那個需求檔之後刪掉`);
    lines.splice(range.from, range.to - range.from);
    const nextSys = lines.join('\n').replace(/\n{3,}/g, '\n\n');
    sysNotes.push('「## 需求」節刪掉，需求搬進 requirements/');
    out.push(`- .design/system.md：${sysNotes.join('；')}`);
    for (const f of files) {
      const rows = f.q.milestones;
      const folded = rows.filter((m) => m.fromRefinement).length;
      out.push(`- .design/requirements/${f.name}：建（優先 ${f.q.priority || '沒有'}；里程碑 ${rows.length} 條${folded ? `，其中 ${folded} 條換自調整表` : ''}${f.q.sources.length ? `；併自 ${f.q.sources.map((o) => o.fullName).join('、')}` : ''}）`);
    }
    if (hadFile) out.push('- .design/objectives.md：刪（先照每個 ## O-n 拆開，再併進它的需求）');
    const used = merged.requirements.flatMap((q) => q.sources);
    if (!hadFile) for (const o of used) out.push(`- ${o.file}：刪`);
    const led = refinementLedger(plan, design.docs);
    out.push(...led.ledger);
    judge.push(...led.judge);
    out.push('', '## 人要判的', ...(judge.length ? judge.map((j) => `- ${j}`) : ['- 無']));
    if (!write) {
      out.push('', '以上只是帳本；devflow migrate requirements --write 才落地');
      return { text: out.join('\n'), exitCode: 0 };
    }
    fs.writeFileSync(path.join(designDir, 'system.md'), nextSys);
    const reqDir = path.join(designDir, 'requirements');
    fs.mkdirSync(reqDir, { recursive: true });
    for (const f of files) fs.writeFileSync(path.join(reqDir, f.name), f.content);
    for (const [file, text] of led.writes) fs.writeFileSync(path.join(root, file), text);
    if (hadFile) {
      fs.unlinkSync(path.join(designDir, 'objectives.md'));
      // 拆出來而對不到需求的那幾份，留在 objectives/ 給人判
      for (const o of merged.orphans) {
        fs.mkdirSync(path.join(designDir, 'objectives'), { recursive: true });
        fs.copyFileSync(path.join(tmpRoot, o.file), path.join(root, o.file));
      }
    } else {
      for (const o of used) fs.unlinkSync(path.join(root, o.file));
      const objDir = path.join(designDir, 'objectives');
      if (fs.existsSync(objDir) && !fs.readdirSync(objDir).length) fs.rmdirSync(objDir);
    }
    out.push('', '都寫了；接著 devflow status 看警訊，「人要判的」與缺的驗收、優先由 dev-flow:require-design 對談補齊');
    return { text: out.join('\n'), exitCode: 0 };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// migrate laws [--write]:Law 只剩「不得違反」的約束。先印帳本，--write 才落地。
// system.md：「## 層」「## 對外 I/O」「## 領域不變量」收進「## 全域 Law」區的三個 ###（領域不變量、架構：層、契約：對外 I/O）；
// 需求的「- Law：」改成「- 驗收：」（需求是必須達成的事，不是 law），「- 蘊含：」刪掉；objectives/ 每個目標檔的「- Law：」連同它的三行刪掉。
// 測試裡的 R-n#LAW 標記不動：它照樣讀成需求的驗收測試。
const GLOBAL_INTRO = '不得違反：整個專案任何一條切片、任何一份 feature 都要守。三類各住一區，各有一道 lint 自動確認（`devflow lint global` 一次查完）；新增、修改、放寬、替換或刪除都要開發者明確批准。';

function dropLawItems(lines, { rename = false } = {}) {
  const out = [];
  let changed = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^- 蘊含[:：]/.test(l) || (!rename && /^- Law[:：]/.test(l))) {
      changed++;
      while (i + 1 < lines.length && /^\s{2,}- /.test(lines[i + 1])) i++;
      if (!rename && out.length && !out[out.length - 1].trim() && i + 1 < lines.length && !lines[i + 1].trim()) i++;
      continue;
    }
    if (rename && /^- Law[:：]/.test(l)) {
      changed++;
      out.push(l.replace(/^- Law[:：]\s*/, '- 驗收：'));
      continue;
    }
    out.push(l);
  }
  return { lines: out, changed };
}

export function migrateLaws(root, { write = false } = {}) {
  const designDir = path.join(root, '.design');
  const sysFile = path.join(designDir, 'system.md');
  const objDir = path.join(designDir, 'objectives');
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');
  if (!fs.existsSync(sysFile)) return { text: `${rel(designDir)} 裡沒有 system.md；dev-flow:project 建它`, exitCode: 1 };
  const out = ['# migrate laws 帳本', ''];
  // 比對「有沒有變」用 LF 的版本：CRLF 的工作樹不該被當成要換
  const sysText = fs.readFileSync(sysFile, 'utf8').replace(/\r\n/g, '\n');
  let lines = sysText.split(/\r?\n/);
  const notes = [];
  // 需求：Law → 驗收，蘊含刪掉
  const req = sectionRange(lines, '需求');
  if (req) {
    const r = dropLawItems(lines.slice(req.from + 1, req.to), { rename: true });
    if (r.changed) {
      lines.splice(req.from + 1, req.to - req.from - 1, ...r.lines);
      notes.push(`需求的「- Law：」改成「- 驗收：」、蘊含說明刪掉，共 ${r.changed} 處`);
    }
  }
  // 全域 Law 區
  if (!sectionRange(lines, '全域 Law')) {
    const take = (title) => {
      const s = sectionRange(lines, title);
      if (!s) return null;
      const body = lines.slice(s.from + 1, s.to);
      while (body.length && !body[body.length - 1].trim()) body.pop();
      return { at: s.from, body };
    };
    const parts = [['領域不變量', '領域不變量'], ['層', '架構：層'], ['對外 I/O', '契約：對外 I/O']];
    let anchor = null;
    const region = ['## 全域 Law', GLOBAL_INTRO, ''];
    const found = [];
    for (const [h2, h3] of parts) {
      const got = take(h2);
      if (got) {
        const s = sectionRange(lines, h2);
        lines.splice(s.from, s.to - s.from);
        if (anchor == null || s.from < anchor) anchor = s.from;
        found.push(h2);
      }
      region.push(`### ${h3}`, ...(got ? got.body : ['無']), '');
    }
    if (anchor == null) {
      const after = sectionRange(lines, '需求') || sectionRange(lines, '願景');
      anchor = after ? after.to : lines.length;
    } else {
      // 區放在需求之後：三節原本夾著別的節時，仍以需求節的結尾為準
      const after = sectionRange(lines, '需求');
      if (after) anchor = after.to;
    }
    lines.splice(anchor, 0, ...region);
    notes.push(`${found.length ? `「${found.join('」「')}」` : '沒有任何一節，三區都'}收進「## 全域 Law」區${found.length < 3 ? '；缺的那一區先寫「無」' : ''}`);
  }
  const next = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  out.push(`- ${rel(sysFile)}：${notes.length ? notes.join('；') : '不動'}`);
  const objWrites = [];
  if (fs.existsSync(objDir)) for (const f of fs.readdirSync(objDir).filter((n) => n.endsWith('.md')).sort()) {
    const file = path.join(objDir, f);
    const text = fs.readFileSync(file, 'utf8');
    const r = dropLawItems(text.split(/\r?\n/));
    if (!r.changed) continue;
    objWrites.push([file, r.lines.join('\n')]);
    out.push(`- ${rel(file)}：目標的「- Law：」刪掉（目標達成 = 建置路線的里程碑全部達成）`);
  }
  out.push('- 測試裡歸屬 R-n#LAW 的標記不動：照樣讀成需求的驗收測試；新寫的用 R-n#ACCEPT');
  if (next === sysText && !objWrites.length) {
    out.push('', '這棵樹不用換');
    return { text: out.join('\n'), exitCode: 0 };
  }
  if (!write) {
    out.push('', '以上只是帳本；devflow migrate laws --write 才落地');
    return { text: out.join('\n'), exitCode: 0 };
  }
  if (next !== sysText) fs.writeFileSync(sysFile, next);
  for (const [file, text] of objWrites) fs.writeFileSync(file, text);
  out.push('', '都寫了；接著 devflow lint global 與 devflow status 看警訊');
  return { text: out.join('\n'), exitCode: 0 };
}
