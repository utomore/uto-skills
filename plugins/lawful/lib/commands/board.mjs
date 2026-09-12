// 看板:同一份 status 的第二個渲染器。analyze() 算好的圖原樣吐成 JSON,再灌進 templates/status-board.html 成一個自帶資料的單檔網頁。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyze, docState, objectiveView, openLines, suggestRoutes, warnings } from './status.mjs';

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

export function statusJson(design, source, adapter, results, resultNote, building = new Set()) {
  const a = analyze(design, source, adapter, results);
  const ov = objectiveView(design, a);
  const warns = warnings(design, a, ov, source, adapter);
  const route = suggestRoutes(design, a, ov, warns.length);
  const { openable, inBuild, shared } = openLines(a, ov, building);
  const sys = design.system;
  const listed = sys ? sys.pipelines : [];
  const kindOf = (name) => {
    const l = listed.find((e) => e.fullName === name);
    return l ? l.kind : null;
  };
  const ioFaces = listed.filter((l) => l.kind === 'IO 介面').map((l) => l.fullName);
  const milestones = ov.objs.flatMap((o) => o.ms);
  const todo = [...a.info.values()].flatMap((x) => x.stages.filter((s) => s.state === '願望' || s.state === '找不到' || (s.hit && s.hit.stub)));

  const docs = [...a.info.values()].map((x) => {
    const at = ov.rank.get(x.p.fullName) || null;
    return {
      name: x.p.fullName,
      id: x.p.id,
      kind: kindOf(x.p.fullName),
      status: x.p.status || null,
      description: x.p.description || '',
      state: docState(x),
      achieved: x.achieved,
      building: building.has(x.p.fullName),
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
        wish: !!s.wish,
      })),
    };
  });

  // 看板的分法:一個目標一條帶、一條里程碑一欄;沒被綁的 pipeline 自己成帶
  const bound = new Set(ov.objs.flatMap((o) => o.ms.flatMap((m) => m.binds)));
  const lanes = ov.objs.map((o) => ({
    id: o.id,
    achieved: o.achieved,
    title: `${o.id} ${o.title}`,
    badge: `優先 ${o.priorityRaw || '沒填'}`,
    notes: [`里程碑 ${o.done}/${o.ms.length} 達成 · 完成度 ${o.pct == null ? '-' : `${o.pct}%`}`, o.criteria ? `判準:${o.criteria}` : '沒有可觀察的判準'],
    columns: o.ms.map((m) => ({ title: `${m.id} ${m.title}`, achieved: m.achieved, docs: m.binds })),
    empty: o.ms.length ? null : '沒有任何里程碑',
  }));
  const loose = docs.filter((d) => !bound.has(d.name)).map((d) => d.name);
  if (loose.length) lanes.push({ id: null, achieved: false, title: '不朝向任何目標', badge: null, notes: ['沒有被任何里程碑綁定'], columns: [{ title: 'pipeline', achieved: false, docs: loose }], empty: null });

  const summary = {
    objectives: ov.objs.length,
    objectivesAchieved: ov.objs.filter((o) => o.achieved).length,
    milestones: milestones.length,
    milestonesAchieved: milestones.filter((m) => m.achieved).length,
    ioFaces: ioFaces.length,
    ioFacesAchieved: ioFaces.filter((m) => a.info.has(m) && a.info.get(m).achieved).length,
    pipelines: listed.length || design.pipelines.length,
    pipelinesAchieved: docs.filter((d) => d.achieved).length,
    docs: a.info.size,
    docsAchieved: docs.filter((d) => d.achieved).length,
    todoSteps: todo.length,
    openGaps: a.openGaps.length,
  };

  return {
    tool: 'lawful',
    labels: { unit: 'pipeline', steps: 'Stages' },
    vision: sys && sys.visionState === 'ok' ? sys.vision : null,
    visionState: sys ? sys.visionState : null,
    tests: resultNote,
    summary,
    headline: [
      { label: '目標', value: `${summary.objectivesAchieved} / ${summary.objectives} 達成` },
      { label: '里程碑', value: `${summary.milestonesAchieved} / ${summary.milestones} 達成` },
      { label: 'IO 介面', value: `${summary.ioFacesAchieved} / ${summary.ioFaces} 達成` },
      { label: 'pipeline', value: `${summary.pipelinesAchieved} / ${summary.pipelines} 達成` },
      { label: '還沒實作的 stage', value: `${summary.todoSteps} 個` },
      { label: '還開著的 GAP', value: `${summary.openGaps} 條` },
    ],
    objectives: ov.objs.map((o) => ({
      id: o.id,
      title: o.title,
      priority: o.priority,
      priorityRaw: o.priorityRaw || null,
      criteria: o.criteria || '',
      achieved: o.achieved,
      milestonesAchieved: o.done,
      percent: o.pct,
      milestones: o.ms.map((m) => ({ id: m.id, title: m.title, achieved: m.achieved, binds: m.binds })),
    })),
    lanes,
    docs,
    edges: docs.flatMap((d) => d.refs.map((r) => ({ from: d.name, to: r }))),
    lines: {
      openable: openable.map((x) => ({ name: x.p.fullName, tag: ov.tag(x.p.fullName) })),
      building: inBuild.map((x) => ({ name: x.p.fullName, tag: ov.tag(x.p.fullName) })),
      shared: shared.map((s) => ({ a: s.a, b: s.b, files: s.modules })),
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

export function statusBoard(design, source, adapter, results, resultNote, building, root, out, open) {
  const data = statusJson(design, source, adapter, results, resultNote, building);
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
      '便利貼是 pipeline,連線是引用;願景在最上面,一層一層往下',
    ].join('\n'),
    exitCode: data.route.allDone && data.summary.docs ? 0 : 1,
  };
}
