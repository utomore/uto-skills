// status:派工報告。全部從 .design、程式碼與測試輸出推,沒有任何一格是人手動維護的。
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { matchModule, matchesPattern, STATUSES, compareSignature as cmpSig } from '../design.mjs';
import { findSignature } from '../source.mjs';
import { lintBoundary } from './lint.mjs';

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
      else if (!hit) state = s.wish ? '願望' : '找不到';
      else if (!cmpSig(s.sig, hit).ok) state = '不一致';
      else if (hit.file !== s.module) state = '搬家';
      else if (hit.stub) state = '骨架';
      else state = '在';
      return { ...s, state, hit };
    });
    const present = (s) => s.state === '在' || s.state === '搬家' || s.state === '骨架';
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
  return { info, openGaps, markers };
}

// 建構中的文檔 = 有 build/<全名> 分支。只在專案根目錄有 .git 時問 git;沒有(夾具、匯出的樹)就一條都不算,報告不受環境影響。
export function buildingBranches(root) {
  if (!root || !fs.existsSync(path.join(root, '.git'))) return new Set();
  try {
    const out = execSync('git branch --list "build/*" --format=%(refname:short)', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return new Set(out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^build\//, '')));
  } catch {
    return new Set();
  }
}

function checked(results, note) {
  if (results.size) return { results, note };
  return { results: null, note: `${note};輸出裡沒有任何 F-00x#LAW-n 標記,幾條 law 通過測試未知(指令跑錯目錄、跑失敗、或測試名沒帶歸屬)` };
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

// 目標 → 里程碑 → 文檔:里程碑達成 = 綁定的每份文檔都達成;目標完成度 = 達成的里程碑 / 里程碑數。
// rank 給每份文檔一個排序鍵(目標優先、目標順序、里程碑順序),建議路線與能開的線照它排;沒被綁的排最後。
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
  return `| ${x.p.fullName} | ${x.p.kind === 'abstract' ? 'abstract' : 'feature'} | ${x.p.status || '(無)'} | ${x.sigTotal} | ${x.sigOk} | ${x.stubCount} | ${x.laws.length} | ${x.unknown ? 'nan' : g}/${traced} | ${x.p.revs.length} | ${state} |`;
}

export function statusReport(design, source, adapter, results, resultNote, building = new Set()) {
  const a = analyze(design, source, adapter, results);
  const out = [];
  const listed = design.system ? design.system.listed : [];
  const features = design.features.map((f) => f.fullName);
  const achievedAll = [...a.info.values()].filter((x) => x.achieved).length;
  const achievedFeatures = features.filter((m) => a.info.has(m) && a.info.get(m).achieved).length;
  const todo = [...a.info.values()].flatMap((x) => x.steps.filter((s) => s.state === '願望' || s.state === '找不到' || (s.hit && s.hit.stub)).map((s) => ({ ...s, doc: x.p.fullName })));

  const ov = objectiveView(design, a);
  const milestones = ov.objs.flatMap((o) => o.ms);
  const sys = design.system;

  out.push('# devflow status');
  if (sys && sys.visionState === 'ok') out.push(`願景:${sys.vision}`);
  out.push(`目標 ${ov.objs.length} 個,達成 ${ov.objs.filter((o) => o.achieved).length} 個 · 里程碑 ${milestones.length} 條,達成 ${milestones.filter((m) => m.achieved).length} 條 · feature ${features.length} 份,達成 ${achievedFeatures} 份 · abstract ${design.abstracts.length} 份 · 文檔共 ${a.info.size} 份,達成 ${achievedAll} 份 · 還沒實作的 step ${todo.length} 個 · 還開著的 GAP ${a.openGaps.length} 條`);
  out.push(`· ${resultNote}`);
  out.push('');
  out.push('## 目標');
  if (!ov.objs.length) out.push('- 沒有任何目標;dev-flow:objective 訂第一個');
  else {
    out.push('| 目標 | 優先 | 一句話 | 里程碑總數 | 里程碑達成 | 完成度 |', '|---|---|---|---|---|---|');
    for (const o of ov.objs) out.push(`| ${o.id} | ${o.priorityRaw || '(沒填)'} | ${o.title} | ${o.ms.length} | ${o.done} | ${o.pct == null ? '-' : `${o.pct}%`} |`);
    for (const o of ov.objs) {
      const next = o.ms.find((m) => !m.achieved);
      if (!next) continue;
      const state = (d) => (!d.x ? '不存在' : d.x.achieved ? '達成' : d.x.gaps.length ? `卡 ${d.x.gaps.map((g) => g.id).join('、')}` : d.x.p.status === 'draft' ? '還是 draft' : '進行中');
      out.push(`- ${o.id} 下一個里程碑:${next.id} ${next.title}${next.docs.length ? `(${next.docs.map((d) => `${d.name} ${state(d)}`).join('、')})` : '(還沒綁定任何文檔)'}`);
    }
  }
  const unbound = features.filter((f) => !ov.rank.has(f));
  if (unbound.length) out.push(`- 沒有被任何里程碑綁定的 feature:${unbound.join('、')};它們不朝向任何目標`);
  out.push('');
  out.push('## 文檔');
  out.push('| 文檔 | 類別 | status | 文檔簽名數 | 程式碼對到 | 還是骨架 | law 條數 | law 綠/翻 | REV | 狀態 |');
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const x of a.info.values()) out.push(row(x));

  out.push('', '## 1. 今天能開幾條線');
  // 能開 = ready、沒 open GAP、引用的 abstract 全部達成(消費者在 abstract 合進主線之後才開,roles.md「分支與所有權」)
  const tagOf = (x) => (x.p.kind === 'abstract' ? `abstract,${x.referrers.length ? `${x.referrers.join('、')} 引用它` : '沒有消費者'}` : ov.tag(x.p.fullName));
  const candidates = [...a.info.values()].filter((x) => x.p.status === 'ready' && !x.achieved && !x.gaps.length && !x.blockedBy.length).sort((x, y) => ov.keyOf(x.p.fullName) - ov.keyOf(y.p.fullName));
  const openable = candidates.filter((x) => !building.has(x.p.fullName));
  const inBuild = candidates.filter((x) => building.has(x.p.fullName));
  if (!openable.length) out.push('- 無');
  for (const x of openable) out.push(`- ${x.p.fullName}:dev-flow:build ${x.p.fullName}(${tagOf(x)})`);
  for (const x of inBuild) out.push(`- ${x.p.fullName}:建構中,分支 build/${x.p.fullName};收尾後 dev-flow:integrate`);
  // 兩條能開的線的 step 住同一個檔案:同時開,整合時那個檔案兩邊都動
  for (let i = 0; i < openable.length; i++) for (let j = i + 1; j < openable.length; j++) {
    const files = [...new Set(openable[i].steps.filter((s) => !s.ref).map((s) => s.module))].filter((m) => openable[j].steps.some((s) => !s.ref && s.module === m));
    if (files.length) out.push(`- ${openable[i].p.fullName} 與 ${openable[j].p.fullName} 的 step 都住 ${files.map((m) => `\`${m}\``).join('、')}:可以同時開,整合時這些檔案兩邊都動`);
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
    out.push(`- ${g.id}(${g.target} / ${g.role}):dev-flow:revise`);
  }
  for (const s of design.spikes.filter((s) => s.status === 'open')) {
    deciding++;
    out.push(`- ${s.fullName} 還 open`);
  }
  for (const x of a.info.values()) if (x.p.status === 'draft') {
    deciding++;
    out.push(`- ${x.p.fullName} 還是 draft:dev-flow:feature 討論完改 ready`);
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
  for (const [m, list] of [...byModule].sort()) out.push(`- ${m}:${list.map((s) => `${s.doc}#${s.name}${s.state === '願望' ? '(願望)' : s.hit && s.hit.stub ? '(骨架)' : s.observe ? '(觀察點)' : ''}`).join('、')}`);

  out.push('', '## 6. 修訂熱點');
  const hot = [...a.info.values()].filter((x) => x.p.revs.length).sort((x, y) => y.p.revs.length - x.p.revs.length).slice(0, 3);
  if (!hot.length) out.push('- 無(還沒有任何 REV)');
  for (const x of hot) out.push(`- ${x.p.fullName}:REV ${x.p.revs.length} 條,最後一條「${(x.p.lastRev || '').slice(0, 60)}」`);
  const wide = [...a.info.values()].filter((x) => x.referrers.length >= 2).sort((x, y) => y.referrers.length - x.referrers.length).slice(0, 3);
  for (const x of wide) out.push(`- ${x.p.fullName}:${x.referrers.length} 份文檔引用它,改它要一起 REV`);

  out.push('', '## 7. 警訊');
  const warns = [];
  const warn = (where, what, fix) => warns.push([where, what, fix]);
  if (!sys) warn('system.md', '不存在', 'dev-flow:project 立案');
  else if (sys.visionState === 'missing') warn('system.md', '沒有 ## 願景 節', 'dev-flow:project 訂願景');
  else if (sys.visionState === 'template') warn('system.md', '願景還是模板', 'dev-flow:project 訂願景');
  if (!ov.objs.length) warn(design.objectives.exists ? 'objectives.md' : '.design/', '沒有任何目標', 'dev-flow:objective 訂第一個目標(至少一個)');
  const seenM = new Set();
  for (const o of ov.objs) {
    if (o.placeholder) warn(o.id, '目標還是模板', 'dev-flow:objective 寫成一句話');
    if (!o.priority) warn(o.id, `優先「${o.priorityRaw || '(沒填)'}」不是 1 到 4`, '改成 1(最高)到 4(最低)');
    if (!o.criteria) warn(o.id, '沒有可觀察的判準', 'dev-flow:objective 補一句達成時看得到什麼');
    if (!o.ms.length) warn(o.id, '沒有任何里程碑', 'dev-flow:objective 補里程碑並綁定文檔');
    for (const m of o.ms) {
      if (seenM.has(m.id)) warn(m.id, '里程碑編號重複', '編號全檔唯一;配號只走 devflow objective milestone');
      seenM.add(m.id);
      if (m.placeholder) warn(m.id, '里程碑還是模板', 'dev-flow:objective 寫成一句話');
      if (!m.binds.length) warn(m.id, '沒有綁定任何文檔', 'devflow claim feature <slug> --milestone ' + m.id + ',或在綁定欄填既有的 feature 全名');
      for (const d of m.docs) {
        if (!d.x) warn(m.id, `綁定的 ${d.name} 不存在`, '改成 features/ 裡有的全名,或刪這個綁定');
        else if (d.x.p.kind === 'abstract') warn(m.id, `綁定的 ${d.name} 是 abstract`, '改綁引用它的 feature;abstract 跟著 feature 達成');
      }
    }
  }
  for (const f of unbound) warn(f, '沒有被任何里程碑綁定', '不朝向任何目標:dev-flow:objective 綁進一條里程碑,或刪掉這份 feature');
  const consumers = new Map(design.abstracts.map((x) => [x.fullName, []]));
  for (const d of design.docs) for (const s of d.steps) if (s.ref && consumers.has(s.ref)) consumers.get(s.ref).push(d.fullName);
  for (const [name, cs] of consumers) if (new Set(cs).size === 1) warn(name, `只有 ${cs[0]} 用它`, '收整沒有成立;dev-flow:refactor 搬回去,或找出第二個消費者');
  const gapIds = new Map();
  for (const g of design.gaps.gaps) gapIds.set(g.id, (gapIds.get(g.id) || 0) + 1);
  for (const [id, n] of gapIds) if (n > 1) warn(id, `gaps.md 裡出現 ${n} 次`, '兩條 build 分支各自配了同一個號;後合進來的往上移(roles.md「整合」)');
  for (const x of a.info.values()) {
    const p = x.p;
    if (!p.hasFrontmatter) warn(p.file, '沒有 frontmatter', '照 templates/ 補');
    if (p.status && !STATUSES.includes(p.status)) warn(p.file, `status「${p.status}」不合法`, '改成 draft / ready / frozen');
    const t = p.template;
    if (t.steps || t.laws || t.examples) warn(p.fullName, `還是模板(${[t.steps && `Steps ${t.steps} 列`, t.laws && `Laws ${t.laws} 條`, t.examples && `Examples ${t.examples} 列`].filter(Boolean).join('、')}是佔位符)`, 'dev-flow:feature 討論完寫成真的');
    if (p.status === 'frozen' && [...x.laws, ...x.examples].some((l) => l.result === 'red')) warn(p.fullName, 'frozen 而測試紅', '先解凍再修');
    if (p.status === 'frozen' && p.revs.length && !p.thawed) warn(p.fullName, 'frozen 而有 REV 卻沒有解凍紀錄', '在「決定」補一條解凍');
    if (p.status === 'ready' && x.achieved) warn(p.fullName, '已達成', 'build 收尾改 frozen');
    if (listed.length && p.kind === 'feature' && !listed.some((l) => l.fullName === p.fullName)) warn(p.fullName, '不在 system.md 的 Features 表', '補一列');
    for (const s of x.steps) if (s.state === '不一致') warn(`${p.fullName}#${s.name}`, '簽名與程式碼不一致', 'devflow lint sig 看兩邊;誰對就改另一邊,改文檔走 REV');
    for (const s of x.steps) if (s.state === '搬家') warn(`${p.fullName}#${s.name}`, `程式碼在 ${s.hit.file}`, 'devflow sync');
    for (const l of [...x.laws, ...x.examples]) if (l.result === 'red') warn(l.key, '測試紅', '仲裁:先歸因再改');
  }
  for (const l of listed) {
    if (!design.docs.some((d) => d.fullName === l.fullName)) warn('system.md', `列了 ${l.fullName},features/ 沒有這個檔`, '刪那一列或 devflow claim');
  }
  if (source) {
    const b = lintBoundary(design, source, adapter);
    if (b.red.length) warn('模組表 / 層', `lint boundary ${b.red.length} 條不合規`, 'devflow lint boundary');
  }
  if (!warns.length) out.push('- 無');
  else {
    out.push('| 哪裡 | 什麼事 | 怎麼辦 |', '|---|---|---|');
    for (const [w, what, fix] of warns) out.push(`| ${w} | ${what} | ${fix} |`);
  }

  out.push('', '## 8. 建議路線');
  let n = 1;
  if (a.openGaps.length) out.push(`${n++}. 先回答 ${a.openGaps.map((g) => g.id).join('、')}(dev-flow:revise),卡住的 step 才能重派`);
  const order = [...a.info.values()].filter((x) => !x.achieved && x.p.status === 'ready').sort((x, y) => ov.keyOf(x.p.fullName) - ov.keyOf(y.p.fullName) || x.refs.length - y.refs.length);
  for (const x of order) out.push(`${n++}. dev-flow:build ${x.p.fullName}(${x.p.kind === 'abstract' ? `abstract,${x.referrers.length ? `${x.referrers.join('、')} 引用它` : '沒有消費者'}` : ov.tag(x.p.fullName)})`);
  const drafts = [...a.info.values()].filter((x) => x.p.status === 'draft');
  if (drafts.length) out.push(`${n++}. ${drafts.map((x) => x.p.fullName).join('、')} 討論完改 ready`);
  const allDone = [...a.info.values()].every((x) => x.achieved) && !a.openGaps.length;
  if (n === 1) {
    const notDone = [...a.info.values()].filter((x) => !x.achieved);
    if (!a.info.size) out.push(`- 還沒有任何文檔;${ov.objs.length ? 'devflow claim feature <slug> --milestone <M-n> 建第一份' : '先 dev-flow:objective 訂目標與里程碑,再 devflow claim feature <slug> --milestone <M-n>'}`);
    else if (allDone && !warns.length) out.push('- 目前功能全部正常運作:每份文檔達成、測試全綠、沒有 open GAP、沒有警訊。沒有非做不可的事,可以加新功能:devflow claim feature <slug>');
    else if (allDone) out.push(`- 目前功能全部正常運作(每份文檔達成、測試全綠、沒有 open GAP);警訊還有 ${warns.length} 條,照第 7 段的怎麼辦欄清,清完加新功能`);
    else if (notDone.some((x) => x.unknown || x.laws.some((l) => l.result === '未跑'))) out.push(`- 沒有可派的線,但 ${notDone.map((x) => x.p.fullName).join('、')} 的 laws 綠幾條未知:先給測試輸出(--tests <log> 或 --run),才知道功能是不是全部正常`);
    else out.push(`- 沒有可派的線,但 ${notDone.map((x) => x.p.fullName).join('、')} 還沒達成:devflow status --doc <全名> 看哪一列還不在;不加新功能`);
  }

  return { text: out.join('\n'), exitCode: allDone && a.info.size ? 0 : 1 };
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
  out.push('', `文檔寫了 ${x.sigTotal} 條簽名,程式碼裡有 ${x.sigOk} 條,還是骨架的 ${x.stubCount} 條${obs} · 寫了 ${x.laws.length} 條 law,通過 ${x.unknown ? 'nan' : x.laws.filter((l) => l.result === 'green').length} 條 · ${x.achieved ? '達成' : '未達成'}`);
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
