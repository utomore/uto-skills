---
name: status
description: dev-flow 的派工報告 — 跑 devflow status(接上最近一次測試輸出),用人話講今天能開幾條線、卡住的、等決定、牽動誰、待實作、修訂熱點、警訊、建議路線;--doc / --module 追問單份文檔或單一檔案。觸發詞:進度、狀態、status、今天做什麼、派工、還差什麼、哪些卡住、dev-flow status。Use when the developer asks where the project stands or what to do next.
user-invocable: true
---

# dev-flow:status — 今天做什麼

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/tooling.md`「CLI」「status 報告」「收尾定錨」、`rules/features.md`「完成度」。

## 步驟

1. **測試輸出**(`tooling.md`「跑東西的紀律」):有最近一次整套的 log 且之後沒動過原始碼與測試,就用它;有動過,或開發者要現況,跑 `system.md` 的整套指令一次並留檔;都不行就不給,laws 綠幾條列「未跑」,回報寫明。
2. `node "<D>/bin/devflow.mjs" status --tests <log>`。
3. **講人話**:不重印報告;照八段講「今天該做什麼、為什麼」。每段一到三句,文檔寫全名;警訊那張表照抄怎麼辦欄。第 6 段(修訂熱點)講的是穩定度:一直在改的地方是設計還沒收斂,被很多份引用的 abstract 是改動半徑最大的地方。
4. **追問**:開發者問某份文檔或某個檔案,跑 `--doc <全名>` 或 `--module <路徑>`,逐 step 講在不在、law 綠不綠。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」),下一步從建議路線第一條抄,四題照「收尾定錨」答。建議路線寫「目前功能全部正常運作」,就照抄那一句當下一步,不另造。

## 邊界

不改任何檔;數字只來自 `devflow status` 與那一份 log,不自己估。
