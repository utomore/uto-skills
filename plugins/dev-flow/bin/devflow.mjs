#!/usr/bin/env node
// devflow:spec 驅動開發的單一 CLI。在有 .design/ 的專案根目錄執行。
import path from 'node:path';
import process from 'node:process';
import { readDesign } from '../lib/design.mjs';
import { readSource } from '../lib/source.mjs';
import { pickAdapter, pickSides, adapterNames } from '../lib/adapters/index.mjs';
import { lintAll, lintBoundary, lintGlobal, lintIds, lintInvariants, lintIo, lintLaws, lintSig, lintTrace, renderLint } from '../lib/commands/lint.mjs';
import { sectionCommand } from '../lib/commands/section.mjs';
import { briefCommand, briefSkills, parseBriefArgs, testLogs } from '../lib/commands/brief.mjs';
import { branchState, loadResults, docDetail, moduleDetail, slicePhase, statusReport } from '../lib/commands/status.mjs';
import { statusBoard, statusJson } from '../lib/commands/board.mjs';
import { releaseReport } from '../lib/commands/release.mjs';
import { claim, invariantAdd, milestoneAdd, milestoneVerify, modulesGen, requirementAccept, requirementAdd, sync } from '../lib/commands/edit.mjs';
import { migrate, migrateLaws, migrateRequirements } from '../lib/commands/migrate.mjs';

const HELP = `devflow <子命令> [選項]

  status [--tests <log> | --run]       派工報告;law 綠幾條要給測試輸出,或 --run 跑 system.md 的整套指令;有 .git 時把有 build/<鍵> 分支、而且它還沒合進主線的線列成建構中,
                                       鍵是里程碑全名 M-n-<slug>(切片)、文檔全名(修訂)或 R-n / INV-n(只寫那一條測試);分支有工作樹就從那棵樹讀它走到哪一步
                                       多語言專案每側一份輸出:--tests <目錄>=<log>,<目錄>=<log>,目錄是 system.md language 欄宣告的;--run 照整套指令每側各跑一道
  status --doc <F-00x | 全名>          一份文檔的 step 與 law 逐條狀態
  status --module <路徑或 目錄/**>     住在該檔案或目錄的所有 step 的狀態
  status --json                        同一份報告的資料原樣輸出,給別的工具讀
  status --html [檔名] [--open]        報告照印,另外把它畫成看板寫成自帶資料的單檔網頁(沒給檔名就寫暫存區),附上 file:// 網址;--open 直接用瀏覽器打開
  release [--tests <log> | --run]      每條需求上線了沒:它用到的每份文檔,程式碼在主線上最新的 commit 都進了同一個發布的 tag,最早的那一個就是它上線的版本;
                                       發布的 tag 是 system.md「Constraint」的「發布」行選的(git tag --list 的樣式),沒寫就每個 tag 都算;
                                       證據還沒齊的需求不問上線;另列已驗收而還沒上線的需求,與每個發布帶上線的需求。唯讀;不是 git repo 的根 exit 1
  claim feature|adr <slug> [--description <句>] [--milestone <M-n-slug>]
                                       鑄號建檔;feature 另在 system.md Features 表加一列並綁進 --milestone 那條里程碑(給全名 M-n-<slug>)
                                       配號看同一個 repo 的每一棵工作樹,別條 build 分支上 claim 走的號不重配
                                       system.md「Constraint」有號段行時,號從 git user.email 對到的區間內配,frontmatter 寫 owner;沒有號段行從全部文檔的最大號往上配
  requirement add <slug> <一句話> --priority <1-4> [--accept <句>]
                                       鑄 R-n 建 requirements/R-n-<slug>.md:一件必須達成的事;優先 1 最高、4 最低;驗收(判它達成與否的那一句)沒給就留佔位符
  requirement milestone <R-n> <slug> <一句話> [--bind <全名,全名>] [--verify <指令>]
                                       鑄 M-n,以全名 M-n-<slug> 加在該需求檔的里程碑表最後(表的列序就是先後);slug 是 kebab-case 英文,切片的分支 build/M-n-<slug> 以它為鍵;
                                       綁定的全名要是 features/ 裡有的 feature;綁一份已經被別條里程碑綁過的 feature,這條里程碑就靠修訂它達成:
                                       那份 feature 達成,而且它的修訂記錄裡有一條 REV 的依欄寫了這條里程碑的全名;
                                       --verify 是一道跑起來看得到這一句話的指令,寫進怎麼驗欄,人工審核這條需求時 status 印成步驟
  requirement verify <M-n-slug> <指令>  把那道指令寫進里程碑表的怎麼驗欄;切片收尾時從決策紀錄的「Entry」搬過來(決策紀錄只活在 build 分支,審核的手段要留在需求檔裡)
  requirement accept <R-n> --by <email> --evidence <一句>
                                       把開發者親自審核的結果寫進需求檔的「驗收記錄」表:一條需求唯一能算已驗收的路。
                                       status 只算證據齊了沒(驗收測試綠,或沒有驗收測試而里程碑全部達成),達成與否一律由人判;
                                       簽過之後證據翻掉,status 列成待重審,重驗過再跑一次
  invariant add <一句話> [--kind <種類>]
                                       鑄 INV-n 寫進 system.md「全域 Law」區的領域不變量:整個專案任何一份 feature 都不准違反的 law,從一條既有的 law 抽上去,三行接著從出處照搬;種類沒給就是 invariant
  lint ids | boundary | sig | laws | trace | io | invariants | global | all
                                       ids:兩個檔案同號、號段行讀不懂或重疊、owner 的號不在自己的號段內;
                                       boundary:import 方向 vs 層、IO 模組、未登記與幽靈;sig:Steps 簽名 vs 程式碼,含 = / o / ! 列與引用別份文檔的 step;
                                       laws:文檔的 law 三行、種類、識別字、= 列有 law,與需求的驗收,名詞表(專案根目錄 CLAUDE.md 的「## 名詞」節)型別欄的型別在程式碼裡;trace:laws 與驗收 ↔ 測試歸屬;io:對外 I/O 表、信任與驗證、契約、秘密字面值;
                                       invariants:領域不變量的編號、種類、三行齊全而且只引用最內層、有 INV-n#LAW 測試;
                                       global:全域 Law 三類一次查完 = boundary(架構)+ io(契約)+ invariants(領域不變量)
  sync                                 同層搬家的 step,模組欄改成程式碼裡的實際檔案
  modules --gen                        從程式碼補模組表缺的檔案,層欄留白
  section <file> <節>… [--verify]      取 ## 節
  brief <skill> [<目標>] [--tests <log>] [--fingerprint] [--no-rules]
                                       一個 skill 開工要的東西一次印完:規章的節,加上它在這個專案裡要看的那幾塊(目標文檔、逐條狀態、Steps 上每條簽名與型別的宣告、
                                       需求檔、決策紀錄、分支與工作樹、lint、status 報告,依 skill 而定);目標是文檔全名、里程碑全名 M-n-<slug>、R-n / INV-n,或不給;
                                       第一行是指紋(skill、目標、目標與規章的雜湊),--fingerprint 只印那一行,--no-rules 不重印規章的節(同一場裡文檔改過之後重跑用);
                                       --args '<一整串>' 是 skill 載入時的寫法:目標與旗標從那一串裡認,其餘的字不理;--part <k> [--of <N>] 只印第 k 段
                                       (整份切成每段不超過 28KB:skill 載入時一道指令的輸出超過約 30KB 會被存成檔,SKILL.md 放 N 道各取一段);永遠 exit 0,問題用文字講
                                       skill:${briefSkills.join('、')}
  migrate laws [--write]               system.md 沒有「## 全域 Law」區、或需求寫著「- Law:」的樹:層、對外 I/O、領域不變量收進「## 全域 Law」區,
                                       需求的那一句改成「- 驗收:」;先印帳本,--write 才落地
  migrate requirements [--write]       需求還住在 system.md「## 需求」節、里程碑住 objectives/ 或一份 objectives.md 的樹:每條需求連同朝向它的里程碑
                                       併成 requirements/R-n-<slug>.md 一條一個檔,「## 需求」節與 objectives/ 刪掉;
                                       需求檔或目標檔有調整表的樹:調整表的每一列換成里程碑表的一列(配新的 M-n,綁定 = 動到欄),調整表刪掉,
                                       文檔修訂記錄依欄引用的調整編號改寫成新的 M-n;要人判的列在帳本裡;先印帳本,--write 才落地
  migrate <.design> [--language <adapter>] [--ignore <dir,dir>]
                                       盤點 subsystems/ 體系的 .design:每份舊文檔的介面在程式碼裡對到幾條、
                                       四格 law 翻成三行草稿、共用的簽名列出來(只住一份文檔,別份引用)、退場清單;只印帳本,不改任何檔

選項
  --root <dir>                         專案根目錄(預設目前目錄)
  --date <YYYY-MM-DD>                  claim / requirement add / sync / migrate requirements 寫進檔的日期(預設今天)

exit code:status 盤點 = 全部達成 0、否則 1;status --doc / --module = 查得到 0;release = 是 git repo 的根 0;lint 通過 0、有不合規 1。
adapter:${adapterNames.join(', ')};system.md 的 language 欄選,一種語言寫它的名字,前後端各一種語言的專案寫 [<目錄> = <adapter>, <目錄> = <adapter>]。`;

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
  const sides = pickSides(design.system ? design.system.languages : []);
  const notes = [];
  if (!design.system) notes.push('缺 .design/system.md');
  else if (!language) notes.push('system.md 沒有 language 欄,簽名與邊界不對帳');
  else if (/[<>]/.test(String(language))) notes.push(`system.md 的 language 還是模板(${language}),填成 ${adapterNames.join(' / ')} 其中一個`);
  else for (const s of sides) if (!s.adapter) notes.push(`此語言尚無 adapter(${s.dir ? s.dir + ' = ' : ''}${s.name}),lint sig 與 lint boundary 跳過`);
  const ok = sides.length && sides.every((s) => s.adapter);
  // 單一語言時 adapter 還是那一個物件;多語言時 adapter 是 sides 陣列,下游只拿它當「有沒有 adapter」與 stdlib / testResults 用
  const adapter = !ok ? null : sides.length === 1 ? sides[0].adapter : sides;
  const source = ok ? readSource(root, sides, design.system ? design.system.ignoreDirs : []) : null;
  return { design, adapter, source, notes };
}

// 一條 build 分支走到哪一步:讀它那棵工作樹的 .design 與程式碼
function phaseOf(wtRoot, key) {
  const q = loadProject(wtRoot);
  return q.error ? '' : slicePhase(q.design, q.source, key);
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
      console.error('用法:devflow section <file> <節>… [--verify]');
      return 1;
    }
    return emit(sectionCommand(path.resolve(root, sub), rest, { verify: !!args.flags.verify, display: sub }));
  }

  if (cmd === 'migrate' && sub === 'laws') return emit(migrateLaws(root, { write: !!args.flags.write }));
  if (cmd === 'migrate' && sub === 'requirements') return emit(migrateRequirements(root, { write: !!args.flags.write, date: args.flags.date || undefined }));
  if (cmd === 'migrate') {
    if (!sub) {
      console.error('用法:devflow migrate <.design 路徑> [--language <adapter>] [--ignore <dir,dir>]');
      return 1;
    }
    const ignore = typeof args.flags.ignore === 'string' ? args.flags.ignore.split(',').map((s) => s.trim()).filter(Boolean) : [];
    return emit(migrate(path.resolve(root, sub), root, { language: typeof args.flags.language === 'string' ? args.flags.language : null, ignore }));
  }

  if (cmd === 'brief') {
    if (!sub) {
      console.error(`用法:devflow brief <${briefSkills.join(' | ')}> [<目標>] [--root <工作樹>] [--tests <log>] [--fingerprint] [--no-rules]`);
      return 1;
    }
    // --args '<一整串>':skill 載入時的 $ARGUMENTS 原樣進來,目標與旗標從裡面認;直接下指令時照一般旗標讀
    const inline = typeof args.flags.args === 'string' ? parseBriefArgs(args.flags.args) : null;
    const opt = {
      target: (inline && inline.target) || rest[0] || '',
      root: inline && inline.root ? path.resolve(inline.root) : root,
      tests: (inline && inline.tests) || (typeof args.flags.tests === 'string' ? args.flags.tests : ''),
      fingerprint: !!args.flags.fingerprint || !!(inline && inline.fingerprint),
      noRules: !!args.flags['no-rules'] || !!(inline && inline.noRules),
    };
    const q = loadProject(opt.root);
    const has = (k) => (q.error ? null : q[k]);
    const statusText = () => {
      if (q.error) return '(沒有 .design/)';
      // 沒指定測試輸出:根目錄恰好一份、而且比每個原始碼與測試檔都新,就接上它(報告第三行會講來自哪一份)
      if (!opt.tests) {
        const logs = testLogs(opt.root, q.source);
        if (logs.length === 1 && logs[0].fresh) opt.tests = logs[0].name;
      }
      const testsFlag = !opt.tests ? null : opt.tests.includes('=') ? opt.tests : path.resolve(opt.root, opt.tests);
      const { results, note: rawNote } = loadResults(q.design, q.adapter, { tests: testsFlag, run: false }, opt.root);
      const { building, stale, phases } = branchState(opt.root, phaseOf);
      return statusReport(q.design, q.source, q.adapter, results, testsFlag ? rawNote.replace(testsFlag, opt.tests) : rawNote, building, stale, phases, opt.root).text;
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

  if (cmd === 'status' || cmd === 'release') {
    const testsFlag = !args.flags.tests ? null : String(args.flags.tests).includes('=') ? String(args.flags.tests) : path.resolve(root, args.flags.tests);
    const { results, note: rawNote } = loadResults(design, adapter, { tests: testsFlag, run: !!args.flags.run }, root);
    const note = testsFlag ? rawNote.replace(testsFlag, args.flags.tests) : rawNote;
    // 需求審核到哪一步要看驗收測試的紅綠,所以 release 與 status 讀同一份測試輸出
    if (cmd === 'release') {
      const r = releaseReport(root, design, source, adapter, results);
      if (r.exitCode === 0) r.text = r.text.replace('\n', `\n· ${note}\n`);
      return emit(r);
    }
    if (args.flags.doc) return emit(docDetail(design, source, adapter, results, note, args.flags.doc));
    if (args.flags.module) return emit(moduleDetail(design, source, adapter, results, note, args.flags.module));
    const { building, stale, phases } = branchState(root, phaseOf);
    if (args.flags.json) {
      const data = statusJson(design, source, adapter, results, note, building, stale, root);
      console.log(JSON.stringify(data, null, 2));
      return data.route.allDone && data.summary.docs ? 0 : 1;
    }
    // --html 是額外產出,不取代報告:同一次呼叫先印報告,最後附看板的網址
    const report = statusReport(design, source, adapter, results, note, building, stale, phases, root);
    if (args.flags.html) {
      const b = statusBoard(design, source, adapter, results, note, building, root, args.flags.html, !!args.flags.open, stale);
      report.text += `\n\n${b.text}`;
    }
    return emit(report);
  }

  if (cmd === 'claim') {
    if (!sub || !rest[0]) {
      console.error('用法:devflow claim feature|adr <slug> [--description <句>] [--milestone <M-n-slug>]');
      return 1;
    }
    return emit(claim(design, sub, rest[0], { description: typeof args.flags.description === 'string' ? args.flags.description : '', date: args.flags.date || undefined, milestone: typeof args.flags.milestone === 'string' ? args.flags.milestone : '' }));
  }

  if (cmd === 'requirement') {
    if (sub === 'add' && rest[0] && rest[1]) return emit(requirementAdd(design, rest[0], rest.slice(1).join(' '), { accept: typeof args.flags.accept === 'string' ? args.flags.accept : '', priority: args.flags.priority, date: args.flags.date || undefined }));
    if (sub === 'milestone' && rest[0] && rest[1] && rest[2]) return emit(milestoneAdd(design, rest[0], rest[1], rest.slice(2).join(' '), { bind: typeof args.flags.bind === 'string' ? args.flags.bind : '', verify: typeof args.flags.verify === 'string' ? args.flags.verify : '' }));
    if (sub === 'verify' && rest[0]) return emit(milestoneVerify(design, rest[0], rest.slice(1).join(' ')));
    if (sub === 'accept' && rest[0]) return emit(requirementAccept(design, rest[0], { by: typeof args.flags.by === 'string' ? args.flags.by : '', evidence: typeof args.flags.evidence === 'string' ? args.flags.evidence : '', date: args.flags.date || undefined }));
    console.error('用法:devflow requirement add <slug> <一句話> --priority <1-4> [--accept <句>]\n      devflow requirement milestone <R-n> <slug> <一句話> [--bind <全名,全名>] [--verify <指令>]\n      devflow requirement verify <M-n-slug> <指令>\n      devflow requirement accept <R-n> --by <email> --evidence <一句>');
    return 1;
  }

  if (cmd === 'invariant') {
    if (sub === 'add' && rest[0]) return emit(invariantAdd(design, rest.join(' '), { kind: typeof args.flags.kind === 'string' ? args.flags.kind : 'invariant' }));
    console.error('用法:devflow invariant add <一句話> [--kind <種類>]');
    return 1;
  }

  if (cmd === 'sync') return emit(sync(design, source, { date: args.flags.date || undefined }));

  if (cmd === 'modules') {
    if (!args.flags.gen) {
      console.error('用法:devflow modules --gen');
      return 1;
    }
    return emit(modulesGen(design, source));
  }

  console.error(`沒有「${cmd}」這個子命令。\n\n${HELP}`);
  return 1;
}

process.exitCode = main();
