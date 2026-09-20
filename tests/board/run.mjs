// 看板的頁面在真的 Chrome 裡跑一遍:產出看板 → headless 開起來 → 送真的滑鼠事件 → 讀回頁面狀態。
// 兩個 plugin 共用同一份 status-board.html,所以兩邊各拿一個夾具跑,證明它在兩邊的資料上都成立。
// 靠 Node 內建的 WebSocket 直接講 CDP,不裝任何套件;要用哪個 Chrome 可以用 CHROME_PATH 指定。
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..', '..');

const BOARDS = [
  { name: 'lawful', bin: ['plugins', 'lawful', 'bin', 'lawful.mjs'], root: ['tests', 'lawful', 'fixtures', 'refs'],
    expect: { nodes: ['R-1', 'R-2'], edges: ['R-2>R-1'] } },   // R-1 的 P-001-cli-run 見 R-2 的 P-002-syntax-parse:R-2 在左,R-1 在右(高優先依賴低優先,邊是紅的)
  { name: 'dev-flow', bin: ['plugins', 'dev-flow', 'bin', 'devflow.mjs'], root: ['tests', 'dev-flow', 'fixtures', 'fullstack'],
    expect: { nodes: ['R-1', 'R-2', 'R-3'], edges: ['R-1>R-3'] } },   // R-3 的 F-002-refund 見 R-1 的 F-001-checkout:R-1 在左,R-3 在右;R-2 誰也不靠
  // 對外 I/O 表的契約欄有寫 law 的夾具:約束頁籤的弧線在這兩棵樹上才畫得出來
  { name: 'dev-flow(shop)', bin: ['plugins', 'dev-flow', 'bin', 'devflow.mjs'], root: ['tests', 'dev-flow', 'fixtures', 'shop'], cites: true },
  { name: 'lawful(save-game)', bin: ['plugins', 'lawful', 'bin', 'lawful.mjs'], root: ['tests', 'lawful', 'fixtures', 'save-game'], cites: true },
];

let failed = 0;
function check(label, ok, detail) {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.log(`✗ ${label}${detail == null ? '' : `\n  ${detail}`}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const named = process.env.CHROME_PATH;
  if (named) return fs.existsSync(named) ? named : null;
  const home = os.homedir();
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function get(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => {
      let s = '';
      r.on('data', (c) => { s += c; });
      r.on('end', () => res(s));
    }).on('error', rej);
  });
}

async function waitFor(what, fn, ms = 15000) {
  const until = Date.now() + ms;
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch { /* 還沒好,再等 */ }
    if (Date.now() > until) throw new Error(`等不到${what}`);
    await sleep(60);
  }
}

function connect(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let id = 0;
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      const p = m.id && pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.error) p.rej(new Error(`${m.error.message}`));
      else p.res(m.result);
    });
    ws.addEventListener('error', () => rej(new Error('CDP 連不上')));
    ws.addEventListener('open', () => res({
      send(method, params = {}, sessionId) {
        return new Promise((r, j) => {
          const i = ++id;
          pending.set(i, { res: r, rej: j });
          ws.send(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params }));
        });
      },
      close: () => ws.close(),
    }));
  });
}

async function launch(chrome) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'board-chrome-'));
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-sync',
    '--window-size=1400,900', '--force-device-scale-factor=1',
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank',
  ], { stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  const port = await waitFor('Chrome 起來', () => {
    const line = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    return line ? Number(line) : null;
  });
  const version = JSON.parse(await get(`http://127.0.0.1:${port}/json/version`));
  const browser = await connect(version.webSocketDebuggerUrl);
  return {
    browser,
    stop() {
      try { browser.close(); } catch { /* 已經斷了 */ }
      proc.kill();
      try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch { /* profile 留著也無所謂 */ }
    },
  };
}

// 一個分頁,連著一份看板
async function openPage(browser, fileUrl) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => browser.send(m, p, sessionId);
  await S('Page.enable');
  await S('Runtime.enable');
  await S('Page.navigate', { url: fileUrl });

  const evaluate = async (expression) => {
    const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await waitFor('看板畫完', () => evaluate('document.querySelectorAll(".note").length > 0 && typeof selected !== "undefined"'));

  const mouse = (type, x, y) => S('Input.dispatchMouseEvent', {
    type, x, y, button: 'left',
    buttons: type === 'mouseReleased' ? 0 : 1,
    clickCount: type === 'mouseMoved' ? 0 : 1,
  });

  return {
    evaluate,
    async click(x, y) {
      await mouse('mousePressed', x, y);
      await mouse('mouseReleased', x, y);
      await sleep(40);
    },
    // 回傳拖曳當中的 will-change:手在動的時候要交給合成器
    async drag(x, y, dx, dy) {
      await mouse('mousePressed', x, y);
      for (let i = 1; i <= 4; i += 1) await mouse('mouseMoved', x + (dx * i) / 4, y + (dy * i) / 4);
      const midway = await evaluate('getComputedStyle(world).willChange');
      await mouse('mouseReleased', x + dx, y + dy);
      await sleep(40);
      return midway;
    },
    close: () => browser.send('Target.closeTarget', { targetId }),
  };
}

// 拿一張有引用出去的便利貼;沒有的話拿第一張。樹往下長,那一張不在畫面裡就先縮成全景,滑鼠才點得到
const PICK = `(() => {
  const want = D.docs.find((d) => d.refs.length && noteEls.has(d.name)) || D.docs.find((d) => noteEls.has(d.name));
  const el = noteEls.get(want.name);
  const seen = (b) => b.x >= 0 && b.y >= 0 && b.x + b.width <= innerWidth && b.y + b.height <= innerHeight;
  if (!seen(el.getBoundingClientRect())) fit();
  const r = el.getBoundingClientRect();
  return { name: want.name, refs: want.refs.length, x: r.x + r.width / 2, y: r.y + r.height / 2 };
})()`;

const STATE = `(() => ({
  selected,
  docOpen: !docEl.hidden,
  homeOpen: !homeEl.hidden,
  litRefs: document.querySelectorAll('#links .ref.lit').length,
  litAncestors: document.querySelectorAll('.card.path').length,
  tx: Math.round(tx),
}))()`;

// 模組段:有 D.modules 的工具才出現,一個模組單元一列,列裡的 pipeline 連結點得進去
const MODULES = `(() => {
  const sec = document.getElementById('modules-section');
  const rows = [...document.querySelectorAll('#modules .unit')];
  const link = document.querySelector('#modules .unit a[data-go]');
  // 側欄比視窗長的時候模組段在畫面外:先捲到看得到,量到的座標才點得到它
  if (link) link.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = link && link.getBoundingClientRect();
  return {
    has: !!(D.modules && D.modules.units.length),
    shown: !!sec && !sec.hidden,
    rows: rows.length,
    units: D.modules ? D.modules.units.length : 0,
    layerChips: document.querySelectorAll('#modules .layer').length,
    go: link ? { name: link.dataset.go, x: r.x + r.width / 2, y: r.y + r.height / 2 } : null,
  };
})()`;

// 相依頁籤的狀態:兩頁哪一頁在畫面上、卡與邊的數目、有沒有方向反了或接到沒畫的卡的邊
const DAG = `(() => {
  const vis = (el) => !el.hidden && getComputedStyle(el).display !== 'none';
  const left = (id) => { const el = dagNodeEls.get(id); return el ? parseFloat(el.style.left) : null; };
  let backwards = 0, dangling = 0;
  for (const e of dagGraph.edges) {
    const a = left(e.to), b = left(e.from);
    if (a == null || b == null) dangling++;
    else if (!e.cycle && !(a < b)) backwards++;
  }
  const kinds = [...dagGraph.nodes.values()].map((n) => n.kind);
  const shared = kinds.filter((k) => k === 'shared').length;
  // 底下有里程碑、卻不是任何一條需求的區塊(里程碑對不到需求)也自成一張卡
  const stray = D.bands.filter((b) => !['loose', 'shared', 'empty'].includes(b.id) && !D.requirements.some((q) => q.id === b.id)).length;
  const first = [...dagNodeEls.entries()].map(([id, el]) => ({ id, el, degree: dagGraph.nodes.get(id).deps.length + dagGraph.nodes.get(id).dependents.length }))
    .sort((p, q) => q.degree - p.degree)[0];
  const r = first && first.el.getBoundingClientRect();
  return {
    on: document.body.classList.contains('view-dag'),
    treeShown: vis(world), dagShown: vis(world2),
    filterShown: vis(document.querySelector('.bar button[data-filter]')),
    nodes: dagNodeEls.size, edges: dagGraph.edges.length, backwards, dangling, shared,
    requirements: D.requirements.length, stray,
    expectNodes: D.requirements.length + stray + shared,
    requirementCards: kinds.filter((k) => k === 'requirement').length,
    grainControl: !!document.getElementById('grain'),
    first: first ? { id: first.id, degree: first.degree, x: r.x + r.width / 2, y: r.y + r.height / 2 } : null,
  };
})()`;

// 約束頁籤的狀態:三頁哪一頁在畫面上、每一種卡的數目對不對得上資料、契約欄的弧線有沒有接到沒畫的卡。
// 順手挑一張卡給滑鼠點(有弧線的優先)並把畫面挪到它那裡
const LAWS = `(() => {
  const vis = (el) => !el.hidden && getComputedStyle(el).display !== 'none';
  const G = D.globalLaws;
  const types = { inv: 0, layer: 0, io: 0, law: 0 };
  for (const c of lawInfo.values()) types[c.type]++;
  const expectTypes = { inv: D.invariants.length, layer: G.layers.length, io: G.io.length, law: D.docs.reduce((s, d) => s + d.laws.total, 0) };
  const wanted = G.io.reduce((s, r) => s + r.contract.filter((c) => lawInfo.has(c)).length, 0);
  const dangling = lawCites.filter((c) => !lawEls.has(c.from) || !lawEls.has(c.to)).length;
  const key = (lawCites[0] && lawCites[0].from) || [...lawEls.keys()][0] || null;
  let pick = null;
  if (key) {
    const b = lawBox.get(lawEls.get(key));
    zoomTo({ x1: b.x - 200, y1: b.y - 200, x2: b.x + b.w + 200, y2: b.y + b.h + 200 });
    const r = lawEls.get(key).getBoundingClientRect();
    pick = { key, degree: lawCites.filter((c) => c.from === key || c.to === key).length, x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }
  return {
    on: document.body.classList.contains('view-laws'),
    treeShown: vis(world), dagShown: vis(world2), lawsShown: vis(world3),
    filterShown: vis(document.querySelector('.bar button[data-filter]')),
    cards: lawEls.size, types, expectTypes,
    groups: document.querySelectorAll('.lgroup').length, expectGroups: 3 + D.docs.length,
    arcs: document.querySelectorAll('#links3 .cite').length, wanted, dangling,
    legend: document.getElementById('legend').textContent,
    pick,
  };
})()`;

async function run(page, label, expect, cites) {
  const pick = await page.evaluate(PICK);

  // 點便利貼:側欄換成那一份、頭上那一串亮起來、它的引用線亮起來
  await page.click(pick.x, pick.y);
  const picked = await page.evaluate(STATE);
  check(`${label}:點便利貼會選到它`, picked.selected === pick.name,
    `selected 是 ${JSON.stringify(picked.selected)},應該是 ${JSON.stringify(pick.name)}`);
  check(`${label}:點便利貼側欄換成那一份的細節`, picked.docOpen && !picked.homeOpen);
  check(`${label}:選取的便利貼頭上那一串會亮`, picked.litAncestors > 0,
    `亮起來的祖先卡片 ${picked.litAncestors} 張`);
  check(`${label}:選取的便利貼引用線會亮`, picked.litRefs === pick.refs,
    `亮起來的引用線 ${picked.litRefs} 條,這一份引用了 ${pick.refs} 份`);

  // 再點一次同一張:取消選取,側欄回派工
  await page.click(pick.x, pick.y);
  const again = await page.evaluate(STATE);
  check(`${label}:再點一次同一張會取消選取`, again.selected === null && again.homeOpen);

  // 從便利貼上拖曳:平移畫布,不算點到
  const before = await page.evaluate('Math.round(tx)');
  const midway = await page.drag(pick.x, pick.y, 140, 90);
  const dragged = await page.evaluate(STATE);
  check(`${label}:從便利貼上拖曳是平移,不是點選`, dragged.selected === null && dragged.tx !== before,
    `selected ${JSON.stringify(dragged.selected)},tx ${before} → ${dragged.tx}`);
  check(`${label}:手在動的時候畫布交給合成器`, midway === 'transform', `拖曳當中的 will-change 是 ${midway}`);
  await sleep(300);
  const atRest = await page.evaluate('getComputedStyle(world).willChange');
  check(`${label}:手一停就交還,字才會重畫成清的`, atRest === 'auto', `靜止時的 will-change 是 ${atRest}`);

  // 模組段:一個模組單元一列,層是它在原始碼樹裡的落點;沒有模組資料的工具整段不出現
  // 拖曳之後的第一下點擊被頁面當成拖曳的尾巴吃掉:先點掉它。畫布挪過了,那一點底下是哪張便利貼看夾具的版面,所以不靠再點一次取消,直接回派工那一頁,模組段才在畫面上
  await page.click(pick.x, pick.y);
  await page.evaluate('select(null)');
  const mods = await page.evaluate(MODULES);
  check(`${label}:模組段跟著資料出現或收起`, mods.shown === mods.has,
    `有模組資料 ${mods.has},段落顯示 ${mods.shown}`);
  if (mods.has) {
    check(`${label}:一個模組單元一列`, mods.rows === mods.units, `畫了 ${mods.rows} 列,資料有 ${mods.units} 個單元`);
    check(`${label}:每列標出它有哪幾層`, mods.layerChips > 0, `層的標籤 ${mods.layerChips} 個`);
    if (mods.go) {
      await page.click(mods.go.x, mods.go.y);
      const after = await page.evaluate(STATE);
      check(`${label}:點模組段裡的 pipeline 會選到它`, after.selected === mods.go.name && after.docOpen,
        `selected 是 ${JSON.stringify(after.selected)},應該是 ${JSON.stringify(mods.go.name)}`);
      await page.evaluate('select(null)');
    }
  }

  // 樹只有四層:願景 → 需求的區塊 → 里程碑 → 便利貼;一個區塊一張卡、一欄一張卡,優先與里程碑完成度寫在需求的區塊上
  const shape = await page.evaluate(`(() => {
    const bad = [];
    const bands = [...document.querySelectorAll('.band')];
    const groups = [...document.querySelectorAll('.group')];
    const columns = D.bands.reduce((s, b) => s + b.columns.length, 0);
    if (bands.length !== D.bands.length) bad.push('區塊畫了 ' + bands.length + ' 張,資料有 ' + D.bands.length + ' 個');
    if (groups.length !== columns) bad.push('里程碑畫了 ' + groups.length + ' 張,資料有 ' + columns + ' 欄');
    const kinds = new Set([...document.querySelectorAll('#world .card')].map((el) => el.dataset.kind));
    for (const k of kinds) if (!['vision', 'band', 'group', 'note'].includes(k)) bad.push('多了一層 ' + k);
    D.bands.forEach((b, bi) => {
      const text = bands[bi] ? bands[bi].textContent : '';
      for (const n of [b.note, ...b.notes, b.empty].filter(Boolean)) if (!text.includes(n)) bad.push(b.id + ' 的區塊上少了「' + n + '」');
    });
    return bad;
  })()`);
  check(`${label}:樹是願景、需求的區塊、里程碑、便利貼四層`, shape.length === 0, shape.join(' · '));

  // 靠修訂既有的文檔達成、還沒有 REV 引用它的里程碑:它那一欄的卡片標題帶「(待修訂)」;資料裡沒有 refinements
  const pending = await page.evaluate(`(() => {
    const groups = [...document.querySelectorAll('.group')].map((g) => g.textContent);
    const waiting = D.requirements.flatMap((q) => q.milestones.filter((m) => m.state === '待修訂'));
    return { waiting: waiting.map((m) => m.name), unmarked: waiting.filter((m) => !groups.some((t) => t.includes(m.name + ' ' + m.title + '(待修訂)'))).map((m) => m.name),
      stateless: D.requirements.flatMap((q) => q.milestones.filter((m) => !['達成', '待修訂', '進行中'].includes(m.state) || typeof m.byRevision !== 'boolean')).map((m) => m.name),
      refinements: D.requirements.some((q) => 'refinements' in q) || 'refinements' in D.summary };
  })()`);
  check(`${label}:待修訂的里程碑在它那一欄的卡片上標出來`, pending.unmarked.length === 0, `沒標的 ${pending.unmarked.join('、')}`);
  check(`${label}:每條里程碑帶狀態字與是不是靠修訂達成,資料裡只有里程碑`, pending.stateless.length === 0 && !pending.refinements, JSON.stringify(pending));

  // 版面:每張卡片都比它自己的父卡片更右(里程碑直接掛在需求的區塊底下)
  const askew = await page.evaluate(`(() => {
    const at = (el) => parseFloat(el.style.left);
    const one = (sel) => document.querySelector(sel);
    const bad = [];
    const vision = one('.vision');
    for (const b of document.querySelectorAll('.band')) {
      if (vision && !(at(b) > at(vision))) bad.push('需求的區塊沒有比願景右');
    }
    for (const g of document.querySelectorAll('.group')) {
      const parent = one('.band[data-band="' + g.dataset.band + '"]');
      if (!(at(g) > at(parent))) bad.push('里程碑 ' + g.dataset.col + ' 沒有比它的需求區塊右');
    }
    const notes = [...document.querySelectorAll('.note')].map(at);
    const groups = [...document.querySelectorAll('.group')].map(at);
    if (notes.length && groups.length && !(Math.min(...notes) > Math.max(...groups))) bad.push('便利貼沒有掛在里程碑右邊');
    return bad;
  })()`);
  check(`${label}:每張卡片都比它的父卡片更右`, askew.length === 0, askew.join(' · '));

  // 骨架線一條最長只走一格縮排:沒有橫貫整張圖的橫幹
  const widest = await page.evaluate(`(() => {
    let worst = 0;
    for (const p of document.querySelectorAll('#links .tree')) {
      const m = /^M (-?[\\d.]+) (-?[\\d.]+) H (-?[\\d.]+)$/.exec(p.getAttribute('d'));
      if (m) worst = Math.max(worst, Math.abs(Number(m[3]) - Number(m[1])));
    }
    return Math.round(worst);
  })()`);
  check(`${label}:骨架線沒有橫貫整張圖的橫幹`, widest <= 40, `最長的一條橫線 ${widest}px`);

  // 相依頁籤:需求排成先後,每條邊的依賴在左、依賴它的在右;點卡片側欄換成它依賴誰、誰等它
  const tab = await page.evaluate(`(() => { const r = document.querySelector('.bar button[data-view="dag"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await page.click(tab.x, tab.y);
  const dag = await page.evaluate(DAG);
  check(`${label}:切到相依頁籤只看得到相依圖`, dag.on && !dag.treeShown && dag.dagShown, JSON.stringify(dag));
  check(`${label}:每條需求一張卡,共用的那份自成一張`, dag.nodes === dag.expectNodes && dag.requirementCards === dag.requirements,
    `畫了 ${dag.nodes} 張(需求卡 ${dag.requirementCards} 張),需求 ${dag.requirements} 條加對不到需求的區塊 ${dag.stray} 個加共用 ${dag.shared} 份`);
  check(`${label}:相依頁籤只有需求一種粒度,沒有切換的控制項`, !dag.grainControl);
  check(`${label}:邊的兩端都是畫出來的卡`, dag.dangling === 0, `${dag.dangling} 條邊接到沒畫的卡`);
  check(`${label}:依賴在左、依賴它的在右`, dag.backwards === 0, `${dag.backwards} 條邊的方向反了`);
  check(`${label}:樹那一頁的篩選在相依頁收起來`, !dag.filterShown);
  if (expect) {
    const nodes = await page.evaluate('[...dagNodeEls.keys()].sort()');
    const edges = await page.evaluate("dagGraph.edges.map((e) => e.to + '>' + e.from).sort()");
    check(`${label}:相依圖的卡對得上夾具`, JSON.stringify(nodes) === JSON.stringify([...expect.nodes].sort()), `${nodes.join('、')} ≠ ${expect.nodes.join('、')}`);
    check(`${label}:相依圖的邊對得上夾具`, JSON.stringify(edges) === JSON.stringify([...expect.edges].sort()), `${edges.join('、')} ≠ ${expect.edges.join('、')}`);
  }
  if (dag.first) {
    await page.click(dag.first.x, dag.first.y);
    const sel = await page.evaluate(`(() => {
      const q = D.requirements.find((r) => r.id === dagSelected);
      const text = docEl.textContent;
      return { dagSelected, docOpen: !docEl.hidden, lit: document.querySelectorAll('#links2 .dep.lit').length, rows: docEl.querySelectorAll('section').length,
        missing: q ? q.milestones.filter((m) => !text.includes(m.name + ' ' + m.title + (m.state === '待修訂' ? '(待修訂)' : ''))).map((m) => m.name) : [] };
    })()`);
    check(`${label}:點相依圖的卡會選到它`, sel.dagSelected === dag.first.id && sel.docOpen, JSON.stringify(sel));
    check(`${label}:選了卡它的邊會亮`, sel.lit === dag.first.degree, `亮了 ${sel.lit} 條,這張卡有 ${dag.first.degree} 條邊`);
    check(`${label}:需求卡的側欄列出它的每一條里程碑`, sel.missing.length === 0, `少了 ${sel.missing.join('、')}`);
    await page.click(dag.first.x, dag.first.y);
    const un = await page.evaluate('({ dagSelected, homeOpen: !homeEl.hidden })');
    check(`${label}:再點一次會取消選取`, un.dagSelected === null && un.homeOpen);
  }
  // 切回樹:便利貼回來,相依圖收起來
  const treeTab = await page.evaluate(`(() => { const r = document.querySelector('.bar button[data-view="tree"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await page.click(treeTab.x, treeTab.y);
  const back = await page.evaluate(DAG);
  check(`${label}:切回樹那一頁便利貼回來`, !back.on && back.treeShown && !back.dagShown && back.filterShown, JSON.stringify(back));

  // 約束頁籤:law 全部攤開,一條一張卡。上半全域 Law 三類各一叢,下半一份一叢;對外 I/O 的契約欄畫成指到那條 law 的弧線
  const tabAt = (view) => page.evaluate(`(() => { const r = document.querySelector('.bar button[data-view="${view}"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  const lawsTab = await tabAt('laws');
  await page.click(lawsTab.x, lawsTab.y);
  const laws = await page.evaluate(LAWS);
  check(`${label}:切到約束頁籤只看得到約束圖`, laws.on && !laws.treeShown && !laws.dagShown && laws.lawsShown, JSON.stringify(laws));
  check(`${label}:領域不變量、層、對外 I/O 的每一列與每條 scope law 各一張卡`, JSON.stringify(laws.types) === JSON.stringify(laws.expectTypes),
    `畫了 ${JSON.stringify(laws.types)},資料是 ${JSON.stringify(laws.expectTypes)}`);
  check(`${label}:全域 Law 三類各一叢,Scope Law 一份一叢`, laws.groups === laws.expectGroups, `畫了 ${laws.groups} 叢,應該 ${laws.expectGroups} 叢`);
  check(`${label}:契約欄寫到的 law 各一條弧線,兩端都是畫出來的卡`, laws.arcs === laws.wanted && laws.dangling === 0,
    `弧線 ${laws.arcs} 條,契約欄指得到的 law ${laws.wanted} 條,${laws.dangling} 條接到沒畫的卡`);
  if (cites) check(`${label}:這棵樹的契約欄有寫 law,弧線畫得出來`, laws.arcs > 0, `弧線 ${laws.arcs} 條`);
  check(`${label}:約束頁的圖例講的是測試結果`, laws.legend.includes('成立') && laws.legend.includes('契約') && !laws.legend.includes('draft'), laws.legend);
  check(`${label}:樹那一頁的篩選在約束頁收起來`, !laws.filterShown);
  if (laws.pick) {
    await page.click(laws.pick.x, laws.pick.y);
    const sel = await page.evaluate(`({ lawSelected, docOpen: !docEl.hidden, lit: document.querySelectorAll('#links3 .cite.lit').length, related: document.querySelectorAll('#world3 .lcard.rel').length })`);
    check(`${label}:點約束頁的卡會選到它`, sel.lawSelected === laws.pick.key && sel.docOpen, JSON.stringify(sel));
    check(`${label}:選了卡它的契約弧線會亮`, sel.lit === laws.pick.degree && sel.related === laws.pick.degree,
      `亮了 ${sel.lit} 條、另一端亮了 ${sel.related} 張,這張卡有 ${laws.pick.degree} 條`);
    await page.click(laws.pick.x, laws.pick.y);
    const un = await page.evaluate('({ lawSelected, homeOpen: !homeEl.hidden })');
    check(`${label}:約束頁再點一次會取消選取`, un.lawSelected === null && un.homeOpen);
  }

  // 從樹那一頁的細節面板點一條 law:跳到約束頁並選到它
  const treeTab2 = await tabAt('tree');
  await page.click(treeTab2.x, treeTab2.y);
  const link = await page.evaluate(`(() => {
    const d = D.docs.find((x) => x.laws.total && noteEls.has(x.name));
    if (!d) return null;
    select(d.name);
    const a = docEl.querySelector('[data-law]');
    if (!a) return { key: null };
    a.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = a.getBoundingClientRect();
    return { key: a.dataset.law, x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (link) {
    check(`${label}:便利貼細節裡的 law 是連結`, !!link.key);
    if (link.key) {
      await page.click(link.x, link.y);
      const hop = await page.evaluate(`({ on: document.body.classList.contains('view-laws'), lawSelected, docOpen: !docEl.hidden })`);
      check(`${label}:點細節裡的 law 會跳到約束頁並選到它`, hop.on && hop.lawSelected === link.key && hop.docOpen, JSON.stringify(hop));
    }
  }
  const treeTab3 = await tabAt('tree');
  await page.click(treeTab3.x, treeTab3.y);
  const home = await page.evaluate(DAG);
  check(`${label}:從約束頁切回樹那一頁便利貼回來`, !home.on && home.treeShown && !home.dagShown && home.filterShown, JSON.stringify(home));
}

const chrome = findChrome();
if (!chrome) {
  console.log('✗ 找不到 Chrome');
  console.log('  用 CHROME_PATH 指到 chrome 的執行檔再跑一次');
  process.exitCode = 1;
} else {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'board-html-'));
  const { browser, stop } = await launch(chrome);
  try {
    for (const b of BOARDS) {
      const out = path.join(tmp, `${b.name}.html`);
      const made = spawnSync(process.execPath, [
        path.join(repo, ...b.bin), 'status', '--html', out, '--root', path.join(repo, ...b.root),
      ], { encoding: 'utf8' });
      if (!fs.existsSync(out)) {
        check(`${b.name}:產得出看板`, false, made.stderr.trim() || made.stdout.trim());
        continue;
      }
      const page = await openPage(browser, pathToFileURL(out).href);
      try {
        await run(page, b.name, b.expect, b.cites);
      } finally {
        await page.close();
      }
    }
  } finally {
    stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} 個不符` : '\n全部通過');
  process.exitCode = failed ? 1 : 0;
}
