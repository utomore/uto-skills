#!/usr/bin/env bash
# rigid 的回歸：
# - blank：bin/scaffold.mjs 在空目錄鋪一次型錄第一格 → ruff、import-linter、pyright、五道檢查、pytest 全綠，
#   鋪出來的檔案清單進 golden（模板多一個檔、少一個檔都會紅）。
# - shop：一個領域、一條 REQ、兩條 law、兩個入口的全綠樹。
# - broken：每一道紅各出現一次。
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
  elif ! diff -u "golden/$fx.txt" "$out"; then
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
exit $fail
