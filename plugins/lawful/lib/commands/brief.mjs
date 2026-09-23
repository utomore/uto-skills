// brief <skill> [<目標>]:一個 skill 開工要的東西一次印完——規章的節,加上這個 skill 在這個專案裡要看的那幾塊
// (目標 pipeline、逐條狀態、Stages 上每條簽名與型別的宣告、types 層、Cone.md、需求檔、決策紀錄、分支狀態、lint、status 報告 …)。
// 唯讀;永遠 exit 0,問題用文字講(skill 載入時由 harness 執行,非 0 會被讀成載入失敗)。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, sections, sameTitle } from '../markdown.mjs';
import { findType } from '../source.mjs';
import { analyze, branchState, pipelineDetail, requirementView } from './status.mjs';
import { lintAll, lintBoundary, lintGlobal, lintLaws, lintSig, renderLint } from './lint.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// 每個 skill 開工要讀的規章節;'*' 是整份。這張表是「誰讀什麼」的唯一來源。
const RULES = {
  kickoff: [['pipelines.md', ['`.lawful/`', '名詞', 'Cone.md']], ['laws.md', ['Law 與需求']], ['boundary.md', ['四層', '模組單元', '模組表']], ['tooling.md', ['language adapter', 'migrate', '收尾定錨']]],
  'require-design': [['pipelines.md', ['願景、需求與里程碑', '談需求', '靠修訂達成的里程碑', '名詞', '需求的達成只有人判得了', '完成度']], ['laws.md', ['Law 與需求', '分流']], ['tooling.md', ['CLI', '落筆指令', 'status 報告', '收尾定錨']]],
  'global-laws': [['laws.md', ['Law 與需求', '全域 Law', '全域 Law 怎麼長出來', '分流', '影響範圍與選項', '全域 Law 的變更']], ['boundary.md', ['四層', '模組單元', '模組表', '效果的判定', '對外 I/O']], ['pipelines.md', ['Laws', '提問(GAP)', '完成度']], ['roles.md', ['分支', '誰能動什麼', '驗收測試', '決策紀錄']], ['tooling.md', ['CLI', 'lint', '落筆指令', '收尾定錨']]],
  module: [['boundary.md', ['四層', '模組單元', '模組表']], ['tooling.md', ['CLI', 'lint', '落筆指令', '收尾定錨']]],
  'spike-impl': [['roles.md', ['流程', '分支', '誰能動什麼', '角色', '切片', '決策紀錄']], ['pipelines.md', ['Cone.md', '願景、需求與里程碑']], ['laws.md', ['Law 與需求', '全域 Law']], ['boundary.md', ['四層', '模組單元', '模組表', '效果的判定', '對外 I/O', '測試與邊界']], ['tooling.md', ['CLI', 'lint', '跑東西的紀律', '收尾定錨']]],
  'scope-laws': [['pipelines.md', ['pipeline', '編號與引用', '簽名怎麼寫', 'frontmatter 與 status', '節', 'Stages', 'Laws', '什麼要有 law', '修訂(REV)', '提問(GAP)', '完成度']], ['laws.md', ['Law 怎麼談', 'Law 與需求', '全域 Law', '全域 Law 怎麼長出來', '分流', '影響範圍與選項']], ['roles.md', ['分支', '誰能動什麼', '首跑', '決策紀錄']], ['boundary.md', ['模組表', '對外 I/O', '效果的判定']], ['tooling.md', ['CLI', 'lint', '落筆指令', '收尾定錨']]],
  'scope-revise': [['pipelines.md', ['簽名怎麼寫', 'frontmatter 與 status', '節', 'Stages', 'Laws', '什麼要有 law', '修訂(REV)', '提問(GAP)', '完成度']], ['laws.md', ['Law 怎麼談', 'Law 與需求', '分流', '影響範圍與選項']], ['roles.md', ['分支', '誰能動什麼', '首跑']], ['boundary.md', ['模組表', '四層']], ['tooling.md', ['CLI', 'lint', '收尾定錨']]],
  build: [['roles.md', ['流程', '分支', '誰能動什麼', '角色', '委派', '首跑', '驗收測試', 'qa 的交付', '仲裁', '測試跑幾次', '收尾', '決策紀錄']], ['pipelines.md', ['提問(GAP)', '修訂(REV)', '需求的達成只有人判得了', '完成度']], ['laws.md', ['分流']], ['tooling.md', ['CLI', 'lint', '跑東西的紀律', '收尾定錨']]],
  qa: [['roles.md', ['角色', '委派', '驗收測試', 'qa 的交付']], ['pipelines.md', ['Stages', 'Laws', '什麼要有 law', '提問(GAP)']], ['boundary.md', ['測試與邊界']]],
  refactor: [['roles.md', ['角色', '委派']], ['pipelines.md', ['Stages', 'Laws', '提問(GAP)']], ['boundary.md', ['四層']]],
  integrate: [['roles.md', ['分支', '決策紀錄', '整合', '仲裁']], ['pipelines.md', ['提問(GAP)', '需求的達成只有人判得了', '完成度', 'ADR']], ['laws.md', ['全域 Law', '分流']], ['tooling.md', ['CLI', 'lint', '跑東西的紀律', '收尾定錨']]],
  status: [['tooling.md', ['CLI', 'status 報告', '看板', 'migrate', '落筆指令', '跑東西的紀律', '收尾定錨']], ['pipelines.md', ['願景、需求與里程碑', '靠修訂達成的里程碑', '需求的達成只有人判得了', '完成度']], ['laws.md', ['Law 與需求', '全域 Law', '分流']]],
  audit: [['tooling.md', ['CLI', 'lint', 'status 報告', 'migrate', '收尾定錨']], ['boundary.md', '*'], ['pipelines.md', ['願景、需求與里程碑', '靠修訂達成的里程碑', '節', 'Stages', 'Laws', '什麼要有 law', '需求的達成只有人判得了', '完成度']], ['laws.md', ['Law 與需求', '全域 Law', '全域 Law 怎麼長出來', 'Law 怎麼談', '分流']]],
  study: [['tooling.md', ['跑東西的紀律', '收尾定錨']], ['boundary.md', ['四層', '效果的判定']], ['pipelines.md', ['pipeline']]],
};

// 每個 skill 的 brief 由哪幾塊組成,依目標的種類分:doc(pipeline 全名)、milestone(M-n-<slug>)、top(R-n / INV-n)、none(沒有目標)。
// 沒列的種類 = 這個 skill 不收那種目標。
const BLOCKS = {
  kickoff: { none: ['tree', 'cone', 'modules'] },
  'require-design': { none: ['cone', 'requirements', 'statusgoals'], top: ['cone', 'requirements', 'statusgoals'] },
  'global-laws': { none: ['branch', 'cone', 'requirements', 'modules', 'gaps', 'lintglobal', 'statusgoals'], top: ['branch', 'top', 'touched', 'cone', 'requirements', 'modules', 'gaps', 'lintglobal', 'statusrows'], milestone: ['branch', 'cone', 'requirement', 'modules', 'journal', 'bound', 'typeslayer', 'gaps', 'lintglobal', 'statusrows'] },
  module: { none: ['constraints', 'modules', 'lintboundary'] },
  'spike-impl': { milestone: ['branch', 'tree', 'requirement', 'cone', 'modules', 'statusrows'] },
  'scope-laws': { milestone: ['branch', 'tree', 'requirement', 'cone', 'modules', 'journal', 'bound', 'typeslayer'], doc: ['branch', 'doc', 'detail', 'declarations', 'refs', 'requirement', 'cone', 'journal', 'gaps', 'lint', 'statusrows'] },
  'scope-revise': { doc: ['branch', 'doc', 'detail', 'declarations', 'refs', 'requirement', 'modules', 'gaps', 'lint', 'statusrows'] },
  build: { doc: ['branch', 'constraints', 'modules', 'journal', 'doc', 'detail', 'refs', 'lint', 'gaps', 'logs', 'statusrows'], milestone: ['branch', 'constraints', 'modules', 'journal', 'requirement', 'bound', 'lint', 'gaps', 'logs', 'statusrows'], top: ['branch', 'constraints', 'top', 'touched', 'gaps', 'logs', 'statusrows'] },
  qa: { doc: ['doc', 'detail', 'declarations', 'typeslayer', 'constraints', 'testing'], top: ['top', 'touched', 'typeslayer', 'constraints', 'testing'] },
  refactor: { doc: ['doc', 'detail', 'declarations', 'typeslayer', 'journal', 'files', 'constraints'] },
  integrate: { none: ['branch', 'journals', 'constraints', 'gaps'] },
  status: { none: ['constraints', 'logs'] },
  audit: { none: ['lintall', 'requirements', 'status', 'modules'] },
  study: { none: ['tree', 'constraints', 'modules'] },
};
const KIND_WORD = { doc: '一條 pipeline 的全名 P-00x-<slug>', milestone: '一條里程碑的全名 M-n-<slug>', top: 'R-n 或 INV-n', none: '不給目標' };
export const briefSkills = Object.keys(RULES);

const INLINE_LINES = 400; // types 層內嵌的總行數上限;超過的模組只列匯出
const TYPE_LINES = 40;    // 一個型別宣告最多印幾行
const TARGET_RE = /^(?:P-\d{3}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?|M-\d+(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?|R-\d+|INV-\d+)$/;

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
  for (const f of source ? [...[...source.modules.values()].map((m) => m.file), ...source.testFiles.map((t) => t.file)] : []) {
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
      const s = secs.find((x) => sameTitle(x.title, t));
      const body = s ? s.lines.join('\n').trim() : `(${file} 裡沒有「${t}」這一節)`;
      raw += body;
      out.push(`### ${file}「${t}」`, body, '');
    }
  }
  return { lines: out, hash: sha8(raw) };
}

// 從第 line 行起的一個宣告:同一行加上縮排比它深的接續行(多行簽名、名字單獨一行而 :: 在下一行)
function declarationText(srcLines, line) {
  const first = srcLines[line - 1];
  if (first == null) return [];
  const indent = first.search(/\S/);
  const out = [first.replace(/\s+$/, '')];
  for (let i = line; i < srcLines.length && out.length < 14; i++) {
    const l = srcLines[i];
    if (!l.trim() || l.search(/\S/) <= indent) break;
    out.push(l.replace(/\s+$/, ''));
  }
  return out;
}

// 型別宣告的區塊:從欄位 0 的宣告行到下一個欄位 0 的非空行為止(建構子、欄位、deriving、class 的方法簽名)
function typeBlock(srcLines, name, adapter) {
  let at = -1;
  for (let i = 0; i < srcLines.length && at < 0; i++) {
    if (!/^\S/.test(srcLines[i])) continue;
    let head = srcLines[i];
    for (let j = i + 1; j < srcLines.length && /^[ \t]+\S/.test(srcLines[j]); j++) head += '\n' + srcLines[j];
    if (adapter.typeNames(head).includes(name)) at = i;
  }
  if (at < 0) return null;
  const out = [srcLines[at].replace(/\s+$/, '')];
  for (let i = at + 1; i < srcLines.length && out.length < TYPE_LINES; i++) {
    const l = srcLines[i];
    if (/^\S/.test(l)) break;
    out.push(l.replace(/\s+$/, ''));
  }
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return { line: at + 1, lines: out };
}

const typeNamesIn = (text) => [...new Set((String(text).match(/(?<![\w.'])[A-Z][A-Za-z0-9_']*/g) || []))];

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
    if (of && part === of && parts.length > of) t += `\n\n(還有 ${parts.length - of} 段沒印:lawful brief ${skill} <同一個目標> --part ${of + 1}${parts.length > of + 1 ? ` 到 --part ${parts.length}` : ''})`;
    return t;
  };
  const say = (text) => ({ text: pick(text), exitCode: 0 });
  if (!RULES[skill]) return say(`brief 沒有「${skill}」這個 skill;有的是:${briefSkills.join('、')}`);
  const rules = ruleSections(skill);
  const cone = design ? design.cone : null;
  const a = design ? analyze(design, source, adapter, null) : null;
  const docs = a ? [...a.info.values()] : [];
  const requirements = design ? design.requirements.requirements : [];

  // 目標的種類
  const x = target && /^P-\d{3}/.test(target) ? docs.find((v) => v.p.fullName === target || v.p.id === target) : null;
  const req = /^R-\d+$/.test(target) ? requirements.find((r) => r.id === target) : null;
  const inv = cone && /^INV-\d+$/.test(target) ? cone.invariants.find((v) => v.id === target) : null;
  const ms = /^M-\d+/.test(target) ? requirements.flatMap((q) => q.milestones.map((m) => ({ m, q }))).find(({ m }) => m.fullName === target || m.id === target) : null;
  const top = req ? { id: req.id, title: req.title, law: req.accept, kind: '需求的驗收', mark: 'ACCEPT' } : inv ? { id: inv.id, title: inv.title, law: inv.law, kind: `領域不變量${inv.kind ? ` [${inv.kind}]` : ''}`, mark: 'LAW' } : null;
  const topLines = top && top.law ? [top.law.forall, ...top.law.given, top.law.conclusion].filter(Boolean) : [];
  const kind = !target ? 'none' : x ? 'doc' : ms ? 'milestone' : top ? 'top' : 'missing';
  const name = x ? x.p.fullName : ms ? ms.m.fullName : target;

  const docAbs = x ? path.join(root, x.p.file) : null;
  const docText = docAbs ? fs.readFileSync(docAbs, 'utf8') : '';
  const hashed = docAbs ? sha8(docText) : ms ? sha8(ms.q.abs ? fs.readFileSync(ms.q.abs, 'utf8') : `${ms.q.title}\n${ms.m.fullName}`) : top ? sha8(`${top.title}\n${top.law ? top.law.title : ''}\n${topLines.join('\n')}`) : '-';
  const print = `brief ${skill} ${name || '(沒有目標)'} @doc:${hashed} rules:${rules.hash}`;
  if (fingerprint) return say(print);

  const out = [print, '這一行是指紋:被委派的角色在回報的第一項照抄它。以下是開工要的全部,不必再去找規章、文檔或宣告。', ''];
  // 沒有 .lawful/ 的專案:整合只照 git 與 PR 的部分做、導讀自己建工作假說,規章照印或不必讀
  const bare = !design && (skill === 'integrate' || skill === 'study');
  if (bare && skill === 'integrate') out.push('# 規章', '', '這個專案沒有 .lawful/:規章不必讀,照 git 與 PR 的部分做完即可。', '');
  else if (noRules) out.push('# 規章', '', '(--no-rules:規章的節這一場已經給過,不重印)', '');
  else out.push('# 規章', '', ...rules.lines);

  const plan = BLOCKS[skill];
  const accepts = Object.keys(plan).map((k) => KIND_WORD[k]).join('、');
  const stop = (msg) => say([...out, '# 目標', '', msg].join('\n'));
  if (!design && !bare && skill !== 'kickoff') return stop('這個目錄底下沒有 .lawful/:工作目錄不是專案根目錄,或 --root 沒指到工作樹。停下,回報。');
  if (kind === 'missing') {
    const names = design ? design.pipelines.map((p) => p.fullName) : [];
    const stones = requirements.flatMap((q) => q.milestones.map((m) => m.fullName));
    return stop(`這棵樹沒有 ${target}。pipeline:${names.length ? names.join('、') : '(一條都沒有)'};里程碑:${stones.length ? stones.join('、') : '(一條都沒有)'};需求:${requirements.length ? requirements.map((r) => r.id).join('、') : '(一條都沒有)'};領域不變量:${cone && cone.invariants.length ? cone.invariants.map((v) => v.id).join('、') : '(一條都沒有)'}。停下,回報。`);
  }
  if (!plan[kind]) {
    if (kind === 'none') return stop(`目標未指定;lawful:${skill} 的目標是${accepts}。定出目標之後跑一次:lawful brief ${skill} <目標> [--root <工作樹>] --no-rules`);
    return stop(`${name} 不是 lawful:${skill} 收的目標;它收的是${accepts}。停下,回報。`);
  }
  // 沒有 adapter 的語言:qa 與 refactor 沒有宣告開不了工;其餘的 skill 照印,讀程式碼的那幾塊各留一行說明
  const CODE_BLOCKS = ['declarations', 'typeslayer', 'testing', 'files', 'touched'];
  if (!source && (skill === 'qa' || skill === 'refactor')) return stop('Cone.md 的 language 欄沒有可用的 adapter,程式碼對不了帳:宣告與 types 層那幾塊印不出來。停下,回報。');

  const lang = adapter ? adapter.name : '';
  const srcCache = new Map();
  const srcLines = (file) => {
    if (!srcCache.has(file)) {
      const abs = path.join(root, file);
      srcCache.set(file, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').split(/\r?\n/) : []);
    }
    return srcCache.get(file);
  };
  const lawful_ = (rel) => path.join(root, '.lawful', rel);
  const command = (key) => (cone && cone.commands[key]) || '(Cone.md「Constraint」沒有寫)';
  const typesModules = () => (source ? [...source.modules.values()].filter((m) => m.layer === 'types').sort((p, q) => p.module.localeCompare(q.module)) : []);
  const lintText = (results) => renderLint(results).text.split('\n').map((l) => l.replace(/^## /, '### '));
  // 對帳只留講到目標的那幾條(目標 pipeline,或里程碑綁的每一條 pipeline):全專案的紅是 audit 的事,不是這一波的事
  const lintMine = (results, ps) => {
    const keys = ps.flatMap((p) => [p.file, p.fullName, `${p.id}#`]);
    const mine = (msg) => keys.some((k) => msg.includes(k));
    const whose = x ? '這條 pipeline' : '這條里程碑綁的 pipeline';
    const lines = [];
    for (const r of results) {
      const red = r.red.filter(mine);
      const info = (r.info || []).filter(mine);
      lines.push(`### ${r.title}:${whose} ${red.length} 條不合規(全專案 ${r.red.length} 條)`, ...red.map((m) => `- ✗ ${m}`), ...info.map((m) => `- · ${m}`));
    }
    return lines;
  };
  // status 報告很長:只拿點名的幾節,或只拿講到目標的那幾行(表格列連同它的表頭)
  const statusLines = () => (statusText ? statusText().split('\n') : []);
  const statusSections = (titles) => {
    const lines = statusLines();
    const out2 = [];
    let keep = true; // 第一個 ## 以前是報告的開頭(願景、數字、測試結果來自哪裡)
    for (const l of lines) {
      if (/^## /.test(l)) keep = titles.some((t) => l.startsWith(`## ${t}`));
      if (keep) out2.push(l.replace(/^(#+) /, '##$1 '));
    }
    return out2;
  };
  const statusRows = (keys) => {
    const lines = statusLines();
    const out2 = [];
    let section = '';
    let sectionShown = false;
    let header = null;
    let headerShown = false;
    lines.forEach((l, i) => {
      if (/^## /.test(l)) { section = l; sectionShown = false; header = null; return; }
      if (/^# /.test(l) || (!section && l.trim())) { out2.push(l.replace(/^(#+) /, '##$1 ')); return; }
      if (/^\|/.test(l) && /^\|[-| :]+\|$/.test(lines[i + 1] || '')) { header = [l, lines[i + 1]]; headerShown = false; return; }
      if (!keys.some((k) => (k instanceof RegExp ? k.test(l) : l.includes(k)))) return;
      if (!sectionShown) { out2.push('', section.replace(/^(#+) /, '##$1 ')); sectionShown = true; }
      if (/^\|/.test(l) && header && !headerShown) { out2.push(...header); headerShown = true; }
      out2.push(l);
    });
    return out2;
  };

  // Stages 的宣告與它們用到的專案型別(型別宣告裡提到的專案型別一路展開到沒有新的為止)
  const declarations = (stages) => {
    const types = new Set();
    for (const s of stages) {
      const where = s.hit ? `${s.hit.file}:${s.hit.line}` : `${s.module}(${s.state})`;
      out.push(`### ${s.index} \`${s.name}\`  ${where}  ${s.state}${s.ref ? `  見 ${s.ref}` : ''}`);
      if (s.hit && s.hit.line) out.push(...fence(lang, declarationText(srcLines(s.hit.file), s.hit.line)));
      else out.push(`文檔的簽名:\`${s.sigText}\``);
      out.push('');
      for (const t of typeNamesIn(s.type)) types.add(t);
    }
    const found = new Map();
    const queue = [...types];
    while (queue.length && found.size < 40) {
      const t = queue.shift();
      if (found.has(t)) continue;
      const hit = findType(source, t)[0];
      const b = hit ? typeBlock(srcLines(hit.file), t, adapter) : null;
      found.set(t, b ? { file: hit.file, ...b } : null);
      if (b) for (const u of typeNamesIn(b.lines.join(' '))) if (!found.has(u)) queue.push(u);
    }
    const all = [...found.entries()].filter(([, b]) => b).sort(([p], [q]) => p.localeCompare(q));
    // 住在下面會整份內嵌的 types 層模組裡的型別,不重印
    const inlined = plan[kind].includes('typeslayer') ? new Set(typesPlan().filter((t) => t.inline).map((t) => t.m.file)) : new Set();
    const shown = all.filter(([, b]) => !inlined.has(b.file));
    for (const [t, b] of shown) out.push(`### 型別 \`${t}\`  ${b.file}:${b.line}`, ...fence(lang, b.lines), '');
    const below = all.filter(([, b]) => inlined.has(b.file));
    if (below.length) out.push(`型別 ${below.map(([t]) => `\`${t}\``).join('、')} 的宣告在下面「types 層」的全文裡。`, '');
    if (!all.length) out.push('(簽名用到的型別都不是這個專案宣告的)', '');
  };

  // types 層的每個模組要整份內嵌還是只列匯出:這條 pipeline 的簽名用到的型別住的模組排前面,內嵌到行數上限為止
  let typesPlanned = null;
  const typesPlan = () => {
    if (typesPlanned) return typesPlanned;
    const stages = x ? x.stages : top ? touchedDocs().flatMap((t) => t.stages) : [];
    const used = new Set();
    for (const s of stages) for (const t of typeNamesIn(s.type)) for (const h of findType(source, t)) used.add(h.module);
    const mods = typesModules().sort((p, q) => (used.has(q.module) ? 1 : 0) - (used.has(p.module) ? 1 : 0) || p.module.localeCompare(q.module));
    let budget = skill === 'scope-laws' ? 0 : INLINE_LINES;
    typesPlanned = mods.map((m) => {
      const lines = srcLines(m.file);
      const inline = lines.length <= budget;
      if (inline) budget -= lines.length;
      return { m, lines, inline };
    });
    return typesPlanned;
  };

  const detailOf = (fullName) => {
    const d = pipelineDetail(design, source, adapter, null, '', fullName).text.split('\n');
    const from = d.indexOf('## Stages');
    return d.slice(from < 0 ? 0 : from).map((l) => l.replace(/^## /, '### '));
  };

  // 一條需求的全部:需求檔全文;需求還住在 Cone.md「## 需求」節的樹,印讀到的那幾行
  const requirementLines = (q) => {
    if (q.abs) return wholeFile(`需求檔:${q.file}`, q.abs, '(讀不到)');
    const acc = q.accept;
    return [`# 需求:${q.id}(${q.file})`, '', `${q.id}:${q.title}`, `- 驗收:${acc ? acc.title : '(還沒寫)'}`, ...(acc ? [acc.forall, ...acc.given, acc.conclusion].filter(Boolean).map((l) => `  - ${l}`) : []),
      ...q.milestones.map((m) => `- 里程碑 ${m.fullName}:${m.title}(綁定 ${m.binds.join('、') || '-'})`), ''];
  };

  // 三行裡的識別字對到哪條 pipeline 的 Stages(不含引用別條的那幾列)
  const touchedDocs = () => {
    const names = new Set(topLines.join(' ').match(/[A-Za-z_][A-Za-z0-9_']*/g) || []);
    return docs.map((d) => ({ d, stages: d.stages.filter((s) => names.has(s.name) && !s.ref) })).filter((t) => t.stages.length);
  };

  const block = {
    doc: () => out.push(`# 目標 pipeline:${x.p.file}`, '', '````markdown', docText.replace(/\r\n/g, '\n').replace(/\s+$/, ''), '````', ''),

    detail: () => out.push('# 逐條狀態(文檔對程式碼;沒有給測試輸出,law 的紅綠不在這裡)', '', ...detailOf(name), ''),

    declarations: () => {
      out.push('# 宣告', '');
      out.push(skill === 'qa' ? '只有宣告,沒有本體:測試從這裡、types 層與文檔寫,不打開 core 與 shell 的本體。' : skill === 'refactor' ? 'Stages 上的簽名與型別宣告不准改;要調的本體在下面「要開的檔」。' : 'Stages 上每條簽名與型別現在在程式碼裡的宣告。', '');
      declarations(x.stages);
    },

    // types 層:law 與測試只准引用它的匯出與 Stages 的簽名。整份內嵌到行數上限為止,其餘只列匯出
    typeslayer: () => {
      out.push('# types 層', '');
      const mods = typesPlan();
      if (!mods.length) return out.push('(程式碼裡還沒有住在 types 層的模組)', '');
      for (const { m, lines, inline } of mods) {
        const names = m.exports === null ? '(沒有匯出清單,整個模組都匯出)' : m.exports.join('、') || '(空的匯出清單)';
        if (inline) out.push(`### ${m.module}  ${m.file}(${lines.length} 行,全文)`, ...fence(lang, lines.join('\n').replace(/\s+$/, '').split('\n')), '');
        else out.push(`### ${m.module}  ${m.file}(${lines.length} 行,只列匯出;要用再 Read)`, `匯出:${names}`, '');
      }
    },

    testing: () => {
      const id = top ? top.id : x.p.id;
      const marks = top ? [top.mark] : ['LAW-1', 'EX-1'];
      out.push('# 測試怎麼寫', '');
      out.push(`- 子集測試指令:${command('測試(子集)')}`);
      out.push(`- 歸屬寫法:字串,${marks.map((m) => `"${id}#${m}"`).join('、')}(包住那一組測試的群組名)`);
      out.push(`- 測試模組以 ${top ? top.id : x.p.fullName} 命名`);
      // 範例優先挑別的目標的測試:這個目標自己的測試正是 qa 要寫的東西
      const own = (t) => (t.markers.some((m) => m.startsWith(`${id}#`)) ? 1 : 0);
      const tests = [...source.testFiles].sort((p, q) => own(p) - own(q) || q.markers.length - p.markers.length || p.file.localeCompare(q.file));
      out.push(`- 現有的測試檔:${tests.length ? tests.map((t) => t.file).sort().join('、') : '(還沒有)'}`);
      if (tests.length) out.push('', `### 這個專案的測試長這樣:${tests[0].file} 的開頭`, ...fence(lang, srcLines(tests[0].file).slice(0, 30)));
      out.push('');
    },

    files: () => {
      out.push('# 要開的檔', '');
      const stubs = x.stages.filter((s) => s.hit && s.hit.stub);
      // 假的、寫死的、沒接上的在決策紀錄「Faked / Unverified」(上面那一塊);這裡只有未實作標記
      for (const f of [...new Set(x.stages.filter((s) => !s.ref).map((s) => (s.hit ? s.hit.file : s.module)).filter(Boolean))]) {
        const mine = stubs.filter((s) => s.hit.file === f).map((s) => s.name);
        out.push(`- ${f}${mine.length ? `  本體還是未實作標記的:${mine.join('、')}` : ''}`);
      }
      for (const r of x.refs) {
        const y = a.info.get(r);
        if (y) out.push(`- 引用的 ${r}:文檔 ${y.p.file};程式碼 ${[...new Set(y.stages.map((s) => (s.hit ? s.hit.file : s.module)))].join('、')}`);
      }
      out.push(`- 子集測試指令:${command('測試(子集)')}`);
      const tests = source.testFiles.map((t) => t.file).sort();
      out.push(`- 測試檔(不准讀、不准寫):${tests.length ? tests.join('、') : '(還沒有)'}`, '');
    },

    top: () => {
      out.push(`# 目標:${top.id}(${top.kind})`, '', `${top.id}:${top.title}`, ...(req && top.law ? [`驗收:${top.law.title}`] : []));
      if (!topLines.length) out.push('', '這一條只有一句話,沒有三行式:寫不出可判定的斷言。', '');
      else out.push(...fence('', topLines), '');
    },

    // 三行裡的識別字對到哪條 pipeline 的 Stages,就印那條的 Stages 表與宣告
    touched: () => {
      const hit = touchedDocs();
      for (const t of hit) {
        out.push(`# 引用到的 pipeline:${t.d.p.fullName}(${t.d.p.file})`, '');
        const sec = t.d.p.sections.find((s) => s.title === 'Stages');
        if (sec) out.push(...sec.lines.filter((l) => l.trim()), '');
        declarations(t.stages);
      }
      if (!hit.length) out.push('# 引用到的 pipeline', '', inv ? '(領域不變量只引用 types 層,不引用任何 pipeline)' : '(三行裡的識別字沒有對到任何一條 pipeline 的 Stages)', '');
    },

    // 硬性限制(寫程式與寫測試的角色照做)與工具要讀的那幾行,同一節
    constraints: () => {
      const s = cone ? cone.sections.find((q) => q.title === 'Constraint') || cone.sections.find((q) => q.title === '專案約束') : null;
      out.push('# Cone.md「Constraint」', '', ...(s ? s.lines.filter((l) => l.trim()) : ['(Cone.md 沒有這一節)']), '');
    },

    cone: () => out.push(...wholeFile('Cone.md(全份)', lawful_('Cone.md'), '(還沒有 .lawful/Cone.md)')),

    modules: () => out.push(...wholeFile('modules.md', lawful_('modules.md'), '(還沒有 .lawful/modules.md)')),

    tree: () => {
      out.push('# .lawful/ 現在有什麼', '');
      if (!design) return out.push('(這個目錄底下還沒有 .lawful/)', '');
      const walk = (dir, depth) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((p, q) => p.name.localeCompare(q.name))) {
          out.push(`${'  '.repeat(depth)}- ${e.name}${e.isDirectory() ? '/' : ''}`);
          if (e.isDirectory() && depth < 2) walk(path.join(dir, e.name), depth + 1);
        }
      };
      walk(path.join(root, '.lawful'), 0);
      out.push('');
    },

    // 里程碑:它那條需求的需求檔全文;pipeline:綁它的里程碑,與那幾條需求的需求檔
    requirement: () => {
      if (ms) return out.push(...requirementLines(ms.q));
      const rows = [];
      const reqs = new Set();
      // 靠修訂這一條達成的里程碑:它的修訂記錄裡要有一條 REV 的依欄寫了那條里程碑的全名
      const view = a ? requirementView(design, a).reqs : [];
      const revised = (q, m) => {
        const vq = view.find((w) => w.fullName === q.fullName);
        const v = vq ? vq.ms.find((w) => w.line === m.line && w.fullName === m.fullName) : null;
        const d = v ? v.docs.find((w) => w.name === name) : null;
        return d && d.byRevision ? `;靠修訂這一條達成,${d.cited ? 'REV 的依欄已經引用它' : `還沒有 REV 的依欄引用它:REV 的依欄寫 ${m.fullName}`}` : '';
      };
      for (const q of requirements) {
        for (const m of q.milestones) if (m.binds.includes(name)) { rows.push(`- ${q.fullName} 的里程碑 ${m.fullName}:${m.title}(綁定 ${m.binds.join('、')}${revised(q, m)})`); reqs.add(q); }
      }
      out.push('# 這條 pipeline 朝向哪裡', '', ...(rows.length ? rows : ['(沒有任何里程碑綁它)']), '');
      for (const q of reqs) out.push(...requirementLines(q));
    },

    requirements: () => {
      if (!requirements.length) return out.push('# 需求檔', '', '(requirements/ 底下一檔都沒有)', '');
      for (const q of requirements) out.push(...requirementLines(q));
    },

    // 決策紀錄的鍵是分支的鍵:里程碑全名、pipeline 全名、R-n / INV-n;pipeline 沒有自己的那一份就找綁它的里程碑的
    journal: () => {
      const keys = [name, ...requirements.flatMap((q) => q.milestones).filter((m) => m.binds.includes(name)).map((m) => m.fullName)];
      const j = design.journals.find((q) => keys.includes(q.key));
      if (j) out.push(...wholeFile(`決策紀錄:${j.file}`, path.join(root, j.file), '(讀不到)'));
      else out.push('# 決策紀錄', '', `(.lawful/journal/ 裡沒有 ${keys.join(' 或 ')} 的決策紀錄)`, '');
    },

    journals: () => {
      out.push('# 決策紀錄清單', '');
      if (!design || !design.journals.length) return out.push('(這棵樹的 .lawful/journal/ 是空的;各條 build 分支的決策紀錄在它們自己的工作樹上)', '');
      for (const j of design.journals) out.push(`- ${j.file}  鍵 ${j.key}${j.branch ? `  分支 ${j.branch}` : ''}${j.verdict ? `  verdict ${j.verdict}` : ''}`);
      out.push('');
    },

    // 里程碑綁的每一條 pipeline:全文、逐條狀態、lint 裡講到它的
    bound: () => {
      if (!ms.m.binds.length) return out.push('# 這條里程碑綁的 pipeline', '', '(綁定欄還是空的:切片做完、scope-laws claim 出 pipeline 之後才有)', '');
      for (const b of ms.m.binds) {
        const d = design.pipelines.find((q) => q.fullName === b);
        if (!d) { out.push(`# 綁的 pipeline:${b}`, '', '(pipelines/ 裡沒有這一條)', ''); continue; }
        out.push(...wholeFile(`綁的 pipeline:${d.file}`, path.join(root, d.file), '(讀不到)'));
        out.push(`# ${b} 的逐條狀態`, '', ...detailOf(b), '');
      }
    },

    gaps: () => {
      if (!design || !design.gaps.exists) return out.push('# gaps.md', '', '(還沒有 .lawful/gaps.md)', '');
      const open = design.gaps.gaps.filter((g) => g.status === 'open');
      out.push(...wholeFile(`gaps.md(${design.gaps.gaps.length} 條,open 的 ${open.length} 條${open.length ? ':' + open.map((g) => g.id).join('、') : ''})`, path.join(root, design.gaps.file), '(讀不到)'));
    },

    lint: () => {
      const ps = x ? [x.p] : ms.m.binds.map((b) => design.pipelines.find((q) => q.fullName === b)).filter(Boolean);
      if (!ps.length) return out.push('# 對帳:lint sig 與 lint laws', '', '(綁定欄還是空的,沒有 pipeline 可對)', '');
      out.push(`# 對帳:lint sig 與 lint laws 裡講到${x ? '這條 pipeline' : '這條里程碑綁的 pipeline'} 的`, '', ...lintMine([lintSig(design, source, adapter), lintLaws(design, source, adapter)], ps), '');
    },

    lintall: () => out.push('# lawful lint all', '', ...lintText(lintAll(design, source, adapter)), ''),

    lintglobal: () => out.push('# lawful lint global', '', ...lintText(lintGlobal(design, source, adapter)), ''),

    lintboundary: () => out.push('# lawful lint boundary', '', ...lintText([lintBoundary(design, source, adapter)]), ''),

    status: () => out.push('# lawful status', '', ...(statusText ? statusLines().map((l) => l.replace(/^(#+) /, '##$1 ')) : ['(沒有接上 status)']), ''),

    // 需求表、全域 Law、警訊與建議路線:談需求與改全域 Law 要看的那幾節;pipelines、模組與各段清單要看再跑 lawful status
    statusgoals: () => out.push('# lawful status 的需求、全域 Law、等決定、警訊與建議路線(其餘各節要看再跑 lawful status)', '', ...statusSections(['需求', '全域 Law', '3.', '6.', '7.']), ''),

    // 報告裡講到目標的每一行:它在 pipelines 表的那一列、能不能開、卡在哪、誰引用它、它的警訊
    statusrows: () => {
      const keys = x ? [x.p.fullName, `${x.p.id}#`] : ms ? [ms.m.id, ms.q.id, ...ms.m.binds].filter(Boolean) : top ? [top.id] : [];
      const rows = statusRows(keys.map((k) => (/^[A-Z]+-\d+$/.test(k) ? new RegExp(`(?<![\\w-])${k}(?![\\w])`) : k)));
      out.push(`# lawful status 裡講到 ${name} 的每一行(整份報告要看再跑 lawful status)`, '', ...rows, '');
    },

    // 測試輸出放在哪、比最新的原始碼與測試檔新還是舊:舊的輸出不能拿來講現在的紅綠
    logs: () => {
      out.push('# 專案根目錄的測試輸出', '');
      const logs = testLogs(root, source);
      if (!logs.length) return out.push('(根目錄沒有看起來像測試輸出的檔;先跑整套留檔,或用 status --run)', '');
      for (const l of logs) out.push(`- ${l.name}  ${l.fresh ? '比每一個原始碼與測試檔都新' : `比 ${l.newest} 舊:先重跑整套留檔,這一份不能拿來講現在的紅綠`}`);
      out.push('');
    },

    // 這條引用的、與引用這條的 pipeline:全文。改一條 law 或簽名的影響範圍從這裡看
    // 被引用的那一條印 Stages 表;引用這條的只印它引用的那幾列,與提到那幾個名字的 law。全文要看再 Read
    refs: () => {
      if (!x.refs.length && !x.referrers.length) return out.push('# 引用與被引用的 pipeline', '', '(這條不引用別條,也沒有被引用)', '');
      for (const n of x.refs) {
        const p = design.pipelines.find((q) => q.fullName === n);
        if (!p) { out.push(`# 引用的 pipeline:${n}`, '', '(pipelines/ 裡沒有這一條)', ''); continue; }
        const sec = p.sections.find((s) => s.title === 'Stages');
        out.push(`# 引用的 pipeline:${p.file}(${p.status};只印 Stages 表)`, '', ...(sec ? sec.lines.filter((l) => l.trim()) : ['(沒有 Stages 表)']), '');
      }
      for (const n of x.referrers) {
        const p = design.pipelines.find((q) => q.fullName === n);
        if (!p) continue;
        const cited = p.stages.filter((s) => s.ref === name);
        const names = new Set(cited.map((s) => s.name));
        const laws = p.laws.filter((l) => [l.forall, ...l.given, l.conclusion].filter(Boolean).some((t) => (t.match(/[A-Za-z_][\w']*/g) || []).some((id) => names.has(id))));
        out.push(`# 引用這條的 pipeline:${p.file}(${p.status};只印它引用的列與提到它們的 law)`, '');
        for (const s of cited) out.push(`- ${s.index}  \`${s.sigText}\`  ${s.module}/${s.layer}`);
        for (const l of laws) out.push(`- ${l.id} [${l.kind}] ${l.title}`, ...[l.forall, ...l.given, l.conclusion].filter(Boolean).map((t) => `  - ${t}`));
        out.push('');
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
      const others = (git(root, 'git branch --list "plan/*" --format="%(refname:short)"') || []);
      out.push(`- plan 分支:${others.length ? others.join('、') : '無'}`);
      const st = branchState(root);
      out.push(`- 建構中的 build 分支:${st.building.size ? [...st.building].sort().map((k) => `build/${k}`).join('、') : '無'}`);
      out.push(`- 已合進主線卻還在的 build 分支:${st.stale.size ? [...st.stale].sort().map((k) => `build/${k}`).join('、') : '無'}`, '');
    },
  };

  if (bare && skill === 'study') return say([...out, '# 目標', '', '這個專案沒有 .lawful/:沒有現成的地圖,照 skill「前置」自己建工作假說,整份導讀標明它是推測。'].join('\n'));
  const skipped = plan[kind].filter((b) => !source && CODE_BLOCKS.includes(b));
  if (skipped.length) out.push('# 程式碼', '', 'Cone.md 的 language 欄沒有可用的 adapter:簽名與型別的宣告、types 層這幾塊印不出來,要看就直接讀原始碼。', '');
  for (const b of plan[kind]) if (!skipped.includes(b)) block[b]();
  return say(out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, ''));
}
