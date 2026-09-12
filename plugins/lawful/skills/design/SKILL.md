---
name: design
description: lawful 的系統設計 — 訪談後產出 .lawful/system.md(願景、目的、語言與工具含模組前綴與原始碼根目錄、四層邊界、對外 I/O、pipeline 清單含 IO 介面與子流)、objectives.md(至少一個目標,各有優先 1 到 4 與里程碑)與 modules.md 模組單元表,跨 pipeline 的決定寫 ADR,每條 IO 介面用 lawful claim 建成 draft 並綁進里程碑。觸發詞:系統設計、開新專案、專案願景、lawful design、建 .lawful、模組表、邊界、IO 介面。Use when starting a pure-functional project or reshaping its vision, layers and pipeline list.
user-invocable: true
---

# lawful:design — 系統與邊界

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/pipelines.md`「`.lawful/`」「system.md」「願景、目標與里程碑」「ADR」、`rules/boundary.md` 全份、`rules/tooling.md`「language adapter」「收尾定錨」。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者的意圖、既有程式碼(有的話) | `.lawful/system.md`(含願景)、`.lawful/objectives.md`(至少一個目標與它的里程碑)、`.lawful/modules.md`(一列一個模組單元)與四棵原始碼樹裡的資料夾、需要的 `adr/`、每條 IO 介面一份 `draft` pipeline,各綁進一條里程碑 |

## 步驟

1. **看現況。** 有 `.lawful/` 就是更新模式:只改開發者點名的節,其餘不動。沒有就建。
2. **訪談,一題一題問**:**願景**先問:這個專案要交出的、世界上還沒有的東西是什麼,替誰改變了什麼,第一段一到三句(後面要展開就展開),訂不出來就先不往下,寫進 `## 願景`;它是北極星,不是驗收清單,之後的目標不對它逐句對照;再問這個系統替誰做什麼、不做什麼;語言(決定 adapter)與效果的寫法(直接 `IO`、mtl、effectful 這類效果系統;專案自己的 App monad 寫進「效果型別追加」);建置、整套測試、子集測試三道指令,子集指令從 CI 設定或測試框架說明找,找不到問一次;跨過 shell 的每個入口與出口叫什麼、帶什麼型別。
3. **劃模組單元**(`boundary.md`「模組單元」「四層」「效果的判定」):先問這個專案的模組前綴,以及四層各自的原始碼根目錄怎麼命名(預設 `src-<層>`,各是建置系統的一個子函式庫,`build-depends` 照 types ← effect ← core ← shell 宣告一次,相依方向就由編譯器擋),寫進「語言與工具」。再把系統切成幾個單元,每個單元一句職責、有哪幾層:哪些型別住 types、有沒有效果的描述要住 effect(描述與它的純解譯器同層,真解譯器住 shell)、純轉換住 core、碰對外 I/O 的進入點住 shell。有程式碼就 `lawful modules --gen` 從模組名推出單元與層,人填職責;沒有程式碼就每個單元跑一次 `lawful module <名稱> --layers <…> --responsibility <一句話>`。要細談某一個單元的範圍,走 `lawful:module`。
4. **列 IO 介面**:兩端碰到 shell 的資料流各一條。這張表是 `lawful status` 的分母;先後不在這裡,在目標與里程碑。
5. **寫檔**:`system.md` 照 `templates/system.md` 六節;`modules.md` 一張表。層怎麼切、效果 ADT 的形狀這種跨 pipeline 決定,寫 `adr/ADR-00x-<slug>.md`(`templates/adr.md`)。
6. **訂目標與里程碑**:先跟開發者訂優先 1 到 4 在這個專案各代表什麼,寫成 `objectives.md` 開頭一行「優先:1 = …;2 = …;3 = …;4 = …」;再 `lawful objective add <一句話> --priority <1-4> --criteria <句>` 至少一個(What / How / Which 三問,`lawful:objective`),每個目標 `lawful objective milestone <O-n> <一句話>` 至少一條,還沒有 pipeline 的不綁;多個目標或要細談的,走 `lawful:objective`。
7. **建 pipeline 骨架**:每條 IO 介面 `lawful claim <slug> --description <句> --milestone <M-n>`(slug 是 `<領域名詞>-<動詞>`,領域名詞是 `=` 列會住的那個單元,pipelines.md「編號與引用」),得到 `draft` 的檔、system.md 的一列(類別欄填「IO 介面」)與里程碑的綁定。內容交給 `lawful:pipeline`。
8. `lawful lint boundary`、`lawful lint io`、`lawful status`:模組表、對外 I/O 表與程式碼對得上,願景與目標的警訊為空,才收。

## 收尾

回報願景一句、目標幾個(各優先)、里程碑幾條、建了哪些檔、IO 介面幾條、模組表幾個單元、各幾層、幾個還沒填職責;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律是 `lawful:pipeline <最高優先目標第一條里程碑綁定的第一條 pipeline 全名>`。

## 邊界

不寫 pipeline 的 Stages 與 laws;不寫任何程式碼;不替開發者決定願景、目標的優先或語言。
