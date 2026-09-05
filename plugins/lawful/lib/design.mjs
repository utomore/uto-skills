// 讀 .design/ 成一棵樹:system、modules、pipelines、gaps。只讀不判;判在 commands/。
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, sections, findSection, parseTable, parseList, stripTicks } from './markdown.mjs';

export const LAYERS = ['types', 'effects', 'pure', 'shell'];
export const ALLOWED_IMPORTS = {
  types: ['types'],
  effects: ['types', 'effects'],
  pure: ['types', 'effects', 'pure'],
  shell: ['types', 'effects', 'pure', 'shell'],
};
export const LAW_KINDS = ['invariant', 'identity', 'roundtrip', 'relation', 'bound', 'equiv'];
export const STATUSES = ['draft', 'ready', 'frozen'];

function read(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function rel(root, p) {
  return path.relative(root, p).split(path.sep).join('/');
}

export function readSystem(designDir, root) {
  const file = path.join(designDir, 'system.md');
  const text = read(file);
  if (text == null) return null;
  const { fm, body } = parseFrontmatter(text);
  const secs = sections(body);
  const tools = findSection(secs, '語言與工具');
  const ioExtra = [];
  const commands = {};
  if (tools) {
    for (const it of parseList(tools.lines)) {
      const m = /^(建置|測試\(整套\)|測試\(子集\)|IO 模組追加)[::]\s*(.*)$/.exec(it.text);
      if (!m) continue;
      if (m[1] === 'IO 模組追加') {
        for (const v of m[2].split(/[、,]/).map((s) => stripTicks(s.trim()))) if (v && v !== '無') ioExtra.push(v);
      } else commands[m[1]] = stripTicks(m[2]);
    }
  }
  const pl = findSection(secs, 'Pipelines');
  const pipelines = [];
  if (pl) {
    const t = parseTable(pl.lines);
    if (t) for (const r of t.rows) pipelines.push({ fullName: stripTicks(r[0] || ''), kind: (r[1] || '').trim() });
  }
  return { file: rel(root, file), fm, language: fm.language || null, ioExtra, commands, pipelines, sections: secs };
}

// 模組表:[{ pattern, layer, line }];pattern 可能以 .* 結尾。
export function readModules(designDir, root) {
  const file = path.join(designDir, 'modules.md');
  const text = read(file);
  if (text == null) return null;
  const { body } = parseFrontmatter(text);
  const t = parseTable(body.split(/\r?\n/));
  const entries = [];
  if (t) {
    t.rows.forEach((r, i) => {
      const layer = (r[1] || '').trim();
      for (const raw of (r[0] || '').split(/[、,]/)) {
        const pattern = stripTicks(raw.trim());
        if (pattern) entries.push({ pattern, layer, line: t.rowLines[i] + 1 });
      }
    });
  }
  return { file: rel(root, file), entries };
}

export function matchModule(entries, moduleName) {
  const exact = entries.find((e) => e.pattern === moduleName);
  if (exact) return exact;
  let best = null;
  for (const e of entries) {
    if (!e.pattern.endsWith('.*')) continue;
    const prefix = e.pattern.slice(0, -2);
    if (moduleName === prefix || moduleName.startsWith(prefix + '.')) {
      if (!best || prefix.length > best.pattern.length - 2) best = e;
    }
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
    return {
      index: (r[0] || '').trim(),
      whole: (r[0] || '').trim() === '=',
      name,
      type,
      sigText,
      what: (r[2] || '').trim(),
      module,
      wish,
      ref: refM ? refM[1] : null,
      layer: (r[4] || '').trim(),
      line: sec.start + t.rowLines[i] + 1,
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
  }));
}

export function readPipeline(file, root) {
  const text = read(file);
  if (text == null) return null;
  const { fm, body, hasFrontmatter } = parseFrontmatter(text);
  const secs = sections(body);
  const base = path.basename(file, '.md');
  const idM = /^(P-\d{3})-(.+)$/.exec(base);
  const decisions = findSection(secs, '決定');
  const revs = findSection(secs, '修訂記錄');
  const revItems = revs ? parseList(revs.lines).filter((i) => /^REV-\d+/.test(i.text)) : [];
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
    stages: parseStages(findSection(secs, 'Stages')),
    laws: parseLaws(findSection(secs, 'Laws')),
    examples: parseExamples(findSection(secs, 'Examples')),
    decisions,
    thawed: decisions ? decisions.lines.some((l) => /解凍/.test(l)) : false,
    revs: revItems,
  };
}

export function readGaps(designDir, root) {
  const file = path.join(designDir, 'gaps.md');
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

export function readDesign(root) {
  const designDir = path.join(root, '.design');
  if (!fs.existsSync(designDir)) return null;
  const pipelinesDir = path.join(designDir, 'pipelines');
  const files = fs.existsSync(pipelinesDir)
    ? fs.readdirSync(pipelinesDir).filter((f) => /^P-\d{3}-.+\.md$/.test(f)).sort()
    : [];
  return {
    root,
    designDir,
    system: readSystem(designDir, root),
    modules: readModules(designDir, root),
    pipelines: files.map((f) => readPipeline(path.join(pipelinesDir, f), root)),
    gaps: readGaps(designDir, root),
  };
}
