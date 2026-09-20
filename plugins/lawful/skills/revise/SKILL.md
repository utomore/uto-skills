---
name: revise
description: lawful(有 .lawful/ 的 Haskell 專案)的修訂:既有 pipeline 的行為、簽名或 law 要改,回答 GAP,落地調整 RF-n,或經批准的全域 Law 變更;先攤影響範圍與選項,開發者選了才改原檔、寫 REV,再自動接上 build。觸發詞:修訂、改契約、改 spec、改簽名、改行為、回答 gap、重開、改 law、放寬 law、改全域 Law、領域不變量、效能優化。Use when an existing pipeline or a global Law must change, a GAP was answered, or a refinement is applied.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:revise — 改原檔,留 REV

> **核心**:A Law changes only after the developer has seen its full impact and chosen among options; the change lands in the original document first, stating what moves and what stays protected.(law 要改,開發者先看過完整的影響範圍、在選項裡選了,才落筆;先改原檔,講明動到什麼、保護什麼,之後才是測試與實作。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief revise` 的輸出:規章、分支與工作樹、目標 pipeline 全文與逐條狀態、Stages 上每條簽名與型別的宣告、它引用的 pipeline 的 Stages 表與引用它的那幾列和 law、它朝向哪條里程碑與調整、`gaps.md`、`lint sig` 與 `lint laws` 裡講到它的、`lawful status` 裡講到它的每一行;目標是 `RF-n` 時是那個目標檔、需求的驗收與它動到的每條 pipeline 全文;目標是 `R-n` / `INV-n` 時是那一條的三行、`Cone.md` 全文與 `lint global`;沒給目標時是 `gaps.md`、`lint global` 與 `lawful status` 的需求表、目標表、等決定、警訊與建議路線。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:要改的那條 pipeline 的全名,或一條調整 `RF-n`;改的是需求或全域 Law 就不給,或給 `R-n` / `INV-n`。上面寫「目標未指定」就先定出目標,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise <目標> --no-rules`;同一場裡目標文檔或專案現況變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 前置

- 要加的是一個**可以獨立拿掉的新能力** → 那是新的里程碑與切片,走 `lawful:objective` 再 `lawful:spike-impl`。
- 做的是調整:那條 `RF-n` 要在某個目標檔的調整表上、動到的 pipeline 要是它列的、該目標的建置路線要已經達成;不是就停,回 `lawful:objective`。調整只改實作或行為品質,要改簽名或加 stage 讓它做到新能力的,不是調整,是新里程碑。
- 改的是**全域 Law**(`Cone.md`「全域 Law」區的任何一條:領域不變量、四層那四句、對外 I/O 的列與契約欄):來源只有開發者自己提的,或 `lawful:integrate` 的變更建議**經開發者明確批准**(GAP 記著反例與批准的選項)。沒有批准就停,不動;走下面「全域 Law 的變更」。
- 其餘一律在這裡改原檔。**不開第二份檔**:開了,原檔就停在它被寫下的那一天,三個月後沒有人知道它現在長什麼樣。
- **在哪做**(`roles.md`「分支與所有權」):這條 pipeline 還在一條沒整合的 `build/` 分支上(切片談到一半、qa 開了 GAP、整合的仲裁退回來)→ 就在那棵工作樹上做。pipeline 已在主線上 → 在主線、與 origin 同步、工作樹乾淨時 `git worktree add -b build/<全名> ../<repo>.worktrees/<全名> HEAD`,在那棵樹上做。

## 步驟

1. **拿到來源的原句**:GAP 的提問原句(整合仲裁留下的 GAP,原句含開發者選了哪個選項)、ADR 全名、`RF-n` 與它那一句、開發者的那一句話。REV 的「依」欄要寫它(調整一定寫 `RF-n`,`lawful status` 靠它算調整的進度),不寫已經刪掉的條目編號。
2. **影響範圍**(`laws.md`「影響範圍與選項」):只要這次會動到任何一條 law,先查、先列,不准省略一項,查過而沒有的寫「無」。`lawful status --pipeline <全名>`(引用與被引用)、`lawful status`(建構中的分支、需求達成與否)、`lawful lint global` 是查的工具:

   | 項 | 列什麼 |
   |---|---|
   | 直接動到 | 哪幾條 law 的哪一行變、哪幾條簽名或型別變 |
   | 引用同一處的 law | 同一條 pipeline 裡引用同一個 stage 或觀察點的每一條 law;全域 Law 則是契約欄指到它的每一列、三行裡用到同一個 types 層匯出的每一條領域不變量 |
   | 連動的文檔 | 引用這條子流的每一條消費者、Stages 表引用到動到的簽名的每一條;全域 Law 則是違反得了它的每一條 pipeline |
   | 測試 | 要重寫的(歸屬全名)、要重跑的、確定不受影響的 |
   | 狀態 | 哪幾條 `verified` 要重開;哪幾條建構中的 build 分支要重驗 |
   | 需求 | 哪幾條需求的驗收引用到動到的 law;改完之後它還達不達成 |

3. **給選項,等開發者選**:至少兩個,其中一個一定是「不改」。每個選項寫:改什麼、影響範圍裡哪幾項因此不同、當下成本、之後的代價、可不可逆;你給傾向與理由。**一次一條 law**,開發者對著那一個選項明確說了要,才往下;沉默、整批同意、「你決定」都不算。來源的 GAP 已經記著開發者選定的選項時,仍把影響範圍攤出來請開發者確認一次:仲裁當下看到的是反例,不是全部的牽連。
4. **`verified` 先重開**:`status` 改回 `ready`,在「決定」記一條「重開:<為什麼>」(調整就寫 `RF-n` 那一句)。
5. **先補保護**:這次不准變的既有行為若還不是 law,**先補成 `LAW-n` 再改**。沒有 law 守著的「行為不變」等於沒有保護。調整的保護一定含需求的驗收引用到的每條 law:優化不准讓需求退回未達成。
6. **改條文**:Stages 的簽名、Laws、Examples、層。新的 law 照 `laws.md`「Law 怎麼談」的判準:講得出一個讓它變假的實作。刪掉的 law 號永久空缺,新增的往下接。效能修訂把基準線寫進新的 law(「p95 <= 100,基準線 2026-09-18 量到 400」)。收窄定義域的修訂只動那條 law 的 `forall` / `given`。同一段能力要拆成子流:`lawful claim <slug> --kind 子流 --milestone <M-n>` 建檔,原檔那幾列的模組欄改成「見 P-00x-<slug>」。
7. **寫 REV**:`## 修訂記錄` 加一條,五欄齊全(依 / 動到 / 保護 / 重委派 / 連動);依欄連同選了哪個選項,否決的選項與理由寫進「決定」。law 變了重派 qa,行為、簽名或型別變了重派 refactor。`updated` 改成今天。
8. **連動**:影響範圍「連動的文檔」列到的每一條,逐條同步並寫進「連動」欄。**責任在改的人**:簽名改了編譯器會告訴下游,語意改了什麼都不會抓。
9. **結案 GAP**:寫 REV 的同一個動作把條目**整條刪掉**,不留 resolved。`gaps.md` 空了刪檔。
10. **宣告跟著**(`roles.md`「首跑」):簽名或型別變了就同步改程式碼裡的宣告,呼叫端一起改到編得過,行為不動;修訂新增的 stage 在模組欄指的模組裡宣告並匯出,本體是未實作標記(Haskell `error "P-00x#name not implemented"`),**不得回傳假值**;層變了,檔搬到那一層的樹,模組單元沒宣告那一層就 `lawful module <單元> --layers <新的層>`;`=` 列搬到別的模組單元,另 `lawful rename <P-00x> <單元>-<動詞>` 讓 slug 的領域名詞跟上。跑建置指令,`lawful lint all`(整套的紅只該落在 REV「動到」欄點名的 law 上)。文檔與宣告同一個 commit,訊息帶全名。
11. **接上 build**:直接執行 `lawful:build <全名>`,只重做 REV「重委派」欄點名的:qa 改那幾條測試,首跑時「動到」欄的 law 要紅、「保護」欄的要綠,再派 refactor。調整動到多條 pipeline 時,每一條各一次修訂、各自接上 build。

## 全域 Law 的變更

**任何全域 Law 的修改、放寬、替換或刪除,都必須經開發者明確批准;`lawful:integrate` 只能提出變更建議,不得自行決定變更,也不直接修改全域 Law。經批准的變更只在這裡完成,完成後重新驗證受影響的工作。** 新增也一樣(`laws.md`「全域 Law」准入四條)。

1. 步驟 1 到 3 照做:來源的原句、影響範圍、選項。全域 Law 的影響範圍橫跨整個專案,「連動的文檔」列違反得了它的每一條 pipeline,「狀態」列每一條建構中的分支。放寬與刪除的選項,代價那一格寫明「之後哪些行為不再被擋」。
2. 落筆在 `Cone.md` 的「全域 Law」區,與立案的變更走同一條路(`plan/<slug>` 分支,由 `lawful:integrate` 經 PR 合進主線):新增 `lawful invariant add <一句話> [--kind <種類>]`;修改、放寬、替換、刪除直接改那一條。編號不重用,刪掉的號永久空缺。四層那四句與對外 I/O 表的變更同理;模組單元的名字、職責或層要變,改 `.lawful/modules.md` 那一列(補層走 `lawful module <單元> --layers <新的層>`),改到 `lawful lint boundary` 沒有紅。
3. **重新驗證受影響的工作**,逐項回報結果:
   - `lawful lint global` 沒有紅;
   - 領域不變量的句子或三行變了,它原本的測試作廢 → `lawful:build INV-n` 重派 qa;刪掉的那一條,它的測試模組一起刪(否則是幽靈引用);
   - 影響範圍裡每一條 `verified` 的 pipeline 重跑它的子集測試;紅的重開、各走一次上面的修訂;
   - 建構中的分支:在它的決策紀錄所在分支的 `gaps.md` 留一條 GAP(角色 conductor,目標寫那條全域 Law),它合進新的主線之後從首跑起重跑。
4. 為什麼變更,由 `lawful:integrate` 收這條 `plan/` 分支時寫成 ADR;這裡在回報裡留下 ADR 要用的四節材料(情境、決定、否決的選項、後果)。

## 收尾

回報 REV 第幾條(或哪一條全域 Law)、影響範圍六項、開發者選了哪個選項與否決了哪幾個、動到什麼、保護什麼、要重派誰、連動了哪幾條、對應的調整(有的話)、重新驗證的結果;附定錨區塊。接上 build 之後的收尾由 build 做;達成後 `lawful:integrate`。

## 邊界

一次修訂一條 REV、一次變更一條全域 Law;不順便改別的;不改本體的行為、不寫測試;沒有影響範圍與選項不落筆;同層搬模組不走這裡,`lawful sync`;不做的 pipeline 直接刪檔,理由值得留就寫進 commit 訊息,整合時升成 ADR;不替開發者決定要不要改、選哪一個——開發者說,你寫。
