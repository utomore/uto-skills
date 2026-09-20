// brief <skill> [<目標>]:一個 skill 開工要的東西一次印完——規章的節,加上這個 skill 在這個專案裡要看的那幾塊
// (目標 pipeline、逐條狀態、Stages 上每條簽名與型別的宣告、types 層、Cone.md、目標檔、開發日誌、分支狀態、lint、status 報告 …)。
// 唯讀;永遠 exit 0,問題用文字講(skill 載入時由 harness 執行,非 0 會被讀成載入失敗)。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, sections } from '../markdown.mjs';
import { findType } from '../source.mjs';
import { analyze, branchState, pipelineDetail } from './status.mjs';
import { lintAll, lintBoundary, lintLaws, lintSig, renderLint } from './lint.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// 每個 skill 開工要讀的規章節;'*' 是整份。這張表是「誰讀什麼」的唯一來源。
const RULES = {
  module: [['boundary.md', ['四層', '模組單元', '模組表']], ['tooling.md', ['CLI', '收尾定錨']]],
  design: [['pipelines.md', ['`.lawful/`', 'Cone.md', '願景、需求、目標與路線', 'ADR']], ['boundary.md', '*'], ['tooling.md', ['language adapter', '收尾定錨']]],
  objective: [['pipelines.md', ['願景、需求、目標與路線', '完成度']], ['tooling.md', ['CLI', 'status 報告', '收尾定錨']]],
  pipeline: [['pipelines.md', ['pipeline', '編號與引用', 'frontmatter 與 status', '節', '什麼要有 law']], ['roles.md', ['分支與所有權', '骨架與基線']], ['boundary.md', ['模組表', '效果的判定']], ['tooling.md', ['CLI', '收尾定錨']]],
  build: [['roles.md', '*'], ['pipelines.md', ['提問(GAP)', '修訂(REV)', '完成度']], ['tooling.md', ['CLI', '跑東西的紀律', '收尾定錨']]],
  integrate: [['roles.md', ['分支與所有權', '開發日誌', '整合', '仲裁']], ['pipelines.md', ['提問(GAP)', '完成度']], ['tooling.md', ['CLI', '跑東西的紀律', '收尾定錨']]],
  qa: [['roles.md', ['三角色', '委派', '骨架與基線', '驗收測試', 'qa 的交付']], ['pipelines.md', ['節', '什麼要有 law', '提問(GAP)']], ['boundary.md', ['測試與邊界']]],
  impl: [['roles.md', ['三角色', '委派']], ['pipelines.md', ['節', '提問(GAP)']], ['boundary.md', ['四層']]],
  revise: [['pipelines.md', ['frontmatter 與 status', '修訂(REV)', '提問(GAP)', '願景、需求、目標與路線']], ['roles.md', ['分支與所有權', '骨架與基線']], ['tooling.md', ['收尾定錨']]],
  status: [['tooling.md', ['CLI', 'status 報告', '跑東西的紀律', '收尾定錨']], ['pipelines.md', ['願景、需求、目標與路線', '完成度']]],
  audit: [['tooling.md', ['CLI', 'status 報告', '收尾定錨']], ['boundary.md', '*'], ['pipelines.md', ['願景、需求、目標與路線', '節', '什麼要有 law', '完成度']]],
  spike: [['pipelines.md', ['spike']], ['roles.md', ['委派', 'spike']], ['tooling.md', ['跑東西的紀律']]],
  study: [['tooling.md', ['跑東西的紀律', '收尾定錨']], ['boundary.md', ['四層', '效果的判定']], ['pipelines.md', ['pipeline']]],
};

// 每個 skill 的 brief 由哪幾塊組成,依目標的種類分:doc(pipeline 全名)、top(R-n / O-n)、rf(RF-n)、spike(SPK-00x)、none(沒有目標)。
// 沒列的種類 = 這個 skill 不收那種目標。
const BLOCKS = {
  module: { none: ['constraints', 'modules', 'lintboundary'] },
  design: { none: ['tree', 'cone', 'objectives', 'modules'] },
  objective: { none: ['cone', 'objectives', 'statusgoals'] },
  pipeline: { doc: ['branch', 'doc', 'detail', 'objective', 'constraints', 'modules', 'typeslayer', 'refs', 'lint'], none: ['branch', 'cone', 'objectives', 'modules', 'typeslayer'] },
  build: { doc: ['branch', 'constraints', 'doc', 'detail', 'refs', 'lint', 'gaps', 'logs', 'statusrows'], top: ['branch', 'constraints', 'top', 'touched', 'gaps', 'logs', 'statusrows'] },
  integrate: { none: ['branch', 'journals', 'constraints', 'gaps'] },
  qa: { doc: ['doc', 'detail', 'declarations', 'typeslayer', 'testing'], top: ['top', 'touched', 'typeslayer', 'testing'] },
  impl: { doc: ['doc', 'detail', 'declarations', 'typeslayer', 'files'] },
  revise: { doc: ['branch', 'doc', 'detail', 'declarations', 'refs', 'objective', 'gaps', 'lint', 'statusrows'], rf: ['branch', 'refinement', 'gaps', 'statusrows'], none: ['branch', 'gaps', 'statusgoals'] },
  status: { none: ['constraints', 'logs'] },
  audit: { none: ['lintall', 'status'] },
  spike: { none: ['spikes'], spike: ['spikedoc', 'spikes'] },
  study: { none: ['tree', 'constraints', 'modules'] },
};
const KIND_WORD = { doc: '一條 pipeline 的全名 P-00x-<slug>', top: 'R-n 或 O-n', rf: '一條調整 RF-n', spike: '一份 spike 的編號 SPK-00x', none: '不給目標' };
export const briefSkills = Object.keys(RULES);

const INLINE_LINES = 400; // types 層內嵌的總行數上限;超過的模組只列匯出
const TYPE_LINES = 40;    // 一個型別宣告最多印幾行
const TARGET_RE = /^(?:P-\d{3}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?|SPK-\d{3}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?|R-\d+|O-\d+|RF-\d+)$/;

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
      const s = secs.find((x) => x.title === t);
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
  const objectives = design ? design.objectives.objectives : [];

  // 目標的種類
  const x = target && /^P-\d{3}/.test(target) ? docs.find((v) => v.p.fullName === target || v.p.id === target) : null;
  const req = cone && /^R-\d+$/.test(target) ? cone.requirements.find((r) => r.id === target) : null;
  const obj = /^O-\d+$/.test(target) ? objectives.find((o) => o.id === target) : null;
  const rf = /^RF-\d+$/.test(target) ? objectives.flatMap((o) => o.refinements.map((r) => ({ r, o }))).find(({ r }) => r.id === target) : null;
  const spk = design && /^SPK-\d{3}/.test(target) ? design.spikes.find((s) => s.fullName === target || s.id === target) : null;
  const reqOf = (id) => (cone ? cone.requirements.find((r) => r.id === id) : null);
  // 目標的 Law 寫「繼承 R-n」時,三行是那條需求的
  const objLaw = obj && obj.law && obj.law.inherits ? (reqOf(obj.law.inherits) || {}).law || obj.law : obj ? obj.law : null;
  const top = req ? { id: req.id, title: req.title, law: req.law, kind: '需求的 Law' } : obj ? { id: obj.id, title: obj.title, law: objLaw, kind: `目標的 Law${obj.law && obj.law.inherits ? `(繼承 ${obj.law.inherits})` : ''}` } : null;
  const topLines = top && top.law ? [top.law.forall, ...top.law.given, top.law.conclusion].filter(Boolean) : [];
  const kind = !target ? 'none' : x ? 'doc' : top ? 'top' : rf ? 'rf' : spk ? 'spike' : 'missing';
  const name = x ? x.p.fullName : spk ? spk.fullName : target;

  const docAbs = x ? path.join(root, x.p.file) : spk ? spk.abs : rf ? path.join(root, rf.o.file) : null;
  const docText = docAbs ? fs.readFileSync(docAbs, 'utf8') : '';
  const hashed = docAbs ? sha8(docText) : top ? sha8(`${top.title}\n${top.law ? top.law.title : ''}\n${topLines.join('\n')}`) : '-';
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
  if (!design && !bare && skill !== 'design') return stop('這個目錄底下沒有 .lawful/:工作目錄不是專案根目錄,或 --root 沒指到工作樹。停下,回報。');
  if (kind === 'missing') {
    const names = design ? design.pipelines.map((p) => p.fullName) : [];
    return stop(`這棵樹沒有 ${target}。pipeline:${names.length ? names.join('、') : '(一條都沒有)'};需求:${cone && cone.requirements.length ? cone.requirements.map((r) => r.id).join('、') : '(一條都沒有)'};目標:${objectives.length ? objectives.map((o) => o.id).join('、') : '(一個都沒有)'}。停下,回報。`);
  }
  if (!plan[kind]) {
    if (kind === 'none') return stop(`目標未指定;lawful:${skill} 的目標是${accepts}。定出目標之後跑一次:lawful brief ${skill} <目標> [--root <工作樹>] --no-rules`);
    return stop(`${name} 不是 lawful:${skill} 收的目標;它收的是${accepts}。停下,回報。`);
  }
  // 沒有 adapter 的語言:qa 與 impl 沒有宣告開不了工;其餘的 skill 照印,讀程式碼的那幾塊各留一行說明
  const CODE_BLOCKS = ['declarations', 'typeslayer', 'testing', 'files', 'touched'];
  if (!source && (skill === 'qa' || skill === 'impl')) return stop('Cone.md 的 language 欄沒有可用的 adapter,程式碼對不了帳:宣告與 types 層那幾塊印不出來。停下,回報。');

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
  const command = (key) => (cone && cone.commands[key]) || '(Cone.md「專案約束」沒有寫)';
  const typesModules = () => (source ? [...source.modules.values()].filter((m) => m.layer === 'types').sort((p, q) => p.module.localeCompare(q.module)) : []);
  const lintText = (results) => renderLint(results).text.split('\n').map((l) => l.replace(/^## /, '### '));
  // 對帳只留講到這條 pipeline 的那幾條:全專案的紅是 audit 的事,不是這一波的事
  const lintMine = (results) => {
    const keys = [x.p.file, x.p.fullName, `${x.p.id}#`];
    const mine = (msg) => keys.some((k) => msg.includes(k));
    const lines = [];
    for (const r of results) {
      const red = r.red.filter(mine);
      const info = (r.info || []).filter(mine);
      lines.push(`### ${r.title}:這條 pipeline ${red.length} 條不合規(全專案 ${r.red.length} 條)`, ...red.map((m) => `- ✗ ${m}`), ...info.map((m) => `- · ${m}`));
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
    let budget = skill === 'pipeline' ? 0 : INLINE_LINES;
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

  const lawLines = (law) => (!law ? ['- Law:(還沒寫)'] : [`- Law:${law.title}`, ...[law.forall, ...law.given, law.conclusion].filter(Boolean).map((l) => `  - ${l}`)]);
  const requirementLines = (id) => {
    const r = reqOf(id);
    if (!r) return [`(Cone.md 裡沒有 ${id})`];
    return [`${r.id}:${r.title}`, ...lawLines(r.law), ...(r.implication ? [`- 蘊含:${r.implication}`] : [])];
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
      out.push(skill === 'qa' ? '只有宣告,沒有本體:測試從這裡、types 層與文檔寫,不打開 core 與 shell 的本體。' : skill === 'impl' ? 'Stages 上的簽名與型別宣告不准改;要填的本體在下面「要開的檔」。' : 'Stages 上每條簽名與型別現在在程式碼裡的宣告。', '');
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
      const marks = top ? ['LAW'] : ['LAW-1', 'EX-1'];
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
      for (const f of [...new Set(x.stages.filter((s) => !s.ref).map((s) => (s.hit ? s.hit.file : s.module)).filter(Boolean))]) {
        const mine = stubs.filter((s) => s.hit.file === f).map((s) => s.name);
        out.push(`- ${f}${mine.length ? `  還是骨架的:${mine.join('、')}` : ''}`);
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
      out.push(`# 目標:${top.id}(${top.kind})`, '', `${top.id}:${top.title}`, ...(top.law ? [`Law:${top.law.title}`] : []));
      if (!topLines.length) out.push('', '這一條的 Law 只有一句話,沒有三行式:寫不出可判定的斷言。停下,回報。', '');
      else out.push(...fence('', topLines), '');
      if (obj) out.push(...wholeFile(`目標檔:${obj.file}`, path.join(root, obj.file), '(讀不到)'));
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
      if (!hit.length) out.push('# 引用到的 pipeline', '', '(三行裡的識別字沒有對到任何一條 pipeline 的 Stages)', '');
    },

    constraints: () => {
      const s = cone ? cone.sections.find((q) => q.title === '專案約束') : null;
      out.push('# Cone.md「專案約束」', '', ...(s ? s.lines.filter((l) => l.trim()) : ['(Cone.md 沒有這一節)']), '');
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

    // 綁這條 pipeline 的里程碑、動到它的調整,與它們的需求
    objective: () => {
      const rows = [];
      const reqs = new Set();
      for (const o of objectives) {
        for (const m of o.milestones) if (m.binds.includes(name)) { rows.push(`- ${o.fullName}(優先 ${o.priority == null ? '沒填' : o.priority})的里程碑 ${m.id}:${m.title}(綁定 ${m.binds.join('、')})`); reqs.add(o.requirement); }
        for (const r of o.refinements) if (r.touches.includes(name)) { rows.push(`- ${o.fullName} 的調整 ${r.id}:${r.title}(動到 ${r.touches.join('、')})`); reqs.add(o.requirement); }
      }
      out.push('# 這條 pipeline 朝向哪裡', '', ...(rows.length ? rows : ['(沒有任何里程碑綁它,也沒有調整動到它)']), '');
      for (const r of [...reqs].filter(Boolean).sort()) out.push(...requirementLines(r), '');
    },

    objectives: () => {
      if (!objectives.length) return out.push('# 目標檔', '', '(objectives/ 底下一檔都沒有)', '');
      for (const o of objectives) out.push(...wholeFile(`目標檔:${o.file}`, path.join(root, o.file), '(讀不到)'));
    },

    // 一條調整:它那個目標檔全文、需求的 Law,與它動到的每一條 pipeline 全文
    refinement: () => {
      out.push(`# 目標:${rf.r.id}(${rf.o.fullName} 的調整)`, '', `${rf.r.id}:${rf.r.title}`, `動到:${rf.r.touches.length ? rf.r.touches.join('、') : '(還沒寫)'}`, '');
      out.push(...wholeFile(`目標檔:${rf.o.file}`, path.join(root, rf.o.file), '(讀不到)'));
      out.push('# 這條調整的需求', '', ...requirementLines(rf.o.requirement), '');
      for (const t of rf.r.touches) {
        const p = design.pipelines.find((q) => q.fullName === t);
        if (!p) { out.push(`# 動到的 pipeline:${t}`, '', '(pipelines/ 裡沒有這一條)', ''); continue; }
        out.push(...wholeFile(`動到的 pipeline:${p.file}`, path.join(root, p.file), '(讀不到)'));
        out.push(`# ${t} 的逐條狀態`, '', ...detailOf(t), '');
      }
    },

    journals: () => {
      out.push('# 開發日誌清單', '');
      const dir = lawful_('journal');
      const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
      if (!files.length) return out.push('(這棵樹的 .lawful/journal/ 是空的;各條 build 分支的日誌在它們自己的分支上)', '');
      for (const f of files) {
        const { fm } = parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
        out.push(`- .lawful/journal/${f}${fm.pipeline ? `  pipeline ${fm.pipeline}` : ''}${fm.branch ? `  分支 ${fm.branch}` : ''}${fm.base ? `  base ${fm.base}` : ''}`);
      }
      out.push('');
    },

    gaps: () => {
      if (!design || !design.gaps.exists) return out.push('# gaps.md', '', '(還沒有 .lawful/gaps.md)', '');
      const open = design.gaps.gaps.filter((g) => g.status === 'open');
      out.push(...wholeFile(`gaps.md(${design.gaps.gaps.length} 條,open 的 ${open.length} 條${open.length ? ':' + open.map((g) => g.id).join('、') : ''})`, path.join(root, design.gaps.file), '(讀不到)'));
    },

    lint: () => out.push('# 對帳:lint sig 與 lint laws 裡講到這條 pipeline 的', '', ...lintMine([lintSig(design, source, adapter), lintLaws(design, source, adapter)]), ''),

    lintall: () => out.push('# lawful lint all', '', ...lintText(lintAll(design, source, adapter)), ''),

    lintboundary: () => out.push('# lawful lint boundary', '', ...lintText([lintBoundary(design, source, adapter)]), ''),

    status: () => out.push('# lawful status', '', ...(statusText ? statusLines().map((l) => l.replace(/^(#+) /, '##$1 ')) : ['(沒有接上 status)']), ''),

    // 需求表、目標表、警訊與建議路線:訂目標與修訂要看的那幾節;pipelines、模組與各段清單要看再跑 lawful status
    statusgoals: () => out.push('# lawful status 的需求、目標、等決定、警訊與建議路線(其餘各節要看再跑 lawful status)', '', ...statusSections(['需求', '目標', '3.', '6.', '7.']), ''),

    // 報告裡講到目標的每一行:它在 pipelines 表的那一列、能不能開、卡在哪、誰引用它、它的警訊
    statusrows: () => {
      const keys = x ? [x.p.fullName, `${x.p.id}#`] : rf ? [rf.r.id, rf.o.id, ...rf.r.touches] : top ? [top.id, ...(obj ? [obj.requirement] : objectives.filter((o) => o.requirement === top.id).map((o) => o.id))].filter(Boolean) : [];
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

    spikedoc: () => out.push(`# 目標 spike:${spk.file}`, '', '````markdown', docText.replace(/\r\n/g, '\n').replace(/\s+$/, ''), '````', ''),

    spikes: () => {
      out.push('# 現有的 spike', '');
      if (!design.spikes.length) out.push('(.lawful/spikes/ 底下一份都沒有;第一份是 SPK-001)');
      for (const s of design.spikes) out.push(`- ${s.fullName}  status ${s.status || '(沒填)'}${s.verdict ? `  verdict ${s.verdict}` : ''}${s.feeds.length ? `  feeds ${s.feeds.join('、')}` : ''}  ${s.rounds.length} 輪`);
      const dir = path.join(root, 'spike');
      const kept = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
      out.push(`- 專案根目錄 spike/ 底下還在的資料夾:${kept.length ? kept.join('、') : '無'}`, '');
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
      const others = (git(root, 'git branch --list "design/*" --format="%(refname:short)"') || []);
      out.push(`- 設計分支:${others.length ? others.join('、') : '無'}`);
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
