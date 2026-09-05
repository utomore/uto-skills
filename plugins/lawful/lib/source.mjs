// 走原始碼樹,透過 adapter 讀出模組、簽名、import、測試標記。
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['.git', '.lawful', '.design', 'node_modules', 'dist-newstyle', '.stack-work', 'spike', 'dist', 'target', '.cabal-sandbox']);

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

// { modules: Map<name, {module, file, layerHint, imports, signatures}>, testFiles: [{file, markers}] }
// ignore:system.md「忽略目錄」列的相對路徑或目錄名
export function readSource(root, adapter, ignore = []) {
  const files = [];
  walk(root, adapter.extensions, files, root, ignore);
  const modules = new Map();
  const testFiles = [];
  for (const f of files) {
    const src = fs.readFileSync(f.abs, 'utf8');
    if (adapter.isTestFile(f.rel)) {
      testFiles.push({ file: f.rel, markers: adapter.testMarkers(src) });
      continue;
    }
    const name = adapter.moduleName(src, f.rel);
    modules.set(name, {
      module: name,
      file: f.rel,
      imports: adapter.imports(src),
      signatures: adapter.signatures(src, f.rel),
      exports: adapter.exports ? adapter.exports(src) : null,
      typeNames: adapter.typeNames ? adapter.typeNames(src) : [],
      stubs: new Set(adapter.stubs ? adapter.stubs(src) : []),
    });
  }
  return { modules, testFiles };
}

// 命中帶三個程式碼事實:exported(匯出清單有它;沒寫匯出清單算 true)、stub(本體還是骨架)。
export function findSignature(source, name) {
  const hits = [];
  for (const m of source.modules.values()) {
    for (const s of m.signatures) {
      if (s.name !== name) continue;
      const ex = m.exports;
      const bare = name.replace(/^\(|\)$/g, '');
      const exported = ex === null || ex.includes(bare) || (s.klass ? ex.includes(`${s.klass}(..)`) : false) || (s.record ? ex.includes(`${s.record}(..)`) : false);
      hits.push({ ...s, file: m.file, exported, stub: m.stubs.has(name) });
    }
  }
  return hits;
}

// 型別名住在哪個模組:[{ module, file }]
export function findType(source, typeName) {
  const hits = [];
  for (const m of source.modules.values()) if (m.typeNames.includes(typeName)) hits.push({ module: m.module, file: m.file });
  return hits;
}
