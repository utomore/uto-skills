// brief <skill> [<目標>]:一個 skill 開工要的東西一次印完——規章的節,加上這個 skill 在這個專案裡要看的那幾塊
// (目標文檔、逐條狀態、宣告、需求檔、決策紀錄、分支狀態、lint、status 報告 …)。
// 唯讀;永遠 exit 0,問題用文字講(skill 載入時由 harness 執行,非 0 會被讀成載入失敗)。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, sections } from '../markdown.mjs';
import { matchModule } from '../design.mjs';
import { findType } from '../source.mjs';
import { analyze, branchState, docDetail } from './status.mjs';
import { lintAll, lintGlobal, lintLaws, lintSig, renderLint } from './lint.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// 每個 skill 開工要讀的規章節;'*' 是整份。這張表是「誰讀什麼」的唯一來源。
const RULES = {
  kickoff: [['features.md', ['`.design/`', 'system.md', '願景、需求與里程碑']], ['laws.md', ['Law 與需求']], ['boundary.md', ['模組表']], ['tooling.md', ['language adapter', '收尾定錨']]],
  'require-design': [['features.md', ['願景、需求與里程碑', '完成度']], ['laws.md', ['Law 與需求']], ['tooling.md', ['CLI', 'status 報告', '收尾定錨']]],
  'global-laws': [['laws.md', ['Law 與需求', '全域 Law', '影響範圍與選項', '全域 Law 的變更']], ['boundary.md', '*'], ['features.md', ['提問(GAP)', '完成度']], ['roles.md', ['分支與所有權']], ['tooling.md', ['CLI', '收尾定錨']]],
  'spike-impl': [['roles.md', ['五個階段', '分支與所有權', '角色', '切片', '決策紀錄']], ['features.md', ['願景、需求與里程碑']], ['laws.md', ['Law 與需求', '全域 Law']], ['boundary.md', '*'], ['tooling.md', ['CLI', '跑東西的紀律', '收尾定錨']]],
  'scope-laws': [['features.md', ['feature 與 abstract', '編號與引用', '簽名怎麼寫', 'frontmatter 與 status', '節', '什麼要有 law', '修訂(REV)', '提問(GAP)', '完成度']], ['laws.md', ['Law 怎麼談', 'Law 與需求', '全域 Law', '影響範圍與選項']], ['roles.md', ['分支與所有權', '首跑', '決策紀錄']], ['boundary.md', ['模組表', '對外 I/O']], ['tooling.md', ['CLI', '收尾定錨']]],
  'scope-revise': [['features.md', ['簽名怎麼寫', 'frontmatter 與 status', '節', '什麼要有 law', '修訂(REV)', '提問(GAP)', '完成度']], ['laws.md', ['Law 怎麼談', 'Law 與需求', '影響範圍與選項']], ['roles.md', ['分支與所有權', '首跑']], ['boundary.md', ['模組表', '層']], ['tooling.md', ['CLI', '收尾定錨']]],
  build: [['roles.md', '*'], ['features.md', ['提問(GAP)', '修訂(REV)', '完成度']], ['tooling.md', ['CLI', '測試歸屬', '跑東西的紀律', '收尾定錨']]],
  qa: [['roles.md', ['角色', '委派', '驗收測試', 'qa 的交付']], ['features.md', ['節', '什麼要有 law', '提問(GAP)']], ['boundary.md', ['測試與邊界']], ['tooling.md', ['測試歸屬']]],
  refactor: [['roles.md', ['角色', '分支與所有權', '委派', '切片']], ['features.md', ['節', '提問(GAP)']], ['boundary.md', ['層', '匯出']]],
  abstract: [['features.md', ['收整(abstract)', 'feature 與 abstract', '修訂(REV)', '節']], ['laws.md', ['Law 怎麼談']], ['roles.md', ['分支與所有權']], ['boundary.md', ['層', '模組表']], ['tooling.md', ['CLI', '收尾定錨']]],
  integrate: [['roles.md', ['分支與所有權', '決策紀錄', '整合', '仲裁']], ['features.md', ['提問(GAP)', '完成度', 'ADR']], ['laws.md', ['全域 Law']], ['tooling.md', ['CLI', '跑東西的紀律', '收尾定錨']]],
  status: [['tooling.md', ['CLI', 'status 報告', '收尾定錨']], ['features.md', ['願景、需求與里程碑', '完成度']], ['laws.md', ['Law 與需求', '全域 Law']]],
  audit: [['tooling.md', ['CLI', 'status 報告']], ['boundary.md', '*'], ['features.md', ['願景、需求與里程碑', '節', '什麼要有 law', '完成度', '收整(abstract)']], ['laws.md', ['Law 與需求', '全域 Law', 'Law 怎麼談']]],
  study: [['tooling.md', ['跑東西的紀律', '收尾定錨']], ['features.md', ['`.design/`']]],
};

// 每個 skill 的 brief 由哪幾塊組成,依目標的種類分:doc(文檔全名)、milestone(M-n-<slug>)、top(R-n / INV-n)、none(沒有目標)。
// 沒列的種類 = 這個 skill 不收那種目標。
const BLOCKS = {
  kickoff: { none: ['tree', 'system', 'modules'] },
  'require-design': { none: ['system', 'requirements', 'status'], top: ['system', 'requirements', 'status'] },
  'global-laws': { none: ['branch', 'system', 'requirements', 'gaps', 'lintglobal', 'status'], top: ['branch', 'system', 'requirements', 'gaps', 'lintglobal', 'status'] },
  'spike-impl': { milestone: ['branch', 'tree', 'requirement', 'system', 'modules', 'status'] },
  'scope-laws': { milestone: ['branch', 'tree', 'requirement', 'system', 'modules', 'journal', 'bound'], doc: ['branch', 'doc', 'detail', 'declarations', 'refs', 'requirement', 'system', 'journal', 'gaps', 'lint', 'status'] },
  'scope-revise': { doc: ['branch', 'doc', 'detail', 'declarations', 'refs', 'requirement', 'modules', 'gaps', 'lint', 'status'] },
  build: { doc: ['branch', 'tools', 'modules', 'journal', 'doc', 'detail', 'lint', 'gaps', 'logs', 'status'], milestone: ['branch', 'tools', 'modules', 'journal', 'requirement', 'bound', 'lint', 'gaps', 'logs', 'status'], top: ['branch', 'tools', 'top', 'gaps', 'logs', 'status'] },
  qa: { doc: ['doc', 'detail', 'declarations', 'innermost', 'testing'], top: ['top', 'touched', 'innermost', 'testing'] },
  refactor: { doc: ['doc', 'detail', 'declarations', 'files'] },
  abstract: { none: ['branch', 'modules', 'steps'], doc: ['branch', 'modules', 'doc', 'detail', 'declarations', 'steps'] },
  integrate: { none: ['branch', 'journals', 'tools', 'gaps'] },
  status: { none: ['tools', 'logs'] },
  audit: { none: ['lintall', 'status', 'modules'] },
  study: { none: ['tree', 'tools', 'modules'] },
};
const KIND_WORD = { doc: '一份文檔的全名', milestone: '一條里程碑的全名 M-n-<slug>', top: 'R-n 或 INV-n', none: '不給目標' };
export const briefSkills = Object.keys(RULES);

const INLINE_LINES = 400; // 最內層內嵌的總行數上限;超過的檔案只列匯出
const TYPE_LINES = 40;    // 一個型別宣告最多印幾行
const IDENT_STYLE = new Set(['python', 'rust']); // 測試名必須是識別字的語言
const TARGET_RE = /^(?:[FA]-\d{3}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?|M-\d+(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?|R-\d+|INV-\d+)$/;

// skill 載入時 $ARGUMENTS 是一整串自由文字(可能是開發者打的一句話):從裡面認出目標與旗標,其餘的字不理
export function parseBriefArgs(raw) {
  const tokens = String(raw || '').trim().split(/\s+/).filter(Boolean);
  const out = { target: '', root: '', tests: '', noRules: false, fingerprint: false };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--root' && tokens[i + 1]) out.root = tokens[++i];
    else if (t === '--tests' && tokens[i + 1]) out.tests = tokens[++i];
    else if (t === '--no-rules') out.noRules = true;
    else if (t === '--fingerprint') out.fingerprint = true;
    else if (!out.target && TARGET_RE.test(t)) out.target = t;
  }
  return out;
}

// skill 載入時,一道注入指令的輸出超過約 30KB 會被存成檔、只留預覽;上限是每道指令各算各的。
// 所以整份 brief 切成每段不超過 PART_BYTES 的幾段,SKILL.md 放幾道注入行各取一段。
const PART_BYTES = 28000;
const bytes = (s) => Buffer.byteLength(s, 'utf8');

export function splitParts(text, limit = PART_BYTES) {
  // 先切成塊:圍欄外的標題行是塊的邊界
  const blocks = [];
  let cur = [], fenced = false;
  for (const line of text.split('\n')) {
    if (/^(```|````)/.test(line)) fenced = !fenced;
    if (!fenced && /^#{1,3} /.test(line) && cur.length) { blocks.push(cur); cur = []; }
    cur.push(line);
  }
  if (cur.length) blocks.push(cur);
  // 一塊自己就超過上限的,照行再切
  const units = [];
  for (const b of blocks) {
    if (bytes(b.join('\n')) <= limit) { units.push(b); continue; }
    let piece = [], size = 0;
    for (const l of b) {
      const n = bytes(l) + 1;
      if (size + n > limit && piece.length) { units.push(piece); piece = []; size = 0; }
      piece.push(l);
      size += n;
    }
    if (piece.length) units.push(piece);
  }
  const parts = [];
  let part = [], size = 0;
  for (const u of units) {
    const n = bytes(u.join('\n')) + 1;
    if (size + n > limit && part.length) { parts.push(part.join('\n')); part = []; size = 0; }
    part.push(...u);
    size += n;
  }
  if (part.length) parts.push(part.join('\n'));
  return parts;
}

// 專案根目錄看起來像測試輸出的檔,與它們比最新的原始碼、測試檔新還是舊
export function testLogs(root, source) {
  if (!fs.existsSync(root)) return [];
  const names = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isFile() && /\.(log|txt|xml|json)$/i.test(e.name) && /test|junit|result/i.test(e.name)).map((e) => e.name).sort();
  let newest = null;
  for (const f of source ? [...source.files.keys(), ...source.testFiles.map((t) => t.file)] : []) {
    const abs = path.join(root, f);
    if (!fs.existsSync(abs)) continue;
    const m = fs.statSync(abs).mtimeMs;
    if (!newest || m > newest.m) newest = { f, m };
  }
  return names.map((name) => ({ name, fresh: !newest || fs.statSync(path.join(root, name)).mtimeMs >= newest.m, newest: newest ? newest.f : '' }));
}

// 雜湊一律算 LF 的版本:同一份內容在 CRLF 的工作樹上指紋不變
const sha8 = (s) => crypto.createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex').slice(0, 8);
const fence = (lang, lines) => ['```' + lang, ...lines, '```'];
const readText = (abs) => (fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, '') : null);
// 整份 markdown 包進四個反引號的圍欄:它自己的標題與程式碼區塊才不會跟 brief 的混在一起
const wholeFile = (title, abs, missing) => {
  const t = readText(abs);
  return t == null ? [`# ${title}`, '', missing, ''] : [`# ${title}`, '', '````markdown', t, '````', ''];
};

function ruleSections(skill) {
  const out = [];
  let raw = '';
  for (const [file, titles] of RULES[skill]) {
    const abs = path.join(PLUGIN_ROOT, 'rules', file);
    const text = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n') : '';
    if (titles === '*') {
      raw += text;
      out.push(`### ${file}(全份)`, text.replace(/^# .*\n/, '').trim(), '');
      continue;
    }
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

function git(root, cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/).map((s) => s.trimEnd()).filter(Boolean);
  } catch {
    return null;
  }
}

// statusText:() => 這棵樹的 status 報告全文(要的 skill 才會叫,bin 負責接上測試輸出與分支狀態)
export function briefCommand(root, design, source, adapter, skill, target, { fingerprint = false, noRules = false, statusText = null, part = 0, of = 0 } = {}) {
  // --part k:只印第 k 段;超出段數就什麼都不印。--of N 是 SKILL.md 放了幾道注入行:最後一道還有沒印完的就講怎麼接著拿
  const pick = (text) => {
    if (!part) return text;
    const parts = splitParts(text);
    if (part > parts.length) return '';
    let t = parts[part - 1];
    if (part > 1) t = `(brief ${skill} 第 ${part} 段,接上一段)\n\n${t}`;
    if (of && part === of && parts.length > of) t += `\n\n(還有 ${parts.length - of} 段沒印:devflow brief ${skill} <同一個目標> --part ${of + 1}${parts.length > of + 1 ? ` 到 --part ${parts.length}` : ''})`;
    return t;
  };
  const say = (text) => ({ text: pick(text), exitCode: 0 });
  if (!RULES[skill]) return say(`brief 沒有「${skill}」這個 skill;有的是:${briefSkills.join('、')}`);
  const rules = ruleSections(skill);
  const sys = design ? design.system : null;
  const a = design && source ? analyze(design, source, adapter, null) : null;
  const docs = a ? [...a.info.values()] : [];

  // 目標的種類
  const x = target ? docs.find((v) => v.p.fullName === target || v.p.id === target) : null;
  const plainDoc = target && design && !x ? design.docs.find((d) => d.fullName === target || d.id === target) : null;
  const requirements = design ? design.requirements.requirements : [];
  const ms = target && /^M-\d+/.test(target) ? requirements.flatMap((q) => q.milestones.map((m) => ({ m, q }))).find(({ m }) => m.fullName === target || m.id === target) : null;
  const req = /^R-\d+$/.test(target) ? requirements.find((r) => r.id === target) : null;
  const inv = sys && /^INV-\d+$/.test(target) ? sys.invariants.find((v) => v.id === target) : null;
  const top = req || inv ? { id: target, law: req ? req.accept : inv.law, title: req ? req.title : inv.title, kind: req ? '需求的驗收' : `領域不變量${inv.kind ? ` [${inv.kind}]` : ''}`, mark: req ? 'ACCEPT' : 'LAW' } : null;
  const topLines = top && top.law ? [top.law.forall, ...top.law.given, top.law.conclusion].filter(Boolean) : [];
  const kind = !target ? 'none' : x || plainDoc ? 'doc' : ms ? 'milestone' : top ? 'top' : 'missing';
  const name = x ? x.p.fullName : plainDoc ? plainDoc.fullName : ms ? ms.m.fullName : target;

  const docAbs = x ? x.p.abs : plainDoc ? plainDoc.abs : null;
  const docText = docAbs ? fs.readFileSync(docAbs, 'utf8') : '';
  const hashed = docAbs ? sha8(docText) : ms ? sha8(ms.q.abs ? fs.readFileSync(ms.q.abs, 'utf8') : `${ms.q.title}\n${ms.m.fullName}`) : top ? sha8(`${top.title}\n${topLines.join('\n')}`) : '-';
  const print = `brief ${skill} ${name || '(沒有目標)'} @doc:${hashed} rules:${rules.hash}`;
  if (fingerprint) return say(print);

  const out = [print, '這一行是指紋:被委派的角色在回報的第一項照抄它。以下是開工要的全部,不必再去找規章、文檔或宣告。', ''];
  // 沒有 .design/ 的專案,整合只照 git 與 PR 的部分做,規章不必讀
  const bare = skill === 'integrate' && !design;
  if (bare) out.push('# 規章', '', '這個專案沒有 .design/:規章不必讀,照 git 與 PR 的部分做完即可。', '');
  else if (noRules) out.push('# 規章', '', '(--no-rules:規章的節這一場已經給過,不重印)', '');
  else out.push('# 規章', '', ...rules.lines);

  const plan = BLOCKS[skill];
  const accepts = Object.keys(plan).map((k) => KIND_WORD[k]).join('、');
  const stop = (msg) => say([...out, '# 目標', '', msg].join('\n'));
  if (!design && !bare && skill !== 'kickoff') return stop('這個目錄底下沒有 .design/:工作目錄不是專案根目錄,或 --root 沒指到工作樹。停下,回報。');
  if (kind === 'missing') {
    const names = design.docs.map((d) => d.fullName);
    const stones = requirements.flatMap((q) => q.milestones.map((m) => m.fullName));
    return stop(`這棵樹沒有 ${target}。文檔:${names.length ? names.join('、') : '(一份都沒有)'};里程碑:${stones.length ? stones.join('、') : '(一條都沒有)'}。停下,回報。`);
  }
  if (!plan[kind]) {
    if (kind === 'none') return stop(`目標未指定;dev-flow:${skill} 的目標是${accepts}。定出目標之後跑一次:devflow brief ${skill} <目標> [--root <工作樹>] --no-rules`);
    return stop(`${name} 不是 dev-flow:${skill} 收的目標;它收的是${accepts}。停下,回報。`);
  }
  const needsCode = plan[kind].some((b) => ['detail', 'declarations', 'innermost', 'testing', 'files', 'touched', 'steps', 'lint', 'lintall', 'lintglobal', 'bound'].includes(b));
  if (needsCode && !source) return stop('system.md 的 language 欄沒有可用的 adapter,程式碼對不了帳:宣告與對帳那幾塊印不出來。停下,回報。');

  const srcCache = new Map();
  const srcLines = (file) => {
    if (!srcCache.has(file)) {
      const abs = path.join(root, file);
      srcCache.set(file, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').split(/\r?\n/) : []);
    }
    return srcCache.get(file);
  };
  const design_ = (rel) => path.join(root, '.design', rel);
  const stepSide = x && x.steps[0] ? sideOf(design, x.steps[0].module) : design ? sideOf(design, '') : { dir: '', name: '' };
  let side = stepSide;

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

  const detailOf = (fullName) => {
    const d = docDetail(design, source, adapter, null, '', fullName).text.split('\n');
    const from = d.indexOf('## Steps');
    return d.slice(from < 0 ? 0 : from).map((l) => l.replace(/^## /, '### '));
  };

  // 一條需求的全部:需求檔全文;需求還住在 system.md「## 需求」節的樹,印讀到的那幾行
  const requirementLines = (q) => {
    if (q.abs) return wholeFile(`需求檔:${q.file}`, q.abs, '(讀不到)');
    const acc = q.accept;
    return [`# 需求:${q.id}(${q.file})`, '', `${q.id}:${q.title}`, `- 驗收:${acc ? acc.title : '(還沒寫)'}`, ...(acc ? [acc.forall, ...acc.given, acc.conclusion].filter(Boolean).map((l) => `  - ${l}`) : []),
      ...q.milestones.map((m) => `- 里程碑 ${m.fullName}:${m.title}(綁定 ${m.binds.join('、') || '-'})`), ...q.refinements.map((rf) => `- 調整 ${rf.id}:${rf.title}(動到 ${rf.touches.join('、') || '-'})`), ''];
  };

  const block = {
    doc: () => out.push(`# 目標文檔:${(x ? x.p : plainDoc).file}`, '', '````markdown', docText.replace(/\r\n/g, '\n').replace(/\s+$/, ''), '````', ''),

    detail: () => out.push('# 逐條狀態(文檔對程式碼;沒有給測試輸出,law 的紅綠不在這裡)', '', ...detailOf(name), ''),

    declarations: () => {
      out.push('# 宣告', '');
      out.push(skill === 'qa' ? '只有宣告,沒有本體:測試從這裡與文檔寫,不打開這些檔的本體。' : skill === 'refactor' ? 'Steps 上的簽名與型別宣告不准改;本體在下面「要開的檔」。' : 'Steps 上每條簽名與型別現在在程式碼裡的宣告。', '');
      declarations(x.steps, side.name || '');
    },

    innermost: () => {
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
          out.push(`### ${f}(${lines.length} 行,全文)`, ...fence(side.name || '', lines.join('\n').replace(/\s+$/, '').split('\n')), '');
        } else out.push(`### ${f}(${lines.length} 行,超過內嵌上限,只列匯出;要用再 Read)`, `匯出:${names}`, '');
      }
    },

    testing: () => {
      const id = top ? top.id : x.p.id;
      const marks = top ? [top.mark] : ['LAW-1', 'EX-1'];
      const ident = IDENT_STYLE.has(side.name);
      const form = (m) => (ident ? `${id}#${m}`.toLowerCase().replace(/-/g, '_').replace(/#/g, '__') : `"${id}#${m}"`);
      out.push('# 測試怎麼寫', '');
      out.push(`- 子集測試指令:${commandFor(design, '測試(子集)', side) || '(system.md「語言與工具」沒有寫)'}`);
      out.push(`- 歸屬寫法:${ident ? '識別字' : '字串'},${marks.map(form).join('、')}`);
      out.push(`- 測試檔以 ${top ? top.id : x.p.fullName} 命名`);
      // 範例優先挑別的目標的測試:這個目標自己的測試正是 qa 要寫的東西
      const own = (t) => (t.markers.some((m) => m.startsWith(`${id}#`)) ? 1 : 0);
      const tests = source.testFiles.filter((t) => !t.inline && (!side.dir || t.file.startsWith(side.dir + '/'))).sort((p, q) => own(p) - own(q) || q.markers.length - p.markers.length || p.file.localeCompare(q.file));
      out.push(`- 現有的測試檔:${tests.length ? tests.map((t) => t.file).sort().join('、') : '(還沒有)'}`);
      if (tests.length) out.push('', `### 這個專案的測試長這樣:${tests[0].file} 的開頭`, ...fence(side.name || '', srcLines(tests[0].file).slice(0, 30)));
      out.push('');
    },

    files: () => {
      out.push('# 要開的檔', '');
      for (const f of [...new Set(x.steps.map((s) => (s.hit ? s.hit.file : s.module)).filter(Boolean))]) out.push(`- ${f}`);
      for (const r of x.refs) {
        const y = a.info.get(r);
        if (y) out.push(`- 引用的 ${r}:文檔 ${y.p.file};程式碼 ${[...new Set(y.steps.map((s) => (s.hit ? s.hit.file : s.module)))].join('、')}`);
      }
      out.push(`- 子集測試指令:${commandFor(design, '測試(子集)', side) || '(system.md「語言與工具」沒有寫)'}`);
      const tests = source.testFiles.filter((t) => !t.inline).map((t) => t.file).sort();
      out.push(`- 測試檔(不准讀、不准寫):${tests.length ? tests.join('、') : '(還沒有)'}`, '');
    },

    top: () => {
      out.push(`# 目標:${top.id}(${top.kind})`, '', `${top.id}:${top.title}`);
      if (!topLines.length) out.push('', '這一條只有一句話,沒有三行式:寫不出可判定的斷言。停下,回報。', '');
      else out.push(...fence('', topLines), '');
    },

    // 三行裡的識別字對到哪份文檔的 Steps,就印那份的 Steps 與宣告;領域不變量只引用最內層
    touched: () => {
      const names = new Set(topLines.join(' ').match(/[A-Za-z_][A-Za-z0-9_.]*/g) || []);
      const hit = !req ? [] : docs.map((d) => ({ d, steps: d.steps.filter((s) => names.has(s.name) && !s.ref) })).filter((t) => t.steps.length);
      if (hit[0] && hit[0].steps[0]) side = sideOf(design, hit[0].steps[0].module);
      for (const t of hit) {
        out.push(`# 引用到的文檔:${t.d.p.fullName}(${t.d.p.file})`, '');
        const stepsSec = t.d.p.sections.find((s) => s.title === 'Steps');
        if (stepsSec) out.push(...stepsSec.lines.filter((l) => l.trim()), '');
        declarations(t.steps, side.name || '');
      }
      if (!hit.length && req) out.push('# 引用到的文檔', '', '(三行裡的識別字沒有對到任何一份文檔的 Steps)', '');
    },

    tools: () => {
      const s = sys ? sys.sections.find((q) => q.title === '語言與工具') : null;
      out.push('# system.md「語言與工具」', '', ...(s ? s.lines.filter((l) => l.trim()) : ['(system.md 沒有這一節)']), '');
    },

    system: () => out.push(...wholeFile('system.md(全份)', design_('system.md'), '(還沒有 .design/system.md)')),

    modules: () => out.push(...wholeFile('modules.md', design_('modules.md'), '(還沒有 .design/modules.md)')),

    tree: () => {
      out.push('# .design/ 現在有什麼', '');
      if (!design) return out.push('(這個目錄底下還沒有 .design/)', '');
      const walk = (dir, depth) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((p, q) => p.name.localeCompare(q.name))) {
          out.push(`${'  '.repeat(depth)}- ${e.name}${e.isDirectory() ? '/' : ''}`);
          if (e.isDirectory() && depth < 2) walk(path.join(dir, e.name), depth + 1);
        }
      };
      walk(path.join(root, '.design'), 0);
      out.push('');
    },

    // 里程碑:它那條需求的需求檔全文;文檔:綁它的里程碑、動到它的調整,與那幾條需求的需求檔
    requirement: () => {
      if (ms) return out.push(...requirementLines(ms.q));
      const rows = [];
      const reqs = new Set();
      for (const q of requirements) {
        for (const m of q.milestones) if (m.binds.includes(name)) { rows.push(`- ${q.fullName} 的里程碑 ${m.fullName}:${m.title}(綁定 ${m.binds.join('、')})`); reqs.add(q); }
        for (const rf of q.refinements) if (rf.touches.includes(name)) { rows.push(`- ${q.fullName} 的調整 ${rf.id}:${rf.title}(動到 ${rf.touches.join('、')})`); reqs.add(q); }
      }
      out.push('# 這份文檔朝向哪裡', '', ...(rows.length ? rows : ['(沒有任何里程碑綁它,也沒有調整動到它)']), '');
      for (const q of reqs) out.push(...requirementLines(q));
    },

    requirements: () => {
      if (!requirements.length) return out.push('# 需求檔', '', '(requirements/ 底下一檔都沒有)', '');
      for (const q of requirements) out.push(...requirementLines(q));
    },

    // 決策紀錄的鍵是分支的鍵:里程碑全名、文檔全名、R-n / INV-n;文檔沒有自己的那一份就找綁它的里程碑的
    journal: () => {
      const keys = [name, ...requirements.flatMap((q) => q.milestones).filter((m) => m.binds.includes(name)).map((m) => m.fullName)];
      const j = design.journals.find((q) => keys.includes(q.key));
      if (j) out.push(...wholeFile(`決策紀錄:${j.file}`, path.join(root, j.file), '(讀不到)'));
      else out.push('# 決策紀錄', '', `(.design/journal/ 裡沒有 ${keys.join(' 或 ')} 的決策紀錄)`, '');
    },

    journals: () => {
      out.push('# 決策紀錄清單', '');
      if (!design || !design.journals.length) return out.push('(這棵樹的 .design/journal/ 是空的;各條 build 分支的決策紀錄在它們自己的工作樹上)', '');
      for (const j of design.journals) out.push(`- ${j.file}  鍵 ${j.key}${j.branch ? `  分支 ${j.branch}` : ''}${j.verdict ? `  verdict ${j.verdict}` : ''}`);
      out.push('');
    },

    // 里程碑綁的每一份文檔:全文與逐條狀態
    bound: () => {
      if (!ms.m.binds.length) return out.push('# 這條里程碑綁的文檔', '', '(綁定欄還是空的:切片做完、scope-laws claim 出 feature 之後才有)', '');
      for (const b of ms.m.binds) {
        const d = design.docs.find((q) => q.fullName === b);
        if (!d) { out.push(`# 綁的文檔:${b}`, '', '(features/ 裡沒有這一份)', ''); continue; }
        out.push(...wholeFile(`綁的文檔:${d.file}`, d.abs, '(讀不到)'));
        out.push(`# ${b} 的逐條狀態`, '', ...detailOf(b), '');
      }
    },

    gaps: () => {
      if (!design || !design.gaps.exists) return out.push('# gaps.md', '', '(還沒有 .design/gaps.md)', '');
      const open = design.gaps.gaps.filter((g) => g.status === 'open');
      out.push(...wholeFile(`gaps.md(${design.gaps.gaps.length} 條,open 的 ${open.length} 條${open.length ? ':' + open.map((g) => g.id).join('、') : ''})`, path.join(root, design.gaps.file), '(讀不到)'));
    },

    lint: () => out.push('# 對帳:lint sig 與 lint laws', '', ...renderLint([lintSig(design, source, adapter), lintLaws(design, source, adapter)]).text.split('\n').map((l) => l.replace(/^## /, '### ')), ''),

    lintall: () => out.push('# devflow lint all', '', ...renderLint(lintAll(design, source, adapter)).text.split('\n').map((l) => l.replace(/^## /, '### ')), ''),

    lintglobal: () => out.push('# devflow lint global', '', ...renderLint(lintGlobal(design, source, adapter)).text.split('\n').map((l) => l.replace(/^## /, '### ')), ''),

    status: () => out.push('# devflow status', '', ...(statusText ? statusText().split('\n').map((l) => l.replace(/^(#+) /, '##$1 ')) : ['(沒有接上 status)']), ''),

    // 同一條簽名出現在兩份以上文檔 = 收整的候選
    steps: () => {
      out.push('# 每份文檔的 Steps', '');
      const seen = new Map();
      for (const d of docs) {
        out.push(`### ${d.p.fullName}(${d.p.kind},${d.p.status})`);
        for (const s of d.steps) {
          out.push(`- ${s.index}  ${s.sigText}  ${s.module}/${s.layer}${s.ref ? `  見 ${s.ref}` : ''}`);
          if (!s.ref && !s.observe && s.index !== '!') seen.set(s.name, [...(seen.get(s.name) || []), d.p.fullName]);
        }
        out.push('');
      }
      const dup = [...seen.entries()].filter(([, ds]) => new Set(ds).size > 1);
      out.push('### 同名的 step 出現在兩份以上文檔(沒有註明「見」)', ...(dup.length ? dup.map(([n, ds]) => `- ${n}:${[...new Set(ds)].join('、')}`) : ['- 無']), '');
    },

    // 測試輸出放在哪、比最新的原始碼與測試檔新還是舊:舊的輸出不能拿來講現在的紅綠
    logs: () => {
      out.push('# 專案根目錄的測試輸出', '');
      const logs = testLogs(root, source);
      if (!logs.length) return out.push('(根目錄沒有看起來像測試輸出的檔;先跑整套留檔,或用 status --run)', '');
      for (const l of logs) out.push(`- ${l.name}  ${l.fresh ? '比每一個原始碼與測試檔都新' : `比 ${l.newest} 舊:先重跑整套留檔,這一份不能拿來講現在的紅綠`}`);
      out.push('');
    },

    // 這份引用的、與引用這份的文檔:全文。改一條 law 或簽名的影響範圍從這裡看
    refs: () => {
      const names = [...new Set([...x.refs, ...x.referrers])];
      if (!names.length) return out.push('# 引用與被引用的文檔', '', '(這份不引用別人,也沒有被引用)', '');
      for (const n of names) {
        const d = design.docs.find((q) => q.fullName === n);
        if (d) out.push(...wholeFile(`${x.refs.includes(n) ? '引用的' : '引用這份的'}文檔:${d.file}`, d.abs, '(讀不到)'));
      }
    },

    branch: () => {
      out.push('# 分支與工作樹', '');
      if (!fs.existsSync(path.join(root, '.git'))) return out.push('(這個目錄不是 git repo 的根,也不是一棵工作樹)', '');
      const cur = (git(root, 'git branch --show-current') || [''])[0];
      const dirty = git(root, 'git status --short') || [];
      out.push(`- 目前分支:${cur || '(detached)'}`);
      out.push(`- 工作樹:${dirty.length ? `有 ${dirty.length} 個未 commit 的變更` : '乾淨'}`, ...dirty.slice(0, 12).map((l) => `  - ${l}`));
      const remotes = [...new Set((git(root, 'git remote') || []))];
      out.push(`- remote:${remotes.length ? remotes.join('、') : '沒有(「與 origin 同步」無從驗,照實回報)'}`);
      const up = git(root, 'git rev-list --left-right --count @{upstream}...HEAD');
      out.push(`- 與上游:${up ? (([behind, ahead]) => `落後 ${behind}、超前 ${ahead}`)(up[0].split(/\s+/)) : '沒有設上游'}`);
      const wts = git(root, 'git worktree list') || [];
      out.push(`- 工作樹清單:`, ...wts.map((l) => `  - ${l}`));
      const st = branchState(root);
      out.push(`- 建構中的 build 分支:${st.building.size ? [...st.building].sort().map((k) => `build/${k}`).join('、') : '無'}`);
      out.push(`- 已合進主線卻還在的 build 分支:${st.stale.size ? [...st.stale].sort().map((k) => `build/${k}`).join('、') : '無'}`, '');
    },
  };

  for (const b of plan[kind]) block[b]();
  return say(out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, ''));
}
