---
name: project
description: dev-flow 的立案 — 訪談後產出 .design/system.md(願景、目的、語言與工具、由內而外的層、對外 I/O 表含信任與驗證、Features 清單)、objectives.md(至少一個目標,各有優先 1 到 4 與里程碑)與 modules.md 模組表,跨文檔的決定寫 ADR,每條要交付的能力用 devflow claim 建成 draft 的 feature 並綁進里程碑。觸發詞:立案、開新專案、專案願景、系統設計、主架構、dev-flow project、建 .design、模組表、層、技術選型。Use when starting a project or reshaping its vision, layers, boundaries and feature list.
user-invocable: true
---

# dev-flow:project — 立案與邊界

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/features.md`「`.design/`」「system.md」「願景、目標與里程碑」「ADR」、`rules/boundary.md` 全份、`rules/tooling.md`「language adapter」「收尾定錨」。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者的意圖、既有程式碼(有的話) | `.design/system.md`(含願景)、`.design/objectives.md`(至少一個目標與它的里程碑)、`.design/modules.md`、需要的 `adr/`、每條要交付的能力一份 `draft` feature,各綁進一條里程碑 |

## 步驟

1. **看現況。** 有 `.design/system.md` 就是更新模式:只改開發者點名的節,其餘不動。有 `.design/subsystems/` 的舊樹 → `devflow migrate .design --language <adapter>` 印帳本,帶開發者逐項判,再照本 skill 建新樹。
2. **訪談,一題一題問,不確定就再問**:
   - **願景**:這個專案做完時世界長什麼樣、替誰改變了什麼,一到三句。這是之後每個目標都要對得上的那一句,先訂它;訂不出來就先不往下。寫進 `## 願景`。
   - **目的**:替誰做什麼、明確不做什麼。寫進 `## 目的`,是之後每次「這件事在不在規劃裡」的判準。
   - **目標**:通往願景的第一步是什麼、還有哪幾步;每個目標問優先(1 到 4)、達成時看得到什麼(判準)、它服務願景的哪一句。至少一個。這一段交給 `dev-flow:objective` 的對談寫,本 skill 只確認第一個目標與它的第一條里程碑存在。
   - **語言與工具**:語言(決定 adapter);建置、整套測試、子集測試三道指令——子集指令從 CI 設定、`Makefile`、`package.json` 或測試框架說明找,找不到問一次。這一行不問,之後每個角色都只會退回去跑整庫。
   - **層**:這個專案由內而外分幾層、各叫什麼、各裝什麼。規則只有兩條(`boundary.md`「層」),層名由專案自己取;小工具一層也行。
   - **對外 I/O**:每個跨過最外層的入口與出口叫什麼、帶什麼型別、**信任誰**(內容由系統外面決定的是 `untrusted`)。
   - **要交付什麼**:列出使用者做得到的事,每一條是一份 feature,各屬於哪個目標的哪條里程碑。**這裡列的是「完成這個產品需要哪些」,不是「這一版先做哪些」**——先後歸目標的優先與里程碑的順序,不影響清單。
3. **切層與模組表**:有程式碼就 `devflow modules --gen` 生成一個檔一列,人填層欄再把同層合併成 `目錄/**`;沒有程式碼就先列預期的目錄。
4. **寫檔**:`system.md` 照 `templates/system.md` 六節;`modules.md` 一張表。層怎麼切、選了什麼外部系統這種跨文檔決定,`devflow claim adr <slug>` 建 ADR。
5. **訂目標與里程碑**:`devflow objective add <一句話> --priority <1-4> --criteria <句>` 至少一個,每個目標 `devflow objective milestone <O-n> <一句話>` 至少一條;多個目標或要細談的,走 `dev-flow:objective`。
6. **建 feature 骨架**:每條要交付的能力 `devflow claim feature <slug> --description <句> --milestone <M-n>`,得到 `draft` 的檔、Features 表的一列與里程碑的綁定。內容交給 `dev-flow:feature`。
7. `devflow lint boundary`、`devflow lint io`、`devflow status`:層、模組表、對外 I/O 表與程式碼對得上,願景與目標的警訊為空,才收。

## 收尾

回報願景一句、目標幾個(各優先)、里程碑幾條、建了哪些檔、feature 幾份、模組表幾個檔案還沒填層;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律是 `dev-flow:feature <最高優先目標第一條里程碑綁定的第一份 feature 全名>`。

## 邊界

不寫 feature 的 Steps 與 laws;不寫任何程式碼;不替開發者決定願景、目標的優先、語言或層數;不建 abstract(那是 `dev-flow:refactor` 從既有 feature 收整出來的,不是先驗地切出來的)。
