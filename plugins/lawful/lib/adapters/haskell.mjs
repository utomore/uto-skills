// Haskell adapter:.hs 檔的簽名、import、效果判定、測試歸屬標記。

// 純層不准 import 的模組:繞過型別系統的逃生口(unsafePerformIO、trace、FFI)與只有效果的模組。
// 有純 API 的模組(System.Random 的 StdGen、Data.Time 的 UTCTime)不在這裡;它們的效果由簽名上的效果型別擋。
const IO_MODULES = [
  'System.IO', 'System.IO.*', 'GHC.IO', 'GHC.IO.*', 'Debug.Trace', 'Foreign.*',
  'Data.IORef', 'Control.Concurrent', 'Control.Concurrent.*', 'Control.Monad.STM', 'Control.Concurrent.STM.*',
  'System.Process', 'System.Directory', 'System.Environment', 'System.Exit', 'Network.*',
];

// 簽名裡出現就算碰到效果:IO 本身、mtl 的 MonadIO 家族、effectful 的 IOE、STM 與可變參考。
// 效果系統的描述型別(Eff es、Sem r、Free f)不算:它們是純資料,住 effects 層。
const EFFECT_TYPES = ['IO', 'IOE', 'MonadIO', 'MonadUnliftIO', 'STM', 'IORef', 'MVar', 'TVar', 'TMVar', 'Chan'];

const STDLIB = [
  'id', 'const', 'fst', 'snd', 'not', 'null', 'length', 'sum', 'product', 'maximum', 'minimum',
  'map', 'filter', 'foldr', 'foldl', 'concat', 'concatMap', 'reverse', 'take', 'drop', 'elem',
  'notElem', 'lookup', 'zip', 'zipWith', 'unzip', 'head', 'tail', 'last', 'init', 'all', 'any', 'and', 'or',
  'abs', 'signum', 'negate', 'min', 'max', 'succ', 'pred', 'fromIntegral', 'toInteger', 'round',
  'floor', 'ceiling', 'truncate', 'show', 'read', 'maybe', 'either', 'fmap', 'pure', 'return',
  'mempty', 'mappend', 'mconcat', 'sort', 'sortBy', 'sortOn', 'nub', 'group', 'words', 'unwords', 'lines',
  'unlines', 'replicate', 'iterate', 'until', 'flip', 'curry', 'uncurry', 'seq', 'error',
  'undefined', 'compare', 'div', 'mod', 'quot', 'rem', 'even', 'odd', 'gcd', 'lcm', 'sqrt',
  'exp', 'log', 'sin', 'cos', 'mapM', 'mapM_', 'sequence', 'traverse', 'foldMap',
  'toList', 'fromList', 'member', 'insert', 'delete', 'size', 'empty', 'singleton', 'union',
  'isJust', 'isNothing', 'fromMaybe', 'catMaybes', 'mapMaybe', 'isLeft', 'isRight', 'lefts', 'rights',
  'partition', 'span', 'splitAt', 'takeWhile', 'dropWhile', 'elemIndex', 'find', 'isPrefixOf', 'isSuffixOf', 'isInfixOf',
  'on', 'fix', 'force', 'total',
];

// module 行的匯出清單:null = 沒寫匯出清單(整個模組都匯出);否則是名字的清單。
// `Foo (..)` 收 Foo;`(<+>)` 收 <+>;`module X` 收 module:X。
function exportList(clean) {
  const m = /^module\s+[A-Z][\w.']*\s*/m.exec(clean);
  if (!m) return null;
  let i = m.index + m[0].length;
  if (clean[i] !== '(') return null;
  let depth = 0;
  let j = i;
  for (; j < clean.length; j++) {
    if (clean[j] === '(') depth++;
    else if (clean[j] === ')' && --depth === 0) break;
  }
  // 只切最外層的逗號;型別後面的 (..) / (A, b) 是建構子與欄位清單
  const items = [];
  let cur = '';
  depth = 0;
  for (const c of clean.slice(i + 1, j)) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (c === ',' && depth === 0) {
      items.push(cur);
      cur = '';
    } else cur += c;
  }
  items.push(cur);
  const out = [];
  for (const raw of items) {
    const item = raw.trim();
    if (!item) continue;
    const mod = /^module\s+([A-Z][\w.']*)/.exec(item);
    if (mod) {
      out.push(`module:${mod[1]}`);
      continue;
    }
    const op = /^\(\s*([^\s()]+)\s*\)/.exec(item);
    if (op) {
      out.push(op[1]);
      continue;
    }
    const name = /^(?:type\s+|pattern\s+)?([A-Za-z_][\w']*)\s*(?:\(([^)]*)\))?/.exec(item);
    if (!name) continue;
    out.push(name[1]);
    if (name[2] !== undefined) {
      const inner = name[2].trim();
      if (inner === '..') out.push(`${name[1]}(..)`);
      else for (const sub of inner.split(',').map((s) => s.trim()).filter(Boolean)) out.push(sub.replace(/^\(|\)$/g, ''));
    }
  }
  return out;
}

function stripComments(src) {
  let s = src.replace(/\{-[\s\S]*?-\}/g, (m) => m.replace(/[^\n]/g, ' '));
  return s.split(/\r?\n/).map((l) => l.replace(/(^|\s)--.*$/, '$1')).join('\n');
}

function normalize(t) {
  return t.replace(/\s+/g, ' ').trim();
}

// 一行裡的 record 欄位:{ a :: T, b :: U } 或 , c :: [(X, Y)];型別讀到同層的 , 或 } 為止,括號裡的逗號不切。
function recordFields(line) {
  const out = [];
  const re = /[{,]\s*([a-z_][\w']*(?:\s*,\s*[a-z_][\w']*)*)\s*::\s*/g;
  let m;
  while ((m = re.exec(line))) {
    let depth = 0;
    let j = m.index + m[0].length;
    let type = '';
    for (; j < line.length; j++) {
      const c = line[j];
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      if (depth < 0 || (depth === 0 && (c === ',' || c === '}'))) break;
      type += c;
    }
    if (type.trim()) out.push([m[1], type]);
    re.lastIndex = j;
  }
  return out;
}

function moduleOf(src, relPath) {
  const m = /^module\s+([A-Z][\w.']*)/m.exec(src);
  if (m) return m[1];
  return relPath.replace(/\.hs$/, '').split(/[\\/]/).filter((p) => /^[A-Z]/.test(p)).join('.');
}

export const haskell = {
  name: 'haskell',
  extensions: ['.hs'],
  // 骨架的本體:錯誤訊息帶著 stage 的引用,基線的紅燈才看得出打到哪個 stub。
  stub: (marker) => `error "${marker} stub"`,
  ioModules: IO_MODULES,
  effectTypes: EFFECT_TYPES,
  stdlib: STDLIB,
  // 匯出清單:null = 沒寫(全部匯出);否則名字清單(型別、函數、運算子、module:X)。
  exports(src) {
    return exportList(stripComments(src));
  },
  // 欄位 0 宣告的型別名:data / newtype / type / class。
  typeNames(src) {
    const out = [];
    const re = /^(?:data|newtype|type|class)\s+(?:\([^)]*\)\s*=>\s*)?(?:[A-Z][\w.']*\s*=>\s*)?(?:family\s+)?([A-Z][\w']*)/gm;
    let m;
    while ((m = re.exec(stripComments(src)))) out.push(m[1]);
    return out;
  },
  // 本體還是骨架的頂層名字:等號右邊只有 undefined,或只有一個 error 呼叫。
  stubs(src) {
    const out = [];
    const re = /^([a-z_][\w']*|\([^()\s]+\))(?:\s+[\w'_]+|\s+_)*\s*=\s*(?:undefined|error\s+"[^"]*")\s*$/gm;
    let m;
    while ((m = re.exec(stripComments(src)))) out.push(m[1]);
    return out;
  },
  isTestFile(relPath) {
    const parts = relPath.split(/[\\/]/);
    return parts.some((p) => /^(test|tests|spec|specs)$/i.test(p)) || /Spec\.hs$/.test(relPath);
  },
  moduleName(src, relPath) {
    return moduleOf(src, relPath);
  },
  // [{ name, type, module, line, field?, klass? }]
  // 認三種簽名:欄位 0 的頂層簽名(含運算子 (<+>)、多行、名字單獨一行)、record 欄位、class 底下的方法。
  // 不認:instance 底下的方法(沒有新簽名)、函數本體 where 底下的區域函數(私有)、GADT 建構子(大寫)。
  signatures(src, relPath) {
    const clean = stripComments(src);
    const lines = clean.split('\n');
    const mod = moduleOf(clean, relPath);
    const out = [];
    const NAME = "(?:[a-z_][\\w']*|\\([^()\\s]+\\))";
    const NAMES = `(${NAME}(?:\\s*,\\s*${NAME})*)`;
    const sigRe = new RegExp(`^${NAMES}\\s*::(.*)$`);
    const nameOnlyRe = new RegExp(`^${NAMES}\\s*$`);
    const methodRe = new RegExp(`^(\\s+)${NAMES}\\s*::(.*)$`);
    let block = null; // 'class' | 'instance' | 'other' | null:目前在哪種欄位 0 宣告的縮排區塊裡
    let klass = null;
    let record = null; // 最近一個 data / newtype 宣告:{ head },record 欄位的存取子型別是 head -> 欄位型別
    const pushNames = (names, type, line, extra = {}) => {
      for (const name of names.split(',').map((s) => s.trim())) out.push({ name, type: normalize(type), module: mod, line, ...extra });
    };
    const pushFields = (line, i) => {
      for (const [names, raw] of recordFields(line)) {
        const type = raw.trim().replace(/^!\s*/, ''); // 嚴格標記 ! 不屬於存取子的型別
        pushNames(names, record ? `${record.head} -> ${type}` : type, i + 1, { field: true, record: record ? record.head.split(' ')[0] : null });
      }
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\S/.test(line)) {
        // 欄位 0:重設區塊狀態
        const c = /^class\b(.*)$/.exec(line);
        if (c) {
          block = 'class';
          const nm = /\b([A-Z][\w']*)\s+[a-z]/.exec(c[1].replace(/^.*=>/, ''));
          klass = nm ? nm[1] : null;
          continue;
        }
        if (/^instance\b/.test(line)) {
          block = 'instance';
          continue;
        }
        block = 'other';
        const d = /^(?:data|newtype)\s+(?:\([^)]*\)\s*=>\s*)?([A-Z][\w']*(?:\s+(?:[a-z][\w']*|\([^)]*\)))*)/.exec(line);
        record = d ? { head: d[1].replace(/\s*\([^)]*\)/g, (p) => ' ' + p.trim().replace(/^\(([a-z][\w']*).*$/, '$1')).replace(/\s+/g, ' ').trim() } : null;
      } else if (block === 'class') {
        let mm = methodRe.exec(line);
        let j = i + 1;
        if (!mm) {
          // 方法名單獨一行,:: 在下一行
          const n = new RegExp(`^(\\s+)${NAMES}\\s*$`).exec(line);
          if (n && j < lines.length && /^\s+::/.test(lines[j]) && lines[j].search(/\S/) > n[1].length) {
            mm = [null, n[1], n[2], lines[j].replace(/^\s+::/, '')];
            j++;
          }
        }
        if (mm) {
          const indent = mm[1].length;
          let type = mm[3];
          while (j < lines.length && /^\s+\S/.test(lines[j]) && lines[j].search(/\S/) > indent) {
            type += ' ' + lines[j];
            j++;
          }
          pushNames(mm[2], type, i + 1, { klass });
          i = j - 1;
        }
        continue;
      } else {
        // instance 本體、函數 where 區塊、接續行:不是新簽名。record 欄位除外。
        if (block === 'instance') continue;
        pushFields(line, i);
        continue;
      }
      // 欄位 0 的一般宣告
      if (/[{,]\s*[a-z_][\w']*\s*::/.test(line) && !sigRe.test(line)) {
        pushFields(line, i);
        continue;
      }
      let m = sigRe.exec(line);
      let j = i + 1;
      if (!m) {
        const n = nameOnlyRe.exec(line);
        if (!n || !(j < lines.length && /^\s+::/.test(lines[j]))) continue;
        m = [null, n[1], lines[j].replace(/^\s+::/, '')];
        j++;
      }
      let type = m[2];
      while (j < lines.length && /^\s+\S/.test(lines[j])) {
        type += ' ' + lines[j];
        j++;
      }
      pushNames(m[1], type, i + 1);
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
  // extra:system.md「效果型別追加」。
  isEffectful(type, extra = []) {
    const names = [...EFFECT_TYPES, ...extra].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`(?<![\\w.'])(?:${names.join('|')})(?![\\w'])`).test(type);
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
