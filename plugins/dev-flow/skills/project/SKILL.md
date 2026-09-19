---
name: project
description: dev-flow 的立案 — 訪談後產出 .design/system.md(願景;需求——必須達成的事,各有一句可判定的驗收;全域 Law 一區——不得違反的約束,三類:領域不變量、架構的層、契約的對外 I/O 表含信任;語言與工具含三道指令與優先各級的宣告)、objectives/ 一個目標一個檔(每條需求至少一個目標,各有優先 1 到 4 與帶英文名的里程碑)與 modules.md 模組表。這是切片開工之前唯一先寫的東西:需求與它的驗收、全域 Law;全域 Law 的每一條由開發者定,立案之後的變更走 dev-flow:revise;feature 文檔不在這裡建,它們在切片做完之後由 dev-flow:law-design 談出來。觸發詞:立案、開新專案、專案願景、需求、系統設計、主架構、dev-flow project、建 .design、模組表、層、技術選型、領域不變量、全域 Law。Use when starting a project or reshaping its vision, requirements, global laws, layers and boundaries.
user-invocable: true
---

# dev-flow:project — 立案與邊界

> **核心**:Only what can be judged true before any code exists gets written: what MUST be achieved (Requirements with their acceptance) and what MUST NOT be violated (the global Laws); every global Law is the developer's decision.(只寫做之前就判得出真假的東西:必須達成的需求與它的驗收、不得違反的全域 Law;每一條全域 Law 都是開發者的決定;其餘留給切片。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/features.md`「`.design/`」「system.md」「願景、需求、目標與路線」、`rules/laws.md`「Law 與需求」「全域 Law」、`rules/boundary.md` 全份、`rules/tooling.md`「language adapter」「收尾定錨」。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者的意圖、既有程式碼(有的話) | `.design/system.md`(願景、需求、領域不變量、語言與工具、層、對外 I/O、Features)、`.design/objectives/R-x-O-y-<slug>.md`(每條需求至少一個目標與它的里程碑 `M-n-<slug>`)、`.design/modules.md` |

## 前置

- 只有 `subsystems/` 體系的 `.design/` → `devflow migrate .design --language <adapter>` 印帳本,帶開發者逐項判,再照本 skill 建新樹。
- 目標還擠在一份 `objectives.md` 的樹 → 先 `devflow migrate objectives`(印帳本)再 `--write`,之後照更新模式補需求的驗收。
- `devflow status` 警訊說 `system.md` 沒有「## 全域 Law」區、或需求寫著「- Law:」→ 先 `devflow migrate laws`(印帳本)再 `--write`。
- 已經立案的專案要改全域 Law(新增、修改、放寬、替換、刪除任何一條)→ 不在這裡,走 `dev-flow:revise`:它先攤影響範圍、給選項、開發者批准才落筆。

## 步驟

1. **看現況。** 有 `.design/system.md` 就是更新模式:只改開發者點名的節,其餘不動。沒有就建。
2. **訪談,一題一題問,不確定就再問**。只問做之前就講得清楚、做完也不會變的東西;簽名、步驟怎麼拆、放哪個檔案,留給切片:
   - **願景**先問:這個專案要交出的、世界上還沒有的東西是什麼,替誰改變了什麼,第一段一到三句;後面可以展開替誰做什麼、明確不做什麼。訂不出來就先不往下。寫進 `## 願景`;它是北極星,不是驗收清單,之後的需求與目標不對它逐句對照。
   - **需求,一條一條問**:誰在什麼情況下要得到什麼(一句話);它達成時什麼一定為真(**驗收**,一句可判定的話:數字、現象、使用者做得到的動作)。需求是**必須達成**的事,不是 law;寫不出驗收的不是需求,回到問題。立案時程式碼還不在,驗收先只留一句話;切片做出簽名之後,能自動化的由 `dev-flow:law-design` 補成三行、build 派 qa 寫歸屬 `R-n#ACCEPT` 的驗收測試(`roles.md`「驗收測試」)。每條 `devflow requirement add "<一句話>" --accept "<句>"`,至少一條。
   - **全域 Law**:整個專案**不得違反**的約束,住 `system.md`「## 全域 Law」一區,三類各一小區(下面三項)。每一條都是開發者的決定:你提候選、講它擋掉什麼,開發者一條一條說要不要。
   - **領域不變量**(全域 Law 第一類):這個領域裡有沒有永遠為真、任何一份功能都不准違反的事(錢不憑空產生或消失、庫存不為負、狀態不倒退)。一條一條問,每條過准入四條(`laws.md`「全域 Law」):兩份以上的功能違反得了它嗎?之後寫得成測試嗎?只有一份功能會碰到的,留給那份 feature 當 scope law。有就 `devflow invariant add "<一句話>" --kind <種類>`;沒有就這一小區寫「無」。**寧少勿多**:每多一條,之後每一條切片都多一道束縛。
   - **架構:層**(全域 Law 第二類):這個專案由內而外分幾層、各叫什麼、各裝什麼。規則只有兩條(`boundary.md`「層」),層名由專案自己取;小工具一層也行。切片從第一行程式碼就守它,`devflow lint boundary` 自動確認。
   - **契約:對外 I/O**(全域 Law 第三類):這個系統會跨過哪些對外邊界(HTTP、CLI、檔案、第三方服務)、每一端**信任誰**(內容由系統外面決定的是 `untrusted`)。已經有程式碼的入口與出口列成表上的列;還沒有的,在願景或需求的展開裡講明邊界在哪,列由 `dev-flow:law-design` 在切片做完後補。
   - **目標**:每條需求至少一個目標,各答 What / Which 兩問(`dev-flow:objective`);先跟開發者訂優先 1 到 4 在這個專案各代表什麼,寫成 `## 語言與工具` 一行「- 優先:1 = …;2 = …;3 = …;4 = …」。這一段交給 `dev-flow:objective` 的對談寫,本 skill 只確認每條需求有一個目標與它的第一條里程碑存在。
   - **語言與工具**:語言(決定 adapter;前後端各一種語言就問各住哪個目錄,寫成 `[<目錄> = <adapter>, …]`,`tooling.md`「language adapter」);建置、整套測試、子集測試三道指令(多語言專案每側一組)——子集指令從 CI 設定、`Makefile`、`package.json` 或測試框架說明找,找不到問一次。這一行不問,之後每個角色都只會退回去跑整庫。兩人以上會平行 claim 的專案再問號段:每人一段、以 git 的 `user.email` 為鍵(`- 號段:a@corp.com = 000-099;b@corp.com = 100-199`),新人加入時加一段;單人寫「無」。
   - **要交付什麼**:列出使用者做得到的事,每一條是哪個目標底下的一條里程碑。**這裡列的是「完成這個產品需要哪些」,不是「這一版先做哪些」**——先後歸目標的優先與里程碑的順序。
3. **切層與模組表**:有程式碼就 `devflow modules --gen` 生成一個檔一列,人填層欄再把同層合併成 `目錄/**`;沒有程式碼就先列預期的目錄。
4. **寫檔**:`system.md` 照 `templates/system.md` 五節,「全域 Law」底下三個小區;`modules.md` 一張表。層怎麼切、選了什麼語言,表本身就是決定,不另開 ADR(ADR 由 `dev-flow:integrate` 寫)。
5. **訂目標與里程碑**:每條需求至少一個目標 `devflow objective add <slug> <一句話> --requirement <R-n> --priority <1-4>`(slug 是 kebab-case 英文,講這個目標做到什麼),每個目標 `devflow objective milestone <O-n> <slug> <一句話>` 至少一條(slug 是這條里程碑的英文名,切片的分支以它為鍵;綁定欄留「-」,feature 還不存在);一條需求要拆成多個目標、或要細談的,走 `dev-flow:objective`。
6. `devflow lint global`(架構、契約、領域不變量三道)、`devflow lint laws`、`devflow status`:層、模組表、對外 I/O 表與程式碼對得上,願景、需求與目標的警訊為空(領域不變量「還沒有三行式」的警訊在立案時是正常的),才收。變更 commit 之後交給 `dev-flow:integrate` 帶上 `plan/<slug>` 分支發 PR;合進主線,切片才開得了。

## 收尾

回報願景一句、需求幾條(各自的 Law 一句)、領域不變量幾條、目標幾個(各優先)、里程碑幾條(各自的全名)、建了哪些檔、模組表幾個檔案還沒填層;附定錨區塊(`tooling.md`「收尾定錨」)。下一步:`dev-flow:integrate`(把立案合進主線),再 `dev-flow:spike-impl <最高優先目標第一條里程碑的全名>`。

## 邊界

不建 feature、不寫 Steps 與 laws(那是切片之後 `dev-flow:law-design` 的事);不寫任何程式碼;不開 ADR;不替開發者決定願景、需求與它的驗收、任何一條全域 Law、目標的優先、語言或層數;已經立案的全域 Law 不在這裡改(`dev-flow:revise`);不建 abstract(那是 `dev-flow:abstract` 從既有 feature 收整出來的,不是先驗地切出來的)。
