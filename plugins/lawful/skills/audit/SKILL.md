---
name: audit
description: lawful 的稽核 — lawful lint all 與 status 的機械紅逐條分類(文檔錯還是程式碼錯),同層搬家跑 sync;對需求與目標(每條需求的驗收判得出來嗎、工作是不是集中在最高優先目標、有沒有 pipeline 不朝向任何目標、達成的里程碑是不是真的涵蓋它那句、調整有沒有偷渡新能力);人判每條 pipeline 的 laws 是承諾還是在描述程式碼、有沒有講到該講的性質,全域 Law 有沒有膨脹、邊界有沒有被繞過、卡住多久;產出一張「哪裡 / 什麼事 / 怎麼辦」表,不直接改契約。觸發詞:稽核、audit、檢查文檔、對帳、專案健檢、目標貼合、lawful audit、文檔與程式碼對不上。Use when checking that .lawful and the code still agree, that the work still heads toward the requirements and objectives, and that laws cover what matters.
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

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief audit` 的輸出:規章、`lawful lint all` 的結果、`lawful status` 整份報告(根目錄恰好一份比每個原始碼與測試檔都新的測試輸出時接上它)。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給;有最近一次測試輸出就加 `--tests <log>`。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief audit --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 步驟

### 1. 對帳(機械)

`lawful lint all` 與 `lawful status --tests <log>`(log 照 `lawful:status` 第 1 步拿)。每條紅分類:

| 紅 | 處置 |
|---|---|
| 簽名不一致 | 看兩邊誰對:文檔錯走 `lawful:revise`,程式碼錯列給 refactor |
| 同層搬家 | 直接 `lawful sync` |
| 未登記模組 | `lawful modules --gen` 再請開發者填職責 |
| 沒匯出的 stage、沒有匯出清單的模組 | 宣告的事:走 `lawful:revise` |
| 跨層 import、core 碰效果型別、production import `*.Internal`、`=` 列在 shell | 結構問題,列給開發者 |
| law 的識別字對不到 | 少一個觀察點 → 補 `o` 列走 `lawful:revise` |
| 幽靈引用 | 測試還在守一條已經不存在的 law,刪測試 |
| 未翻譯 | 那條 law 沒有測試,下一波 build 派 qa |
| 需求的驗收或領域不變量寫了三行卻沒有測試 | `lawful:build R-n` / `INV-n`,只派 qa(`roles.md`「驗收測試」) |
| `lint global` 的紅(架構、契約、領域不變量) | 不得違反的約束被踩到:先歸因到哪一條 pipeline 的程式碼違反了它,改程式碼;覺得該改的是那條全域 Law,列成給開發者的變更建議(`lawful:revise` 落筆),不自己改 |
| 領域不變量的三行引用了某條 pipeline 的簽名 | 它不是全專案的規則:搬回那條 pipeline 當它的 scope law(`lawful:revise`,全域 Law 的變更要開發者批准),或改成只引用 types 層 |
| 對外 I/O 對不上 IO 介面、契約欄指不到 law | 那一端的承諾沒有 law 守著:補 law 走 `lawful:revise`,或把契約欄改回「-」 |

`sync` 與 `modules --gen` 是你可以直接做的兩個機械動作,其餘一律回報。

### 2. 需求與目標(我們做的是需求要的東西嗎)

從 `status` 的需求表、領域不變量表與目標表讀,七題:

1. **每條需求的驗收判得出來嗎**:一句話讀得出達成時什麼為真;寫了三行卻沒有驗收測試的列出來;判定來源是測試還是由建置路線推得。一條需求有多個目標時,那幾個目標都達成真的等於需求達成嗎,漏了哪一塊(漏的開里程碑)。建置路線全部達成而需求未達成、優化後退回未達成的,明寫「驗收沒過」。
2. **工作集中在哪個優先**:進行中與最近 REV 的 pipeline 各綁在哪個目標;比最高優先目標的里程碑先做了低優先的,寫明是哪幾條。
3. **誰不朝向任何目標**:沒被任何里程碑綁定的 pipeline、沒有目標的需求、沒有里程碑的目標、綁到不存在的 pipeline 的里程碑(`status` 的警訊)。還沒有切片的里程碑與待修訂的調整列出來但不是問題。
4. **完成度說的是實話嗎**:每條達成的里程碑,它綁定的 pipeline 是不是真的涵蓋「做到什麼」那一句;綁得太少的里程碑完成度是假的。
5. **調整有沒有偷渡新能力**:每條調整動到的都是本目標里程碑綁定過的 pipeline 嗎、它的 REV 有沒有把需求的驗收引用的 law 列進保護。
6. **law 講的是承諾,還是在描述程式碼**(`laws.md`「Law 怎麼談」):每條 pipeline 抽幾條 law,問「寫得出一個讓它變假的實作嗎」。寫不出來的那一條只是把實作念了一遍,它的測試是同義反覆——列出來走 `lawful:revise` 重談。反過來,程式碼裡使用者看得到、卻沒有任何 law 守著的行為,列成「目前不是承諾」給開發者過目,不替他決定要不要承諾。
7. **全域 Law 有沒有膨脹**(`laws.md`「全域 Law」):每條領域不變量過一次准入四條——只引用 types 層嗎、兩條以上的 pipeline 違反得了它嗎、有測試嗎;只有一條 pipeline 碰得到的,列出來建議搬回那條。三類約束是不是都看得到住在 `Cone.md` 的「全域 Law」區;有沒有約束散在 ADR、決策紀錄或某條 pipeline 的「決定」裡卻沒有可執行形式。這一題只出建議:任何全域 Law 的變更都要開發者明確批准,由 `lawful:revise` 落筆。

三句話回答「最高優先的目標離達成還差什麼、有沒有東西在往別的方向走、哪條需求還沒達成、哪條全域 Law 被踩到或還立不住」。目標本身對不對不在這裡判,那是開發者在 `lawful:objective` 答的兩問。

### 3. 人判 laws

每條 law 先過「什麼要有 law」的兩問,自由度為一的提議刪;再拿種類問法表(`pipelines.md`「節」的 Laws 表)逐種對:該有 invariant 的有沒有、roundtrip 有沒有說哪些欄位不算、bound 有沒有數字、會爆的輸入有沒有 total、手寫的 instance 有沒有 class 法則、`given` 的測試有沒有宣告覆蓋率。缺的寫成提議,**不直接加**。

### 4. 人判邊界

對外 I/O 表有沒有漏列真實的入口與出口(shell 裡 import 了 IO 模組卻沒登記的模組逐個開檔確認);每個效果描述有沒有純解譯器,IO 介面 `=` 列的 law 是不是拿它寫的;`!` 列有沒有繞過 `=` 列自己又做了一遍純轉換(繞過去的那一段沒有 law 守著);有沒有 test-only export;對外 I/O 的契約欄是「-」的那幾端,問開發者那一端真的沒有對外的承諾嗎。

### 5. 卡多久了

open 的 GAP、`status` 列成建構中的 `build/` 分支各走到哪一步、停了多久(分支最後一個 commit 距今多久)。卡著的 GAP 擋著整條 pipeline 達成;切片完成卻一直沒有進 law-design 的分支,是一片沒有人認領的程式碼。REV 條數最多的 pipeline:同一條反覆 REV,問「這幾次動的是不是同一個東西」,是的話那個東西該拆成子流或該重切。

### 6. 報告

一張表:哪裡 / 什麼事 / 怎麼辦,怎麼辦欄寫具體命令(`lawful:revise P-00x-<slug>`、`lawful:objective`、`lawful:project`、`lawful:build R-n`、`lawful sync`)。每列先答 `tooling.md`「收尾定錨」下一步的四題:答得出必要性(不做它哪條需求的哪個目標停在哪條里程碑、哪條功能無法正常運作)的列成「必要」,答不出的列成「提議」,兩段分開;架構級的列要寫出現在的架構解決不了的那個具體問題。前面加三句話的結論:對帳幾條紅、哪條需求未達成或哪條全域 Law 被踩到與最高優先的目標差什麼、laws 與邊界最值得動的是哪一條。必要段是空的、每條需求達成、全域 Law 三類沒有紅,結論第一句明寫「目前功能全部正常運作,可以加新功能」。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」)。

## 邊界

只有 `sync` 與 `modules --gen` 這兩個機械動作可以直接做;契約(簽名、law、層、對外 I/O)與全域 Law 一律走 `lawful:revise`,願景與需求走 `lawful:project`,目標、里程碑與調整一律走 `lawful:objective`;不寫測試、不寫實作、不自己補 law。
