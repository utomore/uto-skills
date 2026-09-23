// 看板:同一份 status 的第二個渲染器。analyze() 算好的圖原樣吐成 JSON,再灌進 templates/status-board.html 成一個自帶資料的單檔網頁。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { releaseView, releaseWord } from './release.mjs';
import { analyze, buildKeyOf, counts, docState, globalView, invariantView, metWord, lineTag, requirementView, openLines, reviseLines, sliceLines, suggestRoutes, verifySteps, warnings } from './status.mjs';

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'status-board.html');
const TOKEN = '__STATUS_JSON__';

// 三行式原樣帶出去:forall、given(可以好幾行)、|-;還沒有三行式就是空陣列
const threeLines = (l) => [l.forall, ...(l.given || []), l.conclusion].filter(Boolean);

function lawsOf(x) {
  return {
    total: x.laws.length,
    green: x.unknown ? null : x.laws.filter((l) => l.result === 'green').length,
    traced: x.laws.filter((l) => l.traced).length,
    items: x.laws.map((l) => ({ id: l.id, kind: l.kind || null, title: l.title || '', result: l.result, lines: threeLines(l) })),
  };
}

function examplesOf(x) {
  return {
    total: x.examples.length,
    green: x.unknown ? null : x.examples.filter((e) => e.result === 'green').length,
    items: x.examples.map((e) => ({ id: e.id, covers: e.covers || [], result: e.result })),
  };
}

// 看板模板與 lawful 共用,它從 law.holds 取顏色:需求這一格裝的是驗收(達成與否)
const lawJson = (law, state) => ({
  title: law ? law.title : '',
  formal: !!(law && law.formal),
  holds: state.holds,
  source: state.source,
  tested: !!state.tested,
});

export function statusJson(design, source, adapter, results, resultNote, building = new Set(), stale = new Set(), root = null) {
  const a = analyze(design, source, adapter, results);
  const ov = requirementView(design, a);
  const rel = releaseView(root, design, a, ov);
  const inv = invariantView(design, a);
  const glob = globalView(design, a, source, adapter, inv);
  const warns = warnings(design, a, ov, source, adapter, stale, inv, glob);
  const route = suggestRoutes(design, a, ov, warns.length, building, inv);
  const slices = sliceLines(ov, building, design, a);
  const revisions = reviseLines(ov, building);
  const { openable, inBuild, shared } = openLines(a, ov, building);
  const sys = design.system;
  const n = counts(design, a, ov, inv);

  const docs = [...a.info.values()].map((x) => {
    const at = ov.rank.get(x.p.fullName) || null;
    return {
      name: x.p.fullName,
      id: x.p.id,
      kind: x.p.kind === 'abstract' ? 'abstract' : 'feature',
      status: x.p.status || null,
      description: x.p.description || '',
      state: docState(x),
      achieved: x.achieved,
      building: !!buildKeyOf(x, ov, building),
      requirement: at ? at.q.id : null,
      priority: at ? at.q.priority : null,
      milestone: at ? at.m.fullName : null,
      signatures: { total: x.sigTotal, matched: x.sigOk, stub: x.stubCount },
      observations: { total: x.obsTotal, matched: x.obsOk },
      laws: lawsOf(x),
      examples: examplesOf(x),
      revisions: { count: x.p.revs.length, last: x.p.lastRev },
      gaps: x.gaps.map((g) => g.id),
      refs: x.refs,
      referrers: x.referrers,
      blockedBy: x.blockedBy,
      missing: [...new Set(x.missing.map((s) => s.name))],
      heldBy: x.heldBy ? x.heldBy.m.fullName : null,
      modules: [...new Set(x.steps.filter((s) => !s.ref).map((s) => s.module))],
      steps: x.steps.map((s) => ({
        index: s.index,
        name: s.name,
        signature: s.sigText,
        module: s.module,
        layer: s.layer,
        state: s.state,
        at: s.hit ? s.hit.file : null,
        ref: s.ref || null,
        observe: !!s.observe,
        entry: !!s.entry,
      })),
    };
  });

  // system.md「Constraint」那行「優先:1 = …;2 = …」拆成各級的意思,寫在需求的區塊上
  const tierMeaning = new Map();
  if (sys && sys.priorityNoteState === 'ok') for (const part of sys.priorityNote.split(/[;；]/)) {
    const m = /^\s*([1-4])\s*[=＝:：]\s*(.+?)[。.]?\s*$/.exec(part);
    if (m) tierMeaning.set(Number(m[1]), m[2].trim());
  }
  // 看板的分法:一條需求一個區塊,區塊底下一條里程碑一欄(里程碑照表上的先後排);
  // 沒被綁的 feature 自成一個區塊;abstracts/ 底下照讀進來而沒被綁的文檔另成一個區塊
  const bound = new Set(ov.reqs.flatMap((q) => q.ms.flatMap((m) => m.binds)));
  const bands = ov.reqs.map((q) => ({
    id: q.id,
    title: `${q.id} ${q.title}`,
    note: `審核:${q.state} · ${q.source}`,
    notes: [
      `優先 ${q.priorityRaw || '(沒填)'}${q.priority && tierMeaning.has(q.priority) ? `:${tierMeaning.get(q.priority)}` : ''}`,
      `里程碑 ${q.done}/${q.ms.length} 達成 · 完成度 ${q.pct == null ? '-' : `${q.pct}%`}`,
    ],
    achieved: q.holds === true,
    columns: q.ms.map((m) => ({ title: `${m.fullName} ${m.title}${!m.binds.length ? '(還沒有切片)' : m.state === '待修訂' ? '(待修訂)' : ''}`, achieved: m.achieved, docs: m.binds })),
    empty: q.ms.length ? null : '沒有任何里程碑',
  }));
  const loose = docs.filter((d) => d.kind === 'feature' && !bound.has(d.name)).map((d) => d.name);
  if (loose.length) bands.push({ id: 'loose', title: '不朝向任何需求', note: `${loose.length} 份 feature 沒有被任何里程碑綁定`, notes: [], achieved: false, columns: [{ title: 'feature', achieved: false, docs: loose }], empty: null });
  const sharedDocs = docs.filter((d) => d.kind === 'abstract' && !bound.has(d.name)).map((d) => d.name);
  if (sharedDocs.length) bands.push({ id: 'shared', title: '共用', note: '不被里程碑綁定的文檔,跟著引用它的 feature 達成', notes: [], achieved: false, columns: [{ title: '被 feature 引用', achieved: false, docs: sharedDocs }], empty: null });
  if (!bands.length) bands.push({ id: 'empty', title: '還沒有任何需求', note: 'dev-flow:require-design 談第一條', notes: [], achieved: false, columns: [], empty: null });

  const summary = {
    requirements: n.requirements,
    requirementsHolding: n.requirementsHolding,
    requirementsPending: n.requirementsPending,
    requirementsRecheck: n.requirementsRecheck,
    invariants: n.invariants,
    invariantsHolding: n.invariantsHolding,
    milestones: n.milestones,
    milestonesAchieved: n.milestonesAchieved,
    features: n.features,
    featuresAchieved: n.featuresAchieved,
    abstracts: n.abstracts,
    docs: n.docs,
    docsAchieved: n.docsAchieved,
    todoSteps: n.todo.length,
    openGaps: n.openGaps,
  };

  return {
    tool: 'devflow',
    labels: { unit: '文檔', steps: 'Steps', measure: '份文檔' },
    vision: sys && sys.visionState === 'ok' ? sys.vision : null,
    visionFull: sys && sys.visionState === 'ok' ? sys.visionFull : null,
    visionState: sys ? sys.visionState : null,
    priorityNote: sys && sys.priorityNoteState === 'ok' ? sys.priorityNote : null,
    // 名詞表(專案根目錄 CLAUDE.md 的「## 名詞」節)原樣帶出去:名詞、定義、型別(還沒有型別是 null)
    glossary: (design.glossary || []).map((g) => ({ term: g.term, definition: g.definition, type: g.type || null })),
    tests: resultNote,
    summary,
    headline: [
      { label: '需求', value: `${summary.requirementsHolding} / ${summary.requirements} 已驗收 · 等人工審核 ${summary.requirementsPending}${summary.requirementsRecheck ? ` · 待重審 ${summary.requirementsRecheck}` : ''}` },
      { label: '領域不變量', value: `${summary.invariantsHolding} / ${summary.invariants} 成立` },
      { label: '里程碑', value: `${summary.milestonesAchieved} / ${summary.milestones} 達成` },
      { label: 'feature', value: `${summary.featuresAchieved} / ${summary.features} 達成` },
      ...(summary.abstracts ? [{ label: '共用文檔', value: `${summary.abstracts} 份` }] : []),
      { label: '還沒實作的 step', value: `${summary.todoSteps} 個` },
      { label: '還開著的 GAP', value: `${summary.openGaps} 條` },
    ],
    requirements: ov.reqs.map((q) => ({
      id: q.id,
      name: q.fullName,
      file: q.file,
      title: q.title,
      priority: q.priority,
      priorityRaw: q.priorityRaw || null,
      law: lawJson(q.accept, q),
      note: `審核:${q.state} · 里程碑 ${q.done}/${q.ms.length} 達成`,
      dependsOn: q.dependsOn,
      built: q.built,
      state: q.state,
      evidence: q.evidence || null,
      signoff: q.signoff ? { date: q.signoff.date, by: q.signoff.by, evidence: q.signoff.evidence } : null,
      // 上線:git repo 的根才有,從 git tag 推;證據還沒齊的需求是 null
      release: rel && rel.get(q.id).eligible ? { tag: rel.get(q.id).tag, word: releaseWord(rel, q.id), pending: rel.get(q.id).pending.map((p) => ({ doc: p.doc, sha: p.sha })) } : null,
      verifySteps: verifySteps(design, q),
      achieved: q.holds === true,
      percent: q.pct,
      milestonesAchieved: q.done,
      milestones: q.ms.map((m) => ({ id: m.id, name: m.fullName, title: m.title, achieved: m.achieved, state: m.state, byRevision: m.byRevision, binds: m.binds })),
    })),
    invariants: inv.map((v) => ({ id: v.id, kind: v.kind || null, title: v.title, formal: !!v.law.formal, lines: threeLines(v.law), holds: v.holds, source: v.source, tested: v.tested })),
    // 全域 Law 另外兩類的每一列:層表(由內而外)與對外 I/O 表;gates 是三類各自那一道 lint 的結果,與報告的「全域 Law」表同源
    globalLaws: {
      gates: glob.map((g) => ({ kind: g.kind, where: g.where, gate: g.gate, red: g.red, result: g.result })),
      layers: sys ? sys.layers.map((l) => ({ name: l.name, what: l.what })) : [],
      io: sys ? sys.io.map((r) => ({ name: r.name, direction: r.direction, type: r.type, module: r.module, entry: r.feature, trust: r.trust || null, guard: r.guard && !/^[-—–]$/.test(r.guard) ? r.guard : null, contract: r.contract })) : [],
    },
    bands,
    docs,
    edges: docs.flatMap((d) => d.refs.map((r) => ({ from: d.name, to: r }))),
    lines: {
      openable: openable.map((x) => ({ name: x.p.fullName, tag: lineTag(x, ov) })),
      building: inBuild.map((x) => ({ name: x.p.fullName, tag: lineTag(x, ov) })),
      slices: slices.openable.map((s) => ({ name: s.m.fullName, requirement: s.q.id, title: s.m.title })),
      slicesBuilding: slices.inBuild.map((s) => ({ name: s.m.fullName, requirement: s.q.id, title: s.m.title })),
      revisions: revisions.openable.map((s) => ({ name: s.m.fullName, requirement: s.q.id, title: s.m.title, revise: s.m.toRevise })),
      revisionsBuilding: revisions.inBuild.map((s) => ({ name: s.m.fullName, requirement: s.q.id, title: s.m.title, revise: s.m.toRevise, branch: `build/${s.key}` })),
      shared,
    },
    gaps: a.openGaps.map((g) => ({ id: g.id, target: g.target, role: g.role })),
    warnings: warns.map(([where, what, fix]) => ({ where, what, fix })),
    route,
  };
}

// 用系統預設的方式打開檔案;打不開不算失敗,網址還是印得出來
function openInBrowser(file) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', file]]
    : process.platform === 'darwin' ? ['open', [file]]
    : ['xdg-open', [file]];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch {
    return false;
  }
}

export function statusBoard(design, source, adapter, results, resultNote, building, root, out, open, stale) {
  const data = statusJson(design, source, adapter, results, resultNote, building, stale, root);
  // 沒指定檔名就寫暫存區:每次跑 status 都產一份,不在專案裡留檔
  const file = typeof out === 'string'
    ? path.resolve(root, out)
    : path.join(os.tmpdir(), 'devflow-board', `${path.basename(root) || 'devflow'}-status.html`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(TEMPLATE)) return { text: `找不到看板模板 ${TEMPLATE}`, exitCode: 1 };
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  if (!html.includes(TOKEN)) return { text: `看板模板少了 ${TOKEN}`, exitCode: 1 };
  // JSON 內嵌進 <script>:把 < 逃掉,文檔裡寫了 </script> 也不會把標籤提早關掉
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  fs.writeFileSync(file, html.replace(TOKEN, json));
  const rel = path.relative(root, file);
  const shown = !rel || rel.startsWith('..') ? file : rel;
  const url = pathToFileURL(file).href;
  const opened = open ? openInBrowser(file) : false;
  return {
    text: [
      `看板寫到 ${shown}` + (opened ? ',已經叫瀏覽器打開' : ',點這個網址打開'),
      url,
      '樹從左上往下長,每深一層往右縮排一格:願景 → 需求 → 里程碑 → 便利貼;便利貼是文檔,虛線箭頭是引用,預設只畫選取那一份的',
      '「相依」頁籤把需求排成先後:左邊先做、右邊後做,邊從文檔的引用推出來,紅色的邊是高優先依賴低優先',
      '「約束」頁籤把 law 全部攤開:上半是全域 Law 三類(領域不變量、層、對外 I/O),下半是每份文檔自己的 Scope Law,顏色是測試結果,對外 I/O 的契約欄畫成指到那條 law 的箭頭',
    ].join('\n'),
    exitCode: data.route.allDone && data.summary.docs ? 0 : 1,
  };
}
