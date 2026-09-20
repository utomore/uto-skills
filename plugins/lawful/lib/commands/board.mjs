// 看板:同一份 status 的第二個渲染器。analyze() 算好的圖原樣吐成 JSON,再灌進 templates/status-board.html 成一個自帶資料的單檔網頁。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyze, buildKeyOf, counts, docState, invariantView, metWord, moduleView, objectiveView, openLines, sliceLines, suggestRoutes, warnings } from './status.mjs';

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
  holds: state.holds,
  source: state.source,
  tested: !!state.tested,
});

export function statusJson(design, source, adapter, results, resultNote, building = new Set(), stale = new Set()) {
  const a = analyze(design, source, adapter, results);
  const ov = objectiveView(design, a);
  const inv = invariantView(design, a);
  const warns = warnings(design, a, ov, source, adapter, stale, inv);
  const route = suggestRoutes(design, a, ov, warns.length, building, inv);
  const slices = sliceLines(ov, building);
  const { openable, inBuild, shared } = openLines(a, ov, building, design.modules ? design.modules.entries : []);
  const cone = design.cone;
  const mv = moduleView(design, source, a);
  const n = counts(design, a, ov, mv, inv);
  const unitNameOf = (module) => {
    const u = mv.units.find((e) => module === e.unit || module.startsWith(`${e.unit}.`));
    return u ? u.unit : null;
  };

  // 看板畫的是需求 → 里程碑兩層:一條需求的里程碑與調整 = 它底下各目標的依(目標優先、目標順序)串接,
  // 需求的優先 = 它的目標裡最高的那一級
  const reqView = new Map(ov.reqs.map((q) => {
    const priority = q.key >= 1 && q.key <= 4 ? q.key : null;
    const top = q.objectives.find((o) => o.priority === priority) || q.objectives[0] || null;
    const done = q.ms.filter((m) => m.achieved).length;
    return [q.id, {
      priority,
      priorityRaw: top ? top.priorityRaw || null : null,
      done,
      rfDone: q.rfs.filter((rf) => rf.achieved).length,
      pct: q.ms.length ? Math.round((done / q.ms.length) * 100) : null,
    }];
  }));

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
      requirement: at && at.o.req ? at.o.req.id : null,
      priority: at && at.o.req ? reqView.get(at.o.req.id).priority : null,
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

  // Cone.md「專案約束」那行「優先:1 = …;2 = …」拆成各級的意思,寫在需求的區塊上
  const tierMeaning = new Map();
  if (cone && cone.priorityNoteState === 'ok') for (const part of cone.priorityNote.split(/[;;]/)) {
    const m = /^\s*([1-4])\s*[=＝::]\s*(.+?)[。.]?\s*$/.exec(part);
    if (m) tierMeaning.set(Number(m[1]), m[2].trim());
  }
  // 看板的分法:一條需求一個區塊,區塊底下一條里程碑或一條調整一欄;
  // 對不到需求的里程碑自成一個區塊;沒被綁的 pipeline 自己成一個區塊
  const bound = new Set(ov.objs.flatMap((o) => o.ms.flatMap((m) => m.binds)));
  const columnsOf = (ms, rfs) => [
    ...ms.map((m) => ({ title: `${m.id} ${m.title}${m.binds.length ? '' : '(還沒有切片)'}`, achieved: m.achieved, docs: m.binds })),
    ...rfs.map((rf) => ({ title: `${rf.id} ${rf.title}(調整,${rf.state})`, achieved: rf.achieved, docs: rf.touches })),
  ];
  const bands = ov.reqs.map((q) => {
    const v = reqView.get(q.id);
    return {
      id: q.id,
      title: `${q.id} ${q.title}`,
      note: `驗收${metWord(q.holds)} · ${q.source}`,
      notes: [
        `優先 ${v.priorityRaw || '(沒填)'}${v.priority && tierMeaning.has(v.priority) ? `:${tierMeaning.get(v.priority)}` : ''}`,
        `里程碑 ${v.done}/${q.ms.length} 達成 · 完成度 ${v.pct == null ? '-' : `${v.pct}%`}${q.rfs.length ? ` · 調整 ${v.rfDone}/${q.rfs.length} 達成` : ''}`,
      ],
      achieved: q.holds === true,
      columns: columnsOf(q.ms, q.rfs),
      empty: q.ms.length ? null : '沒有任何里程碑',
    };
  });
  const orphans = ov.objs.filter((o) => !o.req);
  if (orphans.length) {
    const ms = orphans.flatMap((o) => o.ms);
    bands.push({ id: 'no-req', title: '沒有對到需求', note: `${orphans.length} 個目標的需求欄對不到 Cone.md 的任何 R-n`, notes: [], achieved: false, columns: columnsOf(ms, orphans.flatMap((o) => o.rfs)), empty: ms.length ? null : '沒有任何里程碑' });
  }
  const loose = docs.filter((d) => !bound.has(d.name)).map((d) => d.name);
  if (loose.length) bands.push({ id: 'loose', title: '不朝向任何需求', note: `${loose.length} 條 pipeline 沒有被任何里程碑綁定`, notes: [], achieved: false, columns: [{ title: 'pipeline', achieved: false, docs: loose }], empty: null });
  if (!bands.length) bands.push({ id: 'empty', title: '還沒有任何需求', note: 'lawful requirement add 訂第一條', notes: [], achieved: false, columns: [], empty: null });

  const summary = {
    requirements: n.requirements,
    requirementsHolding: n.requirementsHolding,
    requirementsTested: n.requirementsTested,
    requirementsInferred: n.requirementsInferred,
    invariants: n.invariants,
    invariantsHolding: n.invariantsHolding,
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
      { label: '需求', value: `${summary.requirementsHolding} / ${summary.requirements} 達成(測試 ${summary.requirementsTested}、推得 ${summary.requirementsInferred})` },
      { label: '領域不變量', value: `${summary.invariantsHolding} / ${summary.invariants} 成立` },
      { label: '里程碑', value: `${summary.milestonesAchieved} / ${summary.milestones} 達成` },
      { label: '調整', value: `${summary.refinementsAchieved} / ${summary.refinements} 達成` },
      { label: 'IO 介面', value: `${summary.ioFacesAchieved} / ${summary.ioFaces} 達成` },
      { label: 'pipeline', value: `${summary.pipelinesAchieved} / ${summary.pipelines} 達成` },
      { label: '模組單元', value: `${summary.moduleUnits} 個${summary.moduleUnitsIdle ? ` · ${summary.moduleUnitsIdle} 個還沒有 stage` : ''}` },
      { label: '還沒實作的 stage', value: `${summary.todoSteps} 個` },
      { label: '還開著的 GAP', value: `${summary.openGaps} 條` },
    ],
    requirements: ov.reqs.map((q) => {
      const v = reqView.get(q.id);
      return {
        id: q.id,
        name: q.id,
        file: cone.file,
        title: q.title,
        priority: v.priority,
        priorityRaw: v.priorityRaw,
        law: lawJson(q.accept, q),
        note: `驗收${metWord(q.holds)} · 里程碑 ${v.done}/${q.ms.length} 達成`,
        built: q.built,
        achieved: q.holds === true,
        percent: v.pct,
        milestonesAchieved: v.done,
        refinementsAchieved: v.rfDone,
        milestones: q.ms.map((m) => ({ id: m.id, name: m.fullName, title: m.title, achieved: m.achieved, binds: m.binds })),
        refinements: q.rfs.map((rf) => ({ id: rf.id, title: rf.title, touches: rf.touches, state: rf.state, achieved: rf.achieved })),
      };
    }),
    invariants: inv.map((v) => ({ id: v.id, kind: v.kind || null, title: v.title, formal: !!v.law.formal, holds: v.holds, source: v.source, tested: v.tested })),
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
      slices: slices.openable.map((s) => ({ name: s.m.fullName, requirement: s.o.req ? s.o.req.id : null, title: s.m.title })),
      slicesBuilding: slices.inBuild.map((s) => ({ name: s.m.fullName, requirement: s.o.req ? s.o.req.id : null, title: s.m.title })),
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
      '樹從左上往下長,每深一層往右縮排一格:願景 → 需求 → 里程碑與調整 → 便利貼;便利貼是 pipeline,虛線箭頭是引用,預設只畫選取那一份的',
      '「相依」頁籤把需求排成先後:左邊先做、右邊後做,邊從 pipeline 的引用推出來,紅色的邊是高優先依賴低優先',
    ].join('\n'),
    exitCode: data.route.allDone && data.summary.docs ? 0 : 1,
  };
}
