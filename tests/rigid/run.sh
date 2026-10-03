#!/usr/bin/env bash
# rigid 的回歸：
# - blank：bin/scaffold.mjs 在空目錄鋪一次型錄第一格 → ruff、import-linter、pyright、五道檢查、pytest 全綠，
#   鋪出來的檔案清單進 golden（模板多一個檔、少一個檔都會紅）。
# - shop：一個領域、一條 REQ、兩條 law、兩個入口的全綠樹。
# - broken：每一道紅各出現一次。
# - labels：bin/labels.mjs 對一個假的 gh 把標籤對到標籤表，計畫、--apply、--delete、中途失敗再重跑。
# shop 與 broken 先複製到暫存目錄，再把型錄的腳本複製進它的 scripts/（夾具自己的 _layout.py 留著）。
# 輸出與 golden/<夾具>.txt 比對，行為刻意改了才 --update。
set -u
cd "$(dirname "$0")"
here=$(pwd)
plugin="$here/../../plugins/rigid"
catalog="$plugin/catalog/py-ports-adapters/scripts"
update=0
[ "${1:-}" = "--update" ] && update=1
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8 PYTHONDONTWRITEBYTECODE=1
with="--with fastapi --with typer --with pytest --with ruff --with import-linter --with pyright"
run() { uv run -q --no-project $with "$@" 2>&1 | sed 's/\r$//'; return "${PIPESTATUS[0]}"; }
checks() {
  for s in check_laws check_glossary check_errors check_entries check_evidence; do
    echo "## $s"; run python -m scripts.$s; echo "exit $?"
  done
  echo "## report_progress"; run python -m scripts.report_progress; echo "exit $?"
  echo "## report_progress M1"; run python -m scripts.report_progress M1; echo "exit $?"
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

# blank：scaffold 鋪出來的空框架
work="$tmp/blank"
out="$tmp/blank.txt"
(
  echo "## scaffold"
  cd "$tmp"
  node "$plugin/bin/scaffold.mjs" --target blank --package blank --project blank --tagline "一句話" --owner someone --date 2026-09-28
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

py=$(uv run -q --no-project python -c 'import sys; print(sys.executable)' | sed 's/\r$//')
review=$(command -v cygpath >/dev/null && cygpath -m "$here/fixtures/review" || echo "$here/fixtures/review")
for fx in shop broken; do
  work="$tmp/$fx"
  cp -r "fixtures/$fx" "$work"
  for f in "$catalog"/*; do
    case "$(basename "$f")" in _layout.py|__pycache__) ;; *) cp "$f" "$work/scripts/" ;; esac
  done
  out="$tmp/$fx.txt"
  (
    cd "$work"; export PYTHONPATH=src; checks
    if [ "$fx" = shop ]; then
      # ai_review：提示詞裡有 ADR-002 的分層表與標了行號的 diff、沒有 src 以外的檔；假模型回三個發現，只留落在新增行上的那一個
      echo "## ai_review prompt"
      run python -m scripts.ai_review prompt --diff "$here/fixtures/review/diff.patch" | grep -n -E '^\| 層 |^\| `(domains|application|platform|api)|^ +[0-9]+\|\+|docs/plan|^diff --git'
      echo "exit ${PIPESTATUS[0]}"
      echo "## ai_review run"
      run python -m scripts.ai_review run --diff "$here/fixtures/review/diff.patch" --cmd "\"$py\" \"$review/fake_llm.py\""; echo "exit $?"
      echo "## ai_review run (no src change)"
      run python -m scripts.ai_review run --diff "$here/fixtures/review/docs-only.patch" --cmd "false"; echo "exit $?"
      echo "## ai_review run (cmd fails)"
      run python -m scripts.ai_review run --diff "$here/fixtures/review/diff.patch" --cmd "\"$py\" -c \"import sys; sys.exit(3)\""; echo "exit $?"
    fi
  ) > "$out"
  compare "$fx" "$out"
done

# labels：bin/labels.mjs 對一個假的 gh，標籤存在暫存目錄的一個 JSON 檔
out="$tmp/labels.txt"
(
  export RIGID_GH="$here/fixtures/labels/fake_gh.mjs" FAKE_GH_STATE="$tmp/labels.json" FAKE_GH_LOG="$tmp/gh.log"
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
