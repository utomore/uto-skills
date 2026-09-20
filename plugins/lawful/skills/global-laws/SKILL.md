---
name: global-laws
description: lawful(有 .lawful/ 的 Haskell 專案)定與改全域 Law 的地方:Cone.md「全域 Law」區(領域不變量、四層各裝什麼、對外 I/O)的第一次定義,與之後每一次新增、修改、放寬、替換、刪除;先攤影響範圍與選項,開發者明確批准才落筆,落筆後重新驗證受影響的工作。觸發詞:全域 Law、global law、領域不變量、invariant、四層、對外 I/O、契約、放寬全域 Law、刪不變量。Use when global Laws are first defined, or one must be added, changed, relaxed, replaced or removed.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:global-laws — 定全域 Law,改全域 Law

> **核心**:A global Law is written or changed only after the developer has seen its full impact and explicitly approved one option; afterwards every affected piece of work is re-verified.(全域 Law 要立、要改,開發者先看過完整的影響範圍、對著一個選項明確說了要,才落筆;落筆之後重新驗證每一份受影響的工作。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief global-laws` 的輸出:規章、分支與工作樹、`Cone.md` 全文(「全域 Law」三個小區都在裡面)、每個需求檔全文、`modules.md` 全文、`gaps.md`、`lint global` 的結果(影響範圍從這幾塊攤)。不給目標時另有 `lawful status` 的需求表、全域 Law、等決定、警訊與建議路線;目標是 `INV-n` 時另有那一條的一句話與三行、三行引用到的東西、`lawful status` 裡講到它的每一行。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給;要改的是某一條領域不變量就給 `INV-n`。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief global-laws --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 第一次定義:立案之後還是模板的「全域 Law」三個小區。變更:開發者自己提的一條,或 `lawful:integrate` 的變更建議經開發者明確批准(GAP 記著反例與批准的選項) | `Cone.md`「全域 Law」區落筆的那一條(領域不變量、四層那四句、對外 I/O 表的列與契約欄),`modules.md` 跟著對得上;重新驗證受影響工作的逐項結果;ADR 要用的四節材料 |

## 前置

- 沒有 `.lawful/Cone.md` → `lawful:kickoff`。`Cone.md` 沒有「## 全域 Law」區 → 回 `lawful:kickoff` 的前置處理。
- 要改的是**一條 pipeline** 的 scope law、簽名或實作,要回答的 GAP 目標欄寫的是某條 pipeline,要做的是一條靠修訂達成的里程碑 → 不在這裡:要調整(修改、放寬、替換、刪除)既有的 scope law 走 `lawful:scope-laws`;既有的 law 不動、或只新增 law,而文檔或實作要變(含靠修訂達成的里程碑)走 `lawful:scope-revise`。一件修訂從頭到尾只有一個修訂類的 skill 在跑。
- 開發者講的是一件**有做完的一天**的事 → 那是需求;需求面的條目(需求、驗收、優先、里程碑)走 `lawful:require-design`(`laws.md`「Law 與需求」)。
- 只是要多劃一個模組單元、或既有單元要多一層,四層那四句不變 → 那不是全域 Law 的變更,走 `lawful:module`。
- 變更的來源只有兩種:開發者自己提的,或 `lawful:integrate` 的變更建議**經開發者明確批准**。沒有批准就停,不動。
- **在哪做**:與立案、需求的變更走同一條路——在主線的工作樹上落筆、commit,由 `lawful:integrate` 帶上 `plan/<slug>` 分支經 PR 合進主線(`roles.md`「分支與所有權」)。

**任何全域 Law 的修改、放寬、替換或刪除,都必須經開發者明確批准;`lawful:integrate` 只能提出變更建議,不得自行決定變更,也不直接修改全域 Law。經批准的變更只在這裡完成,完成後重新驗證受影響的工作。** 新增也一樣(`laws.md`「全域 Law」准入四條)。「明確」= 開發者對著那一條、那一個選項說了要;沉默、整批同意、「你決定」都不算。

## 第一次定義

立案之後「全域 Law」三個小區還是模板(`lawful:kickoff` 與 `lawful:require-design` 走完自動接到這裡)。逐區與開發者談(`laws.md`「全域 Law 的變更」);每一條都是開發者的決定:你提候選、講它擋掉什麼,開發者一條一條說要不要。此時沒有既有的 pipeline,影響範圍各項寫「無」;選項照樣給,一定含「不立這一條」。

1. **領域不變量**:這個領域裡有沒有永遠為真、任何一條 pipeline 都不准違反的事(實體 id 不重複、時間不倒退、存出去的東西讀得回來)。從需求檔的一句話與驗收找候選,一條一條問,每條過准入四條(`laws.md`「全域 Law」):兩條以上的 pipeline 違反得了它嗎?之後寫得成測試嗎?只有一條 pipeline 會碰到的,留給那一條當 scope law。要的就 `lawful invariant add "<一句話>" --kind <種類>`;一條都沒有就這一小區寫「無」。types 層的型別還沒出現,先只留一句話;型別出現的那條切片,`lawful:scope-laws` 把它寫成三行,`lawful:build INV-n` 派 qa 寫測試。**寧少勿多**:每多一條,之後每一條切片都多一道束縛。
2. **架構:四層**:四層與它們的規則是固定的(`boundary.md`「四層」),這裡問的是這個專案在每一層裝什麼,各一句,寫進 `### 架構:四層` 的四行:哪些型別住 types;有沒有效果要描述成純資料住 effect(指令 ADT 叫什麼;描述與它的純解譯器同層,真解譯器住 shell;沒有 effect 層就寫「無」);純轉換住 core;碰對外 I/O 的進入點與真解譯器住 shell(`boundary.md`「效果的判定」)。四句講定之後對一次 `.lawful/modules.md`:立案時劃的模組單元各自宣告的層對不對得上這四句,要補層走 `lawful module <單元> --layers <層>`,到 `lawful lint boundary` 沒有紅。四層各裝什麼,那四行本身就是決定,不另開 ADR。
3. **契約:對外 I/O**:這個系統會跨過哪些對外邊界(檔案、CLI、網路、視窗與輸入裝置、第三方服務),每一端對外面承諾什麼。已經有程式碼的入口與出口列成表上的列(名稱、方向、型別或效果 ADT、shell 模組、進入哪條 pipeline、契約;`boundary.md`「對外 I/O」),契約欄寫守這一端的 law,還沒有就「-」;還沒有程式碼的,把邊界在哪、這一端要承諾什麼跟開發者講定,寫在表前那一段,列由 `lawful:scope-laws` 在切片做完、claim 出 io pipeline 之後補,契約欄到時候填守它的 law。模板的佔位符列刪掉。
4. `lawful lint global`、`lawful status`:三類沒有紅,「全域 Law」區的警訊只剩領域不變量「還沒有三行式」(此時是正常的)。變更 commit。

## 全域 Law 的變更

一次變更一條。

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
4. **落筆**在 `Cone.md` 的「全域 Law」區:新增 `lawful invariant add <一句話> [--kind <種類>]`;修改、放寬、替換、刪除直接改那一條。編號不重用,刪掉的號永久空缺。四層那四句與對外 I/O 表的變更同理;模組單元的名字、職責或層要跟著變,改 `.lawful/modules.md` 那一列(補層走 `lawful module <單元> --layers <新的層>`),改到 `lawful lint boundary` 沒有紅。`updated` 改成今天;來源是 GAP 的,同一個動作把條目**整條刪掉**,`gaps.md` 空了刪檔。
5. **重新驗證受影響的工作**,逐項回報結果:
   - `lawful lint global` 沒有紅;
   - 領域不變量的句子或三行變了,它原本的測試作廢 → `lawful:build INV-n` 重派 qa;刪掉的那一條,它的測試模組一起刪(否則是幽靈引用);
   - 影響範圍裡每一條 `verified` 的 pipeline 重跑它的子集測試;紅的重開、各走一次修訂(它既有的 law 要跟著調整走 `lawful:scope-laws <全名>`,既有的 law 不動、只有實作要服從新的全域 Law 走 `lawful:scope-revise <全名>`),來源寫這條全域 Law 的變更;這裡只列成給開發者的下一步,不動那幾條 pipeline;
   - 建構中的分支:在它的決策紀錄所在分支的 `gaps.md` 留一條 GAP(角色 conductor,目標欄寫那條全域 Law),它合進新的主線之後從首跑起重跑。
6. 為什麼變更,由 `lawful:integrate` 收這條 `plan/` 分支時寫成 ADR;這裡在回報裡留下 ADR 要用的四節材料(情境、決定、否決的選項、後果)。

## 收尾

回報定了或改了哪一條全域 Law、影響範圍六項、開發者選了哪個選項與否決了哪幾個、重新驗證的逐項結果、ADR 的四節材料;第一次定義則回報領域不變量幾條、四層各一句、對外 I/O 幾列(幾端還只講定邊界、列還沒補)、模組表有沒有補層。附定錨區塊(`tooling.md`「收尾定錨」)。下一步:`lawful:integrate`(`plan/<slug>` 合進主線);第一次定義之後再 `lawful:spike-impl <最高優先需求第一條里程碑的全名 M-n-slug>`。

## 邊界

一次變更一條全域 Law;不順便改別的;沒有影響範圍與選項不落筆;不替開發者決定要不要立、要不要改、選哪一個——開發者說,你寫。不碰任何一條 pipeline 的條文、簽名與 scope law(`lawful:scope-laws`、`lawful:scope-revise`);不寫需求、驗收與里程碑(`lawful:require-design`);不動「願景」與「專案約束」(`lawful:kickoff`);不寫測試、不改程式碼的本體。
