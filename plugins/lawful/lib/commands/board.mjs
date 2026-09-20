// 看板:同一份 status 的第二個渲染器。analyze() 算好的圖原樣吐成 JSON,再灌進 templates/status-board.html 成一個自帶資料的單檔網頁。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyze, buildKeyOf, counts, docState, globalView, invariantView, metWord, moduleView, openLines, requirementView, reviseLines, sliceLines, suggestRoutes, verifySteps, warnings } from './status.mjs';

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

const lawJson = (law, state) => ({
  title: law ? law.title : '',
  formal: !!(law && law.formal),
  holds: state.holds,
  source: state.source,
  tested: !!state.tested,
});

export function statusJson(design, source, adapter, results, resultNote, building = new Set(), stale = new Set()) {
  const a = analyze(design, source, adapter, results);
  const ov = requirementView(design, a);
  const inv = invariantView(design, a);
  const glob = globalView(design, a, source, adapter, inv);
  const warns = warnings(design, a, ov, source, adapter, stale, inv, glob);
  const route = suggestRoutes(design, a, ov, warns.length, building, inv);
  const slices = sliceLines(ov, building, design);
  const revisions = reviseLines(ov, building);
  const { openable, inBuild, shared } = openLines(a, ov, building, design.modules ? design.modules.entries : []);
  const cone = design.cone;
  const mv = moduleView(design, source, a);
  const n = counts(design, a, ov, mv, inv);
  const unitNameOf = (module) => {
    const u = mv.units.find((e) => module === e.unit || module.startsWith(`${e.unit}.`));
    return u ? u.unit : null;
  };

  const docs = [...a.info.values()].map((x) => {
    const at = ov.rank.get(x.p.fullName) || null;
    return {
      name: x.p.fullName,
      id: x.p.id,
      kind: x.p.kind,
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
      revisions: { count: x.p.revs.length, last: x.p.revs.length ? x.p.revs[x.p.revs.length - 1].text : null },
      gaps: x.gaps.map((g) => g.id),
      refs: x.refs,
      referrers: x.referrers,
      blockedBy: x.blockedBy,
      modules: [...new Set(x.stages.filter((s) => !s.ref).map((s) => s.module))],
      units: [...new Set(x.stages.filter((s) => !s.ref).map((s) => unitNameOf(s.module)).filter(Boolean))],
      steps: x.stages.map((s) => ({
        index: s.index,
        name: s.name,
        signature: s.sigText,
        module: s.module,
        layer: s.layer,
        state: s.state,
        at: s.hit ? s.hit.module : null,
        ref: s.ref || null,
        observe: !!s.observe,
        entry: !!s.runner,
      })),
    };
  });

  // Cone.md「Constraint」那行「優先:1 = …;2 = …」拆成各級的意思,寫在需求的區塊上
  const tierMeaning = new Map();
  if (cone && cone.priorityNoteState === 'ok') for (const part of cone.priorityNote.split(/[;;]/)) {
    const m = /^\s*([1-4])\s*[=＝::]\s*(.+?)[。.]?\s*$/.exec(part);
    if (m) tierMeaning.set(Number(m[1]), m[2].trim());
  }
  // 看板的分法:一條需求一個區塊,區塊底下一條里程碑一欄(里程碑照表上的先後排);
  // 沒被綁的 pipeline 自己成一個區塊
  const bound = new Set(ov.reqs.flatMap((q) => q.ms.flatMap((m) => m.binds)));
  const columnsOf = (ms) => ms.map((m) => ({ title: `${m.fullName} ${m.title}${!m.binds.length ? '(還沒有切片)' : m.state === '待修訂' ? '(待修訂)' : ''}`, achieved: m.achieved, docs: m.binds }));
  const bands = ov.reqs.map((q) => ({
    id: q.id,
    title: `${q.id} ${q.title}`,
    note: `審核:${q.state} · ${q.source}`,
    notes: [
      `優先 ${q.priorityRaw || '(沒填)'}${q.priority && tierMeaning.has(q.priority) ? `:${tierMeaning.get(q.priority)}` : ''}`,
      `里程碑 ${q.done}/${q.ms.length} 達成 · 完成度 ${q.pct == null ? '-' : `${q.pct}%`}`,
    ],
    achieved: q.holds === true,
    columns: columnsOf(q.ms),
    empty: q.ms.length ? null : '沒有任何里程碑',
  }));
  const loose = docs.filter((d) => !bound.has(d.name)).map((d) => d.name);
  if (loose.length) bands.push({ id: 'loose', title: '不朝向任何需求', note: `${loose.length} 條 pipeline 沒有被任何里程碑綁定`, notes: [], achieved: false, columns: [{ title: 'pipeline', achieved: false, docs: loose }], empty: null });
  if (!bands.length) bands.push({ id: 'empty', title: '還沒有任何需求', note: 'lawful:require-design 談第一條', notes: [], achieved: false, columns: [], empty: null });

  const summary = {
    requirements: n.requirements,
    requirementsHolding: n.requirementsHolding,
    requirementsPending: n.requirementsPending,
    requirementsRecheck: n.requirementsRecheck,
    invariants: n.invariants,
    invariantsHolding: n.invariantsHolding,
    milestones: n.milestones,
    milestonesAchieved: n.milestonesAchieved,
    ioFaces: n.ioFaces,
    ioFacesAchieved: n.ioFacesAchieved,
    pipelines: n.pipelines,
    pipelinesAchieved: n.pipelinesAchieved,
    docs: a.info.size,
    docsAchieved: n.pipelinesAchieved,
    todoSteps: n.todo.length,
    openGaps: n.openGaps,
    moduleUnits: n.moduleUnits,
    moduleUnitsIdle: n.moduleUnitsIdle,
    modulesUnregistered: n.modulesUnregistered,
  };

  return {
    tool: 'lawful',
    labels: { unit: 'pipeline', steps: 'Stages', measure: '條 pipeline' },
    vision: cone && cone.visionState === 'ok' ? cone.vision : null,
    visionFull: cone && cone.visionState === 'ok' ? cone.visionFull : null,
    visionState: cone ? cone.visionState : null,
    priorityNote: cone && cone.priorityNoteState === 'ok' ? cone.priorityNote : null,
    // 名詞表(專案根目錄 CLAUDE.md 的「## 名詞」節)原樣帶出去:名詞、定義、型別(還沒有型別是 null)
    glossary: (design.glossary || []).map((g) => ({ term: g.term, definition: g.definition, type: g.type || null })),
    tests: resultNote,
    summary,
    headline: [
      { label: '需求', value: `${summary.requirementsHolding} / ${summary.requirements} 已驗收 · 等人工審核 ${summary.requirementsPending}${summary.requirementsRecheck ? ` · 待重審 ${summary.requirementsRecheck}` : ''}` },
      { label: '領域不變量', value: `${summary.invariantsHolding} / ${summary.invariants} 成立` },
      { label: '里程碑', value: `${summary.milestonesAchieved} / ${summary.milestones} 達成` },
      { label: 'io pipeline', value: `${summary.ioFacesAchieved} / ${summary.ioFaces} 達成` },
      { label: 'pipeline', value: `${summary.pipelinesAchieved} / ${summary.pipelines} 達成` },
      { label: '模組單元', value: `${summary.moduleUnits} 個${summary.moduleUnitsIdle ? ` · ${summary.moduleUnitsIdle} 個還沒有 stage` : ''}` },
      { label: '還沒實作的 stage', value: `${summary.todoSteps} 個` },
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
      verifySteps: verifySteps(design, q),
      achieved: q.holds === true,
      percent: q.pct,
      milestonesAchieved: q.done,
      milestones: q.ms.map((m) => ({ id: m.id, name: m.fullName, title: m.title, achieved: m.achieved, state: m.state, byRevision: m.byRevision, binds: m.binds })),
    })),
    invariants: inv.map((v) => ({ id: v.id, kind: v.kind || null, title: v.title, formal: !!v.law.formal, lines: threeLines(v.law), holds: v.holds, source: v.source, tested: v.tested })),
    // 全域 Law 另外兩類的每一列:四層(由內而外,各帶「裝什麼」那一句)與對外 I/O 表;gates 是三類各自那一道 lint 的結果,與報告的「全域 Law」表同源
    globalLaws: {
      gates: glob.map((g) => ({ kind: g.kind, where: g.where, gate: g.gate, red: g.red, result: g.result })),
      layers: cone ? ['types', 'effect', 'core', 'shell'].map((name) => ({ name, what: (cone.layerNotes || {})[name] || '' })) : [],
      io: design.io.map((r) => ({ name: r.name, direction: r.direction, type: r.type, module: r.module, entry: r.pipeline, trust: null, guard: null, contract: r.contract })),
    },
    bands,
    modules: {
      units: mv.units.map((u) => ({
        unit: u.unit,
        responsibility: u.responsibility || '',
        layers: u.layers,
        layerState: u.layerState.map((l) => ({ layer: l.layer, root: l.root, empty: l.empty, modules: l.modules })),
        emptyLayers: u.emptyLayers,
        pipelines: u.pipelines,
        stages: u.stages.length,
        todo: u.todo.length,
        mismatch: u.mismatch.length,
        achieved: u.achieved,
        idle: u.idle,
      })),
      unregistered: mv.unregistered,
    },
    docs,
    edges: docs.flatMap((d) => d.refs.map((r) => ({ from: d.name, to: r }))),
    lines: {
      openable: openable.map((x) => ({ name: x.p.fullName, tag: ov.tag(x.p.fullName) })),
      building: inBuild.map((x) => ({ name: x.p.fullName, tag: ov.tag(x.p.fullName) })),
      slices: slices.openable.map((s) => ({ name: s.m.fullName, requirement: s.q.id, title: s.m.title })),
      slicesBuilding: slices.inBuild.map((s) => ({ name: s.m.fullName, requirement: s.q.id, title: s.m.title })),
      revisions: revisions.openable.map((s) => ({ name: s.m.fullName, requirement: s.q.id, title: s.m.title, revise: s.m.toRevise })),
      revisionsBuilding: revisions.inBuild.map((s) => ({ name: s.m.fullName, requirement: s.q.id, title: s.m.title, revise: s.m.toRevise, branch: `build/${s.key}` })),
      shared: shared.map((s) => ({ a: s.a, b: s.b, units: s.units })),
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
  const data = statusJson(design, source, adapter, results, resultNote, building, stale);
  // 沒指定檔名就寫暫存區:每次跑 status 都產一份,不在專案裡留檔
  const file = typeof out === 'string'
    ? path.resolve(root, out)
    : path.join(os.tmpdir(), 'lawful-board', `${path.basename(root) || 'lawful'}-status.html`);
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
      '樹從左上往下長,每深一層往右縮排一格:願景 → 需求 → 里程碑 → 便利貼;便利貼是 pipeline,虛線箭頭是引用,預設只畫選取那一份的',
      '「相依」頁籤把需求排成先後:左邊先做、右邊後做,邊從 pipeline 的引用推出來,紅色的邊是高優先依賴低優先',
      '「約束」頁籤把 law 全部攤開:上半是全域 Law 三類(領域不變量、層、對外 I/O),下半是每條 pipeline 自己的 Scope Law,顏色是測試結果,對外 I/O 的契約欄畫成指到那條 law 的箭頭',
    ].join('\n'),
    exitCode: data.route.allDone && data.summary.docs ? 0 : 1,
  };
}
