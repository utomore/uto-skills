// status:派工報告。全部從 .lawful、程式碼與測試輸出推。
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { matchModule, matchesPattern, STATUSES } from '../design.mjs';
import { findSignature } from '../source.mjs';
import { lintBoundary, lintSig } from './lint.mjs';

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
      else if (!hit) state = s.wish ? '願望' : '找不到';
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
      return { ...l, key, traced, result: res || (traced ? '未跑' : '未翻譯') };
    });
    const examples = p.examples.map((e) => {
      const key = `${p.id}#${e.id}`;
      const traced = markers.has(key);
      const res = results ? results.get(key) : undefined;
      return { ...e, key, traced, result: res || (traced ? '未跑' : '未翻譯') };
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
  return { info, byName, byId, openGaps, markers, unmarked };
}

// 建構中的 pipeline = 有 build/<全名> 分支。只在專案根目錄有 .git 時問 git;沒有(夾具、匯出的樹)就一條都不算,報告不受環境影響。
export function buildingBranches(root) {
  if (!root || !fs.existsSync(path.join(root, '.git'))) return new Set();
  try {
    const out = execSync('git branch --list "build/*" --format=%(refname:short)', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return new Set(out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^build\//, '')));
  } catch {
    return new Set();
  }
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
    const cmd = design.system && design.system.commands['測試(整套)'];
    if (!cmd) return { results: null, note: 'system.md「語言與工具」沒有整套測試指令,--run 不知道跑什麼' };
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

// 目標 → 里程碑 → pipeline:里程碑達成 = 綁定的每條 pipeline 都達成;目標完成度 = 達成的里程碑 / 里程碑數。
// rank 給每條 pipeline 一個排序鍵(目標優先、目標順序、里程碑順序),建議路線與能開的線照它排;沒被綁的排最後。
export function objectiveView(design, a) {
  const objs = design.objectives.objectives.map((o) => {
    const ms = o.milestones.map((m) => {
      const docs = m.binds.map((b) => ({ name: b, x: a.info.get(b) || null }));
      const achieved = docs.length > 0 && docs.every((d) => d.x && d.x.achieved);
      return { ...m, docs, achieved };
    });
    const done = ms.filter((m) => m.achieved).length;
    return { ...o, ms, done, pct: ms.length ? Math.round((done / ms.length) * 100) : null, achieved: ms.length > 0 && done === ms.length };
  });
  const sorted = [...objs].sort((x, y) => (x.priority || 5) - (y.priority || 5) || x.line - y.line);
  const rank = new Map();
  sorted.forEach((o, oi) => o.ms.forEach((m, mi) => m.binds.forEach((b) => {
    if (!rank.has(b)) rank.set(b, { o, m, key: (o.priority || 5) * 1e6 + oi * 1e3 + mi });
  })));
  const keyOf = (name) => (rank.has(name) ? rank.get(name).key : 9e9);
  const tag = (name) => (rank.has(name) ? `${rank.get(name).o.id} 優先 ${rank.get(name).o.priority || '?'} · ${rank.get(name).m.id} ${rank.get(name).m.title}` : '沒有綁到任何目標');
  return { objs: sorted, rank, keyOf, tag };
}

function row(x) {
  const g = x.laws.filter((l) => l.result === 'green').length;
  const traced = x.laws.filter((l) => l.traced).length;
  const state = x.achieved ? '達成' : x.gaps.length ? `卡 ${x.gaps.map((g) => g.id).join('、')}` : x.blockedBy.length ? `等 ${x.blockedBy.join('、')}` : '進行中';
  return `| ${x.p.fullName} | ${x.p.status || '(無)'} | ${x.sigTotal} | ${x.sigOk} | ${x.stubCount} | ${x.laws.length} | ${x.unknown ? 'nan' : g}/${traced} | ${state} |`;
}

export function statusReport(design, source, adapter, results, resultNote, building = new Set()) {
  const a = analyze(design, source, adapter, results);
  const out = [];
  const listed = design.system ? design.system.pipelines : [];
  const ioFaces = listed.filter((l) => l.kind === 'IO 介面').map((l) => l.fullName);
  const total = listed.length || design.pipelines.length;
  const achievedAll = [...a.info.values()].filter((x) => x.achieved).length;
  const achievedIoFaces = ioFaces.filter((m) => a.info.has(m) && a.info.get(m).achieved).length;
  const ov = objectiveView(design, a);
  const milestones = ov.objs.flatMap((o) => o.ms);
  const sys = design.system;
  const wishStages = [...a.info.values()].flatMap((x) => x.stages.filter((s) => s.state === '願望' || s.state === '找不到' || (s.hit && s.hit.stub)).map((s) => ({ ...s, pipeline: x.p.fullName })));

  out.push(`# lawful status`);
  if (sys && sys.visionState === 'ok') out.push(`願景:${sys.vision}`);
  out.push(`目標 ${ov.objs.length} 個,達成 ${ov.objs.filter((o) => o.achieved).length} 個 · 里程碑 ${milestones.length} 條,達成 ${milestones.filter((m) => m.achieved).length} 條 · IO 介面 ${ioFaces.length} 條,達成 ${achievedIoFaces} 條 · pipeline ${total} 條,達成 ${achievedAll} 條 · 還沒實作的 stage ${wishStages.length} 個 · 還開著的 GAP ${a.openGaps.length} 條`);
  out.push(`· ${resultNote}`);
  out.push('');
  out.push('## 目標');
  if (!ov.objs.length) out.push('- 沒有任何目標;lawful:objective 訂第一個');
  else {
    out.push('| 目標 | 優先 | 一句話 | 里程碑總數 | 里程碑達成 | 完成度 |', '|---|---|---|---|---|---|');
    for (const o of ov.objs) out.push(`| ${o.id} | ${o.priorityRaw || '(沒填)'} | ${o.title} | ${o.ms.length} | ${o.done} | ${o.pct == null ? '-' : `${o.pct}%`} |`);
    for (const o of ov.objs) {
      const next = o.ms.find((m) => !m.achieved);
      if (!next) continue;
      const state = (d) => (!d.x ? '不存在' : d.x.achieved ? '達成' : d.x.gaps.length ? `卡 ${d.x.gaps.map((g) => g.id).join('、')}` : d.x.p.status === 'draft' ? '還是 draft' : '進行中');
      out.push(`- ${o.id} 下一個里程碑:${next.id} ${next.title}${next.docs.length ? `(${next.docs.map((d) => `${d.name} ${state(d)}`).join('、')})` : '(還沒綁定任何 pipeline)'}`);
    }
  }
  const unbound = [...a.info.keys()].filter((n) => !ov.rank.has(n));
  if (unbound.length) out.push(`- 沒有被任何里程碑綁定的 pipeline:${unbound.join('、')};它們不朝向任何目標`);
  out.push('');
  out.push('## pipelines');
  out.push('| pipeline | status | 文檔簽名數量 | Code 簽名數量 | 還是骨架的數量 | Law 條數 | Law 通過數/測試數 | 狀態 |');
  out.push('|---|---|---|---|---|---|---|---|');
  for (const x of a.info.values()) out.push(row(x));

  out.push('', '## 1. 今天能開幾條線');
  // 能開 = ready、沒 open GAP、引用的子流全部達成(消費者在子流合進主線之後才開,roles.md「分支與所有權」)
  const candidates = [...a.info.values()].filter((x) => x.p.status === 'ready' && !x.achieved && !x.gaps.length && !x.blockedBy.length).sort((x, y) => ov.keyOf(x.p.fullName) - ov.keyOf(y.p.fullName));
  const openable = candidates.filter((x) => !building.has(x.p.fullName));
  const inBuild = candidates.filter((x) => building.has(x.p.fullName));
  if (!openable.length) out.push('- 無');
  for (const x of openable) out.push(`- ${x.p.fullName}:lawful:build ${x.p.fullName}(${ov.tag(x.p.fullName)})`);
  for (const x of inBuild) out.push(`- ${x.p.fullName}:建構中,分支 build/${x.p.fullName};收尾後 lawful:integrate`);
  // 兩條能開的線的 stage 住同一個模組:同時開,整合時那個模組的檔兩邊都動
  for (let i = 0; i < openable.length; i++) for (let j = i + 1; j < openable.length; j++) {
    const mods = [...new Set(openable[i].stages.filter((s) => !s.ref).map((s) => s.module))].filter((m) => openable[j].stages.some((s) => !s.ref && s.module === m));
    if (mods.length) out.push(`- ${openable[i].p.fullName} 與 ${openable[j].p.fullName} 的 stage 都住 ${mods.map((m) => `\`${m}\``).join('、')}:可以同時開,整合時這些模組的檔兩邊都動`);
  }

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

  out.push('', '## 5. 待實作(按模組)');
  const byModule = new Map();
  for (const s of wishStages) {
    if (!byModule.has(s.module)) byModule.set(s.module, []);
    byModule.get(s.module).push(s);
  }
  if (!byModule.size) out.push('- 無');
  for (const [m, list] of [...byModule].sort()) out.push(`- ${m}:${list.map((s) => `${s.pipeline}#${s.name}${s.state === '願望' ? '(願望)' : s.hit && s.hit.stub ? '(骨架)' : s.observe ? '(觀察點)' : ''}`).join('、')}`);

  out.push('', '## 6. 警訊');
  const warns = [];
  const warn = (where, what, fix) => warns.push([where, what, fix]);
  if (!sys) warn('system.md', '不存在', 'lawful:design 建 .lawful');
  else if (sys.visionState === 'missing') warn('system.md', '沒有 ## 願景 節', 'lawful:design 訂願景');
  else if (sys.visionState === 'template') warn('system.md', '願景還是模板', 'lawful:design 訂願景');
  if (!ov.objs.length) warn(design.objectives.exists ? 'objectives.md' : '.lawful/', '沒有任何目標', 'lawful:objective 訂第一個目標(至少一個)');
  const seenM = new Set();
  for (const o of ov.objs) {
    if (o.placeholder) warn(o.id, '目標還是模板', 'lawful:objective 寫成一句話');
    if (!o.priority) warn(o.id, `優先「${o.priorityRaw || '(沒填)'}」不是 1 到 4`, '改成 1(最高)到 4(最低)');
    if (!o.criteria) warn(o.id, '沒有可觀察的判準', 'lawful:objective 補一句達成時看得到什麼');
    if (!o.ms.length) warn(o.id, '沒有任何里程碑', 'lawful:objective 補里程碑並綁定 pipeline');
    for (const m of o.ms) {
      if (seenM.has(m.id)) warn(m.id, '里程碑編號重複', '編號全檔唯一;配號只走 lawful objective milestone');
      seenM.add(m.id);
      if (m.placeholder) warn(m.id, '里程碑還是模板', 'lawful:objective 寫成一句話');
      if (!m.binds.length) warn(m.id, '沒有綁定任何 pipeline', 'lawful claim <slug> --milestone ' + m.id + ',或在綁定欄填既有的 pipeline 全名');
      for (const d of m.docs) if (!d.x) warn(m.id, `綁定的 ${d.name} 不存在`, '改成 pipelines/ 裡有的全名,或刪這個綁定');
    }
  }
  for (const n of unbound) warn(n, '沒有被任何里程碑綁定', '不朝向任何目標:lawful:objective 綁進一條里程碑,或刪掉這條 pipeline');
  for (const x of a.info.values()) {
    const p = x.p;
    if (!p.hasFrontmatter) warn(p.file, '沒有 frontmatter', '照 templates/pipeline.md 補');
    if (p.status && !STATUSES.includes(p.status)) warn(p.file, `status「${p.status}」不合法`, '改成 draft / ready / frozen');
    const t = p.template;
    if (t.stages || t.laws || t.examples) warn(p.fullName, `還是模板(${[t.stages && `Stages ${t.stages} 列`, t.laws && `Laws ${t.laws} 條`, t.examples && `Examples ${t.examples} 列`].filter(Boolean).join('、')}是佔位符)`, 'lawful:pipeline 討論完寫成真的');
    if (p.status === 'frozen' && x.laws.some((l) => l.result === 'red')) warn(p.fullName, 'frozen 而測試紅', '先解凍再修');
    if (p.status === 'frozen' && p.revs.length && !p.thawed) warn(p.fullName, 'frozen 而有 REV 卻沒有解凍紀錄', '在「決定」補解凍一條');
    if (p.status === 'ready' && x.achieved) warn(p.fullName, '已達成', 'conductor 改 frozen');
    if (listed.length && !listed.some((l) => l.fullName === p.fullName)) warn(p.fullName, '不在 system.md 的 Pipelines 表', '補一列,類別填 IO 介面或子流');
    for (const s of x.stages) if (s.state === '不一致') warn(`${p.fullName}#${s.name}`, '簽名與程式碼不一致', 'lint sig 看兩邊;誰對就改另一邊,改文檔走 REV');
    for (const s of x.stages) if (s.state === '搬家') warn(`${p.fullName}#${s.name}`, `程式碼在 ${s.hit.module}`, 'lawful sync');
    for (const l of [...x.laws, ...x.examples]) if (l.result === 'red') warn(l.key, '測試紅', '仲裁:先歸因再改');
  }
  for (const u of a.unmarked) warn(`${u.a}#${u.name}`, `${u.b} 也把 ${u.name} 列成 stage,兩邊都沒註明「見」`, '引用的那一邊模組欄補「見 P-00x-<slug>」,依賴才算得出來');
  const gapIds = new Map();
  for (const g of design.gaps.gaps) gapIds.set(g.id, (gapIds.get(g.id) || 0) + 1);
  for (const [id, n] of gapIds) if (n > 1) warn(id, `gaps.md 裡出現 ${n} 次`, '兩條 build 分支各自配了同一個號;後合進來的往上移(roles.md「整合」)');
  for (const l of listed) {
    if (!a.byName.has(l.fullName)) warn('system.md', `列了 ${l.fullName},pipelines/ 沒有這個檔`, '刪那一列或 lawful claim');
    if (!['IO 介面', '子流'].includes(l.kind)) warn('system.md', `${l.fullName} 類別「${l.kind}」`, '改成 IO 介面或子流');
  }
  if (source) {
    const b = lintBoundary(design, source, adapter);
    if (b.red.length) warn('模組表', `lint boundary ${b.red.length} 條不合規`, 'lawful lint boundary');
  }
  if (!warns.length) out.push('- 無');
  else {
    out.push('| 哪裡 | 什麼事 | 怎麼辦 |', '|---|---|---|');
    for (const [a1, b1, c1] of warns) out.push(`| ${a1} | ${b1} | ${c1} |`);
  }

  out.push('', '## 7. 建議路線');
  if (a.openGaps.length) out.push(`1. 先回答 ${a.openGaps.map((g) => g.id).join('、')}(lawful:revise),卡住的 stage 才能重派`);
  const order = [...a.info.values()].filter((x) => !x.achieved && x.p.status === 'ready').sort((x, y) => ov.keyOf(x.p.fullName) - ov.keyOf(y.p.fullName) || (x.refs.length - y.refs.length));
  order.forEach((x, i) => out.push(`${(a.openGaps.length ? 2 : 1) + i}. lawful:build ${x.p.fullName}(${ov.tag(x.p.fullName)})`));
  const drafts = [...a.info.values()].filter((x) => x.p.status === 'draft');
  if (drafts.length) out.push(`${(a.openGaps.length ? 2 : 1) + order.length}. ${drafts.map((x) => x.p.fullName).join('、')} 討論完改 ready`);
  const allDone = [...a.info.values()].every((x) => x.achieved) && !a.openGaps.length;
  if (!a.openGaps.length && !order.length && !drafts.length) {
    const notDone = [...a.info.values()].filter((x) => !x.achieved);
    if (!a.info.size) out.push(`- 還沒有任何 pipeline;${ov.objs.length ? 'lawful claim <slug> --milestone <M-n> 建第一條' : '先 lawful:objective 訂目標與里程碑,再 lawful claim <slug> --milestone <M-n>'}`);
    else if (allDone && !warns.length) out.push('- 目前功能全部正常運作:每條 pipeline 達成、測試全綠、沒有 open GAP、沒有警訊。沒有非做不可的事,可以加新功能:lawful claim <slug>');
    else if (allDone) out.push(`- 目前功能全部正常運作(每條 pipeline 達成、測試全綠、沒有 open GAP);警訊還有 ${warns.length} 條,照第 6 段的怎麼辦欄清,清完加新功能`);
    else if (notDone.some((x) => x.unknown || x.laws.some((l) => l.result === '未跑'))) out.push(`- 沒有可派的線,但 ${notDone.map((x) => x.p.fullName).join('、')} 的 laws 綠幾條未知:先給測試輸出(--tests <log> 或 --run),才知道功能是不是全部正常`);
    else out.push(`- 沒有可派的線,但 ${notDone.map((x) => x.p.fullName).join('、')} 還沒達成:lawful status --pipeline <全名> 看哪一列還不在;不加新功能`);
  }

  return { text: out.join('\n'), exitCode: allDone && a.info.size ? 0 : 1 };
}

export function pipelineDetail(design, source, adapter, results, resultNote, name) {
  const a = analyze(design, source, adapter, results);
  const x = [...a.info.values()].find((v) => v.p.fullName === name || v.p.id === name);
  if (!x) return { text: `沒有 ${name} 這條 pipeline`, exitCode: 1 };
  const out = [`# ${x.p.fullName}  ${x.p.status}`, x.p.description, `· ${resultNote}`, '', '## Stages'];
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
  const entry = design.modules ? matchModule(design.modules.entries, moduleName) : null;
  const inCode = source ? [...source.modules.keys()].filter((m) => matchesPattern(moduleName, m) || m === moduleName) : [];
  if (!entry && !inCode.length) return { text: `模組表與程式碼都沒有 ${moduleName}`, exitCode: 1 };
  const out = [`# ${moduleName}  ${entry ? entry.layer + ' 層' : '未登記'}`, `· ${resultNote}`, ''];
  let n = 0;
  for (const x of a.info.values()) {
    for (const s of x.stages) {
      if (!(s.module === moduleName || matchesPattern(moduleName, s.module) || (s.hit && s.hit.module === moduleName))) continue;
      n++;
      const lawsOn = x.laws.filter((l) => l.conclusion && new RegExp(`(?<![\\w.'])${s.name}(?![\\w'])`).test(l.conclusion));
      const g = lawsOn.filter((l) => l.result === 'green').length;
      out.push(`- ${x.p.fullName}#${s.name}  ${s.state}  掛在上面的 law ${lawsOn.length} 條,通過 ${x.unknown ? 'nan' : g} 條`);
    }
  }
  if (!n) out.push('- 沒有任何 pipeline 的 stage 住在這裡');
  return { text: out.join('\n'), exitCode: 0 };
}
