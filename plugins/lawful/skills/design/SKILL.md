---
name: design
description: lawful 的系統設計 — 訪談後產出 .lawful/system.md(目的、語言與工具、四層邊界、對外 I/O、里程碑 pipeline 清單)與 modules.md 模組表,跨 pipeline 的決定寫 ADR,每條里程碑用 lawful claim 建成 draft。觸發詞:系統設計、開新專案、lawful design、建 .lawful、模組表、邊界、里程碑。Use when starting a pure-functional project or reshaping its layers and milestones.
user-invocable: true
---

# lawful:design — 系統與邊界

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/pipelines.md`「`.lawful/`」「system.md」「ADR」、`rules/boundary.md` 全份、`rules/tooling.md`「language adapter」「收尾定錨」。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者的意圖、既有程式碼(有的話) | `.lawful/system.md`、`.lawful/modules.md`、需要的 `adr/`、每條里程碑一份 `draft` pipeline |

## 步驟

1. **看現況。** 有 `.lawful/` 就是更新模式:只改開發者點名的節,其餘不動。沒有就建。
2. **訪談,一題一題問**:這個系統替誰做什麼、不做什麼;語言(決定 adapter);建置、整套測試、子集測試三道指令,子集指令從 CI 設定或測試框架說明找,找不到問一次;跨過 shell 的每個入口與出口叫什麼、帶什麼型別。
3. **切四層**(`boundary.md`「四層」):哪些型別住 types、有沒有效果的描述要住 effects、pure 的根模組、shell 的進入點。有程式碼就 `lawful modules --gen` 生成模組表,人只填層欄;沒有程式碼就列預期的模組。
4. **列里程碑**:兩端碰到 shell 的資料流各一條,按交付順序排。這張表是 `lawful status` 的分母。
5. **寫檔**:`system.md` 照 `templates/system.md` 五節;`modules.md` 一張表。層怎麼切、效果 ADT 的形狀這種跨 pipeline 決定,寫 `adr/ADR-00x-<slug>.md`(`templates/adr.md`)。
6. **建 pipeline 骨架**:每條里程碑 `lawful claim <slug> --description <句>`,得到 `draft` 的檔與 system.md 的一列,類別欄填「里程碑」。內容交給 `lawful:pipeline`。
7. `lawful lint boundary`:模組表與程式碼對得上才收。

## 收尾

回報建了哪些檔、里程碑幾條、模組表幾個模組還沒填層;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律是 `lawful:pipeline <第一條里程碑全名>`。

## 邊界

不寫 pipeline 的 Stages 與 laws;不寫任何程式碼;不替開發者決定語言或里程碑順序。
