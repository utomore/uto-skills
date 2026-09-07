// Go adapter:.go
import { findMarkers, scanLog, splitArgs, matchParen, norm } from '../testlog.mjs';

const IO_MODULES = [
  'os', 'io', 'io/ioutil', 'net', 'net/http', 'net/url', 'os/exec', 'bufio', 'path/filepath',
  'database/sql', 'log', 'syscall', 'runtime/debug', 'time',
];

const STDLIB = [
  'total',
  'int8', 'int16', 'int32', 'uint', 'uint8', 'uint64', 'float32', 'complex128', 'any',
  'len', 'cap', 'append', 'copy', 'make', 'new', 'delete', 'nil', 'true', 'false',
  'error', 'string', 'int', 'int64', 'float64', 'bool', 'byte', 'rune',
  'Error', 'String', 'Len', 'Less', 'Swap',
];

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}

// Go 的參數可以共用型別:`a, b int` → 兩個 int。回一串型別。
function paramTypes(inner) {
  const parts = splitArgs(inner);
  const out = [];
  const pending = [];
  for (const p of parts) {
    const s = p.replace(/^\.\.\./, '').trim();
    // `名字 型別` vs 只有型別:最後一個空白之前是名字(型別本身可能帶空白,例如 map[string] int 不合法所以安全)
    const m = /^([a-zA-Z_]\w*)\s+(\S[\s\S]*)$/.exec(s);
    if (m) {
      out.push(...pending.map(() => norm(m[2])));
      pending.length = 0;
      out.push(norm(m[2]));
    } else if (/^[a-zA-Z_]\w*$/.test(s)) {
      pending.push(s);
    } else {
      out.push(...pending.map(() => norm(s)));
      pending.length = 0;
      out.push(norm(s));
    }
  }
  for (const _ of pending) out.push(null);
  return out;
}

function returnType(after) {
  const s = after.trim();
  if (!s || s.startsWith('{')) return null;
  if (s.startsWith('(')) {
    const close = matchParen(s, 0);
    if (close < 0) return null;
    const parts = splitArgs(s.slice(1, close)).map((p) => {
      const m = /^[a-zA-Z_]\w*\s+(\S[\s\S]*)$/.exec(p.trim());
      return norm(m ? m[1] : p);
    });
    return parts.length ? `(${parts.join(', ')})` : null;
  }
  const m = /^([^\s{][^{]*?)\s*\{/.exec(s);
  return m ? norm(m[1]) : norm(s.split('{')[0]) || null;
}

function declarations(src) {
  const clean = stripComments(src);
  const lines = clean.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let text = lines[i];
    if (!/^func\b/.test(text)) continue;
    let j = i;
    while (j + 1 < lines.length && j - i < 12 && !/\{\s*$/.test(text) && matchParen(text, text.indexOf('(')) < 0) {
      j++;
      text += ' ' + lines[j].trim();
    }
    // 方法:func (r *Store) Rotate(...)
    let recv = null;
    let rest = text.slice(4).trim();
    if (rest.startsWith('(')) {
      const close = matchParen(rest, 0);
      if (close < 0) continue;
      const inner = rest.slice(1, close).trim();
      const rm = /(?:[a-zA-Z_]\w*\s+)?\*?([A-Za-z_]\w*)/.exec(inner);
      recv = rm ? rm[1] : null;
      rest = rest.slice(close + 1).trim();
    }
    const nm = /^([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*\(/.exec(rest);
    if (!nm) continue;
    const open = rest.indexOf('(', nm[0].length - 1);
    const close = matchParen(rest, open);
    if (close < 0) continue;
    const name = recv ? `${recv}.${nm[1]}` : nm[1];
    out.push({
      name,
      bare: nm[1],
      params: paramTypes(rest.slice(open + 1, close)),
      ret: returnType(rest.slice(close + 1)),
      line: i + 1,
      bodyStart: j,
    });
    i = j;
  }
  return out;
}

export const go = {
  name: 'go',
  extensions: ['.go'],
  ioModules: IO_MODULES,
  stdlib: STDLIB,
  stub: (marker) => `panic("${marker} not implemented")`,

  isTestFile(rel) {
    return /_test\.go$/.test(rel) || /(^|\/)tests?\//.test(rel);
  },

  signatures(src) {
    return declarations(src).map((d) => ({ name: d.name, params: d.params, ret: d.ret, line: d.line }));
  },

  // Go 的匯出是大寫開頭
  exports(src) {
    const clean = stripComments(src);
    const out = [];
    for (const d of declarations(src)) if (/^[A-Z]/.test(d.bare)) out.push(d.name, d.name.split('.')[0]);
    for (const m of clean.matchAll(/^type\s+([A-Z]\w*)/gm)) out.push(m[1]);
    for (const m of clean.matchAll(/^(?:var|const)\s+([A-Z]\w*)/gm)) out.push(m[1]);
    return [...new Set(out)];
  },

  // type X …,以及 const 區塊裡的名字(iota 列舉)
  typeNames(src) {
    const clean = stripComments(src);
    const out = [];
    for (const m of clean.matchAll(/^type\s+([A-Za-z_]\w*)/gm)) out.push(m[1]);
    for (const m of clean.matchAll(/^type\s*\(([\s\S]*?)^\)/gm)) for (const t of m[1].matchAll(/^\s*([A-Za-z_]\w*)\s+\S/gm)) out.push(t[1]);
    for (const m of clean.matchAll(/^const\s*\(([\s\S]*?)^\)/gm)) for (const t of m[1].matchAll(/^\s*([A-Za-z_]\w*)/gm)) out.push(t[1]);
    for (const m of clean.matchAll(/^const\s+([A-Za-z_]\w*)/gm)) out.push(m[1]);
    return [...new Set(out)];
  },

  // 本體只有 panic("…")
  stubs(src) {
    const lines = stripComments(src).split('\n');
    const out = [];
    for (const d of declarations(src)) {
      const body = lines.slice(d.bodyStart, d.bodyStart + 4).join('\n');
      const open = body.indexOf('{');
      if (open < 0) continue;
      const inner = body.slice(open + 1).split('}')[0].trim();
      if (/^panic\s*\(/.test(inner) && inner.split('\n').filter((l) => l.trim()).length === 1) out.push(d.name);
    }
    return out;
  },

  imports(src) {
    const clean = stripComments(src);
    const out = [];
    let m;
    const block = /^import\s*\(([\s\S]*?)^\)/gm;
    while ((m = block.exec(clean))) for (const p of m[1].matchAll(/"([^"]+)"/g)) out.push(p[1]);
    const single = /^import\s+(?:[\w.]+\s+)?"([^"]+)"/gm;
    while ((m = single.exec(clean))) out.push(m[1]);
    return [...new Set(out)];
  },

  testMarkers(src) {
    return findMarkers(src);
  },

  // go test -v:`--- PASS: TestX/F-001#LAW-1 (0.00s)`
  testResults(log) {
    return scanLog(log, {
      verdict: (line) => {
        if (/---\s*FAIL:|^FAIL\b|\bpanic:/.test(line)) return 'red';
        if (/---\s*PASS:|^ok\s/.test(line)) return 'green';
        if (/---\s*SKIP:/.test(line)) return 'pending';
        return null;
      },
      reset: /^(FAIL\s|ok\s+\S+\s+\d|PASS$|=== RUN)/,
    });
  },
};
