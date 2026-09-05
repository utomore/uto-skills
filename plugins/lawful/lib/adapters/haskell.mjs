// Haskell adapter:.hs 檔的簽名、import、效果判定、測試歸屬標記。

const IO_MODULES = [
  'System.IO', 'System.IO.*', 'Data.IORef', 'Control.Concurrent', 'Control.Concurrent.*',
  'System.Process', 'System.Directory', 'System.Environment', 'System.Exit',
  'Network.*', 'Foreign.*', 'GHC.IO', 'GHC.IO.*', 'Data.Time.Clock', 'System.Random',
];

const STDLIB = [
  'id', 'const', 'fst', 'snd', 'not', 'null', 'length', 'sum', 'product', 'maximum', 'minimum',
  'map', 'filter', 'foldr', 'foldl', 'concat', 'concatMap', 'reverse', 'take', 'drop', 'elem',
  'notElem', 'lookup', 'zip', 'unzip', 'head', 'tail', 'last', 'init', 'all', 'any', 'and', 'or',
  'abs', 'signum', 'negate', 'min', 'max', 'succ', 'pred', 'fromIntegral', 'toInteger', 'round',
  'floor', 'ceiling', 'truncate', 'show', 'read', 'maybe', 'either', 'fmap', 'pure', 'return',
  'mempty', 'mappend', 'mconcat', 'sort', 'sortBy', 'nub', 'group', 'words', 'unwords', 'lines',
  'unlines', 'replicate', 'iterate', 'until', 'flip', 'curry', 'uncurry', 'seq', 'error',
  'undefined', 'compare', 'div', 'mod', 'quot', 'rem', 'even', 'odd', 'gcd', 'lcm', 'sqrt',
  'exp', 'log', 'sin', 'cos', 'floor', 'mapM', 'mapM_', 'sequence', 'traverse', 'foldMap',
  'toList', 'fromList', 'member', 'insert', 'delete', 'size', 'empty', 'singleton', 'union',
];

function stripComments(src) {
  let s = src.replace(/\{-[\s\S]*?-\}/g, (m) => m.replace(/[^\n]/g, ' '));
  return s.split(/\r?\n/).map((l) => l.replace(/(^|\s)--.*$/, '$1')).join('\n');
}

function normalize(t) {
  return t.replace(/\s+/g, ' ').trim();
}

function moduleOf(src, relPath) {
  const m = /^module\s+([A-Z][\w.']*)/m.exec(src);
  if (m) return m[1];
  return relPath.replace(/\.hs$/, '').split(/[\\/]/).filter((p) => /^[A-Z]/.test(p)).join('.');
}

export const haskell = {
  name: 'haskell',
  extensions: ['.hs'],
  stub: 'undefined',
  ioModules: IO_MODULES,
  stdlib: STDLIB,
  isTestFile(relPath) {
    const parts = relPath.split(/[\\/]/);
    return parts.some((p) => /^(test|tests|spec|specs)$/i.test(p)) || /Spec\.hs$/.test(relPath);
  },
  moduleName(src, relPath) {
    return moduleOf(src, relPath);
  },
  // [{ name, type, module, line }] 只取欄位 0 開頭的頂層簽名;多行合併、空白正規化。
  signatures(src, relPath) {
    const clean = stripComments(src);
    const lines = clean.split('\n');
    const mod = moduleOf(clean, relPath);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      // record 欄位:{ name :: Type 或 , name :: Type,也是函數
      if (/[{,]\s*[a-z_][\w']*\s*::/.test(lines[i]) && !/^[a-z_][\w']*\s*::/.test(lines[i])) {
        const re = /[{,]\s*([a-z_][\w']*(?:\s*,\s*[a-z_][\w']*)*)\s*::\s*([^,}]+)/g;
        let f;
        while ((f = re.exec(lines[i]))) {
          for (const name of f[1].split(',').map((s) => s.trim())) {
            out.push({ name, type: normalize(f[2]), module: mod, line: i + 1, field: true });
          }
        }
        continue;
      }
      let m = /^([a-z_][\w']*(?:\s*,\s*[a-z_][\w']*)*)\s*::(.*)$/.exec(lines[i]);
      let j = i + 1;
      if (!m) {
        // 名字單獨一行,:: 在下一行開頭
        const n = /^([a-z_][\w']*(?:\s*,\s*[a-z_][\w']*)*)\s*$/.exec(lines[i]);
        if (!n || !(j < lines.length && /^\s+::/.test(lines[j]))) continue;
        m = [null, n[1], lines[j].replace(/^\s+::/, '')];
        j++;
      }
      let type = m[2];
      while (j < lines.length && /^\s+\S/.test(lines[j])) {
        type += ' ' + lines[j];
        j++;
      }
      for (const name of m[1].split(',').map((s) => s.trim())) {
        out.push({ name, type: normalize(type), module: mod, line: i + 1 });
      }
      i = j - 1;
    }
    return out;
  },
  imports(src) {
    const clean = stripComments(src);
    const out = [];
    const re = /^import\s+(?:qualified\s+)?(?:"[^"]*"\s+)?([A-Z][\w.']*)/gm;
    let m;
    while ((m = re.exec(clean))) out.push(m[1]);
    return out;
  },
  isEffectful(type) {
    return /\bIO\b/.test(type);
  },
  // 測試檔裡字串字面值 "P-00x#LAW-n" / "P-00x#EX-n";只認字串,測試輸出才對得回來
  testMarkers(src) {
    const out = [];
    const re = /"(P-\d{3}#(?:LAW|EX)-\d+)"/g;
    let m;
    while ((m = re.exec(src))) out.push(m[1]);
    return out;
  },
  // 簽名文字的比對用正規化:同 signatures 的 type 欄。
  normalizeType: normalize,
  // 測試輸出 → Map<marker, 'green' | 'red' | 'pending'>。認 hspec(specdoc)與 tasty 兩種版面;
  // 標記可以是群組名(底下的項目算它的)或單一測試名(同一行帶結果)。
  testResults(log) {
    const clean = log.replace(/\x1b\[[0-9;]*m/g, '');
    const results = new Map();
    let current = null;
    let currentIndent = -1;
    const set = (m, v) => {
      const prev = results.get(m);
      if (v === 'red' || !prev || (prev === 'pending' && v === 'green')) results.set(m, v);
    };
    const verdictOf = (line) => {
      if (/\[✘\]|\bFAILED\b|:\s+FAIL\b/.test(line)) return 'red';
      if (/\[✔\]|:\s+OK\b/.test(line)) return 'green';
      if (/\[‐\]|# PENDING|:\s+SKIP\b/.test(line)) return 'pending';
      return null;
    };
    for (const raw of clean.split(/\r?\n/)) {
      const line = raw.replace(/\s+$/, '');
      if (/^(Failures:|Randomized with seed|Finished in|\d+ examples?|All \d+ tests passed|\d+ out of \d+ tests failed)/.test(line)) {
        current = null;
        continue;
      }
      const indent = line.search(/\S/);
      const marked = /^\s*(P-\d{3}#(?:LAW|EX)-\d+)\b(.*)$/.exec(line);
      if (marked) {
        const v = verdictOf(marked[2]);
        if (v) {
          set(marked[1], v);
          if (current && indent > currentIndent) set(current, v);
        } else {
          current = marked[1];
          currentIndent = indent;
        }
        continue;
      }
      if (current && indent > currentIndent) {
        const v = verdictOf(line);
        if (v) set(current, v);
        continue;
      }
      if (indent >= 0 && indent <= currentIndent) current = null;
      const fail = /^\s*\d+\)\s+(P-\d{3}#(?:LAW|EX)-\d+)/.exec(line);
      if (fail) set(fail[1], 'red');
    }
    return results;
  },
};
