---
name: design
description: lawful 的系統設計 — 訪談後產出 .lawful/system.md(願景、目的、語言與工具、四層邊界、對外 I/O、pipeline 清單含 IO 介面與子流)、objectives.md(至少一個目標,各有優先 1 到 4 與里程碑)與 modules.md 模組表,跨 pipeline 的決定寫 ADR,每條 IO 介面用 lawful claim 建成 draft 並綁進里程碑。觸發詞:系統設計、開新專案、專案願景、lawful design、建 .lawful、模組表、邊界、IO 介面。Use when starting a pure-functional project or reshaping its vision, layers and pipeline list.
user-invocable: true
---

# lawful:design — 系統與邊界

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/pipelines.md`「`.lawful/`」「system.md」「願景、目標與里程碑」「ADR」、`rules/boundary.md` 全份、`rules/tooling.md`「language adapter」「收尾定錨」。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者的意圖、既有程式碼(有的話) | `.lawful/system.md`(含願景)、`.lawful/objectives.md`(至少一個目標與它的里程碑)、`.lawful/modules.md`、需要的 `adr/`、每條 IO 介面一份 `draft` pipeline,各綁進一條里程碑 |

## 步驟

1. **看現況。** 有 `.lawful/` 就是更新模式:只改開發者點名的節,其餘不動。沒有就建。
2. **訪談,一題一題問**:**願景**先問:這個專案做完時世界長什麼樣、替誰改變了什麼,一到三句,訂不出來就先不往下,寫進 `## 願景`;再問這個系統替誰做什麼、不做什麼;語言(決定 adapter)與效果的寫法(直接 `IO`、mtl、effectful 這類效果系統;專案自己的 App monad 寫進「效果型別追加」);建置、整套測試、子集測試三道指令,子集指令從 CI 設定或測試框架說明找,找不到問一次;跨過 shell 的每個入口與出口叫什麼、帶什麼型別。
3. **切四層**(`boundary.md`「四層」「效果的判定」):哪些型別住 types、有沒有效果的描述要住 effects、每個效果描述的純解譯器與真解譯器各住哪、pure 的根模組、shell 的進入點。有程式碼就 `lawful modules --gen` 生成模組表,人只填層欄;沒有程式碼就列預期的模組。
4. **列 IO 介面**:兩端碰到 shell 的資料流各一條。這張表是 `lawful status` 的分母;先後不在這裡,在目標與里程碑。
5. **寫檔**:`system.md` 照 `templates/system.md` 六節;`modules.md` 一張表。層怎麼切、效果 ADT 的形狀這種跨 pipeline 決定,寫 `adr/ADR-00x-<slug>.md`(`templates/adr.md`)。
6. **訂目標與里程碑**:`lawful objective add <一句話> --priority <1-4> --criteria <句>` 至少一個,每個目標 `lawful objective milestone <O-n> <一句話>` 至少一條;多個目標或要細談的,走 `lawful:objective`。
7. **建 pipeline 骨架**:每條 IO 介面 `lawful claim <slug> --description <句> --milestone <M-n>`,得到 `draft` 的檔、system.md 的一列(類別欄填「IO 介面」)與里程碑的綁定。內容交給 `lawful:pipeline`。
8. `lawful lint boundary`、`lawful lint io`、`lawful status`:模組表、對外 I/O 表與程式碼對得上,願景與目標的警訊為空,才收。

## 收尾

回報願景一句、目標幾個(各優先)、里程碑幾條、建了哪些檔、IO 介面幾條、模組表幾個模組還沒填層;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律是 `lawful:pipeline <最高優先目標第一條里程碑綁定的第一條 pipeline 全名>`。

## 邊界

不寫 pipeline 的 Stages 與 laws;不寫任何程式碼;不替開發者決定願景、目標的優先或語言。
