#!/usr/bin/env node
// lawful:純函數式 SDD 的單一 CLI。在有 .design/ 的專案根目錄執行。
import path from 'node:path';
import process from 'node:process';
import { readDesign } from '../lib/design.mjs';
import { readSource } from '../lib/source.mjs';
import { pickAdapter, adapterNames } from '../lib/adapters/index.mjs';
import { lintAll, lintBoundary, lintLaws, lintSig, lintTrace, renderLint } from '../lib/commands/lint.mjs';
import { sectionCommand } from '../lib/commands/section.mjs';
import { loadResults, moduleDetail, pipelineDetail, statusReport } from '../lib/commands/status.mjs';
import { claim, modulesGen, spikeClose, sync } from '../lib/commands/edit.mjs';
import { migrateFromDevFlow } from '../lib/commands/migrate.mjs';

const HELP = `lawful <子命令> [選項]

  status [--tests <log> | --run]       派工報告;laws 綠幾條要給測試輸出,或 --run 跑 system.md 的整套指令
  status --pipeline <P-00x | 全名>     一條 pipeline 的 stage 與 law 逐條狀態
  status --module <模組>               住在該模組的所有 stage 的狀態
  claim <slug> [--description <句>]    鑄號建 pipeline 檔(status: draft),system.md Pipelines 表加一列
  lint boundary | sig | laws | trace | all
  sync                                 同層搬家的 stage,模組欄改成程式碼的模組
  modules --gen                        從程式碼補模組表缺的模組,層欄留白
  section <file> <節>… [--verify]      取 ## 節
  spike close <SPK-00x> [--dry-run]    檢查 verdict / feeds / sha 齊全,刪 spike/SPK-00x-<slug>/
  migrate from-dev-flow <.design> [--write <file>] [--ignore <dir,dir>] [--language <adapter>]
                                       盤點 subsystems/ 體系的 .design:每份 F / E / G-F 的介面在程式碼裡對到幾條、
                                       四格 law 翻成三行草稿、按模組建議怎麼合成 pipeline、開發階段對到里程碑;只印帳本,不改任何檔

選項
  --root <dir>                         專案根目錄(預設目前目錄)
  --date <YYYY-MM-DD>                  claim / sync 寫進檔的日期(預設今天)

exit code:status 盤點 = 全部達成 0、否則 1;--pipeline / --module = 查得到 0;lint 通過 0、有不合規 1。
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
  const source = adapter ? readSource(root, adapter, design.system ? design.system.ignoreDirs : []) : null;
  return { design, adapter, source, notes };
}

function emit(r) {
  if (r.text) console.log(r.text);
  return r.exitCode;
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
    return emit(sectionCommand(path.resolve(root, sub), rest, { verify: !!args.flags.verify, display: sub }));
  }

  if (cmd === 'migrate') {
    if (sub !== 'from-dev-flow' || !rest[0]) {
      console.error('用法:lawful migrate from-dev-flow <.design 路徑> [--write <file>] [--root <專案根目錄>]');
      return 1;
    }
    const ignore = typeof args.flags.ignore === 'string' ? args.flags.ignore.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const r = migrateFromDevFlow(path.resolve(root, rest[0]), root, { write: typeof args.flags.write === 'string' ? path.resolve(root, args.flags.write) : null, language: typeof args.flags.language === 'string' ? args.flags.language : null, ignore });
    return emit(r);
  }

  const p = loadProject(root);
  if (p.error) {
    console.error(p.error);
    return 1;
  }
  const { design, adapter, source, notes } = p;
  if (notes.length) console.log(notes.map((n) => `· ${n}`).join('\n') + '\n');

  if (cmd === 'lint') {
    const which = sub || 'all';
    const one = { boundary: lintBoundary, sig: lintSig, laws: lintLaws, trace: lintTrace };
    let results;
    if (which === 'all') results = lintAll(design, source, adapter);
    else if (one[which]) results = [one[which](design, source, adapter)];
    else {
      console.error(`lint 只有 boundary / sig / laws / trace / all,沒有「${which}」`);
      return 1;
    }
    return emit(renderLint(results));
  }

  if (cmd === 'status') {
    const testsFlag = args.flags.tests ? path.resolve(root, args.flags.tests) : null;
    const { results, note: rawNote } = loadResults(design, adapter, { tests: testsFlag, run: !!args.flags.run }, root);
    const note = testsFlag ? rawNote.replace(testsFlag, args.flags.tests) : rawNote;
    if (args.flags.pipeline) return emit(pipelineDetail(design, source, adapter, results, note, args.flags.pipeline));
    if (args.flags.module) return emit(moduleDetail(design, source, adapter, results, note, args.flags.module));
    return emit(statusReport(design, source, adapter, results, note));
  }

  if (cmd === 'claim') {
    if (!sub) {
      console.error('用法:lawful claim <slug> [--description <句>]');
      return 1;
    }
    return emit(claim(design, sub, { description: typeof args.flags.description === 'string' ? args.flags.description : '', date: args.flags.date || undefined }));
  }

  if (cmd === 'sync') return emit(sync(design, source, adapter, { date: args.flags.date || undefined }));

  if (cmd === 'modules') {
    if (!args.flags.gen) {
      console.error('用法:lawful modules --gen');
      return 1;
    }
    return emit(modulesGen(design, source));
  }

  if (cmd === 'spike') {
    if (sub !== 'close' || !rest[0]) {
      console.error('用法:lawful spike close <SPK-00x> [--dry-run]');
      return 1;
    }
    return emit(spikeClose(design, rest[0], { dryRun: !!args.flags['dry-run'] }));
  }

  console.error(`沒有「${cmd}」這個子命令。\n\n${HELP}`);
  return 1;
}

process.exitCode = main();
