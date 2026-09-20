// 會寫檔的子命令:claim、requirement add / milestone / refinement、invariant add、sync、modules --gen。
// 需求一條一個檔,住 requirements/R-n-<slug>.md。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { matchModule, matchesPattern, compareSignature, LAW_KINDS } from '../design.mjs';
import { findSignature } from '../source.mjs';
import { splitRow } from '../markdown.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(here, '..', '..', 'templates');

function today() {
  return new Date().toISOString().slice(0, 10);
}

const SPEC = {
  feature: { prefix: 'F', dir: 'features', tpl: 'feature.md' },
  adr: { prefix: 'ADR', dir: 'adr', tpl: 'adr.md' },
};

// 同一個 repo 的每一棵工作樹(含自己):切片各住各的 build/ 工作樹、各自 claim,配號要看得到彼此,才不會配到同一個號。
// 專案根目錄沒有 .git(夾具、匯出的樹)就只有自己。
export function worktrees(root) {
  const self = [{ path: path.resolve(root), branch: '' }];
  if (!fs.existsSync(path.join(root, '.git'))) return self;
  const r = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return self;
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' });
  // .design 可能不在 repo 根目錄:每棵樹裡取同一個相對位置
  const sub = top.status === 0 ? path.relative(path.resolve(top.stdout.trim()), path.resolve(root)) : '';
  const out = [];
  for (const block of (r.stdout || '').split(/\r?\n\r?\n/)) {
    const wt = /^worktree (.+)$/m.exec(block);
    if (!wt) continue;
    const br = /^branch refs\/heads\/(.+)$/m.exec(block);
    const p = path.join(path.resolve(wt[1].trim()), sub);
    if (fs.existsSync(p)) out.push({ path: p, branch: br ? br[1].trim() : '' });
  }
  return out.length ? out : self;
}

export function worktreeRoots(root) {
  return [...new Set([path.resolve(root), ...worktrees(root).map((w) => w.path)])];
}

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
  if (!spec) return { text: `claim 的類別只有 feature / adr,沒有「${kind}」`, exitCode: 1 };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '')) return { text: `slug 要是 kebab-case 英文:${slug}`, exitCode: 1 };
  if (milestone && kind !== 'feature') return { text: '--milestone 只給 feature:里程碑綁的是 feature', exitCode: 1 };
  // --milestone 給編號 M-n 或全名 M-n-<slug> 都行
  if (milestone) {
    const hit = design.requirements.requirements.flatMap((q) => q.milestones).find((m) => m.id === milestone || m.fullName === milestone);
    if (!hit) return { text: `requirements/ 沒有 ${milestone} 這條里程碑;先 devflow requirement milestone <R-n> <slug> <一句話>`, exitCode: 1 };
    if (design.requirements.merged || design.objectivesFile) return { text: NOT_MIGRATED, exitCode: 1 };
    milestone = hit.id;
  }
  const dir = path.join(design.designDir, spec.dir);
  const nums = [];
  const scan = (d) => {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d)) {
      const m = new RegExp(`^${spec.prefix}-(\\d{3})-`).exec(f);
      if (m) nums.push(Number(m[1]));
    }
  };
  // 別的工作樹上已經 claim 走的號也算:每條切片各自 claim,合進主線時才不會同號
  const designRel = path.relative(design.root, design.designDir);
  for (const wt of worktreeRoots(design.root)) scan(path.join(wt, designRel, spec.dir));
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
  const out = [`建了 ${path.relative(design.root, file).split(path.sep).join('/')}${kind === 'feature' ? '(status: draft)' : ''}`];
  if (next.owner) out.push(`${id} 配自 ${next.owner} 的號段 ${next.range},owner 寫進 frontmatter`);

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
    } else out.push('沒有 --milestone:這份 feature 還不朝向任何需求,dev-flow:require-design 綁進一條里程碑');
  }
  return { text: out.join('\n'), exitCode: 0, fullName };
}

const MILESTONE_TABLE = ['| 里程碑 | 做到什麼 | 綁定 |', '|---|---|---|'];
const REFINEMENT_TABLE = ['| 調整 | 做到什麼 | 動到 |', '|---|---|---|'];

const relOf = (design, abs) => path.relative(design.root, abs).split(path.sep).join('/');
const requirementFile = (design, q) => path.join(design.root, q.file);
const NOT_MIGRATED = '這棵樹的需求與里程碑還沒有搬進 requirements/;先 devflow migrate requirements --write 換成一條需求一個檔';
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// 在需求檔裡、表頭第一格是 head 的那張表尾端加一列;沒有那張表就補表頭:里程碑表補在調整表之前,調整表補在檔尾
function appendRow(lines, head, table, row) {
  const headAt = (h) => lines.findIndex((l) => /^\s*\|/.test(l) && splitRow(l)[0] === h);
  const i = headAt(head);
  if (i >= 0) {
    let last = i;
    while (last + 1 < lines.length && /^\s*\|/.test(lines[last + 1])) last++;
    lines.splice(last + 1, 0, row);
    return;
  }
  const before = head === '里程碑' ? headAt('調整') : -1;
  if (before >= 0) {
    lines.splice(before, 0, ...table, row, '');
    return;
  }
  let end = lines.length;
  while (end > 0 && !lines[end - 1].trim()) end--;
  lines.splice(end, 0, '', ...table, row);
}

function bindMilestone(design, milestoneId, fullName) {
  const req = design.requirements.requirements.find((q) => q.milestones.some((m) => m.id === milestoneId));
  if (!req) return false;
  const file = requirementFile(design, req);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const i = lines.findIndex((l) => /^\s*\|/.test(l) && (splitRow(l)[0] === milestoneId || splitRow(l)[0].startsWith(`${milestoneId}-`)));
  if (i < 0) return false;
  const cells = splitRow(lines[i]);
  const have = (cells[2] || '').split(/[、,]/).map((x) => x.trim()).filter((x) => x && !/^[-—–]$/.test(x) && !/<[^>]*>/.test(x));
  if (!have.includes(fullName)) have.push(fullName);
  cells[2] = have.join('、');
  lines[i] = `| ${cells.join(' | ')} |`;
  fs.writeFileSync(file, lines.join('\n'));
  return true;
}

// requirement add <slug> <一句話> --priority <1-4> [--accept <句>]:鑄 R-n,建 requirements/R-n-<slug>.md。
// 需求是必須達成的事,驗收是判它達成與否的那一句;里程碑與調整各自配號,模板的佔位列不進檔。
export function requirementAdd(design, slug, title, { accept = '', priority, date = today() } = {}) {
  if (!design.system) return { text: '沒有 .design/system.md;dev-flow:kickoff 先建它', exitCode: 1 };
  if (design.requirements.merged || design.objectivesFile) return { text: NOT_MIGRATED, exitCode: 1 };
  if (!SLUG.test(slug || '')) return { text: `需求要一個 kebab-case 英文名:devflow requirement add <slug> <一句話> --priority <1-4>(拿到的是「${slug || ''}」)`, exitCode: 1 };
  if (!title || /<[^>]*>/.test(title)) return { text: '需求要一句話:誰在什麼情況下要得到什麼', exitCode: 1 };
  if (!/^[1-4]$/.test(String(priority || ''))) return { text: '--priority 要是 1 到 4,1 最高', exitCode: 1 };
  const nums = design.requirements.requirements.map((q) => Number(q.fileId.slice(2)));
  const id = `R-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  const fullName = `${id}-${slug}`;
  const dir = path.join(design.designDir, 'requirements');
  const file = path.join(dir, `${fullName}.md`);
  let tpl = fs.readFileSync(path.join(templatesDir, 'requirement.md'), 'utf8');
  tpl = tpl.replace(/R-n-<slug>/g, fullName).replace(/R-n/g, id)
    .replace('<1 到 4,1 最高>', String(priority)).replace('<YYYY-MM-DD>', date)
    .replace('<一句話:誰在什麼情況下要得到什麼>', title)
    .split(/\r?\n/).filter((l) => !/^\|\s*(M|RF)-\d+\S*\s*\|.*<[^>]*>/.test(l)).join('\n');
  // 給了 --accept 就只留那一句;三行式在對談裡寫
  if (accept) {
    const lines = tpl.split('\n');
    const at = lines.findIndex((l) => /^- 驗收[::]/.test(l));
    let stop = at + 1;
    while (stop < lines.length && /^\s{2,}- /.test(lines[stop])) stop++;
    lines.splice(at, stop - at, `- 驗收:${accept}`);
    tpl = lines.join('\n');
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, tpl);
  return {
    text: [
      `建了 ${relOf(design, file)}(${id},優先 ${priority})`,
      accept ? '' : '驗收還是佔位符,對談完填成可判定的一句',
      `下一步:devflow requirement milestone ${id} <slug> <一句話>`,
    ].filter(Boolean).join('\n'),
    exitCode: 0,
    id,
    fullName,
  };
}

// invariant add <一句話> [--kind <種類>]:鑄 INV-n,寫進 system.md「全域 Law」區的「領域不變量」尾端;區裡沒有這一小節就補在區的最前面。
// 領域不變量是開發者批准的決定,只由 global-laws 寫;整個專案任何一份 feature 都不准違反,三行的識別字只用最內層的匯出與型別名。
export function invariantAdd(design, title, { kind = 'invariant' } = {}) {
  if (!title || /<[^>]*>/.test(title)) return { text: '領域不變量要一句話:整個專案都不准違反的是什麼', exitCode: 1 };
  if (!design.system) return { text: '沒有 .design/system.md;dev-flow:kickoff 先建它', exitCode: 1 };
  if (!LAW_KINDS.includes(kind)) return { text: `--kind「${kind}」不在 ${LAW_KINDS.join(' / ')}`, exitCode: 1 };
  const file = path.join(design.designDir, 'system.md');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const nums = design.system.invariants.map((v) => Number(v.id.slice(4)));
  const id = `INV-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  const item = `- ${id} [${kind}] ${title}`;
  const from = lines.findIndex((l) => /^#{2,3} 領域不變量\s*$/.test(l));
  if (from < 0) {
    // 補一小節:放在「## 全域 Law」區的第一個 ### 之前
    const region = lines.findIndex((l) => /^## 全域 Law\s*$/.test(l));
    if (region < 0) return { text: 'system.md 沒有 ## 全域 Law 區;devflow migrate laws --write 補上', exitCode: 1 };
    let at = region + 1;
    while (at < lines.length && !/^#{1,3} /.test(lines[at])) at++;
    lines.splice(at, 0, '### 領域不變量', item, '');
  } else {
    let to = from + 1;
    while (to < lines.length && !/^#{1,3} /.test(lines[to])) to++;
    // 節裡還是模板的那一條(連同它的子項)與單獨一行的「無」換掉;真的不變量接在最後一條後面
    const body = [];
    for (let i = from + 1; i < to; i++) {
      const l = lines[i];
      if (/^\s*無\s*$/.test(l)) continue;
      if (/^- INV-\d+/.test(l) && /<[^>]*>/.test(l)) {
        while (i + 1 < to && /^\s{2,}- /.test(lines[i + 1])) i++;
        continue;
      }
      body.push(l);
    }
    while (body.length && !body[body.length - 1].trim()) body.pop();
    lines.splice(from + 1, to - from - 1, ...body, item, '');
  }
  fs.writeFileSync(file, lines.join('\n'));
  return { text: [`${id} 寫進 .design/system.md「全域 Law」的領域不變量`, `還沒有三行式:最內層的型別出現後寫成 forall / |- 兩行(識別字只用最內層的匯出與型別名),再 dev-flow:build ${id} 派 qa 寫歸屬 "${id}#LAW" 的測試`].join('\n'), exitCode: 0, id };
}

// requirement milestone <R-n> <slug> <一句話> [--bind <全名,全名>]:鑄 M-n(全資料夾唯一),以全名 M-n-<slug> 加到該需求檔的里程碑表最後;表的列序就是先後。
// slug 是這條里程碑的英文名,切片的分支 build/M-n-<slug> 與決策紀錄 journal/M-n-<slug>.md 都以它為鍵。
export function milestoneAdd(design, reqId, slug, title, { bind = '' } = {}) {
  if (design.requirements.merged || design.objectivesFile) return { text: NOT_MIGRATED, exitCode: 1 };
  const req = design.requirements.requirements.find((q) => q.id === reqId);
  if (!req) return { text: `requirements/ 沒有 ${reqId};先 devflow requirement add`, exitCode: 1 };
  if (!SLUG.test(slug || '')) return { text: `里程碑要一個 kebab-case 英文名:devflow requirement milestone ${reqId} <slug> <一句話>(拿到的是「${slug || ''}」)`, exitCode: 1 };
  if (!title || /<[^>]*>/.test(title)) return { text: '里程碑要一句話:使用者在這個階段看得到、展示得出來或呼叫得到什麼', exitCode: 1 };
  const binds = bind.split(/[、,]/).map((x) => x.trim()).filter(Boolean);
  const bad = binds.filter((b) => !design.docs.some((d) => d.fullName === b));
  if (bad.length) return { text: `綁定的 ${bad.join('、')} 不存在;里程碑只綁 features/ 裡有的全名`, exitCode: 1 };
  const abstracts = binds.filter((b) => design.abstracts.some((d) => d.fullName === b));
  if (abstracts.length) return { text: `${abstracts.join('、')} 不是 feature;里程碑綁 features/ 裡的文檔`, exitCode: 1 };
  const nums = design.requirements.requirements.flatMap((q) => q.milestones.map((m) => Number((m.id.match(/^M-(\d+)$/) || [0, 0])[1])));
  const id = `M-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  const file = requirementFile(design, req);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const fullName = `${id}-${slug}`;
  appendRow(lines, '里程碑', MILESTONE_TABLE, `| ${fullName} | ${title} | ${binds.length ? binds.join('、') : '-'} |`);
  fs.writeFileSync(file, lines.join('\n'));
  return { text: [`${fullName} 寫進 ${req.fullName}${binds.length ? `,綁定 ${binds.join('、')}` : `,還沒有切片:dev-flow:spike-impl ${fullName}`}`].join('\n'), exitCode: 0, id, fullName };
}

// requirement refinement <R-n> <一句話> --touch <全名,全名>:鑄 RF-n(全資料夾唯一),加到該需求檔的調整表裡。
// 動到的 feature 要是這條需求的里程碑綁定過的:調整不引入新 feature。
export function refinementAdd(design, reqId, title, { touch = '' } = {}) {
  if (design.requirements.merged || design.objectivesFile) return { text: NOT_MIGRATED, exitCode: 1 };
  const req = design.requirements.requirements.find((q) => q.id === reqId);
  if (!req) return { text: `requirements/ 沒有 ${reqId};先 devflow requirement add`, exitCode: 1 };
  if (!title || /<[^>]*>/.test(title)) return { text: '調整要一句話:改既有 feature 的哪一種品質', exitCode: 1 };
  const touches = touch.split(/[、,]/).map((x) => x.trim()).filter(Boolean);
  if (!touches.length) return { text: '--touch 至少一份 feature 全名;調整只改既有的 feature', exitCode: 1 };
  const missing = touches.filter((b) => !design.docs.some((d) => d.fullName === b));
  if (missing.length) return { text: `動到的 ${missing.join('、')} 不存在;只能是 features/ 裡有的全名`, exitCode: 1 };
  const bound = new Set(req.milestones.flatMap((m) => m.binds));
  const outside = touches.filter((b) => !bound.has(b));
  if (outside.length) return { text: `${outside.join('、')} 不在 ${reqId} 任何里程碑的綁定裡;調整不引入新 feature,新能力開里程碑(devflow requirement milestone)`, exitCode: 1 };
  const nums = design.requirements.requirements.flatMap((q) => q.refinements.map((r) => Number((r.id.match(/^RF-(\d+)$/) || [0, 0])[1])));
  const id = `RF-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  const file = requirementFile(design, req);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  appendRow(lines, '調整', REFINEMENT_TABLE, `| ${id} | ${title} | ${touches.join('、')} |`);
  fs.writeFileSync(file, lines.join('\n'));
  return { text: [`${id} 寫進 ${req.fullName},動到 ${touches.join('、')}`, `下一步:dev-flow:scope-revise ${touches[0]}(既有的 law 不動、可以新增,REV 的依欄引用 ${id};要調整既有的 law 才做得到,整件改走 dev-flow:scope-laws);調整達成 = 動到的每份都有一條 REV 引用它、都達成,而且 ${reqId} 仍達成`].join('\n'), exitCode: 0, id };
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
