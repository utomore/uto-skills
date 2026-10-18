#!/usr/bin/env node
// lawfulv2 的回顧訊號：把一段期間的 Claude Code 對話紀錄與 git 歷史壓成一份短清單。
// 只抽訊號，不歸類、不判斷是不是錯；只讀不寫。
//
// node retro.mjs [--since <YYYY-MM-DD>] [--project <dir>] [--transcripts <dir>] [--ref <git ref>]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function usage(msg) {
  if (msg) console.error(`retro: ${msg}`);
  console.error(
    '用法：node retro.mjs [--since <YYYY-MM-DD>] [--project <dir>] [--transcripts <dir>] [--ref <git ref>]\n' +
      '  --since       只收這一天 00:00（本地時間）以後的紀錄與 commit，預設是今天往前 7 天\n' +
      '  --project     專案目錄，git 指令在這裡跑，預設是目前目錄\n' +
      '  --transcripts 對話紀錄目錄，預設是 <CLAUDE_CONFIG_DIR 或 ~/.claude>/projects/<專案的絕對路徑，非英數字元換成 ->\n' +
      '  --ref         看哪一條線的 git 歷史，預設依序試 origin/HEAD、main、master\n' +
      '只讀不寫；抽出使用者訊息、打斷、工具失敗、拒絕、session 對應的 PR、合併與合併之後的 commit，不歸類。',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  const names = { '--since': 'since', '--project': 'project', '--transcripts': 'transcripts', '--ref': 'ref' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') usage();
    else if (names[a]) {
      const v = argv[++i];
      if (v === undefined) usage(`${a} 少了值`);
      out[names[a]] = v;
    } else usage(`不認得的參數 ${a}`);
  }
  return out;
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (ms) => {
  const d = new Date(ms);
  return `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const slash = (p) => p.replace(/\\/g, '/');

function squeeze(s, n) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  const cs = Array.from(t);
  return cs.length > n ? cs.slice(0, n).join('') + '…' : t;
}

const args = parseArgs(process.argv.slice(2));
const today = new Date();
let sinceStr = args.since;
if (!sinceStr) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  sinceStr = ymd(d);
}
const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sinceStr);
if (!m) usage(`--since 要寫成 YYYY-MM-DD，收到 ${sinceStr}`);
const sinceDate = new Date(+m[1], +m[2] - 1, +m[3]);
if (ymd(sinceDate) !== sinceStr) usage(`--since 不是有效的日期：${sinceStr}`);
const sinceMs = sinceDate.getTime();
const project = path.resolve(args.project ?? '.');
const transcripts =
  args.transcripts ??
  slash(
    path.join(
      process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'),
      'projects',
      project.replace(/[^a-zA-Z0-9]/g, '-'),
    ),
  );

// ---- 對話紀錄 ----

let skipped = 0;

function readJsonl(file) {
  const recs = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r && typeof r === 'object') recs.push(r);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return recs;
}

const blocksOf = (c) => (Array.isArray(c) ? c : []);
const textOfResult = (c) =>
  typeof c === 'string'
    ? c
    : blocksOf(c)
        .filter((b) => b && b.type === 'text')
        .map((b) => b.text ?? '')
        .join('\n');

function inputSummary(name, input) {
  const i = input ?? {};
  if (name === 'Bash') return squeeze(i.command ?? '', 120);
  if (typeof i.file_path === 'string' && ['Edit', 'Write', 'Read', 'MultiEdit', 'NotebookEdit'].includes(name))
    return squeeze(i.file_path, 120);
  return squeeze(JSON.stringify(i), 120);
}

function stripReminders(s) {
  return s.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
}

const COMMAND_PREFIX = ['<command-name>', '<local-command-stdout>', '<local-command-caveat>', '<task-notification>'];

// isMain 為 false（subagent）時，使用者的文字是主 agent 的派工，不收。
function extract(file, isMain) {
  const recs = readJsonl(file);
  const uses = new Map();
  for (const r of recs)
    if (r.type === 'assistant')
      for (const b of blocksOf(r.message?.content))
        if (b && b.type === 'tool_use' && b.id) uses.set(b.id, { name: b.name ?? '不明', input: b.input });

  const res = { first: Infinity, count: 0, branch: '', prs: new Set(), messages: [], errors: [] };
  let prevText = '';
  recs.forEach((r, idx) => {
    if (isMain && typeof r.gitBranch === 'string' && r.gitBranch) res.branch = r.gitBranch;
    const ts = Date.parse(r.timestamp);
    if (r.type === 'pr-link') {
      if (isMain && r.prNumber != null && (Number.isNaN(ts) || ts >= sinceMs)) res.prs.add(Number(r.prNumber));
      return;
    }
    if (Number.isNaN(ts)) return;
    if (r.type === 'assistant') {
      const t = blocksOf(r.message?.content)
        .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('\n');
      if (t.trim()) prevText = t;
    }
    if (ts < sinceMs) return;
    res.count++;
    res.first = Math.min(res.first, ts);
    if (r.type !== 'user') return;

    const content = r.message?.content;
    const texts = [];
    if (typeof content === 'string') texts.push(content);
    else
      for (const b of blocksOf(content)) {
        if (!b) continue;
        if (b.type === 'text' && typeof b.text === 'string') texts.push(b.text);
        else if (b.type === 'tool_result' && b.is_error === true) {
          const body = textOfResult(b.content);
          const use = uses.get(b.tool_use_id) ?? { name: '不明', input: {} };
          const refused = body.includes("doesn't want to proceed");
          const lines = body.replace(/<\/?tool_use_error>/g, '').split('\n').filter((l) => l.trim());
          const firstLine = lines.find((l) => !/^Exit code \d+$/.test(l.trim())) ?? lines[0] ?? '';
          res.errors.push({
            ts,
            idx,
            refused,
            tool: use.name,
            input: inputSummary(use.name, use.input),
            err: squeeze(firstLine, 150),
          });
        }
      }
    // 壓縮後的接續摘要是 Claude Code 寫的，不是人的話
    if (!isMain || r.isMeta === true || r.isCompactSummary === true) return;
    for (const raw of texts) {
      if (typeof content === 'string' && COMMAND_PREFIX.some((p) => raw.trimStart().startsWith(p))) continue;
      const t = stripReminders(raw);
      if (!t || COMMAND_PREFIX.some((p) => t.startsWith(p))) continue;
      res.messages.push({
        ts,
        idx,
        interrupted: r.interruptedMessageId != null || t.startsWith('[Request interrupted by user'),
        text: squeeze(t, 300),
        prev: prevText ? squeeze(prevText, 150) : '',
      });
    }
  });
  return res;
}

function transcriptSection() {
  const lines = [`對話紀錄：${transcripts}`];
  if (!fs.existsSync(transcripts) || !fs.statSync(transcripts).isDirectory()) {
    lines.push('對話紀錄目錄不存在，略過這一段。');
    return lines;
  }
  const entries = fs.readdirSync(transcripts, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
  const sessions = [];
  let subCount = 0;
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
    const id = e.name.slice(0, -'.jsonl'.length);
    const main = extract(path.join(transcripts, e.name), true);
    const subs = [];
    const subDir = path.join(transcripts, id, 'subagents');
    if (fs.existsSync(subDir)) {
      const files = fs
        .readdirSync(subDir)
        .filter((f) => f.endsWith('.jsonl'))
        .sort();
      for (const f of files) {
        const base = f.slice(0, -'.jsonl'.length);
        let meta = {};
        try {
          meta = JSON.parse(fs.readFileSync(path.join(subDir, `${base}.meta.json`), 'utf8'));
        } catch {}
        const s = extract(path.join(subDir, f), false);
        if (s.count > 0) subs.push({ base, meta, ...s });
      }
    }
    if (main.count === 0 && subs.length === 0) continue;
    subCount += subs.length;
    const first = Math.min(main.first, ...subs.map((s) => s.first));
    sessions.push({ id, main, subs, first });
  }
  sessions.sort((a, b) => a.first - b.first || (a.id < b.id ? -1 : 1));
  lines.push(`session ${sessions.length} 個、subagent ${subCount} 個、略過 ${skipped} 行`);

  const byTime = (a, b) => a.ts - b.ts || a.idx - b.idx;
  for (const s of sessions) {
    lines.push('');
    const prs = [...s.main.prs].sort((a, b) => a - b);
    const branch = s.main.branch ? `分支 ${s.main.branch}` : '分支不明';
    const pr = prs.length ? `，PR ${prs.map((n) => `#${n}`).join('、')}` : '';
    lines.push(`## session ${s.id.slice(0, 8)}（${branch}${pr}）`);
    const msgs = [...s.main.messages].sort(byTime);
    if (msgs.length) {
      lines.push('### 使用者訊息');
      for (const x of msgs) {
        lines.push(`- ${hm(x.ts)} ${x.interrupted ? '[打斷] ' : ''}「${x.text}」`);
        if (x.prev) lines.push(`  前一則：「${x.prev}」`);
      }
    }
    const fails = s.main.errors.filter((e) => !e.refused).sort(byTime);
    if (fails.length) {
      lines.push('### 工具失敗');
      for (const e of fails) lines.push(`- ${hm(e.ts)} ${e.tool} \`${e.input}\` → ${e.err}`);
    }
    const refused = s.main.errors.filter((e) => e.refused).sort(byTime);
    if (refused.length) {
      lines.push('### 拒絕');
      for (const e of refused) lines.push(`- ${hm(e.ts)} ${e.tool} \`${e.input}\``);
    }
    for (const sub of [...s.subs].sort((a, b) => a.first - b.first || (a.base < b.base ? -1 : 1))) {
      if (!sub.errors.length) continue;
      lines.push(`### subagent ${sub.meta.description ?? sub.base}（${sub.meta.model ?? '模型不明'}）`);
      for (const e of [...sub.errors].sort(byTime))
        lines.push(
          e.refused
            ? `- ${hm(e.ts)} 拒絕 ${e.tool} \`${e.input}\``
            : `- ${hm(e.ts)} 工具失敗 ${e.tool} \`${e.input}\` → ${e.err}`,
        );
    }
  }
  return lines;
}

// ---- git ----

function git(gitArgs) {
  const r = spawnSync('git', gitArgs, {
    cwd: project,
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C', GIT_OPTIONAL_LOCKS: '0' },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) return { ok: false, out: '', err: `git 跑不起來（${r.error.code ?? r.error.message}）` };
  return { ok: r.status === 0, out: r.stdout, err: (r.stderr || '').trim().split('\n')[0] };
}

// 合併：多個 parent 的 commit，或主線上 subject 結尾是 (#數字) 的 squash／rebase 合併。
const isMergeLike = (parents, subject) => parents.trim().split(/\s+/).length > 1 || /\(#\d+\)\s*$/.test(subject);

function gitSection() {
  const inside = git(['rev-parse', '--git-dir']);
  if (!inside.ok) return ['## git', `讀不到 git 歷史：${inside.err || '不是 git repo'}`];
  const candidates = args.ref ? [args.ref] : ['origin/HEAD', 'main', 'master'];
  const ref = candidates.find((c) => git(['rev-parse', '--verify', '--quiet', `${c}^{commit}`]).ok);
  if (!ref) return ['## git', `讀不到 git 歷史：找不到 ref ${candidates.join('、')}`];
  const log = git([
    'log',
    '--first-parent',
    '--no-renames',
    '--reverse',
    `--since=${sinceStr} 00:00:00`,
    '--date=format-local:%Y-%m-%d',
    '--name-only',
    '--format=%x01%H%x02%P%x02%cd%x02%s',
    ref,
  ]);
  if (!log.ok) return ['## git', `讀不到 git 歷史：${log.err}`];
  const commits = log.out
    .split('\x01')
    .filter((c) => c.trim())
    .map((c) => {
      const nl = c.indexOf('\n');
      const [sha, parents, date, subject] = (nl < 0 ? c : c.slice(0, nl)).split('\x02');
      const files = (nl < 0 ? '' : c.slice(nl + 1)).split('\n').filter((l) => l.trim());
      return { sha: sha.slice(0, 7), full: sha, merge: isMergeLike(parents, subject), date, subject, files };
    });

  // 期間開頭之前最近的一次合併也當比對基準，不列進「合併」。
  const before = git(['log', '--first-parent', '-n', '200', `--before=${sinceStr} 00:00:00`, '--format=%H%x02%P%x02%s', ref]);
  let lastMerge = null;
  if (before.ok)
    for (const l of before.out.split('\n').filter((x) => x)) {
      const [h, p, subj] = l.split('\x02');
      if (isMergeLike(p, subj)) {
        lastMerge = { full: h, sha: h.slice(0, 7) };
        break;
      }
    }
  const merges = [];
  const direct = [];
  let nth = 0;
  const mergeFiles = new Map();
  for (const c of commits) {
    if (c.merge) {
      merges.push(c);
      lastMerge = c;
      nth = 0;
      continue;
    }
    let overlap = [];
    nth++;
    if (lastMerge) {
      if (!mergeFiles.has(lastMerge.full)) {
        const d = git(['diff', '--name-only', `${lastMerge.full}^`, lastMerge.full]);
        mergeFiles.set(lastMerge.full, new Set(d.ok ? d.out.split('\n').filter((l) => l.trim()) : []));
      }
      const set = mergeFiles.get(lastMerge.full);
      overlap = c.files.filter((f) => set.has(f)).sort();
    }
    direct.push({ ...c, after: lastMerge?.sha, nth, overlap });
  }
  const lines = [`## git ${ref}`];
  if (merges.length) {
    lines.push('### 合併');
    for (const c of merges) lines.push(`- ${c.sha} ${c.date} ${c.subject}`);
  }
  if (direct.length) {
    lines.push(`### 直接進 ${ref} 的 commit`);
    for (const c of direct)
      lines.push(
        `- ${c.sha} ${c.date} ${c.subject}` +
          (c.overlap.length ? `（合併 ${c.after} 之後第 ${c.nth} 個，重疊的檔：${c.overlap.join(', ')}）` : ''),
      );
  }
  return lines;
}

const out = [`# 回顧訊號：${sinceStr} 起`, ...transcriptSection(), '', ...gitSection()];
console.log(out.join('\n'));
