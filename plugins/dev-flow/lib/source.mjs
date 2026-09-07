// 走原始碼樹,透過 adapter 讀出每個檔案的簽名、import、型別名、stub、測試標記。
// 模組的身分是「相對專案根目錄的檔案路徑」——package / crate / dotted module 各語言不一致,路徑一致。
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['.git', '.design', 'node_modules', 'dist', 'build', 'target', 'vendor', '__pycache__', '.venv', 'venv', '.next', 'coverage', 'spike']);

function walk(dir, exts, out, root, ignore) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      const relDir = path.relative(root, path.join(dir, ent.name)).split(path.sep).join('/');
      if (ignore.includes(relDir) || ignore.includes(ent.name)) continue;
      walk(path.join(dir, ent.name), exts, out, root, ignore);
    } else if (exts.some((e) => ent.name.endsWith(e))) {
      const abs = path.join(dir, ent.name);
      out.push({ abs, rel: path.relative(root, abs).split(path.sep).join('/') });
    }
  }
}

// import 的目標解析成專案內的路徑,解不到就原樣留著當外部套件(IO 模組黑名單就是拿它比的)。
//   ./x ../x          → 路徑相加,再補副檔名或 /index
//   a/b、a.b、a::b    → 至少兩段才解;拿它的尾段去對專案裡的檔案與資料夾,最長的贏
// 單段的(os、fmt、react)一律當外部:專案裡剛好有同名檔案的機率遠低於誤判的代價。
function makeResolver(known, dirs, exts) {
  return (spec, fromFile) => {
    if (/^\.{1,2}\//.test(spec)) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
      const candidates = [base, ...exts.map((e) => base + e), ...exts.map((e) => `${base}/index${e}`), ...exts.map((e) => `${base}/mod${e}`), ...exts.map((e) => `${base}/__init__${e}`)];
      for (const c of candidates) if (known.has(c)) return c;
      return dirs.has(base) ? base : base;
    }
    const parts = spec.replace(/::/g, '/').replace(/\./g, '/').split('/').filter(Boolean);
    if (parts.length < 2) return spec;
    for (let start = 0; start < parts.length - 1; start++) {
      const tail = parts.slice(start).join('/');
      for (const e of exts) if (known.has(tail + e)) return tail + e;
      if (known.has(tail)) return tail;
      if (dirs.has(tail)) return tail;
    }
    return spec;
  };
}

// { files: Map<relPath, {...}>, dirs: Set<relPath>, testFiles: [{file, markers}] }
export function readSource(root, adapter, ignore = []) {
  const found = [];
  walk(root, adapter.extensions, found, root, ignore);
  const known = new Set(found.map((f) => f.rel));
  const dirs = new Set();
  for (const f of found) {
    let d = path.posix.dirname(f.rel);
    while (d && d !== '.') {
      dirs.add(d);
      d = path.posix.dirname(d);
    }
  }
  const resolve = makeResolver(known, dirs, adapter.extensions);

  const files = new Map();
  const testFiles = [];
  for (const f of found) {
    const src = fs.readFileSync(f.abs, 'utf8');
    const markers = adapter.testMarkers(src);
    const isTest = adapter.isTestFile(f.rel, src);
    // 標記可以住在產品檔裡(Rust 的 #[cfg(test)] mod),那個檔仍然要讀簽名
    if (isTest || markers.length) testFiles.push({ file: f.rel, markers, inline: !isTest });
    if (isTest) continue;
    const rawImports = adapter.imports(src, f.rel);
    files.set(f.rel, {
      file: f.rel,
      rawImports,
      imports: rawImports.map((s) => resolve(s, f.rel)),
      signatures: adapter.signatures(src, f.rel),
      exports: adapter.exports ? adapter.exports(src, f.rel) : null,
      typeNames: adapter.typeNames ? adapter.typeNames(src) : [],
      stubs: new Set(adapter.stubs ? adapter.stubs(src) : []),
    });
  }
  return { files, dirs, testFiles };
}

// 命中帶兩個程式碼事實:exported(匯出清單有它;沒有匯出概念的語言算 true)、stub(本體還是骨架)。
export function findSignature(source, name) {
  const hits = [];
  for (const m of source.files.values()) {
    for (const s of m.signatures) {
      if (s.name !== name) continue;
      const ex = m.exports;
      hits.push({ ...s, file: m.file, exported: ex === null || ex.includes(name) || ex.includes(name.split('.')[0]), stub: m.stubs.has(name) });
    }
  }
  return hits;
}

export function findType(source, typeName) {
  const hits = [];
  for (const m of source.files.values()) if (m.typeNames.includes(typeName)) hits.push({ file: m.file });
  return hits;
}

export function allTypeNames(source) {
  const out = new Set();
  for (const m of source.files.values()) for (const t of m.typeNames) out.add(t);
  return out;
}
