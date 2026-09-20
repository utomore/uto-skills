---
name: spike
description: lawful 的可行性驗證 — 讀原始碼答不出、要跑了才知道的問題:先寫要回答什麼、判準、timebox,在 spike/SPK-00x-<slug>/ 寫拋棄式程式碼,結論與 verdict 寫進 .lawful/spikes/,feeds 指向哪條 pipeline 的決定或哪份 ADR,lawful spike close 刪程式碼。觸發詞:spike、可行性、試一下、PoC、原型、驗證可不可行。Use when a design decision needs evidence that only running code can give.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:spike — 替決定生產證據

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief spike` 的輸出:規章、現有的 spike(編號、status、verdict、feeds)與專案根目錄 `spike/` 底下還在的資料夾;給了 `SPK-00x` 就再加那一份全文。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給;接著做既有的一份就給 `SPK-00x`。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike [SPK-00x] --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 步驟

0. **先寫三樣**:要回答什麼(X 在 Y 條件下能不能 Z)、判準(可觀察的數字或現象,feasible / infeasible / partial 各一句)、timebox。寫不出判準就不開。
1. **配號建檔**:`.lawful/spikes/` 裡最大號加一(委派模式下號由 conductor 給),照 `templates/spike.md` 建 `SPK-00x-<slug>.md`,`feeds` 先寫預定餵給哪條 pipeline 的決定或哪份 ADR。
2. **寫程式碼**:只在專案根目錄 `spike/SPK-00x-<slug>/`;候選比較一個候選一個子資料夾。每輪 `RND-n` 各有自己的要驗什麼、判準、timebox;做完 commit,sha 填進那一輪。產品程式碼與測試不得 import 這裡。
3. **判定**:只依判準。timebox 用完沒答案照實寫「未達判準,原因」。
4. **結論**:verdict、一句話、學到什麼、餵給哪裡、沒驗到的;`status: concluded`。
5. **結案**:`lawful spike close SPK-00x --dry-run` 看它會刪什麼,再不帶旗標刪;commit。
6. **餵回去**:結論進 pipeline 的「決定」或 ADR,走 `lawful:revise` 或 `lawful:design`;spike 自己不改那些檔。

## 委派模式

prompt 標明委派模式時:不提問;號、slug、資料夾由 conductor 給;只寫自己的資料夾;回報固定五項:verdict、每條判準的觀察、程式碼路徑與 sha、環境、沒驗到的。結案由 conductor 做。

## 邊界

不改 pipeline、ADR、模組表;verdict 不是裁決。「impl 有沒有做到文檔」與「law 該怎麼寫」不派 spike。
