// 測試歸屬標記與測試輸出的共用解析。
//
// 標記有兩種寫法,同一個意思:
//   字串形式   "F-001#LAW-1"      —— 測試名可以是任意字串的框架(JS 的 describe / it、Go 的 t.Run)
//   識別字形式 f_001__law_1        —— 測試名必須是識別字的框架(Python 的 def、Rust 的 fn);大小寫不拘
// 兩種都正規化成字串形式,測試輸出與原始碼才對得回同一個 key。

const STRING_RE = /\b([FA])-(\d{3})#(LAW|EX)-(\d+)\b/g;
// 前面可以有底線(`test_f_001__law_1_…` 是最常見的寫法),但不能是字母或數字
const IDENT_RE = /(?<![A-Za-z0-9])([FfAa])_(\d{3})__(law|LAW|ex|EX)_(\d+)(?![0-9])/g;

export function normalizeMarker(kind, num, sort, n) {
  return `${kind.toUpperCase()}-${num}#${sort.toUpperCase()}-${n}`;
}

// 一段文字裡的所有標記,兩種寫法都收。
export function findMarkers(text) {
  const out = [];
  for (const re of [STRING_RE, IDENT_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) out.push(normalizeMarker(m[1], m[2], m[3], m[4]));
  }
  return out;
}

// 一行裡的第一個標記;沒有回 null。
export function markerIn(line) {
  const hits = findMarkers(line);
  return hits.length ? hits[0] : null;
}

// 掃測試輸出 → Map<marker, 'green' | 'red' | 'pending'>。
//
// verdict(line) 回這一行自己的結果;帶標記的行如果自己沒有結果,就當成群組名,
// 底下縮排更深的行的結果算它的(jest 的 describe、Go 的父測試都是這個版面)。
// reset 命中的行結束目前群組(統計行、失敗詳情區的開頭)。
export function scanLog(log, { verdict, reset }) {
  const clean = log.replace(/\x1b\[[0-9;]*m/g, '');
  const results = new Map();
  let current = null;
  let currentIndent = -1;
  const set = (m, v) => {
    const prev = results.get(m);
    // 紅永遠贏:同一個標記翻成好幾條測試時,一條紅就是紅
    if (v === 'red' || !prev || (prev === 'pending' && v === 'green')) results.set(m, v);
  };
  for (const raw of clean.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (reset && reset.test(line)) {
      current = null;
      currentIndent = -1;
    }
    const indent = line.search(/\S/);
    const mk = markerIn(line);
    if (mk) {
      const v = verdict(line);
      if (v) {
        set(mk, v);
        if (current && indent > currentIndent) set(current, v);
      } else {
        current = mk;
        currentIndent = indent;
      }
      continue;
    }
    if (current && indent > currentIndent) {
      const v = verdict(line);
      if (v) set(current, v);
      continue;
    }
    if (indent >= 0 && indent <= currentIndent) {
      current = null;
      currentIndent = -1;
    }
  }
  return results;
}

// 各語言共用的參數切法:逗號切到頂層為止,泛型與括號裡的逗號不切。
export function splitArgs(inner) {
  const out = [];
  let depth = 0;
  let cur = '';
  let quote = null;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (quote) {
      cur += c;
      if (c === quote && inner[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      cur += c;
      continue;
    }
    if ('([{<'.includes(c)) depth++;
    else if (')]}>'.includes(c)) depth--;
    if (c === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// 從 open 位置的括號找到配對的右括號;找不到回 -1。
export function matchParen(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
