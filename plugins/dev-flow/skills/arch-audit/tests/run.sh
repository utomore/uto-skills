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
run scan-inventory   "$SCRIPTS/scan-status.mjs" design --today 2026-09-04
# 盤點模式預設只列未完成:--all 是唯一看得到已完成文檔的入口,兩種都釘
run scan-inventory-all "$SCRIPTS/scan-status.mjs" design --today 2026-09-04 --all
run scan-subsys      "$SCRIPTS/scan-status.mjs" design --today 2026-09-04 --subsys auth
run scan-doc-feature "$SCRIPTS/scan-status.mjs" design --today 2026-09-04 --doc F001
run scan-doc-contract "$SCRIPTS/scan-status.mjs" design --today 2026-09-04 --doc G-C001
# G-F(跨子系統核心功能:分工表、等分工 F)與 planned 的 E(擴充功能:非核心判準、不擋階段)各釘一份
run scan-doc-global  "$SCRIPTS/scan-status.mjs" design --today 2026-09-04 --doc G-F001
run scan-doc-enhance "$SCRIPTS/scan-status.mjs" design --today 2026-09-04 --doc auth/E001
run scan-doc-missing "$SCRIPTS/scan-status.mjs" design --today 2026-09-04 --doc F999
run scan-file-hit    "$SCRIPTS/scan-status.mjs" design --today 2026-09-04 --file src/Auth/Login.hs
run scan-file-miss   "$SCRIPTS/scan-status.mjs" design --today 2026-09-04 --file src/Web/Api.hs
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
run spikes-clean     "$SCRIPTS/lint-spikes.mjs" cross --design cross
run spikes-bad       "$SCRIPTS/lint-spikes.mjs" spike
run trace-ok         "$SCRIPTS/lint-laws-traceability.mjs" trace/ok --tests trace/ok/tests
run trace-bad        "$SCRIPTS/lint-laws-traceability.mjs" trace/bad --tests trace/bad/tests
run trace-no-tests   "$SCRIPTS/lint-laws-traceability.mjs" trace/ok --tests trace/ok/nope

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
# --claim 剛建出來的 F 文檔是 planned:有 `## 契約`(六欄空著)、沒有 `## Laws`。
# 那是本流程的正常起點,盤點模式必須把它讀成「契約待補」的提示,而不是結構不合規的紅燈。
node "$SCRIPTS/scan-ids.mjs" "$CLAIM_TMP/.design" --claim auth/F --slug claim-planned >/dev/null 2>&1
# 盤點模式有發現就以 1 收場,所以先接住輸出再判斷(pipefail 下直接接管線會被那個 1 蓋掉)
claim_out=$(node "$SCRIPTS/scan-status.mjs" "$CLAIM_TMP/.design" 2>&1 || true)
if grep -q "claim-planned.*「## 契約」還缺" <<<"$claim_out" && ! grep -q "claim-planned.*沒有「## 契約」" <<<"$claim_out"; then
  echo "✓ --claim 建出來的 feature 是合規的 planned(契約待補只算提示)"
else
  echo "✗ --claim 建出來的 feature 盤點模式讀不對(planned 的骨架應該有 ## 契約)"; fail=1
fi
# SPK 的配號要**同一個動作**建出兩樣東西:.design/spikes/ 的文檔與同名的程式碼資料夾(附 README)。
# 少建一樣,lint-spikes 就會把它報成「沒有紀錄的實驗」或「open 卻沒有程式碼」—— 那正是生命週期規則要防的。
node "$SCRIPTS/scan-ids.mjs" "$CLAIM_TMP/.design" --claim SPK --slug claim-spike >/dev/null 2>&1
# fixtures/design 本身就帶一份 open 的 spike(SPK-002,沒有資料夾,盤點 golden 要它),所以 lint-spikes 在這個
# 副本上不會全綠 —— 判準改成「它的輸出一個字都沒提到剛配的那份」,而不是 exit 0。
if [[ -f "$CLAIM_TMP/.design/spikes/SPK-003-claim-spike.md" && -f "$CLAIM_TMP/spike/SPK-003-claim-spike/README.md" && -f "$CLAIM_TMP/spike/README.md" ]] &&
   ! node "$SCRIPTS/lint-spikes.mjs" "$CLAIM_TMP" 2>&1 | grep -q "claim-spike"; then
  echo "✓ scan-ids --claim SPK → 文檔與 spike/ 資料夾同時建出,lint-spikes 乾淨"
else
  echo "✗ scan-ids --claim SPK(文檔或程式碼資料夾少建了一樣,或 lint-spikes 不認得它建出來的東西)"; fail=1
fi
rm -rf "$CLAIM_TMP"

echo
echo "=== spike-close:結案刪資料夾的五道關(在暫存 git repo 上跑)==="
# 刪東西的腳本要在真的 git repo 裡驗:未結案不准刪、sha 沒記不准刪、都過了才刪、刪完 spike/ 根層還在。
CLOSE_TMP=$(mktemp -d)
(
  cd "$CLOSE_TMP" && git init -q && git config user.email t@t && git config user.name t && mkdir .design &&
  printf -- '---\nid: system\ntype: system\ntitle: t\ndescription: x\nstatus: active\nmode: greenfield\ncreated: 2026-09-04\nupdated: 2026-09-04\nsubsystems: []\n---\n# t\n' > .design/system.md &&
  node "$OLDPWD/$SCRIPTS/scan-ids.mjs" .design --claim SPK --slug store >/dev/null 2>&1 &&
  echo 'x = 1' > spike/SPK-001-store/main.py && git add -A && git commit -qm "spike: SPK-001-store RND-1"
) >/dev/null 2>&1
SC="$SCRIPTS/spike-close.mjs"
if ! node "$SC" SPK-001 --design "$CLOSE_TMP/.design" --apply >/dev/null 2>&1 && [[ -f "$CLOSE_TMP/spike/SPK-001-store/main.py" ]]; then
  echo "✓ 未結案(status: open)不准刪,一個檔都沒動"
else
  echo "✗ spike-close 在文檔還是 open 時刪了東西,或沒有以 1 收場"; fail=1
fi
sha=$(git -C "$CLOSE_TMP" rev-parse --short HEAD)
sed -i.bak "s/^status: open/status: concluded/; s/^verdict:.*/verdict: feasible/; s/^feeds: \[\].*/feeds: [ADR-001-x]/" "$CLOSE_TMP/.design/spikes/SPK-001-store.md"
if ! node "$SC" SPK-001 --design "$CLOSE_TMP/.design" --apply >/dev/null 2>&1 && [[ -f "$CLOSE_TMP/spike/SPK-001-store/main.py" ]]; then
  echo "✓ 沒記 sha 不准刪(撈不回來的東西不能刪)"
else
  echo "✗ spike-close 在文檔沒記 sha 時刪了東西"; fail=1
fi
sed -i.bak "s/^- sha:.*/- sha:$sha/" "$CLOSE_TMP/.design/spikes/SPK-001-store.md"
# 記了 sha 之後又改了程式碼並 commit(沒開新一輪):sha 撈回來的是舊版,不准刪
( cd "$CLOSE_TMP" && echo 'x = 2' > spike/SPK-001-store/main.py && git add -- spike && git commit -qm "後來又改了" ) >/dev/null 2>&1
if ! node "$SC" SPK-001 --design "$CLOSE_TMP/.design" --apply >/dev/null 2>&1 && [[ -f "$CLOSE_TMP/spike/SPK-001-store/main.py" ]]; then
  echo "✓ sha 裡的資料夾跟現在不一樣(記了 sha 之後又改過)不准刪"
else
  echo "✗ spike-close 在 sha 過期時刪了東西 —— 撈回來的會是舊版"; fail=1
fi
sha=$(git -C "$CLOSE_TMP" rev-parse --short HEAD)
sed -i.bak "s/^- sha:.*/- sha:$sha/" "$CLOSE_TMP/.design/spikes/SPK-001-store.md"
if node "$SC" SPK-001 --design "$CLOSE_TMP/.design" >/dev/null 2>&1 && [[ -f "$CLOSE_TMP/spike/SPK-001-store/main.py" ]] &&
   node "$SC" SPK-001-store --design "$CLOSE_TMP/.design" --apply >/dev/null 2>&1 &&
   [[ ! -e "$CLOSE_TMP/spike/SPK-001-store" && -f "$CLOSE_TMP/spike/README.md" ]]; then
  echo "✓ 五道關都過:dry-run 不動、--apply 只刪那一個資料夾,spike/ 根層還在"
else
  echo "✗ spike-close 的 dry-run 動了東西、--apply 沒刪掉,或連 spike/ 根層一起刪了"; fail=1
fi
rm -rf "$CLOSE_TMP"

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
