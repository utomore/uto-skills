---
name: glaws-revise
description: dev-flow(有 .design/ 的專案)的全域 Law 修訂:system.md「全域 Law」區(領域不變量、層、對外 I/O)的第一次定義,與之後每一次新增、修改、放寬、替換、刪除;先攤影響範圍與選項,開發者明確批准才落筆,落筆後重新驗證受影響的工作。觸發詞:全域 Law、global law、領域不變量、invariant、定層、改層、對外 I/O、信任邊界、放寬全域 Law、刪不變量。Use when global Laws are first defined, or one must be added, changed, relaxed, replaced or removed.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:glaws-revise — 全域 Law 的定義與變更

> **核心**:A global Law is written or changed only after the developer has seen its full impact and explicitly approved one option; afterwards every affected piece of work is re-verified.(全域 Law 要立、要改,開發者先看過完整的影響範圍、對著一個選項明確說了要,才落筆;落筆之後重新驗證每一份受影響的工作。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief glaws-revise --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief glaws-revise --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief glaws-revise --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief glaws-revise --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段(一份輸出切成幾段,每段一道指令)是載入 skill 時跑 `devflow brief glaws-revise` 的輸出:規章、分支與工作樹、`system.md` 全份(「全域 Law」三個小區都在裡面)、`modules.md`、每個需求檔、`gaps.md`、`lint global` 的結果與 status 報告(影響範圍從這幾塊攤)。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給;要改的是某一條領域不變量就給 `INV-n`。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief glaws-revise --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 第一次定義:立案之後還是模板的「全域 Law」三個小區。變更:開發者自己提的一條,或 `dev-flow:integrate` 的變更建議經開發者明確批准(GAP 記著反例與批准的選項) | `system.md`「全域 Law」區落筆的那一條(領域不變量、層表、對外 I/O 表的信任、驗證與契約欄),`modules.md` 跟著對得上;重新驗證受影響工作的逐項結果;ADR 要用的四節材料 |

## 前置

- 沒有 `.design/system.md` → `dev-flow:kickoff`。`system.md` 沒有「## 全域 Law」區 → 回 `dev-flow:kickoff` 的前置處理。
- 要改的是**一份文檔的 scope law**、簽名或行為,要回答的 GAP 目標是某份文檔的 law,要落地的是調整 `RF-n` → 不在這裡,走 `dev-flow:law-design`(既有文檔要改的那一種情形)。
- 開發者講的是一件**有做完的一天**的事 → 那是需求,走 `dev-flow:require-design`(`laws.md`「Law 與需求」)。
- 變更的來源只有兩種:開發者自己提的,或 `dev-flow:integrate` 的變更建議**經開發者明確批准**。沒有批准就停,不動。
- **在哪做**:與立案、需求的變更走同一條路——在主線的工作樹上落筆、commit,由 `dev-flow:integrate` 帶上 `plan/<slug>` 分支經 PR 合進主線(`roles.md`「分支與所有權」)。

**任何全域 Law 的修改、放寬、替換或刪除,都必須經開發者明確批准;`dev-flow:integrate` 只能提出變更建議,不得自行決定變更,也不直接修改全域 Law。經批准的變更只在這裡完成,完成後重新驗證受影響的工作。** 新增也一樣(`laws.md`「全域 Law」准入四條)。「明確」= 開發者對著那一條、那一個選項說了要;沉默、整批同意、「你決定」都不算。

## 第一次定義

立案之後「全域 Law」三個小區還是模板(`dev-flow:kickoff` 與 `dev-flow:require-design` 走完自動接到這裡)。逐區與開發者談;每一條都是開發者的決定:你提候選、講它擋掉什麼,開發者一條一條說要不要。此時沒有既有文檔,影響範圍各項寫「無」;選項照樣給,一定含「不立這一條」。

1. **領域不變量**:這個領域裡有沒有永遠為真、任何一份功能都不准違反的事(錢不憑空產生或消失、庫存不為負、狀態不倒退)。從需求檔的一句話與驗收找候選,一條一條問,每條過准入四條(`laws.md`「全域 Law」):兩份以上的功能違反得了它嗎?之後寫得成測試嗎?只有一份功能會碰到的,留給那份 feature 當 scope law。要的就 `devflow invariant add "<一句話>" --kind <種類>`;一條都沒有就這一小區寫「無」。最內層的型別還沒出現,先只留一句話。**寧少勿多**:每多一條,之後每一條切片都多一道束縛。
2. **架構:層**:這個專案由內而外分幾層、各叫什麼、各裝什麼。規則只有兩條(`boundary.md`「層」),層名由專案自己取;小工具一層也行。寫進「架構:層」表,再把 `modules.md` 的層欄填上、同層的合併成 `目錄/**`,到 `devflow lint boundary` 沒有紅。層怎麼切,表本身就是決定,不另開 ADR。
3. **契約:對外 I/O**:這個系統會跨過哪些對外邊界(HTTP、CLI、檔案、第三方服務)、每一端**信任誰**(內容由系統外面決定的是 `untrusted`)。已經有程式碼的入口與出口列成表上的列;還沒有的,把邊界在哪、信任誰跟開發者講定,列由 `dev-flow:law-design` 在切片做完後補。
4. `devflow lint global`、`devflow status`:三類沒有紅,「全域 Law」區的警訊只剩領域不變量「還沒有三行式」(此時是正常的)。變更 commit。

## 全域 Law 的變更

一次變更一條。

1. **拿到來源的原句**:開發者的那一句話,或 GAP 的提問原句(整合仲裁留下的 GAP,原句含反例與開發者批准了哪個選項)。
2. **影響範圍**(`laws.md`「影響範圍與選項」):先查、先列,不准省略一項,查過而沒有的寫「無」。`devflow status`(建構中的分支、需求達成與否)、`devflow lint global` 是查的工具。全域 Law 的影響範圍橫跨整個專案:

   | 項 | 列什麼 |
   |---|---|
   | 直接動到 | 哪一條全域 Law 的哪一行變(句子、三行、層表的哪一列、對外 I/O 表哪一列的信任、驗證或契約欄) |
   | 引用同一處的 law | 契約欄指到它的每一列對外 I/O、三行裡用到同一個最內層匯出的每一條領域不變量 |
   | 連動的文檔 | 違反得了它的每一份 feature |
   | 測試 | 要重寫的(`INV-n#LAW`)、要重跑的、確定不受影響的 |
   | 狀態 | 哪幾份 `verified` 要重開;每一條建構中的 build 分支 |
   | 需求 | 哪幾條需求的驗收因此不同;改完之後它還達不達成 |

3. **給選項,等開發者選**:至少兩個,其中一個一定是「不改」。每個選項寫:改什麼、影響範圍裡哪幾項因此不同、當下成本、之後的代價、可不可逆;放寬與刪除的選項,代價那一格寫明「之後哪些行為不再被擋」;你給傾向與理由。開發者對著那一個選項明確說了要,才往下。來源的 GAP 已經記著開發者選定的選項時,仍把影響範圍攤出來請開發者確認一次:仲裁當下看到的是反例,不是全部的牽連。
4. **落筆**在 `system.md` 的「全域 Law」區:新增 `devflow invariant add <一句話> [--kind <種類>]`;修改、放寬、替換、刪除直接改那一條。編號不重用,刪掉的號永久空缺。層表與對外 I/O 表的變更同理,`modules.md` 跟著改到 `devflow lint boundary` 沒有紅。`updated` 改成今天;來源是 GAP 的,同一個動作把條目**整條刪掉**,`gaps.md` 空了刪檔。
5. **重新驗證受影響的工作**,逐項回報結果:
   - `devflow lint global` 沒有紅;
   - 領域不變量的句子或三行變了,它原本的測試作廢 → `dev-flow:build INV-n` 重派 qa;刪掉的那一條,它的測試檔一起刪(否則是幽靈引用);
   - 影響範圍裡每一份 `verified` 文檔重跑它的子集測試;紅的重開、各走一次 `dev-flow:law-design` 的修訂;
   - 建構中的分支:在它的決策紀錄所在分支的 `gaps.md` 留一條 GAP(角色 conductor,目標寫那條全域 Law),它合進新的主線之後從首跑起重跑。
6. 為什麼變更,由 `dev-flow:integrate` 收這條 `plan/` 分支時寫成 ADR;這裡在回報裡留下 ADR 要用的四節材料(情境、決定、否決的選項、後果)。

## 收尾

回報定了或改了哪一條全域 Law、影響範圍六項、開發者選了哪個選項與否決了哪幾個、重新驗證的逐項結果、ADR 的四節材料;第一次定義則回報領域不變量幾條、幾層、對外 I/O 幾列、模組表還有幾個檔案沒填層。附定錨區塊(`tooling.md`「收尾定錨」)。下一步:`dev-flow:integrate`(`plan/<slug>` 合進主線);第一次定義之後再 `dev-flow:spike-impl <最高優先需求第一條里程碑的全名>`。

## 邊界

一次變更一條全域 Law;不順便改別的;沒有影響範圍與選項不落筆;不替開發者決定要不要立、要不要改、選哪一個——開發者說,你寫。不碰任何一份 feature 或 abstract 的條文、簽名與 scope law(`dev-flow:law-design`);不寫需求、驗收與里程碑(`dev-flow:require-design`);不寫測試、不改程式碼的本體。
