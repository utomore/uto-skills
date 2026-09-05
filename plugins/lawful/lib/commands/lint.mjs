// lint boundary / sig / laws / trace / io / all。每道回 { title, red: [], info: [] }。
import { ALLOWED_IMPORTS, LAYERS, LAW_KINDS, matchModule, matchesPattern } from '../design.mjs';
import { findSignature, findType } from '../source.mjs';

function at(file, line) {
  return line ? `${file}:${line}` : file;
}

// M 可以 import X.Internal 的條件:M 就是 X,或 M 住在 X.Internal 底下。測試不在模組圖裡。
function mayImportInternal(importer, imported) {
  const owner = imported.replace(/\.Internal(\..*)?$/, '');
  return importer === owner || importer === imported || importer.startsWith(`${imported}.`);
}

export function lintBoundary(design, source, adapter) {
  const r = { title: 'lint boundary', red: [], info: [] };
  if (!design.modules) {
    r.red.push('缺 .lawful/modules.md,邊界沒有宣告');
    return r;
  }
  const entries = design.modules.entries;
  for (const e of entries) {
    if (!LAYERS.includes(e.layer)) r.red.push(`${at(design.modules.file, e.line)} 模組 ${e.pattern} 的層「${e.layer}」不在 types / effects / pure / shell 裡`);
  }
  if (!source) return r;
  const ioPatterns = [...adapter.ioModules, ...(design.system ? design.system.ioExtra : [])];
  const effectExtra = design.system ? design.system.effectExtra : [];
  const codeModules = [...source.modules.keys()];
  for (const e of entries) {
    if (!codeModules.some((m) => matchesPattern(e.pattern, m))) r.red.push(`${at(design.modules.file, e.line)} 模組表有 ${e.pattern},程式碼裡沒有(幽靈)`);
  }
  for (const m of source.modules.values()) {
    const entry = matchModule(entries, m.module);
    if (!entry) {
      r.red.push(`${m.file} 模組 ${m.module} 不在模組表(未登記)`);
      continue;
    }
    const layer = entry.layer;
    const allowed = ALLOWED_IMPORTS[layer] || [];
    for (const imp of m.imports) {
      const target = source.modules.get(imp);
      if (target) {
        const te = matchModule(entries, imp);
        if (te && !allowed.includes(te.layer)) r.red.push(`${m.file} ${layer} 層的 ${m.module} import 了 ${te.layer} 層的 ${imp}`);
        if (/\.Internal(\.|$)/.test(imp) && !mayImportInternal(m.module, imp)) r.red.push(`${m.file} ${m.module} import 了 ${imp};*.Internal 只准它自己的模組與測試 import`);
      } else if (layer !== 'shell' && ioPatterns.some((p) => matchesPattern(p, imp))) {
        r.red.push(`${m.file} ${layer} 層的 ${m.module} import 了 IO 模組 ${imp}`);
      }
    }
    if (layer !== 'shell') {
      if (m.exports === null) r.red.push(`${m.file} ${layer} 層的 ${m.module} 沒有匯出清單,整個模組都是公開的;stage 與觀察點以外的東西要收起來`);
      for (const s of m.signatures) {
        if (adapter.isEffectful(s.type, effectExtra)) r.red.push(`${at(m.file, s.line)} ${layer} 層的 ${m.module}.${s.name} 簽名碰到效果:${s.type}`);
      }
    }
  }
  return r;
}

// system.md「Pipelines」表的類別;沒列回 null。
function kindOf(design, fullName) {
  if (!design.system) return null;
  const row = design.system.pipelines.find((l) => l.fullName === fullName);
  return row ? row.kind : null;
}

export function lintSig(design, source, adapter) {
  const r = { title: 'lint sig', red: [], info: [] };
  const entries = design.modules ? design.modules.entries : [];
  for (const p of design.pipelines) {
    if (!p.stages.length) {
      r.red.push(`${p.file} 沒有 Stages 表`);
      continue;
    }
    const wholes = p.stages.filter((s) => s.whole);
    if (wholes.length !== 1) r.red.push(`${p.file} = 列要恰好一列,現在 ${wholes.length} 列`);
    const runners = p.stages.filter((s) => s.runner);
    const kind = kindOf(design, p.fullName);
    if (kind === '里程碑' && runners.length !== 1) r.red.push(`${p.file} 里程碑要恰好一列 ! 列(shell 的進入點),現在 ${runners.length} 列`);
    if (kind === '子流' && runners.length) r.red.push(`${p.file} 子流不碰 shell,不該有 ! 列`);
    for (const s of p.stages) {
      if (!s.name || !s.type) {
        r.red.push(`${at(p.file, s.line)} 簽名欄不是 name :: Type:${s.sigText}`);
        continue;
      }
      if (!LAYERS.includes(s.layer)) r.red.push(`${at(p.file, s.line)} ${s.name} 的層「${s.layer}」不合法`);
      if (s.whole && s.layer === 'shell') r.red.push(`${at(p.file, s.line)} = 列 ${s.name} 在 shell 層;= 列是純的整條(pure 或 effects),shell 的進入點另列成 ! 列`);
      if (s.observe && s.layer === 'shell') r.red.push(`${at(p.file, s.line)} 觀察點 ${s.name} 在 shell 層;law 引用的量要是純的`);
      if (s.runner && s.layer !== 'shell') r.red.push(`${at(p.file, s.line)} ! 列 ${s.name} 不在 shell 層;! 列是把 = 列接到解譯器與對外 I/O 的進入點`);
      const entry = entries.length ? matchModule(entries, s.module) : null;
      if (entries.length && !entry) r.red.push(`${at(p.file, s.line)} ${s.name} 的模組 ${s.module} 不在模組表`);
      else if (entry && entry.layer !== s.layer) r.red.push(`${at(p.file, s.line)} ${s.name} 寫 ${s.layer} 層,模組表說 ${s.module} 是 ${entry.layer} 層`);
      if (s.ref && !design.pipelines.some((q) => q.fullName === s.ref)) r.red.push(`${at(p.file, s.line)} ${s.name} 引用的 ${s.ref} 不存在`);
      if (!source) continue;
      const hits = findSignature(source, s.name);
      if (!hits.length) {
        if (s.wish) r.info.push(`${p.fullName}#${s.name} 願望,待實作(目標 ${s.module})`);
        else r.red.push(`${at(p.file, s.line)} ${p.fullName}#${s.name} 程式碼裡找不到`);
        continue;
      }
      const same = hits.find((h) => h.module === s.module) || hits[0];
      const want = adapter.normalizeType(s.type);
      if (same.type !== want) {
        r.red.push(`${at(p.file, s.line)} ${p.fullName}#${s.name} 簽名不一致\n    文檔:${s.name} :: ${want}\n    程式碼:${s.name} :: ${same.type}(${at(same.file, same.line)})`);
      }
      if (!same.exported) r.red.push(`${at(same.file, same.line)} ${p.fullName}#${s.name} 程式碼裡有,但 ${same.module} 沒有匯出它;stage 與觀察點都要是匯出的簽名`);
      if (same.module !== s.module) {
        const codeEntry = entries.length ? matchModule(entries, same.module) : null;
        if (codeEntry && entry && codeEntry.layer !== entry.layer) r.red.push(`${at(p.file, s.line)} ${p.fullName}#${s.name} 從 ${s.layer} 層的 ${s.module} 跨到 ${codeEntry.layer} 層的 ${same.module},走 REV`);
        else r.info.push(`${p.fullName}#${s.name} 搬家:文檔 ${s.module} → 程式碼 ${same.module}(lawful sync 可改)`);
      }
    }
  }
  return r;
}

const KEYWORDS = new Set(['forall', 'in', 'given', 'and', 'or', 'not', 'if', 'then', 'else', 'let', 'where', 'case', 'of']);

// 字串字面值不是識別字:先把 "..." 挖空再抓。
function identifiers(text) {
  const out = [];
  const re = /(?<![\w.'])([a-z_][\w']*)/g;
  const stripped = text.replace(/"(?:[^"\\]|\\.)*"/g, (m) => ' '.repeat(m.length));
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
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
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
    if (i < 0) {
      vars.push(...identifiers(cl));
    } else {
      vars.push(...identifiers(cl.slice(0, i)));
      rhs.push(cl.slice(i + 2));
    }
  }
  return { vars, rhs };
}

export function lintLaws(design, source, adapter) {
  const r = { title: 'lint laws', red: [], info: [] };
  const typesExports = new Set();
  if (source && design.modules) {
    for (const m of source.modules.values()) {
      const e = matchModule(design.modules.entries, m.module);
      if (e && e.layer === 'types') for (const s of m.signatures) typesExports.add(s.name);
    }
  }
  const stdlib = new Set(adapter ? adapter.stdlib : []);
  for (const p of design.pipelines) {
    const stageNames = new Set(p.stages.map((s) => s.name));
    const lawIds = new Set();
    const mentioned = new Set();
    if (!p.laws.length) r.red.push(`${p.file} 沒有 law`);
    for (const l of p.laws) {
      const where = `${p.file} ${l.id || l.title}`;
      if (!l.id) {
        r.red.push(`${where} 第一行不是 LAW-n [種類] 一句:${l.title}`);
        continue;
      }
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
          if (stageNames.has(id)) mentioned.add(id);
          if (bound.has(id) || stageNames.has(id) || typesExports.has(id) || stdlib.has(id)) continue;
          r.red.push(`${where} ${label}的 ${id} 對不到 Stages 簽名、types 層匯出或標準函式庫`);
        }
      };
      for (const [text, label] of [[l.forall, 'forall 行'], [l.conclusion, '|- 行'], ...l.given.map((g) => [g, 'given 行'])]) {
        if (/[^\x20-\x7e]/.test(text)) r.red.push(`${where} ${label}含非 ASCII 字元,三行只准表達式,不准散文:${text}`);
      }
      check(l.conclusion.replace(/^\|-\s*/, ''), '|- 行');
      for (const t of rhs) check(t, 'forall 行');
      for (const g of l.given) check(g.replace(/^given\s*/, ''), 'given 行');
    }
    for (const s of p.stages) {
      if (s.whole && s.name && !mentioned.has(s.name)) r.red.push(`${at(p.file, s.line)} = 列 ${s.name} 沒有任何 law 引用;整條至少一條 law`);
      if (s.runner && s.name && mentioned.has(s.name)) r.red.push(`${at(p.file, s.line)} ! 列 ${s.name} 被 law 引用;law 只講純的量,進入點不掛 law`);
    }
    if (!p.examples.length) r.red.push(`${p.file} 沒有 example`);
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
  for (const p of design.pipelines) {
    for (const l of p.laws) if (l.id) declared.add(`${p.id}#${l.id}`);
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
  for (const d of declared) if (!seen.has(d)) r.red.push(`${d} 沒有測試承接(未翻譯)`);
  for (const [m, files] of seen) if (!declared.has(m)) r.red.push(`${files.join(', ')} 引用的 ${m} 文檔裡沒有(幽靈引用)`);
  return r;
}

// 對外 I/O 表 vs 里程碑兩端、模組表、程式碼。
export function lintIo(design, source) {
  const r = { title: 'lint io', red: [], info: [] };
  if (!design.system) {
    r.red.push('缺 .lawful/system.md,對外 I/O 沒有宣告');
    return r;
  }
  const sys = design.system;
  const entries = design.modules ? design.modules.entries : [];
  const milestones = sys.pipelines.filter((l) => l.kind === '里程碑').map((l) => l.fullName);
  const covered = new Set();
  for (const row of sys.io) {
    const where = at(sys.file, row.line);
    if (!['in', 'out'].includes(row.direction)) r.red.push(`${where} ${row.name} 的方向「${row.direction}」要是 in 或 out`);
    if (!row.pipeline) r.red.push(`${where} ${row.name} 沒寫進入哪條 pipeline`);
    else if (!design.pipelines.some((p) => p.fullName === row.pipeline)) r.red.push(`${where} ${row.name} 指到的 ${row.pipeline} 不存在`);
    else if (!milestones.includes(row.pipeline)) r.red.push(`${where} ${row.name} 指到的 ${row.pipeline} 不是里程碑;跨過 shell 的資料流才會出現在對外 I/O 表`);
    else covered.add(row.pipeline);
    if (row.module) {
      const entry = entries.length ? matchModule(entries, row.module) : null;
      if (entries.length && !entry) r.red.push(`${where} ${row.name} 的 shell 模組 ${row.module} 不在模組表`);
      else if (entry && entry.layer !== 'shell') r.red.push(`${where} ${row.name} 的模組 ${row.module} 是 ${entry.layer} 層;對外 I/O 只從 shell 進出`);
      if (source && !source.modules.has(row.module)) r.red.push(`${where} ${row.name} 的 shell 模組 ${row.module} 程式碼裡沒有`);
    } else r.red.push(`${where} ${row.name} 沒寫 shell 模組`);
    const typeName = /(?<![\w.'])([A-Z][\w']*)/.exec(row.type);
    if (source && typeName) {
      for (const hit of findType(source, typeName[1])) {
        const entry = entries.length ? matchModule(entries, hit.module) : null;
        if (entry && !['types', 'effects'].includes(entry.layer)) r.red.push(`${where} ${row.name} 的型別 ${typeName[1]} 住在 ${entry.layer} 層的 ${hit.module};對外 I/O 的型別與效果 ADT 住 types 或 effects`);
      }
    }
  }
  for (const m of milestones) {
    if (!design.pipelines.some((p) => p.fullName === m)) continue;
    if (!covered.has(m)) r.red.push(`${sys.file} 里程碑 ${m} 沒有任何對外 I/O 列;里程碑的兩端都要對得到這張表`);
  }
  return r;
}

export function lintAll(design, source, adapter) {
  return [lintBoundary(design, source, adapter), lintSig(design, source, adapter), lintLaws(design, source, adapter), lintTrace(design, source), lintIo(design, source)];
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
