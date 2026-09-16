// 看板:同一份 status 的第二個渲染器。analyze() 算好的圖原樣吐成 JSON,再灌進 templates/status-board.html 成一個自帶資料的單檔網頁。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyze, counts, docState, holdsWord, moduleView, objectiveView, openLines, suggestRoutes, warnings } from './status.mjs';

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'status-board.html');
const TOKEN = '__STATUS_JSON__';

function lawsOf(x) {
  return {
    total: x.laws.length,
    green: x.unknown ? null : x.laws.filter((l) => l.result === 'green').length,
    traced: x.laws.filter((l) => l.traced).length,
    items: x.laws.map((l) => ({ id: l.id, kind: l.kind || null, title: l.title || '', result: l.result })),
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
  inherits: law ? law.inherits : null,
  holds: state.holds,
  source: state.source,
  tested: !!state.tested,
});

export function statusJson(design, source, adapter, results, resultNote, building = new Set(), stale = new Set()) {
  const a = analyze(design, source, adapter, results);
  const ov = objectiveView(design, a);
  const warns = warnings(design, a, ov, source, adapter, stale);
  const route = suggestRoutes(design, a, ov, warns.length);
  const { openable, inBuild, shared } = openLines(a, ov, building, design.modules ? design.modules.entries : []);
  const cone = design.cone;
  const mv = moduleView(design, source, a);
  const n = counts(design, a, ov, mv);
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
      building: building.has(x.p.fullName),
      requirement: at && at.o.req ? at.o.req.id : null,
      objective: at ? at.o.id : null,
      priority: at ? at.o.priority : null,
      milestone: at ? at.m.id : null,
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

  // Cone.md「專案約束」那行「優先:1 = …;2 = …」拆成各級的意思,寫在目標卡上
  const tierMeaning = new Map();
  if (cone && cone.priorityNoteState === 'ok') for (const part of cone.priorityNote.split(/[;;]/)) {
    const m = /^\s*([1-4])\s*[=＝::]\s*(.+?)[。.]?\s*$/.exec(part);
    if (m) tierMeaning.set(Number(m[1]), m[2].trim());
  }
  // 看板的分法:一條需求一個區塊,區塊底下一個目標一叢,一條里程碑或一條調整一欄;
  // 沒對到需求的目標自成一個區塊;沒被綁的 pipeline 自己成一個區塊,底下直接掛欄,沒有目標那一層(bare)
  const bound = new Set(ov.objs.flatMap((o) => o.ms.flatMap((m) => m.binds)));
  const laneOf = (o) => ({
    id: o.id,
    achieved: o.achieved,
    title: `${o.id} ${o.title}`,
    notes: [
      `優先 ${o.priorityRaw || '(沒填)'}${o.priority && tierMeaning.has(o.priority) ? `:${tierMeaning.get(o.priority)}` : ''}`,
      `Law ${holdsWord(o.lawState.holds)} · ${o.lawState.source}`,
      `里程碑 ${o.done}/${o.ms.length} 達成 · 完成度 ${o.pct == null ? '-' : `${o.pct}%`}${o.rfs.length ? ` · 調整 ${o.rfDone}/${o.rfs.length} 達成` : ''}`,
    ],
    columns: [
      ...o.ms.map((m) => ({ title: `${m.id} ${m.title}${m.binds.length ? '' : '(待 claim)'}`, achieved: m.achieved, docs: m.binds })),
      ...o.rfs.map((rf) => ({ title: `${rf.id} ${rf.title}(調整,${rf.state})`, achieved: rf.achieved, docs: rf.touches })),
    ],
    empty: o.ms.length ? null : '沒有任何里程碑',
  });
  const bands = ov.reqs.map((q) => ({
    id: q.id,
    title: `${q.id} ${q.title}`,
    note: `Law ${holdsWord(q.holds)} · ${q.source} · ${q.objectives.length} 個目標,達成 ${q.objectives.filter((o) => o.achieved).length} 個 · 里程碑 ${q.ms.filter((m) => m.achieved).length}/${q.ms.length} 達成`,
    achieved: q.holds === true,
    bare: false,
    lanes: q.objectives.map(laneOf),
    columns: [],
  }));
  const orphans = ov.objs.filter((o) => !o.req);
  if (orphans.length) bands.push({ id: 'no-req', title: '沒有對到需求', note: `${orphans.length} 個目標的需求欄對不到 Cone.md 的任何 R-n`, achieved: false, bare: false, lanes: orphans.map(laneOf), columns: [] });
  const loose = docs.filter((d) => !bound.has(d.name)).map((d) => d.name);
  if (loose.length) bands.push({ id: 'loose', title: '不朝向任何目標', note: `${loose.length} 條 pipeline 沒有被任何里程碑綁定`, achieved: false, bare: true, lanes: [], columns: [{ title: 'pipeline', achieved: false, docs: loose }] });
  if (!bands.length) bands.push({ id: 'empty', title: '還沒有任何需求', note: 'lawful requirement add 訂第一條', achieved: false, bare: true, lanes: [], columns: [] });

  const summary = {
    requirements: n.requirements,
    requirementsHolding: n.requirementsHolding,
    requirementsTested: n.requirementsTested,
    requirementsInferred: n.requirementsInferred,
    objectives: n.objectives,
    objectivesAchieved: n.objectivesAchieved,
    objectiveLawsHolding: n.objectiveLawsHolding,
    milestones: n.milestones,
    milestonesAchieved: n.milestonesAchieved,
    refinements: n.refinements,
    refinementsAchieved: n.refinementsAchieved,
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
    labels: { unit: 'pipeline', steps: 'Stages' },
    vision: cone && cone.visionState === 'ok' ? cone.vision : null,
    visionFull: cone && cone.visionState === 'ok' ? cone.visionFull : null,
    visionState: cone ? cone.visionState : null,
    priorityNote: cone && cone.priorityNoteState === 'ok' ? cone.priorityNote : null,
    tests: resultNote,
    summary,
    headline: [
      { label: '需求 Law', value: `${summary.requirementsHolding} / ${summary.requirements} 成立(測試 ${summary.requirementsTested}、推得 ${summary.requirementsInferred})` },
      { label: '目標', value: `${summary.objectivesAchieved} / ${summary.objectives} 達成 · Law 成立 ${summary.objectiveLawsHolding}` },
      { label: '里程碑', value: `${summary.milestonesAchieved} / ${summary.milestones} 達成` },
      { label: '調整', value: `${summary.refinementsAchieved} / ${summary.refinements} 達成` },
      { label: 'IO 介面', value: `${summary.ioFacesAchieved} / ${summary.ioFaces} 達成` },
      { label: 'pipeline', value: `${summary.pipelinesAchieved} / ${summary.pipelines} 達成` },
      { label: '模組單元', value: `${summary.moduleUnits} 個${summary.moduleUnitsIdle ? ` · ${summary.moduleUnitsIdle} 個還沒有 stage` : ''}` },
      { label: '還沒實作的 stage', value: `${summary.todoSteps} 個` },
      { label: '還開著的 GAP', value: `${summary.openGaps} 條` },
    ],
    requirements: ov.reqs.map((q) => ({
      id: q.id,
      title: q.title,
      law: lawJson(q.law, q),
      implication: q.implication || '',
      objectives: q.objectives.map((o) => o.id),
      built: q.built,
      milestonesAchieved: q.ms.filter((m) => m.achieved).length,
      milestones: q.ms.length,
      refinementsAchieved: q.rfs.filter((rf) => rf.achieved).length,
      refinements: q.rfs.length,
    })),
    objectives: ov.objs.map((o) => ({
      id: o.id,
      name: o.fullName,
      file: o.file,
      title: o.title,
      requirement: o.requirement || null,
      priority: o.priority,
      priorityRaw: o.priorityRaw || null,
      law: lawJson(o.law, o.lawState),
      achieved: o.achieved,
      milestonesAchieved: o.done,
      percent: o.pct,
      milestones: o.ms.map((m) => ({ id: m.id, title: m.title, achieved: m.achieved, binds: m.binds })),
      refinements: o.rfs.map((rf) => ({ id: rf.id, title: rf.title, touches: rf.touches, state: rf.state, achieved: rf.achieved })),
    })),
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
      '樹從左上往下長,每深一層往右縮排一格:願景 → 需求 → 目標 → 里程碑與調整 → 便利貼;便利貼是 pipeline,虛線箭頭是引用,預設只畫選取那一份的',
      '「相依」頁籤把目標(或需求)排成先後:左邊先做、右邊後做,邊從 pipeline 的引用推出來,紅色的邊是高優先依賴低優先',
    ].join('\n'),
    exitCode: data.route.allDone && data.summary.docs ? 0 : 1,
  };
}
