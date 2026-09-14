#!/usr/bin/env node
// lawful:純函數式專案的 spec 驅動開發 CLI。全部從 .lawful/、程式碼與測試輸出推。
import path from 'node:path';
import process from 'node:process';
import { readDesign } from '../lib/design.mjs';
import { readSource } from '../lib/source.mjs';
import { pickAdapter, adapterNames } from '../lib/adapters/index.mjs';
import { lintAll, lintBoundary, lintIo, lintLaws, lintSig, lintTrace, renderLint } from '../lib/commands/lint.mjs';
import { sectionCommand } from '../lib/commands/section.mjs';
import { branchState, loadResults, moduleDetail, pipelineDetail, statusReport } from '../lib/commands/status.mjs';
import { statusBoard, statusJson } from '../lib/commands/board.mjs';
import { claim, milestoneAdd, moduleAdd, modulesGen, objectiveAdd, refinementAdd, rename, requirementAdd, spikeClose, sync } from '../lib/commands/edit.mjs';
import { migrateCone, migrateFromDevFlow } from '../lib/commands/migrate.mjs';

const HELP = `lawful <子命令> [選項]

子命令
  status [--tests <log> | --run]        派工報告:需求 Law 成立與否、目標 Law 與里程碑完成度、每條 pipeline 的完成度、
                                       能開的線、卡住的、警訊、建議路線。laws 綠幾條要有測試輸出:--tests 給留檔的輸出,
                                       --run 在專案根目錄跑 Cone.md「專案約束」的整套指令
  status --pipeline <P-00x> | --module <M>
                                       一條 pipeline 的 stage 與 law 逐條狀態 / 住在該模組(或模組單元)的所有 stage
  status --json                        同一份報告的資料原樣輸出,給別的工具讀
  status --html [檔名] [--open]        報告照印,另外把同一份資料畫成看板(單檔網頁);沒給檔名寫進系統暫存區,不在專案裡留檔
  module <名稱> [--layers <types,effect,core,shell>] [--responsibility <句>] [--facade [層]] [--dry-run]
                                       劃一個模組單元:模組表寫一列,它宣告的每一層在那棵原始碼樹裡開好資料夾。
                                       名稱沒有 . 就接上 Cone.md 的模組前綴;單元已經在表上就補上缺的層。層預設 types,core
                                       --facade 另外建一個與單元同名的門面模組,沒指定層就開在最上層(只有它 import 得到底下每一層);要讓下層的消費者也用得到這個名字就指定層。門面只准一個
  claim <slug> [--description <句>] [--kind <IO 介面 | 子流>] [--milestone <M-n>]
                                       鑄號建 pipeline 檔(status: draft),綁進 --milestone 那條里程碑。
                                       slug 是 <領域名詞>-<動詞或動名詞>:領域名詞是 = 列住的模組單元(去掉模組前綴、大駝峰拆成 kebab),要在模組表上
  rename <P-00x> <slug> [--dry-run]    換 slug,編號不動;檔改名,專案裡寫著舊全名的每一處(.lawful/、原始碼註解)一起改
  requirement add <一句話> [--law <句>]
                                       鑄 R-n 寫進 Cone.md「需求」;Law 是一句可判定的話
  objective add <slug> <一句話> --requirement <R-n> --priority <1-4> [--law <句>]
                                       鑄 O-n 建 objectives/R-n-O-n-<slug>.md;每個目標解決一條需求;沒給 --law 就繼承需求的 Law;優先 1 最高、4 最低
  objective milestone <O-n> <一句話> [--bind <全名,全名>]
                                       鑄 M-n(全檔唯一)加進該目標的建置路線表;綁定的全名要是 pipelines/ 裡有的 pipeline
  objective refinement <O-n> <一句話> --touch <全名,全名>
                                       鑄 RF-n(全檔唯一)加進該目標的優化路線表;動到的 pipeline 要是這個目標的里程碑綁定過的
  lint boundary | sig | laws | trace | io | all
                                       邊界 / 簽名 / laws / 測試歸屬 / 對外 I/O 的對帳
  sync [--date <YYYY-MM-DD>]            把「搬家」的 stage 模組欄改成程式碼的實際模組(同層才改)
  modules --gen                        從程式碼的模組名推出模組單元與層,補進模組表,職責欄留白
  section <file> <節>… [--verify]       取節
  spike close <SPK-00x> [--dry-run]    檢查 verdict / feeds / sha 齊全,刪 spike/SPK-00x-<slug>/
  migrate cone [--write]               只有 system.md 的樹、或目標還擠在 objectives.md 的樹,換成 Cone.md 與 objectives/ 體系:先印帳本,--write 才落地
  migrate from-dev-flow <.design> [--write <file>] [--ignore <dir,dir>]
                                       盤點 subsystems/ 體系的 .design,印一份帳本,不改任何檔

選項
  --root <dir>                         專案根目錄(預設目前目錄)
  --date <YYYY-MM-DD>                  claim / objective add / sync / migrate cone 寫進檔的日期(預設今天)
  --dry-run                            module / rename / spike close 只印會做什麼,不寫檔

exit code:status 盤點 = 全部達成且每條需求的 Law 成立 0、否則 1;--pipeline / --module = 查得到 0;lint 通過 0、有不合規 1。
adapter:${adapterNames.join(', ')};Cone.md 的 language 欄選。`;

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
  if (!design) return { error: `${root} 底下沒有 .lawful/` };
  const language = design.cone ? design.cone.language : null;
  const adapter = pickAdapter(language);
  const notes = [];
  if (!design.cone) notes.push(design.legacySystem ? '缺 .lawful/Cone.md;這棵樹只有 system.md,lawful migrate cone --write 換過來' : '缺 .lawful/Cone.md');
  else if (design.legacyObjectives) notes.push('目標還擠在 .lawful/objectives.md;lawful migrate cone --write 拆成 objectives/ 一個目標一個檔');
  else if (!language) notes.push('Cone.md 沒有 language 欄,簽名與邊界不對帳');
  else if (!adapter) notes.push(`此語言尚無 adapter(${language}),lint sig 與 lint boundary 跳過`);
  const source = adapter ? readSource(root, adapter, design.cone ? design.cone.ignoreDirs : [], design.cone) : null;
  return { design, adapter, source, notes };
}

function emit(r) {
  if (r.text) console.log(r.text);
  return r.exitCode;
}

const str = (v) => (typeof v === 'string' ? v : '');

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
    if (sub === 'cone') return emit(migrateCone(root, { write: !!args.flags.write, date: str(args.flags.date) || undefined }));
    if (sub !== 'from-dev-flow' || !rest[0]) {
      console.error('用法:lawful migrate cone [--write]\n      lawful migrate from-dev-flow <.design 路徑> [--write <file>] [--root <專案根目錄>]');
      return 1;
    }
    const ignore = str(args.flags.ignore).split(',').map((s) => s.trim()).filter(Boolean);
    const r = migrateFromDevFlow(path.resolve(root, rest[0]), root, { write: str(args.flags.write) ? path.resolve(root, args.flags.write) : null, language: str(args.flags.language) || null, ignore });
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
    const one = { boundary: lintBoundary, sig: lintSig, laws: lintLaws, trace: lintTrace, io: lintIo };
    let results;
    if (which === 'all') results = lintAll(design, source, adapter);
    else if (one[which]) results = [one[which](design, source, adapter)];
    else {
      console.error(`lint 只有 boundary / sig / laws / trace / io / all,沒有「${which}」`);
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
    const { building, stale } = branchState(root);
    if (args.flags.json) {
      const data = statusJson(design, source, adapter, results, note, building, stale);
      console.log(JSON.stringify(data, null, 2));
      return data.route.allDone && data.summary.docs ? 0 : 1;
    }
    // --html 是額外產出,不取代報告:同一次呼叫先印報告,最後附看板的網址
    const report = statusReport(design, source, adapter, results, note, building, stale);
    if (args.flags.html) {
      const b = statusBoard(design, source, adapter, results, note, building, root, args.flags.html, !!args.flags.open, stale);
      report.text += `\n\n${b.text}`;
    }
    return emit(report);
  }

  if (cmd === 'module') {
    if (!sub) {
      console.error('用法:lawful module <名稱> [--layers <types,effect,core,shell>] [--responsibility <句>] [--dry-run]');
      return 1;
    }
    return emit(moduleAdd(design, sub, adapter, {
      layers: str(args.flags.layers) || undefined,
      responsibility: str(args.flags.responsibility),
      facade: args.flags.facade === undefined ? false : args.flags.facade,
      dryRun: !!args.flags['dry-run'],
    }));
  }

  if (cmd === 'claim') {
    if (!sub) {
      console.error('用法:lawful claim <slug> [--description <句>] [--kind <IO 介面 | 子流>] [--milestone <M-n>]');
      return 1;
    }
    return emit(claim(design, sub, { description: str(args.flags.description), date: str(args.flags.date) || undefined, milestone: str(args.flags.milestone), kind: str(args.flags.kind) }));
  }

  if (cmd === 'rename') {
    if (!sub || !rest[0]) {
      console.error('用法:lawful rename <P-00x | 全名> <slug> [--dry-run]');
      return 1;
    }
    return emit(rename(design, sub, rest[0], { dryRun: !!args.flags['dry-run'] }));
  }

  if (cmd === 'requirement') {
    if (sub === 'add' && rest[0]) return emit(requirementAdd(design, rest.join(' '), { law: str(args.flags.law) }));
    console.error('用法:lawful requirement add <一句話> [--law <句>]');
    return 1;
  }

  if (cmd === 'objective') {
    if (sub === 'add' && rest[0] && rest[1]) return emit(objectiveAdd(design, rest[0], rest.slice(1).join(' '), { requirement: str(args.flags.requirement), priority: args.flags.priority, law: str(args.flags.law), date: str(args.flags.date) || undefined }));
    if (sub === 'milestone' && rest[0] && rest[1]) return emit(milestoneAdd(design, rest[0], rest.slice(1).join(' '), { bind: str(args.flags.bind) }));
    if (sub === 'refinement' && rest[0] && rest[1]) return emit(refinementAdd(design, rest[0], rest.slice(1).join(' '), { touch: str(args.flags.touch) }));
    console.error('用法:lawful objective add <slug> <一句話> --requirement <R-n> --priority <1-4> [--law <句>]\n      lawful objective milestone <O-n> <一句話> [--bind <全名,全名>]\n      lawful objective refinement <O-n> <一句話> --touch <全名,全名>');
    return 1;
  }

  if (cmd === 'sync') return emit(sync(design, source, adapter, { date: str(args.flags.date) || undefined }));

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
