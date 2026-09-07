// Python adapter:.py
import { findMarkers, scanLog, splitArgs, matchParen, norm } from '../testlog.mjs';

const IO_MODULES = [
  'os', 'io', 'sys', 'socket', 'subprocess', 'shutil', 'pathlib', 'tempfile', 'glob',
  'http', 'http.client', 'urllib', 'urllib.request', 'ftplib', 'smtplib', 'asyncio',
  'requests', 'httpx', 'aiohttp', 'sqlite3', 'psycopg2', 'psycopg', 'pymongo', 'redis', 'boto3',
  'sqlalchemy', 'threading', 'multiprocessing',
];

const STDLIB = [
  'total',
  'None', 'bytes', 'complex', 'frozenset',
  'len', 'abs', 'min', 'max', 'sum', 'sorted', 'reversed', 'any', 'all', 'zip', 'map', 'filter',
  'enumerate', 'range', 'list', 'dict', 'set', 'tuple', 'str', 'int', 'float', 'bool', 'bytes',
  'isinstance', 'type', 'repr', 'round', 'divmod', 'pow', 'None', 'True', 'False',
  'keys', 'values', 'items', 'get', 'append', 'startswith', 'endswith', 'strip', 'split', 'join',
];

function stripStrings(src) {
  return src
    .replace(/("""|''')[\s\S]*?\1/g, (m) => m.replace(/[^\n]/g, ' '))
    .split(/\r?\n/).map((l) => l.replace(/#.*$/, '')).join('\n');
}

// `a: T`、`a: T = 1`、`*args: T`、`**kw: T` → 型別;沒有註記回 null
function paramType(p) {
  const s = p.replace(/^\*{1,2}/, '').trim();
  const i = s.indexOf(':');
  if (i < 0) return null;
  const rest = s.slice(i + 1);
  const eq = rest.indexOf('=');
  return norm(eq >= 0 ? rest.slice(0, eq) : rest) || null;
}

function declarations(src) {
  const clean = stripStrings(src);
  const lines = clean.split('\n');
  const out = [];
  let klass = null;
  let klassIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.search(/\S/);
    if (indent < 0) continue;
    if (klass !== null && indent <= klassIndent) klass = null;
    const k = /^(\s*)class\s+([A-Za-z_]\w*)/.exec(line);
    if (k) {
      klass = k[2];
      klassIndent = k[1].length;
      continue;
    }
    const d = /^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/.exec(line);
    if (!d) continue;
    const level = d[1].length;
    // 只收頂層與 class 直屬的方法;巢狀在函數裡的是私有
    if (level !== 0 && !(klass !== null && level === klassIndent + 4)) continue;
    let text = line;
    let j = i;
    while (matchParen(text, text.indexOf('(')) < 0 && j + 1 < lines.length && j - i < 30) {
      j++;
      text += ' ' + lines[j].trim();
    }
    const open = text.indexOf('(');
    const close = matchParen(text, open);
    if (close < 0) continue;
    let args = splitArgs(text.slice(open + 1, close));
    if (level !== 0 && args.length && /^(self|cls)\b/.test(args[0])) args = args.slice(1);
    const after = text.slice(close + 1);
    const arrow = /->\s*([^:]*):/.exec(after);
    out.push({
      name: level === 0 ? d[2] : `${klass}.${d[2]}`,
      params: args.map(paramType),
      ret: arrow ? norm(arrow[1]) || null : null,
      line: i + 1,
      bodyStart: j + 1,
      indent: level,
      klass,
      bare: d[2],
    });
    i = j;
  }
  return out;
}

export const python = {
  name: 'python',
  extensions: ['.py'],
  ioModules: IO_MODULES,
  stdlib: STDLIB,
  stub: (marker) => `raise NotImplementedError("${marker}")`,

  isTestFile(rel) {
    return /(^|\/)tests?\//.test(rel) || /(^|\/)test_[^/]*\.py$/.test(rel) || /_test\.py$/.test(rel) || /(^|\/)conftest\.py$/.test(rel);
  },

  signatures(src) {
    return declarations(src).map((d) => ({ name: d.name, params: d.params, ret: d.ret, line: d.line }));
  },

  // `__all__` 是權威;沒寫就是「不以底線開頭的都算公開」
  exports(src) {
    const clean = stripStrings(src);
    const all = /^__all__\s*=\s*[[(]([\s\S]*?)[\])]/m.exec(clean);
    if (all) {
      const out = [];
      for (const m of all[1].matchAll(/['"]([A-Za-z_]\w*)['"]/g)) out.push(m[1]);
      return out;
    }
    const out = [];
    for (const d of declarations(src)) if (!d.bare.startsWith('_')) out.push(d.name, d.name.split('.')[0]);
    for (const m of clean.matchAll(/^class\s+([A-Za-z_]\w*)/gm)) if (!m[1].startsWith('_')) out.push(m[1]);
    return [...new Set(out)];
  },

  // class、TypeVar / NewType / TypeAlias,以及 Enum 子類別的成員
  typeNames(src) {
    const clean = stripStrings(src);
    const out = [];
    const lines = clean.split('\n');
    let enumIndent = -1;
    for (const line of lines) {
      const indent = line.search(/\S/);
      if (indent < 0) continue;
      if (enumIndent >= 0 && indent <= enumIndent) enumIndent = -1;
      const c = /^(\s*)class\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?/.exec(line);
      if (c) {
        out.push(c[2]);
        if (c[3] && /\bEnum\b|\bIntEnum\b|\bStrEnum\b/.test(c[3])) enumIndent = c[1].length;
        continue;
      }
      if (enumIndent >= 0 && indent > enumIndent) {
        const mem = /^\s*([A-Z_][A-Z0-9_]*|[A-Za-z_]\w*)\s*=/.exec(line);
        if (mem) out.push(mem[1]);
        continue;
      }
      const a = /^([A-Za-z_]\w*)\s*(?::\s*TypeAlias)?\s*=\s*(?:TypeVar|NewType|Literal|Union|Optional)\b/.exec(line);
      if (a) out.push(a[1]);
    }
    return [...new Set(out)];
  },

  // 本體只有 raise NotImplementedError 或 ...
  stubs(src) {
    const lines = stripStrings(src).split('\n');
    const out = [];
    for (const d of declarations(src)) {
      const body = [];
      for (let i = d.bodyStart; i < lines.length; i++) {
        const l = lines[i];
        if (!l.trim()) continue;
        if (l.search(/\S/) <= d.indent) break;
        body.push(l.trim());
      }
      if (body.length === 1 && (/^raise\s+NotImplementedError\b/.test(body[0]) || body[0] === '...')) out.push(d.name);
    }
    return out;
  },

  imports(src) {
    const clean = stripStrings(src);
    const out = [];
    let m;
    const from = /^\s*from\s+(\.*)([\w.]*)\s+import\b/gm;
    while ((m = from.exec(clean))) {
      if (m[1]) out.push(m[1].length === 1 ? `./${m[2].replace(/\./g, '/')}` : `${'../'.repeat(m[1].length - 1)}${m[2].replace(/\./g, '/')}`);
      else out.push(m[2]);
    }
    const plain = /^\s*import\s+([\w.]+)/gm;
    while ((m = plain.exec(clean))) out.push(m[1]);
    return [...new Set(out)].filter(Boolean);
  },

  testMarkers(src) {
    return findMarkers(src);
  },

  // pytest -v:`tests/x.py::test_name PASSED`;unittest:`test_name (mod.Case) ... ok`
  testResults(log) {
    return scanLog(log, {
      verdict: (line) => {
        if (/\bFAILED\b|\bERROR\b|\bFAIL\b/.test(line)) return 'red';
        if (/\bPASSED\b|\bXPASS\b|\.\.\.\s*ok\b/.test(line)) return 'green';
        if (/\bSKIPPED\b|\bXFAIL\b|\bskipped\b/.test(line)) return 'pending';
        return null;
      },
      reset: /^(=+ (short test summary|warnings summary|slowest)|-+ coverage|Ran \d+ tests?)/,
    });
  },
};
