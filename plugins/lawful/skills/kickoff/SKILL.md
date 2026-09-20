---
name: kickoff
description: lawful(純函數式的 Haskell 專案)的立案,專案的第一個命令(還沒有 .lawful/ 的專案從這裡開始):建立 .lawful/ 的樹,與開發者訂願景、名詞表、Cone.md 的專案約束(語言、三道指令、模組前綴、原始碼根目錄)與模組單元表的骨架;不談需求也不談全域 Law,收尾自動接上 require-design。觸發詞:開新專案、立案、kickoff、建 .lawful、Cone.md、專案願景、技術選型、模組表、補名詞節。Use when starting a new project and creating its .lawful tree, vision, project constraints and module table.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:kickoff — 開樹與願景

> **核心**:Kickoff opens the tree and fixes only the north star, the project constraints and the module units already in sight; Requirements and global Laws are each settled in their own dialogue, never here.(開樹,只訂北極星、專案約束與已經看得出來的模組單元;需求與全域 Law 各有自己的對談,不在這裡談。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief kickoff --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief kickoff --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief kickoff --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief kickoff --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief kickoff --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief kickoff --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief kickoff` 的輸出:規章、`.lawful/` 現在有哪些檔、`Cone.md` 全文、`modules.md` 全文(還沒有的照實寫沒有)。開工要讀的規章與專案現況都在這裡,不再另外讀。名詞表不在 brief 裡:它住專案根目錄 `CLAUDE.md` 的「## 名詞」節,`CLAUDE.md` 每一場 session 都已經載入。

目標:不必給。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief kickoff --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者的意圖、既有程式碼(有的話) | `.lawful/Cone.md`(願景、專案約束填好;「全域 Law」三個小區還是模板)、`.lawful/modules.md`(已經看得出來的模組單元各一列)與它們在原始碼樹裡的資料夾、專案根目錄 `CLAUDE.md` 的「## 名詞」節(願景裡已經出現的領域名詞);然後接上 `lawful:require-design` |

## 前置

- 不合規的樹先遷移,再照更新模式往下:只有 `system.md` 的樹 → 跑 `lawful migrate cone`;`Cone.md` 沒有「## 全域 Law」區、或需求寫著「- Law:」的樹 → 跑 `lawful migrate laws`;需求住 `Cone.md` 的「## 需求」節加 `objectives/`、或 pipeline 的 `kind` 不是 `io` / `subflow`、或需求檔還帶調整表的樹(調整表的每一列換成一條綁既有 pipeline 的里程碑)→ 跑 `lawful migrate requirements`;每一道先印帳本,帳本列的「人要判的」(里程碑串接的順序、沒有里程碑的需求、無處可去的里程碑、沒有英文名的里程碑)帶開發者逐項判過,`--write` 才落地,三道以任何先後接連跑都行。
- 專案根目錄的 `CLAUDE.md` 沒有「## 名詞」節(檔案不存在也算;`lawful status` 的警訊會講)→ 照更新模式補上:照步驟 2 建這一節,把願景與既有需求裡已經在用的領域名詞照步驟 3 的「名詞」那一題與開發者逐個講定。
- 要談的是需求面的條目(需求、驗收、優先、里程碑)→ 不在這裡,走 `lawful:require-design`。要定或要改的是全域 Law(領域不變量、四層各裝什麼、對外 I/O)→ 不在這裡,走 `lawful:global-laws`。要調整(修改、放寬、替換、刪除)一條 pipeline 既有的 law → `lawful:scope-laws`;既有的 law 不動、或只新增 law,而文檔或實作要變 → `lawful:scope-revise`。
- 只是要多劃一個模組單元、或既有單元要多一層 → 不必重跑立案,走 `lawful:module`。

## 步驟

1. **看現況。** 有 `.lawful/Cone.md` 就是更新模式:只改開發者點名的部分(`Cone.md` 的願景、專案約束,模組表,`CLAUDE.md` 的名詞節),其餘不動。沒有就建。
2. **開樹**:`.lawful/Cone.md` 照 `templates/Cone.md` 建(frontmatter `language` 與 `updated`,標題 `# <專案名>:<一句話>`,三節:願景、全域 Law、專案約束;「全域 Law」底下三個小區先留模板,等 `lawful:global-laws`)、`.lawful/modules.md` 照 `templates/modules.md` 建(`pipelines.md`「`.lawful/`」「Cone.md」)。`requirements/` 不在這裡建:第一條需求由 `lawful:require-design` 走 CLI 建檔。
   - **名詞節**(這一節一定要在,`pipelines.md`「`.lawful/`」):專案根目錄沒有 `CLAUDE.md` → 建一份,只放 `# <專案名>` 與照 `templates/glossary.md` 寫的「## 名詞」節;已經有 `CLAUDE.md` 而沒有這一節 → 在檔尾補這一節。`CLAUDE.md` 是開發者自己的檔:這一節以外的內容一個字都不准動。
3. **訪談,一題一題問,不確定就再問**。只問做之前就講得清楚、做完也不會變的東西;簽名、stage 怎麼拆、放哪個模組,留給切片:
   - **願景**先問:這個專案要交出的、世界上還沒有的東西是什麼,替誰改變了什麼,第一段一到三句;後面可以展開替誰做什麼、明確不做什麼。訂不出來就先不往下。寫進 `## 願景`;它是北極星,不是驗收清單,之後的需求不對它逐句對照。
   - **名詞**:把願景裡已經出現的領域名詞逐個挑出來(更新模式再加上既有需求的一句話、驗收、里程碑那一句裡已經在用的),一個一個問開發者「它是什麼、不是什麼」,一句話講定,寫進 `CLAUDE.md`「## 名詞」節的表;只有一兩個也行,之後的由 `lawful:require-design` 補。「型別」欄:程式碼裡已經有對應的型別就寫型別名,還沒有就寫 `-`。名詞的定義只寫在這張表,不另外寫進 `Cone.md`。
   - **專案約束**(`pipelines.md`「Cone.md」),使用者的硬性要求,一行一行問:
     - 語言(決定 adapter,`tooling.md`「language adapter」),frontmatter 的 `language` 跟著填。
     - 建置、整套測試、子集測試三道指令——子集指令從 CI 設定或測試框架說明找,找不到問一次。這一行不問,之後每個角色都只會退回去跑整庫。
     - 模組前綴(專案的模組命名空間),以及四層各自的原始碼根目錄怎麼命名(帶 `<層>` 的樣式,預設 `src-<層>`;`boundary.md`「模組單元」)。四棵樹各是建置系統的一個子函式庫(Haskell:cabal sub-library),`build-depends` 照 types ← effect ← core ← shell 宣告一次;還不是的,把建置設定要加哪幾行講給開發者,不替他改:沒有這一步,層的相依方向只有 lint 擋得住,編譯器擋不住。
     - 套件與框架:使用者硬性要求的套件、框架與版本。效果的寫法也在這裡問(直接 `IO`、mtl、effectful 這類效果系統);專案自己的 App monad 寫進「效果型別追加」。
     - IO 模組追加、效果型別追加、忽略目錄:有就填,沒有寫「無」。
     - 號段:兩人以上會平行 claim 的專案才問,每人一段、以 git 的 `user.email` 為鍵(`- 號段:a@corp.com = 000-099;b@corp.com = 100-199`),新人加入時加一段;單人寫「無」。
     - 「優先」那一行(優先 1 到 4 各級在這個專案代表什麼)留給 `lawful:require-design`:它的第一步先跟開發者訂這一行,再談第一條需求。
4. **模組表的骨架**(`boundary.md`「模組單元」「模組表」):把現在已經看得出來的系統切成幾個模組單元,每個單元一句職責、有哪幾層。有程式碼就 `lawful modules --gen` 從模組名推出單元與層,職責欄由開發者一列一列講、你填;沒有程式碼就每個單元跑一次 `lawful module <名稱> --layers <逗號分隔的層> --responsibility <一句話>`,它寫一列並在每一層的原始碼樹裡開好資料夾。模板的佔位符列在第一個單元劃出來之後刪掉。還看不出來的單元不先劃:切片要的時候由 `lawful:module` 再劃;要細談某一個單元的名字、範圍、層與門面,也走 `lawful:module`。四層是固定的,層欄在這裡就填;這個專案在每一層各裝什麼的那四句是全域 Law,留給 `lawful:global-laws`。
5. `lawful lint boundary`、`lawful status`:模組單元表沒有紅(職責欄都填了、單元不巢狀;宣告了層還沒有程式碼只是訊息),願景與名詞節的警訊要清掉;沒有需求、優先各級還是模板的警訊在這一步是正常的,交給 `lawful:require-design`;「全域 Law」三個小區還是模板也是正常的,交給 `lawful:global-laws`。變更 commit。
6. **接上 require-design**:直接執行 `lawful:require-design`,與開發者談第一批需求並當場切成里程碑,不等開發者另外下指令;需求定完,它接上 `lawful:global-laws` 定全域 Law 三區。

## 收尾

回報願景一句、名詞表寫進了哪幾個名詞(`CLAUDE.md` 是新建的還是在檔尾補的)、語言與三道指令、模組前綴與原始碼根目錄、建了哪些檔、模組表幾個單元(各哪幾層)、幾個還沒填職責、四棵樹是不是已經是子函式庫;附定錨區塊(`tooling.md`「收尾定錨」)。接上 require-design 之後的收尾由它做。需求與全域 Law 三區都定完,才推薦切片:`lawful:integrate`(把立案以 `plan/<slug>` 分支合進主線),再 `lawful:spike-impl <最高優先需求第一條里程碑的全名 M-n-slug>`。

## 邊界

不談需求、驗收、優先與里程碑(`lawful:require-design`);不談、不寫任何一條全域 Law,也不填四層那四句與對外 I/O 表(`lawful:global-laws`);不建 pipeline、不寫 Stages 與 laws(那是切片之後 `lawful:scope-laws` 的事);不寫任何程式碼(`lawful module` 開的空資料夾與空門面除外),不改建置設定;不開 ADR:語言、效果的寫法、原始碼根目錄那幾行本身就是決定;不替開發者決定願景、名詞的定義、語言、效果的寫法與模組單元的名字。專案根目錄的 `CLAUDE.md` 只寫它的「## 名詞」節,這一節以外的內容一個字都不准動。
