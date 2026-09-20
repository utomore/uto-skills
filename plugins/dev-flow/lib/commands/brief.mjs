// brief <skill> [<目標>]:一個角色開工要的東西一次印完——規章的節、目標文檔、逐條狀態、簽名與型別的宣告、
// 最內層、測試怎麼寫。唯讀;永遠 exit 0,問題用文字講(skill 載入時由 harness 執行,非 0 會被讀成載入失敗)。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, sections } from '../markdown.mjs';
import { matchModule } from '../design.mjs';
import { findType } from '../source.mjs';
import { analyze, docDetail } from './status.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// 每個 skill 開工要讀的規章節。這張表是「誰讀什麼」的唯一來源。
const RULES = {
  qa: [['roles.md', ['角色', '委派', '驗收測試', 'qa 的交付']], ['features.md', ['節', '什麼要有 law', '提問(GAP)']], ['boundary.md', ['測試與邊界']], ['tooling.md', ['測試歸屬']]],
  refactor: [['roles.md', ['角色', '分支與所有權', '委派', '切片']], ['features.md', ['節', '提問(GAP)']], ['boundary.md', ['層', '匯出']]],
};
// 每個 skill 的 brief 由哪幾塊組成
const BLOCKS = {
  qa: ['doc', 'detail', 'declarations', 'innermost', 'testing'],
  refactor: ['doc', 'detail', 'declarations', 'files'],
};
// 目標可以是一條需求的驗收或一條領域不變量的 skill
const TOP_TARGETS = new Set(['qa']);
export const briefSkills = Object.keys(RULES);

const INLINE_LINES = 400; // 最內層內嵌的總行數上限;超過的檔案只列匯出
const TYPE_LINES = 40;    // 一個型別宣告最多印幾行
const IDENT_STYLE = new Set(['python', 'rust']); // 測試名必須是識別字的語言

// 雜湊一律算 LF 的版本:同一份內容在 CRLF 的工作樹上指紋不變
const sha8 = (s) => crypto.createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex').slice(0, 8);
const fence = (lang, lines) => ['```' + lang, ...lines, '```'];

function ruleSections(skill) {
  const out = [];
  let raw = '';
  for (const [file, titles] of RULES[skill]) {
    const abs = path.join(PLUGIN_ROOT, 'rules', file);
    const text = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
    const secs = sections(parseFrontmatter(text).body).filter((s) => s.level === 2);
    for (const t of titles) {
      const s = secs.find((x) => x.title === t);
      const body = s ? s.lines.join('\n').trim() : `(${file} 裡沒有「${t}」這一節)`;
      raw += body;
      out.push(`### ${file}「${t}」`, body, '');
    }
  }
  return { lines: out, hash: sha8(raw) };
}

// 宣告從 line 開始,到參數的括號收完為止;本體的開頭({、=>)之後不印
function declarationText(srcLines, line) {
  const out = [];
  let depth = 0, seen = false;
  for (let i = line - 1; i < srcLines.length && out.length < 14; i++) {
    const l = srcLines[i];
    for (const ch of l) {
      if (ch === '(') { depth++; seen = true; } else if (ch === ')') depth--;
    }
    out.push(l);
    if (seen && depth <= 0) break;
    if (!seen && /[{:=]\s*$/.test(l)) break;
  }
  const last = out.length - 1;
  out[last] = out[last].replace(/\s*(\{|=>)\s*$/, '').replace(/\s+$/, '');
  return out;
}

// 型別宣告的區塊:純資料的(type / interface / struct / enum …)整塊印;class 只印成員那一層,方法的本體不印
function typeBlock(srcLines, name) {
  const decl = new RegExp(`\\b(type|interface|class|enum|struct|trait|data|newtype)\\s+${name}\\b|^${name}\\s*=`);
  const at = srcLines.findIndex((l) => decl.test(l));
  if (at < 0) return null;
  const isClass = /\bclass\s/.test(srcLines[at]);
  const out = [];
  if (/[{(]/.test(srcLines[at]) || /\{\s*$/.test(srcLines[at + 1] || '')) {
    let depth = 0, opened = false;
    for (let i = at; i < srcLines.length && out.length < TYPE_LINES; i++) {
      const l = srcLines[i];
      const before = depth;
      for (const ch of l) { if (ch === '{') { depth++; opened = true; } else if (ch === '}') depth--; }
      if (!isClass || before <= 1) out.push(isClass && before === 1 && depth > 1 ? l.replace(/\s*\{\s*$/, '') : l);
      if (opened && depth <= 0) break;
      if (!opened && /;\s*$/.test(l)) break;
    }
  } else {
    // 以縮排分塊的語言:只印成員那一層(欄位、裝飾器、方法的標頭),方法的本體不印
    const indent = srcLines[at].search(/\S/);
    for (let i = at - 1; i >= 0 && /^\s*@/.test(srcLines[i]); i--) out.unshift(srcLines[i]);
    out.push(srcLines[at]);
    let member = -1, open = 0;
    for (let i = at + 1; i < srcLines.length && out.length < TYPE_LINES; i++) {
      const l = srcLines[i];
      if (!l.trim()) continue;
      const ind = l.search(/\S/);
      if (ind <= indent && !open) break;
      if (member < 0) member = ind;
      if (ind !== member && !open) continue;
      out.push(l);
      for (const ch of l) { if (ch === '(') open++; else if (ch === ')') open--; }
      if (open < 0) open = 0;
    }
  }
  return { line: at + 1, lines: out };
}

const typeNamesIn = (text) => [...new Set((text.match(/\b[A-Z][A-Za-z0-9_]*\b/g) || []))];

function sideOf(design, file) {
  const langs = design.system ? design.system.languages : [];
  const hit = langs.filter((l) => l.dir && (file === l.dir || file.startsWith(l.dir + '/'))).sort((a, b) => b.dir.length - a.dir.length)[0];
  return hit || langs[0] || { dir: '', name: '' };
}

function commandFor(design, key, side) {
  const c = design.system ? design.system.commands[key] : null;
  if (!c) return null;
  if (typeof c === 'string') return c;
  return c[side.dir] || Object.entries(c).map(([d, v]) => `${d} = ${v}`).join(';');
}

export function briefCommand(root, design, source, adapter, skill, target, { fingerprint = false, noRules = false } = {}) {
  const say = (text) => ({ text, exitCode: 0 });
  if (!RULES[skill]) return say(`brief 沒有「${skill}」這個 skill;有的是:${briefSkills.join('、')}`);
  const rules = ruleSections(skill);
  const a = design && source ? analyze(design, source, adapter, null) : null;
  const docs = a ? [...a.info.values()] : [];
  const x = target ? docs.find((v) => v.p.fullName === target || v.p.id === target) : null;

  // 目標是一條需求的驗收(R-n)或一條領域不變量(INV-n)
  const sys = design ? design.system : null;
  const req = sys && /^R-\d+$/.test(target) ? sys.requirements.find((r) => r.id === target) : null;
  const inv = sys && /^INV-\d+$/.test(target) ? sys.invariants.find((v) => v.id === target) : null;
  const top = TOP_TARGETS.has(skill) && (req || inv) ? { id: target, law: req ? req.accept : inv.law, title: req ? req.title : inv.title, kind: req ? '需求的驗收' : `領域不變量${inv.kind ? ` [${inv.kind}]` : ''}`, mark: req ? 'ACCEPT' : 'LAW' } : null;
  const topLines = top && top.law ? [top.law.forall, ...top.law.given, top.law.conclusion].filter(Boolean) : [];

  const docText = x ? fs.readFileSync(x.p.abs, 'utf8') : '';
  const hashed = x ? sha8(docText) : top ? sha8(`${top.title}\n${topLines.join('\n')}`) : '-';
  const print = `brief ${skill} ${x ? x.p.fullName : target || '(沒有目標)'} @doc:${hashed} rules:${rules.hash}`;
  if (fingerprint) return say(print);

  const out = [print, '這一行是指紋:被委派的角色在回報的第一項照抄它。以下是開工要的全部,不必再去找規章、文檔或宣告。', ''];
  if (noRules) out.push('# 規章', '', '(--no-rules:規章的節這一場已經給過,不重印)', '');
  else out.push('# 規章', '', ...rules.lines);

  if (!target) {
    out.push('# 目標', '', `目標未指定。定出目標之後跑一次:devflow brief ${skill} <文檔全名> [--root <工作樹>] --no-rules`);
    return say(out.join('\n'));
  }
  if (!design) return say([...out, '# 目標', '', '這個目錄底下沒有 .design/:工作目錄不是專案根目錄,或 --root 沒指到工作樹。停下,回報。'].join('\n'));
  if (!source) return say([...out, '# 目標', '', 'system.md 的 language 欄沒有可用的 adapter,程式碼對不了帳:宣告那幾塊印不出來。停下,回報。'].join('\n'));
  if (!x && !top) {
    const names = design.docs.map((d) => d.fullName);
    return say([...out, '# 目標', '', `沒有 ${target} 這份文檔${TOP_TARGETS.has(skill) ? ',也沒有這條需求或領域不變量' : ''};這棵樹有的是:${names.length ? names.join('、') : '(一份都沒有)'}。停下,回報。`].join('\n'));
  }

  const srcCache = new Map();
  const srcLines = (file) => {
    if (!srcCache.has(file)) {
      const abs = path.join(root, file);
      srcCache.set(file, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').split(/\r?\n/) : []);
    }
    return srcCache.get(file);
  };

  // Steps 的宣告與它們用到的專案型別(型別宣告裡提到的專案型別一路展開到沒有新的為止)
  const declarations = (steps, lang) => {
    const types = new Set();
    for (const s of steps) {
      const where = s.hit ? `${s.hit.file}:${s.hit.line}` : `${s.module}(${s.state})`;
      out.push(`### ${s.index} \`${s.name}\`  ${where}${s.ref ? `  見 ${s.ref}` : ''}`);
      if (s.hit && s.hit.line) out.push(...fence(lang, declarationText(srcLines(s.hit.file), s.hit.line)));
      else out.push(`文檔的簽名:\`${s.sigText}\``);
      out.push('');
      for (const t of typeNamesIn(s.sigText)) types.add(t);
    }
    const found = new Map();
    const queue = [...types];
    while (queue.length && found.size < 40) {
      const t = queue.shift();
      if (found.has(t)) continue;
      const hit = findType(source, t)[0];
      const b = hit ? typeBlock(srcLines(hit.file), t) : null;
      found.set(t, b ? { file: hit.file, ...b } : null);
      if (b) for (const u of typeNamesIn(b.lines.join(' '))) if (!found.has(u)) queue.push(u);
    }
    const shown = [...found.entries()].filter(([, b]) => b).sort(([p], [q]) => p.localeCompare(q));
    for (const [t, b] of shown) out.push(`### 型別 \`${t}\`  ${b.file}:${b.line}`, ...fence(lang, b.lines), '');
    if (!shown.length) out.push('(簽名用到的型別都不是這個專案宣告的)', '');
  };

  const innermost = (lang) => {
    const inner = sys && sys.layers[0] ? sys.layers[0].name : null;
    out.push(`# 最內層${inner ? `(${inner})` : ''}`, '');
    const files = inner && design.modules ? [...source.files.keys()].filter((f) => { const m = matchModule(design.modules.entries, f); return m && m.layer === inner; }).sort() : [];
    if (!files.length) out.push('(模組表裡沒有住在最內層的檔案)', '');
    let budget = INLINE_LINES;
    for (const f of files) {
      const lines = srcLines(f);
      const m = source.files.get(f);
      const names = (m.exports || m.signatures.map((s) => s.name)).join('、') || '(沒有匯出)';
      if (lines.length <= budget) {
        budget -= lines.length;
        out.push(`### ${f}(${lines.length} 行,全文)`, ...fence(lang, lines.join('\n').replace(/\s+$/, '').split('\n')), '');
      } else out.push(`### ${f}(${lines.length} 行,超過內嵌上限,只列匯出;要用再 Read)`, `匯出:${names}`, '');
    }
  };

  const testing = (side, id, name, marks) => {
    const ident = IDENT_STYLE.has(side.name);
    const form = (m) => (ident ? `${id}#${m}`.toLowerCase().replace(/-/g, '_').replace(/#/g, '__') : `"${id}#${m}"`);
    out.push('# 測試怎麼寫', '');
    out.push(`- 子集測試指令:${commandFor(design, '測試(子集)', side) || '(system.md「語言與工具」沒有寫)'}`);
    out.push(`- 歸屬寫法:${ident ? '識別字' : '字串'},${marks.map(form).join('、')}`);
    out.push(`- 測試檔以 ${name} 命名`);
    // 範例優先挑別的目標的測試:這個目標自己的測試正是 qa 要寫的東西
    const own = (t) => (t.markers.some((m) => m.startsWith(`${id}#`)) ? 1 : 0);
    const tests = source.testFiles.filter((t) => !t.inline && (!side.dir || t.file.startsWith(side.dir + '/'))).sort((p, q) => own(p) - own(q) || q.markers.length - p.markers.length || p.file.localeCompare(q.file));
    out.push(`- 現有的測試檔:${tests.length ? tests.map((t) => t.file).sort().join('、') : '(還沒有)'}`);
    if (tests.length) out.push('', `### 這個專案的測試長這樣:${tests[0].file} 的開頭`, ...fence(side.name || '', srcLines(tests[0].file).slice(0, 30)));
    out.push('');
  };

  if (top) {
    out.push(`# 目標:${top.id}(${top.kind})`, '', `${top.id}:${top.title}`);
    if (!topLines.length) out.push('', '這一條只有一句話,沒有三行式:寫不出可判定的斷言。停下,回報。');
    else out.push(...fence('', topLines), '');
    // 三行裡的識別字對到哪份文檔的 Steps,就印那份的 Steps 與宣告;領域不變量只引用最內層
    const names = new Set(topLines.join(' ').match(/[A-Za-z_][A-Za-z0-9_.]*/g) || []);
    const touched = !req ? [] : docs.map((d) => ({ d, steps: d.steps.filter((s) => names.has(s.name) && !s.ref) })).filter((t) => t.steps.length);
    const side = sideOf(design, touched[0] && touched[0].steps[0] ? touched[0].steps[0].module : '');
    for (const t of touched) {
      out.push(`# 引用到的文檔:${t.d.p.fullName}(${t.d.p.file})`, '');
      const stepsSec = t.d.p.sections.find((s) => s.title === 'Steps');
      if (stepsSec) out.push(...stepsSec.lines.filter((l) => l.trim()), '');
      declarations(t.steps, side.name || '');
    }
    if (!touched.length && req) out.push('# 引用到的文檔', '', '(三行裡的識別字沒有對到任何一份文檔的 Steps)', '');
    innermost(side.name || '');
    testing(side, top.id, top.id, [top.mark]);
    return say(out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, ''));
  }

  const blocks = BLOCKS[skill];
  const side = sideOf(design, x.steps[0] ? x.steps[0].module : '');
  const lang = side.name || '';

  // 文檔包進四個反引號的圍欄:它自己的標題與程式碼區塊才不會跟 brief 的混在一起
  if (blocks.includes('doc')) out.push(`# 目標文檔:${x.p.file}`, '', '````markdown', docText.replace(/\r\n/g, '\n').replace(/\s+$/, ''), '````', '');

  if (blocks.includes('detail')) {
    const d = docDetail(design, source, adapter, null, '', x.p.fullName).text.split('\n');
    const from = d.indexOf('## Steps');
    out.push('# 逐條狀態(文檔對程式碼;沒有給測試輸出,law 的紅綠不在這裡)', '', ...d.slice(from < 0 ? 0 : from).map((l) => l.replace(/^## /, '### ')), '');
  }

  if (blocks.includes('declarations')) {
    out.push('# 宣告', '');
    out.push(skill === 'qa' ? '只有宣告,沒有本體:測試從這裡與文檔寫,不打開這些檔的本體。' : 'Steps 上的簽名與型別宣告不准改;本體在下面「要開的檔」。', '');
    declarations(x.steps, lang);
  }

  if (blocks.includes('innermost')) innermost(lang);
  if (blocks.includes('testing')) testing(side, x.p.id, x.p.fullName, ['LAW-1', 'EX-1']);

  if (blocks.includes('files')) {
    out.push('# 要開的檔', '');
    for (const f of [...new Set(x.steps.map((s) => (s.hit ? s.hit.file : s.module)).filter(Boolean))]) out.push(`- ${f}`);
    for (const r of x.refs) {
      const y = a.info.get(r);
      if (y) out.push(`- 引用的 ${r}:文檔 ${y.p.file};程式碼 ${[...new Set(y.steps.map((s) => (s.hit ? s.hit.file : s.module)))].join('、')}`);
    }
    out.push(`- 子集測試指令:${commandFor(design, '測試(子集)', side) || '(system.md「語言與工具」沒有寫)'}`);
    const tests = source.testFiles.filter((t) => !t.inline).map((t) => t.file).sort();
    out.push(`- 測試檔(不准讀、不准寫):${tests.length ? tests.join('、') : '(還沒有)'}`, '');
  }

  return say(out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, ''));
}
