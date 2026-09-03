#!/usr/bin/env bash
# run.sh — arch-audit 腳本的回歸測試。
#
# 為什麼要有它:這些腳本是整套流程的「有機器在查」那一半 —— 進度分母、編號撞號、
# Laws 四格、契約對帳全靠它們。而腳本自己原本沒有任何東西在查。
#
# 這套測試是修真實事故修出來的:抽共用解析器時,fixture 比對抓到三處**同名不同答案**
# 的解析器(section() 含不含標題行、frontmatter() 剝不剝引號、tableCells() 回 null 還是
# 陣列),以及一個「程式碼圍欄裡的假標題會把章節提前切斷」的靜默錯誤。這四個都不會拋
# 例外,只會讓兩支腳本對同一份檔案給出不同答案。
#
# 用法:
#   bash run.sh              比對 golden,有差異就印 diff 並以 1 收場
#   bash run.sh --update     重新產生 golden(**改動行為時才用**,並在 PR 裡說明為什麼變)
#
# Exit code:0 = 全部相同 / 1 = 有差異或有腳本崩潰
set -uo pipefail
cd "$(dirname "$0")"
SCRIPTS=../scripts
FX=fixtures
GOLDEN=golden
UPDATE=0
[[ "${1:-}" == "--update" ]] && UPDATE=1

fail=0
run() {
  local name=$1; shift
  local out exit_code
  out=$(cd "$FX" && node "../$@" 2>&1); exit_code=$?
  local body="$out"$'\n'"__exit__ $exit_code"
  if [[ $UPDATE == 1 ]]; then
    printf '%s\n' "$body" > "$GOLDEN/$name.out"
    echo "  更新 $name"
    return
  fi
  if [[ ! -f "$GOLDEN/$name.out" ]]; then
    echo "✗ $name  沒有 golden(先跑 --update)"; fail=1; return
  fi
  if diff -q "$GOLDEN/$name.out" <(printf '%s\n' "$body") >/dev/null; then
    echo "✓ $name"
  else
    echo "✗ $name"
    diff "$GOLDEN/$name.out" <(printf '%s\n' "$body") | head -20
    fail=1
  fi
}

echo "=== fixture 回歸(輸出與 exit code 都要相同)==="
run id-map-proj      "$SCRIPTS/id-map.mjs" design
run id-map-legend    "$SCRIPTS/id-map.mjs"
run scan-inventory   "$SCRIPTS/scan-status.mjs" design
run scan-subsys      "$SCRIPTS/scan-status.mjs" design --subsys auth
run scan-doc-feature "$SCRIPTS/scan-status.mjs" design --doc F001
run scan-doc-contract "$SCRIPTS/scan-status.mjs" design --doc G-C001
run scan-doc-missing "$SCRIPTS/scan-status.mjs" design --doc F999
run scan-file-hit    "$SCRIPTS/scan-status.mjs" design --file src/Auth/Login.hs
run scan-file-miss   "$SCRIPTS/scan-status.mjs" design --file src/Web/Api.hs
run scan-bad-flag    "$SCRIPTS/scan-status.mjs" design --bogus
run lint-ids         "$SCRIPTS/lint-ids.mjs" design
run lint-laws        "$SCRIPTS/lint-laws.mjs" design
run doc-section-list "$SCRIPTS/doc-section.mjs" ../../_shared/doc-lifecycle.md --list
run cross-clean      "$SCRIPTS/lint-cross-spec.mjs" design
run cross-conflict   "$SCRIPTS/lint-cross-spec.mjs" cross
run cross-subsys     "$SCRIPTS/lint-cross-spec.mjs" cross --subsys pay
run cross-docs       "$SCRIPTS/lint-cross-spec.mjs" cross --docs F001,F002
run cross-bad-flag   "$SCRIPTS/lint-cross-spec.mjs" cross --bogus
run laws-skeleton-ok "$SCRIPTS/lint-laws.mjs" cross --skeleton cross
run laws-skeleton-drift "$SCRIPTS/lint-laws.mjs" drift --skeleton drift

echo
echo "=== 只驗 exit code,不比對輸出 ==="
echo "(前四項的輸出隨文檔改動而變;scan-ids 會把**當前分支名**印進輸出 ——"
echo " 釘死 golden 的話,任何人在別的分支上跑都會紅,那是雜訊不是回歸)"
for check in \
  "lint-ids       $SCRIPTS/lint-ids.mjs ../.." \
  "lint-laws      $SCRIPTS/lint-laws.mjs ../.." \
  "節名檢查        $SCRIPTS/doc-section.mjs --verify ../../.." \
  "指令檢查        $SCRIPTS/lint-commands.mjs ../../.." \
  "scan-ids       $SCRIPTS/scan-ids.mjs fixtures/design"
do
  set -- $check; name=$1; shift
  if node "$@" >/dev/null 2>&1; then echo "✓ $name"; else echo "✗ $name(exit $?)"; fail=1; fi
done

echo
echo "=== scan-ids --claim:配號 + 建檔(在暫存副本上跑,不動 fixtures)==="
CLAIM_TMP=$(mktemp -d)
cp -R "$FX/design" "$CLAIM_TMP/.design"
# 配一個號,然後用 scan-status 反查同一份文檔:查得到就代表 --claim 建出來的 frontmatter
# 真的合規(id 與檔名一致、欄位讀得出來)。這兩支腳本對「一份文檔長什麼樣」必須是同一個約定。
if node "$SCRIPTS/scan-ids.mjs" "$CLAIM_TMP/.design" --claim auth/B --slug claim-smoke >/dev/null 2>&1 &&
   node "$SCRIPTS/scan-status.mjs" "$CLAIM_TMP/.design" --doc auth/B001-claim-smoke >/dev/null 2>&1; then
  echo "✓ scan-ids --claim → scan-status --doc 查得到"
else
  echo "✗ scan-ids --claim(配出來的檔案 scan-status 查不到,兩支腳本的 frontmatter 約定分岔了)"; fail=1
fi
# --claim 剛建出來的 F 文檔,design.md 的功能規劃還沒認領它 —— 這是 --claim 的正常後續狀態,
# 盤點模式必須把它印成提示,而不是在算這條提示的時候自己炸掉。
node "$SCRIPTS/scan-ids.mjs" "$CLAIM_TMP/.design" --claim auth/F --slug claim-orphan >/dev/null 2>&1
# 盤點模式有發現就以 1 收場,所以先接住輸出再判斷(pipefail 下直接接管線會被那個 1 蓋掉)
orphan_out=$(node "$SCRIPTS/scan-status.mjs" "$CLAIM_TMP/.design" 2>&1 || true)
if grep -q "沒有出現在 auth/design.md 的功能規劃裡" <<<"$orphan_out"; then
  echo "✓ 盤點模式認得功能規劃還沒認領的 feature 文檔"
else
  echo "✗ 盤點模式碰到功能規劃沒認領的 feature 文檔(--claim 的正常後續)"; fail=1
fi
rm -rf "$CLAIM_TMP"

echo
echo "=== 每支腳本都要吃 --help ==="
for f in "$SCRIPTS"/*.mjs; do
  b=$(basename "$f")
  [[ $b == _* ]] && continue   # _ 開頭是只給 import 的模組,不可執行
  if node "$f" --help >/dev/null 2>&1; then echo "✓ $b --help"; else echo "✗ $b --help"; fail=1; fi
done

echo
[[ $fail == 0 ]] && echo "全部通過。" || echo "有失敗項目。行為是刻意改的話,跑 bash run.sh --update 並在 PR 說明為什麼變。"
exit $fail
