// 讀 .design/ 成一棵樹：system（願景、全域 Law 三區——領域不變量、架構的層、契約的對外 I/O——、Constraint、Features）、requirements（需求：驗收、優先、里程碑）、modules、features、abstracts、gaps、journals。只讀不判；判在 commands/。
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, sections, findSection, sameTitle, parseTable, parseTables, parseList, stripTicks } from './markdown.mjs';

// 指令欄只取第一個反引號區段；反引號外的文字是給人看的說明，不是指令的一部分。沒有反引號就整段當指令。
function codeSpan(s) {
  const m = /`([^`]+)`/.exec(s);
  return m ? m[1].trim() : s.trim();
}

// 一道指令：單一 `指令` → 字串；多語言專案每側一段「<目錄> = `指令`」以；分隔 → { 目錄：指令 }
function sidedCommand(s) {
  const parts = s.split(/[;；]/).map((p) => p.trim()).filter(Boolean);
  const sided = parts.map((p) => /^([^=`]+?)\s*=\s*`([^`]+)`/.exec(p)).filter(Boolean);
  if (parts.length && sided.length === parts.length) return Object.fromEntries(sided.map((m) => [m[1].trim().replace(/\/$/, ''), m[2].trim()]));
  return codeSpan(s);
}

// 模板的佔位符：整格是 <…>。claim 建出來還沒寫的列不算 step / law / example，另計成「還是模板」。
// 簽名欄不能用「含有 <」判定——泛型 Result<Money, Error> 是合法簽名。
const isPlaceholder = (s) => /^<[^>]*>?$/.test((s || '').trim());
// 名字、檔案路徑、層名裡永遠不會有角括號，所以這幾欄只要出現 <…> 就是還沒填。
export const hasPlaceholder = (s) => /<[^>]*>/.test(s || '');

export const LAW_KINDS = ['invariant', 'identity', 'roundtrip', 'relation', 'bound', 'equiv', 'total', 'commute'];
export const STATUSES = ['draft', 'ready', 'verified'];
export const TRUST = ['trusted', 'untrusted'];
export const KINDS = { feature: 'F', abstract: 'A' };
// 需求優先各級的意思，每個專案都一樣（features.md「願景、需求與里程碑」）
export const PRIORITY_TIERS = { 1: '地基', 2: '核心', 3: '錦上添花', 4: '開發工具' };
export const PRIORITY_LINE = Object.entries(PRIORITY_TIERS).map(([k, v]) => `${k} = ${v}`).join('；');

function read(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

// 需求的「驗收」：清單項 `- 驗收:<一句可判定的話>`，子項可以是三行式 (forall / given / |-)。需求是必須達成的事，不是 law。
// 沒有這一項回 null；有一句話但沒有三行，由驗收測試或里程碑承接。`- Law:` 靜默當同一項讀。
function parseAcceptItem(items) {
  const it = items.find((i) => /^(驗收|Law)[:：]/.test(i.text));
  if (!it) return null;
  const title = it.text.replace(/^(驗收|Law)[:：]\s*/, '').trim();
  return {
    title,
    forall: it.children.find((c) => /^forall\b/.test(c)) || null,
    given: it.children.filter((c) => /^given\b/.test(c)),
    conclusion: it.children.find((c) => /^\|-/.test(c)) || null,
    formal: it.children.some((c) => /^(forall\b|\|-)/.test(c)),
    placeholder: hasPlaceholder(title),
  };
}

function rel(root, p) {
  return path.relative(root, p).split(path.sep).join('/');
}

// 正規化簽名文字 → { name, params: [type|null], ret: string|null, text }
// 文檔與程式碼兩側都走這一支，比對才是同一把尺。
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

// 兩側簽名比對：名字與參數個數一律比；型別只在程式碼那一側有註記時才比。
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
    if (dp[i] == null) return { ok: false, why: `第 ${i + 1} 個參數文檔沒寫型別，程式碼有 ${cp[i]}` };
    if (dp[i] !== cp[i]) return { ok: false, why: `第 ${i + 1} 個參數 ${dp[i]} vs ${cp[i]}` };
  }
  if (code.ret == null) partial = partial || doc.ret != null;
  else if (doc.ret !== code.ret) return { ok: false, why: `回傳 ${doc.ret || '（沒寫）'} vs ${code.ret}` };
  return { ok: true, partial };
}

// 號段行：「a@x.com = 000-099；b@x.com = 100-199」，以 git 的 user.email 為鍵。佔位符或「無」是沒有號段；讀不懂的段落進 errors，由 lint ids 報。
export function parseRanges(raw) {
  const text = (raw || '').trim();
  const out = { ranges: [], errors: [] };
  if (!text || text === '無' || hasPlaceholder(text)) return out;
  for (const part of text.split(/[;；]/).map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\S+@\S+)\s*=\s*(\d{3})\s*[-–~]\s*(\d{3})$/.exec(part);
    if (!m || Number(m[2]) > Number(m[3])) {
      out.errors.push(part);
      continue;
    }
    out.ranges.push({ email: m[1], lo: Number(m[2]), hi: Number(m[3]), text: `${m[2]}-${m[3]}` });
  }
  return out;
}

export function readSystem(designDir, root) {
  const file = path.join(designDir, 'system.md');
  const text = read(file);
  if (text == null) return null;
  const { fm, body } = parseFrontmatter(text);
  const secs = sections(body);
  // 節的 start 是 body 內的行號；加回 frontmatter 佔的行數，訊息才指到檔案的真實行
  const offset = (text.slice(0, text.length - body.length).match(/\n/g) || []).length;
  for (const s of secs) s.start += offset;

  // 硬性限制與工具要讀的那幾行住「## Constraint」；節名寫成「語言與工具」的樹靜默照讀
  const tools = findSection(secs, 'Constraint') || findSection(secs, '語言與工具');
  const commands = {};
  const ioExtra = [];
  const vocab = [];
  const ignoreDirs = [];
  let releaseTags = '';
  let ranges = { ranges: [], errors: [], line: 0 };
  if (tools) {
    for (const it of parseList(tools.lines)) {
      const m = /^(建置|測試[(（]整套[)）]|測試[(（]子集[)）]|IO 模組追加|Laws 詞彙追加|忽略目錄|號段|發布)[:：]\s*(.*)$/.exec(it.text);
      if (!m) continue;
      m[1] = m[1].replace('（', '(').replace('）', ')');   // 寫成全形括號也照讀；commands 的鍵一律是半形的 `測試(整套)`
      const list = () => m[2].split(/[、,，]/).map((s) => stripTicks(s.trim()).replace(/\/$/, '')).filter((v) => v && v !== '無');
      if (m[1] === 'IO 模組追加') ioExtra.push(...list());
      else if (m[1] === 'Laws 詞彙追加') vocab.push(...list());
      else if (m[1] === '忽略目錄') ignoreDirs.push(...list());
      // 一行「發布：`v*`」：哪些 git tag 算一次發布（git tag --list 的樣式）；沒寫、「無」或佔位符 = 每個 tag 都算
      else if (m[1] === '發布') { const v = stripTicks(m[2].trim()); releaseTags = !v || v === '無' || hasPlaceholder(v) ? '' : v; }
      else if (m[1] === '號段') ranges = { ...parseRanges(m[2]), line: tools.start + tools.lines.findIndex((l) => /^- 號段/.test(l)) + 2 };
      else commands[m[1]] = sidedCommand(m[2]);
    }
  }

  // 全域 Law 的三區住「## 全域 Law」底下的 ###：領域不變量、架構：層、契約：對外 I/O；同名的 ## 節靜默當同一區讀。
  const globalSec = findSection(secs, '全域 Law');
  const globalPart = (h3, h2) => {
    if (globalSec) {
      for (let i = secs.indexOf(globalSec) + 1; i < secs.length && secs[i].level > 2; i++) if (secs[i].level === 3 && sameTitle(secs[i].title, h3)) return secs[i];
    }
    return findSection(secs, h2);
  };

  // 架構：層。表的順序就是由內而外；最後一列是最外層（唯一能做對外 I/O 的層）
  const layerSec = globalPart('架構：層', '層');
  const layers = [];
  if (layerSec) {
    const t = parseTable(layerSec.lines);
    if (t) t.rows.forEach((r, i) => {
      const name = stripTicks(r[0] || '');
      if (name && !hasPlaceholder(name)) layers.push({ name, what: (r[1] || '').trim(), line: layerSec.start + t.rowLines[i] + 2 });
    });
  }

  // 對外 I/O 表：名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 | 契約
  const ioSec = globalPart('契約：對外 I/O', '對外 I/O');
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
        // 契約：守這一端的 law，寫 F-00x#LAW-n 或 INV-n，「、」分隔；沒有就「-」
        contract: (r[7] || '').split(/[、,，]/).map((x) => stripTicks(x.trim())).filter((x) => x && !/^[-—–]$/.test(x) && !hasPlaceholder(x)),
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

  // 願景：第一段是報告第一行印的那句；整節留給看板與 --json。沒有這一節是 missing，還留著 <…> 是 template
  const visionSec = findSection(secs, '願景');
  const paragraphs = visionSec ? visionSec.lines.join('\n').split(/\n\s*\n/).map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean).join(' ')).filter(Boolean) : [];
  const visionFull = paragraphs.join(' ');
  const vision = paragraphs[0] || '';
  const visionState = !visionSec ? 'missing' : !visionFull || hasPlaceholder(visionFull) ? 'template' : 'ok';

  // 需求住 requirements/ 一條一個檔 (readRequirements)。這裡讀的是「## 需求」節的 ### R-n:<一句話>:
  // 沒有 requirements/ 的樹靠它與 objectives/ 併成同一個形狀 (mergeRequirements)，migrate requirements 也從它寫檔。
  const reqSec = findSection(secs, '需求');
  const requirements = [];
  if (reqSec) {
    const from = secs.indexOf(reqSec);
    for (let i = from + 1; i < secs.length && secs[i].level > 2; i++) {
      const s = secs[i];
      const m = /^(R-\d+)\s*[:：]\s*(.*)$/.exec(s.title);
      if (!m) continue;
      const items = parseList(s.lines);
      requirements.push({
        id: m[1],
        title: m[2].trim(),
        accept: parseAcceptItem(items),
        line: s.start + 1,
        placeholder: hasPlaceholder(m[2]),
      });
    }
  }

  // 領域不變量：「### 領域不變量」底下每條 `- INV-n [種類] 一句話`，子項可以是三行式；整個專案都不准違反，
  // 三行的識別字只准是最內層的匯出與型別名（lint laws 對帳），測試歸屬 INV-n#LAW。
  const invSec = globalPart('領域不變量', '領域不變量');
  const invariants = [];
  if (invSec) for (const it of parseList(invSec.lines)) {
    const head = /^(INV-\d+)\s*(?:\[([^\]]*)\])?\s*(.*)$/.exec(it.text);
    if (!head) continue;
    const at = invSec.lines.findIndex((l) => l.startsWith(`- ${head[1]} `) || l.trim() === `- ${head[1]}`);
    invariants.push({
      id: head[1],
      kind: (head[2] || '').trim(),
      title: head[3].trim(),
      law: {
        title: head[3].trim(),
        forall: it.children.find((c) => /^forall\b/.test(c)) || null,
        given: it.children.filter((c) => /^given\b/.test(c)),
        conclusion: it.children.find((c) => /^\|-/.test(c)) || null,
        formal: it.children.some((c) => /^(forall\b|\|-)/.test(c)),
        placeholder: hasPlaceholder(head[3]) || hasPlaceholder(head[2] || ''),
      },
      line: invSec.start + (at < 0 ? 0 : at) + 2,
      placeholder: hasPlaceholder(head[3]) || hasPlaceholder(head[2] || ''),
    });
  }

  return {
    file: rel(root, file),
    fm,
    language: fm.language || null,
    languages: parseLanguages(fm.language),
    vision,
    visionFull,
    visionState,
    sectionRequirements: requirements,
    hasRequirementSection: !!reqSec,
    invariants: invariants.filter((v) => !v.placeholder),
    invariantsState: !invSec ? 'missing' : 'ok',
    globalState: globalSec ? 'ok' : 'missing',
    commands,
    releaseTags,
    ioExtra,
    vocab,
    ignoreDirs,
    // 號段：多人平行 claim 時每人一段；沒有這一行就是空陣列，claim 從全部文檔的最大號往上配
    ranges: ranges.ranges,
    rangesErrors: ranges.errors,
    rangesLine: ranges.line,
    layers,
    // 層表沒有列是正常的：層是從第一條切片抽上去的；沒有這一小區才是 missing
    layersState: !layerSec ? 'missing' : 'ok',
    outermost: layers.length ? layers[layers.length - 1].name : null,
    io,
    listed,
    sections: secs,
  };
}

// 里程碑表（里程碑 | 做到什麼 | 綁定 | 怎麼驗）：需求檔的里程碑表。
// 綁定欄是 feature 全名，「、」分隔；綁定是里程碑對到文檔的唯一寫法，完成度從綁定的文檔推。里程碑表的列序就是先後。
// 怎麼驗欄是一道跑起來看得到這條里程碑那一句話的指令；人工審核時 status 把它印成步驟。沒有這一欄或寫「-」都是還沒有。
// 表頭第一格是「調整」的表（調整 | 做到什麼 | 動到）靜默照讀：每一列讀成一條里程碑，接在里程碑表之後——
// 編號與全名都是 RF-n、沒有英文名、綁定 = 「動到」欄、fromRefinement 為真（做到什麼還是模板佔位符的列不算）；hasRefinementTable 講這個檔有那張表（migrate requirements 換掉它）。
function routeTables(lines, offset) {
  const names = (cell) => (cell || '').split(/[、,，]/).map((x) => stripTicks(x.trim())).filter((x) => x && !/^[-—–]$/.test(x) && !hasPlaceholder(x));
  const one = (cell) => {
    const v = (cell || '').trim();
    return !v || /^[-—–]$/.test(v) || hasPlaceholder(v) ? '' : v;
  };
  const milestones = [];
  const fromRefinements = [];
  const signoffs = [];
  let hasRefinementTable = false;
  for (const t of parseTables(lines)) {
    const kind = (t.header[0] || '').trim();
    if (kind === '調整') hasRefinementTable = true;
    // 驗收記錄表（日期 | 誰 | 憑據 | 結論）：人工審核的結果，一次審核一列，只由 devflow requirement accept 寫
    if (kind === '日期') {
      t.rows.forEach((r, i) => {
        const date = one(r[0]);
        if (!date) return;
        signoffs.push({ date, by: one(r[1]), evidence: one(r[2]), verdict: one(r[3]), line: offset + t.rowLines[i] + 1 });
      });
      continue;
    }
    t.rows.forEach((r, i) => {
      const cell = stripTicks((r[0] || '').trim());
      if (!cell || hasPlaceholder(cell)) return;
      // 里程碑的第一格是全名 M-n-<slug>:M-n 是配號用的編號（全資料夾唯一），引用一條里程碑一律用全名；slug 是切片分支 build/M-n-<slug> 的鍵
      const mm = kind === '里程碑' ? /^(M-\d+)(?:-([a-z0-9]+(?:-[a-z0-9]+)*))?$/.exec(cell) : null;
      const id = mm ? mm[1] : cell;
      const rowTitle = (r[1] || '').trim();
      const row = { id, title: rowTitle, line: offset + t.rowLines[i] + 1, placeholder: hasPlaceholder(rowTitle) };
      if (kind === '里程碑') milestones.push({ ...row, slug: mm && mm[2] ? mm[2] : '', fullName: cell, binds: names(r[2]), verify: stripTicks(one(r[3])) });
      else if (kind === '調整' && !row.placeholder) fromRefinements.push({ ...row, slug: '', fullName: cell, binds: names(r[2]), verify: '', fromRefinement: true });
    });
  }
  return { milestones: [...milestones, ...fromRefinements], hasRefinementTable, signoffs };
}

const priorityOf = (fm) => {
  const raw = fm.priority == null ? '' : String(fm.priority).trim();
  return { priority: /^[1-4]$/.test(raw) ? Number(raw) : null, priorityRaw: hasPlaceholder(raw) ? '' : raw };
};

// 需求：requirements/ 一條一個檔，檔名 R-n-<slug>.md；frontmatter id、priority、updated；標題 # <全名>:<一句話>；
// 驗收是清單項；里程碑表在後面。需求是必須達成的事：里程碑依序走完，建置就走完。
export function readRequirements(designDir, root) {
  const dir = path.join(designDir, 'requirements');
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
    const tm = /^#\s+\S+\s*[:：]\s*(.*)$/.exec(heading);
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

// objectives/ 底下 R-x-O-y-<slug>.md 的讀法；只給 mergeRequirements 用。
export function readObjectives(designDir, root) {
  const dir = path.join(designDir, 'objectives');
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
    const tm = /^#\s+\S+\s*[:：]\s*(.*)$/.exec(heading);
    const requirement = typeof fm.requirement === 'string' && !hasPlaceholder(fm.requirement) ? fm.requirement.trim() : m[1];
    return { file: rel(root, file), abs: file, fullName: base, slug: m[3], id: m[2], title: (tm ? tm[1] : '').trim(), requirement, ...priorityOf(fm), ...routeTables(lines, offset) };
  });
}

// 「## 需求」節的每條 R-n 加上朝向它的每個目標檔，併成與 readRequirements 同一個形狀：
// slug 取第一個目標的，優先取最高的，里程碑依（優先、目標號）串接，從調整表讀來的那幾條同樣串接、排在最後。sources 是併進來的目標檔；orphans 是對不到需求的目標檔。
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
      priority: top ? top.priority : null,
      priorityRaw: top ? String(top.priority) : '',
      milestones: [...os.flatMap((o) => o.milestones.filter((m) => !m.fromRefinement)), ...os.flatMap((o) => o.milestones.filter((m) => m.fromRefinement))],
      hasRefinementTable: os.some((o) => o.hasRefinementTable),
      signoffs: [],
      line: q.line,
      placeholder: q.placeholder,
      sources: os,
    };
  });
  return { dir, exists: false, merged: true, requirements, orphans: objectives.filter((o) => !ids.has(o.requirement)) };
}

// 模組表：[{ pattern, layer, line }]；pattern 是相對路徑，可用 ** 結尾通配。
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
      for (const raw of (r[0] || '').split(/[、,，]/)) {
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

// 最長的樣式贏：src/domain/** 比 src/** 精確。
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
    const paren = /^(.*?)\s*[(（](.*)[)）]\s*$/.exec(modCell);
    const module = stripTicks(paren ? paren[1] : modCell);
    const note = paren ? paren[2] : '';
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
    covers: (r[3] || '').split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
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
    // verified：每條 law 都有會失敗、現在通過的測試守著；frozen 是同一格的另一種寫法，讀進來當 verified
    status: fm.status === 'frozen' ? 'verified' : fm.status || null,
    description: fm.description || '',
    owner: typeof fm.owner === 'string' ? fm.owner.trim() : '',
    sections: secs,
    brief: findSection(secs, 'Brief'),
    steps: steps.filter((s) => !s.placeholder),
    laws: laws.filter((l) => l.id && !l.placeholder),
    badLaws: laws.filter((l) => !l.id),
    examples: examples.filter((e) => !e.placeholder),
    template,
    decisions,
    thawed: decisions ? decisions.lines.some((l) => /重開|解凍/.test(l)) : false,
    // 每條 REV 的第一行：依欄寫的來源（GAP、ADR、里程碑全名、開發者的話）都在這一行。cites 收它引用的里程碑編號：
    // 全名 M-3-checkout-fast 取 M-3；RF-n 照同一套收
    revs: revItems.map((it) => ({ ...it, cites: [...new Set(it.text.match(/(?<![A-Za-z0-9])(?:M|RF)-\d+/g) || [])] })),
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
    const m = /^(GAP-\d+)\s*[(（]\s*(.*?)\s*\/\s*(\S+)\s*[)）]/.exec(s.title);
    if (!m) continue;
    const status = (parseList(s.lines).find((i) => /^狀態[:：]/.test(i.text)) || { text: '' }).text.replace(/^狀態[:：]\s*/, '');
    gaps.push({ id: m[1], target: m[2], role: m[3], status, line: s.start + 1 });
  }
  return { file: rel(root, file), exists: true, gaps };
}

// 決策紀錄：journal/<鍵>.md，一條 build 分支一份（鍵是里程碑全名 M-n-<slug>、文檔全名、或 R-n / O-n / INV-n）。
// 只活在 build 分支，整合寫進 PR 後刪；status 靠「有沒有這一份」判切片完成了沒。
export function readJournals(designDir, root) {
  const dir = path.join(designDir, 'journal');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /.md$/.test(f)).sort().map((f) => {
    const file = path.join(dir, f);
    const { fm } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    return { file: rel(root, file), key: path.basename(f, '.md'), branch: typeof fm.branch === 'string' ? fm.branch.trim() : '', verdict: typeof fm.verdict === 'string' ? fm.verdict.trim() : '' };
  });
}

// 名詞：專案根目錄 CLAUDE.md 的「## 名詞」節，一張表（名詞 | 定義 | 型別）；領域名詞只在那裡定義，.design/ 裡不另寫一次。
// 檔案不存在或沒有這一節是 missing；佔位符列不算；型別欄的「-」與佔位符讀成空字串。line 是 CLAUDE.md 裡的真實行號。
export function readGlossary(root) {
  const file = path.join(root, 'CLAUDE.md');
  const text = read(file);
  const out = { file: rel(root, file), state: 'missing', terms: [] };
  if (text == null) return out;
  const { body } = parseFrontmatter(text);
  const offset = (text.slice(0, text.length - body.length).match(/\n/g) || []).length;
  const sec = findSection(sections(body), '名詞');
  if (!sec) return out;
  out.state = 'ok';
  const t = parseTable(sec.lines);
  if (t) t.rows.forEach((r, i) => {
    const term = stripTicks(r[0] || '');
    if (!term || hasPlaceholder(term)) return;
    const type = stripTicks(r[2] || '');
    out.terms.push({ term, definition: (r[1] || '').trim(), type: /^[-—–]?$/.test(type) || isPlaceholder(type) ? '' : type, line: offset + sec.start + t.rowLines[i] + 2 });
  });
  return out;
}

// 一檔一號的東西：feature、abstract、ADR、需求。只讀檔名與 frontmatter 的 owner，給 lint ids 抓同號與號段。
export function readNumbered(designDir, root) {
  const out = [];
  const scan = (sub, re) => {
    const dir = path.join(designDir, sub);
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir).sort()) {
      const m = re.exec(f);
      if (!m) continue;
      const { fm } = parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
      const id = m[1];
      out.push({ file: rel(root, path.join(dir, f)), id, prefix: id.replace(/-\d+$/, ''), num: Number(id.replace(/^.*-/, '')), owner: typeof fm.owner === 'string' ? fm.owner.trim() : '' });
    }
  };
  scan('features', /^(F-\d{3})-.+\.md$/);
  scan('abstracts', /^(A-\d{3})-.+\.md$/);
  scan('adr', /^(ADR-\d{3})-.+\.md$/);
  scan('requirements', /^(R-\d+)-.+\.md$/);
  return out;
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
  const system = readSystem(designDir, root);
  const glossary = readGlossary(root);
  // 沒有 requirements/ 而 system.md 有「## 需求」節：與 objectives/ 併成同一個形狀照讀；status 指到 migrate requirements
  let requirements = readRequirements(designDir, root);
  if (!requirements.exists && system && system.hasRequirementSection) {
    requirements = mergeRequirements(system.sectionRequirements.map((q) => ({ ...q, file: system.file })), readObjectives(designDir, root), requirements.dir);
  }
  return {
    root,
    designDir,
    featuresDir,
    abstractsDir,
    system,
    // 名詞表住專案根目錄的 CLAUDE.md，不住 .design/
    glossary: glossary.terms,
    glossaryState: glossary.state,
    glossaryFile: glossary.file,
    requirements,
    // 里程碑還擠在一份 objectives.md 裡：devflow migrate requirements 讀它
    objectivesFile: fs.existsSync(path.join(designDir, 'objectives.md')),
    modules: readModules(designDir, root),
    features,
    abstracts,
    docs: [...features, ...abstracts],
    gaps: readGaps(designDir, root),
    journals: readJournals(designDir, root),
    numbered: readNumbered(designDir, root),
  };
}

// language 欄：單一語言 → [{ dir: '', name }]；清單「dir = adapter」→ 每個目錄一個 adapter。
export function parseLanguages(v) {
  if (!v) return [];
  const items = Array.isArray(v) ? v : String(v).split(',').map((x) => x.trim()).filter(Boolean);
  return items.map((it) => {
    const m = /^(?:(.+?)\s*=\s*)?([A-Za-z]+)$/.exec(String(it).trim());
    if (!m) return { dir: '', name: String(it).trim() };
    return { dir: (m[1] || '').replace(/\/$/, ''), name: m[2] };
  });
}
