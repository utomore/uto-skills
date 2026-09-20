#!/usr/bin/env node
// lawful:純函數式專案的 spec 驅動開發 CLI。全部從 .lawful/、程式碼與測試輸出推。
import path from 'node:path';
import process from 'node:process';
import { readDesign } from '../lib/design.mjs';
import { readSource } from '../lib/source.mjs';
import { pickAdapter, adapterNames } from '../lib/adapters/index.mjs';
import { lintAll, lintBoundary, lintGlobal, lintIds, lintInvariants, lintIo, lintLaws, lintSig, lintTrace, renderLint } from '../lib/commands/lint.mjs';
import { sectionCommand } from '../lib/commands/section.mjs';
import { briefCommand, briefSkills, parseBriefArgs, testLogs } from '../lib/commands/brief.mjs';
import { branchState, loadResults, moduleDetail, pipelineDetail, slicePhase, statusReport } from '../lib/commands/status.mjs';
import { statusBoard, statusJson } from '../lib/commands/board.mjs';
import { claim, invariantAdd, milestoneAdd, moduleAdd, modulesGen, refinementAdd, requirementAdd, sync } from '../lib/commands/edit.mjs';
import { migrateCone, migrateFromDevFlow, migrateLaws, migrateRequirements } from '../lib/commands/migrate.mjs';

const HELP = `lawful <子命令> [選項]

子命令
  status [--tests <log> | --run]        派工報告:需求達成與否與它的里程碑完成度、需求之間的依賴、全域 Law 三類的結果、每條 pipeline 的完成度、
                                       能開的線(含還沒有切片的里程碑)、建構中的線走到哪一步、卡住的、警訊、建議路線。laws 綠幾條要有測試輸出:--tests 給留檔的輸出,
                                       --run 在專案根目錄跑 Cone.md「專案約束」的整套指令
  status --pipeline <P-00x> | --module <M>
                                       一條 pipeline 的 stage 與 law 逐條狀態 / 住在該模組(或模組單元)的所有 stage
  status --json                        同一份報告的資料原樣輸出,給別的工具讀
  status --html [檔名] [--open]        報告照印,另外把同一份資料畫成看板(單檔網頁);沒給檔名寫進系統暫存區,不在專案裡留檔
  module <名稱> [--layers <types,effect,core,shell>] [--responsibility <句>] [--facade [層]] [--dry-run]
                                       劃一個模組單元:模組表寫一列,它宣告的每一層在那棵原始碼樹裡開好資料夾。
                                       名稱沒有 . 就接上 Cone.md 的模組前綴;單元已經在表上就補上缺的層。層預設 types,core
                                       --facade 另外建一個與單元同名的門面模組,沒指定層就開在最上層(只有它 import 得到底下每一層);要讓下層的消費者也用得到這個名字就指定層。門面只准一個
  claim <slug> [--description <句>] [--kind <io | subflow>] [--milestone <M-n>]
                                       鑄號建 pipeline 檔(status: draft),綁進 --milestone 那條里程碑(編號或全名 M-n-<slug> 都行)。
                                       kind:io 是跨過 shell 的資料流(有進入點),subflow 是被別條 pipeline 引用的純資料流
                                       slug 是 <領域名詞>-<動詞或動名詞>:領域名詞是 = 列住的模組單元(去掉模組前綴、大駝峰拆成 kebab),要在模組表上
                                       號從每一棵工作樹的 pipeline 的最大號往上配;Cone.md「專案約束」有號段行時,從 git user.email 對到的區間內配,frontmatter 寫 owner
  requirement add <slug> <一句話> --priority <1-4> [--accept <句>]
                                       鑄 R-n 建 requirements/R-n-<slug>.md:一件必須達成的事;優先 1 最高、4 最低;驗收(判它達成與否的那一句)沒給就留佔位符
  requirement milestone <R-n> <slug> <一句話> [--bind <全名,全名>]
                                       鑄 M-n(全資料夾唯一),以全名 M-n-<slug> 加在該需求檔的里程碑表最後(表的列序就是先後);slug 是 kebab-case 英文,
                                       切片的分支 build/M-n-<slug> 以它為鍵;綁定的全名要是 pipelines/ 裡有的 pipeline
  requirement refinement <R-n> <一句話> --touch <全名,全名>
                                       鑄 RF-n(全資料夾唯一)加進該需求檔的調整表;動到的要是這條需求的里程碑綁定過的 pipeline
  invariant add <一句話> [--kind <種類>]
                                       鑄 INV-n 寫進 Cone.md「全域 Law」的領域不變量;種類預設 invariant
  lint ids | boundary | sig | laws | trace | io | invariants | global | all
                                       一檔一號與號段 / 邊界 / 簽名 / laws / 測試歸屬 / 對外 I/O 與契約欄 / 領域不變量的對帳;
                                       global = 全域 Law 三類一次查完:boundary(架構)+ io(契約)+ invariants(領域不變量)
  sync [--date <YYYY-MM-DD>]            把「搬家」的 stage 模組欄改成程式碼的實際模組(同層才改)
  modules --gen                        從程式碼的模組名推出模組單元與層,補進模組表,職責欄留白
  section <file> <節>… [--verify]       取節
  brief <skill> [<目標>] [--tests <log>] [--fingerprint] [--no-rules]
                                       一個 skill 開工要的東西一次印完:規章的節,加上它在這個專案裡要看的那幾塊(目標 pipeline、逐條狀態、Stages 上每條簽名與型別的宣告、
                                       types 層、Cone.md、需求檔、決策紀錄、分支與工作樹、lint、status 報告,依 skill 而定);目標是 pipeline 全名、里程碑全名 M-n-<slug>、R-n / INV-n,或不給;
                                       第一行是指紋(skill、目標、目標與規章的雜湊),--fingerprint 只印那一行,--no-rules 不重印規章的節(同一場裡文檔改過之後重跑用);
                                       --args '<一整串>' 是 skill 載入時的寫法:目標與旗標從那一串裡認,其餘的字不理;--part <k> [--of <N>] 只印第 k 段
                                       (整份切成每段不超過 28KB:skill 載入時一道指令的輸出超過約 30KB 會被存成檔,SKILL.md 放 N 道各取一段);永遠 exit 0,問題用文字講
                                       skill:${briefSkills.join('、')}
  migrate laws [--write]               Cone.md 沒有「## 全域 Law」區、或「## 需求」節與 objectives/ 底下的檔寫著「- Law:」的樹:modules.md 的「邊界」與「對外 I/O」收進 Cone.md「## 全域 Law」區,
                                       需求的那一句改成「- 驗收:」,蘊含說明與 objectives/ 底下的「- Law:」刪掉,里程碑補英文名;先印帳本,--write 才落地
  migrate requirements [--write]       需求還住在 Cone.md「## 需求」節、里程碑住 objectives/ 或一份 objectives.md 的樹:每條需求連同朝向它的里程碑與調整
                                       併成 requirements/R-n-<slug>.md 一條一個檔,「## 需求」節與 objectives/ 刪掉;pipeline 的 kind 不是 io 或 subflow 而認得出來的,改寫成 io 或 subflow;
                                       要人判的列在帳本裡;先印帳本,--write 才落地
  migrate cone [--write]               只有 system.md 的樹、或里程碑還擠在一份 objectives.md 的樹:建 Cone.md、objectives.md 拆成 objectives/ 一個檔一份;先印帳本,--write 才落地;之後接 migrate requirements
  migrate from-dev-flow <.design> [--write <file>] [--ignore <dir,dir>]
                                       盤點 subsystems/ 體系的 .design,印一份帳本,不改任何檔

選項
  --root <dir>                         專案根目錄(預設目前目錄)
  --date <YYYY-MM-DD>                  claim / requirement add / sync / migrate cone / migrate requirements 寫進檔的日期(預設今天)
  --dry-run                            module 只印會做什麼,不寫檔

exit code:status 盤點 = 全部達成、每條需求達成、每條領域不變量成立 0,否則 1;--pipeline / --module = 查得到 0;lint 通過 0、有不合規 1。
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
  else if (!language) notes.push('Cone.md 沒有 language 欄,簽名與邊界不對帳');
  else if (!adapter) notes.push(`此語言尚無 adapter(${language}),lint sig 與 lint boundary 跳過`);
  const source = adapter ? readSource(root, adapter, design.cone ? design.cone.ignoreDirs : [], design.cone) : null;
  return { design, adapter, source, notes };
}

function phaseOf(wtRoot, key) {
  const q = loadProject(wtRoot);
  return q.error ? '' : slicePhase(q.design, q.source, key);
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
    if (sub === 'laws') return emit(migrateLaws(root, { write: !!args.flags.write }));
    if (sub === 'requirements') return emit(migrateRequirements(root, { write: !!args.flags.write, date: str(args.flags.date) || undefined }));
    if (sub !== 'from-dev-flow' || !rest[0]) {
      console.error('用法:lawful migrate laws [--write]\n      lawful migrate requirements [--write]\n      lawful migrate cone [--write]\n      lawful migrate from-dev-flow <.design 路徑> [--write <file>] [--root <專案根目錄>]');
      return 1;
    }
    const ignore = str(args.flags.ignore).split(',').map((s) => s.trim()).filter(Boolean);
    const r = migrateFromDevFlow(path.resolve(root, rest[0]), root, { write: str(args.flags.write) ? path.resolve(root, args.flags.write) : null, language: str(args.flags.language) || null, ignore });
    return emit(r);
  }

  if (cmd === 'brief') {
    if (!sub) {
      console.error(`用法:lawful brief <${briefSkills.join(' | ')}> [<目標>] [--root <工作樹>] [--tests <log>] [--fingerprint] [--no-rules]`);
      return 1;
    }
    // --args '<一整串>':skill 載入時的 $ARGUMENTS 原樣進來,目標與旗標從裡面認;直接下指令時照一般旗標讀
    const inline = typeof args.flags.args === 'string' ? parseBriefArgs(args.flags.args) : null;
    const opt = {
      target: (inline && inline.target) || rest[0] || '',
      root: inline && inline.root ? path.resolve(inline.root) : root,
      tests: (inline && inline.tests) || str(args.flags.tests),
      fingerprint: !!args.flags.fingerprint || !!(inline && inline.fingerprint),
      noRules: !!args.flags['no-rules'] || !!(inline && inline.noRules),
    };
    const q = loadProject(opt.root);
    const has = (k) => (q.error ? null : q[k]);
    const statusText = () => {
      if (q.error) return '(沒有 .lawful/)';
      // 沒指定測試輸出:根目錄恰好一份、而且比每個原始碼與測試檔都新,就接上它(報告開頭會講來自哪一份)
      if (!opt.tests) {
        const logs = testLogs(opt.root, q.source);
        if (logs.length === 1 && logs[0].fresh) opt.tests = logs[0].name;
      }
      const testsFlag = opt.tests ? path.resolve(opt.root, opt.tests) : null;
      const { results, note: rawNote } = loadResults(q.design, q.adapter, { tests: testsFlag, run: false }, opt.root);
      const { building, stale, phases } = branchState(opt.root, phaseOf);
      return statusReport(q.design, q.source, q.adapter, results, testsFlag ? rawNote.replace(testsFlag, opt.tests) : rawNote, building, stale, phases).text;
    };
    emit(briefCommand(opt.root, has('design'), has('source'), has('adapter'), sub, opt.target, { fingerprint: opt.fingerprint, noRules: opt.noRules, statusText, part: Number(args.flags.part) || 0, of: Number(args.flags.of) || 0 }));
    return 0;
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
    const one = { ids: lintIds, boundary: lintBoundary, sig: lintSig, laws: lintLaws, trace: lintTrace, io: lintIo, invariants: lintInvariants };
    let results;
    if (which === 'all') results = lintAll(design, source, adapter);
    else if (which === 'global') results = lintGlobal(design, source, adapter);
    else if (one[which]) results = [one[which](design, source, adapter)];
    else {
      console.error(`lint 只有 ids / boundary / sig / laws / trace / io / invariants / global / all,沒有「${which}」`);
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
    const { building, stale, phases } = branchState(root, phaseOf);
    if (args.flags.json) {
      const data = statusJson(design, source, adapter, results, note, building, stale);
      console.log(JSON.stringify(data, null, 2));
      return data.route.allDone && data.summary.docs ? 0 : 1;
    }
    // --html 是額外產出,不取代報告:同一次呼叫先印報告,最後附看板的網址
    const report = statusReport(design, source, adapter, results, note, building, stale, phases);
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
      console.error('用法:lawful claim <slug> [--description <句>] [--kind <io | subflow>] [--milestone <M-n>]');
      return 1;
    }
    return emit(claim(design, sub, { description: str(args.flags.description), date: str(args.flags.date) || undefined, milestone: str(args.flags.milestone), kind: str(args.flags.kind) }));
  }

  if (cmd === 'requirement') {
    if (sub === 'add' && rest[0] && rest[1]) return emit(requirementAdd(design, rest[0], rest.slice(1).join(' '), { accept: str(args.flags.accept), priority: args.flags.priority, date: str(args.flags.date) || undefined }));
    if (sub === 'milestone' && rest[0] && rest[1] && rest[2]) return emit(milestoneAdd(design, rest[0], rest[1], rest.slice(2).join(' '), { bind: str(args.flags.bind) }));
    if (sub === 'refinement' && rest[0] && rest[1]) return emit(refinementAdd(design, rest[0], rest.slice(1).join(' '), { touch: str(args.flags.touch) }));
    console.error('用法:lawful requirement add <slug> <一句話> --priority <1-4> [--accept <句>]\n      lawful requirement milestone <R-n> <slug> <一句話> [--bind <全名,全名>]\n      lawful requirement refinement <R-n> <一句話> --touch <全名,全名>');
    return 1;
  }

  if (cmd === 'invariant') {
    if (sub === 'add' && rest[0]) return emit(invariantAdd(design, rest.join(' '), { kind: str(args.flags.kind) || undefined }));
    console.error('用法:lawful invariant add <一句話> [--kind <種類>]');
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

  console.error(`沒有「${cmd}」這個子命令。\n\n${HELP}`);
  return 1;
}

process.exitCode = main();
