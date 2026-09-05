// Markdown 讀取:frontmatter、## 節、表格、清單。不認識任何 lawful 概念。

export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { fm: {}, body: text, hasFrontmatter: false };
  const fm = {};
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) {
      v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    }
    fm[kv[1]] = v;
  }
  return { fm, body: text.slice(m[0].length), hasFrontmatter: true };
}

// 回傳 [{ title, level, lines, start }];圍欄裡的 # 不算標題。
export function sections(body) {
  const lines = body.split(/\r?\n/);
  const out = [];
  let cur = { title: '', level: 0, lines: [], start: 0 };
  let fence = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) fence = !fence;
    const h = !fence && /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (h) {
      out.push(cur);
      cur = { title: h[2], level: h[1].length, lines: [], start: i };
    } else {
      cur.lines.push(line);
    }
  });
  out.push(cur);
  return out;
}

export function findSection(secs, title, level = 2) {
  return secs.find((s) => s.level === level && s.title === title) || null;
}

// 切一列表格:認 \| 跳脫,反引號裡的 | 不切。
export function splitRow(line) {
  const cells = [];
  let cur = '';
  let tick = false;
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (c === '`') {
      tick = !tick;
      cur += c;
    } else if (c === '|' && !tick) {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  cells.push(cur.trim());
  return cells;
}

// 第一張表:{ header, rows, rowLines }。沒有表回 null。
export function parseTable(lines) {
  let i = lines.findIndex((l) => /^\s*\|/.test(l));
  if (i < 0) return null;
  const header = splitRow(lines[i]);
  i++;
  if (i < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i])) i++;
  const rows = [];
  const rowLines = [];
  for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
    rows.push(splitRow(lines[i]));
    rowLines.push(i);
  }
  return { header, rows, rowLines };
}

export function stripTicks(s) {
  return s.replace(/^`|`$/g, '').trim();
}

// 頂層清單項與其子項:[{ text, children: [text] }]
export function parseList(lines) {
  const items = [];
  for (const line of lines) {
    const top = /^- (.*)$/.exec(line);
    const sub = /^\s{2,}- (.*)$/.exec(line);
    if (top) items.push({ text: top[1].trim(), children: [] });
    else if (sub && items.length) items[items.length - 1].children.push(sub[1].trim());
  }
  return items;
}
