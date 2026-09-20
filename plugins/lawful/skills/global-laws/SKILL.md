---
name: global-laws
description: lawful(有 .lawful/ 的 Haskell 專案)全域 Law 落筆的地方。全域 Law 是從做出來的切片裡抽上去的:scope-laws 列的候選或開發者提的一句,攤影響範圍、開發者明確批准才寫進 Cone.md「全域 Law」區,抽上去的 law 從原 pipeline 搬走;之後的修改、放寬、替換、刪除同樣要批准、也只在這裡。觸發詞:全域 Law、抽上去、領域不變量、四層、對外 I/O、放寬全域 Law。Use when a Law from a finished slice should become a global Law, or a global Law must be changed, relaxed or removed.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:global-laws — 把 Law 抽成全域 Law,改全域 Law

> **核心**:A global Law is extracted from a finished slice, never invented ahead of the code; it is written or changed only after the developer has seen its full impact and explicitly approved one option, and afterwards every affected piece of work is re-verified.(全域 Law 是從做出來的切片裡抽上去的,不憑空定;要立、要改,開發者先看過完整的影響範圍、對著一個選項明確說了要,才落筆;落筆之後重新驗證每一份受影響的工作。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief global-laws` 的輸出:規章、分支與工作樹、`Cone.md` 全文(「全域 Law」三個小區都在裡面)、`modules.md` 全文、`gaps.md`、`lint global` 的結果(影響範圍從這幾塊攤)。目標是里程碑時另有這條里程碑所在的需求檔全文、決策紀錄全份、已經綁上的 pipeline 全文與逐條狀態(候選的出處在裡面)、types 層每個模組的匯出、`lawful status` 裡講到它的每一行;不給目標時另有每個需求檔全文與 `lawful status` 的需求表、全域 Law、等決定、警訊與建議路線;目標是 `INV-n` 時另有每個需求檔全文、那一條的一句話與三行、三行引用到的東西、`lawful status` 裡講到它的每一行。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:`lawful:scope-laws` 帶著候選接過來時是那條里程碑的全名 `M-n-<slug>`,參數裡全名後面那一段就是候選清單(每條的原句、出處的 pipeline 全名與 law 編號、改寫後的三行;四層的候選;要改的既有全域 Law 與原因),照它開工,不必再問一次。要改的是某一條領域不變量就給 `INV-n`;其餘不必給。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws <同一個目標> --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 情形 | 輸入 | 產出 |
|---|---|---|
| **抽上去**(主場景) | 候選的原句與出處。來源三種:`lawful:scope-laws` 對著剛做完的切片列的候選(領域不變量、四層哪一層「裝什麼」那一句、要改的對外 I/O 既有列)、開發者自己提的一句、`lawful:integrate` 的變更建議經開發者明確批准(GAP 記著反例與批准的選項) | `Cone.md`「全域 Law」區落筆的那一條:領域不變量(三行從出處那條 law 照搬,出處那條 law 從原本的 pipeline 搬走)、四層那四行裡的那一句、對外 I/O 表既有列的契約欄;決策紀錄「Decisions」的一列;然後回到原本的流程(候選來自 `lawful:scope-laws` 時接上 `lawful:build M-n-<slug>`) |
| **變更** | 既有的一條全域 Law 要修改、放寬、替換或刪除:開發者自己提的,或 `lawful:integrate` 的變更建議經開發者明確批准 | 改過的那一條,`modules.md` 跟著對得上;重新驗證受影響工作的逐項結果;ADR 要用的四節材料 |

## 前置

- 沒有 `.lawful/Cone.md` → `lawful:kickoff`。`Cone.md` 沒有「## 全域 Law」區 → 回 `lawful:kickoff` 的前置處理。
- 要改的是**一條 pipeline** 的 scope law、簽名或實作,要回答的 GAP 目標欄寫的是某條 pipeline,要做的是一條靠修訂達成的里程碑 → 不在這裡:要調整(修改、放寬、替換、刪除)既有的 scope law 走 `lawful:scope-laws`;既有的 law 不動、或只新增 law,而文檔或實作要變(含靠修訂達成的里程碑)走 `lawful:scope-revise`。一件修訂從頭到尾只有一個修訂類的 skill 在跑。
- 開發者講的是一件**有做完的一天**的事 → 那是需求;需求面的條目(需求、驗收、優先、里程碑)走 `lawful:require-design`(`laws.md`「Law 與需求」)。
- 只是要多劃一個模組單元、或既有單元要多一層,四層那四句不變 → 那不是全域 Law 的事,走 `lawful:module`。
- 來源只有三種:`lawful:scope-laws` 列的候選(開發者在那裡逐條說了要)、開發者自己提的、`lawful:integrate` 的變更建議**經開發者明確批准**。沒有批准就停,不動。
- **在哪做**(`roles.md`「分支與所有權」):候選來自 `lawful:scope-laws`,或出處是一條還在 `build/` 分支上、還沒 `verified` 的 pipeline → 就在那條里程碑的工作樹 `../<repo>.worktrees/M-n-<slug>` 上落筆、commit,與這一片一起經整合進主線。其餘(開發者先立的一句、既有全域 Law 的變更)→ 與立案、需求的變更走同一條路:在主線的工作樹上落筆、commit,由 `lawful:integrate` 帶上 `plan/<slug>` 分支經 PR 合進主線。

**任何全域 Law 的新增、修改、放寬、替換或刪除,都必須經開發者明確批准;`lawful:integrate` 只能提出變更建議,不得自行決定變更,也不直接修改全域 Law。經批准的只在這裡落筆,落筆後重新驗證受影響的工作。**「明確」= 開發者對著那一條、那一個選項說了要;沉默、整批同意、「你決定」都不算。

## 抽上去

全域 Law 三類都是從做出來的切片裡抽上去的(`laws.md`「全域 Law」):領域不變量的三行要引用 types 層的型別,四層每一層裝什麼要看這一片實際放了什麼,對外 I/O 表的每一格要對到 shell 模組、型別、pipeline 與 law——程式碼還不在的時候只能猜。四層與它們的規則是 plugin 固定的(`boundary.md`「四層」),`lawful:kickoff` 已經建好,不在這裡談;這裡寫的是每一層「裝什麼」那一句。一次一條候選;每一條都是開發者的決定,你講它擋掉什麼、牽動什麼,開發者說要不要。

1. **拿到候選的原句與出處**:`lawful:scope-laws` 帶來的清單照抄(原句、出處如 `P-001-save-write#LAW-3`、改寫後的三行、四層的候選);開發者自己提的,問到有一句話、以及它現在住在哪一條 pipeline 的哪一條 law(沒有出處的見下面「先立一句」)。
2. **照准入判準再判一次**(`laws.md`「全域 Law」准入四條):開發者批准了嗎;三行只引用 types 層的匯出、型別名與標準函式庫嗎;不只出處那一條 pipeline 違反得了它嗎;寫得成測試、lint 或型別約束嗎。過不了的不抽:留在出處當 scope law,回報講哪一條沒過。
3. **影響範圍**(`laws.md`「影響範圍與選項」):先查、先列,六項不准省略一項,查過而沒有的寫「無」。專案的第一片多半各項是「無」;之後的片要列:哪幾條既有的 pipeline 違反得了它、它們現在的程式碼守不守得住(沒有測試可判就寫「未知」)、哪幾條建構中的分支。`lawful status`、`lawful lint global` 是查的工具。
4. **給選項,等開發者批准**:至少兩個,其中一個一定是「不抽,留在出處當 scope law」(四層的候選是「這一句先不寫」)。每個選項寫:改什麼、影響範圍裡哪幾項因此不同、當下成本、之後的代價(每多一條全域 Law,之後每一條切片都多一道束縛)、可不可逆;你給傾向與理由。開發者對著那一個選項明確說了要,才往下。
5. **落筆**在 `Cone.md` 的「全域 Law」區:
   - **四層每一層「裝什麼」**:寫進 `### 架構:四層` 那四行裡對應的那一句——哪些型別住 types;有沒有效果要描述成純資料住 effect(指令 ADT 叫什麼;描述與它的純解譯器同層,真解譯器住 shell;沒有 effect 層就寫「無」);純轉換住 core;碰對外 I/O 的進入點與真解譯器住 shell(`boundary.md`「效果的判定」)。寫完對一次 `.lawful/modules.md`:模組單元各自宣告的層對不對得上這幾句,要補層走 `lawful module <單元> --layers <層>`;`lawful lint boundary` 的紅若是這一片的模組放錯了層,不在這裡修,逐條列進回報,留給接下來的 build 帶 refactor 調。那一句本身就是決定。
   - **領域不變量**:`lawful invariant add "<一句話>" --kind <種類>` 配號;三行從出處那條 law 照搬,識別字改成只用 types 層的匯出與型別名(`lawful lint invariants` 對帳)。**出處那條 law 從原本那條 pipeline 的 Laws 節搬走**:pipeline 此時還沒 `verified`,在同一條 build 分支上直接改,不寫 REV;law 號永久空缺;只覆蓋那條 law 的 example 一起拿掉,同時覆蓋別條 law 的 example 把它從「覆蓋」欄拿掉;對外 I/O 表契約欄指到它的改指 `INV-n`;決策紀錄「Verification」的「首跑該紅」列著它的改寫成 `INV-n#LAW`。搬走之後 `lawful lint laws` 有紅(`=` 列沒有 law 引用了、example 指不到 law)→ 停下回報,交回 `lawful:scope-laws <pipeline 全名>` 補。**出處的 pipeline 已經 `verified` → 這裡停下並講清楚**:搬走它的 law 是調整既有的 law,先走 `lawful:scope-laws <pipeline 全名>`(影響範圍、選項、REV),那一件做完再回來立這一條。
   - **對外 I/O 既有的列**(換契約、換型別或效果 ADT):直接改那一列;這一片的新列不經過這裡,`lawful:scope-laws` 已經寫了。
   - `updated` 改成今天;來源是 GAP 的,同一個動作把條目**整條刪掉**,`gaps.md` 空了刪檔。
6. **驗**:`lawful lint global`——契約與領域不變量沒有紅,架構的紅只准是上面列進回報的那幾條;`lawful lint sig`、`lawful lint laws` 沒有紅。在 build 分支上落筆的,決策紀錄「Decisions」每一條各記一列(立了哪一條、為什麼、否決的選項、可逆欄、跨文檔欄為是),`lawful:integrate` 靠這一列問開發者要不要升 ADR;變更 commit,訊息帶 `M-n-<slug>`。
7. **回到原本的流程**:候選來自 `lawful:scope-laws` → 回報裡寫明下一步是 `lawful:build M-n-<slug>`,並直接執行它,不等開發者另外下指令:build 照 `roles.md`「驗收測試」替新的 `INV-n` 派 qa 寫 `INV-n#LAW` 測試(原本守出處那條 law 的測試,歸屬由那一波的 qa 改成 `INV-n#LAW`),refactor 把新的全域 Law 留下的紅調到成立。其餘來源 → `lawful:integrate`。

### 先立一句

不強迫、但允許先立:開發者事先就知道的硬規矩(「實體 id 一律不重複」),隨時可以直接叫這裡立一句,不必等切片。照上面第 2 到第 4 步做(沒有既有的 pipeline 時影響範圍各項寫「無」;選項一定含「不立,等切片做出來再抽」),批准後 `lawful invariant add "<一句話>" --kind <種類>`,在主線的工作樹上落筆。此時**只有一句話**:types 層的型別還沒出現,三行等它出現的那條切片由 `lawful:scope-laws` 寫(不改那一句話),在那之前 `lawful status` 顯示它「還沒有三行式」。**寧少勿多**:每多一條,之後每一條切片都多一道束縛。

## 全域 Law 的變更

既有的一條全域 Law 要修改、放寬、替換或刪除。一次變更一條。

1. **拿到來源的原句**:開發者的那一句話,或 GAP 的提問原句(整合仲裁留下的 GAP,原句含反例與開發者批准了哪個選項)。
2. **影響範圍**(`laws.md`「影響範圍與選項」):先查、先列,不准省略一項,查過而沒有的寫「無」。`lawful status`(建構中的分支、需求達成與否)、`lawful lint global` 是查的工具。全域 Law 的影響範圍橫跨整個專案:

   | 項 | 列什麼 |
   |---|---|
   | 直接動到 | 哪一條全域 Law 的哪一行變(句子、三行、四層那四句的哪一句、對外 I/O 表哪一列或哪一列的契約欄) |
   | 引用同一處的 law | 契約欄指到它的每一列對外 I/O、三行裡用到同一個 types 層匯出的每一條領域不變量 |
   | 連動的文檔 | 違反得了它的每一條 pipeline;四層或模組單元變了,另列 `modules.md` 要改的每一列 |
   | 測試 | 要重寫的(`INV-n#LAW`)、要重跑的、確定不受影響的 |
   | 狀態 | 哪幾條 `verified` 的 pipeline 要重開;每一條建構中的 build 分支 |
   | 需求 | 哪幾條需求的驗收因此不同;改完之後它還達不達成 |

3. **給選項,等開發者選**:至少兩個,其中一個一定是「不改」。每個選項寫:改什麼、影響範圍裡哪幾項因此不同、當下成本、之後的代價、可不可逆;放寬與刪除的選項,代價那一格寫明「之後哪些行為不再被擋」;你給傾向與理由。開發者對著那一個選項明確說了要,才往下。來源的 GAP 已經記著開發者選定的選項時,仍把影響範圍攤出來請開發者確認一次:仲裁當下看到的是反例,不是全部的牽連。
4. **落筆**在 `Cone.md` 的「全域 Law」區:修改、放寬、替換、刪除直接改那一條。編號不重用,刪掉的號永久空缺。四層那四句與對外 I/O 表的變更同理;模組單元的名字、職責或層要跟著變,改 `.lawful/modules.md` 那一列(補層走 `lawful module <單元> --layers <新的層>`),改到 `lawful lint boundary` 沒有紅。`updated` 改成今天;來源是 GAP 的,同一個動作把條目**整條刪掉**,`gaps.md` 空了刪檔。
5. **重新驗證受影響的工作**,逐項回報結果:
   - `lawful lint global` 沒有紅;
   - 領域不變量的句子或三行變了,它原本的測試作廢 → `lawful:build INV-n` 重派 qa;刪掉的那一條,它的測試模組一起刪(否則是幽靈引用);
   - 影響範圍裡每一條 `verified` 的 pipeline 重跑它的子集測試;紅的重開、各走一次修訂(它既有的 law 要跟著調整走 `lawful:scope-laws <全名>`,既有的 law 不動、只有實作要服從新的全域 Law 走 `lawful:scope-revise <全名>`),來源寫這條全域 Law 的變更;這裡只列成給開發者的下一步,不動那幾條 pipeline;
   - 建構中的分支:在它的決策紀錄所在分支的 `gaps.md` 留一條 GAP(角色 conductor,目標欄寫那條全域 Law),它合進新的主線之後從首跑起重跑。
6. 為什麼變更,由 `lawful:integrate` 收這條 `plan/` 分支時寫成 ADR;這裡在回報裡留下 ADR 要用的四節材料(情境、決定、否決的選項、後果)。

## 收尾

抽上去:回報每條候選的原句與出處、准入四條各自過不過、影響範圍六項、開發者選了哪個選項與否決了哪幾個、落筆了什麼(`INV-n` 與它的三行、從哪條 pipeline 搬走了哪條 law、四層寫了哪幾句、模組表有沒有補層、對外 I/O 改了哪一列)、`lint boundary` 留給 build 調的紅逐條、沒抽的候選與原因;下一步寫明:候選來自 `lawful:scope-laws` 的是 `lawful:build M-n-<slug>`(直接接上),其餘是 `lawful:integrate`。變更:回報改了哪一條全域 Law、影響範圍六項、開發者選了哪個選項與否決了哪幾個、重新驗證的逐項結果、ADR 的四節材料;下一步 `lawful:integrate`(`plan/<slug>` 合進主線)。附定錨區塊(`tooling.md`「收尾定錨」)。

## 邊界

一次一條全域 Law;不順便改別的;沒有影響範圍與選項不落筆;不替開發者決定要不要抽、要不要改、選哪一個——開發者說,你寫。不憑空提全域 Law:候選要有出處(一條切片裡談定的 law、這一片實際放進每一層的東西與它跨過的邊界),或是開發者自己事先就知道的那一句。除了把抽上去的那條 law 從還沒 `verified` 的出處 pipeline 搬走,不碰任何一條 pipeline 的條文、簽名與 scope law(`lawful:scope-laws`、`lawful:scope-revise`);這一片在對外 I/O 表的新列不在這裡寫(`lawful:scope-laws`);不改四層與它們的規則(plugin 固定的);不寫需求、驗收與里程碑(`lawful:require-design`);不動「願景」與「專案約束」(`lawful:kickoff`);不寫測試、不改程式碼的本體。
