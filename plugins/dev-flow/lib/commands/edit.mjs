// 會寫檔的子命令:claim、requirement add、objective add / milestone / refinement、sync、modules --gen、spike close。
// 目標一個檔一個,住 objectives/R-x-O-y-<slug>.md。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { matchModule, matchesPattern, compareSignature } from '../design.mjs';
import { findSignature } from '../source.mjs';
import { splitRow } from '../markdown.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(here, '..', '..', 'templates');

function today() {
  return new Date().toISOString().slice(0, 10);
}

const SPEC = {
  feature: { prefix: 'F', dir: 'features', tpl: 'feature.md' },
  abstract: { prefix: 'A', dir: 'abstracts', tpl: 'abstract.md' },
  spike: { prefix: 'SPK', dir: 'spikes', tpl: 'spike.md' },
  adr: { prefix: 'ADR', dir: 'adr', tpl: 'adr.md' },
};

// 誰在 claim:和 git 自己一樣,GIT_AUTHOR_EMAIL 優先,其次專案裡的 user.email。
export function currentEmail(root) {
  if (process.env.GIT_AUTHOR_EMAIL) return process.env.GIT_AUTHOR_EMAIL.trim();
  const r = spawnSync('git', ['config', 'user.email'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || '').trim() : '';
}

// 下一個號:system.md 沒有號段行就從全部文檔的最大號往上配;有號段行就從自己的區間內往上配,區間起點是 000 時從 001 起。
// 回 { num, owner } 或 { error }。
export function nextNumber(design, nums, prefix) {
  const ranges = design.system ? design.system.ranges : [];
  if (!ranges.length) return { num: (nums.length ? Math.max(...nums) : 0) + 1, owner: '' };
  const email = currentEmail(design.root);
  if (!email) return { error: 'system.md 有號段行,但 git 的 user.email 是空的;先 git config user.email <你的 email>,號段行要有這個 email 的區間' };
  const mine = ranges.filter((r) => r.email === email);
  if (!mine.length) return { error: `system.md 的號段行沒有 ${email} 的區間;請架構負責人在「語言與工具」的號段行加上一段,再 claim` };
  for (const r of mine) {
    const lo = Math.max(r.lo, 1);
    const used = nums.filter((n) => n >= lo && n <= r.hi);
    const num = used.length ? Math.max(...used) + 1 : lo;
    if (num <= r.hi) return { num, owner: email, range: r.text };
  }
  return { error: `${email} 的號段 ${mine.map((r) => r.text).join('、')} 的 ${prefix} 用完了;請架構負責人在號段行再配一段` };
}

export function claim(design, kind, slug, { description = '', date = today(), milestone = '' } = {}) {
  const spec = SPEC[kind];
  if (!spec) return { text: `claim 的類別只有 feature / abstract / spike / adr,沒有「${kind}」`, exitCode: 1 };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '')) return { text: `slug 要是 kebab-case 英文:${slug}`, exitCode: 1 };
  if (milestone && kind !== 'feature') return { text: '--milestone 只給 feature:里程碑綁的是 feature', exitCode: 1 };
  if (milestone && !design.objectives.objectives.some((o) => o.milestones.some((m) => m.id === milestone))) return { text: `objectives/ 沒有 ${milestone} 這條里程碑;先 devflow objective milestone <O-n> <一句話>`, exitCode: 1 };
  const dir = path.join(design.designDir, spec.dir);
  const nums = [];
  const scan = (d) => {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d)) {
      const m = new RegExp(`^${spec.prefix}-(\\d{3})-`).exec(f);
      if (m) nums.push(Number(m[1]));
    }
  };
  scan(dir);
  if (kind === 'feature' && design.system) for (const l of design.system.listed) {
    const m = /^F-(\d{3})/.exec(l.fullName);
    if (m) nums.push(Number(m[1]));
  }
  const next = nextNumber(design, nums, spec.prefix);
  if (next.error) return { text: next.error, exitCode: 1 };
  const id = `${spec.prefix}-${String(next.num).padStart(3, '0')}`;
  const fullName = `${id}-${slug}`;
  const file = path.join(dir, `${fullName}.md`);
  if (fs.existsSync(file)) return { text: `${file} 已存在`, exitCode: 1 };
  let tpl = fs.readFileSync(path.join(templatesDir, spec.tpl), 'utf8');
  tpl = tpl.replace(new RegExp(`${spec.prefix}-00x-<slug>`, 'g'), fullName)
    .replace(new RegExp(`${spec.prefix}-00x`, 'g'), id)
    .replace(/<YYYY-MM-DD>/g, date);
  if (description) tpl = tpl.replace(/<一句話[^>]*>/, description).replace('<同 description>', description);
  if (next.owner) tpl = tpl.replace(/^(id: .*)$/m, `$1\nowner: ${next.owner}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, tpl);
  const out = [`建了 ${path.relative(design.root, file).split(path.sep).join('/')}${kind === 'feature' || kind === 'abstract' ? '(status: draft)' : ''}`];
  if (next.owner) out.push(`${id} 配自 ${next.owner} 的號段 ${next.range},owner 寫進 frontmatter`);

  if (kind === 'spike') {
    const code = path.join(design.root, 'spike', fullName);
    fs.mkdirSync(code, { recursive: true });
    out.push(`建了 spike/${fullName}/;程式碼只寫在這裡,結案即刪`);
  }
  if (kind === 'feature') {
    const sys = path.join(design.designDir, 'system.md');
    if (fs.existsSync(sys)) {
      const lines = fs.readFileSync(sys, 'utf8').split(/\r?\n/);
      const h = lines.findIndex((l) => /^## Features\s*$/.test(l));
      if (h >= 0) {
        let i = h + 1;
        while (i < lines.length && !/^\s*\|/.test(lines[i])) i++;
        while (i < lines.length && /^\s*\|/.test(lines[i])) i++;
        lines.splice(i, 0, `| ${fullName} | feature |`);
        fs.writeFileSync(sys, lines.join('\n'));
        out.push('system.md Features 表加了一列');
      } else out.push('system.md 沒有 ## Features 節,自己補一列');
    }
    if (milestone) {
      bindMilestone(design, milestone, fullName);
      out.push(`綁進 ${milestone}`);
    } else out.push('沒有 --milestone:這份 feature 還不朝向任何目標,devflow objective milestone 綁進去');
  }
  return { text: out.join('\n'), exitCode: 0, fullName };
}

const MILESTONE_TABLE = ['| 里程碑 | 做到什麼 | 綁定 |', '|---|---|---|'];
const REFINEMENT_TABLE = ['| 調整 | 做到什麼 | 動到 |', '|---|---|---|'];

const relOf = (design, abs) => path.relative(design.root, abs).split(path.sep).join('/');
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

// requirement add <一句話> [--law <句>]:鑄 R-n,寫進 system.md「需求」節的尾端。
export function requirementAdd(design, title, { law = '' } = {}) {
  if (!title || /<[^>]*>/.test(title)) return { text: '需求要一句話:誰在什麼情況下要得到什麼', exitCode: 1 };
  if (!design.system) return { text: '沒有 .design/system.md;dev-flow:project 先建它', exitCode: 1 };
  const file = path.join(design.designDir, 'system.md');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const from = lines.findIndex((l) => /^## 需求\s*$/.test(l));
  if (from < 0) return { text: `system.md 沒有 ## 需求 節;${design.legacyObjectives ? 'devflow migrate objectives --write 補上' : '照 templates/system.md 補'}`, exitCode: 1 };
  let to = from + 1;
  while (to < lines.length && !/^## /.test(lines[to])) to++;
  // 節裡還是模板的 ### R-n 整段換掉;真的需求接在最後一條後面
  const heads = [];
  for (let i = from + 1; i < to; i++) if (/^### R-\d+/.test(lines[i])) heads.push(i);
  const nums = design.system.requirements.filter((q) => !q.placeholder).map((q) => Number(q.id.slice(2)));
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
  return { text: [`${id} 寫進 .design/system.md`, law ? '' : 'Law 還是佔位符,對談完填成可判定的一句', `下一步:devflow objective add <slug> <一句話> --requirement ${id} --priority <1-4>`].filter(Boolean).join('\n'), exitCode: 0, id };
}

// objective add <slug> <一句話> --requirement <R-n> --priority <1-4> [--law <句>]:鑄 O-n,建 objectives/R-n-O-n-<slug>.md。
// 沒給 --law 就繼承需求的 Law;一條需求有兩個以上目標時各目標要有自己的 Law。
export function objectiveAdd(design, slug, title, { requirement = '', priority, law = '', date = today() } = {}) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '')) return { text: `slug 要是 kebab-case 英文:${slug || '(沒給)'}`, exitCode: 1 };
  if (!title || /<[^>]*>/.test(title)) return { text: '目標要一句話:使用者做得到什麼、或世界變成什麼樣', exitCode: 1 };
  if (!/^R-\d+$/.test(requirement)) return { text: '--requirement 要是 system.md 裡的一條需求 R-n;每個目標解決一條需求', exitCode: 1 };
  const reqs = design.system ? design.system.requirements.filter((q) => !q.placeholder) : [];
  if (!reqs.some((q) => q.id === requirement)) return { text: `system.md 沒有 ${requirement};先 devflow requirement add <一句話> --law <句>${reqs.length ? `(有:${reqs.map((q) => q.id).join('、')})` : ''}`, exitCode: 1 };
  if (!/^[1-4]$/.test(String(priority || ''))) return { text: '--priority 要是 1 到 4,1 最高', exitCode: 1 };
  const nums = design.objectives.objectives.map((o) => Number(o.id.slice(2)));
  const id = `O-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  const fullName = `${requirement}-${id}-${slug}`;
  const dir = path.join(design.designDir, 'objectives');
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
      siblings.length ? `${requirement} 現在有 ${[...siblings, id].join('、')} 兩個以上的目標:各目標要有自己的 Law,system.md 的 ${requirement} 要補蘊含說明${law ? '' : `;${id} 的 Law 改成自己的`}` : '',
      `下一步:devflow objective milestone ${id} <一句話> --bind <F-00x-<slug>>`,
    ].filter(Boolean).join('\n'),
    exitCode: 0,
    id,
    fullName,
  };
}

// objective milestone <O-n> <一句話> [--bind <全名,全名>]:鑄 M-n(全資料夾唯一),加到該目標檔的建置路線表裡。
export function milestoneAdd(design, objId, title, { bind = '' } = {}) {
  const obj = design.objectives.objectives.find((o) => o.id === objId);
  if (!obj) return { text: `objectives/ 沒有 ${objId};先 devflow objective add`, exitCode: 1 };
  if (!title || /<[^>]*>/.test(title)) return { text: '里程碑要一句話:做到什麼', exitCode: 1 };
  const binds = bind.split(/[、,]/).map((x) => x.trim()).filter(Boolean);
  const bad = binds.filter((b) => !design.docs.some((d) => d.fullName === b));
  if (bad.length) return { text: `綁定的 ${bad.join('、')} 不存在;里程碑只綁 features/ 裡有的全名`, exitCode: 1 };
  const abstracts = binds.filter((b) => design.abstracts.some((d) => d.fullName === b));
  if (abstracts.length) return { text: `${abstracts.join('、')} 是 abstract;里程碑綁 feature,abstract 跟著引用它的 feature 達成`, exitCode: 1 };
  const nums = design.objectives.objectives.flatMap((o) => o.milestones.map((m) => Number((m.id.match(/^M-(\d+)$/) || [0, 0])[1])));
  const id = `M-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  const file = objectiveFile(design, obj);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  appendRow(lines, '里程碑', MILESTONE_TABLE, `| ${id} | ${title} | ${binds.length ? binds.join('、') : '-'} |`);
  fs.writeFileSync(file, lines.join('\n'));
  return { text: [`${id} 寫進 ${obj.fullName}${binds.length ? `,綁定 ${binds.join('、')}` : ',還沒綁定任何 feature:devflow claim feature <slug> --milestone ' + id}`].join('\n'), exitCode: 0, id };
}

// objective refinement <O-n> <一句話> --touch <全名,全名>:鑄 RF-n(全資料夾唯一),加到該目標檔的優化路線表裡。
// 動到的 feature 要是這個目標的里程碑綁定過的:優化路線不引入新 feature。
export function refinementAdd(design, objId, title, { touch = '' } = {}) {
  const obj = design.objectives.objectives.find((o) => o.id === objId);
  if (!obj) return { text: `objectives/ 沒有 ${objId};先 devflow objective add`, exitCode: 1 };
  if (!title || /<[^>]*>/.test(title)) return { text: '調整要一句話:改既有 feature 的哪一種品質', exitCode: 1 };
  const touches = touch.split(/[、,]/).map((x) => x.trim()).filter(Boolean);
  if (!touches.length) return { text: '--touch 至少一份 feature 全名;優化路線只改既有的 feature', exitCode: 1 };
  const missing = touches.filter((b) => !design.docs.some((d) => d.fullName === b));
  if (missing.length) return { text: `動到的 ${missing.join('、')} 不存在;只能是 features/ 裡有的全名`, exitCode: 1 };
  const bound = new Set(obj.milestones.flatMap((m) => m.binds));
  const outside = touches.filter((b) => !bound.has(b));
  if (outside.length) return { text: `${outside.join('、')} 不在 ${objId} 任何里程碑的綁定裡;優化路線不引入新 feature,新能力開里程碑(devflow objective milestone)`, exitCode: 1 };
  const nums = design.objectives.objectives.flatMap((o) => o.refinements.map((r) => Number((r.id.match(/^RF-(\d+)$/) || [0, 0])[1])));
  const id = `RF-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  const file = objectiveFile(design, obj);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  appendRow(lines, '調整', REFINEMENT_TABLE, `| ${id} | ${title} | ${touches.join('、')} |`);
  fs.writeFileSync(file, lines.join('\n'));
  return { text: [`${id} 寫進 ${obj.fullName},動到 ${touches.join('、')}`, `下一步:dev-flow:revise ${touches[0]},REV 的依欄引用 ${id};調整達成 = 動到的每份都有一條 REV 引用它、都達成,而且 ${obj.requirement || '需求'} 的 Law 仍成立`].join('\n'), exitCode: 0, id };
}

// 同層搬家的 step,把模組欄改成程式碼裡的實際檔案。
export function sync(design, source, { date = today() } = {}) {
  if (!source) return { text: '沒有 adapter,sync 不知道程式碼在哪', exitCode: 1 };
  const entries = design.modules ? design.modules.entries : [];
  const out = [];
  let changed = 0;
  for (const p of design.docs) {
    const abs = path.join(design.root, p.file);
    let text = fs.readFileSync(abs, 'utf8');
    let touched = false;
    for (const s of p.steps) {
      const hits = findSignature(source, s.name);
      if (!hits.length) continue;
      const hit = hits.find((h) => h.file === s.module) || hits[0];
      if (hit.file === s.module || !compareSignature(s.sig, hit).ok) continue;
      const from = entries.length ? matchModule(entries, s.module) : null;
      const to = entries.length ? matchModule(entries, hit.file) : null;
      if (from && to && from.layer !== to.layer) {
        out.push(`✗ ${p.fullName}#${s.name} 從 ${from.layer} 層跨到 ${to.layer} 層,sync 不動,走 REV`);
        continue;
      }
      const lines = text.split(/\r?\n/);
      const cells = splitRow(lines[s.line - 1]);
      const note = /[((].*[))]\s*$/.exec(cells[3]);
      cells[3] = `\`${hit.file}\`${note ? note[0] : ''}`;
      lines[s.line - 1] = `| ${cells.join(' | ')} |`;
      text = lines.join('\n');
      touched = true;
      changed++;
      out.push(`✓ ${p.fullName}#${s.name} 模組欄 ${s.module} → ${hit.file}`);
    }
    if (touched) {
      text = text.replace(/^updated:.*$/m, `updated: ${date}`);
      fs.writeFileSync(abs, text);
    }
  }
  if (!changed && !out.length) out.push('沒有搬家的 step');
  return { text: out.join('\n'), exitCode: out.some((l) => l.startsWith('✗')) ? 1 : 0 };
}

// 從程式碼補模組表缺的檔案,層欄留白。
export function modulesGen(design, source) {
  if (!source) return { text: '沒有 adapter,modules --gen 不知道程式碼在哪', exitCode: 1 };
  const file = path.join(design.designDir, 'modules.md');
  const entries = design.modules ? design.modules.entries : [];
  const missing = [...source.files.keys()].filter((m) => !entries.some((e) => matchesPattern(e.pattern, m))).sort();
  if (!missing.length) return { text: '模組表已經涵蓋程式碼裡所有檔案', exitCode: 0 };
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '# 模組表\n\n| 路徑 | 層 |\n|---|---|\n';
  const lines = text.replace(/\s+$/, '').split(/\r?\n/);
  let last = lines.length - 1;
  while (last >= 0 && !/^\s*\|/.test(lines[last])) last--;
  const rows = missing.map((m) => `| \`${m}\` |  |`);
  if (last < 0) lines.push('', '| 路徑 | 層 |', '|---|---|', ...rows);
  else lines.splice(last + 1, 0, ...rows);
  fs.mkdirSync(design.designDir, { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return { text: [`modules.md 補了 ${missing.length} 個檔案,層欄留白;可以合併成 \`目錄/**\` 一列:`, ...missing.map((m) => `- ${m}`)].join('\n'), exitCode: 0 };
}

export function spikeClose(design, id, { dryRun = false } = {}) {
  const s = design.spikes.find((x) => x.id === id || x.fullName === id);
  if (!s) return { text: `沒有 ${id} 這個 spike`, exitCode: 1 };
  const problems = [];
  if (s.status !== 'concluded') problems.push(`status 是「${s.status}」,要 concluded`);
  if (!['feasible', 'infeasible', 'partial'].includes(s.verdict)) problems.push(`verdict「${s.verdict}」要是 feasible / infeasible / partial`);
  if (!s.feeds.length) problems.push('feeds 是空的');
  for (const f of s.feeds) {
    const ok = design.docs.some((p) => p.fullName === f || f.startsWith(p.fullName)) || /^ADR-\d{3}-/.test(f);
    if (!ok) problems.push(`feeds 的 ${f} 指不到任何 feature、abstract 或 ADR`);
  }
  if (!s.rounds.length) problems.push('沒有 RND');
  for (const rd of s.rounds) if (!rd.sha) problems.push(`${rd.id} 沒有 sha`);
  if (problems.length) return { text: [`${s.fullName} 還不能結案:`, ...problems.map((p) => `- ${p}`)].join('\n'), exitCode: 1 };
  const dir = path.join(design.root, 'spike', s.fullName);
  const exists = fs.existsSync(dir);
  if (!dryRun && exists) fs.rmSync(dir, { recursive: true, force: true });
  return {
    text: exists ? `${dryRun ? '會刪' : '刪了'} spike/${s.fullName}/;程式碼用 RND 的 sha 撈` : `spike/${s.fullName}/ 不存在,文檔已齊,無事可做`,
    exitCode: 0,
  };
}
