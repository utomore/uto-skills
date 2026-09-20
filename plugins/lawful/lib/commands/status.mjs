// status:派工報告。全部從 .lawful、程式碼與測試輸出推。
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { layerRoot, unitOf, STATUSES, KINDS } from '../design.mjs';
import { findSignature } from '../source.mjs';
import { lintBoundary, lintInvariants, lintIo } from './lint.mjs';
import { worktrees } from './edit.mjs';

// 對每條 pipeline 算 { stages: [{...state}], sigOk, sigTotal, laws, lawsGreen, lawsTraced, gaps, refs, achieved }
export function analyze(design, source, adapter, results) {
  const byName = new Map(design.pipelines.map((p) => [p.fullName, p]));
  const byId = new Map(design.pipelines.map((p) => [p.id, p]));
  const markers = new Map();
  if (source) for (const t of source.testFiles) for (const m of t.markers) markers.set(m, (markers.get(m) || 0) + 1);
  const openGaps = design.gaps.gaps.filter((g) => g.status === 'open');
  const info = new Map();

  for (const p of design.pipelines) {
    const stages = p.stages.map((s) => {
      const hits = source ? findSignature(source, s.name) : [];
      const hit = hits.find((h) => h.module === s.module) || hits[0] || null;
      let state;
      if (!source) state = '未查';
      else if (!hit) state = '找不到';
      else if (adapter.normalizeType(s.type) !== hit.type) state = '不一致';
      else if (hit.module !== s.module) state = '搬家';
      else if (hit.stub) state = '未實作';
      else state = '在';
      return { ...s, state, hit };
    });
    // 簽名 m / n 只算步驟(數字列與 = 列);o 列是觀察點,另計,找不到或不一致一樣擋達成
    const present = (s) => s.state === '在' || s.state === '搬家' || s.state === '未實作';
    const steps = stages.filter((s) => !s.observe);
    const observes = stages.filter((s) => s.observe);
    const sigOk = steps.filter(present).length;
    const obsOk = observes.filter(present).length;
    const stubCount = stages.filter((s) => s.hit && s.hit.stub).length;
    const laws = p.laws.filter((l) => l.id).map((l) => {
      const key = `${p.id}#${l.id}`;
      const traced = markers.has(key);
      const res = results ? results.get(key) : undefined;
      // 結果只認這棵樹裡有測試承接的標記:輸出裡有、樹裡沒有的是別的時間點留下的輸出
      return { ...l, key, traced, orphan: !traced && !!res, result: traced ? res || '未跑' : '未翻譯' };
    });
    const examples = p.examples.map((e) => {
      const key = `${p.id}#${e.id}`;
      const traced = markers.has(key);
      const res = results ? results.get(key) : undefined;
      return { ...e, key, traced, orphan: !traced && !!res, result: traced ? res || '未跑' : '未翻譯' };
    });
    const gaps = openGaps.filter((g) => g.target.startsWith(p.id) || g.target.startsWith(p.fullName));
    const refs = [...new Set(p.stages.map((s) => s.ref).filter(Boolean))];
    info.set(p.fullName, { p, stages, sigOk, sigTotal: steps.length, stubCount, obsOk, obsTotal: observes.length, laws, examples, gaps, refs, referrers: [] });
  }
  // 依賴只從模組欄的「見 P-00x-<slug>」來:A 引用 B 的簽名,A 依賴 B;B 不因為被引用而等 A。
  for (const [, x] of info) for (const r of x.refs) if (info.has(r)) info.get(r).referrers.push(x.p.fullName);
  // 同一個名字出現在兩條 pipeline 的 Stages 表、兩邊都沒註明「見」:分不出誰引用誰,列警訊,不算依賴
  const unmarked = [];
  for (const [, x] of info) {
    for (const s of x.stages) {
      if (s.ref || !s.name) continue;
      for (const [, y] of info) {
        if (y === x || x.p.fullName > y.p.fullName) continue;
        if (y.stages.some((t) => t.name === s.name && !t.ref)) unmarked.push({ name: s.name, a: x.p.fullName, b: y.p.fullName });
      }
    }
  }
  const selfDone = (x) => x.sigOk === x.sigTotal && x.sigTotal > 0 && x.stubCount === 0 && x.obsOk === x.obsTotal && x.laws.length > 0 && x.laws.every((l) => l.result === 'green') && x.examples.every((e) => e.result === 'green') && x.gaps.length === 0;
  const achieved = (name, seen = new Set()) => {
    if (seen.has(name)) return true;
    seen.add(name);
    const x = info.get(name);
    if (!x) return false;
    return selfDone(x) && x.refs.every((r) => achieved(r, seen));
  };
  // 先把每條的 achieved 算完,再算 blockedBy:引用排在後面的 pipeline 時,它的 achieved 才有值
  for (const [name, x] of info) {
    x.selfDone = selfDone(x);
    x.achieved = achieved(name);
    x.unknown = !results && x.laws.some((l) => l.traced);
  }
  for (const [, x] of info) x.blockedBy = x.refs.filter((r) => info.has(r) && !info.get(r).achieved);
  // 需求的驗收與領域不變量也是測試標記(R-n#ACCEPT / INV-n#LAW):有測試就以測試為準
  const lawTest = (key) => {
    const alias = /^R-\d+#ACCEPT$/.test(key) && !markers.has(key) ? key.replace('#ACCEPT', '#LAW') : key;
    if (!markers.has(alias)) return null;
    const res = results ? results.get(alias) : undefined;
    return { key, result: res || '未跑' };
  };
  return { info, byName, byId, openGaps, markers, unmarked, lawTest };
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

// 建構中 = 有 build/<鍵> 分支,而且它還沒被合進主線。鍵是里程碑全名 M-n-<slug>(一條切片)、pipeline 全名(一次修訂)、或 R-n / INV-n(一條驗收測試)。
// 合進主線的分支是做完了沒人收的殘留,不是有人在建;它列成警訊,清掉是整合的職責(roles.md「整合」)。
// 只在專案根目錄有 .git 時問 git;沒有(夾具、匯出的樹)就一條都不算,報告不受環境影響。
// phaseOf(工作樹根目錄, 鍵) 由呼叫端給:它讀那棵樹的 .lawful 與程式碼,回這條線走到哪一步(slicePhase)。
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
// 還沒有決策紀錄 = 切片中;有決策紀錄而里程碑還沒綁 pipeline = 切片完成;綁的 pipeline 有 draft = Law 討論中;
// 都拍板了而 law 還沒有測試歸屬 = Law 已定;有歸屬 = 調整中;都 verified = qa 與 refactor 做完、每條 law 成立。
export function slicePhase(design, source, key) {
  const m = design.requirements.requirements.flatMap((q) => q.milestones).find((ms) => ms.fullName === key || ms.id === key);
  const docs = m ? m.binds.map((b) => design.pipelines.find((d) => d.fullName === b)).filter(Boolean) : design.pipelines.filter((d) => d.fullName === key);
  if (!m && !docs.length) return '';
  if (!docs.length) return design.journals.some((j) => j.key === key) ? '切片完成,等 lawful:scope-laws' : '切片中';
  if (docs.some((d) => d.status === 'draft')) return 'Law 討論中';
  if (docs.every((d) => d.status === 'verified')) return 'verified,等 lawful:integrate';
  const markers = new Set(source ? source.testFiles.flatMap((t) => t.markers) : []);
  const traced = docs.every((d) => d.laws.length && d.laws.every((l) => markers.has(`${d.id}#${l.id}`)));
  return traced ? '調整中' : 'Law 已定,等 qa';
}

export function buildingBranches(root) {
  return branchState(root).building;
}

// 測試輸出裡一條 P-00x#LAW-n / EX-n 標記都沒有,就不是「全部沒過」,是讀不到:當成沒給輸出,通過數印 nan。
function checked(results, note) {
  if (results.size) return { results, note };
  return { results: null, note: `${note};輸出裡沒有任何 P-00x#LAW-n 標記,幾條 law 通過測試未知(指令跑錯目錄、跑失敗、或測試名沒帶歸屬字串)` };
}

export function loadResults(design, adapter, flags, root) {
  if (!adapter || !adapter.testResults) return { results: null, note: '此 adapter 不解析測試輸出' };
  if (flags.tests) {
    if (!fs.existsSync(flags.tests)) return { results: null, note: `找不到測試輸出 ${flags.tests}` };
    return checked(adapter.testResults(fs.readFileSync(flags.tests, 'utf8')), `測試結果來自 ${flags.tests}`);
  }
  if (flags.run) {
    const cmd = design.cone && design.cone.commands['測試(整套)'];
    if (!cmd) return { results: null, note: 'Cone.md「專案約束」沒有整套測試指令,--run 不知道跑什麼' };
    let out = '';
    let exit = 0;
    try {
      out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      out = (e.stdout || '') + (e.stderr || '');
      exit = e.status == null ? 1 : e.status;
    }
    return checked(adapter.testResults(out), `測試結果來自 --run:${cmd}${exit ? `(指令 exit ${exit})` : ''}`);
  }
  return { results: null, note: '沒給測試輸出(--tests <log> 或 --run),幾條 law 通過測試未知' };
}

// 測試結果 → Law 成立與否:green 成立、red 未成立、其餘(未跑、pending)未知
const verdict = (result) => (result === 'green' ? true : result === 'red' ? false : null);
export const holdsWord = (holds) => (holds === true ? '成立' : holds === false ? '未成立' : '未知');
export const metWord = (met) => (met === true ? '達成' : met === false ? '未達成' : '未知');

// 需求 → 里程碑 / 調整 → pipeline。
// 里程碑達成 = 綁定的每條 pipeline 都達成;里程碑依表上的順序走,全部達成 = 這條需求的建置走完(built)。
// 需求達成:有 R-n#ACCEPT 驗收測試以它為準;驗收寫了三行卻沒有測試是未知;一句話的驗收沒有測試 = 里程碑全部達成(推得),一條里程碑都沒有就未達成。
// 調整達成 = 動到的每條 pipeline 都有一條 REV 引用它、都達成,而且需求仍達成。
// rank 給每條 pipeline 一個排序鍵(需求優先、需求順序、里程碑順序),建議路線與能開的線照它排;沒被綁的排最後。
export function requirementView(design, a) {
  const reqs = design.requirements.requirements.map((q) => {
    const ms = q.milestones.map((m) => {
      const docs = m.binds.map((b) => ({ name: b, x: a.info.get(b) || null }));
      const achieved = docs.length > 0 && docs.every((d) => d.x && d.x.achieved);
      return { ...m, docs, achieved };
    });
    const done = ms.filter((m) => m.achieved).length;
    const built = ms.length > 0 && done === ms.length;
    const rfs = q.refinements.map((rf) => {
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
    // 三行式的驗收只由測試判,沒有測試就是未知;一句話的驗收才由里程碑推
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
    } else if (!ms.length) {
      holds = false;
      source = '還沒有里程碑';
    } else if (built) {
      holds = true;
      source = '推得:里程碑全部達成';
    } else {
      holds = false;
      source = `${ms.filter((m) => !m.achieved).map((m) => m.fullName).join('、')} 還沒達成`;
    }
    for (const rf of rfs) {
      rf.state = !rf.started ? '待修訂' : rf.cited && rf.green && holds === true ? '達成' : '進行中';
      rf.achieved = rf.state === '達成';
    }
    return { ...q, ms, done, pct: ms.length ? Math.round((done / ms.length) * 100) : null, built, rfs, rfDone: rfs.filter((rf) => rf.achieved).length, holds, source, tested: !!test };
  }).sort((x, y) => (x.priority || 5) - (y.priority || 5) || Number(x.id.slice(2)) - Number(y.id.slice(2)) || x.fullName.localeCompare(y.fullName));
  const rank = new Map();
  reqs.forEach((q, qi) => q.ms.forEach((m, mi) => m.binds.forEach((b) => {
    if (!rank.has(b)) rank.set(b, { q, m, key: (q.priority || 5) * 1e6 + qi * 1e3 + mi });
  })));
  const keyOf = (name) => (rank.has(name) ? rank.get(name).key : 9e9);
  const tag = (name) => (rank.has(name) ? `${rank.get(name).q.id} 優先 ${rank.get(name).q.priority || '?'} · ${rank.get(name).m.fullName} ${rank.get(name).m.title}` : '沒有被任何里程碑綁定');
  // 需求之間誰疊在誰上面,從 pipeline 的引用推:這條需求的里程碑綁的 pipeline 引用了別條需求的里程碑綁的 pipeline,它就依賴那一條
  for (const q of reqs) {
    const deps = new Set();
    for (const m of q.ms) for (const d of m.docs) {
      // 綁的是別條需求先綁過的 pipeline(靠修訂既有的 pipeline 達成的里程碑),或它引用了別條需求的 pipeline
      for (const r of [d.name, ...(d.x ? d.x.refs : [])]) {
        const at = rank.get(r);
        if (at && at.q.id !== q.id) deps.add(at.q.id);
      }
    }
    q.dependsOn = [...deps].sort((x, y) => Number(x.slice(2)) - Number(y.slice(2)));
  }
  return { reqs, rank, keyOf, tag };
}

// 領域不變量:整個專案都不准違反的 law。只由測試判:有 INV-n#LAW 測試以它為準;寫了三行卻沒有測試、或還沒有三行式,都是未知。
export function invariantView(design, a) {
  return (design.cone ? design.cone.invariants : []).map((v) => {
    const test = a.lawTest(`${v.id}#LAW`);
    if (test) return { ...v, holds: verdict(test.result), source: `測試 ${test.key} ${test.result}`, tested: true };
    if (v.law.formal) return { ...v, holds: null, source: `寫了三行卻沒有 ${v.id}#LAW 測試`, tested: false };
    return { ...v, holds: null, source: '還沒有三行式', tested: false };
  });
}

// 全域 Law 三類各一列:住 Cone.md 的哪一區、哪一道 lint 自動確認、現在的結果。報告、警訊與看板同源。
export function globalView(design, a, source, adapter, inv = invariantView(design, a)) {
  if (!design.cone) return [];
  const word = (r) => (r.red.length ? `${r.red.length} 條不合規` : '通過');
  const b = lintBoundary(design, source, adapter);
  const io = lintIo(design, source, adapter);
  const iv = lintInvariants(design, source, adapter);
  const cited = [...new Set(design.io.flatMap((row) => row.contract || []))];
  // 沒給測試輸出時,幾條成立是讀不到,不是零
  const blind = [...a.info.values()].some((y) => y.unknown);
  const citedHolding = cited.filter((c) => {
    if (/^INV-/.test(c)) return inv.some((v) => v.id === c && v.holds === true);
    const m = /^(P-\d{3})#(LAW-\d+)$/.exec(c);
    const x = m && [...a.info.values()].find((y) => y.p.id === m[1]);
    return !!(x && x.laws.some((l) => l.id === m[2] && l.result === 'green'));
  });
  return [
    { kind: '架構', where: '架構:四層', gate: 'boundary', red: source ? b.red.length : 0, result: source ? `四層,${word(b)}` : '四層,沒有程式碼可對' },
    { kind: '契約', where: '契約:對外 I/O', gate: 'io', red: io.red.length, result: `${design.io.length} 列,${word(io)};契約欄指到的 law ${cited.length} 條,成立 ${blind ? 'nan' : citedHolding.length} 條` },
    { kind: '領域不變量', where: '領域不變量', gate: 'invariants', red: iv.red.length, result: `${inv.length} 條,${word(iv)};成立 ${blind ? 'nan' : inv.filter((v) => v.holds === true).length} 條` },
  ];
}

// 每條需求下一條還沒達成的里程碑,如果它還沒綁任何 pipeline,就是一條可以開的切片(要有英文名才有分支可開)
export function sliceLines(ov, building) {
  const next = ov.reqs.map((q) => ({ q, m: q.ms.find((m) => !m.achieved) })).filter((s) => s.m && !s.m.binds.length && s.m.slug);
  return {
    openable: next.filter((s) => !building.has(s.m.fullName)),
    inBuild: next.filter((s) => building.has(s.m.fullName)),
  };
}
export const sliceTag = (s) => `${s.q.id} 優先 ${s.q.priority || '?'} · ${s.m.title}`;

// 一條 pipeline 是不是正在某條 build 分支上:它自己的(修訂那波),或綁它的那條里程碑的(切片那波)
export function buildKeyOf(x, ov, building) {
  if (building.has(x.p.fullName)) return x.p.fullName;
  const at = ov.rank.get(x.p.fullName);
  return at && building.has(at.m.fullName) ? at.m.fullName : null;
}

// 一條 pipeline 在報告與看板上的同一句狀態
export function docState(x) {
  return x.achieved ? '達成' : x.gaps.length ? `卡 ${x.gaps.map((g) => g.id).join('、')}` : x.blockedBy.length ? `等 ${x.blockedBy.join('、')}` : '進行中';
}

function row(x) {
  const g = x.laws.filter((l) => l.result === 'green').length;
  const traced = x.laws.filter((l) => l.traced).length;
  return `| ${x.p.fullName} | ${x.p.kind || '(沒填)'} | ${x.p.status || '(無)'} | ${x.sigTotal} | ${x.sigOk} | ${x.stubCount} | ${x.laws.length} | ${x.unknown ? 'nan' : g}/${traced} | ${docState(x)} |`;
}

// 能開 = ready、沒 open GAP、引用的 subflow 全部達成(消費者在 subflow 合進主線之後才開,roles.md「分支與所有權」)
export function openLines(a, ov, building, entries = []) {
  const candidates = [...a.info.values()].filter((x) => x.p.status === 'ready' && !x.achieved && !x.gaps.length && !x.blockedBy.length).sort((x, y) => ov.keyOf(x.p.fullName) - ov.keyOf(y.p.fullName));
  const openable = candidates.filter((x) => !buildKeyOf(x, ov, building));
  const inBuild = candidates.filter((x) => buildKeyOf(x, ov, building));
  // 兩條能開的線的 stage 住同一個模組單元:同時開,整合時那個單元的檔兩邊都動
  const unitsOf = (x) => [...new Set(x.stages.filter((s) => !s.ref).map((s) => {
    const e = unitOf(entries, s.module);
    return e ? e.unit : s.module;
  }))];
  const shared = [];
  for (let i = 0; i < openable.length; i++) for (let j = i + 1; j < openable.length; j++) {
    const mine = unitsOf(openable[i]);
    const theirs = new Set(unitsOf(openable[j]));
    const units = mine.filter((u) => theirs.has(u));
    if (units.length) shared.push({ a: openable[i].p.fullName, b: openable[j].p.fullName, units });
  }
  return { openable, inBuild, shared };
}

// 警訊:每條是 [哪裡, 什麼事, 怎麼辦]
export function warnings(design, a, ov, source, adapter, stale = new Set(), inv = invariantView(design, a), glob = globalView(design, a, source, adapter, inv)) {
  const cone = design.cone;
  const unbound = [...a.info.keys()].filter((n) => !ov.rank.has(n));
  const warns = [];
  const warn = (where, what, fix) => warns.push([where, what, fix]);
  if (!cone) warn('Cone.md', '不存在', design.legacySystem ? 'lawful migrate cone --write' : 'lawful:kickoff 立案');
  else {
    if (cone.visionState === 'missing') warn('Cone.md', '沒有 ## 願景 節', 'lawful:kickoff 訂願景');
    else if (cone.visionState === 'template') warn('Cone.md', '願景還是模板', 'lawful:kickoff 訂願景');
    if (cone.globalState === 'missing') warn('Cone.md', '沒有 ## 全域 Law 區,看不出約束住在哪裡', 'lawful migrate laws --write');
    else if (design.strayGlobal) warn('modules.md', '「邊界」或「對外 I/O」還住在這一檔,不在 Cone.md 的全域 Law 區', 'lawful migrate laws --write');
    if (design.requirements.merged && design.requirements.requirements.some((q) => (q.accept && q.accept.written === 'Law') || q.implied || q.sources.some((o) => o.lawItem))) warn('Cone.md', '「## 需求」節或 objectives/ 底下的檔寫著「- Law:」或蘊含說明;需求附的是驗收', 'lawful migrate laws --write');
  }
  if (design.requirements.merged) warn('Cone.md', '需求還住在「## 需求」節,看不出每條需求的優先與里程碑', 'lawful migrate requirements --write 換成 requirements/ 一條需求一個檔');
  else if (design.objectivesFile && cone) warn('objectives.md', '里程碑還擠在一份 objectives.md 裡', 'lawful migrate requirements --write 換成 requirements/ 一條需求一個檔');
  for (const o of design.requirements.orphans || []) warn(o.file, `對到的需求 ${o.requirement} 不存在,它的里程碑沒有算進任何需求`, 'lawful migrate requirements 的帳本會列出它;決定它屬於哪條需求');
  if (!ov.reqs.length) warn(design.requirements.exists ? 'requirements/' : '.lawful/', '沒有任何需求', 'lawful:require-design 談第一條需求(至少一條)');
  else if (cone && cone.priorityNoteState !== 'ok') warn('Cone.md', cone.priorityNoteState === 'template' ? '優先各級代表什麼還是模板' : '沒有宣告優先 1 到 4 各代表什麼', 'lawful:require-design 在「專案約束」寫一行「- 優先:1 = …;2 = …;3 = …;4 = …」');
  const seenM = new Set();
  const seenRf = new Set();
  for (const q of ov.reqs) {
    if (!q.hasFrontmatter) warn(q.file, '沒有 frontmatter', '照 templates/requirement.md 補 id、priority、updated');
    else if (q.fileId !== q.id) warn(q.file, `檔名與 frontmatter 對不上(frontmatter:${q.id})`, '檔名 R-n-<slug> 的 R-n 要等於 frontmatter 的 id');
    if (q.placeholder) warn(q.id, '需求還是模板', 'lawful:require-design 寫成一句話');
    if (!q.accept) warn(q.id, '沒有驗收', 'lawful:require-design 補一句可判定的話,寫成「- 驗收:…」');
    else if (q.accept.placeholder) warn(q.id, '驗收還是模板', 'lawful:require-design 寫成可判定的一句');
    else if (q.accept.formal && !q.tested) warn(q.id, '驗收寫了三行卻沒有驗收測試,達成與否未知', `lawful:build ${q.id}(只派 qa 寫一條歸屬 "${q.id}#ACCEPT" 的測試);不能自動化就只留一句,由里程碑推`);
    if (!q.priority) warn(q.id, `優先「${q.priorityRaw || '(沒填)'}」不是 1 到 4`, '改成 1(最高)到 4(最低)');
    if (!q.ms.length) warn(q.id, '沒有任何里程碑', `lawful:require-design 切里程碑(lawful requirement milestone ${q.id} <slug> <一句話>)`);
    if (q.built && q.holds === false) warn(q.id, `里程碑全部達成,需求卻未達成(${q.source})`, '驗收沒過:先查驗收測試;里程碑切漏了就 lawful:require-design 補一條,做錯的改那條 pipeline(要調整既有的 law 走 lawful:scope-laws,既有的 law 不動走 lawful:scope-revise)');
    for (const m of q.ms) {
      // seenM 以編號比對(編號全資料夾唯一);印給人看的「哪裡」欄一律是全名
      if (seenM.has(m.id)) warn(m.fullName, '里程碑編號重複', '編號全資料夾唯一;配號只走 lawful requirement milestone');
      seenM.add(m.id);
      if (m.placeholder) warn(m.fullName, '里程碑還是模板', 'lawful:require-design 寫成一句話');
      if (!m.slug) warn(m.fullName, '沒有英文名,切片開不了分支', `lawful:require-design 把第一格寫成 ${m.id}-<slug>(kebab-case 英文);切片的分支 build/${m.id}-<slug> 與決策紀錄以它為鍵`);
      for (const d of m.docs) if (!d.x) warn(m.fullName, `綁定的 ${d.name} 不存在`, '改成 pipelines/ 裡有的全名,或刪這個綁定');
    }
    for (const rf of q.rfs) {
      if (seenRf.has(rf.id)) warn(rf.id, '調整編號重複', '編號全資料夾唯一;配號只走 lawful requirement refinement');
      seenRf.add(rf.id);
      if (rf.placeholder) warn(rf.id, '調整還是模板', 'lawful:require-design 寫成一句話');
      if (!rf.touches.length) warn(rf.id, '沒有動到任何 pipeline', '動到欄填這條需求的里程碑綁定過的 pipeline 全名');
      for (const n of rf.missing) warn(rf.id, `動到的 ${n} 不存在`, '改成 pipelines/ 裡有的全名');
      for (const n of rf.outside) if (!rf.missing.includes(n)) warn(rf.id, `動到的 ${n} 不在 ${q.id} 任何里程碑的綁定裡`, '調整不引入新 pipeline:只動這條需求的里程碑做出來的 pipeline;新能力開里程碑');
      if (rf.started && rf.cited && rf.green && q.holds === false) warn(rf.id, `調整後 ${q.id} 未達成(${q.source})`, '調整不准讓需求退回未達成:仲裁那條紅,或重開再修');
    }
  }
  for (const n of unbound) warn(n, '沒有被任何里程碑綁定', '不朝向任何需求:lawful:require-design 綁進一條里程碑,或刪掉這條 pipeline');
  for (const v of inv) {
    if (v.holds === false) warn(v.id, `領域不變量未成立(${v.source})`, '有程式碼違反了它:仲裁那條紅,先歸因到是哪一條 pipeline 的實作再改');
    else if (!v.law.formal) warn(v.id, '還沒有三行式,成立與否未知', 'lawful:global-laws 在 types 層的型別出現後把它寫成三行(識別字只用 types 層的匯出與型別名)');
    else if (!v.tested) warn(v.id, '寫了三行卻沒有測試,成立與否未知', `lawful:build ${v.id}(只派 qa 寫一條歸屬 "${v.id}#LAW" 的測試)`);
  }
  for (const x of a.info.values()) {
    const p = x.p;
    if (!p.hasFrontmatter) warn(p.file, '沒有 frontmatter', '照 templates/pipeline.md 補');
    if (p.status && !STATUSES.includes(p.status)) warn(p.file, `status「${p.status}」不合法`, '改成 draft / ready / verified');
    if (p.kindState === 'missing') warn(p.file, '沒有 kind', `frontmatter 補 kind: ${KINDS.join(' 或 ')}`);
    else if (p.kindState === 'template') warn(p.file, 'kind 還是模板', `frontmatter 的 kind 填 ${KINDS.join(' 或 ')}`);
    else if (p.kindState === 'invalid') warn(p.file, `kind「${p.kindRaw}」不合法`, `改成 ${KINDS.join(' 或 ')}`);
    const t = p.template;
    if (t.stages || t.laws || t.examples) warn(p.fullName, `還是模板(${[t.stages && `Stages ${t.stages} 列`, t.laws && `Laws ${t.laws} 條`, t.examples && `Examples ${t.examples} 列`].filter(Boolean).join('、')}是佔位符)`, 'lawful:scope-laws 談完寫成真的');
    if (p.status === 'verified' && [...x.laws, ...x.examples].some((l) => l.result === 'red')) warn(p.fullName, 'verified 而測試紅', '先重開再修');
    if (p.status === 'verified' && p.revs.length && !p.reopened) warn(p.fullName, 'verified 而有 REV 卻沒有重開紀錄', '在「決定」補一條重開');
    if (p.status === 'ready' && x.achieved) warn(p.fullName, '已達成', 'build 收尾改 verified');
    for (const s of x.stages) if (s.state === '不一致') warn(`${p.fullName}#${s.name}`, '簽名與程式碼不一致', 'lawful lint sig 看兩邊;誰對就改另一邊,改文檔走 lawful:scope-revise');
    for (const s of x.stages) if (s.state === '搬家') warn(`${p.fullName}#${s.name}`, `程式碼在 ${s.hit.module}`, 'lawful sync');
    for (const l of [...x.laws, ...x.examples]) if (l.result === 'red') warn(l.key, '測試紅', '仲裁:先歸因再改');
    const orphans = [...x.laws, ...x.examples].filter((l) => l.orphan);
    if (orphans.length) warn(p.fullName, `測試輸出裡有 ${orphans.length} 條結果(${orphans.map((l) => l.id).join('、')})在這棵樹裡沒有測試承接,不算數`, '測試輸出與這棵樹對不上:重跑整套留檔再跑 status;測試真的不在就 lawful:build ' + p.fullName);
  }
  for (const u of a.unmarked) warn(`${u.a}#${u.name}`, `${u.b} 也把 ${u.name} 列成 stage,兩邊都沒註明「見」`, '引用的那一邊模組欄補「見 P-00x-<slug>」,依賴才算得出來');
  for (const n of [...stale].sort()) warn(`build/${n}`, '已合進主線卻還在', 'lawful:integrate 開頭會清掉它;或 git worktree remove <工作樹> 後 git branch -d build/' + n);
  const gapIds = new Map();
  for (const g of design.gaps.gaps) gapIds.set(g.id, (gapIds.get(g.id) || 0) + 1);
  for (const [id, n] of gapIds) if (n > 1) warn(id, `gaps.md 裡出現 ${n} 次`, '兩條 build 分支各自配了同一個號;後合進來的往上移(roles.md「整合」)');
  for (const g of glob) if (g.red) warn(`全域 Law:${g.kind}`, `lint ${g.gate} ${g.red} 條不合規`, `lawful lint ${g.gate}`);
  return warns;
}

// 建議路線:steps 是編號的那幾條,一條都沒有時 note 是那一句話
export function suggestRoutes(design, a, ov, warnCount, building = new Set(), inv = invariantView(design, a)) {
  const steps = [];
  if (a.openGaps.length) steps.push(`先回答 ${a.openGaps.map((g) => g.id).join('、')}(答案要調整既有的 law 走 lawful:scope-laws,既有的 law 不動走 lawful:scope-revise,問的是全域 Law 走 lawful:global-laws),卡住的 stage 才能重派`);
  // 被引用的那一條先建:還在等別條的排在後面,其餘照需求優先與里程碑順序
  const order = [...a.info.values()].filter((x) => !x.achieved && x.p.status === 'ready').sort((x, y) => (x.blockedBy.length ? 1 : 0) - (y.blockedBy.length ? 1 : 0) || ov.keyOf(x.p.fullName) - ov.keyOf(y.p.fullName) || x.refs.length - y.refs.length);
  for (const x of order) steps.push(`lawful:build ${x.p.fullName}(${ov.tag(x.p.fullName)})`);
  const drafts = [...a.info.values()].filter((x) => x.p.status === 'draft');
  for (const x of drafts) steps.push(`lawful:scope-laws ${x.p.fullName}(還是 draft:Law 談完、開發者拍板才改 ready,之後自動接上 build)`);
  // 還沒有切片的里程碑:每條需求下一條,照需求的優先排
  for (const s of sliceLines(ov, building).openable) steps.push(`lawful:spike-impl ${s.m.fullName}(${sliceTag(s)})`);
  // 里程碑全部達成、驗收寫了三行卻沒有驗收測試的需求:build 只派 qa 寫那一條
  for (const q of ov.reqs) if (q.built && q.accept && q.accept.formal && !q.tested) steps.push(`lawful:build ${q.id}(里程碑全部達成,只派 qa 寫 ${q.id}#ACCEPT 的驗收測試)`);
  for (const v of inv) if (v.law.formal && !v.tested) steps.push(`lawful:build ${v.id}(只派 qa 寫 ${v.id}#LAW 的測試)`);
  // 調整:里程碑全部達成後才開,動到的 pipeline 先走 REV(依欄引用 RF-n),再 build
  for (const q of ov.reqs) if (q.built) for (const rf of q.rfs) if (rf.state === '待修訂' && !rf.missing.length) steps.push(`${rf.id} ${rf.title}:lawful:scope-revise ${rf.touches.join('、')}(既有的 law 不動、可以新增,REV 的依欄引用 ${rf.id};要調整既有的 law 才做得到,整件改走 lawful:scope-laws),之後自動接上 build`);
  const allDone = [...a.info.values()].every((x) => x.achieved) && !a.openGaps.length;
  const lawsFalse = [...ov.reqs.filter((q) => q.holds !== true).map((q) => `需求 ${q.id} ${metWord(q.holds)}(${q.source})`), ...inv.filter((v) => v.holds !== true).map((v) => `領域不變量 ${v.id} ${holdsWord(v.holds)}(${v.source})`)];
  let note = null;
  if (!steps.length) {
    const notDone = [...a.info.values()].filter((x) => !x.achieved);
    if (!a.info.size) note = `還沒有任何 pipeline;${ov.reqs.length ? 'lawful:require-design 給第一條里程碑一個英文名,再 lawful:spike-impl <M-n-slug> 做第一條切片' : '先 lawful:require-design 談需求、切里程碑,再 lawful:spike-impl <M-n-slug>'}`;
    else if (allDone && lawsFalse.length) note = `每條 pipeline 達成,但${lawsFalse.join('、')}:先補上,不加新功能`;
    else if (allDone && !warnCount) note = '目前功能全部正常運作:每條 pipeline 達成、每條需求達成、每條領域不變量成立、測試全綠、沒有 open GAP、沒有警訊。沒有非做不可的事,可以加新功能:lawful:require-design 談一條新需求,或替既有的需求加一條里程碑';
    else if (allDone) note = `目前功能全部正常運作(每條 pipeline 達成、每條需求達成、每條領域不變量成立、測試全綠、沒有 open GAP);警訊還有 ${warnCount} 條,照第 6 段的怎麼辦欄清,清完加新功能`;
    else if (notDone.some((x) => x.unknown || x.laws.some((l) => l.result === '未跑'))) note = `沒有可派的線,但 ${notDone.map((x) => x.p.fullName).join('、')} 的 laws 綠幾條未知:先給測試輸出(--tests <log> 或 --run),才知道功能是不是全部正常`;
    else note = `沒有可派的線,但 ${notDone.map((x) => x.p.fullName).join('、')} 還沒達成:lawful status --pipeline <全名> 看哪一列還不在;不加新功能`;
  }
  return { steps, note, allDone: allDone && !lawsFalse.length };
}

// 模組視角:報告、JSON 與看板共用的那一份。一個模組單元一筆,層的狀態來自程式碼住在哪棵樹。
// 進度不是模組的欄位:單元的達成 = 住在它裡面的每個 stage 都在、都實作了。
export function moduleView(design, source, a) {
  const entries = design.modules ? design.modules.entries.filter((e) => !e.placeholder) : [];
  const stagesOf = new Map(entries.map((e) => [e.unit, []]));
  const loose = [];
  for (const x of a.info.values()) {
    for (const s of x.stages) {
      if (s.ref) continue;
      const e = unitOf(entries, s.module);
      const row = { pipeline: x.p.fullName, name: s.name, module: s.module, layer: s.layer, state: s.state, observe: !!s.observe, stub: !!(s.hit && s.hit.stub) };
      if (e) stagesOf.get(e.unit).push(row);
      else loose.push(row);
    }
  }
  const units = entries.map((e) => {
    const stages = stagesOf.get(e.unit);
    const layers = e.layers.map((layer) => {
      const modules = source ? [...source.modules.values()].filter((m) => m.layer === layer && (m.module === e.unit || m.module.startsWith(`${e.unit}.`))).map((m) => m.module).sort() : [];
      return { layer, modules, empty: !!source && !modules.length, root: layerRoot(design.cone, layer) };
    });
    // 待實作與報告第 5 段同一套判準:找不到、本體還是未實作標記,一個 stage 只算一次
    const todo = stages.filter((s) => s.state === '找不到' || s.state === '未實作' || s.stub);
    const mismatch = stages.filter((s) => s.state === '不一致');
    return {
      unit: e.unit,
      layers: e.layers,
      responsibility: e.responsibility,
      layerState: layers,
      emptyLayers: layers.filter((l) => l.empty).map((l) => l.layer),
      pipelines: [...new Set(stages.map((s) => s.pipeline))],
      stages,
      todo,
      mismatch,
      achieved: stages.length > 0 && !todo.length && !mismatch.length,
      idle: !stages.length,
    };
  });
  const unregistered = source ? [...source.modules.values()].filter((m) => !unitOf(entries, m.module)).map((m) => ({ module: m.module, file: m.file, layer: m.layer })) : [];
  return { units, unregistered, loose };
}

// 需求、里程碑、調整、io pipeline、pipeline 的總數與達成數:報告的第二行與看板的數字同源
export function counts(design, a, ov, mv, inv = invariantView(design, a)) {
  const ioFaces = design.pipelines.filter((p) => p.kind === 'io').map((p) => p.fullName);
  const milestones = ov.reqs.flatMap((q) => q.ms);
  const rfs = ov.reqs.flatMap((q) => q.rfs);
  const todo = [...a.info.values()].flatMap((x) => x.stages.filter((s) => s.state === '找不到' || (s.hit && s.hit.stub)).map((s) => ({ ...s, pipeline: x.p.fullName })));
  return {
    requirements: ov.reqs.length,
    requirementsHolding: ov.reqs.filter((q) => q.holds === true).length,
    requirementsTested: ov.reqs.filter((q) => q.holds === true && q.tested).length,
    requirementsInferred: ov.reqs.filter((q) => q.holds === true && !q.tested).length,
    invariants: inv.length,
    invariantsHolding: inv.filter((v) => v.holds === true).length,
    milestones: milestones.length,
    milestonesAchieved: milestones.filter((m) => m.achieved).length,
    refinements: rfs.length,
    refinementsAchieved: rfs.filter((rf) => rf.achieved).length,
    ioFaces: ioFaces.length,
    ioFacesAchieved: ioFaces.filter((m) => a.info.has(m) && a.info.get(m).achieved).length,
    pipelines: design.pipelines.length,
    pipelinesAchieved: [...a.info.values()].filter((x) => x.achieved).length,
    todo,
    openGaps: a.openGaps.length,
    moduleUnits: mv.units.length,
    moduleUnitsIdle: mv.units.filter((u) => u.idle).length,
    modulesUnregistered: mv.unregistered.length,
  };
}

export function statusReport(design, source, adapter, results, resultNote, building = new Set(), stale = new Set(), phases = new Map()) {
  const a = analyze(design, source, adapter, results);
  const out = [];
  const ov = requirementView(design, a);
  const cone = design.cone;
  const mv = moduleView(design, source, a);
  const inv = invariantView(design, a);
  const n = counts(design, a, ov, mv, inv);
  const phase = (key) => (phases.has(key) ? `;${phases.get(key)}` : '');

  out.push(`# lawful status`);
  if (cone && cone.visionState === 'ok') out.push(`願景:${cone.vision}`);
  out.push(`需求 ${n.requirements} 條,達成 ${n.requirementsHolding} 條(測試 ${n.requirementsTested}、推得 ${n.requirementsInferred})· 領域不變量 ${n.invariants} 條,成立 ${n.invariantsHolding} 條 · 里程碑 ${n.milestones} 條,達成 ${n.milestonesAchieved} 條 · 調整 ${n.refinements} 條,達成 ${n.refinementsAchieved} 條 · io pipeline ${n.ioFaces} 條,達成 ${n.ioFacesAchieved} 條 · pipeline ${n.pipelines} 條,達成 ${n.pipelinesAchieved} 條 · 模組單元 ${n.moduleUnits} 個 · 還沒實作的 stage ${n.todo.length} 個 · 還開著的 GAP ${n.openGaps} 條`);
  out.push(`· ${resultNote}`);
  out.push('');
  out.push('## 需求');
  if (!cone) out.push(`- 沒有 Cone.md;${design.legacySystem ? 'lawful migrate cone --write' : 'lawful:kickoff 建它'}`);
  else if (!ov.reqs.length) out.push('- 沒有任何需求;lawful:require-design 談第一條');
  else {
    if (cone.priorityNoteState === 'ok') out.push(`- 優先:${cone.priorityNote}`);
    out.push('| 需求 | 優先 | 一句話 | 驗收 | 依賴 | 里程碑總數 | 里程碑達成 | 完成度 | 調整達成 |', '|---|---|---|---|---|---|---|---|---|');
    for (const q of ov.reqs) out.push(`| ${q.id} | ${q.priorityRaw || '(沒填)'} | ${q.title} | ${metWord(q.holds)}(${q.source}) | ${q.dependsOn.join('、') || '-'} | ${q.ms.length} | ${q.done} | ${q.pct == null ? '-' : `${q.pct}%`} | ${q.rfs.length ? `${q.rfDone}/${q.rfs.length}` : '-'} |`);
    for (const q of ov.reqs) {
      const next = q.ms.find((m) => !m.achieved);
      const state = (d) => (!d.x ? '不存在' : d.x.achieved ? '達成' : d.x.gaps.length ? `卡 ${d.x.gaps.map((g) => g.id).join('、')}` : d.x.p.status === 'draft' ? '還是 draft' : '進行中');
      if (next) out.push(`- ${q.id} 下一個里程碑:${next.fullName} ${next.title}${next.docs.length ? `(${next.docs.map((d) => `${d.name} ${state(d)}`).join('、')})` : (next.slug ? `(還沒有切片:lawful:spike-impl ${next.fullName})` : '(還沒有切片,也還沒有英文名)')}`);
      else {
        const rf = q.rfs.find((r) => !r.achieved);
        if (rf) out.push(`- ${q.id} 里程碑全部達成;下一個調整:${rf.id} ${rf.title}(${rf.state},動到 ${rf.touches.join('、') || '-'})`);
      }
    }
  }
  const unbound = [...a.info.keys()].filter((n) => !ov.rank.has(n));
  if (unbound.length) out.push(`- 沒有被任何里程碑綁定的 pipeline:${unbound.join('、')};它們不朝向任何需求`);
  out.push('');
  const glob = globalView(design, a, source, adapter, inv);
  out.push('## 全域 Law');
  if (!glob.length) out.push('- 沒有 Cone.md');
  else {
    out.push('| 類別 | 住 Cone.md 的哪一區 | 自動確認 | 結果 |', '|---|---|---|---|');
    for (const g of glob) out.push(`| ${g.kind} | 全域 Law › ${g.where} | lawful lint ${g.gate} | ${g.result} |`);
  }
  out.push('');
  if (!inv.length) out.push('- 領域不變量:無');
  else {
    out.push('| 領域不變量 | 種類 | 一句話 | 成立 |', '|---|---|---|---|');
    for (const v of inv) out.push(`| ${v.id} | ${v.kind || '-'} | ${v.title} | ${holdsWord(v.holds)}(${v.source}) |`);
  }
  out.push('');
  out.push('## pipelines');
  out.push('| pipeline | 類別 | status | 文檔簽名數量 | Code 簽名數量 | 未實作的數量 | Law 條數 | Law 通過數/測試數 | 狀態 |');
  out.push('|---|---|---|---|---|---|---|---|---|');
  for (const x of a.info.values()) out.push(row(x));

  out.push('', '## 模組');
  if (!design.modules) out.push('- 缺 .lawful/modules.md,模組單元沒有宣告');
  else if (!mv.units.length) out.push('- 模組表還沒有任何模組單元;lawful module <名稱> --layers <…> --responsibility <一句話> 劃第一個');
  else {
    out.push('| 模組單元 | 職責 | 宣告的層 | 還沒有程式碼的層 | 住在這裡的 pipeline | stage | 待實作 |', '|---|---|---|---|---|---|---|');
    for (const u of mv.units) {
      out.push(`| ${u.unit} | ${u.responsibility || '(沒填)'} | ${u.layers.join('、') || '(沒填)'} | ${u.emptyLayers.join('、') || '-'} | ${u.pipelines.join('、') || '-'} | ${u.stages.length} | ${u.todo.length} |`);
    }
    const idle = mv.units.filter((u) => u.idle).map((u) => u.unit);
    if (idle.length) out.push(`- 還沒有任何 stage 住進去的單元:${idle.join('、')}`);
    if (mv.unregistered.length) out.push(`- 程式碼有、模組表沒有:${mv.unregistered.map((m) => m.module).join('、')};lawful modules --gen 再填職責`);
  }

  out.push('', '## 1. 今天能開幾條線');
  const { openable, inBuild, shared } = openLines(a, ov, building, design.modules ? design.modules.entries : []);
  const slices = sliceLines(ov, building);
  if (!openable.length && !slices.openable.length) out.push('- 無');
  for (const x of openable) out.push(`- ${x.p.fullName}:lawful:build ${x.p.fullName}(${ov.tag(x.p.fullName)})`);
  for (const s of slices.openable) out.push(`- ${s.m.fullName}:lawful:spike-impl ${s.m.fullName}(${sliceTag(s)})`);
  for (const x of inBuild) out.push(`- ${x.p.fullName}:建構中,分支 build/${buildKeyOf(x, ov, building)}${phase(buildKeyOf(x, ov, building))};收尾後 lawful:integrate`);
  for (const s of slices.inBuild) out.push(`- ${s.m.fullName}:建構中,分支 build/${s.m.fullName}${phase(s.m.fullName)}`);
  for (const s of shared) out.push(`- ${s.a} 與 ${s.b} 的 stage 都住 ${s.units.map((m) => `\`${m}\``).join('、')}:可以同時開,整合時這幾個模組單元的檔兩邊都動`);

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
    out.push(`- ${g.id}(${g.target} / ${g.role}):答案要調整既有的 law 走 lawful:scope-laws,既有的 law 不動走 lawful:scope-revise,問的是全域 Law 走 lawful:global-laws`);
  }
  for (const x of a.info.values()) if (x.p.status === 'draft') {
    deciding++;
    out.push(`- ${x.p.fullName} 還是 draft:lawful:scope-laws 談完 Law、開發者拍板才改 ready`);
  }
  if (!deciding) out.push('- 無');

  out.push('', '## 4. 牽動誰');
  let touched = 0;
  for (const x of a.info.values()) if (x.referrers.length) {
    touched++;
    out.push(`- ${x.p.fullName} ← ${x.referrers.join('、')}`);
  }
  if (!touched) out.push('- 無');

  out.push('', '## 5. 待實作(按模組單元)');
  const byModule = new Map();
  for (const s of n.todo) {
    if (!byModule.has(s.module)) byModule.set(s.module, []);
    byModule.get(s.module).push(s);
  }
  if (!byModule.size) out.push('- 無');
  else {
    const byUnit = new Map();
    for (const [m] of byModule) {
      const u = mv.units.find((x) => m === x.unit || m.startsWith(`${x.unit}.`));
      const key = u ? u.unit : '(不在模組表)';
      if (!byUnit.has(key)) byUnit.set(key, []);
      byUnit.get(key).push(m);
    }
    for (const [unit, mods] of [...byUnit].sort()) {
      out.push(`- ${unit}`);
      for (const m of mods.sort()) out.push(`  - ${m}:${byModule.get(m).map((s) => `${s.pipeline}#${s.name}${s.hit && s.hit.stub ? '(未實作)' : s.observe ? '(觀察點)' : ''}`).join('、')}`);
    }
  }

  out.push('', '## 6. 警訊');
  const warns = warnings(design, a, ov, source, adapter, stale, inv, glob);
  if (!warns.length) out.push('- 無');
  else {
    out.push('| 哪裡 | 什麼事 | 怎麼辦 |', '|---|---|---|');
    for (const [a1, b1, c1] of warns) out.push(`| ${a1} | ${b1} | ${c1} |`);
  }

  out.push('', '## 7. 建議路線');
  const route = suggestRoutes(design, a, ov, warns.length, building, inv);
  route.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
  if (route.note) out.push(`- ${route.note}`);

  return { text: out.join('\n'), exitCode: route.allDone && a.info.size ? 0 : 1 };
}

export function pipelineDetail(design, source, adapter, results, resultNote, name) {
  const a = analyze(design, source, adapter, results);
  const x = [...a.info.values()].find((v) => v.p.fullName === name || v.p.id === name);
  if (!x) return { text: `沒有 ${name} 這條 pipeline`, exitCode: 1 };
  const out = [`# ${x.p.fullName}  ${x.p.kind || '(類別沒填)'} · ${x.p.status}`, x.p.description, `· ${resultNote}`, '', '## Stages'];
  for (const s of x.stages) out.push(`- ${s.index}  ${s.name} :: ${s.type}  ${s.module}/${s.layer}  ${s.state}${s.state === '搬家' ? ` → ${s.hit.module}` : ''}${s.ref ? `  見 ${s.ref}` : ''}`);
  out.push('', '## Laws');
  for (const l of x.laws) out.push(`- ${l.id} [${l.kind}] ${l.title}  ${l.result}`);
  for (const e of x.examples) out.push(`- ${e.id} 覆蓋 ${e.covers.join('、')}  ${e.result}`);
  out.push('', '## GAP');
  if (!x.gaps.length) out.push('- 無');
  for (const g of x.gaps) out.push(`- ${g.id}(${g.target} / ${g.role})`);
  out.push('', '## 引用');
  out.push(`- 引用了:${x.refs.length ? x.refs.join('、') : '無'}`);
  out.push(`- 被引用:${x.referrers.length ? x.referrers.join('、') : '無'}`);
  const obs = x.obsTotal ? ` · 觀察點 ${x.obsTotal} 個,程式碼裡有 ${x.obsOk} 個` : '';
  out.push('', `文檔寫了 ${x.sigTotal} 條簽名,程式碼裡有 ${x.sigOk} 條,未實作的 ${x.stubCount} 條${obs} · 寫了 ${x.laws.length} 條 law,通過 ${x.unknown ? 'nan' : x.laws.filter((l) => l.result === 'green').length} 條 · ${x.achieved ? '達成' : '未達成'}`);
  return { text: out.join('\n'), exitCode: 0 };
}

export function moduleDetail(design, source, adapter, results, resultNote, moduleName) {
  const a = analyze(design, source, adapter, results);
  const under = (m) => m === moduleName || m.startsWith(`${moduleName}.`);
  const entry = design.modules ? unitOf(design.modules.entries, moduleName) : null;
  const inCode = source ? [...source.modules.keys()].filter(under) : [];
  if (!entry && !inCode.length) return { text: `模組表與程式碼都沒有 ${moduleName}`, exitCode: 1 };
  const own = source && source.modules.has(moduleName) ? source.modules.get(moduleName).layer : null;
  const head = !entry ? '未登記' : entry.unit === moduleName ? `模組單元:${entry.layers.join('、')} 層` : own ? `${own} 層(${entry.unit})` : entry.unit;
  const out = [`# ${moduleName}  ${head}`, `· ${resultNote}`, ''];
  let n = 0;
  for (const x of a.info.values()) {
    for (const s of x.stages) {
      if (!(under(s.module) || (s.hit && under(s.hit.module)))) continue;
      n++;
      const lawsOn = x.laws.filter((l) => l.conclusion && new RegExp(`(?<![\\w.'])${s.name}(?![\\w'])`).test(l.conclusion));
      const g = lawsOn.filter((l) => l.result === 'green').length;
      out.push(`- ${x.p.fullName}#${s.name}  ${s.state}  掛在上面的 law ${lawsOn.length} 條,通過 ${x.unknown ? 'nan' : g} 條`);
    }
  }
  if (!n) out.push('- 沒有任何 pipeline 的 stage 住在這裡');
  return { text: out.join('\n'), exitCode: 0 };
}
