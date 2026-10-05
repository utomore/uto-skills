#!/usr/bin/env bash
# lawfulv2 的回歸：
# - docs：bin/scaffold.mjs 不給 --catalog，在空目錄只鋪文件層；鋪出來的檔案清單進 golden，再鋪一次全部是「已存在、沒動」；
#   兩份 SKILL.md 的 frontmatter 讀得成（description 裡沒有「冒號加空白」）。
# - blank：bin/scaffold.mjs 在空目錄鋪文件層加型錄第一格 → ruff、import-linter、pyright、四道檢查、pytest 全綠，
#   鋪出來的檔案清單進 golden（模板多一個檔、少一個檔都會紅）。
# - shop：一個領域、兩條 law、兩個入口的全綠樹。
# - broken：每一道紅各出現一次。
# - labels：bin/labels.mjs 對一個假的 gh 把標籤對到標籤表，計畫、--apply、--delete、中途失敗再重跑。
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
exit $fail
