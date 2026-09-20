// migrate from-dev-flow <.design>:盤點 subsystems/ 體系的 .design,印一份帳本。只讀不寫(--write 才落地)。
// 機械的部分:介面表的簽名對程式碼、四格 law 翻三行草稿、按模組分組;人判的部分列在最後。
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, sections, parseTable, parseList, stripTicks } from '../markdown.mjs';
import { pickAdapter } from '../adapters/index.mjs';
import { readSource, findSignature } from '../source.mjs';

function codeSpans(text) {
  const out = [];
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

function walkDocs(designDir) {
  const out = [];
  const visit = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        if (ent.name === 'archive') continue;
        visit(path.join(dir, ent.name));
      } else if (/^(G-)?[FEBC]\d{3}-.+\.md$/.test(ent.name)) out.push(path.join(dir, ent.name));
    }
  };
  visit(designDir);
  return out.sort();
}

function kebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

const FIELD = /^(量詞|定義域|前提|觀察點)[::]\s*(.*)$/;

// 四格 → 三行草稿。回 { forall, given, conclusion, formal }
function draftLaw(law) {
  const f = {};
  for (const c of law.children) {
    const m = FIELD.exec(c);
    if (m) f[m[1]] = m[2].trim();
  }
  if (!f.量詞 && !f.觀察點) return { forall: null, given: [], conclusion: null, formal: false, fourPart: false };
  const vars = codeSpans(f.量詞 || '').filter((s) => /^[a-z_][\w']*$/.test(s));
  const domains = new Map();
  for (const s of codeSpans(f.定義域 || '')) {
    const m = /^([a-z_][\w']*)\s*::\s*(.+)$/.exec(s);
    if (m) domains.set(m[1], m[2].trim());
  }
  for (const v of domains.keys()) if (!vars.includes(v)) vars.push(v);
  const forall = vars.length ? `forall ${vars.map((v) => `${v} in ${domains.get(v) || '<定義域待補>'}`).join(', ')}` : 'forall <變數待補>';
  const given = [];
  if (f.前提 && !/^(無|none|-|—)$/i.test(f.前提)) {
    const sp = codeSpans(f.前提);
    given.push(sp.length && sp.every((s) => /[=<>]|\bnot\b|\belem\b/.test(s)) ? `given ${sp.join(' and ')}` : `given <${f.前提}>`);
  }
  let conclusion = null;
  let formal = false;
  const obs = f.觀察點 || '';
  const sp = codeSpans(obs);
  const eqSplit = obs.split(/等於|相同|一致/);
  if (sp.some((s) => /==|\/=|<=|>=|(?<![-=])[<>](?!=)/.test(s))) {
    conclusion = `|- ${sp.filter((s) => /==|\/=|<=|>=|[<>]/.test(s)).join(' and ')}`;
    formal = true;
  } else if (eqSplit.length >= 2 && codeSpans(eqSplit[0]).length && codeSpans(eqSplit[1]).length) {
    const l = codeSpans(eqSplit[0]);
    const r = codeSpans(eqSplit[1]);
    conclusion = `|- ${l[l.length - 1]} == ${r[0]}`;
    formal = true;
  } else if (sp.length) {
    conclusion = `|- <${sp.join(' ; ')} … 需形式化:${obs}>`;
  } else {
    conclusion = `|- <需形式化:${obs || '觀察點空白'}>`;
  }
  return { forall, given, conclusion, formal, fourPart: true };
}

function readDoc(file, designDir) {
  const text = fs.readFileSync(file, 'utf8');
  const { fm, body } = parseFrontmatter(text);
  const secs = sections(body);
  const rel = path.relative(designDir, file).split(path.sep).join('/');
  const base = path.basename(file, '.md');
  const idM = /^((?:G-)?[FEBC])(\d{3})-(.+)$/.exec(base);
  const subM = /^subsystems\/([^/]+)\//.exec(rel);
  const subsystem = subM ? subM[1] : null;
  const fullName = subsystem ? `${subsystem}/${base}` : base;
  const sigs = [];
  const types = [];
  // 介面節連同它底下的 ### 子節(一個模組一個子節的寫法);圍欄裡的 name :: Type 也算
  const ifaceText = [];
  for (let i = 0; i < secs.length; i++) {
    if (!(secs[i].level === 2 && /^(介面|新增的介面)/.test(secs[i].title))) continue;
    ifaceText.push(secs[i].lines.join('\n'));
    for (let j = i + 1; j < secs.length && secs[j].level > 2; j++) ifaceText.push(secs[j].lines.join('\n'));
  }
  let iface = ifaceText.join('\n');
  iface = iface.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, code) => {
    for (const line of code.split('\n')) {
      const m = /^([a-z_][\w']*)\s+::\s+(.+)$/.exec(line.trim());
      if (m && !sigs.some((x) => x.name === m[1])) sigs.push({ name: m[1], type: m[2].replace(/\s+/g, ' ').trim() });
    }
    return '';
  });
  {
    for (const span of codeSpans(iface)) {
      const m = /^([a-z_][\w']*)\s*::\s*(.+)$/s.exec(span);
      if (m) {
        if (!sigs.some((x) => x.name === m[1])) sigs.push({ name: m[1], type: m[2].replace(/\s+/g, ' ').trim() });
        continue;
      }
      const t = /^(data|newtype|type|class)\s+(?:\([^)]*\)\s*=>\s*)?([A-Z][\w']*)/.exec(span);
      if (t && !types.includes(t[2])) types.push(t[2]);
    }
  }
  const lawSec = secs.find((x) => x.level === 2 && /^Laws/.test(x.title));
  const laws = lawSec
    ? parseList(lawSec.lines).filter((i) => /^LAW-\d+/.test(i.text)).map((i) => ({
        id: /^(LAW-\d+)/.exec(i.text)[1],
        title: i.text.replace(/^LAW-\d+\s*[::]?\s*/, ''),
        ...draftLaw(i),
      }))
    : [];
  const exSec = secs.find((x) => x.level === 2 && /^Examples/.test(x.title));
  const exTable = exSec ? parseTable(exSec.lines) : null;
  const examples = exTable ? exTable.rows.filter((r) => /^EX-\d+/.test(r[0] || '')).length : 0;
  const gapsSec = secs.find((x) => x.level === 2 && /^待確認假設/.test(x.title));
  const openAsm = gapsSec ? parseList(gapsSec.lines).filter((i) => /^(ASM|A)-?\d+/.test(i.text) && !/裁決|已裁|resolved/.test(i.text)).length : 0;
  return {
    file: rel,
    fullName,
    kind: idM ? idM[1] : '?',
    subsystem,
    status: fm.status || '',
    stage: fm.stage || '',
    group: fm.group || '',
    rev: fm.rev || '0',
    sigs,
    types,
    laws,
    examples,
    openAsm,
  };
}

function readStages(designDir) {
  const file = path.join(designDir, 'system.md');
  if (!fs.existsSync(file)) return [];
  const { body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  const sec = sections(body).find((s) => s.level === 2 && /開發階段/.test(s.title));
  if (!sec) return [];
  const t = parseTable(sec.lines);
  if (!t) return [];
  const col = (name) => t.header.findIndex((h) => h.includes(name));
  const iStage = col('階段');
  const iMile = col('里程碑');
  const iState = col('狀態');
  return t.rows.map((r) => ({ stage: r[iStage] || '', milestone: (r[iMile] || '').replace(/\*\*/g, ''), state: (r[iState] || '').replace(/\*\*/g, '').split(/[((]/)[0].trim() }));
}

function retireList(designDir) {
  const out = [];
  const visit = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== 'archive' && ent.name !== 'adr') visit(p);
      } else if (/^(build-log|design|decisions|migration-v\d|spec-gaps|legacy-map)\.md$|^contract-.*\.md$/.test(ent.name)) {
        out.push(path.relative(designDir, p).split(path.sep).join('/'));
      }
    }
  };
  visit(designDir);
  return out.sort();
}

export function migrateFromDevFlow(designDir, root, { write = null, language = null, ignore = [] } = {}) {
  if (!fs.existsSync(designDir)) return { text: `找不到 ${designDir}`, exitCode: 1 };
  const adapter = pickAdapter(language || 'haskell');
  const source = adapter ? readSource(root, adapter, ignore) : null;
  const docs = walkDocs(designDir).map((f) => readDoc(f, designDir));
  const stages = readStages(designDir);
  const adrCount = fs.existsSync(path.join(designDir, 'adr')) ? fs.readdirSync(path.join(designDir, 'adr')).filter((f) => f.endsWith('.md')).length : 0;

  // 對程式碼
  for (const d of docs) {
    const modules = new Map();
    for (const s of d.sigs) {
      const hits = source ? findSignature(source, s.name) : [];
      const hit = hits[0] || null;
      s.state = !source ? '未查' : !hit ? '找不到' : adapter.normalizeType(s.type) === hit.type ? '在' : '不一致';
      s.module = hit ? hit.module : null;
      if (hit) modules.set(hit.module, (modules.get(hit.module) || 0) + 1);
    }
    d.primaryModule = [...modules].sort((a, b) => b[1] - a[1]).map(([m]) => m)[0] || null;
    const parts = d.primaryModule ? d.primaryModule.split('.') : [];
    d.groupKey = d.primaryModule ? (parts.length >= 3 ? parts.slice(0, -1).join('.') : d.primaryModule) : `${d.subsystem || '全域'}(簽名對不到程式碼)`;
  }

  const groups = new Map();
  for (const d of docs) {
    if (!groups.has(d.groupKey)) groups.set(d.groupKey, []);
    groups.get(d.groupKey).push(d);
  }

  const out = [];
  out.push('# migrate from-dev-flow 帳本', '');
  out.push(`來源:${path.relative(root, designDir).split(path.sep).join('/') || '.lawful'} · 文檔 ${docs.length} 份(F ${docs.filter((d) => d.kind === 'F').length}、E ${docs.filter((d) => d.kind === 'E').length}、B ${docs.filter((d) => d.kind === 'B').length}、G-* ${docs.filter((d) => d.kind.startsWith('G-')).length})· ADR ${adrCount} 份原樣搬 · ${source ? `程式碼模組 ${source.modules.size} 個` : '沒有 adapter,簽名未對程式碼'}`);
  out.push('');

  out.push('## 目標與里程碑候選(從開發階段表來;每個階段是一個目標候選、它的里程碑欄是里程碑候選,綁到哪幾條 pipeline 由人定)');
  if (!stages.length) out.push('- system.md 沒有開發階段表');
  else {
    out.push('| 階段 | 里程碑 | 狀態 |', '|---|---|---|');
    for (const s of stages) out.push(`| ${s.stage} | ${s.milestone} | ${s.state} |`);
  }
  out.push('');

  out.push('## 文檔對帳');
  out.push('| 文檔 | 類別 | status | 文檔簽名數量 | Code 簽名數量 | 型別 | Law 條數 | 可機械翻成三行 | Example 數 | 主要模組 |');
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const d of docs) {
    const ok = d.sigs.filter((s) => s.state === '在').length;
    out.push(`| ${d.fullName} | ${d.kind} | ${d.status} | ${d.sigs.length} | ${ok} | ${d.types.length} | ${d.laws.length} | ${d.laws.filter((l) => l.formal).length} | ${d.examples} | ${d.primaryModule || '—'} |`);
  }
  out.push('');

  out.push('## 分組建議(同一組合成一條子流 pipeline;要不要合、叫什麼,人定)');
  for (const [key, list] of [...groups].sort()) {
    const slug = /對不到/.test(key) ? '' : kebab(key.split('.').slice(-1)[0]);
    out.push(`- **${key}**${slug ? ` → 建議 \`lawful claim ${slug}\`` : ''}:${list.map((d) => d.fullName).join('、')}`);
    const stageNames = [...new Set(list.flatMap((d) => d.sigs.filter((s) => s.state !== '找不到').map((s) => s.name)))];
    if (stageNames.length) out.push(`  - Stages 候選:${stageNames.map((n) => `\`${n}\``).join('、')}`);
  }
  out.push('');

  out.push('## Law 草稿(四格 → 三行;`<…>` 是人要補的)');
  for (const d of docs) {
    if (!d.laws.length) continue;
    out.push(`### ${d.fullName}`);
    for (const l of d.laws) {
      if (!l.fourPart) {
        out.push(`- ${l.id} [<種類>] ${l.title}`, '  - <這條不是四格寫法,整條重寫>');
        continue;
      }
      out.push(`- ${l.id} [<種類>] ${l.title}${l.formal ? '' : '  ← 需形式化'}`);
      out.push(`  - ${l.forall}`);
      for (const g of l.given) out.push(`  - ${g}`);
      out.push(`  - ${l.conclusion}`);
    }
  }
  out.push('');

  const missing = docs.flatMap((d) => d.sigs.filter((s) => s.state === '找不到').map((s) => `${d.fullName}:\`${s.name}\``));
  const mismatched = docs.flatMap((d) => d.sigs.filter((s) => s.state === '不一致').map((s) => `${d.fullName}:\`${s.name}\`(程式碼在 ${s.module})`));
  out.push('## 簽名對不上程式碼');
  if (!missing.length && !mismatched.length) out.push('- 無');
  for (const m of missing) out.push(`- 找不到:${m}`);
  for (const m of mismatched) out.push(`- 不一致:${m}`);
  out.push('');

  out.push('## 退場清單(內容已在程式碼或 pipeline 的 Brief 裡,不搬)');
  for (const f of retireList(designDir)) out.push(`- ${f}`);
  for (const d of docs.filter((x) => x.kind === 'E' || x.kind === 'G-E')) out.push(`- ${d.file}:E 的內容寫進對應 pipeline 的 Stages,不另建檔`);
  for (const d of docs.filter((x) => x.kind === 'B' || x.kind === 'G-B')) out.push(`- ${d.file}:B 的重現測試改標 \`"P-00x#LAW-n"\`,law 沒寫到的補 law`);
  for (const d of docs.filter((x) => x.kind === 'C' || x.kind === 'G-C')) out.push(`- ${d.file}:G-C 的型別已在 types 層,不搬`);
  out.push('');

  const prose = docs.reduce((n, d) => n + d.laws.filter((l) => !l.formal).length, 0);
  const asm = docs.reduce((n, d) => n + d.openAsm, 0);
  out.push('## 人要判的');
  out.push(`1. 模組單元:簽名現在住的模組要併成哪幾個單元、各自的職責與有哪幾層,一個單元一道 lawful module;每個檔照它的層搬進那一棵原始碼樹`);
  out.push(`2. 分組:${groups.size} 組要不要合、各叫什麼;哪幾組是同一條 IO 介面 pipeline 的 stage`);
  out.push(`3. 目標與里程碑:${stages.length} 個階段各是不是一個目標(lawful objective add,優先 1 到 4)、它的里程碑綁哪幾條 pipeline`);
  out.push(`4. law 形式化:${prose} 條 law 的觀察點是散文,要改寫成只引用 Stages 簽名與 types 匯出的 \`|-\` 行`);
  out.push(`5. 簽名:${missing.length} 條找不到、${mismatched.length} 條不一致,誰對誰錯`);
  out.push(`6. 待確認假設:${asm} 條還在檔上,決定了寫進「決定」,沒決定的開 GAP`);
  out.push(`7. planned 的 ${docs.filter((d) => d.status === 'planned').length} 份:變 draft pipeline 還是變別條的願望 stage`);

  const text = out.join('\n');
  if (write) {
    fs.writeFileSync(write, text + '\n');
    return { text: `帳本寫到 ${path.relative(root, write).split(path.sep).join('/')}(${docs.length} 份文檔)`, exitCode: 0 };
  }
  return { text, exitCode: 0 };
}

// migrate cone [--write]:兩種不合規的樹換成 Cone.md 與 objectives/ 體系。先印帳本,--write 才落地。
// 只有 system.md 的樹:願景與目的 → Cone.md「願景」(目的接成第二段);語言與工具與優先各級 → 「專案約束」;
// 每個目標 → 一條需求(一句話照抄、判準當 Law);邊界與對外 I/O 表 → modules.md 的兩節;Pipelines 表的類別 → 各 pipeline frontmatter 的 kind;刪 system.md。
// 目標還擠在 objectives.md 的樹:每個 ## O-n 拆成 objectives/R-x-O-n-<slug>.md(需求、優先進 frontmatter,判準變成「Law:繼承 R-x」),
// 開頭的優先各級那行搬進 Cone.md「專案約束」;刪 objectives.md。
// 「## 全域 Law」區:領域不變量、架構:四層、契約:對外 I/O。boundary 是四層各一句的那幾行,ioTable 是對外 I/O 表(補上契約欄)。
const LAYER_TEMPLATE = '- types:<裝什麼,一句>\n- effect:<指令 ADT 叫什麼,一句;沒有 effect 層寫「無」>\n- core:<純轉換住哪,一句>\n- shell:<進入點,一句>';
const IO_HEAD = '| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline | 契約 |\n|---|---|---|---|---|---|';

// 對外 I/O 表沒有契約欄就補一欄「-」;表以外的行照留
function withContractColumn(ioText) {
  if (!ioText.trim()) return IO_HEAD;
  const lines = ioText.split(/\r?\n/);
  const head = lines.find((l) => /^\s*\|/.test(l)) || '';
  if (/契約/.test(head)) return ioText;
  let row = 0;
  return lines.map((l) => {
    if (!/^\s*\|/.test(l)) return l;
    row++;
    const body = l.replace(/\s*\|\s*$/, '');
    return row === 2 ? `${body}|---|` : `${body} | ${row === 1 ? '契約' : '-'} |`;
  }).join('\n');
}

function globalZone(boundary, ioText) {
  return [
    '## 全域 Law',
    '不得違反:整個專案任何一條切片、任何一條 pipeline 都要守。三類各住一區,各有一道 lint 自動確認(`lawful lint global` 一次查完);新增、修改、放寬、替換或刪除都要開發者明確批准。',
    '',
    '### 領域不變量',
    '無',
    '',
    '### 架構:四層',
    boundary || LAYER_TEMPLATE,
    '',
    '### 契約:對外 I/O',
    withContractColumn(ioText),
    '',
  ];
}

// 目標檔的里程碑表:只有編號的列,英文名從它第一條綁定的 pipeline 推;沒綁的留給 lawful:objective 定。回 { lines, named, unnamed }
function nameMilestones(lines) {
  const named = [];
  const unnamed = [];
  let inTable = false;
  const out = lines.map((l) => {
    if (!/^\s*\|/.test(l)) { inTable = false; return l; }
    const cells = l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
    if (cells[0] === '里程碑') { inTable = true; return l; }
    if (!inTable || !/^M-\d+$/.test(cells[0])) return l;
    const bind = (/P-\d{3}-([a-z0-9-]+)/.exec(cells[2] || '') || [])[1];
    if (!bind) { unnamed.push(cells[0]); return l; }
    named.push(`${cells[0]}-${bind}`);
    cells[0] = `${cells[0]}-${bind}`;
    return `| ${cells.join(' | ')} |`;
  });
  return { lines: out, named, unnamed };
}

// 清單項「- <鍵>:…」連同它縮排的子項一起拿掉
function dropItems(lines, key) {
  const out = [];
  let dropped = 0;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`^- ${key}[::]`).test(lines[i])) {
      dropped++;
      while (i + 1 < lines.length && /^\s{2,}- /.test(lines[i + 1])) i++;
      continue;
    }
    out.push(lines[i]);
  }
  return { lines: out, dropped };
}

function sectionText(secs, title) {
  const s = secs.find((x) => x.level === 2 && x.title === title);
  return s ? s.lines.join('\n').replace(/^\s*\n+|\s+$/g, '') : '';
}

// objectives.md → 一個目標一份的內容。assignRequirements:目標沒寫需求時照順序配 R-n;不配就留 R-0 讓人補。
function splitObjectives(text, { assignRequirements = false, date } = {}) {
  const { body } = parseFrontmatter(text);
  const secs = sections(body);
  const head = secs.find((s) => s.level === 1) || secs[0];
  const noteLine = (head && !/^O-\d+/.test(head.title) ? head.lines : []).map((l) => l.replace(/^[-*]\s*/, '').trim()).find((l) => /^優先[::]/.test(l)) || '';
  const priorityNote = noteLine.replace(/^優先[::]\s*/, '').trim();
  const objs = [];
  for (let i = 0; i < secs.length; i++) {
    const s = secs[i];
    if (s.level !== 2) continue;
    const m = /^(O-\d+)\s*[::]\s*(.*)$/.exec(s.title);
    if (!m) continue;
    const lines = [...s.lines];
    for (let j = i + 1; j < secs.length && secs[j].level > 2; j++) lines.push(`${'#'.repeat(secs[j].level)} ${secs[j].title}`, ...secs[j].lines);
    const field = (k) => {
      const l = lines.find((x) => new RegExp(`^- ${k}[::]`).test(x));
      return l ? l.replace(/^- [^::]*[::]\s*/, '').trim() : '';
    };
    const id = m[1];
    const title = m[2].trim();
    const criteria = field('判準');
    const priority = field('優先') || '<1 到 4,1 最高>';
    const requirement = field('需求') || (assignRequirements ? `R-${objs.length + 1}` : 'R-0');
    const binds = lines.filter((l) => /^\s*\|/.test(l)).flatMap((l) => l.match(/P-\d{3}-[a-z0-9-]+/g) || []);
    const slug = binds.length ? binds[0].replace(/^P-\d{3}-/, '') : 'unnamed';
    // 需求、優先進 frontmatter;判準變成那條需求的驗收;目標自己沒有 Law
    const kept = lines.filter((l) => !/^- (需求|優先|判準|Law)[::]/.test(l));
    const bodyLines = nameMilestones(kept).lines;
    while (bodyLines.length && !bodyLines[0].trim()) bodyLines.shift();
    const fullName = `${requirement}-${id}-${slug}`;
    const content = ['---', `id: ${id}`, `requirement: ${requirement}`, `priority: ${priority}`, `updated: ${date}`, '---', `# ${fullName}:${title}`, '', ...bodyLines].join('\n').replace(/\s+$/, '') + '\n';
    objs.push({ id, title, requirement, assigned: !field('需求'), law: criteria, fullName, file: `${fullName}.md`, content, slug });
  }
  return { priorityNote, objs };
}

// Cone.md「專案約束」補一行「- 優先:…」;已經有就不動
function withPriorityNote(coneText, priorityNote) {
  if (!priorityNote || /^- 優先[::]/m.test(coneText)) return coneText;
  const lines = coneText.split(/\r?\n/);
  const h = lines.findIndex((l) => /^## 專案約束\s*$/.test(l));
  if (h < 0) return coneText;
  let end = h + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end++;
  while (end > h + 1 && !lines[end - 1].trim()) end--;
  lines.splice(end, 0, `- 優先:${priorityNote}`);
  return lines.join('\n');
}

export function migrateCone(root, { write = false, date = new Date().toISOString().slice(0, 10) } = {}) {
  const lawfulDir = path.join(root, '.lawful');
  const sysFile = path.join(lawfulDir, 'system.md');
  const coneFile = path.join(lawfulDir, 'Cone.md');
  const objFile = path.join(lawfulDir, 'objectives.md');
  const objDir = path.join(lawfulDir, 'objectives');
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');
  const hasCone = fs.existsSync(coneFile);
  const hasSys = fs.existsSync(sysFile);
  const hasObjFile = fs.existsSync(objFile);
  if (hasCone && !hasObjFile) return { text: `${rel(coneFile)} 已經存在、目標也已經在 objectives/,這棵樹不用換`, exitCode: 0 };
  if (!hasCone && !hasSys) return { text: `${rel(lawfulDir)} 裡沒有 system.md,也沒有 Cone.md;lawful:project 建 Cone.md`, exitCode: 1 };
  const out = ['# migrate cone 帳本', ''];
  const writes = [];   // [abs, text]
  const objText = hasObjFile ? fs.readFileSync(objFile, 'utf8') : '';
  let split;
  if (!hasCone) {
    const sysText = fs.readFileSync(sysFile, 'utf8');
    const { fm, body } = parseFrontmatter(sysText);
    const secs = sections(body);
    const titleLine = (body.split(/\r?\n/).find((l) => /^# /.test(l)) || '# <專案名>:<一句話>').trim();
    const language = fm.language || '';
    const vision = sectionText(secs, '願景');
    const purpose = sectionText(secs, '目的');
    const tools = sectionText(secs, '語言與工具');
    const boundary = sectionText(secs, '邊界');
    const ioText = sectionText(secs, '對外 I/O');
    const plSec = secs.find((x) => x.level === 2 && x.title === 'Pipelines');
    const plTable = plSec ? parseTable(plSec.lines) : null;
    const kindOf = new Map((plTable ? plTable.rows : []).map((r) => [stripTicks(r[0] || ''), (r[1] || '').trim()]));
    split = splitObjectives(objText, { assignRequirements: true, date });
    const reqs = split.objs;
    const cone = [
      '---',
      `language: ${language || '<haskell | …>'}`,
      `updated: ${date}`,
      '---',
      titleLine,
      '',
      '## 願景',
      [vision || '<北極星,第一段一到三句:這個專案要交出的、世界上還沒有的東西是什麼,替誰改變了什麼。>', purpose].filter(Boolean).join('\n\n'),
      '',
      '## 需求',
      ...(reqs.length
        ? reqs.flatMap((r, i) => [...(i ? [''] : []), `### ${r.requirement}:${r.title}`, `- 驗收:${r.law || '<一句可判定的話:這條需求達成時,什麼一定為真>'}`])
        : ['### R-1:<一句話:誰在什麼情況下要得到什麼>', '- 驗收:<一句可判定的話:這條需求達成時,什麼一定為真>']),
      '',
      ...globalZone(boundary, ioText),
      '## 專案約束',
      `- 語言:${language || '<haskell | …>'}`,
      ...tools.split(/\r?\n/).filter((l) => l.trim() && !/^- 語言[::]/.test(l)),
      '- 套件與框架:無',
      ...(split.priorityNote ? [`- 優先:${split.priorityNote}`] : []),
      '',
    ].join('\n');
    const modFile = path.join(lawfulDir, 'modules.md');
    const modText = fs.existsSync(modFile) ? fs.readFileSync(modFile, 'utf8') : '';
    const modBody = parseFrontmatter(modText).body;
    const hasUnitSec = sections(modBody).some((s) => s.level === 2 && s.title === '模組單元');
    const unitTable = hasUnitSec ? '' : modBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l)).join('\n');
    const modules = hasUnitSec ? null : [
      '# 模組表',
      '',
      '## 模組單元',
      unitTable || '| 模組 | 層 | 職責 |\n|---|---|---|',
      '',
    ].join('\n');
    const pipelinesDir = path.join(lawfulDir, 'pipelines');
    const pipelineFiles = fs.existsSync(pipelinesDir) ? fs.readdirSync(pipelinesDir).filter((f) => /^P-\d{3}-.+\.md$/.test(f)).sort() : [];
    const kindEdits = [];
    for (const f of pipelineFiles) {
      const abs = path.join(pipelinesDir, f);
      const text = fs.readFileSync(abs, 'utf8');
      if (/^kind:/m.test(text)) continue;
      const kind = kindOf.get(path.basename(f, '.md')) || '<IO 介面 | 子流>';
      const next = text.replace(/^(description:.*\r?\n)/m, `$1kind: ${kind}\n`);
      kindEdits.push({ abs, rel: rel(abs), kind, next, changed: next !== text });
    }
    out.push(`- ${rel(coneFile)}:建,願景${purpose ? '(目的接成第二段)' : ''}、需求 ${reqs.length} 條(${reqs.map((r) => `${r.requirement} ← ${r.id}${r.law ? '' : ',驗收留佔位符'}`).join('、') || '沒有目標,留一條模板'})、全域 Law 區(四層${boundary ? '' : '是模板'}、對外 I/O${ioText ? '' : '是模板'}、領域不變量寫「無」)、專案約束(語言與工具照搬${split.priorityNote ? ',優先各級那行搬進來' : ''})`);
    out.push(`- ${rel(modFile)}:${modules === null ? '已經有「模組單元」節,不動' : '整理成只有「模組單元」表'}`);
    for (const e of kindEdits) out.push(`- ${e.rel}:frontmatter 補 kind: ${e.kind}${e.changed ? '' : '(找不到 description 行,要自己補)'}`);
    writes.push([coneFile, cone]);
    if (modules !== null) writes.push([modFile, modules]);
    for (const e of kindEdits) if (e.changed) writes.push([e.abs, e.next]);
  } else {
    split = splitObjectives(objText, { assignRequirements: false, date });
    const cone = fs.readFileSync(coneFile, 'utf8');
    const next = withPriorityNote(cone, split.priorityNote);
    if (next !== cone) {
      out.push(`- ${rel(coneFile)}:「專案約束」補一行「- 優先:${split.priorityNote}」`);
      writes.push([coneFile, next]);
    }
  }
  if (hasObjFile) {
    for (const o of split.objs) {
      const notes = [o.assigned ? `需求配 ${o.requirement}` : '', o.requirement === 'R-0' ? 'frontmatter 的 requirement 與檔名的 R-0 要換成真的 R-n' : '', o.slug === 'unnamed' ? 'slug 沒有綁定的 pipeline 可推,先叫 unnamed,改名要連檔名一起改' : 'slug 從第一條綁定的 pipeline 推,不對就改檔名'].filter(Boolean);
      out.push(`- ${rel(path.join(objDir, o.file))}:建(${o.id};${notes.join(';')})`);
      writes.push([path.join(objDir, o.file), o.content]);
    }
    if (!split.objs.length) out.push(`- ${rel(objFile)}:沒有任何目標`);
    out.push(`- ${rel(objFile)}:刪`);
  }
  if (hasSys) out.push(`- ${rel(sysFile)}:刪`);
  if (!write) {
    out.push('', '以上只是帳本;lawful migrate cone --write 才落地');
    return { text: out.join('\n'), exitCode: 0 };
  }
  if (split.objs.length) fs.mkdirSync(objDir, { recursive: true });
  for (const [abs, text] of writes) fs.writeFileSync(abs, text);
  if (hasObjFile) fs.unlinkSync(objFile);
  if (hasSys) fs.unlinkSync(sysFile);
  out.push('', '都寫了;接著 lawful status 看警訊,需求的驗收與領域不變量由 lawful:project 對談補齊,目標檔的 slug 與還沒有英文名的里程碑由 lawful:objective 定');
  return { text: out.join('\n'), exitCode: 0 };
}

// migrate laws [--write]:全域 Law 三類收進 Cone.md「## 全域 Law」區,需求附的那一句叫驗收,目標沒有 Law。先印帳本,--write 才落地。
// - modules.md 的「## 邊界」→ Cone.md「### 架構:四層」;「## 對外 I/O」→「### 契約:對外 I/O」(補契約欄「-」);補「### 領域不變量」寫「無」
// - Cone.md 需求的「- Law:」→「- 驗收:」,「- 蘊含:」刪掉;目標檔的「- Law:」刪掉;只有編號的里程碑從第一條綁定的 pipeline 補英文名
// - pipeline 的 status: frozen → verified
// - .lawful/spikes/ 與測試裡的 O-n#LAW、R-n#LAW 不屬於這棵樹的體系:列出來給人判,不動
export function migrateLaws(root, { write = false } = {}) {
  const lawfulDir = path.join(root, '.lawful');
  const coneFile = path.join(lawfulDir, 'Cone.md');
  const modFile = path.join(lawfulDir, 'modules.md');
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');
  if (!fs.existsSync(coneFile)) return { text: `${rel(lawfulDir)} 裡沒有 Cone.md;只有 system.md 的樹先 lawful migrate cone --write`, exitCode: 1 };
  const out = ['# migrate laws 帳本', ''];
  const writes = [];
  const lf = (s) => s.replace(/\r\n/g, '\n');

  // modules.md:兩節搬走
  let boundary = '';
  let ioText = '';
  if (fs.existsSync(modFile)) {
    const modText = lf(fs.readFileSync(modFile, 'utf8'));
    const secs = sections(parseFrontmatter(modText).body);
    boundary = sectionText(secs, '邊界');
    ioText = sectionText(secs, '對外 I/O');
    if (secs.some((s) => s.level === 2 && (s.title === '邊界' || s.title === '對外 I/O'))) {
      const lines = modText.split('\n');
      const kept = [];
      let skip = false;
      for (const l of lines) {
        if (/^## /.test(l)) skip = /^## (邊界|對外 I\/O)\s*$/.test(l);
        if (!skip) kept.push(l);
      }
      const next = kept.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
      out.push(`- ${rel(modFile)}:「邊界」與「對外 I/O」兩節搬進 Cone.md 的全域 Law 區,這一檔只剩「模組單元」表`);
      writes.push([modFile, next]);
    }
  }

  // Cone.md
  const coneText = lf(fs.readFileSync(coneFile, 'utf8'));
  let lines = coneText.split('\n');
  const reqFrom = lines.findIndex((l) => /^## 需求\s*$/.test(l));
  let reqTo = reqFrom < 0 ? -1 : lines.findIndex((l, i) => i > reqFrom && /^## /.test(l));
  if (reqTo < 0) reqTo = lines.length;
  let renamed = 0;
  let implied = 0;
  if (reqFrom >= 0) {
    const head = lines.slice(0, reqFrom + 1);
    let body = lines.slice(reqFrom + 1, reqTo).map((l) => (/^- Law[::]/.test(l) ? (renamed++, l.replace(/^- Law([::])/, '- 驗收$1')) : l));
    const d = dropItems(body, '蘊含');
    body = d.lines;
    implied = d.dropped;
    lines = [...head, ...body, ...lines.slice(reqTo)];
  }
  const hasZone = lines.some((l) => /^## 全域 Law\s*$/.test(l));
  if (!hasZone) {
    let at = lines.findIndex((l) => /^## 專案約束\s*$/.test(l));
    if (at < 0) at = lines.length;
    lines.splice(at, 0, ...globalZone(boundary, ioText));
  } else if (boundary || ioText) {
    out.push(`- ${rel(coneFile)}:已經有「## 全域 Law」區;modules.md 搬出來的「邊界」與「對外 I/O」要自己併進去(這一步不猜怎麼合)`);
  }
  const coneNext = lines.join('\n');
  if (coneNext !== coneText) {
    const notes = [renamed ? `需求的「- Law:」改成「- 驗收:」${renamed} 條` : '', implied ? `蘊含說明刪 ${implied} 條` : '', hasZone ? '' : `補「## 全域 Law」區(領域不變量寫「無」、四層${boundary ? '照搬' : '是模板'}、對外 I/O${ioText ? '照搬並補契約欄' : '是模板'})`].filter(Boolean);
    out.push(`- ${rel(coneFile)}:${notes.join(';')}`);
    writes.push([coneFile, coneNext]);
  }

  // 目標檔
  const objDir = path.join(lawfulDir, 'objectives');
  for (const f of fs.existsSync(objDir) ? fs.readdirSync(objDir).filter((x) => /\.md$/.test(x)).sort() : []) {
    const abs = path.join(objDir, f);
    const text = lf(fs.readFileSync(abs, 'utf8'));
    const d = dropItems(text.split('\n'), 'Law');
    const m = nameMilestones(d.lines);
    const next = m.lines.join('\n').replace(/\n{3,}/g, '\n\n');
    const notes = [d.dropped ? '目標的「- Law:」刪掉(目標達成 = 里程碑全部達成)' : '', m.named.length ? `里程碑補英文名:${m.named.join('、')}` : '', m.unnamed.length ? `${m.unnamed.join('、')} 還沒綁 pipeline,英文名由 lawful:objective 定` : ''].filter(Boolean);
    if (notes.length) out.push(`- ${rel(abs)}:${notes.join(';')}`);
    if (next !== text) writes.push([abs, next]);
  }

  // pipeline 的 status
  const pipDir = path.join(lawfulDir, 'pipelines');
  for (const f of fs.existsSync(pipDir) ? fs.readdirSync(pipDir).filter((x) => /^P-\d{3}-.+\.md$/.test(x)).sort() : []) {
    const abs = path.join(pipDir, f);
    const text = lf(fs.readFileSync(abs, 'utf8'));
    const next = text.replace(/^status:\s*frozen\s*$/m, 'status: verified');
    if (next !== text) {
      out.push(`- ${rel(abs)}:status frozen 改成 verified`);
      writes.push([abs, next]);
    }
  }

  // 人要判的
  const judge = [];
  const spikesDir = path.join(lawfulDir, 'spikes');
  if (fs.existsSync(spikesDir)) judge.push(`${rel(spikesDir)}/ 還有 ${fs.readdirSync(spikesDir).length} 份:這棵樹不讀它。結論值得留的寫成 ADR 或搬進那條 pipeline 的「決定」,其餘刪掉;根目錄的 spike/ 也一樣`);
  const marks = new Map();
  const walk = (dir, depth) => {
    if (depth > 6 || !fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!/^(\.git|\.lawful|node_modules|dist-newstyle|dist|\.stack-work|target)$/.test(e.name)) walk(path.join(dir, e.name), depth + 1); continue; }
      if (!/\.(hs|ts|js|py|rs|go)$/.test(e.name)) continue;
      const src = fs.readFileSync(path.join(dir, e.name), 'utf8');
      for (const m of src.matchAll(/"((?:R|O)-\d+#LAW)"/g)) marks.set(m[1], rel(path.join(dir, e.name)));
    }
  };
  walk(root, 0);
  for (const [m, f] of [...marks].sort()) judge.push(/^R-/.test(m) ? `${f} 的 "${m}":需求的驗收測試歸屬是 "${m.replace('#LAW', '#ACCEPT')}",改字串` : `${f} 的 "${m}":目標沒有 Law,這條測試要嘛改歸到那條需求的驗收("R-n#ACCEPT"),要嘛拿掉歸屬當內部測試`);
  if (judge.length) out.push('', '人要判的:', ...judge.map((j) => `- ${j}`));

  if (!writes.length && !judge.length) return { text: '這棵樹已經是全域 Law 區、驗收、里程碑英文名的長相,不用換', exitCode: 0 };
  if (!write) {
    out.push('', '以上只是帳本;lawful migrate laws --write 才落地');
    return { text: out.join('\n'), exitCode: 0 };
  }
  for (const [abs, text] of writes) fs.writeFileSync(abs, text);
  out.push('', '都寫了;接著 lawful lint global 與 lawful status 看警訊,領域不變量由 lawful:project 對談補,對外 I/O 的契約欄由 lawful:law-design 在 law 拍板時填');
  return { text: out.join('\n'), exitCode: 0 };
}
