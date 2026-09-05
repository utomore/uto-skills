// 走原始碼樹,透過 adapter 讀出模組、簽名、import、測試標記。
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['.git', '.design', 'node_modules', 'dist-newstyle', '.stack-work', 'spike', 'dist', 'target', '.cabal-sandbox']);

function walk(dir, exts, out, root) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(path.join(dir, ent.name), exts, out, root);
    } else if (exts.some((e) => ent.name.endsWith(e))) {
      const abs = path.join(dir, ent.name);
      out.push({ abs, rel: path.relative(root, abs).split(path.sep).join('/') });
    }
  }
}

// { modules: Map<name, {module, file, layerHint, imports, signatures}>, testFiles: [{file, markers}] }
export function readSource(root, adapter) {
  const files = [];
  walk(root, adapter.extensions, files, root);
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
    });
  }
  return { modules, testFiles };
}

export function findSignature(source, name) {
  const hits = [];
  for (const m of source.modules.values()) {
    for (const s of m.signatures) if (s.name === name) hits.push({ ...s, file: m.file });
  }
  return hits;
}
