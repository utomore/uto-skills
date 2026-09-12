// 一層一棵原始碼樹;system.md 的「原始碼根目錄」是帶 <層> 的樣式,預設 src-<層>。
export function layerRoot(system, layer) {
  const pattern = (system && system.srcRoot) || 'src-<層>';
  return pattern.split('<層>').join(layer);
}

// 一個檔住在哪一層:看它在哪棵原始碼樹底下;都不在回 null。最長的根目錄先算,樹互相包含也對。
export function layerOfFile(system, file) {
  let best = null;
  for (const layer of LAYERS) {
    const root = layerRoot(system, layer);
    if (file === root || file.startsWith(`${root}/`)) {
      if (!best || root.length > layerRoot(system, best).length) best = layer;
    }
  }
  return best;
}
// 一個模組單元的領域名詞:去掉模組前綴,大駝峰拆成 kebab(Weft.ActionSequence → action-sequence;Game.Save.Extra → save-extra)。
export function unitSlug(system, unit) {
  const prefix = system && system.modulePrefix;
  let rest = unit;
  if (prefix && (unit === prefix || unit.startsWith(prefix + '.'))) rest = unit.slice(prefix.length + 1);
  return rest.split('.').filter(Boolean).map((seg) => seg.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()).join('-');
}
// slug 的領域名詞對到哪個模組單元:領域名詞是 slug 的前綴、後面還接著「-動詞」的那一列,最長的先算;對不到回 null。
export function unitOfSlug(system, entries, slug) {
  let best = null;
  for (const e of entries) {
    const d = unitSlug(system, e.unit);
    if (!d || !slug.startsWith(d + '-')) continue;
    if (!best || d.length > unitSlug(system, best.unit).length) best = e;
  }
  return best;
}
// 讀 .lawful/ 成一棵樹:system(含願景)、objectives(目標與里程碑)、modules、pipelines、gaps、spikes。只讀不判;判在 commands/。
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, sections, findSection, parseTable, parseList, stripTicks } from './markdown.mjs';

// 指令欄只取第一個反引號區段;反引號外的文字是給人看的說明,不是指令的一部分。沒有反引號就整段當指令。
function codeSpan(s) {
  const m = /`([^`]+)`/.exec(s);
  return m ? m[1].trim() : s.trim();
}

// 模板的佔位符:整格是 <…>。claim 建出來還沒寫的列不算 stage / law / example,另計成「還是模板」。
const isPlaceholder = (s) => /^<[^>]*>?$/.test((s || '').trim());
// 願景、目標、里程碑的文字裡永遠不會有角括號,所以出現 <…> 就是還沒填。
const hasPlaceholder = (s) => /<[^>]*>/.test(s || '');

export const LAYERS = ['types', 'effect', 'core', 'shell'];
export const ALLOWED_IMPORTS = {
  types: ['types'],
  effect: ['types', 'effect'],
  core: ['types', 'effect', 'core'],
  shell: ['types', 'effect', 'core', 'shell'],
};
export const LAW_KINDS = ['invariant', 'identity', 'roundtrip', 'relation', 'bound', 'equiv', 'total', 'commute'];
export const STATUSES = ['draft', 'ready', 'frozen'];

function read(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function rel(root, p) {
  return path.relative(root, p).split(path.sep).join('/');
}

export function readSystem(lawfulDir, root) {
  const file = path.join(lawfulDir, 'system.md');
  const text = read(file);
  if (text == null) return null;
  const { fm, body } = parseFrontmatter(text);
  const secs = sections(body);
  // 節的 start 是 body 內的行號;加回 frontmatter 佔的行數,訊息才指到檔案的真實行
  const offset = (text.slice(0, text.length - body.length).match(/\n/g) || []).length;
  for (const s of secs) s.start += offset;
  const tools = findSection(secs, '語言與工具');
  const ioExtra = [];
  const effectExtra = [];
  const ignoreDirs = [];
  const commands = {};
  let modulePrefix = '';
  let srcRoot = '';
  // 反引號區段以外的文字是給人看的說明;「無」與還沒填的佔位符都當沒給
  const one = (v) => (!v || v === '無' || /^<[^>]*>$/.test(v) ? '' : v);
  if (tools) {
    for (const it of parseList(tools.lines)) {
      const m = /^(建置|測試\(整套\)|測試\(子集\)|IO 模組追加|效果型別追加|忽略目錄|模組前綴|原始碼根目錄)[::]\s*(.*)$/.exec(it.text);
      if (!m) continue;
      const list = () => m[2].split(/[、,]/).map((s) => stripTicks(s.trim()).replace(/\/$/, '')).filter((v) => v && v !== '無');
      if (m[1] === 'IO 模組追加') ioExtra.push(...list());
      else if (m[1] === '效果型別追加') effectExtra.push(...list());
      else if (m[1] === '忽略目錄') ignoreDirs.push(...list());
      else if (m[1] === '模組前綴') modulePrefix = one(codeSpan(m[2]));
      else if (m[1] === '原始碼根目錄') srcRoot = one(codeSpan(m[2])).replace(/[/]$/, '');
      else commands[m[1]] = codeSpan(m[2]);
    }
  }
  // 對外 I/O 表:[{ name, direction, type, module, pipeline, line }]
  const ioSec = findSection(secs, '對外 I/O');
  const io = [];
  if (ioSec) {
    const t = parseTable(ioSec.lines);
    if (t) t.rows.forEach((r, i) => io.push({ name: (r[0] || '').trim(), direction: (r[1] || '').trim(), type: stripTicks(r[2] || ''), module: stripTicks(r[3] || ''), pipeline: stripTicks(r[4] || ''), line: ioSec.start + t.rowLines[i] + 2 }));
  }
  const pl = findSection(secs, 'Pipelines');
  const pipelines = [];
  if (pl) {
    const t = parseTable(pl.lines);
    if (t) for (const r of t.rows) pipelines.push({ fullName: stripTicks(r[0] || ''), kind: (r[1] || '').trim() });
  }
  // 願景:整節的文字;沒有這一節是 missing,還留著 <…> 是 template
  const visionSec = findSection(secs, '願景');
  // 願景:第一段是報告第一行印的那句;整節留給看板與 --json
  const paragraphs = visionSec ? visionSec.lines.join('\n').split(/\n\s*\n/).map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean).join(' ')).filter(Boolean) : [];
  const visionFull = paragraphs.join(' ');
  const vision = paragraphs[0] || '';
  const visionState = !visionSec ? 'missing' : !visionFull || hasPlaceholder(visionFull) ? 'template' : 'ok';
  return { file: rel(root, file), fm, language: fm.language || null, vision, visionFull, visionState, ioExtra, effectExtra, ignoreDirs, modulePrefix, srcRoot: srcRoot || 'src-<層>', commands, io, pipelines, sections: secs };
}

// 目標:objectives.md 每個 ## O-n:<一句話> 一個目標;優先與判準是清單項,里程碑是節裡的表(里程碑 | 做到什麼 | 綁定)。
// 綁定欄是 pipeline 全名,「、」分隔;綁定是里程碑對到 pipeline 的唯一寫法,完成度從綁定的 pipeline 推。
export function readObjectives(lawfulDir, root) {
  const file = path.join(lawfulDir, 'objectives.md');
  const text = read(file);
  if (text == null) return { file: rel(root, file), exists: false, objectives: [], priorityNote: '', priorityNoteState: 'missing' };
  const { body } = parseFrontmatter(text);
  const secs = sections(body);
  const offset = (text.slice(0, text.length - body.length).match(/\n/g) || []).length;
  // 開頭(第一個 ## O-n 之前)一行「優先:1 = …;2 = …;3 = …;4 = …」,宣告優先各級在這個專案代表什麼
  const head = secs.find((s) => s.level === 1) || secs[0];
  const headLines = head && !/^O-\d+/.test(head.title) ? head.lines : [];
  const noteLine = headLines.map((l) => l.replace(/^[-*]\s*/, '').trim()).find((l) => /^優先[::]/.test(l)) || '';
  const priorityNote = noteLine.replace(/^優先[::]\s*/, '').trim();
  const objectives = [];
  for (const s of secs) {
    if (s.level !== 2) continue;
    const m = /^(O-\d+)\s*[::]\s*(.*)$/.exec(s.title);
    if (!m) continue;
    const items = parseList(s.lines);
    const field = (k) => {
      const it = items.find((i) => new RegExp(`^${k}[::]`).test(i.text));
      return it ? it.text.replace(/^[^::]*[::]\s*/, '').trim() : '';
    };
    const priorityRaw = field('優先');
    const criteria = field('判準');
    const t = parseTable(s.lines);
    const milestones = [];
    if (t) t.rows.forEach((r, i) => {
      const id = (r[0] || '').trim();
      if (!id || hasPlaceholder(id)) return;
      const title = (r[1] || '').trim();
      const binds = (r[2] || '').split(/[、,]/).map((x) => stripTicks(x.trim())).filter((x) => x && !/^[-—–]$/.test(x) && !hasPlaceholder(x));
      milestones.push({ id, title, binds, line: s.start + offset + t.rowLines[i] + 2, placeholder: hasPlaceholder(title) });
    });
    objectives.push({
      id: m[1],
      title: m[2].trim(),
      priority: /^[1-4]$/.test(priorityRaw) ? Number(priorityRaw) : null,
      priorityRaw,
      criteria: hasPlaceholder(criteria) ? '' : criteria,
      milestones,
      line: s.start + offset + 1,
      placeholder: hasPlaceholder(m[2]),
    });
  }
  return { file: rel(root, file), exists: true, objectives, priorityNote, priorityNoteState: !priorityNote ? 'missing' : hasPlaceholder(priorityNote) ? 'template' : 'ok' };
}

// 模組表:一列一個模組單元 [{ unit, layers, responsibility, line }]。
export function readModules(lawfulDir, root) {
  const file = path.join(lawfulDir, 'modules.md');
  const text = read(file);
  if (text == null) return null;
  const { body } = parseFrontmatter(text);
  const t = parseTable(body.split(/\r?\n/));
  const entries = [];
  if (t) {
    t.rows.forEach((r, i) => {
      const unit = stripTicks((r[0] || '').trim());
      if (!unit) return;
      const layers = (r[1] || '').split(/[、,]/).map((s) => stripTicks(s.trim())).filter(Boolean);
      const responsibility = (r[2] || '').trim();
      entries.push({ unit, layers, responsibility, line: t.rowLines[i] + 1, placeholder: isPlaceholder(unit) || hasPlaceholder(responsibility) });
    });
  }
  return { file: rel(root, file), entries };
}

// 一個模組名屬於哪個模組單元:模組表上名字是它最長前綴的那一列;對不到回 null。
// 層不看名字,看檔案在哪棵樹(layerOfFile)。
export function unitOf(entries, moduleName) {
  let best = null;
  for (const e of entries) {
    if (moduleName !== e.unit && !moduleName.startsWith(e.unit + '.')) continue;
    if (!best || e.unit.length > best.unit.length) best = e;
  }
  return best;
}
export function matchesPattern(pattern, moduleName) {
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return moduleName === prefix || moduleName.startsWith(prefix + '.');
  }
  return pattern === moduleName;
}

function parseStages(sec) {
  if (!sec) return [];
  const t = parseTable(sec.lines);
  if (!t) return [];
  return t.rows.map((r, i) => {
    const sigText = stripTicks(r[1] || '');
    const sep = sigText.indexOf('::');
    const name = sep >= 0 ? sigText.slice(0, sep).trim() : sigText.trim();
    const type = sep >= 0 ? sigText.slice(sep + 2).replace(/\s+/g, ' ').trim() : '';
    const modCell = (r[3] || '').trim();
    const paren = /^(.*?)\s*[((](.*)[))]\s*$/.exec(modCell);
    const module = stripTicks(paren ? paren[1] : modCell);
    const note = paren ? paren[2] : '';
    const wish = /願望/.test(note);
    const refM = /(P-\d{3}-[a-z0-9-]+)/.exec(note);
    const index = (r[0] || '').trim();
    return {
      index,
      whole: index === '=',
      observe: index === 'o',
      runner: index === '!',
      name,
      type,
      sigText,
      what: (r[2] || '').trim(),
      module,
      wish,
      ref: refM ? refM[1] : null,
      layer: (r[4] || '').trim(),
      line: sec.start + t.rowLines[i] + 2,
      placeholder: isPlaceholder(sigText) || isPlaceholder(module),
    };
  });
}

function parseLaws(sec) {
  if (!sec) return [];
  return parseList(sec.lines).map((it) => {
    const head = /^(LAW-\d+)\s*\[([^\]]*)\]\s*(.*)$/.exec(it.text);
    const forall = it.children.find((c) => /^forall\b/.test(c)) || null;
    const given = it.children.filter((c) => /^given\b/.test(c));
    const concl = it.children.find((c) => /^\|-/.test(c)) || null;
    return {
      id: head ? head[1] : null,
      kind: head ? head[2].trim() : null,
      title: head ? head[3].trim() : it.text,
      forall,
      given,
      conclusion: concl,
      raw: it,
      placeholder: !!head && isPlaceholder(head[2]),
    };
  });
}

function parseExamples(sec) {
  if (!sec) return [];
  const t = parseTable(sec.lines);
  if (!t) return [];
  return t.rows.map((r) => ({
    id: (r[0] || '').trim(),
    input: stripTicks(r[1] || ''),
    output: stripTicks(r[2] || ''),
    covers: (r[3] || '').split(/[、,]/).map((s) => s.trim()).filter(Boolean),
    placeholder: isPlaceholder(stripTicks(r[1] || '')) || isPlaceholder(stripTicks(r[2] || '')),
  }));
}

export function readPipeline(file, root) {
  const text = read(file);
  if (text == null) return null;
  const { fm, body, hasFrontmatter } = parseFrontmatter(text);
  const secs = sections(body);
  // 節的 start 是 body 內的行號;加回 frontmatter 佔的行數,訊息與 sync 才指到檔案的真實行
  const offset = (text.slice(0, text.length - body.length).match(/\n/g) || []).length;
  for (const s of secs) s.start += offset;
  const base = path.basename(file, '.md');
  const idM = /^(P-\d{3})-(.+)$/.exec(base);
  const decisions = findSection(secs, '決定');
  const revs = findSection(secs, '修訂記錄');
  const revItems = revs ? parseList(revs.lines).filter((i) => /^REV-\d+/.test(i.text)) : [];
  const stages = parseStages(findSection(secs, 'Stages'));
  const laws = parseLaws(findSection(secs, 'Laws'));
  const examples = parseExamples(findSection(secs, 'Examples'));
  const template = { stages: stages.filter((s) => s.placeholder).length, laws: laws.filter((l) => l.placeholder).length, examples: examples.filter((e) => e.placeholder).length };
  return {
    file: rel(root, file),
    fullName: base,
    id: fm.id || (idM ? idM[1] : null),
    slug: idM ? idM[2] : null,
    fm,
    hasFrontmatter,
    status: fm.status || null,
    description: fm.description || '',
    sections: secs,
    brief: findSection(secs, 'Brief'),
    stages: stages.filter((s) => !s.placeholder),
    laws: laws.filter((l) => !l.placeholder),
    examples: examples.filter((e) => !e.placeholder),
    template,
    decisions,
    thawed: decisions ? decisions.lines.some((l) => /解凍/.test(l)) : false,
    revs: revItems,
  };
}

export function readGaps(lawfulDir, root) {
  const file = path.join(lawfulDir, 'gaps.md');
  const text = read(file);
  if (text == null) return { file: rel(root, file), exists: false, gaps: [] };
  const secs = sections(parseFrontmatter(text).body);
  const gaps = [];
  for (const s of secs) {
    const m = /^(GAP-\d+)\s*[((]\s*(.*?)\s*\/\s*(\w+)\s*[))]/.exec(s.title);
    if (!m) continue;
    const status = (parseList(s.lines).find((i) => /^狀態[::]/.test(i.text)) || { text: '' }).text.replace(/^狀態[::]\s*/, '');
    gaps.push({ id: m[1], target: m[2], role: m[3], status, line: s.start + 1 });
  }
  return { file: rel(root, file), exists: true, gaps };
}

export function readSpikes(lawfulDir, root) {
  const dir = path.join(lawfulDir, 'spikes');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^SPK-\d{3}-.+\.md$/.test(f)).sort().map((f) => {
    const file = path.join(dir, f);
    const { fm, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    const secs = sections(body);
    const rounds = secs.filter((s) => s.level === 3 && /^RND-\d+/.test(s.title)).map((s) => ({
      id: /^(RND-\d+)/.exec(s.title)[1],
      sha: (parseList(s.lines).find((i) => /^sha[::]/.test(i.text)) || { text: '' }).text.replace(/^sha[::]\s*/, '').trim(),
    }));
    const base = path.basename(f, '.md');
    return {
      file: rel(root, file),
      abs: file,
      fullName: base,
      id: fm.id || base.slice(0, 7),
      slug: base.slice(8),
      status: fm.status || '',
      verdict: fm.verdict || '',
      feeds: Array.isArray(fm.feeds) ? fm.feeds : fm.feeds ? [fm.feeds] : [],
      rounds,
    };
  });
}

export function readDesign(root) {
  const lawfulDir = path.join(root, '.lawful');
  if (!fs.existsSync(lawfulDir)) return null;
  const pipelinesDir = path.join(lawfulDir, 'pipelines');
  const files = fs.existsSync(pipelinesDir)
    ? fs.readdirSync(pipelinesDir).filter((f) => /^P-\d{3}-.+\.md$/.test(f)).sort()
    : [];
  return {
    root,
    lawfulDir,
    pipelinesDir,
    system: readSystem(lawfulDir, root),
    objectives: readObjectives(lawfulDir, root),
    modules: readModules(lawfulDir, root),
    pipelines: files.map((f) => readPipeline(path.join(pipelinesDir, f), root)),
    gaps: readGaps(lawfulDir, root),
    spikes: readSpikes(lawfulDir, root),
  };
}
