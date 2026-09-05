// status:派工報告。全部從 .design、程式碼與測試輸出推。
import { execSync } from 'node:child_process';
import fs from 'node:fs';
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
      else state = '在';
      return { ...s, state, hit };
    });
    const sigOk = stages.filter((s) => s.state === '在' || s.state === '搬家').length;
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
    info.set(p.fullName, { p, stages, sigOk, sigTotal: stages.length, laws, examples, gaps, refs, referrers: [] });
  }
  for (const [, x] of info) for (const r of x.refs) if (info.has(r)) info.get(r).referrers.push(x.p.fullName);
  // 沒寫 ref 但 stage 名字是別條 pipeline 的 stage,也算引用
  for (const [, x] of info) {
    for (const s of x.stages) {
      if (s.ref || s.whole) continue;
      for (const [, y] of info) {
        if (y === x) continue;
        if (y.stages.some((t) => t.name === s.name)) {
          if (!x.refs.includes(y.p.fullName)) x.refs.push(y.p.fullName);
          if (!y.referrers.includes(x.p.fullName)) y.referrers.push(x.p.fullName);
        }
      }
    }
  }
  const selfDone = (x) => x.sigOk === x.sigTotal && x.sigTotal > 0 && x.laws.length > 0 && x.laws.every((l) => l.result === 'green') && x.examples.every((e) => e.result === 'green') && x.gaps.length === 0;
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
    x.blockedBy = x.refs.filter((r) => info.has(r) && !info.get(r).achieved);
    x.unknown = !results && x.laws.some((l) => l.traced);
  }
  return { info, byName, byId, openGaps, markers };
}

export function loadResults(design, adapter, flags, root) {
  if (!adapter || !adapter.testResults) return { results: null, note: '此 adapter 不解析測試輸出' };
  if (flags.tests) {
    if (!fs.existsSync(flags.tests)) return { results: null, note: `找不到測試輸出 ${flags.tests}` };
    return { results: adapter.testResults(fs.readFileSync(flags.tests, 'utf8')), note: `測試結果來自 ${flags.tests}` };
  }
  if (flags.run) {
    const cmd = design.system && design.system.commands['測試(整套)'];
    if (!cmd) return { results: null, note: 'system.md「語言與工具」沒有整套測試指令,--run 不知道跑什麼' };
    let out = '';
    try {
      out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      out = (e.stdout || '') + (e.stderr || '');
    }
    return { results: adapter.testResults(out), note: `測試結果來自 --run:${cmd}` };
  }
  return { results: null, note: '沒給測試輸出(--tests <log> 或 --run),幾條 law 通過測試未知' };
}

function row(x) {
  const g = x.laws.filter((l) => l.result === 'green').length;
  const traced = x.laws.filter((l) => l.traced).length;
  const state = x.achieved ? '達成' : x.gaps.length ? `卡 ${x.gaps.map((g) => g.id).join('、')}` : x.blockedBy.length ? `等 ${x.blockedBy.join('、')}` : '進行中';
  return `| ${x.p.fullName} | ${x.p.status || '(無)'} | ${x.sigTotal} | ${x.sigOk} | ${x.laws.length} | ${traced} | ${x.unknown ? '未跑' : g} | ${state} |`;
}

export function statusReport(design, source, adapter, results, resultNote) {
  const a = analyze(design, source, adapter, results);
  const out = [];
  const listed = design.system ? design.system.pipelines : [];
  const milestones = listed.filter((l) => l.kind === '里程碑').map((l) => l.fullName);
  const total = listed.length || design.pipelines.length;
  const achievedAll = [...a.info.values()].filter((x) => x.achieved).length;
  const achievedMilestones = milestones.filter((m) => a.info.has(m) && a.info.get(m).achieved).length;
  const wishStages = [...a.info.values()].flatMap((x) => x.stages.filter((s) => s.state === '願望' || s.state === '找不到').map((s) => ({ ...s, pipeline: x.p.fullName })));

  out.push(`# lawful status`);
  out.push(`里程碑 ${milestones.length} 條,達成 ${achievedMilestones} 條 · pipeline ${total} 條,達成 ${achievedAll} 條 · 還沒實作的 stage ${wishStages.length} 個 · 還開著的 GAP ${a.openGaps.length} 條`);
  out.push(`· ${resultNote}`);
  out.push('');
  out.push('## pipelines');
  out.push('| pipeline | status | 文檔寫了幾條簽名 | 程式碼裡有幾條 | 寫了幾條 law | 幾條 law 有測試 | 幾條 law 通過 | 狀態 |');
  out.push('|---|---|---|---|---|---|---|---|');
  for (const x of a.info.values()) out.push(row(x));

  out.push('', '## 1. 今天能開幾條線');
  const openable = [...a.info.values()].filter((x) => x.p.status === 'ready' && !x.achieved && !x.gaps.length && !x.blockedBy.some((r) => a.info.get(r).gaps.length || a.info.get(r).p.status !== 'ready' && !a.info.get(r).achieved));
  if (!openable.length) out.push('- 無');
  for (const x of openable) out.push(`- ${x.p.fullName}:lawful:build ${x.p.fullName}${x.blockedBy.length ? `(引用的 ${x.blockedBy.join('、')} 未達成,同一波先做子流)` : ''}`);

  out.push('', '## 2. 卡住的');
  let stuck = 0;
  for (const x of a.info.values()) {
    for (const g of x.gaps) {
      stuck++;
      out.push(`- ${g.target} 停在 ${g.id}(${g.role} 提)`);
    }
    for (const r of x.blockedBy) {
      const y = a.info.get(r);
      if (y.p.status !== 'ready' || y.gaps.length) {
        stuck++;
        out.push(`- ${x.p.fullName} 等 ${r}(${y.p.status === 'draft' ? '還是 draft' : y.gaps.length ? `卡 ${y.gaps.map((g) => g.id).join('、')}` : '未達成'})`);
      }
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
  for (const [m, list] of [...byModule].sort()) out.push(`- ${m}:${list.map((s) => `${s.pipeline}#${s.name}${s.state === '願望' ? '(願望)' : ''}`).join('、')}`);

  out.push('', '## 6. 警訊');
  const warns = [];
  const warn = (where, what, fix) => warns.push([where, what, fix]);
  for (const x of a.info.values()) {
    const p = x.p;
    if (!p.hasFrontmatter) warn(p.file, '沒有 frontmatter', '照 templates/pipeline.md 補');
    if (p.status && !STATUSES.includes(p.status)) warn(p.file, `status「${p.status}」不合法`, '改成 draft / ready / frozen');
    if (p.status === 'frozen' && x.laws.some((l) => l.result === 'red')) warn(p.fullName, 'frozen 而測試紅', '先解凍再修');
    if (p.status === 'frozen' && p.revs.length && !p.thawed) warn(p.fullName, 'frozen 而有 REV 卻沒有解凍紀錄', '在「決定」補解凍一條');
    if (p.status === 'ready' && x.achieved && milestones.includes(p.fullName)) warn(p.fullName, '里程碑已達成', 'conductor 改 frozen');
    if (listed.length && !listed.some((l) => l.fullName === p.fullName)) warn(p.fullName, '不在 system.md 的 Pipelines 表', '補一列,類別填里程碑或子流');
    for (const s of x.stages) if (s.state === '不一致') warn(`${p.fullName}#${s.name}`, '簽名與程式碼不一致', 'lint sig 看兩邊;誰對就改另一邊,改文檔走 REV');
    for (const s of x.stages) if (s.state === '搬家') warn(`${p.fullName}#${s.name}`, `程式碼在 ${s.hit.module}`, 'lawful sync');
    for (const l of [...x.laws, ...x.examples]) if (l.result === 'red') warn(l.key, '測試紅', '仲裁:先歸因再改');
  }
  for (const l of listed) {
    if (!a.byName.has(l.fullName)) warn('system.md', `列了 ${l.fullName},pipelines/ 沒有這個檔`, '刪那一列或 lawful claim');
    if (!['里程碑', '子流'].includes(l.kind)) warn('system.md', `${l.fullName} 類別「${l.kind}」`, '改成里程碑或子流');
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
  const order = [...a.info.values()].filter((x) => !x.achieved && x.p.status === 'ready').sort((x, y) => (x.refs.length - y.refs.length));
  order.forEach((x, i) => out.push(`${(a.openGaps.length ? 2 : 1) + i}. lawful:build ${x.p.fullName}`));
  const drafts = [...a.info.values()].filter((x) => x.p.status === 'draft');
  if (drafts.length) out.push(`${(a.openGaps.length ? 2 : 1) + order.length}. ${drafts.map((x) => x.p.fullName).join('、')} 討論完改 ready`);
  if (!a.openGaps.length && !order.length && !drafts.length) out.push('- 全部達成或 frozen;下一條 pipeline 用 lawful claim');

  const allDone = [...a.info.values()].every((x) => x.achieved) && !a.openGaps.length;
  return { text: out.join('\n'), exitCode: allDone && a.info.size ? 0 : 1 };
}

export function pipelineDetail(design, source, adapter, results, resultNote, name) {
  const a = analyze(design, source, adapter, results);
  const x = [...a.info.values()].find((v) => v.p.fullName === name || v.p.id === name);
  if (!x) return { text: `沒有 ${name} 這條 pipeline`, exitCode: 1 };
  const out = [`# ${x.p.fullName}  ${x.p.status}`, x.p.description, `· ${resultNote}`, '', '## Stages'];
  for (const s of x.stages) out.push(`- ${s.whole ? '=' : s.index}  ${s.name} :: ${s.type}  ${s.module}/${s.layer}  ${s.state}${s.state === '搬家' ? ` → ${s.hit.module}` : ''}${s.ref ? `  見 ${s.ref}` : ''}`);
  out.push('', '## Laws');
  for (const l of x.laws) out.push(`- ${l.id} [${l.kind}] ${l.title}  ${l.result}`);
  for (const e of x.examples) out.push(`- ${e.id} 覆蓋 ${e.covers.join('、')}  ${e.result}`);
  out.push('', '## GAP');
  if (!x.gaps.length) out.push('- 無');
  for (const g of x.gaps) out.push(`- ${g.id}(${g.target} / ${g.role})`);
  out.push('', '## 引用');
  out.push(`- 引用了:${x.refs.length ? x.refs.join('、') : '無'}`);
  out.push(`- 被引用:${x.referrers.length ? x.referrers.join('、') : '無'}`);
  out.push('', `文檔寫了 ${x.sigTotal} 條簽名,程式碼裡有 ${x.sigOk} 條 · 寫了 ${x.laws.length} 條 law,通過 ${x.unknown ? '未跑' : x.laws.filter((l) => l.result === 'green').length} 條 · ${x.achieved ? '達成' : '未達成'}`);
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
      out.push(`- ${x.p.fullName}#${s.name}  ${s.state}  掛在上面的 law ${lawsOn.length} 條,通過 ${x.unknown ? '未跑' : g} 條`);
    }
  }
  if (!n) out.push('- 沒有任何 pipeline 的 stage 住在這裡');
  return { text: out.join('\n'), exitCode: 0 };
}
