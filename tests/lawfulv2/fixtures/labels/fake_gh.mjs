// 假的 gh：標籤存在 FAKE_GH_STATE 指到的 JSON 檔，只認 labels.mjs 用到的那幾道指令。
// 每一道會改東西的指令印一行到 FAKE_GH_LOG；`FAKE_GH_FAIL=<標籤>` 讓碰到那個標籤的指令失敗，`FAKE_GH_FAIL=list` 讓讀標籤失敗。
import fs from 'node:fs';

const argv = process.argv.slice(2);
const state = process.env.FAKE_GH_STATE;
const flag = (name) => {
  const i = argv.indexOf(name);
  return i < 0 ? undefined : argv[i + 1];
};
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

if (argv[0] === 'repo' && argv[1] === 'view') {
  console.log(argv[2] && !argv[2].startsWith('--') ? argv[2] : 'someone/blank');
  process.exit(0);
}
if (argv[0] !== 'label') fail(`fake gh: 不認得 ${argv.join(' ')}`);

const labels = JSON.parse(fs.readFileSync(state, 'utf8'));
if (argv[1] === 'list') {
  if (process.env.FAKE_GH_FAIL === 'list') fail('To get started with GitHub CLI, please run:  gh auth login');
  console.log(JSON.stringify(labels));
  process.exit(0);
}

const name = argv[2];
fs.appendFileSync(process.env.FAKE_GH_LOG, `gh ${argv.join(' ')}\n`);
if (process.env.FAKE_GH_FAIL === name) fail(`HTTP 403: Resource not accessible (${name})`);
const at = labels.findIndex((l) => l.name.toLowerCase() === name.toLowerCase());
if (argv[1] === 'create') {
  if (at >= 0) fail(`label with name "${name}" already exists`);
  labels.push({ name, color: flag('--color'), description: flag('--description') });
} else if (argv[1] === 'edit') {
  if (at < 0) fail(`label "${name}" not found`);
  labels[at] = {
    name: flag('--name') ?? labels[at].name,
    color: flag('--color') ?? labels[at].color,
    description: flag('--description') ?? labels[at].description,
  };
} else if (argv[1] === 'delete') {
  if (at < 0) fail(`label "${name}" not found`);
  if (!argv.includes('--yes')) fail('fake gh: delete 沒有 --yes');
  labels.splice(at, 1);
} else fail(`fake gh: 不認得 ${argv.join(' ')}`);
fs.writeFileSync(state, JSON.stringify(labels, null, 2) + '\n');
