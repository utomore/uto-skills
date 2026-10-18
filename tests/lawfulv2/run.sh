#!/usr/bin/env bash
# lawfulv2 的回歸：
# - docs：bin/scaffold.mjs 不給 --catalog，在空目錄只鋪文件層；鋪出來的檔案清單進 golden，再鋪一次全部是「已存在、沒動」；
#   兩份 SKILL.md 的 frontmatter 讀得成（description 裡沒有「冒號加空白」）。
# - blank：bin/scaffold.mjs 在空目錄鋪文件層加型錄第一格 → ruff、import-linter、pyright、四道檢查、pytest 全綠，
#   鋪出來的檔案清單進 golden（模板多一個檔、少一個檔都會紅）。
# - shop：一個領域、兩條 law、兩個入口的全綠樹。
# - broken：每一道紅各出現一次。
# - labels：bin/labels.mjs 對一個假的 gh 把標籤對到標籤表，計畫、--apply、--delete、中途失敗再重跑。
# - retro：bin/retro.mjs 對手造的對話紀錄夾具與暫存目錄裡造的小 repo，抽出使用者訊息、打斷、工具失敗、拒絕、PR、合併與合併之後的補修，
#   另驗 --since 的邊界、壞掉的行、不是 git repo、對話紀錄目錄不存在、不認得的參數。
# shop 與 broken 先複製到暫存目錄，再把型錄的腳本複製進它的 scripts/（夾具自己的 _layout.py 留著）。
# 輸出與 golden/<夾具>.txt 比對，行為刻意改了才 --update。
set -u
cd "$(dirname "$0")"
here=$(pwd)
plugin="$here/../../plugins/lawfulv2"
catalog="$plugin/catalog/py-ports-adapters/scripts"
update=0
[ "${1:-}" = "--update" ] && update=1
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8 PYTHONDONTWRITEBYTECODE=1
with="--with fastapi --with typer --with pytest --with ruff --with import-linter --with pyright"
run() { uv run -q --no-project $with "$@" 2>&1 | sed 's/\r$//'; return "${PIPESTATUS[0]}"; }
checks() {
  for s in check_laws check_glossary check_errors check_entries; do
    echo "## $s"; run python -m scripts.$s; echo "exit $?"
  done
  echo "## pytest"
  run python -m pytest -q -p no:cacheprovider > /dev/null; echo "exit $?"
}
compare() {
  local fx=$1 out=$2
  if [ "$update" = 1 ]; then
    mkdir -p golden; cp "$out" "golden/$fx.txt"; echo "updated golden/$fx.txt"
  elif ! diff -u --strip-trailing-cr "golden/$fx.txt" "$out"; then
    echo "FAIL $fx"; fail=1
  else
    echo "ok $fx"
  fi
}
fail=0

# docs：只鋪文件層
out="$tmp/docs.txt"
(
  cd "$tmp"
  echo "## scaffold（只有文件層）"
  node "$plugin/bin/scaffold.mjs" --target docs --project docs --tagline "一句話" --date 2026-09-28
  echo "exit $?"
  echo "## 佔位符都換掉了"
  grep -rn -E '__(PROJECT|TAGLINE|PACKAGE|OWNER)__|<YYYY-MM-DD>' docs
  echo "exit $?"
  echo "## 再鋪一次"
  node "$plugin/bin/scaffold.mjs" --target docs --project docs --tagline "一句話" --date 2026-09-28 | grep -E '^# '
  echo "## 參數"
  node "$plugin/bin/scaffold.mjs" --target docs --project docs --tagline "一句話" --package docs 2>&1 | head -1
  node "$plugin/bin/scaffold.mjs" --target docs --project docs --tagline "一句話" --catalog py-ports-adapters 2>&1 | head -1
  node "$plugin/bin/scaffold.mjs" --target docs --project docs --tagline "一句話" --catalog nothing --package docs --owner someone 2>&1 | head -1
  echo "## SKILL.md 的 frontmatter"
  for f in "$plugin"/skills/*/SKILL.md; do
    name=$(basename "$(dirname "$f")")
    if grep -m1 '^description: ' "$f" | sed 's/^description: //' | grep -q ': '; then echo "$name：description 裡有冒號加空白"; else echo "$name ok"; fi
  done
) 2>&1 | sed 's/\r$//' > "$out"
compare docs "$out"

# blank：文件層加型錄第一格鋪出來的空框架
work="$tmp/blank"
out="$tmp/blank.txt"
(
  echo "## scaffold"
  cd "$tmp"
  node "$plugin/bin/scaffold.mjs" --target blank --catalog py-ports-adapters --package blank --project blank --tagline "一句話" --owner someone --date 2026-09-28
  echo "exit ${PIPESTATUS[0]}"
  cd "$work"
  export PYTHONPATH=src
  echo "## ruff check"; run ruff check; echo "exit $?"
  echo "## ruff format"; run ruff format --check; echo "exit $?"
  echo "## lint-imports"; run lint-imports; echo "exit $?"
  echo "## pyright"; run pyright | grep -E '^[0-9]+ errors?' ; echo "exit ${PIPESTATUS[0]}"
  checks
) > "$out"
compare blank "$out"

for fx in shop broken; do
  work="$tmp/$fx"
  cp -r "fixtures/$fx" "$work"
  for f in "$catalog"/*; do
    case "$(basename "$f")" in _layout.py|__pycache__) ;; *) cp "$f" "$work/scripts/" ;; esac
  done
  out="$tmp/$fx.txt"
  (
    cd "$work"; export PYTHONPATH=src; checks
  ) > "$out"
  compare "$fx" "$out"
done

# labels：bin/labels.mjs 對一個假的 gh，標籤存在暫存目錄的一個 JSON 檔
out="$tmp/labels.txt"
(
  export LAWFULV2_GH="$here/fixtures/labels/fake_gh.mjs" FAKE_GH_STATE="$tmp/labels.json" FAKE_GH_LOG="$tmp/gh.log"
  labels() { node "$plugin/bin/labels.mjs" "$@" 2>&1 | sed 's/\r$//'; echo "exit ${PIPESTATUS[0]}"; }
  ghlog() { echo "# gh 跑了"; sed 's/^/  /' "$FAKE_GH_LOG"; : > "$FAKE_GH_LOG"; }
  names() { node -e 'for (const l of JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))) console.log(`  ${l.name} ${l.color} ${l.description}`)' "$FAKE_GH_STATE"; }
  : > "$FAKE_GH_LOG"

  echo "## --help"; labels --help
  echo "## 標籤表與 SKILL.md 的表一致"
  node "$plugin/bin/labels.mjs" --help 2>&1 | sed 's/\r$//' | sed -n '/^標籤表：/,$p' | tail -n +2 | while read -r name desc; do
    grep -q -F "| \`$name\` | $desc |" "$plugin/skills/labels/SKILL.md" || echo "SKILL.md 少了 $name"
  done
  echo "exit 0"

  # fresh：GitHub 替新 repo 建的九個標籤
  cp fixtures/labels/fresh.json "$FAKE_GH_STATE"
  echo "## fresh：計畫"; labels; ghlog
  echo "## fresh：--delete 表裡的"; labels --delete bug
  echo "## fresh：--delete 會改名的"; labels --delete enhancement
  echo "## fresh：--delete 沒有的"; labels --delete nothing
  echo "## fresh：讀標籤失敗"; FAKE_GH_FAIL=list labels
  echo "## fresh：--apply 中途失敗"; FAKE_GH_FAIL=refactor labels --delete "good first issue" --delete invalid --apply; ghlog
  echo "## fresh：--apply 重跑"; labels --delete "good first issue" --delete invalid --apply; ghlog
  echo "## fresh：驗"; labels; ghlog; names

  # mixed：大小寫不同、顏色與說明不同、enhancement 與 feature 都在、有一個表以外的
  cp fixtures/labels/mixed.json "$FAKE_GH_STATE"
  echo "## mixed：計畫"; labels --repo someone/shop
  echo "## mixed：--apply"; labels --repo someone/shop --apply; ghlog
  echo "## mixed：驗"; labels --repo someone/shop; ghlog
) > "$out"
compare labels "$out"

# retro：bin/retro.mjs 對手造的對話紀錄夾具與暫存目錄裡造的小 repo；時間固定，暫存路徑換成固定字串
out="$tmp/retro.txt"
(
  export TZ=UTC
  repo="$tmp/retro-repo"
  mkdir -p "$repo" "$tmp/retro-plain"
  g() {
    GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 \
      GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.test GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.test \
      GIT_AUTHOR_DATE="$1T09:00:00+0000" GIT_COMMITTER_DATE="$1T09:00:00+0000" git -C "$repo" "${@:2}" > /dev/null 2>&1
  }
  g 2026-10-01 init -q -b main
  echo a > "$repo/a.txt"; echo b > "$repo/b.txt"; g 2026-10-01 add .; g 2026-10-01 commit -q -m "初始"
  # 期間開頭之前的一次合併，只當比對基準
  g 2026-10-05 checkout -q -b feat/pre
  echo b2 > "$repo/b.txt"; g 2026-10-05 commit -q -am "feat: 改 b"
  g 2026-10-05 checkout -q main
  g 2026-10-05 merge -q --no-ff feat/pre -m "Merge pull request #0 from x/feat/pre"
  echo b3 > "$repo/b.txt"; g 2026-10-11 commit -q -am "fix: 補修 b"
  g 2026-10-12 checkout -q -b feat/x
  echo a2 > "$repo/a.txt"; g 2026-10-12 commit -q -am "feat: 改 a"
  g 2026-10-12 checkout -q main
  echo e > "$repo/e.txt"; g 2026-10-12 add .; g 2026-10-12 commit -q -m "docs: 加 e"
  g 2026-10-13 merge -q --no-ff feat/x -m "Merge pull request #1 from x/feat/x"
  echo a3 > "$repo/a.txt"; echo d > "$repo/d.txt"; g 2026-10-14 add .; g 2026-10-14 commit -q -m "fix: 補修 a"
  # squash 合併：單一 parent，subject 結尾 (#數字)
  echo s > "$repo/s.txt"; g 2026-10-15 add .; g 2026-10-15 commit -q -m "feat: 加 s (#2)"
  echo e2 > "$repo/e.txt"; g 2026-10-16 commit -q -am "docs: 改 e"
  echo s2 > "$repo/s.txt"; g 2026-10-16 commit -q -am "fix: 補修 s"

  real=$(cygpath -w "$repo" 2>/dev/null || echo "$repo")
  folder=$(printf '%s' "$real" | sed 's/[^a-zA-Z0-9]/-/g')
  retro() {
    node "$plugin/bin/retro.mjs" "$@" 2>&1 | sed -e 's/\r$//' -e "s#$folder#FOLDER#g" -e "s#$tmp#TMP#g" \
      -e "s#$(cygpath -m "$tmp" 2>/dev/null || echo "$tmp")#TMP#g"
    echo "exit ${PIPESTATUS[0]}"
  }
  fx=fixtures/retro/transcripts

  echo "## --help"; retro --help
  echo "## 夾具加小 repo"; retro --since 2026-10-11 --project "$repo" --transcripts "$fx"
  echo "## --since 在 10-12：起始日之前的紀錄與 commit 被排除"; retro --since 2026-10-12 --project "$repo" --transcripts "$fx"
  echo "## --since 把整個夾具排除"; retro --since 2026-10-20 --project "$repo" --transcripts "$fx"
  echo "## 不是 git repo"; retro --since 2026-10-11 --project "$tmp/retro-plain" --transcripts "$fx" | sed -n '/^## git/,$p'
  echo "## 對話紀錄目錄不存在"; retro --since 2026-10-11 --project "$repo" --transcripts "$tmp/nothing" | head -4
  echo "## --ref 不存在"; retro --since 2026-10-11 --project "$repo" --transcripts "$fx" --ref nothing | sed -n '/^## git/,$p'
  echo "## 預設的對話紀錄目錄由 --project 推算"
  mkdir -p "$tmp/cfg/projects/$folder"; cp -r fixtures/retro/transcripts/. "$tmp/cfg/projects/$folder/"
  CLAUDE_CONFIG_DIR="$tmp/cfg" retro --since 2026-10-11 --project "$repo" | head -3
  echo "## 不認得的參數"; retro --nothing | head -2
  echo "## --since 格式錯"; retro --since yesterday | head -2
  echo "## --since 不是有效日期"; retro --since 2026-13-45 | head -2
) > "$out"
compare retro "$out"
exit $fail
