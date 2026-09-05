---
name: status
description: lawful 的派工報告 — 跑 lawful status(接上最近一次測試輸出),用人話講今天能開幾條線、卡住的、等決定、牽動誰、待實作、警訊、建議路線;--pipeline / --module 追問單條或單模組。觸發詞:進度、狀態、status、今天做什麼、派工、lawful status、哪些卡住。Use when the developer asks where the project stands or what to do next.
user-invocable: true
---

# lawful:status — 今天做什麼

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/tooling.md`「CLI」「status 報告」「收尾定錨」、`rules/pipelines.md`「完成度」。

## 步驟

1. **測試輸出**(`tooling.md`「跑東西的紀律」):有最近一次整套的 log 且之後沒動過 `src/` 與測試,就用它;有動過,或開發者要現況,跑 `system.md` 的整套指令一次並留檔;都不行就不給,laws 綠幾條列「未跑」,回報寫明。
2. `node "<L>/bin/lawful.mjs" status --tests <log>`。
3. **講人話**:不重印報告;照七段講「今天該做什麼、為什麼」。每段一到三句,pipeline 寫全名;警訊那張表照抄怎麼辦欄。
4. **追問**:開發者問某條 pipeline 或某個模組,跑 `--pipeline <全名>` 或 `--module <M>`,逐 stage 講在不在、law 綠不綠。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」),下一步從建議路線第一條抄。

## 邊界

不改任何檔;數字只來自 `lawful status` 與那一份 log,不自己估。
