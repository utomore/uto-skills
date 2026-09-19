// status:派工報告。全部從 .design、程式碼與測試輸出推,沒有任何一格是人手動維護的。
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { matchModule, matchesPattern, STATUSES, compareSignature as cmpSig } from '../design.mjs';
import { findSignature } from '../source.mjs';
import { lintBoundary, lintInvariants, lintIo } from './lint.mjs';
import { worktrees } from './edit.mjs';

export function analyze(design, source, adapter, results) {
  const markers = new Map();
  if (source) for (const t of source.testFiles) for (const m of t.markers) markers.set(m, (markers.get(m) || 0) + 1);
  const openGaps = design.gaps.gaps.filter((g) => g.status === 'open');
  const info = new Map();

  for (const p of design.docs) {
    const steps = p.steps.map((s) => {
      const hits = source ? findSignature(source, s.name) : [];
      const hit = hits.find((h) => h.file === s.module) || hits[0] || null;
      let state;
      if (!source) state = '未查';
      else if (!hit) state = '找不到';
      else if (!cmpSig(s.sig, hit).ok) state = '不一致';
      else if (hit.file !== s.module) state = '搬家';
      else if (hit.stub) state = '未實作';
      else state = '在';
      return { ...s, state, hit };
    });
    const present = (s) => s.state === '在' || s.state === '搬家' || s.state === '未實作';
    const real = steps.filter((s) => !s.observe);
    const observes = steps.filter((s) => s.observe);
    const sigOk = real.filter(present).length;
    const obsOk = observes.filter(present).length;
    const stubCount = steps.filter((s) => s.hit && s.hit.stub).length;
    const mark = (id) => {
      const key = `${p.id}#${id}`;
      const traced = markers.has(key);
      const res = results ? results.get(key) : undefined;
      return { key, traced, result: res || (traced ? '未跑' : '未翻譯') };
    };
    const laws = p.laws.map((l) => ({ ...l, ...mark(l.id) }));
    const examples = p.examples.map((e) => ({ ...e, ...mark(e.id) }));
    const gaps = openGaps.filter((g) => g.target === p.fullName || g.target.startsWith(`${p.id}#`) || g.target.startsWith(`${p.fullName}#`));
    const refs = [...new Set(p.steps.map((s) => s.ref).filter(Boolean))];
    info.set(p.fullName, { p, steps, sigOk, sigTotal: real.length, stubCount, obsOk, obsTotal: observes.length, laws, examples, gaps, refs, referrers: [] });
  }
  for (const [, x] of info) for (const r of x.refs) if (info.has(r)) info.get(r).referrers.push(x.p.fullName);

  const selfDone = (x) =>
    x.sigOk === x.sigTotal && x.sigTotal > 0 && x.stubCount === 0 && x.obsOk === x.obsTotal &&
    x.laws.length > 0 && x.laws.every((l) => l.result === 'green') &&
    x.examples.every((e) => e.result === 'green') && x.gaps.length === 0;
  const achieved = (name, seen = new Set()) => {
    if (seen.has(name)) return true;
    seen.add(name);
    const x = info.get(name);
    if (!x) return false;
    return selfDone(x) && x.refs.every((r) => achieved(r, seen));
  };
  for (const [name, x] of info) {
    x.selfDone = selfDone(x);
    x.achieved = achieved(name);
    x.unknown = !results && x.laws.some((l) => l.traced);
  }
  for (const [, x] of info) x.blockedBy = x.refs.filter((r) => info.has(r) && !info.get(r).achieved);
  // 需求的驗收與領域不變量也是測試標記(R-n#ACCEPT / INV-n#LAW):有測試就以測試為準
  const lawTest = (key) => {
    if (!markers.has(key)) return null;
    const res = results ? results.get(key) : undefined;
    return { key, result: res || '未跑' };
  };
  return { info, openGaps, markers, lawTest };
}

function gitLines(root, cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

// 主線的參照:clone 設好的 origin/HEAD 優先,再退到常見的名字;都解不到就沒有基準
function mainRef(root) {
  const head = gitLines(root, 'git symbolic-ref --quiet --short refs/remotes/origin/HEAD');
  if (head && head[0]) return head[0];
  for (const ref of ['origin/main', 'origin/master', 'main', 'master']) {
    if (gitLines(root, `git rev-parse --verify --quiet ${ref}`)) return ref;
  }
  return null;
}

// 建構中 = 有 build/<鍵> 分支,而且它還沒被合進主線。鍵是里程碑全名 M-n-<slug>(一條切片)、文檔全名(一次修訂)、或 R-n / O-n / INV-n(一條驗收測試)。
// 合進主線的分支是做完了沒人收的殘留,不是有人在建;它列成警訊,清掉是整合的職責(roles.md「整合」)。
// 只在專案根目錄有 .git 時問 git;沒有(夾具、匯出的樹)就一條都不算,報告不受環境影響。
// phaseOf(工作樹根目錄, 鍵) 由呼叫端給:它讀那棵樹的 .design 與程式碼,回這條線走到哪一步(slicePhase)。
export function branchState(root, phaseOf = null) {
  const none = { building: new Set(), stale: new Set(), phases: new Map() };
  if (!root || !fs.existsSync(path.join(root, '.git'))) return none;
  const all = gitLines(root, 'git branch --list "build/*" --format="%(refname:short)"');
  if (!all) return none;
  const name = (s) => s.replace(/^build\//, '');
  const ref = mainRef(root);
  // 剛開、還沒有任何 commit 的分支與主線同一個 sha,git 也算它 merged;那是有人正要開工,不是殘留
  const mainSha = ref ? (gitLines(root, `git rev-parse --verify --quiet ${ref}`) || [])[0] : null;
  const merged = ref ? gitLines(root, `git branch --list "build/*" --merged ${ref} --format="%(refname:short) %(objectname)"`) : null;
  const stale = new Set((merged || []).map((l) => l.split(/\s+/)).filter(([, sha]) => sha !== mainSha).map(([n]) => name(n)));
  const building = new Set(all.map(name).filter((n) => !stale.has(n)));
  const phases = new Map();
  if (phaseOf) {
    const trees = new Map(worktrees(root).filter((w) => w.branch).map((w) => [w.branch, w.path]));
    for (const key of building) {
      const at = trees.get(`build/${key}`);
      const phase = at ? phaseOf(at, key) : '';
      if (phase) phases.set(key, phase);
    }
  }
  return { building, stale, phases };
}

// 一條 build 分支走到哪一步,全部從那棵工作樹的檔案推:
// 還沒有決策紀錄 = 切片中;有決策紀錄而里程碑還沒綁文檔 = 切片完成;綁的文檔有 draft = Law 討論中;
// 都拍板了而 law 還沒有測試歸屬 = Law 已定;有歸屬 = 調整中;都 verified = qa 與 refactor 做完、每條 law 成立。
export function slicePhase(design, source, key) {
  const m = design.objectives.objectives.flatMap((o) => o.milestones).find((ms) => ms.fullName === key || ms.id === key);
  const docs = m ? m.binds.map((b) => design.docs.find((d) => d.fullName === b)).filter(Boolean) : design.docs.filter((d) => d.fullName === key);
  if (!m && !docs.length) return '';
  if (!docs.length) return design.journals.some((j) => j.key === key) ? '切片完成,等 dev-flow:law-design' : '切片中';
  if (docs.some((d) => d.status === 'draft')) return 'Law 討論中';
  if (docs.every((d) => d.status === 'verified')) return 'verified,等 dev-flow:integrate';
  const markers = new Set(source ? source.testFiles.flatMap((t) => t.markers) : []);
  const traced = docs.every((d) => d.laws.length && d.laws.every((l) => markers.has(`${d.id}#${l.id}`)));
  return traced ? '調整中' : 'Law 已定,等 qa';
}

export function buildingBranches(root) {
  return branchState(root).building;
}

// 測試輸出裡一條 F-00x#LAW-n / EX-n / R-n#ACCEPT / INV-n#LAW 標記都沒有,就不是「全部沒過」,是讀不到:當成沒給輸出,通過數印 nan。
function checked(results, note) {
  if (results.size) return { results, note };
  return { results: null, note: `${note};輸出裡沒有任何 F-00x#LAW-n 標記,幾條 law 通過測試未知(指令跑錯目錄、跑失敗、或測試名沒帶歸屬)` };
}

// 一份輸出交給哪幾個 adapter 解析:指名了目錄就是那一側的;沒指名就每一側都掃一遍,歸屬字串各語言都認得同一套,合併不衝突。
function parseWith(sides, dir, log, into) {
  const chosen = dir ? sides.filter((s) => s.dir === dir) : sides;
  for (const s of chosen) for (const [k, v] of s.adapter.testResults(log)) into.set(k, v);
}

function runCommand(cmd, root) {
  try {
    return { out: execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), exit: 0 };
  } catch (e) {
    return { out: (e.stdout || '') + (e.stderr || ''), exit: e.status == null ? 1 : e.status };
  }
}

export function loadResults(design, adapter, flags, root) {
  const sides = Array.isArray(adapter) ? adapter : adapter ? [{ dir: '', adapter }] : [];
  if (!sides.length || sides.some((s) => !s.adapter || !s.adapter.testResults)) return { results: null, note: '此 adapter 不解析測試輸出' };
  const merged = new Map();
  if (flags.tests) {
    // --tests <log>:一份輸出;--tests <目錄>=<log>,<目錄>=<log>:多語言專案每側一份,目錄是 language 欄宣告的
    const specs = String(flags.tests).split(',').map((s) => { const i = s.indexOf('='); return i < 0 ? { dir: '', file: s } : { dir: s.slice(0, i).trim().replace(/\/$/, ''), file: s.slice(i + 1).trim() }; });
    const notes = [];
    for (const sp of specs) {
      if (sp.dir && !sides.some((s) => s.dir === sp.dir)) return { results: null, note: `--tests 指到的 ${sp.dir} 不是 system.md language 欄裡的目錄(${sides.map((s) => s.dir || '.').join('、')})` };
      const file = path.resolve(root, sp.file);
      if (!fs.existsSync(file)) return { results: null, note: `找不到測試輸出 ${sp.file}` };
      parseWith(sides, sp.dir, fs.readFileSync(file, 'utf8'), merged);
      notes.push(sp.file);
    }
    return checked(merged, `測試結果來自 ${notes.join(' 與 ')}`);
  }
  if (flags.run) {
    const cmd = design.system && design.system.commands['測試(整套)'];
    if (!cmd) return { results: null, note: 'system.md「語言與工具」沒有整套測試指令,--run 不知道跑什麼' };
    // 字串:一道指令跑全部,每一側都掃它的輸出;物件:每側一道,各在專案根目錄跑、各用自己的 adapter 掃
    const jobs = typeof cmd === 'string' ? [{ dir: '', cmd }] : Object.entries(cmd).map(([dir, c]) => ({ dir, cmd: c }));
    const notes = [];
    for (const job of jobs) {
      if (job.dir && !sides.some((s) => s.dir === job.dir)) return { results: null, note: `system.md 整套指令指到的 ${job.dir} 不是 language 欄裡的目錄` };
      const { out, exit } = runCommand(job.cmd, root);
      parseWith(sides, job.dir, out, merged);
      notes.push(`${job.cmd}${exit ? `(指令 exit ${exit})` : ''}`);
    }
    return checked(merged, `測試結果來自 --run:${notes.join(' 與 ')}`);
  }
  return { results: null, note: '沒給測試輸出(--tests <log> 或 --run),幾條 law 通過測試未知' };
}

// 測試結果 → 成立與否:green 成立、red 未成立、其餘(未跑、pending)未知。law 講「成立」(不得違反),需求講「達成」(必須達成)
const verdict = (result) => (result === 'green' ? true : result === 'red' ? false : null);
export const holdsWord = (holds) => (holds === true ? '成立' : holds === false ? '未成立' : '未知');
export const metWord = (met) => (met === true ? '達成' : met === false ? '未達成' : '未知');

// 需求 → 目標 → 里程碑 / 調整 → 文檔。
// 里程碑達成 = 綁定的每份 feature 都達成;目標完成度 = 達成的里程碑 / 里程碑數。
// 目標達成 = 建置路線的里程碑全部達成。
// 需求達成:有 R-n#ACCEPT 驗收測試以它為準;驗收寫了三行卻沒有測試是未知;一句話的驗收沒有測試 = 它底下每個目標都達成(推得),一個目標都沒有就未達成。
// 調整達成 = 動到的每份文檔都有一條 REV 引用它、都達成,而且需求仍達成。
// rank 給每份文檔一個排序鍵(目標優先、目標順序、里程碑順序),建議路線與能開的線照它排;沒被綁的排最後。
export function objectiveView(design, a) {
  const sys = design.system;
  const objs = design.objectives.objectives.map((o) => {
    const ms = o.milestones.map((m) => {
      const docs = m.binds.map((b) => ({ name: b, x: a.info.get(b) || null }));
      const achieved = docs.length > 0 && docs.every((d) => d.x && d.x.achieved);
      return { ...m, docs, achieved };
    });
    const done = ms.filter((m) => m.achieved).length;
    const built = ms.length > 0 && done === ms.length;
    const rfs = o.refinements.map((rf) => {
      const docs = rf.touches.map((name) => {
        const x = a.info.get(name) || null;
        return { name, x, revs: x ? x.p.revs.filter((r) => r.cites.includes(rf.id)) : [] };
      });
      return {
        ...rf,
        docs,
        missing: docs.filter((d) => !d.x).map((d) => d.name),
        outside: rf.touches.filter((name) => !ms.some((m) => m.binds.includes(name))),
        started: docs.some((d) => d.revs.length),
        cited: docs.length > 0 && docs.every((d) => d.revs.length),
        green: docs.length > 0 && docs.every((d) => d.x && d.x.achieved),
      };
    });
    return { ...o, ms, done, pct: ms.length ? Math.round((done / ms.length) * 100) : null, achieved: built, rfs };
  });
  const sorted = [...objs].sort((x, y) => (x.priority || 5) - (y.priority || 5) || x.fullName.localeCompare(y.fullName));
  // 需求:它底下的目標照優先排;需求本身照它最高優先的目標排
  const reqs = (sys ? sys.requirements : []).map((q) => {
    const os = sorted.filter((o) => o.requirement === q.id);
    // 三行式的驗收只由測試判,沒有測試就是未知;一句話的驗收才由建置路線推
    const test = a.lawTest(`${q.id}#ACCEPT`);
    let holds;
    let source;
    if (q.accept && q.accept.placeholder) {
      holds = false;
      source = '驗收還是模板';
    } else if (test) {
      holds = verdict(test.result);
      source = `測試 ${test.key} ${test.result}`;
    } else if (q.accept && q.accept.formal) {
      holds = null;
      source = `寫了三行卻沒有 ${q.id}#ACCEPT 測試`;
    } else if (!os.length) {
      holds = false;
      source = '還沒有目標';
    } else if (os.every((o) => o.achieved)) {
      holds = true;
      source = `推得:${os.map((o) => o.id).join('、')} 都達成`;
    } else {
      holds = false;
      source = `${os.filter((o) => !o.achieved).map((o) => o.id).join('、')} 還沒達成`;
    }
    const ms = os.flatMap((o) => o.ms);
    const rfs = os.flatMap((o) => o.rfs);
    return { ...q, objectives: os, holds, source, tested: !!test, built: os.length > 0 && os.every((o) => o.achieved), ms, rfs, key: Math.min(...os.map((o) => o.priority || 5), 5) };
  }).sort((x, y) => x.key - y.key || x.line - y.line);
  const reqOf = new Map(reqs.map((q) => [q.id, q]));
  for (const o of sorted) {
    o.req = reqOf.get(o.requirement) || null;
    for (const rf of o.rfs) {
      rf.state = !rf.started ? '待修訂' : rf.cited && rf.green && o.req && o.req.holds === true ? '達成' : '進行中';
      rf.achieved = rf.state === '達成';
    }
    o.rfDone = o.rfs.filter((rf) => rf.achieved).length;
  }
  const rank = new Map();
  sorted.forEach((o, oi) => o.ms.forEach((m, mi) => m.binds.forEach((b) => {
    if (!rank.has(b)) rank.set(b, { o, m, key: (o.priority || 5) * 1e6 + oi * 1e3 + mi });
  })));
  const keyOf = (name) => (rank.has(name) ? rank.get(name).key : 9e9);
  const tag = (name) => (rank.has(name) ? `${rank.get(name).o.id} 優先 ${rank.get(name).o.priority || '?'} · ${rank.get(name).m.id} ${rank.get(name).m.title}` : '沒有綁到任何目標');
  return { objs: sorted, reqs, rank, keyOf, tag };
}

// 領域不變量:整個專案都不准違反的 law。只由測試判:有 INV-n#LAW 測試以它為準;寫了三行卻沒有測試、或還沒有三行式,都是未知。
export function invariantView(design, a) {
  const sys = design.system;
  return (sys ? sys.invariants : []).map((v) => {
    const test = a.lawTest(`${v.id}#LAW`);
    if (test) return { ...v, holds: verdict(test.result), source: `測試 ${test.key} ${test.result}`, tested: true };
    if (v.law.formal) return { ...v, holds: null, source: `寫了三行卻沒有 ${v.id}#LAW 測試`, tested: false };
    return { ...v, holds: null, source: '還沒有三行式', tested: false };
  });
}

// 全域 Law 三類各一列:住 system.md 的哪一區、哪一道 lint 自動確認、現在的結果。報告、警訊與看板同源。
export function globalView(design, a, source, adapter, inv = invariantView(design, a)) {
  const sys = design.system;
  if (!sys) return [];
  const word = (r) => (r.red.length ? `${r.red.length} 條不合規` : '通過');
  const b = lintBoundary(design, source, adapter);
  const io = lintIo(design, source, adapter);
  const iv = lintInvariants(design, source, adapter);
  const cited = [...new Set(sys.io.flatMap((row) => row.contract || []))];
  // 沒給測試輸出時,幾條成立是讀不到,不是零
  const blind = [...a.info.values()].some((y) => y.unknown);
  const citedHolding = cited.filter((c) => {
    if (/^INV-/.test(c)) return inv.some((v) => v.id === c && v.holds === true);
    const m = /^((?:F|A)-\d{3})#(LAW-\d+)$/.exec(c);
    const x = m && [...a.info.values()].find((y) => y.p.id === m[1]);
    return !!(x && x.laws.some((l) => l.id === m[2] && l.result === 'green'));
  });
  return [
    { kind: '架構', where: '架構:層', gate: 'boundary', red: source ? b.red.length : 0, result: source ? `${sys.layers.length} 層,${word(b)}` : `${sys.layers.length} 層,沒有程式碼可對` },
    { kind: '契約', where: '契約:對外 I/O', gate: 'io', red: io.red.length, result: `${sys.io.length} 列,${word(io)};契約欄指到的 law ${cited.length} 條,成立 ${blind ? 'nan' : citedHolding.length} 條` },
    { kind: '領域不變量', where: '領域不變量', gate: 'invariants', red: iv.red.length, result: `${inv.length} 條,${word(iv)};成立 ${blind ? 'nan' : inv.filter((v) => v.holds === true).length} 條` },
  ];
}

// 每個目標下一條還沒達成的里程碑,如果它還沒綁任何文檔,就是一條可以開的切片(要有英文名才有分支可開)
export function sliceLines(ov, building) {
  const next = ov.objs.map((o) => ({ o, m: o.ms.find((m) => !m.achieved) })).filter((s) => s.m && !s.m.binds.length && s.m.slug);
  return {
    openable: next.filter((s) => !building.has(s.m.fullName)),
    inBuild: next.filter((s) => building.has(s.m.fullName)),
  };
}
const sliceTag = (s) => `${s.o.id} 優先 ${s.o.priority || '?'} · ${s.m.title}`;

// 一份文檔是不是正在某條 build 分支上:它自己的(修訂那波),或綁它的那條里程碑的(切片那波)
export function buildKeyOf(x, ov, building) {
  if (building.has(x.p.fullName)) return x.p.fullName;
  const at = ov.rank.get(x.p.fullName);
  return at && building.has(at.m.fullName) ? at.m.fullName : null;
}

// 一份文檔在報告與看板上的同一句狀態
export function docState(x) {
  return x.achieved ? '達成' : x.gaps.length ? `卡 ${x.gaps.map((g) => g.id).join('、')}` : x.blockedBy.length ? `等 ${x.blockedBy.join('、')}` : '進行中';
}

function row(x) {
  const g = x.laws.filter((l) => l.result === 'green').length;
  const traced = x.laws.filter((l) => l.traced).length;
  return `| ${x.p.fullName} | ${x.p.kind === 'abstract' ? 'abstract' : 'feature'} | ${x.p.status || '(無)'} | ${x.sigTotal} | ${x.sigOk} | ${x.stubCount} | ${x.laws.length} | ${x.unknown ? 'nan' : g}/${traced} | ${x.p.revs.length} | ${docState(x)} |`;
}

// 能開 = ready、沒 open GAP、引用的 abstract 全部達成(消費者在 abstract 合進主線之後才開,roles.md「分支與所有權」)
export function openLines(a, ov, building) {
  const candidates = [...a.info.values()].filter((x) => x.p.status === 'ready' && !x.achieved && !x.gaps.length && !x.blockedBy.length).sort((x, y) => ov.keyOf(x.p.fullName) - ov.keyOf(y.p.fullName));
  const openable = candidates.filter((x) => !buildKeyOf(x, ov, building));
  const inBuild = candidates.filter((x) => buildKeyOf(x, ov, building));
  // 兩條能開的線的 step 住同一個檔案:同時開,整合時那個檔案兩邊都動
  const shared = [];
  for (let i = 0; i < openable.length; i++) for (let j = i + 1; j < openable.length; j++) {
    const files = [...new Set(openable[i].steps.filter((s) => !s.ref).map((s) => s.module))].filter((m) => openable[j].steps.some((s) => !s.ref && s.module === m));
    if (files.length) shared.push({ a: openable[i].p.fullName, b: openable[j].p.fullName, files });
  }
  return { openable, inBuild, shared };
}

export function lineTag(x, ov) {
  return x.p.kind === 'abstract' ? `abstract,${x.referrers.length ? `${x.referrers.join('、')} 引用它` : '沒有消費者'}` : ov.tag(x.p.fullName);
}

// 警訊:每條是 [哪裡, 什麼事, 怎麼辦]
export function warnings(design, a, ov, source, adapter, stale = new Set(), inv = invariantView(design, a), glob = globalView(design, a, source, adapter, inv)) {
  const sys = design.system;
  const listed = sys ? sys.listed : [];
  const unbound = design.features.map((f) => f.fullName).filter((f) => !ov.rank.has(f));
  const warns = [];
  const warn = (where, what, fix) => warns.push([where, what, fix]);
  if (!sys) warn('system.md', '不存在', 'dev-flow:project 立案');
  else {
    if (sys.visionState === 'missing') warn('system.md', '沒有 ## 願景 節', 'dev-flow:project 訂願景');
    else if (sys.visionState === 'template') warn('system.md', '願景還是模板', 'dev-flow:project 訂願景');
    if (sys.requirementsState === 'missing') warn('system.md', '沒有 ## 需求 節', design.legacyObjectives ? 'devflow migrate objectives --write' : 'dev-flow:project 訂需求');
    else if (!sys.requirements.length) warn('system.md', '沒有任何需求', 'devflow requirement add <一句話> --accept <句>(至少一條)');
    if (sys.globalState === 'missing') warn('system.md', '沒有 ## 全域 Law 區,看不出約束住在哪裡', 'devflow migrate laws --write');
  }
  for (const q of ov.reqs) {
    if (q.placeholder) warn(q.id, '需求還是模板', 'dev-flow:project 寫成一句話');
    if (!q.accept) warn(q.id, '沒有驗收', 'dev-flow:project 補一句可判定的話,寫成「- 驗收:…」');
    else if (q.accept.placeholder) warn(q.id, '驗收還是模板', 'dev-flow:project 寫成可判定的一句');
    else if (q.accept.formal && !q.tested) warn(q.id, '驗收寫了三行卻沒有驗收測試,達成與否未知', `dev-flow:build ${q.id}(只派 qa 寫一條歸屬 "${q.id}#ACCEPT" 的測試);不能自動化就只留一句,由建置路線推`);
    if (!q.objectives.length) warn(q.id, '沒有任何目標', `devflow objective add <slug> <一句話> --requirement ${q.id} --priority <1-4>`);
    if (q.built && q.holds === false) warn(q.id, `建置路線全部達成,需求卻未達成(${q.source})`, '驗收沒過:先查驗收測試,缺的能力開里程碑(dev-flow:objective),做錯的走 dev-flow:revise');
    for (const rf of q.rfs) if (rf.started && rf.cited && rf.green && q.holds === false) warn(rf.id, `優化後 ${q.id} 未達成(${q.source})`, '優化不准讓需求退回未達成:仲裁那條紅,或重開再修');
  }
  for (const v of inv) {
    if (v.holds === false) warn(v.id, `領域不變量未成立(${v.source})`, '有程式碼違反了它:仲裁那條紅,先歸因到是哪一份 feature 的實作再改');
    else if (!v.law.formal) warn(v.id, '還沒有三行式,成立與否未知', 'dev-flow:law-design 在最內層的型別出現後把它寫成三行(識別字只用最內層的匯出與型別名)');
    else if (!v.tested) warn(v.id, '寫了三行卻沒有測試,成立與否未知', `dev-flow:build ${v.id}(只派 qa 寫一條歸屬 "${v.id}#LAW" 的測試)`);
  }
  if (design.legacyObjectives) warn('objectives.md', '目標還擠在一份檔裡', 'devflow migrate objectives --write 拆成 objectives/ 一個目標一個檔');
  if (!ov.objs.length) warn(design.objectives.exists ? 'objectives/' : '.design/', '沒有任何目標', 'dev-flow:objective 訂第一個目標(至少一個)');
  else if (sys && sys.priorityNoteState !== 'ok') warn('system.md', sys.priorityNoteState === 'template' ? '優先各級代表什麼還是模板' : '沒有宣告優先 1 到 4 各代表什麼', 'dev-flow:objective 在「語言與工具」寫一行「- 優先:1 = …;2 = …;3 = …;4 = …」');
  const seenM = new Set();
  const seenRf = new Set();
  for (const o of ov.objs) {
    if (!o.hasFrontmatter) warn(o.file, '沒有 frontmatter', '照 templates/objective.md 補 id、requirement、priority、updated');
    else if (o.fileId !== o.id || (o.requirement && o.fileRequirement !== o.requirement)) warn(o.file, `檔名與 frontmatter 對不上(frontmatter:${o.requirement || '?'} ${o.id})`, '檔名 R-x-O-y-<slug> 的 R-x 與 O-y 要等於 frontmatter 的 requirement 與 id;目標換需求就改檔名');
    if (o.placeholder) warn(o.id, '目標還是模板', 'dev-flow:objective 寫成一句話');
    if (!o.requirement) warn(o.id, '沒有對到任何需求', 'dev-flow:objective 在 frontmatter 補 requirement: R-n;每個目標解決一條需求');
    else if (sys && !o.req) warn(o.id, `需求 ${o.requirement} 不在 system.md`, '改成 system.md 裡有的 R-n,或 devflow requirement add 先立需求');
    if (!o.priority) warn(o.id, `優先「${o.priorityRaw || '(沒填)'}」不是 1 到 4`, '改成 1(最高)到 4(最低)');
    if (!o.ms.length) warn(o.id, '沒有任何里程碑', 'dev-flow:objective 補里程碑(devflow objective milestone <O-n> <slug> <一句話>)');
    for (const m of o.ms) {
      if (seenM.has(m.id)) warn(m.id, '里程碑編號重複', '編號全資料夾唯一;配號只走 devflow objective milestone');
      seenM.add(m.id);
      if (m.placeholder) warn(m.id, '里程碑還是模板', 'dev-flow:objective 寫成一句話');
      if (!m.slug) warn(m.id, '沒有英文名,切片開不了分支', `dev-flow:objective 把第一格寫成 ${m.id}-<slug>(kebab-case 英文);切片的分支 build/${m.id}-<slug> 與決策紀錄以它為鍵`);
      for (const d of m.docs) {
        if (!d.x) warn(m.id, `綁定的 ${d.name} 不存在`, '改成 features/ 裡有的全名,或刪這個綁定');
        else if (d.x.p.kind === 'abstract') warn(m.id, `綁定的 ${d.name} 是 abstract`, '改綁引用它的 feature;abstract 跟著 feature 達成');
      }
    }
    for (const rf of o.rfs) {
      if (seenRf.has(rf.id)) warn(rf.id, '調整編號重複', '編號全資料夾唯一;配號只走 devflow objective refinement');
      seenRf.add(rf.id);
      if (rf.placeholder) warn(rf.id, '調整還是模板', 'dev-flow:objective 寫成一句話');
      if (!rf.touches.length) warn(rf.id, '沒有動到任何文檔', '動到欄填本目標里程碑綁定過的 feature 全名');
      for (const n of rf.missing) warn(rf.id, `動到的 ${n} 不存在`, '改成 features/ 裡有的全名');
      for (const n of rf.outside) if (!rf.missing.includes(n)) warn(rf.id, `動到的 ${n} 不在 ${o.id} 任何里程碑的綁定裡`, '優化路線不引入新 feature:只動本目標建置路線做出來的 feature;新能力開里程碑');
    }
  }
  for (const f of unbound) warn(f, '沒有被任何里程碑綁定', '不朝向任何目標:dev-flow:objective 綁進一條里程碑,或刪掉這份 feature');
  const consumers = new Map(design.abstracts.map((x) => [x.fullName, []]));
  for (const d of design.docs) for (const s of d.steps) if (s.ref && consumers.has(s.ref)) consumers.get(s.ref).push(d.fullName);
  for (const [name, cs] of consumers) if (new Set(cs).size === 1) warn(name, `只有 ${cs[0]} 用它`, '收整沒有成立;dev-flow:abstract 搬回去,或找出第二個消費者');
  for (const n of [...stale].sort()) warn(`build/${n}`, '已合進主線卻還在', 'dev-flow:integrate 開頭會清掉它;或 git worktree remove <工作樹> 後 git branch -d build/' + n);
  const gapIds = new Map();
  for (const g of design.gaps.gaps) gapIds.set(g.id, (gapIds.get(g.id) || 0) + 1);
  for (const [id, n] of gapIds) if (n > 1) warn(id, `gaps.md 裡出現 ${n} 次`, '兩條 build 分支各自配了同一個號;後合進來的往上移(roles.md「整合」)');
  for (const x of a.info.values()) {
    const p = x.p;
    if (!p.hasFrontmatter) warn(p.file, '沒有 frontmatter', '照 templates/ 補');
    if (p.status && !STATUSES.includes(p.status)) warn(p.file, `status「${p.status}」不合法`, '改成 draft / ready / verified');
    const t = p.template;
    if (t.steps || t.laws || t.examples) warn(p.fullName, `還是模板(${[t.steps && `Steps ${t.steps} 列`, t.laws && `Laws ${t.laws} 條`, t.examples && `Examples ${t.examples} 列`].filter(Boolean).join('、')}是佔位符)`, 'dev-flow:law-design 談完寫成真的');
    if (p.status === 'verified' && [...x.laws, ...x.examples].some((l) => l.result === 'red')) warn(p.fullName, 'verified 而測試紅', '先重開再修');
    if (p.status === 'verified' && p.revs.length && !p.thawed) warn(p.fullName, 'verified 而有 REV 卻沒有重開紀錄', '在「決定」補一條重開');
    if (p.status === 'ready' && x.achieved) warn(p.fullName, '已達成', 'build 收尾改 verified');
    if (listed.length && p.kind === 'feature' && !listed.some((l) => l.fullName === p.fullName)) warn(p.fullName, '不在 system.md 的 Features 表', '補一列');
    for (const s of x.steps) if (s.state === '不一致') warn(`${p.fullName}#${s.name}`, '簽名與程式碼不一致', 'devflow lint sig 看兩邊;誰對就改另一邊,改文檔走 REV');
    for (const s of x.steps) if (s.state === '搬家') warn(`${p.fullName}#${s.name}`, `程式碼在 ${s.hit.file}`, 'devflow sync');
    for (const l of [...x.laws, ...x.examples]) if (l.result === 'red') warn(l.key, '測試紅', '仲裁:先歸因再改');
  }
  for (const l of listed) {
    if (!design.docs.some((d) => d.fullName === l.fullName)) warn('system.md', `列了 ${l.fullName},features/ 沒有這個檔`, '刪那一列或 devflow claim');
  }
  for (const g of glob) if (g.red) warn(`全域 Law:${g.kind}`, `lint ${g.gate} ${g.red} 條不合規`, `devflow lint ${g.gate}`);
  return warns;
}

// 建議路線:steps 是編號的那幾條,一條都沒有時 note 是那一句話
export function suggestRoutes(design, a, ov, warnCount, building = new Set(), inv = invariantView(design, a)) {
  const steps = [];
  if (a.openGaps.length) steps.push(`先回答 ${a.openGaps.map((g) => g.id).join('、')}(dev-flow:revise),卡住的 step 才能重派`);
  const order = [...a.info.values()].filter((x) => !x.achieved && x.p.status === 'ready').sort((x, y) => ov.keyOf(x.p.fullName) - ov.keyOf(y.p.fullName) || x.refs.length - y.refs.length);
  for (const x of order) steps.push(`dev-flow:build ${x.p.fullName}(${lineTag(x, ov)})`);
  const drafts = [...a.info.values()].filter((x) => x.p.status === 'draft');
  for (const x of drafts) steps.push(`dev-flow:law-design ${x.p.fullName}(還是 draft:Law 談完、開發者拍板才改 ready,之後自動接上 build)`);
  // 還沒有切片的里程碑:每個目標下一條,照目標優先排
  for (const s of sliceLines(ov, building).openable) steps.push(`dev-flow:spike-impl ${s.m.fullName}(${sliceTag(s)})`);
  // 建置路線達成、驗收寫了三行卻沒有驗收測試的需求:build 只派 qa 寫那一條
  for (const q of ov.reqs) if (q.built && q.accept && q.accept.formal && !q.tested) steps.push(`dev-flow:build ${q.id}(建置路線達成,只派 qa 寫 ${q.id}#ACCEPT 的驗收測試)`);
  for (const v of inv) if (v.law.formal && !v.tested) steps.push(`dev-flow:build ${v.id}(只派 qa 寫 ${v.id}#LAW 的測試)`);
  // 優化路線:建置路線達成後才開,動到的 feature 先走 REV(依欄引用 RF-n),再 build
  for (const o of ov.objs) if (o.achieved) for (const rf of o.rfs) if (rf.state === '待修訂' && !rf.missing.length) steps.push(`${rf.id} ${rf.title}:dev-flow:revise ${rf.touches.join('、')}(REV 的依欄引用 ${rf.id}),再 dev-flow:build`);
  const allDone = [...a.info.values()].every((x) => x.achieved) && !a.openGaps.length;
  const lawsFalse = [...ov.reqs.filter((q) => q.holds !== true).map((q) => `需求 ${q.id} ${metWord(q.holds)}(${q.source})`), ...inv.filter((v) => v.holds !== true).map((v) => `領域不變量 ${v.id} ${holdsWord(v.holds)}(${v.source})`)];
  let note = null;
  if (!steps.length) {
    const notDone = [...a.info.values()].filter((x) => !x.achieved);
    if (!a.info.size) note = `還沒有任何文檔;${ov.objs.length ? 'dev-flow:objective 給第一條里程碑一個英文名,再 dev-flow:spike-impl <M-n-slug> 做第一條切片' : '先 dev-flow:objective 訂目標與里程碑,再 dev-flow:spike-impl <M-n-slug>'}`;
    else if (allDone && lawsFalse.length) note = `每份文檔達成,但${lawsFalse.join('、')}:先補上,不加新功能`;
    else if (allDone && !warnCount) note = '目前功能全部正常運作:每份文檔達成、每條需求達成、每條領域不變量成立、測試全綠、沒有 open GAP、沒有警訊。沒有非做不可的事,可以加新功能:devflow requirement add 或 dev-flow:objective';
    else if (allDone) note = `目前功能全部正常運作(每份文檔達成、每條需求達成、每條領域不變量成立、測試全綠、沒有 open GAP);警訊還有 ${warnCount} 條,照第 7 段的怎麼辦欄清,清完加新功能`;
    else if (notDone.some((x) => x.unknown || x.laws.some((l) => l.result === '未跑'))) note = `沒有可派的線,但 ${notDone.map((x) => x.p.fullName).join('、')} 的 laws 綠幾條未知:先給測試輸出(--tests <log> 或 --run),才知道功能是不是全部正常`;
    else note = `沒有可派的線,但 ${notDone.map((x) => x.p.fullName).join('、')} 還沒達成:devflow status --doc <全名> 看哪一列還不在;不加新功能`;
  }
  return { steps, note, allDone: allDone && !lawsFalse.length };
}

// 需求、目標、里程碑、調整、feature、文檔的總數與達成數:報告的第二行與看板的數字同源
export function counts(design, a, ov, inv = invariantView(design, a)) {
  const features = design.features.map((f) => f.fullName);
  const milestones = ov.objs.flatMap((o) => o.ms);
  const rfs = ov.objs.flatMap((o) => o.rfs);
  const todo = [...a.info.values()].flatMap((x) => x.steps.filter((s) => s.state === '找不到' || (s.hit && s.hit.stub)).map((s) => ({ ...s, doc: x.p.fullName })));
  return {
    requirements: ov.reqs.length,
    requirementsHolding: ov.reqs.filter((q) => q.holds === true).length,
    requirementsTested: ov.reqs.filter((q) => q.holds === true && q.tested).length,
    requirementsInferred: ov.reqs.filter((q) => q.holds === true && !q.tested).length,
    invariants: inv.length,
    invariantsHolding: inv.filter((v) => v.holds === true).length,
    objectives: ov.objs.length,
    objectivesAchieved: ov.objs.filter((o) => o.achieved).length,
    milestones: milestones.length,
    milestonesAchieved: milestones.filter((m) => m.achieved).length,
    refinements: rfs.length,
    refinementsAchieved: rfs.filter((rf) => rf.achieved).length,
    features: features.length,
    featuresAchieved: features.filter((m) => a.info.has(m) && a.info.get(m).achieved).length,
    abstracts: design.abstracts.length,
    docs: a.info.size,
    docsAchieved: [...a.info.values()].filter((x) => x.achieved).length,
    todo,
    openGaps: a.openGaps.length,
  };
}

export function statusReport(design, source, adapter, results, resultNote, building = new Set(), stale = new Set(), phases = new Map()) {
  const a = analyze(design, source, adapter, results);
  const out = [];
  const features = design.features.map((f) => f.fullName);
  const ov = objectiveView(design, a);
  const inv = invariantView(design, a);
  const n = counts(design, a, ov, inv);
  const todo = n.todo;
  const phase = (key) => (phases.has(key) ? `;${phases.get(key)}` : '');
  const sys = design.system;

  out.push('# devflow status');
  if (sys && sys.visionState === 'ok') out.push(`願景:${sys.vision}`);
  out.push(`需求 ${n.requirements} 條,達成 ${n.requirementsHolding} 條(測試 ${n.requirementsTested}、推得 ${n.requirementsInferred})· 領域不變量 ${n.invariants} 條,成立 ${n.invariantsHolding} 條 · 目標 ${n.objectives} 個,達成 ${n.objectivesAchieved} 個 · 里程碑 ${n.milestones} 條,達成 ${n.milestonesAchieved} 條 · 調整 ${n.refinements} 條,達成 ${n.refinementsAchieved} 條 · feature ${n.features} 份,達成 ${n.featuresAchieved} 份 · abstract ${n.abstracts} 份 · 文檔共 ${n.docs} 份,達成 ${n.docsAchieved} 份 · 還沒實作的 step ${todo.length} 個 · 還開著的 GAP ${n.openGaps} 條`);
  out.push(`· ${resultNote}`);
  out.push('');
  out.push('## 需求');
  if (!sys) out.push('- 沒有 system.md;dev-flow:project 建它');
  else if (!ov.reqs.length) out.push(`- 沒有任何需求;${design.legacyObjectives ? 'devflow migrate objectives --write' : 'devflow requirement add <一句話> --accept <句>'}`);
  else {
    out.push('| 需求 | 一句話 | 驗收 | 目標 | 目標達成 | 里程碑達成 | 調整達成 |', '|---|---|---|---|---|---|---|');
    for (const q of ov.reqs) out.push(`| ${q.id} | ${q.title} | ${metWord(q.holds)}(${q.source}) | ${q.objectives.map((o) => o.id).join('、') || '-'} | ${q.objectives.filter((o) => o.achieved).length}/${q.objectives.length} | ${q.ms.filter((m) => m.achieved).length}/${q.ms.length} | ${q.rfs.filter((rf) => rf.achieved).length}/${q.rfs.length} |`);
  }
  out.push('');
  out.push('## 目標');
  if (!ov.objs.length) out.push('- 沒有任何目標;dev-flow:objective 訂第一個');
  else {
    if (sys && sys.priorityNoteState === 'ok') out.push(`- 優先:${sys.priorityNote}`);
    out.push('| 目標 | 需求 | 優先 | 一句話 | 里程碑總數 | 里程碑達成 | 完成度 | 調整達成 |', '|---|---|---|---|---|---|---|---|');
    for (const o of ov.objs) out.push(`| ${o.id} | ${o.requirement || '(沒填)'} | ${o.priorityRaw || '(沒填)'} | ${o.title} | ${o.ms.length} | ${o.done} | ${o.pct == null ? '-' : `${o.pct}%`} | ${o.rfs.length ? `${o.rfDone}/${o.rfs.length}` : '-'} |`);
    for (const o of ov.objs) {
      const next = o.ms.find((m) => !m.achieved);
      const state = (d) => (!d.x ? '不存在' : d.x.achieved ? '達成' : d.x.gaps.length ? `卡 ${d.x.gaps.map((g) => g.id).join('、')}` : d.x.p.status === 'draft' ? '還是 draft' : '進行中');
      if (next) out.push(`- ${o.id} 下一個里程碑:${next.id} ${next.title}${next.docs.length ? `(${next.docs.map((d) => `${d.name} ${state(d)}`).join('、')})` : (next.slug ? `(還沒有切片:dev-flow:spike-impl ${next.fullName})` : '(還沒有切片,也還沒有英文名)')}`);
      else {
        const rf = o.rfs.find((r) => !r.achieved);
        if (rf) out.push(`- ${o.id} 建置路線達成;下一個調整:${rf.id} ${rf.title}(${rf.state},動到 ${rf.touches.join('、') || '-'})`);
      }
    }
  }
  const unbound = features.filter((f) => !ov.rank.has(f));
  if (unbound.length) out.push(`- 沒有被任何里程碑綁定的 feature:${unbound.join('、')};它們不朝向任何目標`);
  out.push('');
  const glob = globalView(design, a, source, adapter, inv);
  out.push('## 全域 Law');
  if (!glob.length) out.push('- 沒有 system.md');
  else {
    out.push('| 類別 | 住 system.md 的哪一區 | 自動確認 | 結果 |', '|---|---|---|---|');
    for (const g of glob) out.push(`| ${g.kind} | 全域 Law › ${g.where} | devflow lint ${g.gate} | ${g.result} |`);
  }
  out.push('');
  if (!inv.length) out.push('- 領域不變量:無');
  else {
    out.push('| 領域不變量 | 種類 | 一句話 | 成立 |', '|---|---|---|---|');
    for (const v of inv) out.push(`| ${v.id} | ${v.kind || '-'} | ${v.title} | ${holdsWord(v.holds)}(${v.source}) |`);
  }
  out.push('');
  out.push('## 文檔');
  out.push('| 文檔 | 類別 | status | 文檔簽名數 | 程式碼對到 | 未實作 | law 條數 | law 綠/翻 | REV | 狀態 |');
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const x of a.info.values()) out.push(row(x));

  out.push('', '## 1. 今天能開幾條線');
  const { openable, inBuild, shared } = openLines(a, ov, building);
  const slices = sliceLines(ov, building);
  if (!openable.length && !slices.openable.length) out.push('- 無');
  for (const x of openable) out.push(`- ${x.p.fullName}:dev-flow:build ${x.p.fullName}(${lineTag(x, ov)})`);
  for (const s of slices.openable) out.push(`- ${s.m.fullName}:dev-flow:spike-impl ${s.m.fullName}(${sliceTag(s)})`);
  for (const x of inBuild) out.push(`- ${x.p.fullName}:建構中,分支 build/${buildKeyOf(x, ov, building)}${phase(buildKeyOf(x, ov, building))};收尾後 dev-flow:integrate`);
  for (const s of slices.inBuild) out.push(`- ${s.m.fullName}:建構中,分支 build/${s.m.fullName}${phase(s.m.fullName)}`);
  for (const s of shared) out.push(`- ${s.a} 與 ${s.b} 的 step 都住 ${s.files.map((m) => `\`${m}\``).join('、')}:可以同時開,整合時這些檔案兩邊都動`);

  out.push('', '## 2. 卡住的');
  let stuck = 0;
  for (const x of a.info.values()) {
    for (const g of x.gaps) {
      stuck++;
      out.push(`- ${g.target} 停在 ${g.id}(${g.role} 提)`);
    }
    for (const r of x.blockedBy) {
      const y = a.info.get(r);
      stuck++;
      const why = y.p.status === 'draft' ? '還是 draft'
        : y.gaps.length ? `卡 ${y.gaps.map((g) => g.id).join('、')}`
        : buildKeyOf(y, ov, building) ? `建構中,分支 build/${buildKeyOf(y, ov, building)}`
        : y.unknown || y.laws.some((l) => l.result === '未跑') ? '達成與否未知,給測試輸出'
        : '未達成,先建它';
      out.push(`- ${x.p.fullName} 等 ${r}(${why})`);
    }
  }
  if (!stuck) out.push('- 無');

  out.push('', '## 3. 等決定');
  let deciding = 0;
  for (const g of a.openGaps) {
    deciding++;
    out.push(`- ${g.id}(${g.target} / ${g.role}):dev-flow:revise`);
  }
  for (const x of a.info.values()) if (x.p.status === 'draft') {
    deciding++;
    out.push(`- ${x.p.fullName} 還是 draft:dev-flow:law-design 談完 Law、開發者拍板才改 ready`);
  }
  if (!deciding) out.push('- 無');

  out.push('', '## 4. 牽動誰');
  let touched = 0;
  for (const x of a.info.values()) if (x.referrers.length) {
    touched++;
    out.push(`- ${x.p.fullName} ← ${x.referrers.join('、')}`);
  }
  if (!touched) out.push('- 無');

  out.push('', '## 5. 待實作(按檔案)');
  const byModule = new Map();
  for (const s of todo) {
    if (!byModule.has(s.module)) byModule.set(s.module, []);
    byModule.get(s.module).push(s);
  }
  if (!byModule.size) out.push('- 無');
  for (const [m, list] of [...byModule].sort()) out.push(`- ${m}:${list.map((s) => `${s.doc}#${s.name}${s.hit && s.hit.stub ? '(未實作)' : s.observe ? '(觀察點)' : ''}`).join('、')}`);

  out.push('', '## 6. 修訂熱點');
  const hot = [...a.info.values()].filter((x) => x.p.revs.length).sort((x, y) => y.p.revs.length - x.p.revs.length).slice(0, 3);
  if (!hot.length) out.push('- 無(還沒有任何 REV)');
  for (const x of hot) out.push(`- ${x.p.fullName}:REV ${x.p.revs.length} 條,最後一條「${(x.p.lastRev || '').slice(0, 60)}」`);
  const wide = [...a.info.values()].filter((x) => x.referrers.length >= 2).sort((x, y) => y.referrers.length - x.referrers.length).slice(0, 3);
  for (const x of wide) out.push(`- ${x.p.fullName}:${x.referrers.length} 份文檔引用它,改它要一起 REV`);

  out.push('', '## 7. 警訊');
  const warns = warnings(design, a, ov, source, adapter, stale, inv, glob);
  if (!warns.length) out.push('- 無');
  else {
    out.push('| 哪裡 | 什麼事 | 怎麼辦 |', '|---|---|---|');
    for (const [w, what, fix] of warns) out.push(`| ${w} | ${what} | ${fix} |`);
  }

  out.push('', '## 8. 建議路線');
  const route = suggestRoutes(design, a, ov, warns.length, building, inv);
  route.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
  if (route.note) out.push(`- ${route.note}`);

  return { text: out.join('\n'), exitCode: route.allDone && a.info.size ? 0 : 1 };
}

export function docDetail(design, source, adapter, results, resultNote, name) {
  const a = analyze(design, source, adapter, results);
  const x = [...a.info.values()].find((v) => v.p.fullName === name || v.p.id === name);
  if (!x) return { text: `沒有 ${name} 這份文檔`, exitCode: 1 };
  const out = [`# ${x.p.fullName}  ${x.p.kind}  ${x.p.status}`, x.p.description, `· ${resultNote}`, '', '## Steps'];
  for (const s of x.steps) out.push(`- ${s.index}  ${s.sigText}  ${s.module}/${s.layer}  ${s.state}${s.state === '搬家' ? ` → ${s.hit.file}` : ''}${s.ref ? `  見 ${s.ref}` : ''}`);
  out.push('', '## Laws');
  for (const l of x.laws) out.push(`- ${l.id} [${l.kind}] ${l.title}  ${l.result}`);
  for (const e of x.examples) out.push(`- ${e.id} 覆蓋 ${e.covers.join('、')}  ${e.result}`);
  out.push('', '## GAP');
  if (!x.gaps.length) out.push('- 無');
  for (const g of x.gaps) out.push(`- ${g.id}(${g.target} / ${g.role})`);
  out.push('', '## 引用');
  out.push(`- 引用了:${x.refs.length ? x.refs.join('、') : '無'}`);
  out.push(`- 被引用:${x.referrers.length ? x.referrers.join('、') : '無'}`);
  out.push('', '## 修訂');
  if (!x.p.revs.length) out.push('- 無');
  for (const rv of x.p.revs) out.push(`- ${rv.text}`);
  const obs = x.obsTotal ? ` · 觀察點 ${x.obsTotal} 個,程式碼裡有 ${x.obsOk} 個` : '';
  out.push('', `文檔寫了 ${x.sigTotal} 條簽名,程式碼裡有 ${x.sigOk} 條,未實作的 ${x.stubCount} 條${obs} · 寫了 ${x.laws.length} 條 law,通過 ${x.unknown ? 'nan' : x.laws.filter((l) => l.result === 'green').length} 條 · ${x.achieved ? '達成' : '未達成'}`);
  return { text: out.join('\n'), exitCode: 0 };
}

export function moduleDetail(design, source, adapter, results, resultNote, pattern) {
  const a = analyze(design, source, adapter, results);
  const entry = design.modules ? matchModule(design.modules.entries, pattern) : null;
  const inCode = source ? [...source.files.keys()].filter((m) => matchesPattern(pattern, m) || m === pattern) : [];
  if (!entry && !inCode.length) return { text: `模組表與程式碼都沒有 ${pattern}`, exitCode: 1 };
  const out = [`# ${pattern}  ${entry ? entry.layer + ' 層' : '未登記'}`, `· ${resultNote}`, ''];
  let n = 0;
  for (const x of a.info.values()) {
    for (const s of x.steps) {
      if (!(s.module === pattern || matchesPattern(pattern, s.module) || (s.hit && s.hit.file === pattern))) continue;
      n++;
      const lawsOn = x.laws.filter((l) => l.conclusion && new RegExp(`(?<![\\w.])${s.name.replace(/\./g, '\\.')}(?![\\w])`).test(l.conclusion));
      const g = lawsOn.filter((l) => l.result === 'green').length;
      out.push(`- ${x.p.fullName}#${s.name}  ${s.state}  掛在上面的 law ${lawsOn.length} 條,通過 ${x.unknown ? 'nan' : g} 條`);
    }
  }
  if (!n) out.push('- 沒有任何文檔的 step 住在這裡');
  return { text: out.join('\n'), exitCode: 0 };
}
