---
name: spike
description: 可行性驗證(spike)— 讀原始碼答不出來、要跑了才知道的問題,先寫下問題、判準與 timebox,再在專案根目錄 spike/SPK-00x-<slug>/ 寫拋棄式程式碼驗證,結論寫進 .design/spikes/SPK-00x-<slug>.md 並指明餵給哪份 ADR / 契約 / feature 檔。可多輪疊代(RND-n,模型屋式的 demo 範本)、可由編排者委派、可平行比較多個候選做法。spike/ 是常駐的共用 sandbox 環境;結案時該 spike 的資料夾一律刪掉,每輪 sha 留在文檔裡,想看的人用 git 撈。觸發詞:spike、可行性驗證、試一下、驗證可不可行、PoC、prototype、原型、快速驗證、模型屋、demo 範本、先做個 demo。Use when a design decision cannot be answered by reading code and needs throwaway experimental code with a recorded verdict.
user-invocable: true
---

# /spike — 可行性驗證

## 這個 skill 存在的理由

`boundary-rules.md`「發問協議」要求問人之前先「已查過」,設計階段規則要求每個不可逆決定附被否決的替代方案。兩者都假設答案讀原始碼讀得出來。**讀了也答不出來、要跑了才知道**的那一類問題(這個函式庫在我們的資料量下撐不撐得住、這條協定的延遲落在哪一級、這種資料結構在這個平台上能不能序列化),原本沒有合法的出口——只能偷偷寫一段程式碼試,然後沒有人記錄試了什麼。

spike 把這個動作合法化並留下紀錄。它替決策生產證據,自己不做決策。

## 鐵律

1. **產出是結論,不是程式碼。** 結案時 `spike/SPK-00x-<slug>/` 一律刪掉,每一輪的 commit sha 留在文檔裡,想看程式碼的人用 `git show <sha>` 撈。open 期間**產品程式碼與測試禁止 import 它**,feature 的 `code-paths` 也不得指進去。正式的東西一律從 spec 蓋,可以抄做法,不能把模型屋搬進來。`lint-spikes.mjs` 機械查這一條:open 的要有資料夾、concluded 的不准有
2. **寫程式碼之前先寫三樣東西**:要回答的問題一句話、什麼結果算過、timebox 多長。沒有這三樣就不是 spike,是隨手試。**判定只依判準,不依感覺**
3. **結論必須指向下游。** 收尾要寫出結論餵給哪一份文檔的哪一格(`feeds` 欄):某份 ADR 的被否決方案、某份 `design.md` 的契約條目、某份 feature 檔的「明確不做」或「不可逆決定」。沒有下游的 spike 等於白做,`concluded` 而 `feeds` 是空的會被腳本列為不一致
4. **spike 不改任何 `.design/` 文檔,自己的那份除外。** 結論要改 spec 或契約,一律走 `/spec-redesign`;要進 ADR,走 `/system-design` 或 `/subsys-design` 更新模式。spike 是證據,不是入口

## 先讀什麼(**一批送出,不要一個一個開**)

`<S>` = 本 plugin 的 `skills/` 目錄,**整場對話只解析一次**(規則見 `../_shared/conventions.md`「腳本目錄」):
`dirname "$(dirname "$(find ~/.claude/plugins . -maxdepth 9 -type d -path '*dev-flow*/skills/arch-audit/scripts' 2>/dev/null | head -1)")"`

拿到 `<S>` 後,把下面**必讀**與成立的**條件式**項目放進**同一則訊息**一次讀完(多個 Read / Bash 併發)。**禁止讀一個、想一下、再讀下一個**——這一段是純載入,拆成幾趟只是把幾次 prefill 疊起來。

**必讀**

| 讀什麼 | 為什麼 |
|---|---|
| `../_shared/conventions.md` | 核心慣例、腳本目錄、**跑東西的紀律**(spike 最容易犯的就是「保險起見再跑一次」) |
| `node "<S>/arch-audit/scripts/doc-section.mjs" ../_shared/doc-lifecycle.md 命名與編號規則 文檔引用格式 description "spike 文檔"` | 配號、引用寫法、spike 文檔的 frontmatter。**不要整份讀** |

**條件式**(先判斷條件,成立的**併進上面同一批**)

- prompt 標明 `【委派模式】` → `../_shared/delegation.md`
- 問題牽涉既有程式碼**且**專案有程式碼知識圖 → `../_shared/codegraph.md` + `../_shared/codegraph-tools.md`(只用來定位「現況長什麼樣」,不取代實際跑)
- **收尾時** → `../_shared/anchor.md`(定錨區塊格式;**委派模式下不讀**)

**不讀**:`spec-roles.md`、`boundary-rules.md`、`testing-policy.md`、`contract-readiness.md`。spike 不設計契約、不寫測試、不做層級判斷——它的價值就在便宜,這四片在這裡是純成本。

文檔版面在 `templates/spike.md`,步驟 1 建檔後打開照抄。

## 三種形態(同一份文檔、同一套規則)

| 形態 | 什麼時候 | 差別 |
|---|---|---|
| **單一問題** | 一個問題、一條做法、一輪 | 預設 |
| **多輪疊代** | 問題要分好幾步才答得完,或做一個可以一直長的 demo 範本(模型屋) | 一份 spike 檔記多輪 `RND-1`、`RND-2`…;**每一輪各有自己的問題、判準與 timebox**。模型屋可以一直長,但每一次長大都要有一個明確的問題在驅動 |
| **候選比較** | 同一個問題有兩條以上做法要比 | 各候選一個子資料夾 `spike/SPK-00x-<slug>/<候選>/`,結論裡多一張比較表;委派模式下由編排者 fan out,每個 subagent 只寫自己的子資料夾(見下方「候選比較」) |

模型屋與正式屋的界線只有一條:**正式屋一律從 spec 蓋**。模型屋長到多大都還是 `spike/` 底下一個會被刪掉的資料夾;**升格不是搬資料夾**,是 `feeds` 指向一份 feature 檔,`/spec-design` 用 sha 把它當證據讀、寫出 spec,再由 qa 與 impl 各自從 spec 投影進正式的原始碼樹。想長期留一個 demo 給人看的,那已經不是 spike,是產品的一部分,走 spec 進 `examples/` 之類的正式位置。

## 0. 定問題(不可跳過,先於一切)

與開發者(委派模式下:依編排者的 prompt)把三樣東西寫死:

1. **要回答什麼**:一句話,寫成「X 在 Y 條件下能不能 Z」這種可判定的形式。「看看 X 好不好用」不是問題
2. **判準**:什麼結果算 `feasible`、什麼算 `infeasible`、什麼情況記 `partial`。要寫成**可觀察的數字或現象**(「10 萬筆在 2 秒內回來」「能在 wasm 目標編譯過」),不是「感覺夠快」
3. **timebox**:這一輪最多花多少(時間或嘗試次數)。到了就停,結果照實記——**timebox 用完沒答案本身就是一個結論**(`partial`,記下為什麼答不出來)

還要問一題:**這個問題真的要跑了才知道嗎?** 讀原始碼、讀文件、查既有測試就答得出來的,不開 spike——直接查完把答案寫進當下手上的文檔。spike 的成本永遠高於讀。

## 1. 配號並建檔(同一道指令,不准自己數資料夾)

```
node "<S>/arch-audit/scripts/scan-ids.mjs" .design --claim SPK --slug <kebab-slug>
```

腳本掃過所有分支與 worktree 之後配號,**同時建兩樣東西**:`.design/spikes/SPK-00x-<slug>.md`(frontmatter 骨架 + 章節標題)與同名的程式碼資料夾 `spike/SPK-00x-<slug>/`(在 `spike/` sandbox 底下,附一份指回文檔的 `README.md`;`spike/` 根層的 README 第一次會一起建)。印出 `<id>`、兩條路徑與**全名**(`SPK-003-storage-engine`,之後每次提到都用全名)。

接著打開 `templates/spike.md`,把步驟 0 的三樣東西填進 `## 問題` 與第一輪 `RND-1`,補上 `description`。**委派模式下跳過這一步**:號、路徑與 `RND-n` 由編排者指定。

**`spike/` 是常駐的共用 sandbox**:根層放所有 spike 共用的東西——依賴檔(`spike/package.json`、`spike/pyproject.toml`、`spike/cabal.project` 之類,跟專案自己的分開)、假資料產生器、量測 harness、環境說明。這些**不刪**,會隨 spike 累積;只有 `spike/SPK-00x-<slug>/` 那一層是一次性的。**第一次在這個專案建 spike 時**把 sandbox 立起來,之後不必重做:

- 在 `spike/` 根層建依賴檔與 `.gitignore`(`.venv/`、`node_modules/`、建置產物)
- `.gitattributes` 加一行 `spike/** linguist-vendored`(進 git、但不進語言統計)
- 確認專案的建置 / 測試設定**排除** `spike/`(`tsconfig` 的 `exclude`、`pyproject` 的 `packages`、cabal 的 `hs-source-dirs`、`go.work` 等)。這一項機器判不了,`lint-spikes.mjs` 只查得到 import,查不到建置圖——所以現在就做

## 2. 寫程式碼(每一輪)

在 `spike/SPK-00x-<slug>/` 底下(候選比較放各自的子資料夾)寫**最少能回答問題的程式碼**。三條紀律:

- **不追求品質,追求可判定。** 沒有錯誤處理、沒有抽象、沒有測試都可以;但輸出必須能對到判準——判準寫「2 秒內」,程式碼就要印出秒數
- **依賴不得寫進專案的套件管理檔。** spike 要裝的東西裝進 `spike/` 根層的 sandbox 依賴檔(那是共用環境,可以留、可以累積);非得動專案自己的 `package.json` / `pyproject` 不可時,先停下來確認(那已經是架構層級的選型,不是 spike 該偷偷做的事)
- **每一輪結束時 commit 一次、記一次**:先 `git add -- spike/SPK-00x-<slug> .design/spikes/SPK-00x-<slug>.md` 這兩條路徑 commit(**寫路徑,不用 `-A`**;訊息帶全名與輪次:`spike: SPK-003-storage-engine RND-2`),再把 sha 填進 `RND-n` 的「sha」欄,連同「結果」與環境(資料量、外部服務、機器)。**sha 是結案後唯一能撈回程式碼的鑰匙**,漏記等於程式碼真的沒了。timebox 到了沒答案照樣記,寫「未達判準,原因:…」

**跑東西的紀律照 `conventions.md`**:同一個判準、輸入沒變,跑一次就夠;輸出留檔再看,不要為了看另一段重跑。

## 3. 判定(依判準,不依感覺)

每一輪拿結果對判準:

| 結果 | verdict |
|---|---|
| 判準全部達成 | `feasible` |
| 判準明確沒達成 | `infeasible` |
| timebox 用完答不出來、或只達成一部分 | `partial`——寫清楚**哪一部分**、**為什麼答不出來** |

`partial` 不是失敗,是「這個問題比想的大」。決定要不要再開一輪(多輪疊代)由開發者定;委派模式下記進回報由編排者定。

## 4. 結案

`## 結論` 四格填齊:verdict、一句話結論、學到什麼(**三個月後有人想再試一次時要先知道的事**——這一格是整份文檔最貴的部分;程式碼結案就刪,這一格寫不好就什麼都不剩)、餵給哪裡。然後**順序固定**:

1. 確認最後一輪的 sha 已經填進 `RND-n`,而且那個 commit 真的含這個資料夾(`git show <sha> --stat -- spike/SPK-00x-<slug>` 有東西)。沒有就先 commit 再記
2. frontmatter:`status: concluded`、`verdict` 填上、`feeds` 列出每一份下游文檔的**全名**(`ADR-004-storage`、`auth/F003-session-list`、`G-C001-session#SessionToken`、`auth/design.md`)、`updated` 換今天
3. **刪掉程式碼資料夾——只准用腳本,不准手打 `git rm`,更不准 `rm -rf`**:

   ```
   node "<S>/arch-audit/scripts/spike-close.mjs" SPK-00x-<slug>            # dry-run:印五道關與會刪的檔案清單
   node "<S>/arch-audit/scripts/spike-close.mjs" SPK-00x-<slug> --apply    # 五道關都過才真的 git rm -r
   ```

   刪除的路徑由腳本從文檔全名算出來,人只給全名;它先過五道關(文檔已結案、路徑真的是 `spike/SPK-00x-<slug>/` 而且在工作樹內不是 symlink、資料夾裡沒有未 commit 的東西、最後一輪的 sha 真的撈得回這個資料夾、只用 `git rm -r --`),任一關沒過就一個檔都不動。先跑 dry-run 看清單,再 `--apply`;刪完它不 commit,由你連第 2 步的文檔一起 commit(訊息帶全名:`spike: SPK-003-storage-engine concluded`)。`spike/` 根層的共用環境腳本永遠碰不到。這一步不是可選的——`lint-spikes.mjs` 把「concluded 卻還有資料夾」列為不一致,理由是留著的程式碼一定會被人 import,而沒有任何 law 保護它
4. **下游那幾份文檔由誰改,講清楚**:spec 或契約走 `/spec-redesign`;新 ADR 走 `/system-design` 更新模式;feature 檔的「不可逆決定」段走 `/spec-design`。**你不改它們**——只在回報裡寫「哪一份、哪一格、寫什麼」。要把模型屋變成正式功能也走這條:`feeds` 指向那份 feature 檔,程式碼由 impl 從 spec 重寫,不搬
5. 決定不做了的 spike 標 `dropped`,一句話寫為什麼,資料夾照樣用同一支腳本刪(第 1、3 步照做——dropped 的程式碼也可能有人三個月後想撈)

跑一次驗收並貼結果:

```
node "<S>/arch-audit/scripts/lint-spikes.mjs" .
```

它查三件事:資料夾只活在 open 期間(open 的要有、concluded / dropped 的不准有)、frontmatter 合規(`concluded` 要有 `verdict` 與非空 `feeds`)、產品程式碼有沒有 import `spike/`。

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
- **不保留程式碼**。結案即刪,sha 是唯一入口;想長期留的東西不是 spike
- **不手打刪除指令**。刪資料夾只有 `spike-close.mjs` 一條路;`rm -rf` 在本 skill 任何步驟都不出現,`git add -A` 也不用(寫路徑)
