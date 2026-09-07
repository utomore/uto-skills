---
name: project
description: dev-flow 的立案 — 訪談後產出 .design/system.md(目的與期望、語言與工具、由內而外的層、對外 I/O 表含信任與驗證、Features 清單)與 modules.md 模組表,跨文檔的決定寫 ADR,每條要交付的能力用 devflow claim 建成 draft 的 feature。觸發詞:立案、開新專案、專案目標、系統設計、主架構、dev-flow project、建 .design、模組表、層、技術選型。Use when starting a project or reshaping its layers, boundaries and feature list.
user-invocable: true
---

# dev-flow:project — 立案與邊界

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/features.md`「`.design/`」「system.md」「ADR」、`rules/boundary.md` 全份、`rules/tooling.md`「language adapter」「收尾定錨」。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者的意圖、既有程式碼(有的話) | `.design/system.md`、`.design/modules.md`、需要的 `adr/`、每條要交付的能力一份 `draft` feature |

## 步驟

1. **看現況。** 有 `.design/system.md` 就是更新模式:只改開發者點名的節,其餘不動。有 `.design/subsystems/` 的舊樹 → `devflow migrate .design --language <adapter>` 印帳本,帶開發者逐項判,再照本 skill 建新樹。
2. **訪談,一題一題問,不確定就再問**:
   - **目的與期望**:替誰做什麼、明確不做什麼;三個月後期望它長什麼樣。這一段寫進 `## 目的`,是之後每次「這件事在不在規劃裡」的判準。
   - **語言與工具**:語言(決定 adapter);建置、整套測試、子集測試三道指令——子集指令從 CI 設定、`Makefile`、`package.json` 或測試框架說明找,找不到問一次。這一行不問,之後每個角色都只會退回去跑整庫。
   - **層**:這個專案由內而外分幾層、各叫什麼、各裝什麼。規則只有兩條(`boundary.md`「層」),層名由專案自己取;小工具一層也行。
   - **對外 I/O**:每個跨過最外層的入口與出口叫什麼、帶什麼型別、**信任誰**(內容由系統外面決定的是 `untrusted`)。
   - **要交付什麼**:列出使用者做得到的事,每一條是一份 feature;按交付順序排,填進 Features 表的階段欄。**這裡列的是「完成這個產品需要哪些」,不是「這一版先做哪些」**——順序歸階段,不影響清單。
3. **切層與模組表**:有程式碼就 `devflow modules --gen` 生成一個檔一列,人填層欄再把同層合併成 `目錄/**`;沒有程式碼就先列預期的目錄。
4. **寫檔**:`system.md` 照 `templates/system.md` 五節;`modules.md` 一張表。層怎麼切、選了什麼外部系統這種跨文檔決定,`devflow claim adr <slug>` 建 ADR。
5. **建 feature 骨架**:每條要交付的能力 `devflow claim feature <slug> --description <句>`,得到 `draft` 的檔與 Features 表的一列。內容交給 `dev-flow:feature`。
6. `devflow lint boundary`、`devflow lint io`:層、模組表、對外 I/O 表與程式碼對得上才收。

## 收尾

回報建了哪些檔、feature 幾份、模組表幾個檔案還沒填層;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律是 `dev-flow:feature <第一份 feature 全名>`。

## 邊界

不寫 feature 的 Steps 與 laws;不寫任何程式碼;不替開發者決定語言、層數或交付順序;不建 abstract(那是 `dev-flow:refactor` 從既有 feature 收整出來的,不是先驗地切出來的)。
