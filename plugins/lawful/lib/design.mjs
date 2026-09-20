// 一層一棵原始碼樹;Cone.md「專案約束」的「原始碼根目錄」是帶 <層> 的樣式,預設 src-<層>。
export function layerRoot(cone, layer) {
  const pattern = (cone && cone.srcRoot) || 'src-<層>';
  return pattern.split('<層>').join(layer);
}

// 一個檔住在哪一層:看它在哪棵原始碼樹底下;都不在回 null。最長的根目錄先算,樹互相包含也對。
export function layerOfFile(cone, file) {
  let best = null;
  for (const layer of LAYERS) {
    const root = layerRoot(cone, layer);
    if (file === root || file.startsWith(`${root}/`)) {
      if (!best || root.length > layerRoot(cone, best).length) best = layer;
    }
  }
  return best;
}
// 一個模組單元的領域名詞:去掉模組前綴,大駝峰拆成 kebab(Game.ActionSequence → action-sequence;Game.Save.Extra → save-extra)。
export function unitSlug(cone, unit) {
  const prefix = cone && cone.modulePrefix;
  let rest = unit;
  if (prefix && (unit === prefix || unit.startsWith(prefix + '.'))) rest = unit.slice(prefix.length + 1);
  return rest.split('.').filter(Boolean).map((seg) => seg.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()).join('-');
}
// slug 的領域名詞對到哪個模組單元:領域名詞是 slug 的前綴、後面還接著「-動詞」的那一列,最長的先算;對不到回 null。
export function unitOfSlug(cone, entries, slug) {
  let best = null;
  for (const e of entries) {
    const d = unitSlug(cone, e.unit);
    if (!d || !slug.startsWith(d + '-')) continue;
    if (!best || d.length > unitSlug(cone, best.unit).length) best = e;
  }
  return best;
}
// 讀 .lawful/ 成一棵樹:cone(願景、全域 Law 三區、專案約束)、requirements(需求:驗收、優先、里程碑、調整)、modules(模組單元)、pipelines、gaps、journals。只讀不判;判在 commands/。
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, sections, findSection, parseTable, parseTables, parseList, stripTicks } from './markdown.mjs';

// 指令欄只取第一個反引號區段;反引號外的文字是給人看的說明,不是指令的一部分。沒有反引號就整段當指令。
function codeSpan(s) {
  const m = /`([^`]+)`/.exec(s);
  return m ? m[1].trim() : s.trim();
}

// 模板的佔位符:整格是 <…>。claim 建出來還沒寫的列不算 stage / law / example,另計成「還是模板」。
const isPlaceholder = (s) => /^<[^>]*>?$/.test((s || '').trim());
// 願景、需求、里程碑的文字裡永遠不會有角括號,所以出現 <…> 就是還沒填。
const hasPlaceholder = (s) => /<[^>]*>/.test(s || '');

export const LAYERS = ['types', 'effect', 'core', 'shell'];
export const ALLOWED_IMPORTS = {
  types: ['types'],
  effect: ['types', 'effect'],
  core: ['types', 'effect', 'core'],
  shell: ['types', 'effect', 'core', 'shell'],
};
export const LAW_KINDS = ['invariant', 'identity', 'roundtrip', 'relation', 'bound', 'equiv', 'total', 'commute'];
export const STATUSES = ['draft', 'ready', 'verified'];
// kind:io(跨過 shell 的資料流,有進入點)或 subflow(被別條 pipeline 引用的純資料流)。KIND_ALIASES 是照讀的另一種寫法。
export const KINDS = ['io', 'subflow'];
export const KIND_ALIASES = { 'IO 介面': 'io', '子流': 'subflow' };
export const kindOf = (raw) => KIND_ALIASES[raw] || raw;

function read(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function rel(root, p) {
  return path.relative(root, p).split(path.sep).join('/');
}

// 需求的「驗收」:清單項 `- 驗收:<一句可判定的話>`,子項可以是三行式(forall / given / |-)。需求是必須達成的事,不是 law。
// 沒有這一項回 null;有一句話但沒有三行,由驗收測試或里程碑承接。`- Law:` 靜默當同一項讀(written 記下實際寫的是哪個字,給 migrate laws 用)。
function parseAcceptItem(items) {
  const it = items.find((i) => /^(驗收|Law)[::]/.test(i.text));
  if (!it) return null;
  const title = it.text.replace(/^(驗收|Law)[::]\s*/, '').trim();
  return {
    title,
    forall: it.children.find((c) => /^forall\b/.test(c)) || null,
    given: it.children.filter((c) => /^given\b/.test(c)),
    conclusion: it.children.find((c) => /^\|-/.test(c)) || null,
    formal: it.children.some((c) => /^(forall\b|\|-)/.test(c)),
    placeholder: hasPlaceholder(title),
    written: /^Law/.test(it.text) ? 'Law' : '驗收',
  };
}

// 一條三行式:{ title, forall, given, conclusion, formal, placeholder }
function threeLines(title, children, placeholder) {
  return {
    title,
    forall: children.find((c) => /^forall\b/.test(c)) || null,
    given: children.filter((c) => /^given\b/.test(c)),
    conclusion: children.find((c) => /^\|-/.test(c)) || null,
    formal: children.some((c) => /^(forall\b|\|-)/.test(c)),
    placeholder,
  };
}

// 對外 I/O 表的列:名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline | 契約
// 契約:守這一端的 law,寫 P-00x#LAW-n 或 INV-n,「、」分隔;沒有就「-」
function ioRows(sec, offset = 0) {
  const t = sec ? parseTable(sec.lines) : null;
  if (!t) return [];
  return t.rows.map((r, i) => ({
    name: (r[0] || '').trim(),
    direction: (r[1] || '').trim(),
    type: stripTicks(r[2] || ''),
    module: stripTicks(r[3] || ''),
    pipeline: stripTicks(r[4] || ''),
    contract: (r[5] || '').split(/[、,]/).map((x) => stripTicks(x.trim())).filter((x) => x && !/^[-—–]$/.test(x) && !hasPlaceholder(x)),
    line: sec.start + offset + t.rowLines[i] + 2,
    placeholder: hasPlaceholder(r[0]) || hasPlaceholder(r[4]),
  })).filter((r) => !r.placeholder);
}

// 號段行:「a@x.com = 000-099;b@x.com = 100-199」,以 git 的 user.email 為鍵。佔位符或「無」是沒有號段;讀不懂的段落進 errors,由 lint ids 報。
export function parseRanges(raw) {
  const text = (raw || '').trim();
  const out = { ranges: [], errors: [] };
  if (!text || text === '無' || hasPlaceholder(text)) return out;
  for (const part of text.split(/[;;]/).map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\S+@\S+)\s*=\s*(\d{3})\s*[-–~]\s*(\d{3})$/.exec(part);
    if (!m || Number(m[2]) > Number(m[3])) {
      out.errors.push(part);
      continue;
    }
    out.ranges.push({ email: m[1], lo: Number(m[2]), hi: Number(m[3]), text: `${m[2]}-${m[3]}` });
  }
  return out;
}

// 專案約束的清單項:指令、模組前綴、原始碼根目錄、追加清單、忽略目錄、號段、優先各級代表什麼。其餘的列是給人看的硬性要求,不機械讀。
function parseConstraints(lines, start) {
  const ioExtra = [];
  const effectExtra = [];
  const ignoreDirs = [];
  const commands = {};
  let modulePrefix = '';
  let srcRoot = '';
  let priorityNote = '';
  let ranges = { ranges: [], errors: [], line: 0 };
  const one = (v) => (!v || v === '無' || /^<[^>]*>$/.test(v) ? '' : v);
  for (const it of parseList(lines)) {
    const m = /^(建置|測試\(整套\)|測試\(子集\)|IO 模組追加|效果型別追加|忽略目錄|模組前綴|原始碼根目錄|優先|號段)[::]\s*(.*)$/.exec(it.text);
    if (!m) continue;
    const list = () => m[2].split(/[、,]/).map((s) => stripTicks(s.trim()).replace(/\/$/, '')).filter((v) => v && v !== '無');
    if (m[1] === 'IO 模組追加') ioExtra.push(...list());
    else if (m[1] === '效果型別追加') effectExtra.push(...list());
    else if (m[1] === '忽略目錄') ignoreDirs.push(...list());
    else if (m[1] === '模組前綴') modulePrefix = one(codeSpan(m[2]));
    else if (m[1] === '原始碼根目錄') srcRoot = one(codeSpan(m[2])).replace(/[/]$/, '');
    else if (m[1] === '優先') priorityNote = m[2].trim();
    else if (m[1] === '號段') ranges = { ...parseRanges(m[2]), line: start + lines.findIndex((l) => /^- 號段/.test(l)) + 2 };
    else commands[m[1]] = codeSpan(m[2]);
  }
  // 一行「優先:1 = …;2 = …;3 = …;4 = …」宣告優先各級在這個專案代表什麼
  // 號段:多人平行 claim 時每人一段;沒有這一行就是空陣列,claim 從全部 pipeline 的最大號往上配
  return { ioExtra, effectExtra, ignoreDirs, commands, modulePrefix, srcRoot: srcRoot || 'src-<層>', priorityNote, priorityNoteState: !priorityNote ? 'missing' : hasPlaceholder(priorityNote) ? 'template' : 'ok', ranges: ranges.ranges, rangesErrors: ranges.errors, rangesLine: ranges.line };
}

// Cone.md:frontmatter(language、updated)與三節:願景、全域 Law、專案約束。
export function readCone(lawfulDir, root) {
  const file = path.join(lawfulDir, 'Cone.md');
  const text = read(file);
  if (text == null) return null;
  const { fm, body } = parseFrontmatter(text);
  const secs = sections(body);
  // 節的 start 是 body 內的行號;加回 frontmatter 佔的行數,訊息才指到檔案的真實行
  const offset = (text.slice(0, text.length - body.length).match(/\n/g) || []).length;
  for (const s of secs) s.start += offset;
  const constraintsSec = findSection(secs, '專案約束');
  const constraints = parseConstraints(constraintsSec ? constraintsSec.lines : [], constraintsSec ? constraintsSec.start : 0);
  // 願景:第一段是報告第一行印的那句;整節留給看板與 --json
  const visionSec = findSection(secs, '願景');
  const paragraphs = visionSec ? visionSec.lines.join('\n').split(/\n\s*\n/).map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean).join(' ')).filter(Boolean) : [];
  const visionFull = paragraphs.join(' ');
  const vision = paragraphs[0] || '';
  const visionState = !visionSec ? 'missing' : !visionFull || hasPlaceholder(visionFull) ? 'template' : 'ok';
  // 需求住 requirements/ 一條一個檔(readRequirements)。這裡讀的是「## 需求」節的 ### R-n:<一句話>:
  // 沒有 requirements/ 的樹靠它與 objectives/ 併成同一個形狀(mergeRequirements),migrate requirements 也從它寫檔。
  const reqSec = findSection(secs, '需求');
  const requirements = [];
  if (reqSec) {
    const from = secs.indexOf(reqSec);
    for (let i = from + 1; i < secs.length && secs[i].level > 2; i++) {
      const s = secs[i];
      const m = /^(R-\d+)\s*[::]\s*(.*)$/.exec(s.title);
      if (!m) continue;
      const items = parseList(s.lines);
      requirements.push({
        id: m[1],
        title: m[2].trim(),
        accept: parseAcceptItem(items),
        // 蘊含說明不是需求的一部分;留著的樹由 status 指到 migrate laws
        implied: items.some((it) => /^蘊含[::]/.test(it.text)),
        line: s.start + 1,
        placeholder: hasPlaceholder(m[2]),
      });
    }
  }

  // 全域 Law 的三區住「## 全域 Law」底下的 ###:領域不變量、架構:四層、契約:對外 I/O
  const globalSec = findSection(secs, '全域 Law');
  const globalPart = (h3) => {
    if (!globalSec) return null;
    for (let i = secs.indexOf(globalSec) + 1; i < secs.length && secs[i].level > 2; i++) if (secs[i].level === 3 && secs[i].title === h3) return secs[i];
    return null;
  };
  // 領域不變量:每條 `- INV-n [種類] 一句話`,子項可以是三行式;整個專案都不准違反,
  // 三行的識別字只准是 types 層的匯出與型別名(lint invariants 對帳),測試歸屬 INV-n#LAW。
  const invSec = globalPart('領域不變量');
  const invariants = [];
  if (invSec) for (const it of parseList(invSec.lines)) {
    const head = /^(INV-\d+)\s*(?:\[([^\]]*)\])?\s*(.*)$/.exec(it.text);
    if (!head) continue;
    const at = invSec.lines.findIndex((l) => l.startsWith(`- ${head[1]} `) || l.trim() === `- ${head[1]}`);
    const placeholder = hasPlaceholder(head[3]) || hasPlaceholder(head[2] || '');
    invariants.push({ id: head[1], kind: (head[2] || '').trim(), title: head[3].trim(), law: threeLines(head[3].trim(), it.children, placeholder), line: invSec.start + (at < 0 ? 0 : at) + 2, placeholder });
  }
  // 架構:四層各一句(給人看;機械查的是原始碼樹與模組單元表)
  const layerSec = globalPart('架構:四層');
  // 契約:對外 I/O
  const ioSec = globalPart('契約:對外 I/O');
  return {
    invariants: invariants.filter((v) => !v.placeholder),
    invariantsState: !invSec ? 'missing' : 'ok',
    globalState: globalSec ? 'ok' : 'missing',
    layerState: layerSec ? 'ok' : 'missing',
    io: ioRows(ioSec),
    ioState: ioSec ? 'ok' : 'missing',
    ioFile: rel(root, file),
    file: rel(root, file),
    fm,
    language: fm.language || null,
    vision,
    visionFull,
    visionState,
    sectionRequirements: requirements,
    hasRequirementSection: !!reqSec,
    ...constraints,
    sections: secs,
  };
}

// 里程碑表(里程碑 | 做到什麼 | 綁定)與調整表(調整 | 做到什麼 | 動到),兩張表以表頭第一格分。
// 綁定欄是 pipeline 全名,「、」分隔;綁定是里程碑對到 pipeline 的唯一寫法,完成度從綁定的 pipeline 推。里程碑表的列序就是先後。
function routeTables(lines, offset) {
  const names = (cell) => (cell || '').split(/[、,]/).map((x) => stripTicks(x.trim())).filter((x) => x && !/^[-—–]$/.test(x) && !hasPlaceholder(x));
  const milestones = [];
  const refinements = [];
  for (const t of parseTables(lines)) {
    const kind = (t.header[0] || '').trim();
    t.rows.forEach((r, i) => {
      const cell = stripTicks((r[0] || '').trim());
      if (!cell || hasPlaceholder(cell)) return;
      // 里程碑的第一格是全名 M-n-<slug>:M-n 是編號(全資料夾唯一,引用用它),slug 是切片分支 build/M-n-<slug> 的鍵
      const mm = kind === '里程碑' ? /^(M-\d+)(?:-([a-z0-9]+(?:-[a-z0-9]+)*))?$/.exec(cell) : null;
      const id = mm ? mm[1] : cell;
      const rowTitle = (r[1] || '').trim();
      const row = { id, title: rowTitle, line: offset + t.rowLines[i] + 1, placeholder: hasPlaceholder(rowTitle) };
      if (kind === '里程碑') milestones.push({ ...row, slug: mm && mm[2] ? mm[2] : '', fullName: cell, binds: names(r[2]) });
      else if (kind === '調整') refinements.push({ ...row, touches: names(r[2]) });
    });
  }
  return { milestones, refinements };
}

const priorityOf = (fm) => {
  const raw = fm.priority == null ? '' : String(fm.priority).trim();
  return { priority: /^[1-4]$/.test(raw) ? Number(raw) : null, priorityRaw: hasPlaceholder(raw) ? '' : raw };
};

// 需求:requirements/ 一條一個檔,檔名 R-n-<slug>.md;frontmatter id、priority、updated;標題 # <全名>:<一句話>;
// 驗收是清單項;里程碑表與調整表在後面。需求是必須達成的事:里程碑依序走完,建置就走完。
export function readRequirements(lawfulDir, root) {
  const dir = path.join(lawfulDir, 'requirements');
  if (!fs.existsSync(dir)) return { dir: rel(root, dir), exists: false, requirements: [] };
  const num = (f) => Number((/^R-(\d+)/.exec(f) || [0, 0])[1]);
  const files = fs.readdirSync(dir).filter((f) => /^R-\d+-.+\.md$/.test(f)).sort((a, b) => num(a) - num(b) || a.localeCompare(b));
  const requirements = files.map((f) => {
    const file = path.join(dir, f);
    const text = read(file);
    const { fm, body, hasFrontmatter } = parseFrontmatter(text);
    const offset = (text.slice(0, text.length - body.length).match(/\n/g) || []).length;
    const lines = body.split(/\r?\n/);
    const base = path.basename(f, '.md');
    const m = /^(R-\d+)-(.+)$/.exec(base);
    const heading = lines.find((l) => /^# /.test(l)) || '';
    const tm = /^#\s+\S+\s*[::]\s*(.*)$/.exec(heading);
    const title = (tm ? tm[1] : heading.replace(/^#\s*/, '')).trim();
    return {
      file: rel(root, file),
      abs: file,
      fullName: base,
      slug: m[2],
      fileId: m[1],
      fm,
      hasFrontmatter,
      id: typeof fm.id === 'string' && !hasPlaceholder(fm.id) ? fm.id.trim() : m[1],
      title,
      accept: parseAcceptItem(parseList(lines)),
      ...priorityOf(fm),
      ...routeTables(lines, offset),
      line: 1,
      placeholder: hasPlaceholder(title) || !title,
    };
  });
  return { dir: rel(root, dir), exists: true, requirements };
}

// objectives/ 底下 R-x-O-y-<slug>.md 的讀法;只給 mergeRequirements 用。
export function readObjectives(lawfulDir, root) {
  const dir = path.join(lawfulDir, 'objectives');
  if (!fs.existsSync(dir)) return [];
  const num = (f) => Number((/-O-(\d+)-/.exec(f) || [0, 0])[1]);
  const files = fs.readdirSync(dir).filter((f) => /^R-\d+-O-\d+-.+\.md$/.test(f)).sort((a, b) => num(a) - num(b) || a.localeCompare(b));
  return files.map((f) => {
    const file = path.join(dir, f);
    const text = read(file);
    const { fm, body } = parseFrontmatter(text);
    const offset = (text.slice(0, text.length - body.length).match(/\n/g) || []).length;
    const lines = body.split(/\r?\n/);
    const base = path.basename(f, '.md');
    const m = /^(R-\d+)-(O-\d+)-(.+)$/.exec(base);
    const heading = lines.find((l) => /^# /.test(l)) || '';
    const tm = /^#\s+\S+\s*[::]\s*(.*)$/.exec(heading);
    const requirement = typeof fm.requirement === 'string' && !hasPlaceholder(fm.requirement) ? fm.requirement.trim() : m[1];
    // lawItem:檔裡寫著「- Law:」;status 指到 migrate laws
    return { file: rel(root, file), abs: file, fullName: base, slug: m[3], id: m[2], title: (tm ? tm[1] : '').trim(), requirement, lawItem: parseList(lines).some((it) => /^Law[::]/.test(it.text)), ...priorityOf(fm), ...routeTables(lines, offset) };
  });
}

// 「## 需求」節的每條 R-n 加上朝向它的每個目標檔,併成與 readRequirements 同一個形狀:
// slug 取第一個目標的,優先取最高的,里程碑與調整依(優先、目標號)串接。sources 是併進來的目標檔;orphans 是對不到需求的目標檔。
export function mergeRequirements(sectionRequirements, objectives, dir) {
  const byPriority = (a, b) => (a.priority || 5) - (b.priority || 5) || Number(a.id.slice(2)) - Number(b.id.slice(2));
  const ids = new Set(sectionRequirements.map((q) => q.id));
  const requirements = sectionRequirements.map((q) => {
    const os = objectives.filter((o) => o.requirement === q.id).sort(byPriority);
    const slug = os.length ? os[0].slug : 'unnamed';
    const top = os.find((o) => o.priority);
    return {
      file: q.file,
      abs: null,
      fullName: `${q.id}-${slug}`,
      slug,
      fileId: q.id,
      fm: {},
      hasFrontmatter: true,
      id: q.id,
      title: q.title,
      accept: q.accept,
      implied: !!q.implied,
      priority: top ? top.priority : null,
      priorityRaw: top ? String(top.priority) : '',
      milestones: os.flatMap((o) => o.milestones),
      refinements: os.flatMap((o) => o.refinements),
      line: q.line,
      placeholder: q.placeholder,
      sources: os,
    };
  });
  return { dir, exists: false, merged: true, requirements, orphans: objectives.filter((o) => !ids.has(o.requirement)) };
}

// 模組表:「模組單元」一列一個單元 [{ unit, layers, responsibility, line }]。
// 沒有「模組單元」節時,檔裡第一張表就是模組單元表。
export function readModules(lawfulDir, root) {
  const file = path.join(lawfulDir, 'modules.md');
  const text = read(file);
  if (text == null) return null;
  const { body } = parseFrontmatter(text);
  const secs = sections(body);
  const offset = (text.slice(0, text.length - body.length).match(/\n/g) || []).length;
  const unitSec = findSection(secs, '模組單元');
  const lines = body.split(/\r?\n/);
  const t = unitSec ? parseTable(unitSec.lines) : parseTable(lines);
  const base = unitSec ? unitSec.start + offset + 1 : offset;
  const entries = [];
  if (t) {
    t.rows.forEach((r, i) => {
      const unit = stripTicks((r[0] || '').trim());
      if (!unit) return;
      const layers = (r[1] || '').split(/[、,]/).map((s) => stripTicks(s.trim())).filter(Boolean);
      const responsibility = (r[2] || '').trim();
      entries.push({ unit, layers, responsibility, line: base + t.rowLines[i] + 1, placeholder: isPlaceholder(unit) || hasPlaceholder(responsibility) });
    });
  }
  // 「邊界」與「對外 I/O」住 Cone.md 的「全域 Law」區;寫在這一檔的靜默當同一區讀(readDesign 在 Cone.md 沒有對應小區時接上)
  const ioSec = findSection(secs, '對外 I/O');
  return { file: rel(root, file), entries, io: ioRows(ioSec, offset), ioState: ioSec ? 'ok' : 'missing', layerState: findSection(secs, '邊界') ? 'ok' : 'missing', sections: secs };
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
  const kindRaw = typeof fm.kind === 'string' ? fm.kind.trim() : '';
  const kind = kindOf(kindRaw);
  return {
    file: rel(root, file),
    fullName: base,
    id: fm.id || (idM ? idM[1] : null),
    slug: idM ? idM[2] : null,
    fm,
    hasFrontmatter,
    // verified = 每條 law 都有一條會失敗、現在通過的測試守著;frozen 靜默當同一個字讀
    status: fm.status === 'frozen' ? 'verified' : fm.status || null,
    // kind:io 或 subflow;還是 <…> 佔位符算模板,沒寫算缺
    kind: KINDS.includes(kind) ? kind : null,
    kindRaw,
    kindState: !kindRaw ? 'missing' : hasPlaceholder(kindRaw) ? 'template' : KINDS.includes(kind) ? 'ok' : 'invalid',
    description: fm.description || '',
    owner: typeof fm.owner === 'string' ? fm.owner.trim() : '',
    sections: secs,
    brief: findSection(secs, 'Brief'),
    stages: stages.filter((s) => !s.placeholder),
    laws: laws.filter((l) => !l.placeholder),
    examples: examples.filter((e) => !e.placeholder),
    template,
    decisions,
    // 要改 verified 的 pipeline 先「重開」:決定節記一條為什麼
    reopened: decisions ? decisions.lines.some((l) => /重開|解凍/.test(l)) : false,
    // 每條 REV 的第一行:依欄寫的來源(GAP、SPK / ADR、RF-n、開發者的話)都在這一行
    revs: revItems.map((it) => ({ ...it, cites: [...new Set((it.text.match(/RF-\d+/g) || []))] })),
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

// 決策紀錄:journal/<鍵>.md,一條 build 分支一份,只活在分支上。鍵是里程碑全名、pipeline 全名、R-n 或 INV-n。
export function readJournals(lawfulDir, root) {
  const dir = path.join(lawfulDir, 'journal');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.md$/.test(f)).sort().map((f) => {
    const file = path.join(dir, f);
    const { fm } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    return { file: rel(root, file), key: path.basename(f, '.md'), branch: typeof fm.branch === 'string' ? fm.branch.trim() : '', verdict: typeof fm.verdict === 'string' ? fm.verdict.trim() : '' };
  });
}

// 一檔一號的東西:pipeline、ADR、需求。只讀檔名與 frontmatter 的 owner,給 lint ids 抓同號與號段。
export function readNumbered(lawfulDir, root) {
  const out = [];
  const scan = (sub, re) => {
    const dir = path.join(lawfulDir, sub);
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir).sort()) {
      const m = re.exec(f);
      if (!m) continue;
      const { fm } = parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
      const id = m[1];
      out.push({ file: rel(root, path.join(dir, f)), id, prefix: id.replace(/-\d+$/, ''), num: Number(id.replace(/^.*-/, '')), owner: typeof fm.owner === 'string' ? fm.owner.trim() : '' });
    }
  };
  scan('pipelines', /^(P-\d{3})-.+\.md$/);
  scan('adr', /^(ADR-\d{3})-.+\.md$/);
  scan('requirements', /^(R-\d+)-.+\.md$/);
  return out;
}

export function readDesign(root) {
  const lawfulDir = path.join(root, '.lawful');
  if (!fs.existsSync(lawfulDir)) return null;
  const pipelinesDir = path.join(lawfulDir, 'pipelines');
  const files = fs.existsSync(pipelinesDir)
    ? fs.readdirSync(pipelinesDir).filter((f) => /^P-\d{3}-.+\.md$/.test(f)).sort()
    : [];
  const cone = readCone(lawfulDir, root);
  const modules = readModules(lawfulDir, root);
  // 對外 I/O 與四層的一句話住 Cone.md「全域 Law」區;那一區沒有對應的小區而 modules.md 有,就接上 modules.md 的
  const ioFrom = cone && cone.ioState === 'ok' ? cone : modules && modules.ioState === 'ok' ? modules : null;
  // 沒有 requirements/ 而 Cone.md 有「## 需求」節:與 objectives/ 併成同一個形狀照讀;status 指到 migrate requirements
  let requirements = readRequirements(lawfulDir, root);
  if (!requirements.exists && cone && cone.hasRequirementSection) {
    requirements = mergeRequirements(cone.sectionRequirements.map((q) => ({ ...q, file: cone.file })), readObjectives(lawfulDir, root), requirements.dir);
  }
  return {
    root,
    lawfulDir,
    pipelinesDir,
    cone,
    io: ioFrom ? ioFrom.io : [],
    ioState: ioFrom ? 'ok' : 'missing',
    ioFile: ioFrom === modules && modules ? modules.file : cone ? cone.file : '.lawful/Cone.md',
    // 全域 Law 區還沒收齊的樹:lawful migrate laws 換過來
    strayGlobal: !!(modules && (modules.ioState === 'ok' || modules.layerState === 'ok')),
    // 只有 system.md 體系的樹:lawful migrate cone 換過來
    legacySystem: fs.existsSync(path.join(lawfulDir, 'system.md')),
    // 里程碑還擠在一份 objectives.md 裡:lawful migrate requirements 讀它
    objectivesFile: fs.existsSync(path.join(lawfulDir, 'objectives.md')),
    requirements,
    modules,
    pipelines: files.map((f) => readPipeline(path.join(pipelinesDir, f), root)),
    gaps: readGaps(lawfulDir, root),
    journals: readJournals(lawfulDir, root),
    // spikes/ 不屬於這棵樹;還留著的由 migrate laws 列出來給人判
    straySpikes: fs.existsSync(path.join(lawfulDir, 'spikes')),
    numbered: readNumbered(lawfulDir, root),
  };
}
