// lint boundary / sig / laws / trace / all。每道回 { title, red: [], info: [] }。
import { ALLOWED_IMPORTS, LAYERS, LAW_KINDS, matchModule, matchesPattern } from '../design.mjs';
import { findSignature } from '../source.mjs';

function at(file, line) {
  return line ? `${file}:${line}` : file;
}

export function lintBoundary(design, source, adapter) {
  const r = { title: 'lint boundary', red: [], info: [] };
  if (!design.modules) {
    r.red.push('缺 .design/modules.md,邊界沒有宣告');
    return r;
  }
  const entries = design.modules.entries;
  for (const e of entries) {
    if (!LAYERS.includes(e.layer)) r.red.push(`${at(design.modules.file, e.line)} 模組 ${e.pattern} 的層「${e.layer}」不在 types / effects / pure / shell 裡`);
  }
  if (!source) return r;
  const ioPatterns = [...adapter.ioModules, ...(design.system ? design.system.ioExtra : [])];
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
      } else if (layer !== 'shell' && ioPatterns.some((p) => matchesPattern(p, imp))) {
        r.red.push(`${m.file} ${layer} 層的 ${m.module} import 了 IO 模組 ${imp}`);
      }
    }
    if (layer !== 'shell') {
      for (const s of m.signatures) {
        if (adapter.isEffectful(s.type)) r.red.push(`${at(m.file, s.line)} ${layer} 層的 ${m.module}.${s.name} 簽名碰到效果:${s.type}`);
      }
    }
  }
  return r;
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
    for (const s of p.stages) {
      if (!s.name || !s.type) {
        r.red.push(`${at(p.file, s.line)} 簽名欄不是 name :: Type:${s.sigText}`);
        continue;
      }
      if (!LAYERS.includes(s.layer)) r.red.push(`${at(p.file, s.line)} ${s.name} 的層「${s.layer}」不合法`);
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

function identifiers(text) {
  const out = [];
  const re = /(?<![\w.'])([a-z_][\w']*)/g;
  let m;
  while ((m = re.exec(text))) if (!KEYWORDS.has(m[1])) out.push(m[1]);
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

export function lintAll(design, source, adapter) {
  return [lintBoundary(design, source, adapter), lintSig(design, source, adapter), lintLaws(design, source, adapter), lintTrace(design, source)];
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
