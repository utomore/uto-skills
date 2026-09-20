---
name: impl
description: lawful 的 impl 角色 — 讀 pipeline 文檔與骨架,把每個 stub 換成實作,私有 helper 可以,簽名與型別不動;非改簽名不可就開 GAP;不讀寫測試。觸發詞:實作、填實作、impl、lawful impl。Use when filling a pipeline's skeleton bodies without touching tests or signatures.
user-invocable: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:impl — stub 換實作

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief impl --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief impl --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief impl --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief impl --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief impl --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief impl --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief impl` 的輸出:規章、目標 pipeline 全文、逐條狀態、Stages 上每條簽名與型別的宣告、types 層(行數上限以內的全文,其餘列匯出)、要開的檔(哪幾個檔、哪幾條還是骨架、子集指令、不准碰的測試檔清單)。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:Skill 的 args:`<pipeline 全名> --root <工作樹>`。看到的若是那道指令的原文而不是它的輸出,自己跑一次:`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief impl <目標> --root <工作樹>`(`${CLAUDE_PLUGIN_ROOT}` 是本 skill 基準目錄往上兩層);目標 pipeline 在這一場裡變過,重跑一次並加 `--no-rules`。輸出的第一行是指紋,回報的第一項照抄它。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| Skill 的 args:`<pipeline 全名> --root <工作樹>`;其餘由開工 context 給(要開的檔、還是骨架的簽名、子集測試指令) | stub 全部換成實作;回報六項 |

## 步驟

1. **逐 stage**:讀 Brief 與該 stage 的「做什麼」,再讀掛在它上面的 laws;實作要讓每條 law 成立,不只讓 example 過。
2. **層的紀律**:core 層不 import shell 與 IO 模組、簽名不出現效果;要的私有 helper 寫在同一模組,不匯出。
3. **簽名或型別不夠用**(非改簽名不可、缺一個型別建構子):停這一個 stage,GAP 四欄寫進回報;其餘 stage 照做。不自己改簽名,不改 types 層。
4. **互動模式跑子集一次;委派模式不跑**,conductor 手上有基線。
5. **回報六項**:指紋(開工 context 的第一行,照抄);改了哪些檔;簽名 n / m 實作了幾條、測試結果與每條紅的歸因(不裁決);自己決定的事(資料結構、演算法);GAP 清單;阻塞項。

## 邊界

不讀、不寫、不改任何測試檔;不改簽名與型別;不 import `spike/`;測試全綠也不把有 open GAP 的 stage 當完成。
