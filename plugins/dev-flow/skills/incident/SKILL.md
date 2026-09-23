---
name: incident
description: dev-flow(有 .design/ 的專案)的事故入口:線上壞了、使用者回報了一件事,把現象整理成一組輸入與輸出,在使用者手上的那一版(devflow release 讀它上線在哪個 tag)重現,歸因到哪份 feature 的哪個 step 與哪條 law,照分流交給 scope-revise、scope-laws、global-laws 或 require-design;不寫測試、不改程式碼、不改文檔。觸發詞:事故、incident、線上壞了、使用者回報、bug report、production 出錯、重現、復現。Use when something broke for users and it must be reproduced, attributed to a law and handed to the skill that fixes it.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:incident — 重現、歸因、交棒

> **核心**：Reproduce on the version users have, attribute to a Law, hand off — never fix, never write the test yourself.（在使用者手上的那一版重現、歸因到一條 law、交棒：不修，也不自己寫測試。）步驟與這一句衝突時，這一句贏：停下，回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief incident --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief incident --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief incident --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief incident --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段（一份輸出切成幾段，每段一道指令）是載入 skill 時跑 `devflow brief incident [<文檔全名>]` 的輸出：規章、分支與工作樹、`system.md` 的「Constraint」與全份（對外 I/O 表在「全域 Law」區）、每個需求檔（給了文檔全名就只印綁它的那幾條與目標文檔全文、逐條狀態）、`modules.md`、根目錄的測試輸出、status 報告（需求表的「上線」欄）。開工要讀的規章與專案現況都在這裡，不再另外讀。

目標：不必給；開發者丟進來的整段文字就是現象，裡面寫了文檔全名就以它為目標。專案現況在這一場裡變過、要重看，再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief incident [<文檔全名>] --no-rules`。看到的若是那道指令的原文而不是它的輸出，自己跑一次（不加 `--no-rules`）。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 → 輸出

| 輸入 | 輸出 |
|---|---|
| 開發者丟進來的現象：錯誤訊息、日誌、請求與回應、使用者的一句話、截圖裡的字 | 在使用者手上的那一版重現過的一組輸入與實際、預期的輸出；歸因（哪一端、哪份 feature、哪個 step、哪條 law 或沒有 law）；一行交棒的指令，並自動接上那個 skill。不寫任何檔 |

## 步驟

1. **收現象**：整理成五行——誰、在什麼情況下、輸入（請求、參數、檔案、操作）、實際看到的輸出、預期看到的輸出。預期那一行照開發者或使用者的話寫，不自己推；缺輸入或缺實際的輸出就問一次，問完還缺就停下回報。
2. **對到需求與版本**：從現象對到哪一條需求（它的一句話與驗收講的是這件事）；對不到就問開發者是哪一條，沒有任何一條需求講這件事的，回報「沒有需求承諾這件事」並停下，新需求走 `dev-flow:require-design`。接著跑 `node "<D>/bin/devflow.mjs" release`（有測試輸出就加 `--tests <log>`），讀那條需求上線在哪個 tag（`tooling.md`「發布」）；未上線或印 `-` 的，使用者手上的就是主線。
3. **重現**（`roles.md`「事故」第 1 項）：
   - 上線在某個 tag:`git worktree add --detach <暫存區>/incident-<tag> <tag>`，在那棵樹裡照「Constraint」的建置指令建置。
   - 用第 1 步的輸入從那一端的 `!` 列跑（里程碑表的「怎麼驗」欄是現成的跑法）。重現用的腳本寫在暫存區，不寫進 repo、不標歸屬。
   - 跑出與現象相同的實際輸出才算重現。再在主線上跑同一組：主線上已經不壞，用 `git log <tag>..<主線> -- <那幾個檔>` 找出修好它的 commit，回報「主線已修好，等下一次發布」，不交棒。
   - 跑完 `git worktree remove` 那棵樹，刪掉暫存區的腳本。
   - 重現不出來：停下，回報試了哪幾組、在哪一版、缺什麼（資料、設定、版本）。不猜原因，不改程式碼試試看。
4. **歸因**（`roles.md`「事故」第 2 項）：對外 I/O 表 → 這個輸入從哪一端進來、進哪份 feature；`node "<D>/bin/devflow.mjs" status --doc <全名>` 列出它的 step 與 law，沿 Steps（`o` 列是現成的觀察點）找結果第一次變錯的那一個 step，再逐條對它的 law 與 example。歸到表上的一列。講給開發者聽：現象、重現的那一組、錯在哪一步、對到哪條 law（或沒有 law）、歸到哪一列、要交給誰。開發者說歸錯了就照他的話重歸。
5. **交棒**（`roles.md`「事故」第 3 項）：寫好一行指令，全名後面接來源，直接執行，不等開發者另外下指令：

   ```
   /dev-flow:scope-revise F-002-refund 事故:<原句>;重現:<輸入> 在 v1.4.0 與主線上都得到 <實際>,預期 <預期>;對到 LAW-2(或「無」)
   ```

   不歸 dev-flow 的（設定、基礎設施、第三方服務）不交棒，回報給開發者就結束。

## 收尾

回報現象五行、重現在哪一版與主線各跑出什麼、歸因（哪一端、哪份 feature、哪個 step、哪條 law）、交給了誰與那一行指令；交棒之後的收尾由接手的 skill 做。附定錨區塊（`tooling.md`「收尾定錨」）。

## 邊界

不寫測試、不改程式碼、不改 `.design/` 的任何檔、不打 tag、不 commit；暫時的工作樹與腳本跑完就收掉。會紅的測試由接手的 skill 把重現的那一組寫進文檔之後，由 `dev-flow:build` 的 qa 寫、在 build 分支上首跑（`roles.md`「事故」）。law 要不要承諾、要不要調整，在接手的 skill 裡由開發者決定，這裡不問。
