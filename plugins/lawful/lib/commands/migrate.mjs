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

  out.push('## 里程碑候選(從開發階段表來;每個階段的垂直切片是一條或多條里程碑 pipeline,切法由人定)');
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
  out.push(`1. 分組:${groups.size} 組要不要合、各叫什麼;哪幾組是同一條里程碑的 stage`);
  out.push(`2. 里程碑切法:${stages.length} 個階段各切成幾條里程碑 pipeline`);
  out.push(`3. law 形式化:${prose} 條 law 的觀察點是散文,要改寫成只引用 Stages 簽名與 types 匯出的 \`|-\` 行`);
  out.push(`4. 簽名:${missing.length} 條找不到、${mismatched.length} 條不一致,誰對誰錯`);
  out.push(`5. 待確認假設:${asm} 條還在檔上,決定了寫進「決定」,沒決定的開 GAP`);
  out.push(`6. planned 的 ${docs.filter((d) => d.status === 'planned').length} 份:變 draft pipeline 還是變別條的願望 stage`);

  const text = out.join('\n');
  if (write) {
    fs.writeFileSync(write, text + '\n');
    return { text: `帳本寫到 ${path.relative(root, write).split(path.sep).join('/')}(${docs.length} 份文檔)`, exitCode: 0 };
  }
  return { text, exitCode: 0 };
}
