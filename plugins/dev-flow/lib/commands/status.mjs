// status:派工報告。全部從 .design、程式碼與測試輸出推,沒有任何一格是人手動維護的。
import { execSync } from 'node:child_process';
import fs from 'node:fs';
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

function row(x) {
  const g = x.laws.filter((l) => l.result === 'green').length;
  const traced = x.laws.filter((l) => l.traced).length;
  const state = x.achieved ? '達成' : x.gaps.length ? `卡 ${x.gaps.map((g) => g.id).join('、')}` : x.blockedBy.length ? `等 ${x.blockedBy.join('、')}` : '進行中';
  return `| ${x.p.fullName} | ${x.p.kind === 'abstract' ? 'abstract' : 'feature'} | ${x.p.status || '(無)'} | ${x.sigTotal} | ${x.sigOk} | ${x.stubCount} | ${x.laws.length} | ${x.unknown ? 'nan' : g}/${traced} | ${x.p.revs.length} | ${state} |`;
}

export function statusReport(design, source, adapter, results, resultNote) {
  const a = analyze(design, source, adapter, results);
  const out = [];
  const listed = design.system ? design.system.listed : [];
  const features = design.features.map((f) => f.fullName);
  const achievedAll = [...a.info.values()].filter((x) => x.achieved).length;
  const achievedFeatures = features.filter((m) => a.info.has(m) && a.info.get(m).achieved).length;
  const todo = [...a.info.values()].flatMap((x) => x.steps.filter((s) => s.state === '願望' || s.state === '找不到' || (s.hit && s.hit.stub)).map((s) => ({ ...s, doc: x.p.fullName })));

  out.push('# devflow status');
  out.push(`feature ${features.length} 份,達成 ${achievedFeatures} 份 · abstract ${design.abstracts.length} 份 · 文檔共 ${a.info.size} 份,達成 ${achievedAll} 份 · 還沒實作的 step ${todo.length} 個 · 還開著的 GAP ${a.openGaps.length} 條`);
  out.push(`· ${resultNote}`);
  out.push('');
  out.push('## 文檔');
  out.push('| 文檔 | 類別 | status | 文檔簽名數 | 程式碼對到 | 還是骨架 | law 條數 | law 綠/翻 | REV | 狀態 |');
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const x of a.info.values()) out.push(row(x));

  out.push('', '## 1. 今天能開幾條線');
  const openable = [...a.info.values()].filter((x) => x.p.status === 'ready' && !x.achieved && !x.gaps.length && !x.blockedBy.some((r) => a.info.get(r).gaps.length || (!['ready', 'frozen'].includes(a.info.get(r).p.status) && !a.info.get(r).achieved)));
  if (!openable.length) out.push('- 無');
  for (const x of openable) out.push(`- ${x.p.fullName}:dev-flow:build ${x.p.fullName}${x.blockedBy.length ? `(引用的 ${x.blockedBy.join('、')} 未達成,同一波先做 abstract)` : ''}`);

  out.push('', '## 2. 卡住的');
  let stuck = 0;
  for (const x of a.info.values()) {
    for (const g of x.gaps) {
      stuck++;
      out.push(`- ${g.target} 停在 ${g.id}(${g.role} 提)`);
    }
    for (const r of x.blockedBy) {
      const y = a.info.get(r);
      if ((y.p.status !== 'ready' && y.p.status !== 'frozen') || y.gaps.length) {
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
  const consumers = new Map(design.abstracts.map((x) => [x.fullName, []]));
  for (const d of design.docs) for (const s of d.steps) if (s.ref && consumers.has(s.ref)) consumers.get(s.ref).push(d.fullName);
  for (const [name, cs] of consumers) if (new Set(cs).size === 1) warn(name, `只有 ${cs[0]} 用它`, '收整沒有成立;dev-flow:refactor 搬回去,或找出第二個消費者');
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
  const order = [...a.info.values()].filter((x) => !x.achieved && x.p.status === 'ready').sort((x, y) => x.refs.length - y.refs.length);
  for (const x of order) out.push(`${n++}. dev-flow:build ${x.p.fullName}`);
  const drafts = [...a.info.values()].filter((x) => x.p.status === 'draft');
  if (drafts.length) out.push(`${n++}. ${drafts.map((x) => x.p.fullName).join('、')} 討論完改 ready`);
  if (n === 1) out.push('- 全部達成或 frozen;下一份用 devflow claim');

  const allDone = [...a.info.values()].every((x) => x.achieved) && !a.openGaps.length;
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
