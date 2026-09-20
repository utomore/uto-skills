---
name: audit
description: lawful(有 .lawful/ 的 Haskell 專案)的稽核:lint 與 status 的紅逐條分類(文檔錯還是程式碼錯)、需求與里程碑是否貼合、laws 與邊界的人工判斷,產出「哪裡、什麼事、怎麼辦」表,不直接改契約。觸發詞:稽核、audit、健檢、對帳、文檔與程式碼對不上、邊界檢查。Use when checking that .lawful and the code still agree and how healthy the project is.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:audit — 對帳與判斷

> **核心**:Report, never repair: classify every discrepancy and name the command that fixes it.(只報不修:每一處不一致都分類,並指名修它的那道命令。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief audit --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief audit --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief audit --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief audit --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief audit --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief audit --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief audit` 的輸出:規章、`lawful lint all` 的結果、`requirements/` 底下每個需求檔全文、`lawful status` 整份報告(根目錄恰好一份比每個原始碼與測試檔都新的測試輸出時接上它)、`modules.md` 全文。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給;有最近一次測試輸出就加 `--tests <log>`。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief audit --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 步驟

### 1. 對帳(機械)

`lawful lint all` 與 `lawful status --tests <log>`(log 照 `lawful:status` 第 1 步拿)。每條紅分類:

| 紅 | 處置 |
|---|---|
| 簽名不一致 | 看兩邊誰對:文檔錯走 `lawful:scope-revise`(既有的 law 不動,改簽名;pipeline 還沒 `verified` 走 `lawful:scope-laws`),程式碼錯列給 refactor |
| 同層搬家 | 直接 `lawful sync` |
| 未登記模組 | `lawful modules --gen` 再請開發者填職責 |
| 沒匯出的 stage、沒有匯出清單的模組 | 宣告的事:`verified` 的 pipeline 走 `lawful:scope-revise`,還在切片那一波的走 `lawful:scope-laws` |
| 跨層 import、core 碰效果型別、production import `*.Internal`、`=` 列在 shell | 結構問題,列給開發者 |
| law 的識別字對不到 | 少一個觀察點 → 補 `o` 列:`verified` 的 pipeline 走 `lawful:scope-revise`,還在切片那一波的走 `lawful:scope-laws` |
| 幽靈引用 | 測試還在守一條已經不存在的 law,刪測試 |
| 未翻譯 | 那條 law 沒有測試,下一波 build 派 qa |
| 需求的驗收或領域不變量寫了三行卻沒有測試 | `lawful:build R-n` / `INV-n`,只派 qa(`roles.md`「驗收測試」) |
| `lint global` 的紅(架構、契約、領域不變量) | 不得違反的約束被踩到:先歸因到哪一條 pipeline 的程式碼違反了它,改程式碼;覺得該改的是那條全域 Law,列成給開發者的變更建議(`lawful:global-laws` 落筆),不自己改 |
| 領域不變量的三行引用了某條 pipeline 的簽名 | 它不是全專案的規則:搬回那條 pipeline 當它的 scope law(`lawful:global-laws` 刪那一條、`lawful:scope-revise` 在那條 pipeline 新增一條;全域 Law 的變更要開發者批准),或改成只引用 types 層 |
| 對外 I/O 表對不上 io pipeline | 契約一類的紅:表上的列寫錯由 `lawful:global-laws` 改表(要開發者批准);pipeline 的 `kind` 或 `!` 列寫錯照簽名不一致那一列分 |
| 對外 I/O 表的契約欄指不到 law | 那一端的承諾沒有 law 守著:新增一條 law 走 `lawful:scope-revise`,或由 `lawful:global-laws` 把契約欄改回「-」 |

`sync` 與 `modules --gen` 是你可以直接做的兩個機械動作,其餘一律回報。

### 2. 需求與里程碑(我們做的是需求要的東西嗎)

從 `status` 的需求表、表後每條需求的「下一條里程碑」、全域 Law 表讀,里程碑與調整的原文開需求檔看,九題:

1. **每條需求的驗收判得出來嗎**:一句話讀得出達成時什麼為真;寫了三行卻沒有驗收測試的列出來;判定來源是測試還是由里程碑全部達成推得。它的里程碑都達成真的等於需求達成嗎,漏了哪一塊(漏的開里程碑)。里程碑全部達成而驗收沒過、調整之後退回未達成的,明寫「驗收沒過」。
2. **里程碑是不是使用者看得到的階段、順序對不對**(`pipelines.md`「願景、需求與里程碑」):每條里程碑那一句話展示得出來嗎、說得出用哪道指令看到成果或呼叫到這個階段的功能嗎;「types 層做好」這種講不出怎麼展示的列出來。表的列序就是先後:後面的里程碑綁的 pipeline 被前面的引用了,順序是反的,列出來。同一條需求有沒有同時開了兩條里程碑(要平行就該拆成兩條需求)。
3. **工作集中在哪個優先**:進行中與最近 REV 的 pipeline 各綁在哪條需求;比最高優先需求的里程碑先做了低優先的,寫明是哪幾條;低優先的那一條是最高優先需求在「依賴」欄列出來的,照實寫它是被依賴的那一條。
4. **誰不朝向任何需求**:沒被任何里程碑綁定的 pipeline、沒有里程碑的需求、沒有優先的需求、綁到不存在的 pipeline 的里程碑(`status` 的警訊)。還沒有切片的里程碑與待修訂的調整列出來但不是問題。
5. **達成說的是實話嗎**:每條達成的里程碑,它綁定的 pipeline 是不是真的涵蓋「做到什麼」那一句;綁得太少的里程碑,達成是假的。
6. **調整有沒有偷渡新 pipeline**:每條調整動到的都是這條需求的里程碑綁定過的 pipeline 嗎、它的 REV 有沒有把需求的驗收引用的 law 列進保護。
7. **一個 stage 是不是只住一條 pipeline**(`pipelines.md`「編號與引用」):`lint sig` 報的同名未註明 → 同一個 stage 與它的 law 在兩條 pipeline 各寫了一次,後做的那一條該改成引用,`lawful:scope-laws <它的全名>`;沒有任何里程碑綁、也沒有任何 pipeline 引用的 pipeline → 問開發者要不要退役。
8. **law 講的是承諾,還是在描述程式碼**(`laws.md`「Law 怎麼談」):每條 pipeline 抽幾條 law,問「寫得出一個讓它變假的實作嗎」。寫不出來的那一條只是把實作念了一遍,它的測試是同義反覆——列出來走 `lawful:scope-laws` 重談(那是調整既有的 law)。反過來,程式碼裡使用者看得到、卻沒有任何 law 守著的行為,列成「目前不是承諾」給開發者過目,不替他決定要不要承諾;要承諾就是新增一條,走 `lawful:scope-revise`。需求與 law 有沒有放錯邊:寫成需求卻沒有做完的一天的、寫成 law 卻有做完的一天的,列出來(`laws.md`「Law 與需求」)。
9. **全域 Law 有沒有膨脹**(`laws.md`「全域 Law」):每條領域不變量過一次准入四條——只引用 types 層嗎、兩條以上的 pipeline 違反得了它嗎、有測試嗎;只有一條 pipeline 碰得到的,列出來建議搬回那條。三類約束是不是都看得到住在 `Cone.md` 的「全域 Law」區;有沒有約束散在需求檔、ADR、決策紀錄或某條 pipeline 的「決定」裡卻沒有可執行形式。這一題只出建議:任何全域 Law 的變更都要開發者明確批准,由 `lawful:global-laws` 落筆。

三句話回答「最高優先的需求離達成還差什麼、有沒有東西在往別的方向走、哪條需求還沒達成、哪條全域 Law 被踩到或還立不住」。需求本身對不對不在這裡判,那是開發者在 `lawful:require-design` 答的。

### 3. 人判 laws

每條 law 先過「什麼要有 law」的兩問,自由度為一的提議刪;再拿種類問法表(`pipelines.md`「節」的 Laws 表)逐種對:該有 invariant 的有沒有、roundtrip 有沒有說哪些欄位不算、bound 有沒有數字、會爆的輸入有沒有 total、手寫的 instance 有沒有 class 法則、`given` 的測試有沒有宣告覆蓋率。缺的寫成提議,**不直接加**。

### 4. 人判邊界

對外 I/O 表有沒有漏列真實的入口與出口(shell 裡 import 了 IO 模組卻沒登記的模組逐個開檔確認);每個效果描述有沒有純解譯器,io pipeline `=` 列的 law 是不是拿它寫的;`!` 列有沒有繞過 `=` 列自己又做了一遍純轉換(繞過去的那一段沒有 law 守著);有沒有 test-only export;對外 I/O 的契約欄是「-」的那幾端,問開發者那一端真的沒有對外的承諾嗎。

### 5. 卡多久了

open 的 GAP、`status` 列成建構中的 `build/` 分支各走到哪一步、停了多久(分支最後一個 commit 距今多久)。卡著的 GAP 擋著整條 pipeline 達成;切片完成卻一直沒有進 scope-laws 的分支,是一片沒有人認領的程式碼。REV 條數最多的 pipeline:同一條反覆 REV,問「這幾次動的是不是同一個東西」,是的話那個東西該拆成一條 subflow 或該重切。

### 6. 報告

一張表:哪裡 / 什麼事 / 怎麼辦,怎麼辦欄寫具體命令(`lawful:scope-laws P-00x-<slug>`、`lawful:scope-revise P-00x-<slug>`、`lawful:require-design`、`lawful:global-laws`、`lawful:build R-n`、`lawful sync`)。每列先答 `tooling.md`「收尾定錨」下一步的四題:答得出必要性(不做它哪條需求停在哪條里程碑、哪條功能無法正常運作)的列成「必要」,答不出的列成「提議」,兩段分開;架構級的列要寫出現在的架構解決不了的那個具體問題。前面加三句話的結論:對帳幾條紅、哪條需求未達成或哪條全域 Law 被踩到與最高優先的需求差什麼、laws 與邊界最值得動的是哪一條。必要段是空的、每條需求達成、全域 Law 三類沒有紅,結論第一句明寫「目前功能全部正常運作,可以加新功能」。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」)。

## 邊界

只有 `sync` 與 `modules --gen` 這兩個機械動作可以直接做;pipeline 的契約(簽名、scope law)照一句話分流:要調整(修改、放寬、替換、刪除)既有的 law 走 `lawful:scope-laws`,law 不動、或只新增 law,而文檔或實作要變走 `lawful:scope-revise`,重複的 stage 改成引用與 pipeline 退役走 `lawful:scope-laws`;全域 Law(領域不變量、四層、對外 I/O)走 `lawful:global-laws`,需求、驗收、里程碑與調整一律走 `lawful:require-design`,願景走 `lawful:kickoff`;不寫測試、不寫實作、不自己補 law。
