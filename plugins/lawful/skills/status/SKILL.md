---
name: status
description: lawful 的派工報告 — 跑 lawful status(接上最近一次測試輸出),用人話講今天能開幾條線、卡住的、等決定、牽動誰、待實作、警訊、建議路線;--pipeline / --module 追問單條或單模組,--html 把同一份報告畫成便利貼看板。觸發詞:進度、狀態、status、今天做什麼、派工、看板、畫成圖、便利貼、lawful status、哪些卡住。Use when the developer asks where the project stands or what to do next.
user-invocable: true
---

# lawful:status — 今天做什麼

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/tooling.md`「CLI」「status 報告」「收尾定錨」、`rules/pipelines.md`「願景、目標與里程碑」「完成度」。

## 步驟

1. **測試輸出**(`tooling.md`「跑東西的紀律」):有最近一次整套的 log 且之後沒動過 `src/` 與測試,就用它;有動過,或開發者要現況,跑 `system.md` 的整套指令一次並留檔;都不行就不給,laws 綠幾條列「未跑」,回報寫明。
2. `node "<L>/bin/lawful.mjs" status --tests <log>`。
3. **講人話**:不重印報告;先講願景與目標,再照七段講「今天該做什麼、為什麼」。每段一到三句,pipeline 寫全名;警訊那張表照抄怎麼辦欄。第 1 段的線可以同時各開一波(`roles.md`「分支與所有權」),建構中的講它在哪條分支等整合;報告附了共用模組提示就照講。
   - **願景與目標**(從報告開頭的願景行與目標表講):最高優先還沒達成的目標是哪一個、完成度幾 %、它的下一個里程碑卡在哪條 pipeline;有沒有 pipeline 不朝向任何目標(沒被綁定)、有沒有目標沒有任何里程碑;正在做的事是不是最高優先目標的里程碑,不是就明講「我們沒有朝向目標」;願景還是模板就先講這件事。
4. **追問**:開發者問某條 pipeline 或某個模組,跑 `--pipeline <全名>` 或 `--module <M>`,逐 stage 講在不在、law 綠不綠。
5. **看板**:開發者要看圖、要一眼看清楚哪條牽動哪條,跑 `status --html <檔名>`(同樣接 `--tests`),回報寫出來的路徑叫他用瀏覽器打開,講清楚那是一棵從願景往下長到便利貼的樹;不改用講的取代第 3 步。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」),下一步從建議路線第一條抄,四題照「收尾定錨」答。建議路線寫「目前功能全部正常運作」,就照抄那一句當下一步,不另造。

## 邊界

不改任何檔;數字只來自 `lawful status` 與那一份 log,不自己估。
