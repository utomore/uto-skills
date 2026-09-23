// release：每條需求上線了沒，全部從 git 推。上線 = 這條需求用到的每份文檔，它的程式碼在主線上最新的那個 commit 已經進了一個發布的 tag。
// 發布的 tag 由 system.md「Constraint」的「發布」行選（git tag --list 的樣式），沒寫就每個 tag 都算。唯讀，不寫任何檔。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SIGNED, analyze, mainRef, requirementView } from './status.mjs';

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

// 證據還沒齊的需求不問上線：它的程式碼還在長，進了哪個 tag 講不出「使用者拿到了這件事」
// status.mjs 也 import 這一份：模組載入時還讀不到 SIGNED，用到時才組
const eligible = (state) => [SIGNED, '待審核', '待重審'].includes(state);

// 需求 → { tag, pending: [{ doc, sha }] }；不是 git repo 的根（夾具、匯出的樹）回 null，報告不受環境影響
export function releaseView(root, design, a, ov) {
  if (!root || !fs.existsSync(path.join(root, '.git'))) return null;
  const pattern = design.system ? design.system.releaseTags : '';
  const tags = git(root, ['tag', '--list', '--sort=creatordate', ...(pattern ? [pattern] : [])]);
  if (!tags) return null;
  const ref = mainRef(root) || 'HEAD';
  const order = new Map(tags.map((t, i) => [t, i]));
  const shaOf = new Map();
  const tagsOf = new Map();
  // 一份文檔的程式碼：它自己住的 step 所在的檔（引用別份的 step 算那一份的）
  const lastCommit = (x) => {
    if (shaOf.has(x.p.fullName)) return shaOf.get(x.p.fullName);
    const files = [...new Set(x.steps.filter((s) => !s.ref).map((s) => (s.hit ? s.hit.file : s.module)).filter(Boolean))];
    const sha = files.length ? ((git(root, ['log', '-1', '--format=%H', ref, '--', ...files]) || [])[0] || null) : null;
    shaOf.set(x.p.fullName, sha);
    return sha;
  };
  const containing = (sha) => {
    if (!tagsOf.has(sha)) tagsOf.set(sha, new Set((git(root, ['tag', '--contains', sha]) || []).filter((t) => order.has(t))));
    return tagsOf.get(sha);
  };
  const view = new Map();
  for (const q of ov.reqs) {
    if (!eligible(q.state)) { view.set(q.id, { eligible: false, tag: null, pending: [] }); continue; }
    // 這條需求用到的文檔：它的里程碑綁的每一份，與它們一路引用下去的每一份
    const names = new Set();
    const queue = q.ms.flatMap((m) => m.binds);
    while (queue.length) {
      const n = queue.shift();
      if (names.has(n) || !a.info.has(n)) continue;
      names.add(n);
      queue.push(...a.info.get(n).refs);
    }
    let common = null;
    const pending = [];
    for (const n of [...names].sort()) {
      const sha = lastCommit(a.info.get(n));
      const set = sha ? containing(sha) : new Set();
      if (!set.size) pending.push({ doc: n, sha });
      common = common === null ? new Set(set) : new Set([...common].filter((t) => set.has(t)));
    }
    const first = !pending.length && common && common.size ? [...common].sort((x, y) => order.get(x) - order.get(y))[0] : null;
    // 每份各自進過 tag、卻沒有一個 tag 同時帶齊（tag 打在不同的分支上）：算還沒上線，每一份都列
    if (!pending.length && !first) for (const n of names) pending.push({ doc: n, sha: shaOf.get(n) });
    view.set(q.id, { eligible: true, tag: first, pending });
  }
  view.pattern = pattern;
  view.ref = ref;
  view.tags = tags;
  return view;
}

// 報告與看板上同一個字
export function releaseWord(view, id) {
  const r = view ? view.get(id) : null;
  if (!r || !r.eligible) return '-';
  return r.tag || '未上線';
}

export const pendingText = (r) => r.pending.map((p) => `${p.doc}（${p.sha ? `最新的 commit ${p.sha.slice(0, 7)} 還沒進發布的 tag` : '程式碼還沒有 commit 進主線'}）`).join('、');

export function releaseReport(root, design, source, adapter, results) {
  const a = analyze(design, source, adapter, results);
  const ov = requirementView(design, a);
  const view = releaseView(root, design, a, ov);
  if (!view) return { text: '專案根目錄不是 git repo 的根：上線與否從 git tag 推，沒有 git 就講不出來', exitCode: 1 };
  const out = ['# devflow release'];
  out.push(`· 發布的 tag：${view.pattern ? `符合 \`${view.pattern}\` 的` : '每個 tag 都算（system.md「Constraint」沒有「發布」行），'}共 ${view.tags.length} 個；程式碼的最新 commit 從 ${view.ref} 讀`);
  out.push('');
  out.push('## 需求');
  if (!ov.reqs.length) out.push('- 沒有任何需求');
  else {
    out.push('| 需求 | 一句話 | 審核 | 上線 | 還沒進發布的 tag |', '|---|---|---|---|---|');
    for (const q of ov.reqs) {
      const r = view.get(q.id);
      const why = !r.eligible ? '證據還沒齊，不問上線' : r.pending.length ? pendingText(r) : '-';
      out.push(`| ${q.id} | ${q.title} | ${q.state} | ${releaseWord(view, q.id)} | ${why} |`);
    }
  }
  out.push('', '## 已驗收而還沒上線');
  const waiting = ov.reqs.filter((q) => q.state === SIGNED && view.get(q.id).pending.length);
  if (!waiting.length) out.push('- 無');
  for (const q of waiting) out.push(`- ${q.id} ${q.title}:${pendingText(view.get(q.id))}`);
  // 每個 tag 第一次帶上線的需求：需求現在這一版的程式碼最早進的那個 tag，新的在前
  out.push('', '## 每個發布帶上線的需求');
  const byTag = new Map();
  for (const q of ov.reqs) {
    const r = view.get(q.id);
    if (r.tag) byTag.set(r.tag, [...(byTag.get(r.tag) || []), q]);
  }
  const shipped = [...view.tags].reverse().filter((t) => byTag.has(t));
  if (!shipped.length) out.push('- 無');
  for (const t of shipped) out.push(`- ${t}:${byTag.get(t).map((q) => `${q.id} ${q.title}`).join('、')}`);
  return { text: out.join('\n'), exitCode: 0 };
}
