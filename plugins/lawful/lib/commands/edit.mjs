// 會寫檔的子命令:module、claim、rename、requirement add、objective add / milestone / refinement、sync、modules --gen、spike close。
// 目標一個檔一個,住 objectives/R-x-O-y-<slug>.md。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KINDS, LAYERS, layerRoot, unitOfSlug, unitSlug } from '../design.mjs';
import { findSignature } from '../source.mjs';
import { splitRow } from '../markdown.mjs';

const templatesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates');

function today() {
  return new Date().toISOString().slice(0, 10);
}

const relOf = (design, abs) => path.relative(design.root, abs).split(path.sep).join('/');

// slug = <領域名詞>-<動詞或動名詞>:領域名詞是模組表上一個單元的 kebab 名(去掉模組前綴);模組表是空的就只查形狀。
export function checkSlug(design, slug) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(slug)) return `slug 要是 <領域名詞>-<動詞或動名詞>,kebab-case 英文,至少兩段:${slug}`;
  const entries = design.modules ? design.modules.entries.filter((e) => !e.placeholder) : [];
  if (!entries.length) return null;
  if (!unitOfSlug(design.cone, entries, slug)) {
    const domains = entries.map((e) => unitSlug(design.cone, e.unit)).filter(Boolean);
    return `slug 的領域名詞對不到模組表上任何單元:${slug}。領域名詞是 = 列住的那個單元,去掉模組前綴、大駝峰拆成 kebab;表上有:${domains.join('、')}。要新單元就先 lawful module`;
  }
  return null;
}

export function claim(design, slug, { description = '', date = today(), milestone = '', kind = '' } = {}) {
  const bad = checkSlug(design, slug);
  if (bad) return { text: bad, exitCode: 1 };
  if (kind && !KINDS.includes(kind)) return { text: `--kind 要是 ${KINDS.join(' 或 ')},不是「${kind}」`, exitCode: 1 };
  if (milestone && !design.objectives.objectives.some((o) => o.milestones.some((m) => m.id === milestone))) return { text: `objectives/ 沒有 ${milestone} 這條里程碑;先 lawful objective milestone <O-n> <一句話>`, exitCode: 1 };
  const nums = design.pipelines.map((p) => Number((p.id || '').slice(2)));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  const id = `P-${String(next).padStart(3, '0')}`;
  const fullName = `${id}-${slug}`;
  const file = path.join(design.pipelinesDir, `${fullName}.md`);
  if (fs.existsSync(file)) return { text: `${file} 已存在`, exitCode: 1 };
  let tpl = fs.readFileSync(path.join(templatesDir, 'pipeline.md'), 'utf8');
  tpl = tpl.replace(/P-00x-<slug>/g, fullName).replace(/P-00x/g, id).replace(/<YYYY-MM-DD>/g, date);
  if (description) tpl = tpl.replace('<一句話:input 到 output>', description).replace('<同 description>', description);
  if (kind) tpl = tpl.replace('<IO 介面 | 子流>', kind);
  fs.mkdirSync(design.pipelinesDir, { recursive: true });
  fs.writeFileSync(file, tpl);
  const out = [`建了 ${relOf(design, file)}(status: draft${kind ? `,kind: ${kind}` : ''})`];
  if (!kind) out.push(`kind 還是佔位符:frontmatter 填 ${KINDS.join(' 或 ')}`);
  if (milestone) {
    bindMilestone(design, milestone, fullName);
    out.push(`綁進 ${milestone}`);
  } else out.push('沒有 --milestone:這條 pipeline 還不朝向任何目標,lawful objective milestone 綁進去');
  return { text: out.join('\n'), exitCode: 0, fullName };
}

const MILESTONE_TABLE = ['| 里程碑 | 做到什麼 | 綁定 |', '|---|---|---|'];
const REFINEMENT_TABLE = ['| 調整 | 做到什麼 | 動到 |', '|---|---|---|'];

const objectiveFile = (design, o) => path.join(design.root, o.file);

// 在目標檔裡、表頭第一格是 head 的那張表尾端加一列;沒有那張表就在檔尾補表頭
function appendRow(lines, head, table, row) {
  let i = 0;
  while (i < lines.length && !(/^\s*\|/.test(lines[i]) && splitRow(lines[i])[0] === head)) i++;
  if (i < lines.length) {
    let last = i;
    while (last + 1 < lines.length && /^\s*\|/.test(lines[last + 1])) last++;
    lines.splice(last + 1, 0, row);
    return;
  }
  let end = lines.length;
  while (end > 0 && !lines[end - 1].trim()) end--;
  lines.splice(end, 0, '', ...table, row);
}

function bindMilestone(design, milestoneId, fullName) {
  const obj = design.objectives.objectives.find((o) => o.milestones.some((m) => m.id === milestoneId));
  if (!obj) return false;
  const file = objectiveFile(design, obj);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const i = lines.findIndex((l) => /^\s*\|/.test(l) && splitRow(l)[0] === milestoneId);
  if (i < 0) return false;
  const cells = splitRow(lines[i]);
  const have = (cells[2] || '').split(/[、,]/).map((x) => x.trim()).filter((x) => x && !/^[-—–]$/.test(x) && !/<[^>]*>/.test(x));
  if (!have.includes(fullName)) have.push(fullName);
  cells[2] = have.join('、');
  lines[i] = `| ${cells.join(' | ')} |`;
  fs.writeFileSync(file, lines.join('\n'));
  return true;
}

// requirement add <一句話> [--law <句>]:鑄 R-n,寫進 Cone.md「需求」節的尾端。
export function requirementAdd(design, title, { law = '' } = {}) {
  if (!title || /<[^>]*>/.test(title)) return { text: '需求要一句話:誰在什麼情況下要得到什麼', exitCode: 1 };
  if (!design.cone) return { text: `沒有 .lawful/Cone.md;${design.legacySystem ? 'lawful migrate cone --write' : 'lawful:design 先建它'}`, exitCode: 1 };
  const file = path.join(design.lawfulDir, 'Cone.md');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const from = lines.findIndex((l) => /^## 需求\s*$/.test(l));
  if (from < 0) return { text: 'Cone.md 沒有 ## 需求 節;照 templates/Cone.md 補', exitCode: 1 };
  let to = from + 1;
  while (to < lines.length && !/^## /.test(lines[to])) to++;
  // 節裡還是模板的 ### R-n 整段換掉;真的需求接在最後一條後面
  const heads = [];
  for (let i = from + 1; i < to; i++) if (/^### R-\d+/.test(lines[i])) heads.push(i);
  const nums = design.cone.requirements.filter((q) => !q.placeholder).map((q) => Number(q.id.slice(2)));
  const id = `R-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  const block = [`### ${id}:${title}`, `- Law:${law || '<一句可判定的話:這條需求成立時,什麼一定為真>'}`];
  const tpl = heads.filter((i) => /<[^>]*>/.test(lines[i]));
  let end = to;
  while (end > from + 1 && !lines[end - 1].trim()) end--;
  if (tpl.length) {
    const start = tpl[0];
    let stop = start + 1;
    while (stop < to && !/^### /.test(lines[stop])) stop++;
    while (stop > start + 1 && !lines[stop - 1].trim()) stop--;
    lines.splice(start, stop - start, ...block);
  } else lines.splice(end, 0, ...(heads.length ? [''] : []), ...block);
  fs.writeFileSync(file, lines.join('\n'));
  return { text: [`${id} 寫進 .lawful/Cone.md`, law ? '' : 'Law 還是佔位符,對談完填成可判定的一句', `下一步:lawful objective add <一句話> --requirement ${id} --priority <1-4>`].filter(Boolean).join('\n'), exitCode: 0, id };
}

// objective add <slug> <一句話> --requirement <R-n> --priority <1-4> [--law <句>]:鑄 O-n,建 objectives/R-n-O-n-<slug>.md。
// 沒給 --law 就繼承需求的 Law;一條需求有兩個以上目標時各目標要有自己的 Law。
export function objectiveAdd(design, slug, title, { requirement = '', priority, law = '', date = today() } = {}) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '')) return { text: `slug 要是 kebab-case 英文:${slug || '(沒給)'}`, exitCode: 1 };
  if (!title || /<[^>]*>/.test(title)) return { text: '目標要一句話:使用者做得到什麼、或世界變成什麼樣', exitCode: 1 };
  if (!/^R-\d+$/.test(requirement)) return { text: '--requirement 要是 Cone.md 裡的一條需求 R-n;每個目標解決一條需求', exitCode: 1 };
  const reqs = design.cone ? design.cone.requirements.filter((q) => !q.placeholder) : [];
  if (!reqs.some((q) => q.id === requirement)) return { text: `Cone.md 沒有 ${requirement};先 lawful requirement add <一句話> --law <句>${reqs.length ? `(有:${reqs.map((q) => q.id).join('、')})` : ''}`, exitCode: 1 };
  if (!/^[1-4]$/.test(String(priority || ''))) return { text: '--priority 要是 1 到 4,1 最高', exitCode: 1 };
  const nums = design.objectives.objectives.map((o) => Number(o.id.slice(2)));
  const id = `O-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  const fullName = `${requirement}-${id}-${slug}`;
  const dir = path.join(design.lawfulDir, 'objectives');
  const file = path.join(dir, `${fullName}.md`);
  if (fs.existsSync(file)) return { text: `${relOf(design, file)} 已存在`, exitCode: 1 };
  // 模板的表只留表頭:里程碑與調整各自配號,佔位列不進檔
  let tpl = fs.readFileSync(path.join(templatesDir, 'objective.md'), 'utf8');
  tpl = tpl.replace(/R-x-O-y-<slug>/g, fullName).replace(/O-y/g, id).replace(/R-x/g, requirement)
    .replace('<1 到 4,1 最高>', String(priority)).replace('<YYYY-MM-DD>', date)
    .replace('<一句話:使用者做得到什麼、或世界變成什麼樣>', title)
    .replace(`- Law:繼承 ${requirement}`, `- Law:${law || `繼承 ${requirement}`}`)
    .split(/\r?\n/).filter((l) => !/^\|\s*(M|RF)-\d+\s*\|.*<[^>]*>/.test(l)).join('\n');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, tpl);
  const siblings = design.objectives.objectives.filter((o) => o.requirement === requirement).map((o) => o.id);
  return {
    text: [
      `建了 ${relOf(design, file)}(${id},需求 ${requirement},優先 ${priority},Law ${law ? '自己的' : `繼承 ${requirement}`})`,
      siblings.length ? `${requirement} 現在有 ${[...siblings, id].join('、')} 兩個以上的目標:各目標要有自己的 Law,Cone.md 的 ${requirement} 要補蘊含說明${law ? '' : `;${id} 的 Law 改成自己的`}` : '',
      `下一步:lawful objective milestone ${id} <一句話> --bind <P-00x-<slug>>`,
    ].filter(Boolean).join('\n'),
    exitCode: 0,
    id,
    fullName,
  };
}

// objective milestone <O-n> <一句話> [--bind <全名,全名>]:鑄 M-n(全資料夾唯一),加到該目標檔的建置路線表裡。
export function milestoneAdd(design, objId, title, { bind = '' } = {}) {
  const obj = design.objectives.objectives.find((o) => o.id === objId);
  if (!obj) return { text: `objectives/ 沒有 ${objId};先 lawful objective add`, exitCode: 1 };
  if (!title || /<[^>]*>/.test(title)) return { text: '里程碑要一句話:做到什麼', exitCode: 1 };
  const binds = bind.split(/[、,]/).map((x) => x.trim()).filter(Boolean);
  const bad = binds.filter((b) => !design.pipelines.some((p) => p.fullName === b));
  if (bad.length) return { text: `綁定的 ${bad.join('、')} 不存在;里程碑只綁 pipelines/ 裡有的全名`, exitCode: 1 };
  const nums = design.objectives.objectives.flatMap((o) => o.milestones.map((m) => Number((m.id.match(/^M-(\d+)$/) || [0, 0])[1])));
  const id = `M-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  const file = objectiveFile(design, obj);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  appendRow(lines, '里程碑', MILESTONE_TABLE, `| ${id} | ${title} | ${binds.length ? binds.join('、') : '-'} |`);
  fs.writeFileSync(file, lines.join('\n'));
  return { text: [`${id} 寫進 ${obj.fullName}${binds.length ? `,綁定 ${binds.join('、')}` : ',還沒綁定任何 pipeline:lawful claim <slug> --milestone ' + id}`].join('\n'), exitCode: 0, id };
}

// objective refinement <O-n> <一句話> --touch <全名,全名>:鑄 RF-n(全資料夾唯一),加到該目標檔的優化路線表裡。
// 動到的 pipeline 要是這個目標的里程碑綁定過的:優化路線不引入新 feature。
export function refinementAdd(design, objId, title, { touch = '' } = {}) {
  const obj = design.objectives.objectives.find((o) => o.id === objId);
  if (!obj) return { text: `objectives/ 沒有 ${objId};先 lawful objective add`, exitCode: 1 };
  if (!title || /<[^>]*>/.test(title)) return { text: '調整要一句話:改既有 pipeline 的哪一種品質', exitCode: 1 };
  const touches = touch.split(/[、,]/).map((x) => x.trim()).filter(Boolean);
  if (!touches.length) return { text: '--touch 至少一條 pipeline 全名;優化路線只改既有的 pipeline', exitCode: 1 };
  const missing = touches.filter((b) => !design.pipelines.some((p) => p.fullName === b));
  if (missing.length) return { text: `動到的 ${missing.join('、')} 不存在;只能是 pipelines/ 裡有的全名`, exitCode: 1 };
  const bound = new Set(obj.milestones.flatMap((m) => m.binds));
  const outside = touches.filter((b) => !bound.has(b));
  if (outside.length) return { text: `${outside.join('、')} 不在 ${objId} 任何里程碑的綁定裡;優化路線不引入新 feature,新能力開里程碑(lawful objective milestone)`, exitCode: 1 };
  const nums = design.objectives.objectives.flatMap((o) => o.refinements.map((r) => Number((r.id.match(/^RF-(\d+)$/) || [0, 0])[1])));
  const id = `RF-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  const file = objectiveFile(design, obj);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  appendRow(lines, '調整', REFINEMENT_TABLE, `| ${id} | ${title} | ${touches.join('、')} |`);
  fs.writeFileSync(file, lines.join('\n'));
  return { text: [`${id} 寫進 ${obj.fullName},動到 ${touches.join('、')}`, `下一步:lawful:revise ${touches[0]},REV 的依欄引用 ${id};調整達成 = 動到的每條都有一條 REV 引用它、都達成,而且 ${obj.requirement || '需求'} 的 Law 仍成立`].join('\n'), exitCode: 0, id };
}

// rename <P-00x> <slug>:編號不動,換 slug;檔改名,專案裡每個寫著舊全名的地方(.lawful/ 全部、原始碼與測試的註解)一起改。
const RENAME_EXTS = new Set(['.md', '.hs', '.cabal', '.txt', '.yaml', '.yml', '.json', '.toml', '.py', '.rs', '.go', '.ts', '.js', '.mjs']);
const RENAME_SKIP = new Set(['.git', 'node_modules', 'dist-newstyle', 'dist', 'target', '.stack-work']);

function walkText(dir, root, ignore, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    const relPath = path.relative(root, abs).split(path.sep).join('/');
    if (ent.isDirectory()) {
      if (RENAME_SKIP.has(ent.name) || ent.name.startsWith('dist-newstyle') || ignore.includes(relPath) || ignore.includes(ent.name)) continue;
      walkText(abs, root, ignore, out);
    } else if (RENAME_EXTS.has(path.extname(ent.name))) out.push(abs);
  }
  return out;
}

export function rename(design, idOrName, slug, { dryRun = false } = {}) {
  const p = design.pipelines.find((q) => q.id === idOrName || q.fullName === idOrName);
  if (!p) return { text: `pipelines/ 裡沒有 ${idOrName}`, exitCode: 1 };
  const bad = checkSlug(design, slug);
  if (bad) return { text: bad, exitCode: 1 };
  const from = p.fullName;
  const to = `${p.id}-${slug}`;
  if (from === to) return { text: `${from} 已經叫這個名字`, exitCode: 0 };
  const target = path.join(design.pipelinesDir, `${to}.md`);
  if (fs.existsSync(target)) return { text: `${relOf(design, target)} 已存在`, exitCode: 1 };
  const verb = dryRun ? '會改' : '改了';
  const re = new RegExp(`(?<![A-Za-z0-9-])${from}(?![A-Za-z0-9-])`, 'g'); // 全名只有 P-00x 與 kebab,不用跳脫
  const ignore = design.cone ? design.cone.ignoreDirs : [];
  const out = [];
  let files = 0;
  for (const abs of walkText(design.root, design.root, ignore, [])) {
    const text = fs.readFileSync(abs, 'utf8');
    const hits = (text.match(re) || []).length;
    if (!hits) continue;
    files++;
    if (!dryRun) fs.writeFileSync(abs, text.replace(re, to));
    out.push(`${verb} ${relOf(design, abs)}(${hits} 處)`);
  }
  const oldFile = path.join(design.root, p.file);
  if (!dryRun) fs.renameSync(oldFile, target);
  out.unshift(`${from} → ${to}:${dryRun ? '會改名' : '改名'} ${p.file} → ${relOf(design, target)}`);
  out.push(`${files} 個檔寫著舊全名${dryRun ? '' : ',都改了'};測試歸屬字串只帶 ${p.id},不受影響`);
  return { text: out.join('\n'), exitCode: 0, fullName: to };
}

// 同層搬家的 stage,把模組欄改成程式碼的模組。
export function sync(design, source, adapter, { date = today() } = {}) {
  if (!source) return { text: '沒有 adapter,sync 不知道程式碼在哪', exitCode: 1 };
  const out = [];
  let changed = 0;
  for (const p of design.pipelines) {
    const abs = path.join(design.root, p.file);
    let text = fs.readFileSync(abs, 'utf8');
    let touched = false;
    for (const s of p.stages) {
      const hits = findSignature(source, s.name);
      if (!hits.length) continue;
      const hit = hits.find((h) => h.module === s.module) || hits[0];
      if (hit.module === s.module || adapter.normalizeType(s.type) !== hit.type) continue;
      const fromLayer = source.modules.has(s.module) ? source.modules.get(s.module).layer : null;
      const toLayer = source.modules.has(hit.module) ? source.modules.get(hit.module).layer : null;
      if (fromLayer && toLayer && fromLayer !== toLayer) {
        out.push(`✗ ${p.fullName}#${s.name} 從 ${fromLayer} 層跨到 ${toLayer} 層,sync 不動,走 REV`);
        continue;
      }
      const lines = text.split(/\r?\n/);
      const li = s.line - 1;
      const cells = splitRow(lines[li]);
      const note = /[((].*[))]\s*$/.exec(cells[3]);
      cells[3] = `\`${hit.module}\`${note ? note[0] : ''}`;
      lines[li] = `| ${cells.join(' | ')} |`;
      text = lines.join('\n');
      touched = true;
      changed++;
      out.push(`✓ ${p.fullName}#${s.name} 模組欄 ${s.module} → ${hit.module}`);
    }
    if (touched) {
      text = text.replace(/^updated:.*$/m, `updated: ${date}`);
      fs.writeFileSync(abs, text);
    }
  }
  if (!changed && !out.length) out.push('沒有搬家的 stage');
  return { text: out.join('\n'), exitCode: out.some((l) => l.startsWith('✗')) ? 1 : 0 };
}

const MODULES_HEAD = ['# 模組表', '', '## 模組單元', '| 模組 | 層 | 職責 |', '|---|---|---|'];

// modules.md 的模組單元表:改一列(replaceLine 是 1-based 行號)或在表尾加幾列;沒有檔就用三節的骨架建
function writeUnitRows(design, rows, replaceLine = 0) {
  const file = path.join(design.lawfulDir, 'modules.md');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : MODULES_HEAD.join('\n') + '\n';
  const lines = text.replace(/\s+$/, '').split(/\r?\n/);
  if (replaceLine) lines[replaceLine - 1] = rows[0];
  else {
    // 表尾:「模組單元」節裡最後一個 | 開頭的行;沒有那一節就是檔裡第一張表的尾端
    let head = lines.findIndex((l) => /^## 模組單元\s*$/.test(l));
    let i = head >= 0 ? head + 1 : 0;
    let stop = lines.length;
    if (head >= 0) {
      stop = i;
      while (stop < lines.length && !/^## /.test(lines[stop])) stop++;
    }
    while (i < stop && !/^\s*\|/.test(lines[i])) i++;
    if (i >= stop) {
      const at = head >= 0 ? stop : lines.length;
      lines.splice(at, 0, ...(head >= 0 ? [] : ['', '## 模組單元']), '| 模組 | 層 | 職責 |', '|---|---|---|', ...rows);
    } else {
      let last = i;
      while (last + 1 < stop && /^\s*\|/.test(lines[last + 1])) last++;
      lines.splice(last + 1, 0, ...rows);
    }
  }
  fs.mkdirSync(design.lawfulDir, { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

// module <名稱> --layers <types,effect,core,shell> [--responsibility <句>] [--dry-run]
// 先劃好一個模組單元的邊界與範圍:模組表寫一列,它宣告的每一層在那棵原始碼樹裡開好資料夾。
// 資料夾裡放幾個檔、叫什麼名字由 pipeline 決定,這裡不放任何模組。
export function moduleAdd(design, name, adapter, { layers = 'types,core', responsibility = '', facade = false, dryRun = false } = {}) {
  if (!name) return { text: '用法:lawful module <名稱> [--layers <types,effect,core,shell>] [--responsibility <句>]', exitCode: 1 };
  const prefix = design.cone ? design.cone.modulePrefix : '';
  const unit = name.includes('.') || !prefix ? name : `${prefix}.${name}`;
  if (!/^[A-Z][A-Za-z0-9_']*(\.[A-Z][A-Za-z0-9_']*)*$/.test(unit)) return { text: `模組名要是大寫開頭、用 . 分段:${unit}`, exitCode: 1 };
  if (prefix && unit !== prefix && !unit.startsWith(`${prefix}.`)) return { text: `Cone.md 的模組前綴是 ${prefix},${unit} 不在它底下`, exitCode: 1 };
  const want = String(layers).split(/[、,]/).map((s) => s.trim()).filter(Boolean);
  const bad = want.filter((l) => !LAYERS.includes(l));
  if (bad.length) return { text: `層只有 types / effect / core / shell,沒有「${bad.join('、')}」`, exitCode: 1 };
  if (!want.length) return { text: '--layers 至少一層', exitCode: 1 };

  const entries = design.modules ? design.modules.entries : [];
  const clash = entries.find((e) => !e.placeholder && e.unit !== unit && (unit.startsWith(`${e.unit}.`) || e.unit.startsWith(`${unit}.`)));
  if (clash) return { text: `${unit} 與模組表上的 ${clash.unit} 互相包含;模組單元不巢狀`, exitCode: 1 };
  const existing = entries.find((e) => e.unit === unit);
  const layersNow = existing ? existing.layers.slice() : [];
  const added = want.filter((l) => !layersNow.includes(l));
  const all = LAYERS.filter((l) => layersNow.includes(l) || added.includes(l));

  const out = [];
  const row = `| \`${unit}\` | ${all.join('、')} | ${responsibility || (existing ? existing.responsibility : '')} |`;
  if (!dryRun) writeUnitRows(design, [row], existing ? existing.line : 0);
  out.push(`${dryRun ? '會' : ''}${existing ? '改' : '建'}${dryRun ? '' : '了'} .lawful/modules.md 的 ${unit}:層 ${all.join('、')}`);
  if (!responsibility && !(existing && existing.responsibility)) out.push('職責欄是空的,lint boundary 會紅:一句話寫它負責什麼');

  const dirOf = (l) => `${layerRoot(design.cone, l)}/${unit.split('.').join('/')}`;
  for (const l of all) {
    const rel = dirOf(l);
    const abs = path.join(design.root, rel);
    if (fs.existsSync(abs)) {
      out.push(`· ${rel}/ 已經有了,不動`);
      continue;
    }
    if (!dryRun) {
      fs.mkdirSync(abs, { recursive: true });
      fs.writeFileSync(path.join(abs, '.gitkeep'), '');
    }
    out.push(`${dryRun ? '會開' : '開了'} ${rel}/`);
  }
  // 門面是與單元同名的模組,只能有一個。預設開在最上層:只有它 import 得到底下每一層,重新匯出得了整個單元。
  // 要讓底下幾層的消費者也用得到這個名字,--facade <層> 指定那一層,門面就只涵蓋那一層以下。
  if (facade) {
    const want = facade === true ? all[all.length - 1] : String(facade).trim();
    if (!all.includes(want)) return { text: `--facade 要是 ${unit} 宣告過的層(${all.join('、')}),不是「${want}」`, exitCode: 1 };
    const rel = `${layerRoot(design.cone, want)}/${adapter && adapter.modulePath ? adapter.modulePath(unit) : `${unit.split('.').join('/')}`}`;
    const other = all.filter((l) => l !== want).map((l) => `${layerRoot(design.cone, l)}/${adapter && adapter.modulePath ? adapter.modulePath(unit) : ''}`).find((f) => fs.existsSync(path.join(design.root, f)));
    if (other) return { text: `${other} 已經是 ${unit} 的門面;一個模組名只准一個檔,要換層先把那個檔搬走`, exitCode: 1 };
    if (!adapter || !adapter.moduleFile) out.push('沒有 adapter,門面的檔要自己建');
    else if (fs.existsSync(path.join(design.root, rel))) out.push(`· ${rel} 已經有了,不動`);
    else {
      if (!dryRun) fs.writeFileSync(path.join(design.root, rel), adapter.moduleFile(unit));
      out.push(`${dryRun ? '會建' : '建了'} ${rel}(${want} 層的門面,模組 ${unit},匯出清單是空的)`);
    }
  }
  out.push(`${unit} 的模組住這幾個資料夾底下,檔幾個、叫什麼由 pipeline 的 Stages 決定${facade ? '' : ';要一個與單元同名的門面就加 --facade'}`);
  out.push('新檔要加進建置設定裡對應子函式庫的模組清單,編譯器才看得到它們');
  out.push('下一步:lawful claim <slug> --milestone <M-n> 起一條走這個模組的 pipeline');
  return { text: out.join('\n'), exitCode: 0, unit };
}

// 從程式碼生成模組表骨架;既有的列保留,只補新的模組單元(職責欄留白)。
// 單元的猜法:模組名的第一段(有模組前綴就是前綴加下一段),層看檔案在哪一棵原始碼樹。
export function modulesGen(design, source) {
  if (!source) return { text: '沒有 adapter,modules --gen 不知道程式碼在哪', exitCode: 1 };
  const entries = (design.modules ? design.modules.entries : []).filter((e) => !e.placeholder);
  const prefix = design.cone ? design.cone.modulePrefix : '';
  const depth = prefix ? prefix.split('.').length + 1 : 1;
  const units = new Map();
  for (const m of source.modules.values()) {
    const segs = m.module.split('.');
    const unit = segs.slice(0, Math.min(depth, segs.length)).join('.');
    if (!units.has(unit)) units.set(unit, new Set());
    if (m.layer) units.get(unit).add(m.layer);
  }
  const missing = [...units.keys()].filter((u) => !entries.some((e) => u === e.unit || u.startsWith(`${e.unit}.`))).sort();
  if (!missing.length) return { text: '模組表已經涵蓋程式碼裡所有模組單元', exitCode: 0 };
  writeUnitRows(design, missing.map((u) => `| \`${u}\` | ${LAYERS.filter((l) => units.get(u).has(l)).join('、')} |  |`));
  return { text: [`modules.md 補了 ${missing.length} 個模組單元,職責欄留白:`, ...missing.map((u) => `- ${u}`)].join('\n'), exitCode: 0 };
}

export function spikeClose(design, id, { dryRun = false } = {}) {
  const s = design.spikes.find((x) => x.id === id || x.fullName === id);
  if (!s) return { text: `沒有 ${id} 這個 spike`, exitCode: 1 };
  const problems = [];
  if (s.status !== 'concluded') problems.push(`status 是「${s.status}」,要 concluded`);
  if (!['feasible', 'infeasible', 'partial'].includes(s.verdict)) problems.push(`verdict「${s.verdict}」要是 feasible / infeasible / partial`);
  if (!s.feeds.length) problems.push('feeds 是空的');
  for (const f of s.feeds) {
    const ok = design.pipelines.some((p) => p.fullName === f || f.startsWith(p.fullName)) || /^ADR-\d{3}-/.test(f);
    if (!ok) problems.push(`feeds 的 ${f} 指不到任何 pipeline 或 ADR`);
  }
  if (!s.rounds.length) problems.push('沒有 RND');
  for (const r of s.rounds) if (!r.sha) problems.push(`${r.id} 沒有 sha`);
  if (problems.length) return { text: [`${s.fullName} 還不能結案:`, ...problems.map((p) => `- ${p}`)].join('\n'), exitCode: 1 };
  const dir = path.join(design.root, 'spike', s.fullName);
  const exists = fs.existsSync(dir);
  if (!dryRun && exists) fs.rmSync(dir, { recursive: true, force: true });
  return {
    text: exists ? `${dryRun ? '會刪' : '刪了'} spike/${s.fullName}/;程式碼用 RND 的 sha 撈` : `spike/${s.fullName}/ 不存在,文檔已齊,無事可做`,
    exitCode: 0,
  };
}
