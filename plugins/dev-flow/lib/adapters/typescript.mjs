// TypeScript / JavaScript adapter:.ts .tsx .js .jsx .mjs .cjs
import { findMarkers, scanLog, splitArgs, matchParen, norm } from '../testlog.mjs';

const IO_MODULES = [
  'fs', 'node:fs', 'fs/promises', 'node:fs/promises', 'net', 'node:net', 'http', 'node:http', 'https', 'node:https',
  'child_process', 'node:child_process', 'dgram', 'node:dgram', 'dns', 'node:dns', 'os', 'node:os',
  'worker_threads', 'node:worker_threads', 'cluster', 'node:cluster', 'readline', 'node:readline',
  'axios', 'node-fetch', 'undici', 'pg', 'mysql2', 'mongodb', 'redis', 'ioredis', 'better-sqlite3', 'sqlite3',
];

const STDLIB = [
  'total',
  'string', 'number', 'boolean', 'void', 'unknown', 'any', 'bigint', 'symbol',
  'length', 'size', 'has', 'get', 'includes', 'indexOf', 'slice', 'concat', 'join', 'split',
  'map', 'filter', 'reduce', 'find', 'some', 'every', 'sort', 'reverse', 'keys', 'values', 'entries',
  'Math', 'abs', 'min', 'max', 'floor', 'ceil', 'round', 'JSON', 'parse', 'stringify',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Set', 'Map', 'Date',
  'isArray', 'isNaN', 'isFinite', 'toString', 'valueOf', 'trim', 'toLowerCase', 'toUpperCase',
  'null', 'undefined', 'true', 'false', 'NaN', 'Infinity',
];

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split(/\r?\n/).map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
}

// `a: T`、`a?: T`、`a: T = 1`、`...rest: T[]`、`{ a, b }: Opts` → 型別;沒有註記回 null
function paramType(p) {
  const s = p.replace(/^\.\.\./, '').trim();
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ('([{<'.includes(c)) depth++;
    else if (')]}>'.includes(c)) depth--;
    else if (c === ':' && depth === 0) {
      const rest = s.slice(i + 1);
      const eq = /(^|[^=!<>])=(?!=|>)/.exec(rest);
      return norm(eq ? rest.slice(0, eq.index + eq[1].length) : rest) || null;
    }
  }
  return null;
}

// `)` 之後到 `{` 或 `=>` 之前的 `: R`
function returnType(after) {
  const s = after.replace(/^\s*/, '');
  if (!s.startsWith(':')) return null;
  let depth = 0;
  for (let i = 1; i < s.length; i++) {
    const c = s[i];
    // 先判結束再算深度:`: R {` 的 `{` 是本體的開頭,不是型別的一部分
    if (depth === 0 && (s.startsWith('=>', i) || c === '{' || c === ';')) return norm(s.slice(1, i)) || null;
    if ('([{<'.includes(c)) depth++;
    else if (')]}>'.includes(c)) {
      depth--;
      if (depth < 0) return norm(s.slice(1, i)) || null;
    }
  }
  return norm(s.slice(1)) || null;
}

// 一個檔案的頂層宣告與 class 方法。class 方法的名字是 `Class.method`。
function declarations(src) {
  const clean = stripComments(src);
  const lines = clean.split('\n');
  const out = [];
  let klass = null;
  let klassIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.search(/\S/);
    if (indent < 0) continue;
    if (klass !== null && indent <= klassIndent) klass = null;
    const k = /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (k && indent === 0) {
      klass = k[1];
      klassIndent = indent;
      continue;
    }
    // 多行簽名:把接下來的行併進來直到括號配對
    let text = line;
    let j = i;
    while (matchParen(text, text.indexOf('(')) < 0 && text.includes('(') && j + 1 < lines.length && j - i < 12) {
      j++;
      text += ' ' + lines[j].trim();
    }
    const exported = /^\s*export\b/.test(text);
    let m = /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^(]*>)?\s*\(/.exec(text);
    let name = null;
    if (m) name = m[1];
    if (!name) {
      const c = /^\s*(?:export\s+)?(?:declare\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*(?:async\s+)?(?:function\s*\*?\s*[A-Za-z_$]*\s*)?(?:<[^(]*>)?\s*\(/.exec(text);
      if (c) {
        name = c[1];
        m = c;
      }
    }
    if (!name && klass !== null && indent > klassIndent) {
      const me = /^\s*(?:public\s+|private\s+|protected\s+|readonly\s+|static\s+|async\s+|get\s+|set\s+|\*\s*)*([A-Za-z_$][\w$]*)\s*(?:<[^(]*>)?\s*\(/.exec(text);
      if (me && !/^(if|for|while|switch|catch|return|typeof|new|constructor)$/.test(me[1])) {
        name = `${klass}.${me[1]}`;
        m = me;
      }
    }
    if (!name) continue;
    const open = text.indexOf('(', m.index + m[0].length - 1);
    const close = matchParen(text, open);
    if (close < 0) continue;
    const params = splitArgs(text.slice(open + 1, close)).map(paramType);
    out.push({
      name,
      params,
      ret: returnType(text.slice(close + 1)),
      line: i + 1,
      exported: exported || (klass !== null && klass === name.split('.')[0]),
      klass,
      bodyStart: j,
    });
    i = j;
  }
  return out;
}

export const typescript = {
  name: 'typescript',
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  ioModules: IO_MODULES,
  stdlib: STDLIB,
  stub: (marker) => `throw new Error("${marker} not implemented");`,

  isTestFile(rel) {
    return /(^|\/)(__tests__|test|tests|spec)\//.test(rel) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel);
  },

  signatures(src) {
    return declarations(src).map((d) => ({ name: d.name, params: d.params, ret: d.ret, line: d.line }));
  },

  // `export` 標的名字加上 `export { a, b }`;class 的方法跟著 class 走。
  exports(src) {
    const clean = stripComments(src);
    const out = [];
    for (const d of declarations(src)) if (d.exported) out.push(d.name, d.name.split('.')[0]);
    const re = /export\s*\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(clean))) {
      for (const item of m[1].split(',')) {
        const n = /^\s*([A-Za-z_$][\w$]*)/.exec(item);
        if (n) out.push(n[1]);
      }
    }
    const re2 = /export\s+(?:default\s+)?(?:abstract\s+)?(?:class|interface|type|enum|const|let|var|function)\s+([A-Za-z_$][\w$]*)/g;
    while ((m = re2.exec(clean))) out.push(m[1]);
    return [...new Set(out)];
  },

  // 型別名:interface / type / class / enum,以及 enum 的成員(law 會直接寫成員名)
  typeNames(src) {
    const clean = stripComments(src);
    const out = [];
    const re = /^\s*(?:export\s+)?(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:interface|type|class|(?:const\s+)?enum)\s+([A-Za-z_$][\w$]*)/gm;
    let m;
    while ((m = re.exec(clean))) out.push(m[1]);
    const en = /^\s*(?:export\s+)?(?:const\s+)?enum\s+[A-Za-z_$][\w$]*\s*\{([^}]*)\}/gms;
    while ((m = en.exec(clean))) {
      for (const item of m[1].split(',')) {
        const n = /^\s*([A-Za-z_$][\w$]*)/.exec(item);
        if (n) out.push(n[1]);
      }
    }
    // 判別聯集的字串字面值常被 law 引用:type X = 'a' | 'b'
    const un = /^\s*(?:export\s+)?type\s+[A-Za-z_$][\w$]*\s*=\s*([^;\n]*)/gm;
    while ((m = un.exec(clean))) for (const lit of m[1].matchAll(/'([A-Za-z_$][\w$]*)'|"([A-Za-z_$][\w$]*)"/g)) out.push(lit[1] || lit[2]);
    return [...new Set(out)];
  },

  // 本體只有一個 throw:骨架
  stubs(src) {
    const clean = stripComments(src);
    const lines = clean.split('\n');
    const out = [];
    for (const d of declarations(src)) {
      const body = lines.slice(d.bodyStart, d.bodyStart + 4).join('\n');
      const open = body.indexOf('{');
      if (open < 0) continue;
      const inner = body.slice(open + 1).split('}')[0];
      if (/^\s*throw\s+new\s+\w*Error\s*\(/.test(inner) && inner.split(';').filter((s) => s.trim()).length <= 1) out.push(d.name);
    }
    return out;
  },

  imports(src) {
    const clean = stripComments(src);
    const out = [];
    const re = /(?:^|\n)\s*(?:import|export)\b[^;\n]*?from\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(clean))) out.push(m[1]);
    const bare = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
    while ((m = bare.exec(clean))) out.push(m[1]);
    const req = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = req.exec(clean))) out.push(m[1]);
    return [...new Set(out)];
  },

  testMarkers(src) {
    return findMarkers(src);
  },

  // jest / vitest / mocha:✓ ✕ ○,以及 PASS / FAIL 行
  testResults(log) {
    return scanLog(log, {
      verdict: (line) => {
        if (/[✕✗×]|\bFAIL\b|\bfailed\b/.test(line)) return 'red';
        if (/[✓✔√]|\bPASS\b|\bpassed\b|\bok\b/.test(line)) return 'green';
        if (/[○◯]|\bskipped\b|\btodo\b|\bpending\b/i.test(line)) return 'pending';
        return null;
      },
      reset: /^(Test Suites:|Tests:|Snapshots:|Time:|Ran all test suites)/,
    });
  },
};
