// section <file> <節>…:印出點名的 ## 節;--verify 只檢查節在不在。
import fs from 'node:fs';
import { parseFrontmatter, sections } from '../markdown.mjs';

export function sectionCommand(file, titles, { verify = false, display = file } = {}) {
  if (!fs.existsSync(file)) return { text: `找不到 ${display}`, exitCode: 1 };
  const { body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  const secs = sections(body).filter((s) => s.level === 2);
  const out = [];
  let missing = 0;
  for (const t of titles) {
    const exact = secs.filter((s) => s.title === t);
    const fuzzy = exact.length ? exact : secs.filter((s) => s.title.includes(t));
    if (fuzzy.length !== 1) {
      missing++;
      out.push(fuzzy.length ? `「${t}」對到 ${fuzzy.length} 節:${fuzzy.map((s) => s.title).join('、')}` : `「${t}」在 ${display} 裡沒有這一節`);
      continue;
    }
    if (verify) out.push(`✓ ${fuzzy[0].title}`);
    else out.push(`## ${fuzzy[0].title}\n${fuzzy[0].lines.join('\n').trim()}`);
  }
  return { text: out.join('\n\n'), exitCode: missing ? 1 : 0 };
}
