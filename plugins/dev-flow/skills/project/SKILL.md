---
name: project
description: dev-flow 的立案 — 訪談後產出 .design/system.md(願景、需求各有一條可判定的 Requirement Law、語言與工具含三道指令與優先各級的宣告、由內而外的層、對外 I/O 表含信任與驗證、Features 清單)、objectives/ 一個目標一個檔(每條需求至少一個目標,各有優先 1 到 4、Law 與里程碑)與 modules.md 模組表,跨文檔的決定寫 ADR,每條要交付的能力用 devflow claim 建成 draft 的 feature 並綁進里程碑。觸發詞:立案、開新專案、專案願景、需求、系統設計、主架構、dev-flow project、建 .design、模組表、層、技術選型。Use when starting a project or reshaping its vision, requirements, layers, boundaries and feature list.
user-invocable: true
---

# dev-flow:project — 立案與邊界

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/features.md`「`.design/`」「system.md」「願景、需求、目標與路線」「ADR」、`rules/boundary.md` 全份、`rules/tooling.md`「language adapter」「收尾定錨」。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者的意圖、既有程式碼(有的話) | `.design/system.md`(願景、需求、語言與工具、層、對外 I/O、Features)、`.design/objectives/R-x-O-y-<slug>.md`(每條需求至少一個目標與它的里程碑)、`.design/modules.md`、需要的 `adr/`、每條要交付的能力一份 `draft` feature,各綁進一條里程碑 |

## 前置

- 只有 `subsystems/` 體系的 `.design/` → `devflow migrate .design --language <adapter>` 印帳本,帶開發者逐項判,再照本 skill 建新樹。
- 目標還擠在一份 `objectives.md` 的樹 → 先 `devflow migrate objectives`(印帳本)再 `--write`,之後照更新模式補需求的 Law 與蘊含說明。

## 步驟

1. **看現況。** 有 `.design/system.md` 就是更新模式:只改開發者點名的節,其餘不動。沒有就建。
2. **訪談,一題一題問,不確定就再問**:
   - **願景**先問:這個專案要交出的、世界上還沒有的東西是什麼,替誰改變了什麼,第一段一到三句;後面可以展開替誰做什麼、明確不做什麼。訂不出來就先不往下。寫進 `## 願景`;它是北極星,不是驗收清單,之後的需求與目標不對它逐句對照。
   - **需求,一條一條問**:誰在什麼情況下要得到什麼(一句話);它成立時什麼一定為真(**Requirement Law**,一句可判定的話:數字、現象、使用者做得到的動作);這句話能不能寫成三行式、能不能自動化驗收(能就當場寫成三行,識別字是某份 feature 會有的簽名,之後由 build 派 qa 寫歸屬 `R-n#LAW` 的驗收測試,`roles.md`「驗收測試」;不能就只留一句,由目標的 Law 推)。寫不出 Law 的不是需求,回到問題。每條 `devflow requirement add "<一句話>" --law "<句>"`,至少一條。
   - **目標**:每條需求至少一個目標,各答 What / How / Which 三問(`dev-flow:objective`);先跟開發者訂優先 1 到 4 在這個專案各代表什麼,寫成 `## 語言與工具` 一行「- 優先:1 = …;2 = …;3 = …;4 = …」。這一段交給 `dev-flow:objective` 的對談寫,本 skill 只確認每條需求有一個目標與它的第一條里程碑存在。
   - **語言與工具**:語言(決定 adapter;前後端各一種語言就問各住哪個目錄,寫成 `[<目錄> = <adapter>, …]`,`tooling.md`「language adapter」);建置、整套測試、子集測試三道指令(多語言專案每側一組)——子集指令從 CI 設定、`Makefile`、`package.json` 或測試框架說明找,找不到問一次。這一行不問,之後每個角色都只會退回去跑整庫。兩人以上會平行 claim 的專案再問號段:每人一段、以 git 的 `user.email` 為鍵(`- 號段:a@corp.com = 000-099;b@corp.com = 100-199`),新人加入時加一段;單人寫「無」。
   - **層**:這個專案由內而外分幾層、各叫什麼、各裝什麼。規則只有兩條(`boundary.md`「層」),層名由專案自己取;小工具一層也行。
   - **對外 I/O**:每個跨過最外層的入口與出口叫什麼、帶什麼型別、**信任誰**(內容由系統外面決定的是 `untrusted`)。
   - **要交付什麼**:列出使用者做得到的事,每一條是一份 feature,各屬於哪個目標的哪條里程碑。**這裡列的是「完成這個產品需要哪些」,不是「這一版先做哪些」**——先後歸目標的優先與里程碑的順序,不影響清單。
3. **切層與模組表**:有程式碼就 `devflow modules --gen` 生成一個檔一列,人填層欄再把同層合併成 `目錄/**`;沒有程式碼就先列預期的目錄。
4. **寫檔**:`system.md` 照 `templates/system.md` 六節;`modules.md` 一張表。層怎麼切、選了什麼外部系統這種跨文檔決定,`devflow claim adr <slug>` 建 ADR。
5. **訂目標與里程碑**:每條需求至少一個目標 `devflow objective add <slug> <一句話> --requirement <R-n> --priority <1-4>`(slug 是 kebab-case 英文,講這個目標做到什麼;一對一的目標 Law 繼承需求,不給 `--law`),每個目標 `devflow objective milestone <O-n> <一句話>` 至少一條,還沒有 feature 的不綁;一條需求要拆成多個目標、或要細談的,走 `dev-flow:objective`。
6. **建 feature 檔**:每條要交付的能力 `devflow claim feature <slug> --description <句> --milestone <M-n>`,得到 `draft` 的檔、Features 表的一列與里程碑的綁定。內容交給 `dev-flow:feature`。
7. `devflow lint boundary`、`devflow lint io`、`devflow lint laws`、`devflow status`:層、模組表、對外 I/O 表與程式碼對得上,願景、需求與目標的警訊為空,才收。

## 收尾

回報願景一句、需求幾條(各自的 Law 一句、有沒有三行式)、目標幾個(各優先)、里程碑幾條、建了哪些檔、feature 幾份、模組表幾個檔案還沒填層;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律是 `dev-flow:feature <最高優先目標第一條里程碑綁定的第一份 feature 全名>`。

## 邊界

不寫 feature 的 Steps 與 laws;不寫任何程式碼;不替開發者決定願景、需求的 Law、目標的優先、語言或層數;不建 abstract(那是 `dev-flow:refactor` 從既有 feature 收整出來的,不是先驗地切出來的)。
