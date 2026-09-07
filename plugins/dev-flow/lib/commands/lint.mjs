// lint boundary / sig / laws / trace / io / all。每道回 { title, red: [], info: [] }。
import { LAW_KINDS, TRUST, matchModule, matchesPattern, compareSignature, renderSignature, parseSignature } from '../design.mjs';
import { findSignature, findType, allTypeNames } from '../source.mjs';

function at(file, line) {
  return line ? `${file}:${line}` : file;
}

// 層由內而外;內層只准 import 自己與比自己更內的層。
function layerIndex(system, name) {
  if (!system) return -1;
  return system.layers.findIndex((l) => l.name === name);
}

export function lintBoundary(design, source, adapter) {
  const r = { title: 'lint boundary', red: [], info: [] };
  const sys = design.system;
  if (!sys || !sys.layers.length) {
    const has = sys && sys.sections.some((x) => x.level === 2 && x.title === '層');
    r.red.push(has ? 'system.md 的「層」表還是模板,依賴方向沒有宣告' : 'system.md 沒有「層」表,依賴方向沒有宣告');
    return r;
  }
  if (!design.modules || !design.modules.entries.length) {
    r.red.push(design.modules ? '.design/modules.md 還是模板,哪個檔在哪一層沒有宣告' : '缺 .design/modules.md,哪個檔在哪一層沒有宣告');
    return r;
  }
  const names = sys.layers.map((l) => l.name);
  for (const e of design.modules.entries) {
    if (!names.includes(e.layer)) r.red.push(`${at(design.modules.file, e.line)} ${e.pattern} 的層「${e.layer}」不在 system.md 的層表裡(${names.join(' / ')})`);
  }
  if (!source) return r;

  const ioPatterns = [...adapter.ioModules, ...sys.ioExtra];
  const paths = [...source.files.keys()];
  for (const e of design.modules.entries) {
    if (!paths.some((p) => matchesPattern(e.pattern, p))) r.red.push(`${at(design.modules.file, e.line)} 模組表有 ${e.pattern},程式碼裡沒有檔案對得到(幽靈)`);
  }
  for (const m of source.files.values()) {
    const entry = matchModule(design.modules.entries, m.file);
    if (!entry) {
      r.red.push(`${m.file} 不在模組表(未登記),它在哪一層沒有人知道`);
      continue;
    }
    const li = layerIndex(sys, entry.layer);
    for (let i = 0; i < m.imports.length; i++) {
      const imp = m.imports[i];
      const target = source.files.get(imp) ? imp : (source.dirs.has(imp) ? imp : null);
      if (target) {
        const te = matchModule(design.modules.entries, target);
        if (!te) continue;
        const ti = layerIndex(sys, te.layer);
        if (ti > li) r.red.push(`${m.file} ${entry.layer} 層 import 了更外面的 ${te.layer} 層:${target}`);
      } else if (entry.layer !== sys.outermost && ioPatterns.some((p) => imp === p || imp.startsWith(p + '/') || imp.startsWith(p + '.') || imp.startsWith(p + '::'))) {
        r.red.push(`${m.file} ${entry.layer} 層 import 了 IO 模組 ${m.rawImports[i]};對外 I/O 只准住最外層(${sys.outermost})`);
      }
    }
  }
  return r;
}

function kindOf(design, fullName) {
  const doc = design.docs.find((d) => d.fullName === fullName);
  return doc ? doc.kind : null;
}

export function lintSig(design, source, adapter) {
  const r = { title: 'lint sig', red: [], info: [] };
  const entries = design.modules ? design.modules.entries : [];
  const sys = design.system;
  const layerNames = sys ? sys.layers.map((l) => l.name) : [];
  const consumers = new Map(design.abstracts.map((a) => [a.fullName, new Set()]));
  for (const d of design.docs) for (const s of d.steps) if (s.ref && consumers.has(s.ref)) consumers.get(s.ref).add(d.fullName);

  for (const p of design.docs) {
    if (p.template.steps) r.red.push(`${p.file} Steps 表還是模板(${p.template.steps} 列佔位符);dev-flow:feature 寫成真的簽名`);
    if (!p.steps.length) {
      if (!p.template.steps) r.red.push(`${p.file} 沒有 Steps 表`);
      continue;
    }
    const wholes = p.steps.filter((s) => s.whole);
    if (wholes.length !== 1) r.red.push(`${p.file} = 列(整條)要恰好一列,現在 ${wholes.length} 列`);
    const entriesRows = p.steps.filter((s) => s.entry);
    if (p.kind === 'feature' && entriesRows.length !== 1) r.red.push(`${p.file} feature 要恰好一列 ! 列(對外進入點),現在 ${entriesRows.length} 列`);
    if (p.kind === 'abstract' && entriesRows.length) r.red.push(`${p.file} abstract 不碰對外邊界,不該有 ! 列`);

    for (const s of p.steps) {
      if (!s.name) {
        r.red.push(`${at(p.file, s.line)} 簽名欄不是 name(型別, 型別): 回傳型別:${s.sigText}`);
        continue;
      }
      if (layerNames.length && !layerNames.includes(s.layer)) r.red.push(`${at(p.file, s.line)} ${s.name} 的層「${s.layer}」不在 system.md 的層表裡`);
      if (sys && s.whole && s.layer === sys.outermost) r.red.push(`${at(p.file, s.line)} = 列 ${s.name} 在最外層;整條住內層,對外那一段另列成 ! 列`);
      if (sys && s.observe && s.layer === sys.outermost) r.red.push(`${at(p.file, s.line)} 觀察點 ${s.name} 在最外層;law 要看的量不該只有跨出邊界才看得到`);
      if (sys && s.entry && s.layer !== sys.outermost) r.red.push(`${at(p.file, s.line)} ! 列 ${s.name} 不在最外層(${sys.outermost});進入點是對外邊界那一段`);
      const entry = entries.length ? matchModule(entries, s.module) : null;
      if (entries.length && !entry) r.red.push(`${at(p.file, s.line)} ${s.name} 的模組 ${s.module} 不在模組表`);
      else if (entry && entry.layer !== s.layer) r.red.push(`${at(p.file, s.line)} ${s.name} 寫 ${s.layer} 層,模組表說 ${s.module} 是 ${entry.layer} 層`);
      if (s.ref && !design.docs.some((q) => q.fullName === s.ref)) r.red.push(`${at(p.file, s.line)} ${s.name} 引用的 ${s.ref} 不存在`);
      if (s.ref && kindOf(design, s.ref) === 'feature') r.red.push(`${at(p.file, s.line)} ${s.name} 引用了 feature ${s.ref};feature 之間不互相引用,共用的部分走 dev-flow:refactor 抽成 abstract`);
      if (!s.ref) {
        const owner = design.docs.find((q) => q !== p && q.steps.some((t) => t.name === s.name && t.whole));
        if (owner) r.red.push(`${at(p.file, s.line)} ${s.name} 是 ${owner.fullName} 的 = 列;引用別份的 step 要在模組欄註明「見 ${owner.fullName}」`);
        else for (const q of design.docs) if (q !== p && q.fullName > p.fullName && q.steps.some((t) => t.name === s.name && !t.ref)) r.red.push(`${at(p.file, s.line)} ${s.name} 也是 ${q.fullName} 的 step,兩邊都沒註明「見」;共用就走 dev-flow:refactor`);
      }
      if (!source) continue;
      const hits = findSignature(source, s.name);
      if (!hits.length) {
        if (s.wish) r.info.push(`${p.fullName}#${s.name} 願望,待實作(目標 ${s.module})`);
        else r.red.push(`${at(p.file, s.line)} ${p.fullName}#${s.name} 程式碼裡找不到`);
        continue;
      }
      const same = hits.find((h) => h.file === s.module) || hits[0];
      const cmp = compareSignature(s.sig, same);
      if (!cmp.ok) {
        r.red.push(`${at(p.file, s.line)} ${p.fullName}#${s.name} 簽名不一致(${cmp.why})\n    文檔:${renderSignature(s.sig)}\n    程式碼:${renderSignature(same)}(${at(same.file, same.line)})`);
      } else if (cmp.partial) {
        r.info.push(`${p.fullName}#${s.name} 程式碼沒有型別註記,只對到名字與參數個數(${at(same.file, same.line)})`);
      }
      if (!same.exported) r.red.push(`${at(same.file, same.line)} ${p.fullName}#${s.name} 程式碼裡有,但沒有對外匯出;step 與觀察點都要是匯出的簽名`);
      if (same.file !== s.module) {
        const codeEntry = entries.length ? matchModule(entries, same.file) : null;
        if (codeEntry && entry && codeEntry.layer !== entry.layer) r.red.push(`${at(p.file, s.line)} ${p.fullName}#${s.name} 從 ${s.layer} 層的 ${s.module} 跨到 ${codeEntry.layer} 層的 ${same.file},走 REV`);
        else r.info.push(`${p.fullName}#${s.name} 搬家:文檔 ${s.module} → 程式碼 ${same.file}(devflow sync 可改)`);
      }
    }
  }
  // abstract 的存在條件是被兩份以上文檔引用;零個是死的抽象
  for (const a of design.abstracts) {
    const n = consumers.get(a.fullName).size;
    if (n === 0) r.red.push(`${a.file} 沒有任何文檔引用 ${a.fullName};abstract 是 refactor 收整出來的共用部分,沒有消費者就該刪`);
  }
  return r;
}

const KEYWORDS = new Set(['forall', 'in', 'given', 'and', 'or', 'not', 'if', 'then', 'else']);

// 字串字面值不是識別字;`a.b` 當一個識別字(限定名)。
function identifiers(text) {
  const out = [];
  const stripped = text.replace(/"(?:[^"\\]|\\.)*"/g, (m) => ' '.repeat(m.length)).replace(/'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
  const re = /(?<![\w.])([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/g;
  let m;
  while ((m = re.exec(stripped))) if (!KEYWORDS.has(m[1])) out.push(m[1]);
  return out;
}

function boundVars(forall) {
  const body = forall.replace(/^forall\s*/, '');
  const clauses = [];
  let depth = 0;
  let cur = '';
  for (const c of body) {
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) {
      clauses.push(cur);
      cur = '';
    } else cur += c;
  }
  clauses.push(cur);
  const vars = [];
  const rhs = [];
  for (const cl of clauses) {
    const i = cl.search(/\bin\b/);
    if (i < 0) vars.push(...identifiers(cl));
    else {
      vars.push(...identifiers(cl.slice(0, i)));
      rhs.push(cl.slice(i + 2));
    }
  }
  return { vars, rhs };
}

export function lintLaws(design, source, adapter) {
  const r = { title: 'lint laws', red: [], info: [] };
  const sys = design.system;
  const innermost = sys && sys.layers.length ? sys.layers[0].name : null;
  // 最內層匯出的函數,law 本來就引用得到,不必列成觀察點
  const innerExports = new Set();
  const types = source ? allTypeNames(source) : new Set();
  if (source && design.modules && innermost) {
    for (const m of source.files.values()) {
      const e = matchModule(design.modules.entries, m.file);
      if (e && e.layer === innermost) for (const s of m.signatures) innerExports.add(s.name);
    }
  }
  const stdlib = new Set(adapter ? adapter.stdlib : []);
  const vocab = new Set(sys ? sys.vocab : []);

  for (const p of design.docs) {
    const stepNames = new Set(p.steps.map((s) => s.name));
    const refNames = new Set();
    for (const s of p.steps) if (s.ref) refNames.add(s.name);
    const lawIds = new Set();
    const mentioned = new Set();
    if (p.template.laws) r.red.push(`${p.file} Laws 還是模板(${p.template.laws} 條佔位符);寫成真的 law`);
    else if (!p.laws.length) r.red.push(`${p.file} 沒有 law`);
    for (const bad of p.badLaws) r.red.push(`${p.file} 第一行不是 LAW-n [種類] 一句:${bad.title}`);
    for (const l of p.laws) {
      const where = `${p.file} ${l.id}`;
      if (lawIds.has(l.id)) r.red.push(`${where} 編號重複`);
      lawIds.add(l.id);
      if (!LAW_KINDS.includes(l.kind)) r.red.push(`${where} 種類「${l.kind}」不在 ${LAW_KINDS.join(' / ')}`);
      if (!l.forall) r.red.push(`${where} 缺 forall 行`);
      if (!l.conclusion) r.red.push(`${where} 缺 |- 行`);
      if (!l.forall || !l.conclusion) continue;
      const { vars, rhs } = boundVars(l.forall);
      const bound = new Set(vars);
      const check = (text, label) => {
        for (const id of identifiers(text)) {
          if (stepNames.has(id)) mentioned.add(id);
          if (bound.has(id) || stepNames.has(id) || innerExports.has(id) || stdlib.has(id) || types.has(id) || vocab.has(id) || types.has(id.split('.')[0])) continue;
          r.red.push(`${where} ${label}的 ${id} 對不到 Steps 簽名、最內層的匯出、型別名或標準函式庫;真的需要就加進 system.md「Laws 詞彙追加」`);
        }
      };
      for (const [text, label] of [[l.forall, 'forall 行'], [l.conclusion, '|- 行'], ...l.given.map((g) => [g, 'given 行'])]) {
        if (/[^\x20-\x7e]/.test(text)) r.red.push(`${where} ${label}含非 ASCII 字元,三行只准表達式,不准散文:${text}`);
      }
      check(l.conclusion.replace(/^\|-\s*/, ''), '|- 行');
      for (const t of rhs) check(t, 'forall 行');
      for (const g of l.given) check(g.replace(/^given\s*/, ''), 'given 行');
    }
    for (const s of p.steps) {
      if (s.whole && s.name && !mentioned.has(s.name)) r.red.push(`${at(p.file, s.line)} = 列 ${s.name} 沒有任何 law 引用;整條至少一條端到端的 law`);
      if (s.entry && s.name && mentioned.has(s.name)) r.red.push(`${at(p.file, s.line)} ! 列 ${s.name} 被 law 引用;進入點只接線,它做的事由對外 I/O 表承接`);
    }
    if (p.template.examples) r.red.push(`${p.file} Examples 還是模板(${p.template.examples} 列佔位符);寫成真的 example`);
    else if (!p.examples.length) r.red.push(`${p.file} 沒有 example`);
    for (const ex of p.examples) {
      if (!/^EX-\d+$/.test(ex.id)) r.red.push(`${p.file} example 編號「${ex.id}」不是 EX-n`);
      if (!ex.covers.length) r.red.push(`${p.file} ${ex.id} 沒有指到任何 law`);
      for (const c of ex.covers) if (!lawIds.has(c)) r.red.push(`${p.file} ${ex.id} 指到的 ${c} 不存在`);
    }
  }
  return r;
}

export function lintTrace(design, source) {
  const r = { title: 'lint trace', red: [], info: [] };
  if (!source) return r;
  const declared = new Set();
  for (const p of design.docs) {
    for (const l of p.laws) declared.add(`${p.id}#${l.id}`);
    for (const e of p.examples) declared.add(`${p.id}#${e.id}`);
  }
  const seen = new Map();
  for (const t of source.testFiles) {
    if (!t.markers.length) r.info.push(`${t.file} 沒有歸屬,當內部單元測試,不進 law 分母`);
    for (const m of t.markers) {
      if (!seen.has(m)) seen.set(m, []);
      seen.get(m).push(t.file);
    }
  }
  for (const d of [...declared].sort()) if (!seen.has(d)) r.red.push(`${d} 沒有測試承接(未翻譯)`);
  for (const [m, files] of seen) if (!declared.has(m)) r.red.push(`${files.join(', ')} 引用的 ${m} 文檔裡沒有(幽靈引用);刪掉的編號永久空缺,不重用`);
  return r;
}

// 秘密不准出現在文檔的字面值裡:example 的輸入輸出、law 的三行。
const SECRET_RE = /(password|passwd|secret|api[_-]?key|apikey|access[_-]?token|private[_-]?key|BEGIN [A-Z ]*PRIVATE KEY|Bearer\s+[A-Za-z0-9._-]{12,})/i;

export function lintIo(design, source, adapter) {
  const r = { title: 'lint io', red: [], info: [] };
  const sys = design.system;
  if (!sys) {
    r.red.push('缺 .design/system.md,對外 I/O 沒有宣告');
    return r;
  }
  const entries = design.modules ? design.modules.entries : [];
  const covered = new Set();
  const declaredModules = new Set();
  for (const row of sys.io) {
    const where = at(sys.file, row.line);
    if (!['in', 'out'].includes(row.direction)) r.red.push(`${where} ${row.name} 的方向「${row.direction}」要是 in 或 out`);
    if (!row.feature) r.red.push(`${where} ${row.name} 沒寫進入哪份 feature`);
    else {
      const doc = design.docs.find((d) => d.fullName === row.feature);
      if (!doc) r.red.push(`${where} ${row.name} 指到的 ${row.feature} 不存在`);
      else if (doc.kind !== 'feature') r.red.push(`${where} ${row.name} 指到的 ${row.feature} 是 abstract;跨過對外邊界的是 feature`);
      else covered.add(row.feature);
    }
    if (!row.module) r.red.push(`${where} ${row.name} 沒寫最外層的模組`);
    else {
      declaredModules.add(row.module);
      const entry = entries.length ? matchModule(entries, row.module) : null;
      if (entries.length && !entry) r.red.push(`${where} ${row.name} 的模組 ${row.module} 不在模組表`);
      else if (entry && sys.outermost && entry.layer !== sys.outermost) r.red.push(`${where} ${row.name} 的模組 ${row.module} 是 ${entry.layer} 層;對外 I/O 只從最外層(${sys.outermost})進出`);
      if (source && !source.files.has(row.module)) r.red.push(`${where} ${row.name} 的模組 ${row.module} 程式碼裡沒有`);
    }
    if (!TRUST.includes(row.trust)) r.red.push(`${where} ${row.name} 的信任欄「${row.trust}」要是 trusted 或 untrusted`);
    else if (row.trust === 'untrusted' && row.direction === 'in') {
      if (!row.guard || row.guard === '-') r.red.push(`${where} ${row.name} 是 untrusted 的入口,驗證欄要指名做驗證的 step`);
      else {
        const doc = design.docs.find((d) => d.fullName === row.feature);
        const guardName = parseSignature(row.guard).name;
        if (doc && !doc.steps.some((s) => s.name === guardName)) r.red.push(`${where} ${row.name} 的驗證 step ${row.guard} 不在 ${row.feature} 的 Steps 表裡`);
      }
    }
    const typeName = /(?<![\w.])([A-Z]\w*)/.exec(row.type);
    if (source && typeName && sys.outermost) {
      for (const hit of findType(source, typeName[1])) {
        const entry = entries.length ? matchModule(entries, hit.file) : null;
        if (entry && entry.layer === sys.outermost) r.info.push(`${where} ${row.name} 的型別 ${typeName[1]} 定義在最外層的 ${hit.file};對外的型別住內層,邊界換了才不必跟著改`);
      }
    }
  }
  for (const f of design.features) {
    if (!sys.io.some((row) => row.feature === f.fullName)) r.red.push(`${sys.file} feature ${f.fullName} 沒有任何對外 I/O 列;feature 的兩端都要對得到這張表`);
  }
  // 秘密字面值
  for (const p of design.docs) {
    for (const ex of p.examples) {
      const hit = SECRET_RE.exec(`${ex.input} ${ex.output}`);
      if (hit) r.red.push(`${at(p.file, ex.line)} ${p.fullName} 的 ${ex.id} 字面值出現「${hit[1]}」;秘密不進文檔,example 用假名或型別描述`);
    }
    for (const l of p.laws) {
      const text = [l.forall, ...l.given, l.conclusion].filter(Boolean).join(' ');
      const hit = SECRET_RE.exec(text);
      if (hit) r.red.push(`${p.file} ${l.id} 的三行出現「${hit[1]}」;秘密不進文檔`);
    }
  }
  // 最外層裡碰了 IO 模組、卻沒有登記在對外 I/O 表的檔案
  if (source && adapter && sys.outermost && entries.length) {
    const ioPatterns = [...adapter.ioModules, ...sys.ioExtra];
    for (const m of source.files.values()) {
      const entry = matchModule(entries, m.file);
      if (!entry || entry.layer !== sys.outermost || declaredModules.has(m.file)) continue;
      const hit = m.rawImports.find((imp) => ioPatterns.some((p) => imp === p || imp.startsWith(p + '/') || imp.startsWith(p + '.') || imp.startsWith(p + '::')));
      if (hit) r.info.push(`${m.file} 在最外層而且 import 了 ${hit},但不在對外 I/O 表;可能是沒登記的出入口`);
    }
  }
  return r;
}

export function lintAll(design, source, adapter) {
  return [lintBoundary(design, source, adapter), lintSig(design, source, adapter), lintLaws(design, source, adapter), lintTrace(design, source), lintIo(design, source, adapter)];
}

export function renderLint(results) {
  const lines = [];
  let reds = 0;
  for (const r of results) {
    lines.push(`## ${r.title}:${r.red.length ? `${r.red.length} 條不合規` : '通過'}`);
    for (const x of r.red) lines.push(`- ✗ ${x}`);
    for (const x of r.info) lines.push(`- · ${x}`);
    reds += r.red.length;
  }
  return { text: lines.join('\n'), exitCode: reds ? 1 : 0 };
}
