---
name: status
description: lawful(有 .lawful/ 的 Haskell 專案)的派工報告:跑 lawful status,用人話講需求達成了沒、全域 Law 有沒有被踩到、目標與里程碑完成度、今天能開幾條線、每條分支走到哪一步、卡住的與建議路線;可畫成看板。觸發詞:進度、狀態、status、今天做什麼、派工、還差什麼、哪些卡住、看板。Use when the developer asks where the project stands or what to do next.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:status — 今天做什麼

> **核心**:Every number and every next step MUST be derived from files, code and test output, never from memory.(每個數字、每個下一步都從檔案、程式碼與測試輸出推出來,不靠記憶、不自己估。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief status --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief status --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief status --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief status --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief status --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief status --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief status` 的輸出:規章、`Cone.md`「專案約束」、專案根目錄看起來像測試輸出的檔,與每一份比最新的原始碼、測試檔新還是舊。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief status --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 步驟

1. **測試輸出**(`tooling.md`「跑東西的紀律」):有最近一次整套的 log 且之後沒動過原始碼與測試,就用它;有動過,或開發者要現況,跑 `Cone.md`「專案約束」的整套指令一次並留檔;都不行就不給,laws 綠幾條列「未跑」,回報寫明。
2. `node "<L>/bin/lawful.mjs" status --tests <log> --html`。`--html` 不影響報告,只是同時畫一份看板並在結尾附上它的 `file://` 網址。
3. **講人話**:不重印報告;先講需求、全域 Law 與目標,再照七段講「今天該做什麼、為什麼」。每段一到三句,pipeline 寫全名;警訊那張表照抄怎麼辦欄。第 1 段的線可以同時各開一波(`roles.md`「分支與所有權」):還沒有切片的里程碑是 `lawful:spike-impl`,`ready` 的 pipeline 是 `lawful:build`;建構中的講它在哪條分支、走到哪一步、下一個動作是誰的(切片完成等 `lawful:law-design`、Law 討論中等開發者拍板、達成等 `lawful:integrate`);報告附了共用單元提示就照講。
   - **需求**(從報告的需求表講):每條需求達成、未達成還是未知,判定來源是驗收測試還是由建置路線推得;建置路線走完卻未達成的、優化後退回未達成的,明講「驗收沒過」;驗收寫了三行卻沒有驗收測試的,講建議路線裡那條 `lawful:build R-n`。答的是「必須達成的事達成了沒」。
   - **全域 Law**(從那兩張表講):三類各自那一道 lint 有沒有紅(架構 `lint boundary`、契約 `lint io`、領域不變量 `lint invariants`),有紅先講這件事:不得違反的約束被踩到了;契約欄指到的 law 幾條成立。領域不變量哪一條未成立(有程式碼違反了全專案的規則,先講這件事)、哪幾條還未知(還沒有三行式,或寫了三行卻沒有測試,講建議路線裡那條 `lawful:build INV-n`)。一條都沒有就一句帶過。
   - **目標**(從目標表講):最高優先還沒達成的目標是哪一個、完成度幾 %、它的下一個里程碑卡在哪條 pipeline、還是還沒有切片;建置路線達成的目標有沒有待修訂或進行中的調整;有沒有 pipeline 不朝向任何目標(沒被綁定)、有沒有目標沒有任何里程碑;正在做的事是不是最高優先目標的里程碑,不是就明講「我們沒有朝向目標」;願景還是模板就先講這件事。
   - **模組**(從模組表講):這批工作落在哪幾個單元、有沒有單元還沒有任何 stage 住進去、有沒有宣告了層卻還沒有程式碼、有沒有程式碼在模組表外面。答的是「東西住在哪」,不是進度。
4. **追問**:開發者問某條 pipeline 或某個模組,跑 `--pipeline <全名>` 或 `--module <M>`;`--module` 給模組單元名就是整個單元、給單一模組就是那一個,逐 stage 講在不在、law 綠不綠。
5. **看板**:看板每次都產,不必等開發者開口。它是一棵從願景往下長到便利貼的樹:一條需求一個區塊(副標寫驗收達成與否),區塊底下目標一層(卡上寫優先、里程碑與調整的達成數)、里程碑與調整一層;引用畫成虛線箭頭,箭頭那一端是被引用的那一條。點便利貼,右邊那一欄換成那一條的細節。側欄首頁另有一段模組:一個單元一列、層是它在原始碼樹裡的落點,列裡的 pipeline 點得進去。工具列的「相依」頁籤把目標(粒度也可切成需求)排成先後順序的圖:左邊先做、右邊後做,邊不是人寫的,是從 pipeline 的引用推出來的(甲目標底下的 pipeline 引用了乙目標底下的,甲就依賴乙),紅色的邊是優先倒掛(高優先依賴低優先),側欄首頁的「相依」段把倒掛與互相依賴列出來。開發者要直接跳出瀏覽器就加 `--open`。看板不取代第 3 步的講人話。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」),下一步從建議路線第一條抄,四題照「收尾定錨」答。建議路線寫「目前功能全部正常運作」,就照抄那一句當下一步,不另造。

最後一行照抄第 2 步印出來的 `file://` 網址,單獨一行,前面一句「看板」,開發者點一下就開。

## 邊界

不改任何檔;數字只來自 `lawful status` 與那一份 log,不自己估。
