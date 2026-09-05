// 會寫檔的子命令:claim、sync、modules --gen、spike close。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchModule, matchesPattern } from '../design.mjs';
import { findSignature } from '../source.mjs';
import { splitRow } from '../markdown.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(here, '..', '..', 'templates');

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function claim(design, slug, { description = '', date = today() } = {}) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { text: `slug 要是 kebab-case 英文:${slug}`, exitCode: 1 };
  const nums = design.pipelines.map((p) => Number((p.id || '').slice(2)));
  if (design.system) for (const l of design.system.pipelines) {
    const m = /^P-(\d{3})/.exec(l.fullName);
    if (m) nums.push(Number(m[1]));
  }
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  const id = `P-${String(next).padStart(3, '0')}`;
  const fullName = `${id}-${slug}`;
  const file = path.join(design.pipelinesDir, `${fullName}.md`);
  if (fs.existsSync(file)) return { text: `${file} 已存在`, exitCode: 1 };
  let tpl = fs.readFileSync(path.join(templatesDir, 'pipeline.md'), 'utf8');
  tpl = tpl.replace(/P-00x-<slug>/g, fullName).replace(/P-00x/g, id).replace(/<YYYY-MM-DD>/g, date);
  if (description) tpl = tpl.replace('<一句話:input 到 output>', description).replace('<同 description>', description);
  fs.mkdirSync(design.pipelinesDir, { recursive: true });
  fs.writeFileSync(file, tpl);
  const out = [`建了 ${path.relative(design.root, file).split(path.sep).join('/')}(status: draft)`];
  const sys = path.join(design.lawfulDir, 'system.md');
  if (fs.existsSync(sys)) {
    const text = fs.readFileSync(sys, 'utf8');
    const lines = text.split(/\r?\n/);
    const h = lines.findIndex((l) => /^## Pipelines\s*$/.test(l));
    if (h >= 0) {
      let i = h + 1;
      while (i < lines.length && !/^\s*\|/.test(lines[i])) i++;
      while (i < lines.length && /^\s*\|/.test(lines[i])) i++;
      lines.splice(i, 0, `| ${fullName} | <里程碑 或 子流> |`);
      fs.writeFileSync(sys, lines.join('\n'));
      out.push(`system.md Pipelines 表加了一列,類別欄填里程碑或子流`);
    } else out.push('system.md 沒有 ## Pipelines 節,自己補一列');
  }
  return { text: out.join('\n'), exitCode: 0, fullName };
}

// 同層搬家的 stage,把模組欄改成程式碼的模組。
export function sync(design, source, adapter, { date = today() } = {}) {
  if (!source) return { text: '沒有 adapter,sync 不知道程式碼在哪', exitCode: 1 };
  const entries = design.modules ? design.modules.entries : [];
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
      const from = entries.length ? matchModule(entries, s.module) : null;
      const to = entries.length ? matchModule(entries, hit.module) : null;
      if (from && to && from.layer !== to.layer) {
        out.push(`✗ ${p.fullName}#${s.name} 從 ${from.layer} 層跨到 ${to.layer} 層,sync 不動,走 REV`);
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

// 從程式碼生成模組表骨架;既有的列保留,只補新模組(層欄留白)。
export function modulesGen(design, source) {
  if (!source) return { text: '沒有 adapter,modules --gen 不知道程式碼在哪', exitCode: 1 };
  const file = path.join(design.lawfulDir, 'modules.md');
  const entries = design.modules ? design.modules.entries : [];
  const missing = [...source.modules.keys()].filter((m) => !entries.some((e) => matchesPattern(e.pattern, m))).sort();
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '# 模組表\n\n| 模組 | 層 |\n|---|---|\n';
  if (!missing.length) return { text: '模組表已經涵蓋程式碼裡所有模組', exitCode: 0 };
  const lines = text.replace(/\s+$/, '').split(/\r?\n/);
  let last = lines.length - 1;
  while (last >= 0 && !/^\s*\|/.test(lines[last])) last--;
  const rows = missing.map((m) => `| \`${m}\` |  |`);
  if (last < 0) lines.push('', '| 模組 | 層 |', '|---|---|', ...rows);
  else lines.splice(last + 1, 0, ...rows);
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return { text: [`modules.md 補了 ${missing.length} 個模組,層欄留白:`, ...missing.map((m) => `- ${m}`)].join('\n'), exitCode: 0 };
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
