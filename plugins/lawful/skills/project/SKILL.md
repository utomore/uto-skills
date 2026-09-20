---
name: project
description: lawful 的立案 — 訪談後產出 .lawful/Cone.md(願景;需求——必須達成的事,各有一句可判定的驗收;全域 Law 一區——不得違反的約束,三類:領域不變量、架構的四層、契約的對外 I/O 表;專案約束含語言、三道指令、模組前綴、原始碼根目錄、硬性要求的套件與優先各級的宣告)、objectives/ 一個目標一個檔(每條需求至少一個目標,各有優先 1 到 4 與帶英文名的里程碑)與 modules.md 模組單元表。這是切片開工之前唯一先寫的東西:需求與它的驗收、全域 Law;全域 Law 的每一條由開發者定,立案之後的變更走 lawful:revise;pipeline 文檔不在這裡建,它們在切片做完之後由 lawful:law-design 談出來。觸發詞:立案、系統設計、開新專案、專案願景、需求、lawful project、建 .lawful、模組表、四層、邊界、對外 I/O、領域不變量、全域 Law、技術選型。Use when starting a pure-functional project or reshaping its vision, requirements, global laws, layers and module units.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:project — 立案與邊界

> **核心**:Only what can be judged true before any code exists gets written: what MUST be achieved (Requirements with their acceptance) and what MUST NOT be violated (the global Laws); every global Law is the developer's decision.(只寫做之前就判得出真假的東西:必須達成的需求與它的驗收、不得違反的全域 Law;每一條全域 Law 都是開發者的決定;其餘留給切片。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief project --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief project --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief project --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief project --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief project --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief project --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief project` 的輸出:規章、`.lawful/` 現在有什麼、`Cone.md` 全文、`modules.md` 全文(還沒有的照實寫沒有)。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief project --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者的意圖、既有程式碼(有的話) | `.lawful/Cone.md`(願景、需求、全域 Law 三區、專案約束)、`.lawful/objectives/R-x-O-y-<slug>.md`(每條需求至少一個目標與它的里程碑 `M-n-<slug>`)、`.lawful/modules.md`(一列一個模組單元)與四棵原始碼樹裡的資料夾 |

## 前置

- 只有 `system.md` 的 `.lawful/`、或目標還擠在一份 `objectives.md` 的樹 → 先 `lawful migrate cone`(印帳本)再 `--write`,之後照更新模式補需求的驗收。
- `lawful status` 警訊說 `Cone.md` 沒有「## 全域 Law」區、或需求與目標檔寫著「- Law:」→ 先 `lawful migrate laws`(印帳本)再 `--write`。
- 已經立案的專案要改全域 Law(新增、修改、放寬、替換、刪除任何一條)→ 不在這裡,走 `lawful:revise`:它先攤影響範圍、給選項、開發者批准才落筆。

## 步驟

1. **看現況。** 有 `.lawful/Cone.md` 就是更新模式:只改開發者點名的節,其餘不動。沒有就建。
2. **訪談,一題一題問,不確定就再問**。只問做之前就講得清楚、做完也不會變的東西;簽名、stage 怎麼拆、放哪個模組,留給切片:
   - **願景**先問:這個專案要交出的、世界上還沒有的東西是什麼,替誰改變了什麼,第一段一到三句;後面可以展開替誰做什麼、明確不做什麼。訂不出來就先不往下。寫進 `## 願景`;它是北極星,不是驗收清單,之後的需求與目標不對它逐句對照。
   - **需求,一條一條問**:誰在什麼情況下要得到什麼(一句話);它達成時什麼一定為真(**驗收**,一句可判定的話:數字、現象、使用者做得到的動作)。需求是**必須達成**的事,不是 law;寫不出驗收的不是需求,回到問題。立案時程式碼還不在,驗收先只留一句話;切片做出簽名之後,能自動化的由 `lawful:law-design` 補成三行、build 派 qa 寫歸屬 `R-n#ACCEPT` 的驗收測試(`roles.md`「驗收測試」)。每條 `lawful requirement add "<一句話>" --accept "<句>"`,至少一條。
   - **全域 Law**:整個專案**不得違反**的約束,住 `Cone.md`「## 全域 Law」一區,三類各一小區(下面三項)。每一條都是開發者的決定:你提候選、講它擋掉什麼,開發者一條一條說要不要。
   - **領域不變量**(全域 Law 第一類):這個領域裡有沒有永遠為真、任何一條 pipeline 都不准違反的事(實體 id 不重複、時間不倒退、存出去的東西讀得回來)。一條一條問,每條過准入四條(`laws.md`「全域 Law」):兩條以上的 pipeline 違反得了它嗎?之後寫得成測試嗎?只有一條 pipeline 會碰到的,留給那條當 scope law。有就 `lawful invariant add "<一句話>" --kind <種類>`;沒有就這一小區寫「無」。**寧少勿多**:每多一條,之後每一條切片都多一道束縛。
   - **架構:四層**(全域 Law 第二類):四層是固定的(`boundary.md`「四層」),這裡問這個專案在每一層裝什麼,各一句:哪些型別住 types、有沒有效果的描述要住 effect(描述與它的純解譯器同層,真解譯器住 shell;沒有就寫「無」)、純轉換住 core、碰對外 I/O 的進入點住 shell。效果的寫法也在這裡問(直接 `IO`、mtl、effectful 這類效果系統;專案自己的 App monad 寫進「效果型別追加」)。切片從第一行程式碼就守它,`lawful lint boundary` 自動確認,相依方向另由編譯器擋。
   - **契約:對外 I/O**(全域 Law 第三類):這個系統會跨過哪些對外邊界(檔案、CLI、網路、視窗與輸入裝置、第三方服務)。已經有程式碼的入口與出口列成表上的列;還沒有的,在願景或需求的展開裡講明邊界在哪,列由 `lawful:law-design` 在切片做完後補,契約欄到時候填守這一端的 law。
   - **專案約束**:語言(決定 adapter);建置、整套測試、子集測試三道指令——子集指令從 CI 設定或測試框架說明找,找不到問一次,這一行不問,之後每個角色都只會退回去跑整庫;模組前綴,以及四層各自的原始碼根目錄怎麼命名(預設 `src-<層>`,各是建置系統的一個子函式庫,`build-depends` 照 types ← effect ← core ← shell 宣告一次);使用者硬性要求的套件、框架與版本;兩人以上會平行 claim 的專案再問號段:每人一段、以 git 的 `user.email` 為鍵(`- 號段:a@corp.com = 000-099;b@corp.com = 100-199`),新人加入時加一段。開發者沒有硬性要求的寫「無」,單人的號段也寫「無」。
   - **要交付什麼**:列出使用者做得到的事,每一條是哪個目標底下的一條里程碑。**這裡列的是「完成這個產品需要哪些」,不是「這一版先做哪些」**——先後歸目標的優先與里程碑的順序。
3. **劃模組單元**(`boundary.md`「模組單元」):把現在看得出來的系統切成幾個單元,每個單元一句職責、有哪幾層。有程式碼就 `lawful modules --gen` 從模組名推出單元與層,人填職責;沒有程式碼就每個單元跑一次 `lawful module <名稱> --layers <…> --responsibility <一句話>`。還看不出來的單元不先劃:切片要的時候 `lawful:module` 再劃。要細談某一個單元的範圍,走 `lawful:module`。
4. **寫檔**:`Cone.md` 照 `templates/Cone.md` 四節,「全域 Law」底下三個小區;`modules.md` 照 `templates/modules.md` 一張表。四層各裝什麼、選了什麼語言與效果的寫法,那幾行本身就是決定,不另開 ADR(ADR 由 `lawful:integrate` 寫)。
5. **訂目標與里程碑**:先跟開發者訂優先 1 到 4 在這個專案各代表什麼,寫成 `Cone.md`「專案約束」一行「- 優先:1 = …;2 = …;3 = …;4 = …」;再每條需求至少一個目標 `lawful objective add <slug> <一句話> --requirement <R-n> --priority <1-4>`(slug 是 kebab-case 英文,講這個目標做到什麼),每個目標 `lawful objective milestone <O-n> <slug> <一句話>` 至少一條(slug 是這條里程碑的英文名,切片的分支以它為鍵;綁定欄留「-」,pipeline 還不存在);一條需求要拆成多個目標、或要細談的,走 `lawful:objective`。
6. `lawful lint global`(架構、契約、領域不變量三道)、`lawful lint laws`、`lawful status`:四層、模組單元表、對外 I/O 表與程式碼對得上,願景、需求與目標的警訊為空(領域不變量「還沒有三行式」的警訊在立案時是正常的),才收。變更 commit 之後交給 `lawful:integrate` 帶上 `plan/<slug>` 分支發 PR;合進主線,切片才開得了。

## 收尾

回報願景一句、需求幾條(各自的驗收一句)、領域不變量幾條、目標幾個(各優先)、里程碑幾條(各自的全名)、建了哪些檔、模組表幾個單元、各幾層、幾個還沒填職責;附定錨區塊(`tooling.md`「收尾定錨」)。下一步:`lawful:integrate`(把立案合進主線),再 `lawful:spike-impl <最高優先目標第一條里程碑的全名>`。

## 邊界

不建 pipeline、不寫 Stages 與 laws(那是切片之後 `lawful:law-design` 的事);不寫任何程式碼(`lawful module` 開的空資料夾與空門面除外);不開 ADR;不替開發者決定願景、需求與它的驗收、任何一條全域 Law、目標的優先、語言或效果的寫法;已經立案的全域 Law 不在這裡改(`lawful:revise`)。
