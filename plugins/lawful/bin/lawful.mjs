#!/usr/bin/env node
// lawful:純函數式 SDD 的單一 CLI。在有 .design/ 的專案根目錄執行。
import path from 'node:path';
import process from 'node:process';
import { readDesign } from '../lib/design.mjs';
import { readSource } from '../lib/source.mjs';
import { pickAdapter, adapterNames } from '../lib/adapters/index.mjs';
import { lintAll, lintBoundary, lintLaws, lintSig, lintTrace, renderLint } from '../lib/commands/lint.mjs';
import { sectionCommand } from '../lib/commands/section.mjs';

const HELP = `lawful <子命令> [選項]

  lint boundary            import 與簽名 vs 模組表
  lint sig                 Stages 簽名 vs 程式碼簽名,逐字;願望 stage 列待實作;同層搬家列出
  lint laws                三行齊全、種類合法、|- 的識別字對得到、example 指得到 law
  lint trace               laws / examples ↔ 測試歸屬
  lint all                 以上全部
  section <file> <節>…     取 ## 節;--verify 只檢查在不在

選項
  --root <dir>             專案根目錄(預設目前目錄)

exit code:lint 通過 0、有不合規 1;section 全部找到 0、否則 1。
adapter:${adapterNames.join(', ')};system.md 的 language 欄選。`;

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args.flags[k] = next;
        i++;
      } else args.flags[k] = true;
    } else args._.push(a);
  }
  return args;
}

function loadProject(root) {
  const design = readDesign(root);
  if (!design) return { error: `${root} 底下沒有 .design/` };
  const language = design.system ? design.system.language : null;
  const adapter = pickAdapter(language);
  const notes = [];
  if (!design.system) notes.push('缺 .design/system.md');
  else if (!language) notes.push('system.md 沒有 language 欄,簽名與邊界不對帳');
  else if (!adapter) notes.push(`此語言尚無 adapter(${language}),lint sig 與 lint boundary 跳過`);
  const source = adapter ? readSource(root, adapter) : null;
  return { design, adapter, source, notes };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const [cmd, sub, ...rest] = args._;
  const root = path.resolve(args.flags.root || process.cwd());

  if (!cmd || cmd === 'help' || args.flags.help) {
    console.log(HELP);
    return 0;
  }

  if (cmd === 'section') {
    if (!sub || !rest.length) {
      console.error('用法:lawful section <file> <節>… [--verify]');
      return 1;
    }
    const r = sectionCommand(path.resolve(root, sub), rest, { verify: !!args.flags.verify, display: sub });
    console.log(r.text);
    return r.exitCode;
  }

  if (cmd === 'lint') {
    const which = sub || 'all';
    const p = loadProject(root);
    if (p.error) {
      console.error(p.error);
      return 1;
    }
    const { design, adapter, source, notes } = p;
    let results;
    const needsAdapter = { boundary: lintBoundary, sig: lintSig, laws: lintLaws, trace: lintTrace };
    if (which === 'all') results = lintAll(design, source, adapter);
    else if (needsAdapter[which]) results = [needsAdapter[which](design, source, adapter)];
    else {
      console.error(`lint 只有 boundary / sig / laws / trace / all,沒有「${which}」`);
      return 1;
    }
    const out = renderLint(results);
    if (notes.length) console.log(notes.map((n) => `· ${n}`).join('\n') + '\n');
    console.log(out.text);
    return out.exitCode;
  }

  console.error(`沒有「${cmd}」這個子命令。\n\n${HELP}`);
  return 1;
}

process.exitCode = main();
