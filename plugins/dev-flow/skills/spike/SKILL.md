---
name: spike
description: 可行性驗證(spike)— 讀原始碼答不出來、要跑了才知道的問題,先寫問題 / 判準 / timebox,再在專案根目錄的 sandbox spike/SPK-00x-<slug>/ 寫拋棄式程式碼驗證,結論寫進 .design/spikes/SPK-00x-<slug>.md 並用 feeds 指向下游文檔;結案即刪程式碼、sha 留在文檔。可多輪(RND-n)、可候選比較、可由編排者委派。觸發詞:spike、可行性驗證、試一下、驗證可不可行、PoC、prototype、原型、快速驗證、模型屋、demo 範本。Use when a design decision cannot be answered by reading code and needs throwaway experimental code with a recorded verdict.
user-invocable: true
---

# /spike — 可行性驗證

**讀了也答不出來、要跑了才知道**的問題,spike 是唯一合法的出口:替決策生產證據,自己不做決策。設計理由見 `docs/skill-authoring.md`「`/spike`」。

## 鐵律

1. **產出是結論,不是程式碼。** 結案時 `spike/SPK-00x-<slug>/` 刪掉,每輪 commit sha 留在文檔,要看用 `git show <sha>` 撈。open 期間產品程式碼與測試禁止 import 它、feature 的 `code-paths` 不得指進去;正式的東西一律從 spec 蓋
2. **寫程式碼之前先寫三樣東西**:要回答什麼、什麼結果算過、timebox。判定只依判準
3. **結論必須指向下游**:`feeds` 寫文檔全名(ADR 的被否決方案、`design.md` 的契約條目、feature 檔的「不可逆決定」)。空的或指不到的,腳本列為不一致
4. **spike 不改任何 `.design/` 文檔,自己的那份除外。** 改 spec 或契約走 `/spec-redesign`,進 ADR 走對應的 design skill

## 先讀什麼(**一批送出,不要一個一個開**)

`<S>` = 本 plugin 的 `skills/` 目錄,**整場對話只解析一次**(規則見 `../_shared/conventions.md`「腳本目錄」):
`dirname "$(dirname "$(find ~/.claude/plugins . -maxdepth 9 -type d -path '*dev-flow*/skills/arch-audit/scripts' 2>/dev/null | head -1)")"`

拿到 `<S>` 後,把下面**必讀**與成立的**條件式**項目放進**同一則訊息**一次讀完。**禁止讀一個、想一下、再讀下一個**。

| 讀什麼 | 為什麼 |
|---|---|
| `../_shared/conventions.md` | 核心慣例、腳本目錄、**跑東西的紀律** |
| `node "<S>/arch-audit/scripts/doc-section.mjs" ../_shared/doc-lifecycle.md 命名與編號規則 文檔引用格式 description "spike 文檔"` | 配號、引用寫法、spike 的 frontmatter。**不要整份讀** |

條件式:prompt 標明 `【委派模式】` → `../_shared/delegation.md`;要定位既有程式碼**且**專案有知識圖 → `../_shared/codegraph.md` + `codegraph-tools.md`;收尾 → `../_shared/anchor.md`(委派模式不讀)。

**不讀** `spec-roles.md`、`boundary-rules.md`、`testing-policy.md`、`contract-readiness.md`——spike 不設計契約、不寫測試、不做層級判斷。文檔版面在 `templates/spike.md`,步驟 1 建檔後照抄。

## 三種形態(同一份文檔、同一套規則)

| 形態 | 什麼時候 | 差別 |
|---|---|---|
| **單一問題** | 一個問題、一條做法 | 預設 |
| **多輪疊代** | 問題要分幾步答,或一個會一直長的 demo 範本(模型屋) | 同一份檔記 `RND-1`、`RND-2`…,**每輪各有自己的問題、判準、timebox**;沒有問題驅動的那一輪不准開 |
| **候選比較** | 同一個問題有兩條以上做法要比 | 各候選一個子資料夾 `spike/SPK-00x-<slug>/<候選>/`,結論多一張比較表;由編排者 fan out,規則在 `../_shared/orchestration.md`「派 spike 驗證」 |

**升格不是搬資料夾**:模型屋要變正式功能,`feeds` 指向那份 feature 檔,`/spec-design` 用 sha 把它當證據讀、寫出 spec,qa ∥ impl 從 spec 投影進正式原始碼樹。想長期留給人看的 demo 不是 spike,走 spec 進 `examples/` 之類的正式位置。

## 0. 定問題(先於一切)

1. **要回答什麼**:寫成「X 在 Y 條件下能不能 Z」的可判定形式;「看看 X 好不好用」不是問題
2. **判準**:什麼算 `feasible` / `infeasible` / `partial`,寫成**可觀察的數字或現象**(「10 萬筆 2 秒內回來」),不是「感覺夠快」
3. **timebox**:最多幾次嘗試(或多少時間)。到了就停,**沒答案本身是結論**(`partial`,寫為什麼答不出來)

先問一句:**真的要跑了才知道嗎?** 讀原始碼、文件、既有測試答得出來的不開 spike。

## 1. 配號並建檔(同一道指令,不准自己數資料夾)

```
node "<S>/arch-audit/scripts/scan-ids.mjs" .design --claim SPK --slug <kebab-slug>
```

它掃過所有分支與 worktree 配號,同時建 `.design/spikes/SPK-00x-<slug>.md`(骨架)與 `spike/SPK-00x-<slug>/`(附 README),印出**全名**(`SPK-003-storage-engine`,之後一律用全名)。打開 `templates/spike.md`,把步驟 0 填進 `## 問題` 與 `RND-1`,補 `description`。**委派模式跳過**:號、路徑、`RND-n` 由編排者指定。

**`spike/` 根層是常駐的共用 sandbox**(依賴檔、假資料、harness,不刪),只有 `SPK-00x-<slug>/` 那一層是一次性的。**第一次建 spike 時**立起來,之後不必重做:根層建依賴檔與 `.gitignore`(`.venv/`、`node_modules/`);`.gitattributes` 加 `spike/** linguist-vendored`;確認建置 / 測試設定**排除** `spike/`——這一項機器判不了,而 Haskell / Java / Rust 這類用模組名 import 的語言,`lint-spikes.mjs` 也看不到 import,**建置設定是它們唯一的防線**。

## 2. 寫程式碼(每一輪)

在 `spike/SPK-00x-<slug>/` 寫**最少能回答問題的程式碼**:

- **不追求品質,追求可判定**:沒有錯誤處理、抽象、測試都可以,但輸出要對得到判準(判準寫「2 秒內」就印秒數)
- **依賴不寫進專案的套件管理檔**,裝進 `spike/` 根層;非動專案自己的不可時先停下來確認
- **每輪結束 commit 一次、記一次**:`git add -- spike/SPK-00x-<slug> .design/spikes/SPK-00x-<slug>.md`(**寫路徑,不用 `-A`**),訊息 `spike: SPK-003-storage-engine RND-2`,再把 sha 填進 `RND-n`。**sha 是結案後撈回程式碼的唯一鑰匙**;記了 sha 又改程式碼就再開一輪

跑東西照 `conventions.md`「跑東西的紀律」:輸入沒變跑一次就夠,輸出留檔再看。

## 3. 判定

| 結果 | verdict |
|---|---|
| 判準全部達成 | `feasible` |
| 判準明確沒達成 | `infeasible` |
| timebox 用完答不出來、或只達成一部分 | `partial`,寫清楚哪一部分、為什麼 |

要不要再開一輪,互動模式由開發者定,委派模式記進回報由編排者定。

## 4. 結案(順序固定)

`## 結論` 四格填齊:verdict、一句話、**學到什麼**(程式碼結案就刪,三個月後只剩這一格)、餵給哪裡。然後:

1. 最後一輪的 sha 已填進 `RND-n`,且那個 commit 裡的資料夾就是現在這個(改過就再開一輪)
2. frontmatter:`status: concluded`、`verdict`、`feeds`(全名:`ADR-004-storage`、`auth/F003-session-list`、`G-C001-session#SessionToken`、`auth/design.md`)、`updated`
3. **刪程式碼資料夾——只准用腳本,不准手打 `git rm`,更不准 `rm -rf`**:

   ```
   node "<S>/arch-audit/scripts/spike-close.mjs" SPK-00x-<slug>            # dry-run:五道關與會刪的檔案清單
   node "<S>/arch-audit/scripts/spike-close.mjs" SPK-00x-<slug> --apply    # 都過才 git rm -r
   ```

   路徑由腳本從全名算;五道關(文檔已結案、路徑真的是 `spike/SPK-00x-<slug>/` 且在工作樹內、沒有未 commit 的東西、sha 裡的資料夾與現在一模一樣、只用 `git rm -r --`)任一關沒過就一個檔都不動。刪完它不 commit,由你連文檔一起 commit(`spike: SPK-003-storage-engine concluded`)
4. **下游由誰改,講清楚**:spec 或契約走 `/spec-redesign`,新 ADR 走 `/system-design` 更新模式,feature 檔的「不可逆決定」走 `/spec-design`。**你不改它們**,只在回報裡寫「哪一份、哪一格、寫什麼」
5. 不做了的標 `dropped`,一句話寫為什麼,第 1、3 步照做

驗收:`node "<S>/arch-audit/scripts/lint-spikes.mjs" .`(資料夾只活在 open 期間、frontmatter 合規、沒人 import);`feeds` 指不指得到文檔由 `scan-status.mjs` 查。

## 委派模式(prompt 標明【委派模式】時)

先讀 `../_shared/delegation.md`,並做以下替換(沒有標記時照原流程):

| 步驟 | 委派模式 |
|---|---|
| 0. 定問題 | **跳過討論**。問題、判準、timebox 由 prompt 給;缺任一項當阻塞項回報,不自己補 |
| 1. 配號建檔 | **跳過**。號、資料夾(或候選子資料夾)、`RND-n` 由編排者指定 |
| 2. 寫程式碼 | **只寫指定的資料夾**;要動專案套件管理檔一律停下該項回報 |
| 4. 結案 | **不寫文檔、不 commit、不刪資料夾**——都由編排者做。回報五項:verdict、每條判準的觀察結果、程式碼路徑與 sha、環境、**沒驗到的** |
| 收尾 | 不輸出定錨區塊,不讀 `anchor.md` |

## 收尾

摘要:文檔全名、verdict、一句話結論、餵給哪幾份文檔的哪一格、下游該走哪個 skill。最後輸出**定錨區塊**(`../_shared/anchor.md`):spike 不在 `.design/` 的位置樹上,樹畫**它的下游**,結論要餵進去的那份文檔標「目前」;下一步是把結論寫進下游的那道命令。

## 邊界

- 不設計契約、不寫 spec、不寫測試、不寫產品程式碼;不改別的 `.design/` 文檔
- 不驗「impl 有沒有做到 spec」——那是編排者跑測試就能答的
- 不當第二條開發路徑:升格只有寫進 spec 一條路,程式碼不搬、不留、不 import
- 不手打刪除指令:`rm -rf` 與 `git add -A` 在本 skill 任何步驟都不出現
