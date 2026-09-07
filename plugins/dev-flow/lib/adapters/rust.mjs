// Rust adapter:.rs
import { findMarkers, scanLog, splitArgs, matchParen, norm } from '../testlog.mjs';

const IO_MODULES = [
  'std::fs', 'std::io', 'std::net', 'std::process', 'std::env', 'std::thread',
  'tokio', 'reqwest', 'hyper', 'sqlx', 'diesel', 'rusqlite', 'mio',
];

const STDLIB = [
  'total',
  'i8', 'i16', 'i32', 'i64', 'u8', 'u32', 'u64', 'usize', 'isize', 'f32', 'f64', 'char',
  'len', 'is_empty', 'contains', 'iter', 'map', 'filter', 'collect', 'unwrap', 'clone',
  'Some', 'None', 'Ok', 'Err', 'Option', 'Result', 'Vec', 'String', 'str', 'bool',
  'is_some', 'is_none', 'is_ok', 'is_err', 'min', 'max', 'abs', 'true', 'false',
];

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}

// #[cfg(test)] 底下的 mod 整段挖掉:那是測試,不是產品程式碼的簽名與 import。
function stripTestMods(src) {
  const lines = src.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/#\[cfg\(test\)\]/.test(lines[i])) {
      out.push(lines[i]);
      continue;
    }
    out.push('');
    let j = i + 1;
    while (j < lines.length && !lines[j].includes('{')) {
      out.push('');
      j++;
    }
    let depth = 0;
    for (; j < lines.length; j++) {
      for (const c of lines[j]) {
        if (c === '{') depth++;
        else if (c === '}') depth--;
      }
      out.push('');
      if (depth <= 0) break;
    }
    i = j;
  }
  return out.join('\n');
}

function paramType(p) {
  const s = p.trim();
  if (/^(&?\s*(mut\s+)?self|&'\w+\s+(mut\s+)?self)$/.test(s)) return undefined;
  const i = s.indexOf(':');
  return i < 0 ? null : norm(s.slice(i + 1)) || null;
}

function declarations(src) {
  const clean = stripTestMods(stripComments(src));
  const lines = clean.split('\n');
  const out = [];
  let impl = null;
  let implIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.search(/\S/);
    if (indent < 0) continue;
    if (impl !== null && indent <= implIndent && !/^\s*(pub\s+)?(async\s+)?(unsafe\s+)?(extern\s+"[^"]*"\s+)?fn\b/.test(line)) impl = null;
    const im = /^(\s*)impl\b[^{]*?(?:for\s+)?([A-Z]\w*)(?:<[^>]*>)?\s*\{/.exec(line);
    if (im) {
      impl = im[2];
      implIndent = im[1].length;
      continue;
    }
    const tr = /^(\s*)(?:pub\s+)?trait\s+([A-Z]\w*)/.exec(line);
    if (tr) {
      impl = tr[2];
      implIndent = tr[1].length;
      continue;
    }
    const f = /^(\s*)(pub(?:\([^)]*\))?\s+)?(?:default\s+)?(?:const\s+)?(?:async\s+)?(?:unsafe\s+)?(?:extern\s+"[^"]*"\s+)?fn\s+([a-zA-Z_]\w*)\s*(?:<[^(]*>)?\s*\(/.exec(line);
    if (!f) continue;
    let text = line;
    let j = i;
    const openOf = (t) => t.indexOf('(', t.indexOf('fn '));
    while (matchParen(text, openOf(text)) < 0 && j + 1 < lines.length && j - i < 20) {
      j++;
      text += ' ' + lines[j].trim();
    }
    const open = openOf(text);
    const close = matchParen(text, open);
    if (close < 0) continue;
    const params = splitArgs(text.slice(open + 1, close)).map(paramType).filter((p) => p !== undefined);
    const after = text.slice(close + 1);
    const arrow = /->\s*([^{;]*)/.exec(after);
    const inImpl = impl !== null && f[1].length > implIndent;
    out.push({
      name: inImpl ? `${impl}.${f[3]}` : f[3],
      bare: f[3],
      params,
      ret: arrow ? norm(arrow[1].replace(/\bwhere\b[\s\S]*$/, '')) || null : null,
      line: i + 1,
      pub: !!f[2],
      bodyStart: j,
    });
    i = j;
  }
  return out;
}

export const rust = {
  name: 'rust',
  extensions: ['.rs'],
  ioModules: IO_MODULES,
  stdlib: STDLIB,
  stub: (marker) => `todo!("${marker}")`,

  isTestFile(rel) {
    return /(^|\/)tests\//.test(rel) || /_test\.rs$/.test(rel);
  },

  signatures(src) {
    return declarations(src).map((d) => ({ name: d.name, params: d.params, ret: d.ret, line: d.line }));
  },

  exports(src) {
    const clean = stripTestMods(stripComments(src));
    const out = [];
    for (const d of declarations(src)) if (d.pub) out.push(d.name, d.name.split('.')[0]);
    for (const m of clean.matchAll(/^\s*pub(?:\([^)]*\))?\s+(?:struct|enum|trait|type|const|static)\s+([A-Za-z_]\w*)/gm)) out.push(m[1]);
    // impl 區塊裡的方法:型別是 pub 就算對外可見
    for (const m of clean.matchAll(/^\s*impl\b[^{]*?(?:for\s+)?([A-Z]\w*)/gm)) out.push(m[1]);
    return [...new Set(out)];
  },

  // struct / enum / trait / type,以及 enum 的 variant
  typeNames(src) {
    const clean = stripTestMods(stripComments(src));
    const out = [];
    for (const m of clean.matchAll(/^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|trait|union|type)\s+([A-Za-z_]\w*)/gm)) out.push(m[1]);
    const en = /^\s*(?:pub(?:\([^)]*\))?\s+)?enum\s+([A-Za-z_]\w*)[^{]*\{([\s\S]*?)^\s*\}/gm;
    let m;
    while ((m = en.exec(clean))) {
      out.push(m[1]);
      for (const v of m[2].matchAll(/^\s*([A-Z]\w*)/gm)) out.push(v[1]);
    }
    return [...new Set(out)];
  },

  // 本體只有 todo!() / unimplemented!()
  stubs(src) {
    const lines = stripTestMods(stripComments(src)).split('\n');
    const out = [];
    for (const d of declarations(src)) {
      const body = lines.slice(d.bodyStart, d.bodyStart + 4).join('\n');
      const open = body.indexOf('{');
      if (open < 0) continue;
      const inner = body.slice(open + 1).split('}')[0].trim();
      if (/^(todo|unimplemented)!\s*\(/.test(inner) && inner.split('\n').filter((l) => l.trim()).length === 1) out.push(d.name);
    }
    return out;
  },

  // use crate::a::b → a/b;use super::x → ../x;mod x → ./x
  imports(src) {
    const clean = stripTestMods(stripComments(src));
    const out = [];
    let m;
    const use = /^\s*(?:pub\s+)?use\s+([^;]+);/gm;
    while ((m = use.exec(clean))) {
      const head = m[1].split('{')[0].trim().replace(/\s+/g, '');
      const parts = head.split('::').filter(Boolean);
      if (!parts.length) continue;
      if (parts[0] === 'crate') out.push(parts.slice(1).join('/'));
      else if (parts[0] === 'super') out.push(`../${parts.slice(1).join('/')}`);
      else if (parts[0] === 'self') out.push(`./${parts.slice(1).join('/')}`);
      else out.push(parts.slice(0, 2).join('::'));
    }
    const mod = /^\s*(?:pub\s+)?mod\s+([a-zA-Z_]\w*)\s*;/gm;
    while ((m = mod.exec(clean))) out.push(`./${m[1]}`);
    return [...new Set(out)].filter(Boolean);
  },

  // 內嵌的 #[cfg(test)] mod 也要掃得到標記,所以這裡讀原始碼全文
  testMarkers(src) {
    return findMarkers(src);
  },

  // cargo test:`test token::tests::f_001__law_1_rotate ... ok`
  testResults(log) {
    return scanLog(log, {
      verdict: (line) => {
        if (/\.\.\.\s*FAILED\b|^----\s.*stdout|\bpanicked at\b/.test(line)) return 'red';
        if (/\.\.\.\s*ok\b/.test(line)) return 'green';
        if (/\.\.\.\s*ignored\b/.test(line)) return 'pending';
        return null;
      },
      reset: /^(test result:|running \d+ tests?|failures:)/,
    });
  },
};
