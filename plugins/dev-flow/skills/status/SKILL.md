---
name: status
description: dev-flow(有 .design/ 的專案)的派工報告:跑 devflow status,用人話講每條需求達成了沒與它的里程碑走到哪、全域 Law 有沒有被踩到、今天能開幾條線、每條分支走到哪一步、卡住的與建議路線;可畫成看板。觸發詞:進度、狀態、status、今天做什麼、派工、還差什麼、哪些卡住、看板。Use when the developer asks where the project stands or what to do next.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:status — 今天做什麼

> **核心**:Every number and every next step MUST be derived from files, code and test output, never from memory.(每個數字、每個下一步都從檔案、程式碼與測試輸出推出來,不靠記憶、不自己估。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief status --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief status --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief status --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief status --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段(一份輸出切成幾段,每段一道指令)是載入 skill 時跑 `devflow brief status` 的輸出:規章、`system.md`「語言與工具」、專案根目錄看起來像測試輸出的檔,與每一份比最新的原始碼、測試檔新還是舊。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief status --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 步驟

1. **測試輸出**(`tooling.md`「跑東西的紀律」):有最近一次整套的 log 且之後沒動過原始碼與測試,就用它;有動過,或開發者要現況,跑 `system.md` 的整套指令一次並留檔;都不行就不給,laws 綠幾條列「未跑」,回報寫明。
2. `node "<D>/bin/devflow.mjs" status --tests <log> --html`(多語言專案每側一份:`--tests <目錄>=<log>,<目錄>=<log>`)。`--html` 不影響報告,只是同時畫一份看板並在結尾附上它的 `file://` 網址。
3. **講人話**:不重印報告;先講需求與全域 Law,再照八段講「今天該做什麼、為什麼」。每段一到三句,文檔與里程碑都寫全名(`F-001-checkout`、`M-1-checkout`);警訊那張表照抄怎麼辦欄。第 1 段的線可以同時各開一波(`roles.md`「分支與所有權」):還沒有切片的里程碑是 `dev-flow:spike-impl`,`ready` 的文檔是 `dev-flow:build`;建構中的講它在哪條分支、走到哪一步、下一個動作是誰的(切片完成等 `dev-flow:scope-laws`、Law 討論中等開發者拍板、達成等 `dev-flow:integrate`);報告附了共用檔案提示就照講。要改既有文檔的線照一句話分流講:要調整(修改、放寬、替換、刪除)既有的 law 是 `dev-flow:scope-laws`;law 不動、或只新增 law,而文檔或實作要變(含待修訂的調整 `RF-n`)是 `dev-flow:scope-revise`;全域 Law 是 `dev-flow:global-laws`;需求面的條目是 `dev-flow:require-design`。open 的 GAP 照同一句講回答該走哪一個。
   - **需求**(從報告的需求表與每條需求底下的里程碑、調整講):每條需求達成、未達成還是未知,判定來源是驗收測試還是由里程碑全部達成推得;里程碑全部達成而驗收沒過的(里程碑切漏了,或驗收寫錯,回 `dev-flow:require-design`)、調整之後退回未達成的,明講「驗收沒過」;驗收寫了三行卻沒有驗收測試的,講建議路線裡那條 `dev-flow:build R-n`。需求表的「依賴」欄講哪條需求疊在哪條上面(從文檔的引用推的,不是人寫的):互不依賴的可以同時開工,有依賴的,被依賴的那條沒達成,依賴它的就還不算達成。最高優先還沒達成的需求是哪一條、里程碑達成幾條、它的下一條里程碑卡在哪份文檔或還沒有切片;里程碑全部達成的需求有沒有待修訂或進行中的調整;有沒有 feature 沒被任何里程碑綁定、有沒有需求沒有里程碑;正在做的事是不是最高優先需求的下一條里程碑,不是就明講;願景還是模板就先講這件事。答的是「必須達成的事達成了沒、我們有沒有朝向需求」。
   - **全域 Law**(從那兩張表講):三類各自那一道 lint 有沒有紅(架構 `lint boundary`、契約 `lint io`、領域不變量 `lint invariants`),有紅先講這件事:不得違反的約束被踩到了;契約欄指到的 law 幾條成立。領域不變量哪一條未成立(有程式碼違反了全專案的規則,先講這件事)、哪幾條還未知(還沒有三行式,或寫了三行卻沒有測試,講建議路線裡那條 `dev-flow:build INV-n`)。一條都沒有就一句帶過。
   - 第 6 段(修訂熱點)講的是穩定度:一直在改的地方是設計還沒收斂,被很多份引用的那一份文檔是改動半徑最大的地方。
4. **追問**:開發者問某份文檔或某個檔案,跑 `--doc <全名>` 或 `--module <路徑>`,逐 step 講在不在、law 綠不綠。
5. **看板**:看板每次都產,不必等開發者開口。它是一棵從願景往下長到便利貼的樹:一條需求一個區塊(寫優先、驗收達成與否、里程碑與調整的達成數),區塊底下里程碑與調整一層(里程碑照先後排);引用畫成虛線箭頭,箭頭那一端是被引用的那一份。點便利貼,右邊那一欄換成那一份的細節。工具列的「相依」頁籤把需求排成先後順序的圖:左邊先做、右邊後做,邊不是人寫的,是從 feature 的引用推出來的(甲需求底下的 feature 引用了乙需求底下的,甲就依賴乙),紅色的邊是優先倒掛(高優先依賴低優先),側欄首頁的「相依」段把倒掛與互相依賴列出來。開發者要直接跳出瀏覽器就加 `--open`。看板不取代第 3 步的講人話。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」),下一步從建議路線第一條抄,四題照「收尾定錨」答。建議路線寫「目前功能全部正常運作」,就照抄那一句當下一步,不另造。

最後一行照抄第 2 步印出來的 `file://` 網址,單獨一行,前面一句「看板」,開發者點一下就開。

## 邊界

不改任何檔;數字只來自 `devflow status` 與那一份 log,不自己估。
