// 讀 .design/ 成一棵樹:system(含願景)、objectives(目標與里程碑)、modules、features、abstracts、gaps、spikes。只讀不判;判在 commands/。
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, sections, findSection, parseTable, parseList, stripTicks } from './markdown.mjs';

// 指令欄只取第一個反引號區段;反引號外的文字是給人看的說明,不是指令的一部分。沒有反引號就整段當指令。
function codeSpan(s) {
  const m = /`([^`]+)`/.exec(s);
  return m ? m[1].trim() : s.trim();
}

// 模板的佔位符:整格是 <…>。claim 建出來還沒寫的列不算 step / law / example,另計成「還是模板」。
// 簽名欄不能用「含有 <」判定——泛型 Result<Money, Error> 是合法簽名。
const isPlaceholder = (s) => /^<[^>]*>?$/.test((s || '').trim());
// 名字、檔案路徑、層名裡永遠不會有角括號,所以這幾欄只要出現 <…> 就是還沒填。
export const hasPlaceholder = (s) => /<[^>]*>/.test(s || '');

export const LAW_KINDS = ['invariant', 'identity', 'roundtrip', 'relation', 'bound', 'equiv', 'total', 'commute'];
export const STATUSES = ['draft', 'ready', 'frozen'];
export const TRUST = ['trusted', 'untrusted'];
export const KINDS = { feature: 'F', abstract: 'A' };

function read(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function rel(root, p) {
  return path.relative(root, p).split(path.sep).join('/');
}

// 正規化簽名文字 → { name, params: [type|null], ret: string|null, text }
// 文檔與程式碼兩側都走這一支,比對才是同一把尺。
export function parseSignature(raw) {
  const s = (raw || '').replace(/\s+/g, ' ').trim();
  const open = s.indexOf('(');
  if (open < 0) return { name: s, params: null, ret: null, text: s };
  const name = s.slice(0, open).trim();
  let depth = 0;
  let close = -1;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[' || c === '<' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '>' || c === '}') {
      depth--;
      if (depth === 0 && c === ')') {
        close = i;
        break;
      }
    }
  }
  if (close < 0) return { name, params: null, ret: null, text: s };
  const inner = s.slice(open + 1, close).trim();
  const params = [];
  if (inner) {
    let d = 0;
    let cur = '';
    for (const c of inner) {
      if (c === '(' || c === '[' || c === '<' || c === '{') d++;
      if (c === ')' || c === ']' || c === '>' || c === '}') d--;
      if (c === ',' && d === 0) {
        params.push(cur.trim());
        cur = '';
      } else cur += c;
    }
    params.push(cur.trim());
  }
  const after = s.slice(close + 1).trim();
  const ret = /^:/.test(after) ? after.slice(1).trim() : null;
  return {
    name,
    params: params.map((p) => (p === '' || p === '?' ? null : p)),
    ret: ret === '?' || ret === '' ? null : ret,
    text: s,
  };
}

export function renderSignature(sig) {
  const ps = (sig.params || []).map((p) => p || '?').join(', ');
  return `${sig.name}(${ps})${sig.ret ? `: ${sig.ret}` : ''}`;
}

// 兩側簽名比對:名字與參數個數一律比;型別只在程式碼那一側有註記時才比。
// 回 { ok, why, partial } —— partial 代表只對到名字與參數個數。
export function compareSignature(doc, code) {
  if (doc.name !== code.name) return { ok: false, why: `名字 ${doc.name} vs ${code.name}` };
  const dp = doc.params || [];
  const cp = code.params || [];
  if (dp.length !== cp.length) return { ok: false, why: `參數 ${dp.length} 個 vs ${cp.length} 個` };
  let partial = false;
  for (let i = 0; i < dp.length; i++) {
    if (cp[i] == null) {
      partial = true;
      continue;
    }
    if (dp[i] == null) return { ok: false, why: `第 ${i + 1} 個參數文檔沒寫型別,程式碼有 ${cp[i]}` };
    if (dp[i] !== cp[i]) return { ok: false, why: `第 ${i + 1} 個參數 ${dp[i]} vs ${cp[i]}` };
  }
  if (code.ret == null) partial = partial || doc.ret != null;
  else if (doc.ret !== code.ret) return { ok: false, why: `回傳 ${doc.ret || '(沒寫)'} vs ${code.ret}` };
  return { ok: true, partial };
}

export function readSystem(designDir, root) {
  const file = path.join(designDir, 'system.md');
  const text = read(file);
  if (text == null) return null;
  const { fm, body } = parseFrontmatter(text);
  const secs = sections(body);
  // 節的 start 是 body 內的行號;加回 frontmatter 佔的行數,訊息才指到檔案的真實行
  const offset = (text.slice(0, text.length - body.length).match(/\n/g) || []).length;
  for (const s of secs) s.start += offset;

  const tools = findSection(secs, '語言與工具');
  const commands = {};
  const ioExtra = [];
  const vocab = [];
  const ignoreDirs = [];
  if (tools) {
    for (const it of parseList(tools.lines)) {
      const m = /^(建置|測試\(整套\)|測試\(子集\)|IO 模組追加|Laws 詞彙追加|忽略目錄)[::]\s*(.*)$/.exec(it.text);
      if (!m) continue;
      const list = () => m[2].split(/[、,]/).map((s) => stripTicks(s.trim()).replace(/\/$/, '')).filter((v) => v && v !== '無');
      if (m[1] === 'IO 模組追加') ioExtra.push(...list());
      else if (m[1] === 'Laws 詞彙追加') vocab.push(...list());
      else if (m[1] === '忽略目錄') ignoreDirs.push(...list());
      else commands[m[1]] = codeSpan(m[2]);
    }
  }

  // 層:表的順序就是由內而外;最後一列是最外層(唯一能做對外 I/O 的層)
  const layerSec = findSection(secs, '層');
  const layers = [];
  if (layerSec) {
    const t = parseTable(layerSec.lines);
    if (t) t.rows.forEach((r, i) => {
      const name = stripTicks(r[0] || '');
      if (name && !hasPlaceholder(name)) layers.push({ name, what: (r[1] || '').trim(), line: layerSec.start + t.rowLines[i] + 2 });
    });
  }

  // 對外 I/O 表:名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證
  const ioSec = findSection(secs, '對外 I/O');
  const io = [];
  if (ioSec) {
    const t = parseTable(ioSec.lines);
    if (t) t.rows.forEach((r, i) => {
      const row = {
        name: (r[0] || '').trim(),
        direction: (r[1] || '').trim(),
        type: stripTicks(r[2] || ''),
        module: stripTicks(r[3] || ''),
        feature: stripTicks(r[4] || ''),
        trust: (r[5] || '').trim(),
        guard: stripTicks(r[6] || ''),
        line: ioSec.start + t.rowLines[i] + 2,
      };
      if (!hasPlaceholder(row.name) && !hasPlaceholder(row.feature)) io.push(row);
    });
  }

  const fl = findSection(secs, 'Features');
  const listed = [];
  if (fl) {
    const t = parseTable(fl.lines);
    if (t) for (const r of t.rows) {
      const fullName = stripTicks(r[0] || '');
      if (fullName && !hasPlaceholder(fullName)) listed.push({ fullName, kind: (r[1] || '').trim() });
    }
  }

  // 願景:整節的文字;沒有這一節是 missing,還留著 <…> 是 template
  const visionSec = findSection(secs, '願景');
  const vision = visionSec ? visionSec.lines.map((l) => l.trim()).filter(Boolean).join(' ') : '';
  const visionState = !visionSec ? 'missing' : !vision || hasPlaceholder(vision) ? 'template' : 'ok';

  return {
    file: rel(root, file),
    fm,
    language: fm.language || null,
    vision,
    visionState,
    commands,
    ioExtra,
    vocab,
    ignoreDirs,
    layers,
    outermost: layers.length ? layers[layers.length - 1].name : null,
    io,
    listed,
    sections: secs,
  };
}

// 目標:objectives.md 每個 ## O-n:<一句話> 一個目標;優先與判準是清單項,里程碑是節裡的表(里程碑 | 做到什麼 | 綁定)。
// 綁定欄是文檔全名,「、」分隔;綁定是里程碑對到文檔的唯一寫法,完成度從綁定的文檔推。
export function readObjectives(designDir, root) {
  const file = path.join(designDir, 'objectives.md');
  const text = read(file);
  if (text == null) return { file: rel(root, file), exists: false, objectives: [] };
  const { body } = parseFrontmatter(text);
  const secs = sections(body);
  const offset = (text.slice(0, text.length - body.length).match(/\n/g) || []).length;
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
      const binds = (r[2] || '').split(/[、,]/).map((x) => stripTicks(x.trim())).filter((x) => x && x !== '-' && !hasPlaceholder(x));
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
  return { file: rel(root, file), exists: true, objectives };
}

// 模組表:[{ pattern, layer, line }];pattern 是相對路徑,可用 ** 結尾通配。
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
        if (pattern && !hasPlaceholder(pattern) && !hasPlaceholder(layer)) entries.push({ pattern, layer, line: t.rowLines[i] + 1 });
      }
    });
  }
  return { file: rel(root, file), entries };
}

export function matchesPattern(pattern, filePath) {
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return filePath === prefix || filePath.startsWith(prefix + '/');
  }
  if (pattern.endsWith('**')) return filePath.startsWith(pattern.slice(0, -2));
  return pattern === filePath;
}

// 最長的樣式贏:src/domain/** 比 src/** 精確。
export function matchModule(entries, filePath) {
  let best = null;
  for (const e of entries) {
    if (!matchesPattern(e.pattern, filePath)) continue;
    if (!best || e.pattern.length > best.pattern.length) best = e;
  }
  return best;
}

function parseSteps(sec) {
  if (!sec) return [];
  const t = parseTable(sec.lines);
  if (!t) return [];
  return t.rows.map((r, i) => {
    const sigText = stripTicks(r[1] || '');
    const modCell = (r[3] || '').trim();
    const paren = /^(.*?)\s*[((](.*)[))]\s*$/.exec(modCell);
    const module = stripTicks(paren ? paren[1] : modCell);
    const note = paren ? paren[2] : '';
    const wish = /願望/.test(note);
    const refM = /((?:F|A)-\d{3}-[a-z0-9-]+)/.exec(note);
    const index = (r[0] || '').trim();
    const sig = parseSignature(sigText);
    return {
      index,
      whole: index === '=',
      observe: index === 'o',
      entry: index === '!',
      name: sig.name,
      sig,
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
  return t.rows.map((r, i) => ({
    id: (r[0] || '').trim(),
    input: stripTicks(r[1] || ''),
    output: stripTicks(r[2] || ''),
    covers: (r[3] || '').split(/[、,]/).map((s) => s.trim()).filter(Boolean),
    line: sec.start + t.rowLines[i] + 2,
    placeholder: isPlaceholder(stripTicks(r[1] || '')) || isPlaceholder(stripTicks(r[2] || '')),
  }));
}

export function readDoc(file, root) {
  const text = read(file);
  if (text == null) return null;
  const { fm, body, hasFrontmatter } = parseFrontmatter(text);
  const secs = sections(body);
  const offset = (text.slice(0, text.length - body.length).match(/\n/g) || []).length;
  for (const s of secs) s.start += offset;
  const base = path.basename(file, '.md');
  const idM = /^((F|A)-\d{3})-(.+)$/.exec(base);
  const decisions = findSection(secs, '決定');
  const revs = findSection(secs, '修訂記錄');
  const revItems = revs ? parseList(revs.lines).filter((i) => /^REV-\d+/.test(i.text)) : [];
  const steps = parseSteps(findSection(secs, 'Steps'));
  const laws = parseLaws(findSection(secs, 'Laws'));
  const examples = parseExamples(findSection(secs, 'Examples'));
  const template = {
    steps: steps.filter((s) => s.placeholder).length,
    laws: laws.filter((l) => l.placeholder).length,
    examples: examples.filter((e) => e.placeholder).length,
  };
  return {
    file: rel(root, file),
    abs: file,
    fullName: base,
    id: fm.id || (idM ? idM[1] : null),
    kind: idM ? (idM[2] === 'F' ? 'feature' : 'abstract') : null,
    slug: idM ? idM[3] : null,
    fm,
    hasFrontmatter,
    status: fm.status || null,
    description: fm.description || '',
    sections: secs,
    brief: findSection(secs, 'Brief'),
    steps: steps.filter((s) => !s.placeholder),
    laws: laws.filter((l) => l.id && !l.placeholder),
    badLaws: laws.filter((l) => !l.id),
    examples: examples.filter((e) => !e.placeholder),
    template,
    decisions,
    thawed: decisions ? decisions.lines.some((l) => /解凍/.test(l)) : false,
    revs: revItems,
    lastRev: revItems.length ? revItems[revItems.length - 1].text : null,
  };
}

export function readGaps(designDir, root) {
  const file = path.join(designDir, 'gaps.md');
  const text = read(file);
  if (text == null) return { file: rel(root, file), exists: false, gaps: [] };
  const secs = sections(parseFrontmatter(text).body);
  const gaps = [];
  for (const s of secs) {
    const m = /^(GAP-\d+)\s*[((]\s*(.*?)\s*\/\s*(\S+)\s*[))]/.exec(s.title);
    if (!m) continue;
    const status = (parseList(s.lines).find((i) => /^狀態[::]/.test(i.text)) || { text: '' }).text.replace(/^狀態[::]\s*/, '');
    gaps.push({ id: m[1], target: m[2], role: m[3], status, line: s.start + 1 });
  }
  return { file: rel(root, file), exists: true, gaps };
}

export function readSpikes(designDir, root) {
  const dir = path.join(designDir, 'spikes');
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

function readDir(dir, re, root) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => re.test(f)).sort().map((f) => readDoc(path.join(dir, f), root));
}

export function readDesign(root) {
  const designDir = path.join(root, '.design');
  if (!fs.existsSync(designDir)) return null;
  const featuresDir = path.join(designDir, 'features');
  const abstractsDir = path.join(designDir, 'abstracts');
  const features = readDir(featuresDir, /^F-\d{3}-.+\.md$/, root);
  const abstracts = readDir(abstractsDir, /^A-\d{3}-.+\.md$/, root);
  return {
    root,
    designDir,
    featuresDir,
    abstractsDir,
    system: readSystem(designDir, root),
    objectives: readObjectives(designDir, root),
    modules: readModules(designDir, root),
    features,
    abstracts,
    docs: [...features, ...abstracts],
    gaps: readGaps(designDir, root),
    spikes: readSpikes(designDir, root),
  };
}
