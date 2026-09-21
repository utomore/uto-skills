---
name: global-laws
description: dev-flow(有 .design/ 的專案)全域 Law 落筆的地方。全域 Law 是從做出來的切片裡抽上去的:scope-laws 列的候選或開發者點名的一條既有 law,攤影響範圍、開發者明確批准才寫進 system.md「全域 Law」區,抽上去的 law 從原文檔搬走;之後的修改、放寬、替換、刪除同樣要批准、也只在這裡。觸發詞:全域 Law、抽上去、領域不變量、invariant、定層、對外 I/O、放寬全域 Law。Use when a Law from a finished slice should become a global Law, or a global Law must be changed, relaxed or removed.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:global-laws — 把 Law 抽成全域 Law,改全域 Law

> **核心**:A global Law is extracted from a finished slice, never invented ahead of the code; it is written or changed only after the developer has seen its full impact and explicitly approved one option, and afterwards every affected piece of work is re-verified.(全域 Law 是從做出來的切片裡抽上去的,不憑空定;要立、要改,開發者先看過完整的影響範圍、對著一個選項明確說了要,才落筆;落筆之後重新驗證每一份受影響的工作。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief global-laws --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief global-laws --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief global-laws --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief global-laws --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段(一份輸出切成幾段,每段一道指令)是載入 skill 時跑 `devflow brief global-laws` 的輸出:規章、分支與工作樹、`system.md` 全份(「全域 Law」三個小區都在裡面)、`modules.md`、`gaps.md`、`lint global` 的結果與 status 報告(影響範圍從這幾塊攤)。目標是里程碑時另有這條里程碑所在的需求檔全文、決策紀錄全份、已經綁上的文檔全文與逐條狀態(候選的出處在裡面);沒有目標或目標是 `INV-n` 時另有每個需求檔。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:`dev-flow:scope-laws` 帶著候選接過來時是那條里程碑的全名 `M-n-<slug>`,參數裡全名後面那一段就是候選清單(每條的原句、出處的文檔全名與 law 編號、改寫後的三行;層的候選;要改的既有全域 Law 與原因),照它開工,不必再問一次。要改的是某一條領域不變量就給 `INV-n`;其餘不必給。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief global-laws <同一個目標> --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 情形 | 輸入 | 產出 |
|---|---|---|
| **抽上去**(主場景) | 候選的原句與出處。來源三種:`dev-flow:scope-laws` 對著剛做完的切片列的候選(領域不變量、層、要改的對外 I/O 既有列)、開發者自己點名的一條既有的 scope law、`dev-flow:integrate` 的變更建議經開發者明確批准(GAP 記著反例與批准的選項) | `system.md`「全域 Law」區落筆的那一條:領域不變量(三行從出處那條 law 照搬,出處那條 law 從原文檔搬走)、層表(`modules.md` 的層欄跟著填)、對外 I/O 表既有列的信任、驗證與契約欄;決策紀錄「Decisions」的一列;然後回到原本的流程(候選來自 `dev-flow:scope-laws` 時接上 `dev-flow:build M-n-<slug>`) |
| **變更** | 既有的一條全域 Law 要修改、放寬、替換或刪除:開發者自己提的,或 `dev-flow:integrate` 的變更建議經開發者明確批准 | 改過的那一條,`modules.md` 跟著對得上;重新驗證受影響工作的逐項結果;ADR 要用的四節材料 |

## 前置

- 沒有 `.design/system.md` → `dev-flow:kickoff`。`system.md` 沒有「## 全域 Law」區 → 回 `dev-flow:kickoff` 的前置處理。
- 要改的是**一份文檔**的 scope law、簽名或實作,要回答的 GAP 目標是某份文檔,要做的是一條靠修訂達成的里程碑 → 不在這裡:要調整(修改、放寬、替換、刪除)既有的 scope law 走 `dev-flow:scope-laws`;law 不動、或只新增 law,而文檔或實作要變(含靠修訂達成的里程碑)走 `dev-flow:scope-revise`。
- 開發者講的是一件**有做完的一天**的事 → 那是需求,走 `dev-flow:require-design`(`laws.md`「Law 與需求」)。
- 來源只有三種:`dev-flow:scope-laws` 列的候選(開發者在那裡逐條說了要)、開發者自己點名的一條既有的 scope law、`dev-flow:integrate` 的變更建議**經開發者明確批准**。沒有批准就停,不動。
- **在哪做**(`roles.md`「分支」):候選來自 `dev-flow:scope-laws`,或出處是一份還在 `build/` 分支上、還沒 `verified` 的文檔 → 就在那條里程碑的工作樹 `../<repo>.worktrees/M-n-<slug>` 上落筆、commit,與這一片一起經整合進主線。其餘(出處的文檔已經在主線上、既有全域 Law 的變更)→ 與立案、需求的變更走同一條路:在主線的工作樹上落筆、commit,由 `dev-flow:integrate` 帶上 `plan/<slug>` 分支經 PR 合進主線。

**任何全域 Law 的新增、修改、放寬、替換或刪除,都必須經開發者明確批准;`dev-flow:integrate` 只能提出變更建議,不得自行決定變更,也不直接修改全域 Law。經批准的只在這裡落筆,落筆後重新驗證受影響的工作。**「明確」= 開發者對著那一條、那一個選項說了要;沉默、整批同意、「你決定」都不算。

## 抽上去

全域 Law 三類都是從做出來的切片裡抽上去的(`laws.md`「全域 Law」):領域不變量的三行要引用最內層的型別,層表要對每個檔的 import,對外 I/O 表的每一格要對到模組、型別、step 與 law——程式碼還不在的時候只能猜。一次一條候選;每一條都是開發者的決定,你講它擋掉什麼、牽動什麼,開發者說要不要。

1. **拿到候選的原句與出處**:`dev-flow:scope-laws` 帶來的清單照抄(原句、出處如 `F-001-checkout#LAW-3`、改寫後的三行、層的候選);開發者自己點名的,問到它現在住在哪一份文檔的哪一條 law(沒有出處的見下面「沒有出處的不立」)。
2. **照准入判準再判一次**(`laws.md`「全域 Law」准入四條):開發者批准了嗎;三行只引用最內層的匯出、型別名與標準函式庫嗎;不只出處那一份 feature 違反得了它嗎;寫得成測試、lint 或型別約束嗎。過不了的不抽:留在出處當 scope law,回報講哪一條沒過。
3. **影響範圍**(`laws.md`「影響範圍與選項」):先查、先列,六項不准省略一項,查過而沒有的寫「無」。專案的第一片多半各項是「無」;之後的片要列:哪幾份既有的文檔違反得了它、它們現在的程式碼守不守得住(沒有測試可判就寫「未知」)、哪幾條建構中的分支。`devflow status`、`devflow lint global` 是查的工具。
4. **給選項,等開發者批准**:至少兩個,其中一個一定是「不抽,留在出處當 scope law」(層的候選是「不立這一層 / 不立層表」)。每個選項寫:改什麼、影響範圍裡哪幾項因此不同、當下成本、之後的代價(每多一條全域 Law,之後每一條切片都多一道束縛)、可不可逆;你給傾向與理由。開發者對著那一個選項明確說了要,才往下。
5. **落筆**在 `system.md` 的「全域 Law」區,順序是層 → 領域不變量 → 對外 I/O 既有的列(領域不變量的三行要對最內層,層表先在才對得到):
   - **層**:寫進「架構:層」表,由內而外,每層一句裝什麼(`boundary.md`「層」的兩條規則,層名由專案自己取;小工具一層也行)。把 `modules.md` 的層欄照講定的填上、同層的合併成 `目錄/**`,填到 `devflow lint boundary` **反映現況**:未登記與幽靈的檔案清掉;import 方向的紅(這一片長出來的樣子與講定的層不合)不在這裡修,逐條列進回報,留給接下來的 build 帶 refactor 把程式碼調到成立。這一片文檔 Steps 表的層欄要與 `modules.md` 對得上(`devflow lint sig`)。層怎麼切,表本身就是決定。
   - **領域不變量**:`devflow invariant add "<一句話>" --kind <種類>` 配號;三行從出處那條 law 照搬,識別字改成只用最內層的匯出與型別名(`devflow lint invariants` 對帳)。**出處那條 law 從原文檔的 Laws 節搬走**:文檔此時還沒 `verified`,在同一條 build 分支上直接改,不寫 REV;law 號永久空缺;只覆蓋那條 law 的 example 一起拿掉,同時覆蓋別條 law 的 example 把它從「覆蓋」欄拿掉;對外 I/O 表契約欄指到它的改指 `INV-n`;決策紀錄「Verification」的「首跑該紅」列著它的改寫成 `INV-n#LAW`。搬走之後 `devflow lint laws` 有紅(`=` 列沒有 law 引用了、example 指不到 law)→ 停下回報,交回 `dev-flow:scope-laws <文檔全名>` 補。**出處的文檔已經 `verified` → 這裡停下並講清楚**:搬走它的 law 是調整既有的 law,先走 `dev-flow:scope-laws <文檔全名>`(影響範圍、選項、REV),那一件做完再回來立這一條。
   - **對外 I/O 既有的列**(放寬信任、換驗證、換契約):直接改那一列;這一片的新列不經過這裡,`dev-flow:scope-laws` 已經寫了。
   - `updated` 改成今天;來源是 GAP 的,同一個動作把條目**整條刪掉**,`gaps.md` 空了刪檔。
6. **驗**:`devflow lint global`——契約與領域不變量沒有紅,架構的紅只准是上面列進回報的 import 方向那幾條;`devflow lint sig`、`devflow lint laws` 沒有紅。在 build 分支上落筆的,決策紀錄「Decisions」每一條各記一列(立了哪一條、為什麼、否決的選項、可逆欄、跨文檔欄為是),`dev-flow:integrate` 靠這一列問開發者要不要升 ADR;變更 commit,訊息帶 `M-n-<slug>`。
7. **回到原本的流程**:候選來自 `dev-flow:scope-laws` → 回報裡寫明下一步是 `dev-flow:build M-n-<slug>`,並直接執行它,不等開發者另外下指令:build 照 `roles.md`「驗收測試」替新的 `INV-n` 派 qa 寫 `INV-n#LAW` 測試(原本守出處那條 law 的測試,歸屬由那一波的 qa 改成 `INV-n#LAW`),refactor 把層表與新的全域 Law 留下的紅調到成立。其餘來源 → `dev-flow:integrate`。

### 沒有出處的不立

law 只從實作裡抽出來(`laws.md`「全域 Law」)。開發者提的一句對不到任何一份文檔的 law、也對不到這一片的程式碼 → 不立、不配號,一句話講清楚:還沒有實際碰到的情況,訂不出好的約束;它講到的那一塊由哪條里程碑的切片做出來,就在那條切片的 `dev-flow:scope-laws` 對著程式碼談。他講的其實是寫程式之前就定得下來的硬性規定(語言與版本、編譯器與執行環境、套件、環境、命名與寫法)→ 那不是 law,住 `system.md` 的「Constraint」節,走 `dev-flow:kickoff`。**寧少勿多**:每多一條全域 Law,之後每一條切片都多一道束縛。

## 全域 Law 的變更

既有的一條全域 Law 要修改、放寬、替換或刪除。一次變更一條。

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
4. **落筆**在 `system.md` 的「全域 Law」區:修改、放寬、替換、刪除直接改那一條。編號不重用,刪掉的號永久空缺。層表與對外 I/O 表的變更同理,`modules.md` 跟著改到 `devflow lint boundary` 沒有紅。`updated` 改成今天;來源是 GAP 的,同一個動作把條目**整條刪掉**,`gaps.md` 空了刪檔。
5. **重新驗證受影響的工作**,逐項回報結果:
   - `devflow lint global` 沒有紅;
   - 領域不變量的句子或三行變了,它原本的測試作廢 → `dev-flow:build INV-n` 重派 qa;刪掉的那一條,它的測試檔一起刪(否則是幽靈引用);
   - 影響範圍裡每一份 `verified` 文檔重跑它的子集測試;紅的重開、各走一次修訂(它既有的 law 要跟著調整走 `dev-flow:scope-laws`,既有的 law 不動、只有實作要服從新的全域 Law 走 `dev-flow:scope-revise`);
   - 建構中的分支:在它的決策紀錄所在分支的 `gaps.md` 留一條 GAP(角色 conductor,目標寫那條全域 Law),它合進新的主線之後從首跑起重跑。
6. 為什麼變更,由 `dev-flow:integrate` 收這條 `plan/` 分支時寫成 ADR;這裡在回報裡留下 ADR 要用的四節材料(情境、決定、否決的選項、後果)。

## 收尾

抽上去:回報每條候選的原句與出處、准入四條各自過不過、影響範圍六項、開發者選了哪個選項與否決了哪幾個、落筆了什麼(`INV-n` 與它的三行、從哪份文檔搬走了哪條 law、層表幾層與 `modules.md` 還有幾個檔案沒填層、對外 I/O 改了哪一列)、`lint boundary` 留給 build 調的紅逐條、沒抽的候選與原因;下一步寫明:候選來自 `dev-flow:scope-laws` 的是 `dev-flow:build M-n-<slug>`(直接接上),其餘是 `dev-flow:integrate`。變更:回報改了哪一條全域 Law、影響範圍六項、開發者選了哪個選項與否決了哪幾個、重新驗證的逐項結果、ADR 的四節材料;下一步 `dev-flow:integrate`(`plan/<slug>` 合進主線)。附定錨區塊(`tooling.md`「收尾定錨」)。

## 邊界

一次一條全域 Law;不順便改別的;沒有影響範圍與選項不落筆;不替開發者決定要不要抽、要不要改、選哪一個——開發者說,你寫。不憑空提全域 Law:候選要有出處(一條切片裡談定的 law、這一片長出來的層與邊界),或是開發者自己事先就知道的那一句。除了把抽上去的那條 law 從還沒 `verified` 的出處文檔搬走、把它的 Steps 層欄對上層表,不碰任何一份 feature 的條文、簽名與 scope law(`dev-flow:scope-laws`、`dev-flow:scope-revise`);這一片在對外 I/O 表的新列不在這裡寫(`dev-flow:scope-laws`);不寫需求、驗收與里程碑(`dev-flow:require-design`);不寫測試、不改程式碼的本體。
