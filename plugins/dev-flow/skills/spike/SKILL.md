---
name: spike
description: 可行性驗證(spike)— 讀原始碼答不出來、要跑了才知道的問題,先寫下問題、判準與 timebox,再在專案根目錄 spike/SPK-00x-<slug>/ 寫拋棄式程式碼驗證,結論寫進 .design/spikes/SPK-00x-<slug>.md 並指明餵給哪份 ADR / 契約 / feature 檔。可多輪疊代(RND-n,模型屋式的 demo 範本)、可由編排者委派、可平行比較多個候選做法。spike/ 是常駐的共用 sandbox 環境;結案時該 spike 的資料夾一律刪掉,每輪 sha 留在文檔裡,想看的人用 git 撈。觸發詞:spike、可行性驗證、試一下、驗證可不可行、PoC、prototype、原型、快速驗證、模型屋、demo 範本、先做個 demo。Use when a design decision cannot be answered by reading code and needs throwaway experimental code with a recorded verdict.
user-invocable: true
---

# /spike — 可行性驗證

**讀了也答不出來、要跑了才知道**的問題(這個函式庫撐不撐得住這個量、目標平台編不編得過),spike 是它唯一合法的出口:替決策生產證據,自己不做決策。設計理由見 `docs/skill-authoring.md`「`/spike`」。

## 鐵律

1. **產出是結論,不是程式碼。** 結案時 `spike/SPK-00x-<slug>/` 一律刪掉,每輪的 commit sha 留在文檔裡,要看用 `git show <sha>` 撈。open 期間**產品程式碼與測試禁止 import 它**,feature 的 `code-paths` 不得指進去;正式的東西一律從 spec 蓋。`lint-spikes.mjs` 查:open 要有資料夾、concluded 不准有、沒人 import
2. **寫程式碼之前先寫三樣東西**:要回答什麼、什麼結果算過、timebox。沒有這三樣是隨手試,不是 spike。**判定只依判準,不依感覺**
3. **結論必須指向下游**(`feeds` 欄寫文檔全名):ADR 的被否決方案、`design.md` 的契約條目、feature 檔的「明確不做」或「不可逆決定」。`concluded` 而 `feeds` 空的、或指不到文檔的,腳本列為不一致
4. **spike 不改任何 `.design/` 文檔,自己的那份除外。** 改 spec 或契約走 `/spec-redesign`,進 ADR 走對應的 design skill。spike 是證據,不是入口

## 先讀什麼(**一批送出,不要一個一個開**)

`<S>` = 本 plugin 的 `skills/` 目錄,**整場對話只解析一次**(規則見 `../_shared/conventions.md`「腳本目錄」):
`dirname "$(dirname "$(find ~/.claude/plugins . -maxdepth 9 -type d -path '*dev-flow*/skills/arch-audit/scripts' 2>/dev/null | head -1)")"`

拿到 `<S>` 後,把下面**必讀**與成立的**條件式**項目放進**同一則訊息**一次讀完(多個 Read / Bash 併發)。**禁止讀一個、想一下、再讀下一個**——這一段是純載入,拆成幾趟只是把幾次 prefill 疊起來。

**必讀**

| 讀什麼 | 為什麼 |
|---|---|
| `../_shared/conventions.md` | 核心慣例、腳本目錄、**跑東西的紀律** |
| `node "<S>/arch-audit/scripts/doc-section.mjs" ../_shared/doc-lifecycle.md 命名與編號規則 文檔引用格式 description "spike 文檔"` | 配號、引用寫法、spike 文檔的 frontmatter。**不要整份讀** |

**條件式**(先判斷條件,成立的**併進上面同一批**)

- prompt 標明 `【委派模式】` → `../_shared/delegation.md`
- 問題牽涉既有程式碼**且**專案有程式碼知識圖 → `../_shared/codegraph.md` + `../_shared/codegraph-tools.md`(只用來定位「現況長什麼樣」,不取代實際跑)
- **收尾時** → `../_shared/anchor.md`(定錨區塊格式;**委派模式下不讀**)

**不讀**:`spec-roles.md`、`boundary-rules.md`、`testing-policy.md`、`contract-readiness.md`——spike 不設計契約、不寫測試、不做層級判斷。

文檔版面在 `templates/spike.md`,步驟 1 建檔後打開照抄。

## 三種形態(同一份文檔、同一套規則)

| 形態 | 什麼時候 | 差別 |
|---|---|---|
| **單一問題** | 一個問題、一條做法、一輪 | 預設 |
| **多輪疊代** | 問題要分好幾步才答得完,或一個可以一直長的 demo 範本(模型屋) | 一份 spike 檔記多輪 `RND-1`、`RND-2`…;**每一輪各有自己的問題、判準與 timebox**,沒有問題在驅動的那一輪不准開 |
| **候選比較** | 同一個問題有兩條以上做法要比 | 各候選一個子資料夾 `spike/SPK-00x-<slug>/<候選>/`,結論裡多一張比較表;委派模式下由編排者 fan out,每個 subagent 只寫自己的子資料夾(見下方「候選比較」) |

**升格不是搬資料夾**:模型屋要變正式功能,`feeds` 指向那份 feature 檔,`/spec-design` 用 sha 把它當證據讀、寫出 spec,再由 qa 與 impl 從 spec 投影進正式的原始碼樹。想長期留一個 demo 給人看的,那不是 spike,是產品的一部分,走 spec 進 `examples/` 之類的正式位置。

## 0. 定問題(不可跳過,先於一切)

與開發者(委派模式下:依編排者的 prompt)把三樣東西寫死:

1. **要回答什麼**:一句話,寫成「X 在 Y 條件下能不能 Z」這種可判定的形式。「看看 X 好不好用」不是問題
2. **判準**:什麼結果算 `feasible`、什麼算 `infeasible`、什麼情況記 `partial`。要寫成**可觀察的數字或現象**(「10 萬筆在 2 秒內回來」「能在 wasm 目標編譯過」),不是「感覺夠快」
3. **timebox**:這一輪最多幾次嘗試(或多少時間)。到了就停,結果照實記——**timebox 用完沒答案本身就是一個結論**(`partial`,記下為什麼答不出來)

還要問一題:**這個問題真的要跑了才知道嗎?** 讀原始碼、讀文件、查既有測試就答得出來的,不開 spike,直接把答案寫進手上的文檔。

## 1. 配號並建檔(同一道指令,不准自己數資料夾)

```
node "<S>/arch-audit/scripts/scan-ids.mjs" .design --claim SPK --slug <kebab-slug>
```

腳本掃過所有分支與 worktree 之後配號,**同時建兩樣東西**:`.design/spikes/SPK-00x-<slug>.md`(frontmatter 骨架 + 章節標題)與程式碼資料夾 `spike/SPK-00x-<slug>/`(附指回文檔的 `README.md`;`spike/` 根層的 README 第一次一起建)。印出 `<id>`、兩條路徑與**全名**(`SPK-003-storage-engine`,之後每次提到都用全名)。

接著打開 `templates/spike.md`,把步驟 0 的三樣東西填進 `## 問題` 與 `RND-1`,補上 `description`。**委派模式下跳過這一步**:號、路徑與 `RND-n` 由編排者指定。

**`spike/` 根層是常駐的共用 sandbox**:依賴檔(跟專案自己的分開)、假資料產生器、量測 harness 放這裡,**不刪**;只有 `spike/SPK-00x-<slug>/` 那一層是一次性的。**第一次在這個專案建 spike 時**立起來,之後不必重做:

- `spike/` 根層建依賴檔與 `.gitignore`(`.venv/`、`node_modules/`、建置產物)
- `.gitattributes` 加 `spike/** linguist-vendored`
- 確認建置 / 測試設定**排除** `spike/`(`tsconfig` 的 `exclude`、`pyproject` 的 `packages`、cabal 的 `hs-source-dirs`、`go.work`)。這一項機器判不了——Haskell / Java / Rust 這類用模組名 import 的語言,`lint-spikes.mjs` 也看不到 import,**建置設定是它們唯一的防線**

## 2. 寫程式碼(每一輪)

在 `spike/SPK-00x-<slug>/` 底下(候選比較放各自的子資料夾)寫**最少能回答問題的程式碼**。三條紀律:

- **不追求品質,追求可判定。** 沒有錯誤處理、沒有抽象、沒有測試都可以;但輸出必須能對到判準——判準寫「2 秒內」,程式碼就要印出秒數
- **依賴不得寫進專案的套件管理檔**,裝進 `spike/` 根層的 sandbox 依賴檔;非得動專案自己的不可時先停下來確認(那是架構層級的選型)
- **每一輪結束時 commit 一次、記一次**:`git add -- spike/SPK-00x-<slug> .design/spikes/SPK-00x-<slug>.md` 兩條路徑 commit(**寫路徑,不用 `-A`**;訊息 `spike: SPK-003-storage-engine RND-2`),再把 sha 填進 `RND-n`,連同「結果」與環境。**sha 是結案後唯一能撈回程式碼的鑰匙**;記了 sha 之後又改程式碼,就再開一輪記新的 sha。timebox 到了沒答案照樣記「未達判準,原因:…」

跑東西的紀律照 `conventions.md`:輸入沒變跑一次就夠,輸出留檔再看。

## 3. 判定(依判準,不依感覺)

每一輪拿結果對判準:

| 結果 | verdict |
|---|---|
| 判準全部達成 | `feasible` |
| 判準明確沒達成 | `infeasible` |
| timebox 用完答不出來、或只達成一部分 | `partial`——寫清楚**哪一部分**、**為什麼答不出來** |

`partial` 不是失敗,是「這個問題比想的大」。決定要不要再開一輪(多輪疊代)由開發者定;委派模式下記進回報由編排者定。

## 4. 結案

`## 結論` 四格填齊:verdict、一句話結論、學到什麼(**三個月後有人想再試一次時要先知道的事**——程式碼結案就刪,這一格寫不好就什麼都不剩)、餵給哪裡。然後**順序固定**:

1. 最後一輪的 sha 已填進 `RND-n`,而且那個 commit 裡的資料夾就是現在這個(改過就再開一輪記新 sha)
2. frontmatter:`status: concluded`、`verdict`、`feeds`(每一份下游文檔的**全名**:`ADR-004-storage`、`auth/F003-session-list`、`G-C001-session#SessionToken`、`auth/design.md`)、`updated` 換今天
3. **刪程式碼資料夾——只准用腳本,不准手打 `git rm`,更不准 `rm -rf`**:

   ```
   node "<S>/arch-audit/scripts/spike-close.mjs" SPK-00x-<slug>            # dry-run:印五道關與會刪的檔案清單
   node "<S>/arch-audit/scripts/spike-close.mjs" SPK-00x-<slug> --apply    # 五道關都過才真的 git rm -r
   ```

   路徑由腳本從文檔全名算,人只給全名;五道關(文檔已結案、路徑真的是 `spike/SPK-00x-<slug>/` 且在工作樹內不是 symlink、沒有未 commit 的東西、最後一輪 sha 裡的資料夾與現在一模一樣、只用 `git rm -r --`)任一關沒過就一個檔都不動。先 dry-run 看清單再 `--apply`;刪完它不 commit,由你連第 2 步的文檔一起 commit(`spike: SPK-003-storage-engine concluded`)。`spike/` 根層它永遠碰不到
4. **下游由誰改,講清楚**:spec 或契約走 `/spec-redesign`;新 ADR 走 `/system-design` 更新模式;feature 檔的「不可逆決定」段走 `/spec-design`。**你不改它們**——只在回報裡寫「哪一份、哪一格、寫什麼」。模型屋要變正式功能也走這條:`feeds` 指向 feature 檔,程式碼由 impl 從 spec 重寫,不搬
5. 決定不做了的標 `dropped`,一句話寫為什麼,第 1、3 步照做

跑一次驗收並貼結果:

```
node "<S>/arch-audit/scripts/lint-spikes.mjs" .
```

它查:資料夾只活在 open 期間、frontmatter 合規、產品程式碼有沒有 import `spike/`。`feeds` 指不指得到文檔由 `scan-status.mjs` 查。

## 候選比較(編排者做)

同一個問題要比兩條以上做法時,**由編排者(`/spec-build`、`/subsys-build`,或開發者本人)fan out**,規則照 `../_shared/orchestration.md`「派 spike 驗證」:

- 編排者先做步驟 0 與 1(問題、判準、timebox、配號),**判準對所有候選一致**——不一致就不是比較
- 每個候選一個 subagent、一個子資料夾 `spike/SPK-00x-<slug>/<候選>/`;prompt 帶 `【委派模式】`、問題、判準、timebox、子資料夾路徑
- subagent **只寫自己的子資料夾**,不碰 spike 文檔;結果照 `delegation.md` 回報格式交回
- 編排者收齊後填「候選比較」表與結論——**同一份文檔只有一個寫者**,理由同 `delegation.md` 第 4 條

## 委派模式(prompt 標明【委派模式】時)

被編排者委派時,先讀 `../_shared/delegation.md`,並對本 skill 做以下替換(**沒有這個標記時完全不適用,照原流程走**):

| 步驟 | 委派模式下的作法 |
|---|---|
| 0. 定問題 | **跳過討論**。問題、判準、timebox 由 prompt 給;prompt 缺任一項就當阻塞項回報,不自己補 |
| 1. 配號建檔 | **跳過**。號、資料夾(或子資料夾)、`RND-n` 由編排者指定 |
| 2. 寫程式碼 | 照原規則,**只寫指定的資料夾**;要動專案套件管理檔的一律停下該項回報 |
| 3. 判定 | 照原規則,verdict 與證據寫進回報 |
| 4. 結案 | **不寫 spike 文檔、不改 frontmatter、不 commit、不刪資料夾**——由編排者單線寫、commit、記 sha、刪。回報固定五項:verdict、對每條判準的觀察結果(數字或現象)、程式碼路徑與 sha、環境、**沒驗到的**(判準之外、這次沒碰的) |
| 收尾 | 不輸出定錨區塊,不讀 `anchor.md` |

## 收尾

- 摘要給開發者:文檔全名、verdict、一句話結論、餵給哪幾份文檔的哪一格、下游該走哪個 skill
- 最後輸出**定錨區塊**(`../_shared/anchor.md`):spike 不在 `.design/` 的位置樹上(它不是任務文檔),位置樹畫**它的下游**——結論要餵進去的那份文檔標為「目前」;主軸檢查寫這個 spike 對應哪個決定;下一步是把結論寫進下游的那道命令(常見:`/spec-redesign <文檔全名>`、`/spec-design <文檔全名>`、`/subsys-design <slug>`)

## 邊界

- **不設計契約、不寫 spec、不寫測試、不寫產品程式碼**。這四件各有自己的 skill
- **不改別的 `.design/` 文檔**。結論的落地由下游 skill 做,spike 只指出哪裡
- **不驗「impl 有沒有做到 spec」**。那是編排者跑測試就能答的,不派 spike;spike 只驗「這個做法在我們的環境下行不行」這類讀與跑測試都答不出來的問題
- **不當第二條開發路徑**。模型屋做得再大,升格只有一條路:寫進 spec,再走 qa ∥ impl。程式碼不搬、不留、不 import
- **不保留程式碼、不手打刪除指令**。結案即刪,只走 `spike-close.mjs`;`rm -rf` 與 `git add -A` 在本 skill 任何步驟都不出現
