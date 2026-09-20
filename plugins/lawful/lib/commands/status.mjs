// status:派工報告。全部從 .lawful、程式碼與測試輸出推。
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { layerRoot, unitOf, STATUSES, KINDS } from '../design.mjs';
import { findSignature } from '../source.mjs';
import { lintBoundary } from './lint.mjs';

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
      else if (hit.stub) state = '骨架';
      else state = '在';
      return { ...s, state, hit };
    });
    // 簽名 m / n 只算步驟(數字列與 = 列);o 列是觀察點,另計,找不到或不一致一樣擋達成
    const present = (s) => s.state === '在' || s.state === '搬家' || s.state === '骨架';
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
  // 需求與目標的 Law 也是測試標記(R-n#LAW / O-n#LAW):有測試就以測試為準
  const lawTest = (key) => {
    if (!markers.has(key)) return null;
    const res = results ? results.get(key) : undefined;
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

// 建構中的 pipeline = 有 build/<全名> 分支,而且它還沒被合進主線。
// 合進主線的分支是做完了沒人收的殘留,不是有人在建;它列成警訊,清掉是整合的職責(roles.md「整合」)。
// 只在專案根目錄有 .git 時問 git;沒有(夾具、匯出的樹)就一條都不算,報告不受環境影響。
export function branchState(root) {
  const none = { building: new Set(), stale: new Set() };
  if (!root || !fs.existsSync(path.join(root, '.git'))) return none;
  const all = gitLines(root, 'git branch --list "build/*" --format="%(refname:short)"');
  if (!all) return none;
  const name = (s) => s.replace(/^build\//, '');
  const ref = mainRef(root);
  const merged = ref ? gitLines(root, `git branch --list "build/*" --merged ${ref} --format="%(refname:short)"`) : null;
  const stale = new Set((merged || []).map(name));
  return { building: new Set(all.map(name).filter((n) => !stale.has(n))), stale };
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

// 需求 → 目標 → 里程碑 / 調整 → pipeline。
// 里程碑達成 = 綁定的每條 pipeline 都達成;目標完成度 = 達成的里程碑 / 里程碑數。
// 目標 Law 成立:有 O-n#LAW 測試以它為準;Law 是繼承而需求有 R-n#LAW 測試就用那一條;都沒有 = 建置路線全部達成。
// 需求 Law 成立:有 R-n#LAW 測試以它為準;沒有 = 它底下每個目標的 Law 都成立(由蘊含推得),一個目標都沒有就未成立。
// 調整達成 = 動到的每條 pipeline 都有一條 REV 引用它、都達成,而且需求 Law 仍成立。
// rank 給每條 pipeline 一個排序鍵(目標優先、目標順序、里程碑順序),建議路線與能開的線照它排;沒被綁的排最後。
export function objectiveView(design, a) {
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
    // 三行式的 Law 只由測試判,沒有測試就是未知;一句話的 Law 才由建置路線推
    let law;
    const own = a.lawTest(`${o.id}#LAW`);
    const inheritedLaw = o.law && o.law.inherits && design.cone ? (design.cone.requirements.find((q) => q.id === o.law.inherits) || {}).law : null;
    const inherited = o.law && o.law.inherits ? a.lawTest(`${o.law.inherits}#LAW`) : null;
    if (o.law && o.law.placeholder) law = { holds: false, source: 'Law 還是模板', tested: false };
    else if (own) law = { holds: verdict(own.result), source: `測試 ${own.key} ${own.result}`, tested: true };
    else if (inherited) law = { holds: verdict(inherited.result), source: `繼承 ${o.law.inherits},測試 ${inherited.key} ${inherited.result}`, tested: true };
    else if (o.law && o.law.formal) law = { holds: null, source: `寫了三行卻沒有 ${o.id}#LAW 測試`, tested: false };
    else if (inheritedLaw && inheritedLaw.formal) law = { holds: null, source: `繼承 ${o.law.inherits},寫了三行卻沒有 ${o.law.inherits}#LAW 測試`, tested: false };
    else if (!ms.length) law = { holds: false, source: '沒有里程碑', tested: false };
    else law = { holds: built, source: built ? '推得:建置路線全部達成' : `里程碑 ${done}/${ms.length} 達成`, tested: false };
    return { ...o, ms, done, pct: ms.length ? Math.round((done / ms.length) * 100) : null, achieved: built, rfs, lawState: law };
  });
  const sorted = [...objs].sort((x, y) => (x.priority || 5) - (y.priority || 5) || x.line - y.line);
  // 需求:它底下的目標照優先排;需求本身照它最高優先的目標排
  const reqs = (design.cone ? design.cone.requirements : []).map((q) => {
    const os = sorted.filter((o) => o.requirement === q.id);
    const test = a.lawTest(`${q.id}#LAW`);
    let holds;
    let source;
    if (q.law && q.law.placeholder) {
      holds = false;
      source = 'Law 還是模板';
    } else if (test) {
      holds = verdict(test.result);
      source = `測試 ${test.key} ${test.result}`;
    } else if (q.law && q.law.formal) {
      holds = null;
      source = `寫了三行卻沒有 ${q.id}#LAW 測試`;
    } else if (!os.length) {
      holds = false;
      source = '還沒有目標';
    } else if (os.every((o) => o.lawState.holds === true)) {
      holds = true;
      source = `推得:${os.map((o) => o.id).join('、')} 的 Law 都成立`;
    } else if (os.some((o) => o.lawState.holds === null)) {
      holds = null;
      source = `${os.filter((o) => o.lawState.holds === null).map((o) => o.id).join('、')} 的 Law 未知`;
    } else {
      holds = false;
      source = `${os.filter((o) => o.lawState.holds === false).map((o) => o.id).join('、')} 的 Law 未成立`;
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

// 一條 pipeline 在報告與看板上的同一句狀態
export function docState(x) {
  return x.achieved ? '達成' : x.gaps.length ? `卡 ${x.gaps.map((g) => g.id).join('、')}` : x.blockedBy.length ? `等 ${x.blockedBy.join('、')}` : '進行中';
}

function row(x) {
  const g = x.laws.filter((l) => l.result === 'green').length;
  const traced = x.laws.filter((l) => l.traced).length;
  return `| ${x.p.fullName} | ${x.p.kind || '(沒填)'} | ${x.p.status || '(無)'} | ${x.sigTotal} | ${x.sigOk} | ${x.stubCount} | ${x.laws.length} | ${x.unknown ? 'nan' : g}/${traced} | ${docState(x)} |`;
}

// 能開 = ready、沒 open GAP、引用的子流全部達成(消費者在子流合進主線之後才開,roles.md「分支與所有權」)
export function openLines(a, ov, building, entries = []) {
  const candidates = [...a.info.values()].filter((x) => x.p.status === 'ready' && !x.achieved && !x.gaps.length && !x.blockedBy.length).sort((x, y) => ov.keyOf(x.p.fullName) - ov.keyOf(y.p.fullName));
  const openable = candidates.filter((x) => !building.has(x.p.fullName));
  const inBuild = candidates.filter((x) => building.has(x.p.fullName));
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
export function warnings(design, a, ov, source, adapter, stale = new Set()) {
  const cone = design.cone;
  const unbound = [...a.info.keys()].filter((n) => !ov.rank.has(n));
  const warns = [];
  const warn = (where, what, fix) => warns.push([where, what, fix]);
  if (!cone) warn('Cone.md', '不存在', design.legacySystem ? 'lawful migrate cone --write' : 'lawful:design 建 .lawful');
  else {
    if (cone.visionState === 'missing') warn('Cone.md', '沒有 ## 願景 節', 'lawful:design 訂願景');
    else if (cone.visionState === 'template') warn('Cone.md', '願景還是模板', 'lawful:design 訂願景');
    if (cone.requirementsState === 'missing') warn('Cone.md', '沒有 ## 需求 節', 'lawful:design 訂需求');
    else if (!cone.requirements.length) warn('Cone.md', '沒有任何需求', 'lawful requirement add <一句話> --law <句>(至少一條)');
  }
  for (const q of ov.reqs) {
    if (q.placeholder) warn(q.id, '需求還是模板', 'lawful:design 寫成一句話');
    if (!q.law) warn(q.id, '沒有 Law', 'lawful:design 補一句可判定的話,寫成「- Law:…」');
    else if (q.law.placeholder) warn(q.id, 'Law 還是模板', 'lawful:design 寫成可判定的一句');
    else if (q.law.formal && !q.tested) warn(q.id, 'Law 寫了三行卻沒有驗收測試,成立與否未知', `lawful:build ${q.id}(只派 qa 寫一條歸屬 "${q.id}#LAW" 的測試);不能自動化就只留一句,由目標 Law 推`);
    if (!q.objectives.length) warn(q.id, '沒有任何目標', `lawful objective add <一句話> --requirement ${q.id} --priority <1-4>`);
    if (q.objectives.length > 1) {
      if (!q.implication) warn(q.id, `有 ${q.objectives.length} 個目標卻沒有蘊含說明`, `Cone.md 的 ${q.id} 補「- 蘊含:${q.objectives.map((o) => o.id).join('、')} 的 Law 都成立 ⟹ 本 Law 成立,因為 …」`);
      for (const o of q.objectives) if (o.law && o.law.inherits) warn(o.id, `${q.id} 有 ${q.objectives.length} 個目標,這一個的 Law 卻是繼承`, 'lawful:objective 給它自己的 Law;繼承只給一對一的需求');
    }
    if (q.built && q.holds === false) warn(q.id, `建置路線全部達成,Law 卻未成立(${q.source})`, '最低限度的 Law 沒達到:先查驗收測試與蘊含說明,再走 lawful:revise');
    for (const rf of q.rfs) if (rf.started && rf.cited && rf.green && q.holds === false) warn(rf.id, `優化後 ${q.id} 的 Law 不成立(${q.source})`, '優化不准破壞需求 Law:仲裁那條紅,或解凍再修');
  }
  if (design.legacyObjectives) warn('objectives.md', '目標還擠在一份檔裡', 'lawful migrate cone --write 拆成 objectives/ 一個目標一個檔');
  if (!ov.objs.length) warn(design.objectives.exists ? 'objectives/' : '.lawful/', '沒有任何目標', 'lawful:objective 訂第一個目標(至少一個)');
  else if (cone && cone.priorityNoteState !== 'ok') warn('Cone.md', cone.priorityNoteState === 'template' ? '優先各級代表什麼還是模板' : '沒有宣告優先 1 到 4 各代表什麼', 'lawful:objective 在「專案約束」寫一行「- 優先:1 = …;2 = …;3 = …;4 = …」');
  const seenM = new Set();
  const seenRf = new Set();
  for (const o of ov.objs) {
    if (!o.hasFrontmatter) warn(o.file, '沒有 frontmatter', '照 templates/objective.md 補 id、requirement、priority、updated');
    else if (o.fileId !== o.id || (o.requirement && o.fileRequirement !== o.requirement)) warn(o.file, `檔名與 frontmatter 對不上(frontmatter:${o.requirement || '?'} ${o.id})`, '檔名 R-x-O-y-<slug> 的 R-x 與 O-y 要等於 frontmatter 的 requirement 與 id;目標換需求就改檔名');
    if (o.placeholder) warn(o.id, '目標還是模板', 'lawful:objective 寫成一句話');
    if (!o.requirement) warn(o.id, '沒有對到任何需求', 'lawful:objective 在 frontmatter 補 requirement: R-n;每個目標解決一條需求');
    else if (cone && !o.req) warn(o.id, `需求 ${o.requirement} 不在 Cone.md`, '改成 Cone.md 裡有的 R-n,或 lawful requirement add 先立需求');
    if (!o.priority) warn(o.id, `優先「${o.priorityRaw || '(沒填)'}」不是 1 到 4`, '改成 1(最高)到 4(最低)');
    if (!o.law) warn(o.id, '沒有 Law', 'lawful:objective 補「- Law:…」;一對一的需求寫「繼承 R-n」');
    else if (o.law.placeholder) warn(o.id, 'Law 還是模板', 'lawful:objective 寫成可判定的一句');
    if (!o.ms.length) warn(o.id, '沒有任何里程碑', 'lawful:objective 補里程碑並綁定 pipeline');
    for (const m of o.ms) {
      if (seenM.has(m.id)) warn(m.id, '里程碑編號重複', '編號全檔唯一;配號只走 lawful objective milestone');
      seenM.add(m.id);
      if (m.placeholder) warn(m.id, '里程碑還是模板', 'lawful:objective 寫成一句話');
      for (const d of m.docs) if (!d.x) warn(m.id, `綁定的 ${d.name} 不存在`, '改成 pipelines/ 裡有的全名,或刪這個綁定');
    }
    for (const rf of o.rfs) {
      if (seenRf.has(rf.id)) warn(rf.id, '調整編號重複', '編號全檔唯一;配號只走 lawful objective refinement');
      seenRf.add(rf.id);
      if (rf.placeholder) warn(rf.id, '調整還是模板', 'lawful:objective 寫成一句話');
      if (!rf.touches.length) warn(rf.id, '沒有動到任何 pipeline', '動到欄填本目標里程碑綁定過的 pipeline 全名');
      for (const n of rf.missing) warn(rf.id, `動到的 ${n} 不存在`, '改成 pipelines/ 裡有的全名');
      for (const n of rf.outside) if (!rf.missing.includes(n)) warn(rf.id, `動到的 ${n} 不在 ${o.id} 任何里程碑的綁定裡`, '優化路線不引入新 feature:只動本目標建置路線做出來的 pipeline;新能力開里程碑');
    }
  }
  for (const n of unbound) warn(n, '沒有被任何里程碑綁定', '不朝向任何目標:lawful:objective 綁進一條里程碑,或刪掉這條 pipeline');
  for (const x of a.info.values()) {
    const p = x.p;
    if (!p.hasFrontmatter) warn(p.file, '沒有 frontmatter', '照 templates/pipeline.md 補');
    if (p.status && !STATUSES.includes(p.status)) warn(p.file, `status「${p.status}」不合法`, '改成 draft / ready / frozen');
    if (p.kindState === 'missing') warn(p.file, '沒有 kind', `frontmatter 補 kind: ${KINDS.join(' 或 ')}`);
    else if (p.kindState === 'template') warn(p.file, 'kind 還是模板', `frontmatter 的 kind 填 ${KINDS.join(' 或 ')}`);
    else if (p.kindState === 'invalid') warn(p.file, `kind「${p.kindRaw}」不合法`, `改成 ${KINDS.join(' 或 ')}`);
    const t = p.template;
    if (t.stages || t.laws || t.examples) warn(p.fullName, `還是模板(${[t.stages && `Stages ${t.stages} 列`, t.laws && `Laws ${t.laws} 條`, t.examples && `Examples ${t.examples} 列`].filter(Boolean).join('、')}是佔位符)`, 'lawful:pipeline 討論完寫成真的');
    if (p.status === 'frozen' && x.laws.some((l) => l.result === 'red')) warn(p.fullName, 'frozen 而測試紅', '先解凍再修');
    if (p.status === 'frozen' && p.revs.length && !p.thawed) warn(p.fullName, 'frozen 而有 REV 卻沒有解凍紀錄', '在「決定」補解凍一條');
    if (p.status === 'ready' && x.achieved) warn(p.fullName, '已達成', 'conductor 改 frozen');
    for (const s of x.stages) if (s.state === '不一致') warn(`${p.fullName}#${s.name}`, '簽名與程式碼不一致', 'lint sig 看兩邊;誰對就改另一邊,改文檔走 REV');
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
  if (source) {
    const b = lintBoundary(design, source, adapter);
    if (b.red.length) warn('模組表', `lint boundary ${b.red.length} 條不合規`, 'lawful lint boundary');
  }
  return warns;
}

// 建議路線:steps 是編號的那幾條,一條都沒有時 note 是那一句話
export function suggestRoutes(design, a, ov, warnCount) {
  const steps = [];
  if (a.openGaps.length) steps.push(`先回答 ${a.openGaps.map((g) => g.id).join('、')}(lawful:revise),卡住的 stage 才能重派`);
  const order = [...a.info.values()].filter((x) => !x.achieved && x.p.status === 'ready').sort((x, y) => ov.keyOf(x.p.fullName) - ov.keyOf(y.p.fullName) || (x.refs.length - y.refs.length));
  for (const x of order) steps.push(`lawful:build ${x.p.fullName}(${ov.tag(x.p.fullName)})`);
  const drafts = [...a.info.values()].filter((x) => x.p.status === 'draft');
  if (drafts.length) steps.push(`${drafts.map((x) => x.p.fullName).join('、')} 討論完改 ready`);
  // 建置路線達成、Law 寫了三行卻沒有驗收測試的需求與目標:build 只派 qa 寫那一條
  for (const q of ov.reqs) if (q.built && q.law && q.law.formal && !q.tested) steps.push(`lawful:build ${q.id}(建置路線達成,只派 qa 寫 ${q.id}#LAW 的驗收測試)`);
  for (const o of ov.objs) if (o.achieved && o.law && o.law.formal && !o.lawState.tested) steps.push(`lawful:build ${o.id}(建置路線達成,只派 qa 寫 ${o.id}#LAW 的驗收測試)`);
  // 優化路線:建置路線達成後才開,動到的 pipeline 先走 REV(依欄引用 RF-n),再 build
  for (const o of ov.objs) if (o.achieved) for (const rf of o.rfs) if (rf.state === '待修訂' && !rf.missing.length) steps.push(`${rf.id} ${rf.title}:lawful:revise ${rf.touches.join('、')}(REV 的依欄引用 ${rf.id}),再 lawful:build`);
  const allDone = [...a.info.values()].every((x) => x.achieved) && !a.openGaps.length;
  const lawsFalse = ov.reqs.filter((q) => q.holds !== true);
  let note = null;
  if (!steps.length) {
    const notDone = [...a.info.values()].filter((x) => !x.achieved);
    if (!a.info.size) note = `還沒有任何 pipeline;${ov.objs.length ? 'lawful claim <slug> --milestone <M-n> 建第一條' : '先 lawful:objective 訂目標與里程碑,再 lawful claim <slug> --milestone <M-n>'}`;
    else if (allDone && lawsFalse.length) note = `每條 pipeline 達成,但需求 ${lawsFalse.map((q) => `${q.id} 的 Law ${holdsWord(q.holds)}(${q.source})`).join('、')}:先讓需求 Law 成立,不加新功能`;
    else if (allDone && !warnCount) note = '目前功能全部正常運作:每條 pipeline 達成、每條需求的 Law 成立、測試全綠、沒有 open GAP、沒有警訊。沒有非做不可的事,可以加新功能:lawful requirement add 或 lawful:objective';
    else if (allDone) note = `目前功能全部正常運作(每條 pipeline 達成、每條需求的 Law 成立、測試全綠、沒有 open GAP);警訊還有 ${warnCount} 條,照第 6 段的怎麼辦欄清,清完加新功能`;
    else if (notDone.some((x) => x.unknown || x.laws.some((l) => l.result === '未跑'))) note = `沒有可派的線,但 ${notDone.map((x) => x.p.fullName).join('、')} 的 laws 綠幾條未知:先給測試輸出(--tests <log> 或 --run),才知道功能是不是全部正常`;
    else note = `沒有可派的線,但 ${notDone.map((x) => x.p.fullName).join('、')} 還沒達成:lawful status --pipeline <全名> 看哪一列還不在;不加新功能`;
  }
  return { steps, note, allDone: allDone && !lawsFalse.length };
}

// 模組視角:報告、JSON 與看板共用的那一份。一個模組單元一筆,層的狀態來自程式碼住在哪棵樹。
// 進度不是模組的欄位:單元的達成 = 住在它裡面的每個 stage 都在、都不是骨架。
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
    // 待實作與報告第 5 段同一套判準:找不到、本體還是骨架,一個 stage 只算一次
    const todo = stages.filter((s) => s.state === '找不到' || s.state === '骨架' || s.stub);
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

// 需求、目標、里程碑、調整、IO 介面、pipeline 的總數與達成數:報告的第二行與看板的數字同源
export function counts(design, a, ov, mv) {
  const ioFaces = design.pipelines.filter((p) => p.kind === 'IO 介面').map((p) => p.fullName);
  const milestones = ov.objs.flatMap((o) => o.ms);
  const rfs = ov.objs.flatMap((o) => o.rfs);
  const todo = [...a.info.values()].flatMap((x) => x.stages.filter((s) => s.state === '找不到' || (s.hit && s.hit.stub)).map((s) => ({ ...s, pipeline: x.p.fullName })));
  return {
    requirements: ov.reqs.length,
    requirementsHolding: ov.reqs.filter((q) => q.holds === true).length,
    requirementsTested: ov.reqs.filter((q) => q.holds === true && q.tested).length,
    requirementsInferred: ov.reqs.filter((q) => q.holds === true && !q.tested).length,
    objectives: ov.objs.length,
    objectivesAchieved: ov.objs.filter((o) => o.achieved).length,
    objectiveLawsHolding: ov.objs.filter((o) => o.lawState.holds === true).length,
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

const lawCell = (state) => `${holdsWord(state.holds)}(${state.source})`;

export function statusReport(design, source, adapter, results, resultNote, building = new Set(), stale = new Set()) {
  const a = analyze(design, source, adapter, results);
  const out = [];
  const ov = objectiveView(design, a);
  const cone = design.cone;
  const mv = moduleView(design, source, a);
  const n = counts(design, a, ov, mv);

  out.push(`# lawful status`);
  if (cone && cone.visionState === 'ok') out.push(`願景:${cone.vision}`);
  out.push(`需求 ${n.requirements} 條,Law 成立 ${n.requirementsHolding} 條(測試 ${n.requirementsTested}、推得 ${n.requirementsInferred})· 目標 ${n.objectives} 個,達成 ${n.objectivesAchieved} 個 · 里程碑 ${n.milestones} 條,達成 ${n.milestonesAchieved} 條 · 調整 ${n.refinements} 條,達成 ${n.refinementsAchieved} 條 · IO 介面 ${n.ioFaces} 條,達成 ${n.ioFacesAchieved} 條 · pipeline ${n.pipelines} 條,達成 ${n.pipelinesAchieved} 條 · 模組單元 ${n.moduleUnits} 個 · 還沒實作的 stage ${n.todo.length} 個 · 還開著的 GAP ${n.openGaps} 條`);
  out.push(`· ${resultNote}`);
  out.push('');
  out.push('## 需求');
  if (!cone) out.push(`- 沒有 Cone.md;${design.legacySystem ? 'lawful migrate cone --write' : 'lawful:design 建它'}`);
  else if (!ov.reqs.length) out.push('- 沒有任何需求;lawful requirement add <一句話> --law <句>');
  else {
    out.push('| 需求 | 一句話 | Law | 目標 | 目標 Law 成立 | 里程碑達成 | 調整達成 |', '|---|---|---|---|---|---|---|');
    for (const q of ov.reqs) out.push(`| ${q.id} | ${q.title} | ${holdsWord(q.holds)}(${q.source}) | ${q.objectives.map((o) => o.id).join('、') || '-'} | ${q.objectives.filter((o) => o.lawState.holds === true).length}/${q.objectives.length} | ${q.ms.filter((m) => m.achieved).length}/${q.ms.length} | ${q.rfs.filter((rf) => rf.achieved).length}/${q.rfs.length} |`);
  }
  out.push('');
  out.push('## 目標');
  if (!ov.objs.length) out.push('- 沒有任何目標;lawful:objective 訂第一個');
  else {
    if (cone && cone.priorityNoteState === 'ok') out.push(`- 優先:${cone.priorityNote}`);
    out.push('| 目標 | 需求 | 優先 | 一句話 | Law | 里程碑總數 | 里程碑達成 | 完成度 | 調整達成 |', '|---|---|---|---|---|---|---|---|---|');
    for (const o of ov.objs) out.push(`| ${o.id} | ${o.requirement || '(沒填)'} | ${o.priorityRaw || '(沒填)'} | ${o.title} | ${lawCell(o.lawState)} | ${o.ms.length} | ${o.done} | ${o.pct == null ? '-' : `${o.pct}%`} | ${o.rfs.length ? `${o.rfDone}/${o.rfs.length}` : '-'} |`);
    for (const o of ov.objs) {
      const next = o.ms.find((m) => !m.achieved);
      const state = (d) => (!d.x ? '不存在' : d.x.achieved ? '達成' : d.x.gaps.length ? `卡 ${d.x.gaps.map((g) => g.id).join('、')}` : d.x.p.status === 'draft' ? '還是 draft' : '進行中');
      if (next) out.push(`- ${o.id} 下一個里程碑:${next.id} ${next.title}${next.docs.length ? `(${next.docs.map((d) => `${d.name} ${state(d)}`).join('、')})` : `(待 claim:lawful claim <slug> --milestone ${next.id})`}`);
      else {
        const rf = o.rfs.find((r) => !r.achieved);
        if (rf) out.push(`- ${o.id} 建置路線達成;下一個調整:${rf.id} ${rf.title}(${rf.state},動到 ${rf.touches.join('、') || '-'})`);
      }
    }
  }
  const unbound = [...a.info.keys()].filter((n) => !ov.rank.has(n));
  if (unbound.length) out.push(`- 沒有被任何里程碑綁定的 pipeline:${unbound.join('、')};它們不朝向任何目標`);
  out.push('');
  out.push('## pipelines');
  out.push('| pipeline | 類別 | status | 文檔簽名數量 | Code 簽名數量 | 還是骨架的數量 | Law 條數 | Law 通過數/測試數 | 狀態 |');
  out.push('|---|---|---|---|---|---|---|---|---|');
  for (const x of a.info.values()) out.push(row(x));

  out.push('', '## 模組');
  if (!design.modules) out.push('- 缺 .lawful/modules.md,邊界沒有宣告');
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
  if (!openable.length) out.push('- 無');
  for (const x of openable) out.push(`- ${x.p.fullName}:lawful:build ${x.p.fullName}(${ov.tag(x.p.fullName)})`);
  for (const x of inBuild) out.push(`- ${x.p.fullName}:建構中,分支 build/${x.p.fullName};收尾後 lawful:integrate`);
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
        : building.has(r) ? `建構中,分支 build/${r}`
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
    out.push(`- ${g.id}(${g.target} / ${g.role}):lawful:revise`);
  }
  for (const s of design.spikes.filter((s) => s.status === 'open')) {
    deciding++;
    out.push(`- ${s.fullName} 還 open`);
  }
  for (const x of a.info.values()) if (x.p.status === 'draft') {
    deciding++;
    out.push(`- ${x.p.fullName} 還是 draft:lawful:pipeline 討論完改 ready`);
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
      for (const m of mods.sort()) out.push(`  - ${m}:${byModule.get(m).map((s) => `${s.pipeline}#${s.name}${s.hit && s.hit.stub ? '(骨架)' : s.observe ? '(觀察點)' : ''}`).join('、')}`);
    }
  }

  out.push('', '## 6. 警訊');
  const warns = warnings(design, a, ov, source, adapter, stale);
  if (!warns.length) out.push('- 無');
  else {
    out.push('| 哪裡 | 什麼事 | 怎麼辦 |', '|---|---|---|');
    for (const [a1, b1, c1] of warns) out.push(`| ${a1} | ${b1} | ${c1} |`);
  }

  out.push('', '## 7. 建議路線');
  const route = suggestRoutes(design, a, ov, warns.length);
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
  out.push('', `文檔寫了 ${x.sigTotal} 條簽名,程式碼裡有 ${x.sigOk} 條,還是骨架的 ${x.stubCount} 條${obs} · 寫了 ${x.laws.length} 條 law,通過 ${x.unknown ? 'nan' : x.laws.filter((l) => l.result === 'green').length} 條 · ${x.achieved ? '達成' : '未達成'}`);
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
