---
name: kickoff
description: dev-flow 的立案,專案的第一個命令(還沒有 .design/ 的專案從這裡開始):建立 .design/ 的樹,與開發者訂願景、名詞表、Constraint(硬性限制,語言與版本、編譯器與執行環境、套件、環境、命名與寫法)、Constraint(三道指令)、模組表的骨架;Constraint 之後要補、要改也回這裡;不談需求也不談全域 Law,收尾自動接上 require-design。觸發詞:開新專案、立案、kickoff、建立 .design、專案願景、技術選型、限制、constraint、命名規範、寫法規範、模組表、補名詞節。Use when starting a new dev-flow project and creating its .design tree, vision, language, tooling and module table.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:kickoff — 開樹與願景

> **核心**：Kickoff opens the tree and fixes only the north star, the hard constraints the developer states and the toolchain; Requirements are settled in their own dialogue and global Laws are extracted from finished slices, neither of them here.（開樹，只訂北極星、開發者講得出來的硬性限制與工具鏈；需求有自己的對談，全域 Law 是從做出來的切片裡抽上去的，兩者都不在這裡談。）步驟與這一句衝突時，這一句贏：停下，回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief kickoff --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief kickoff --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief kickoff --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief kickoff --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段（一份輸出切成幾段，每段一道指令）是載入 skill 時跑 `devflow brief kickoff` 的輸出：規章、`.design/` 現在有哪些檔、`system.md` 與 `modules.md` 全份（已經有的話）。開工要讀的規章與專案現況都在這裡，不再另外讀。名詞表不在 brief 裡：它住專案根目錄 `CLAUDE.md` 的「## 名詞」節，`CLAUDE.md` 每一場 session 都已經載入。

目標：不必給。專案現況在這一場裡變過、要重看，再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief kickoff --no-rules`。看到的若是那道指令的原文而不是它的輸出，自己跑一次（不加 `--no-rules`）。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者的意圖、既有程式碼（有的話） | `.design/system.md`（願景、Constraint 填好；「全域 Law」三個小區照模板是空的：領域不變量「無」、層表與對外 I/O 表只有表頭；Features 表還是模板）、`.design/modules.md`（路徑欄的骨架）、專案根目錄 `CLAUDE.md` 的「## 名詞」節（願景裡已經出現的領域名詞）；然後接上 `dev-flow:require-design` |

## 前置

不合規的樹先遷移，再照更新模式往下：

- 只有 `subsystems/` 體系的 `.design/` → `devflow migrate .design --language <adapter>` 印帳本，帶開發者逐項判，再照本 skill 建新樹。
- 需求不住 `requirements/` 的樹（`system.md` 有「## 需求」節，里程碑住 `objectives/` 的各檔或一份 `objectives.md`）、或需求檔還帶調整表的樹（調整表的每一列換成一條綁既有 feature 的里程碑）→ `devflow migrate requirements` 印帳本，帳本列的「人要判的」（里程碑串接的順序、沒有里程碑的需求、無處可去的里程碑、沒有英文名的里程碑）帶開發者逐項判，再 `--write`。
- `devflow status` 警訊說 `system.md` 沒有「## 全域 Law」區、或需求寫著「- Law：」→ `devflow migrate laws` 印帳本再 `--write`。兩道遷移可以接連跑，先後都行。
- 專案根目錄的 `CLAUDE.md` 沒有「## 名詞」節（檔案不存在也算；`devflow status` 的警訊會講）→ 照更新模式補上：照步驟 2 建這一節，把願景與既有需求裡已經在用的領域名詞照步驟 3 的「名詞」那一題與開發者逐個講定。
- `system.md` 沒有「## Constraint」節（三道指令住「## 語言與工具」節的樹也算）→ 照更新模式補上：把那一節的節名改成「## Constraint」（沒有就照 `templates/system.md` 建），限制的那幾行照模板補在最前面，照步驟 3 的「Constraint」那一題與開發者講定。
- 要談的是需求或里程碑 → 不在這裡，走 `dev-flow:require-design`。要改的是既有的全域 Law（領域不變量、層、對外 I/O）→ 不在這裡，走 `dev-flow:global-laws`。

## 步驟

1. **看現況。** 有 `.design/system.md` 就是更新模式：只改開發者點名的部分（`system.md` 的願景、Constraint，模組表，`CLAUDE.md` 的名詞節），其餘不動；開發者之後想到新的硬性限制、或要改既有的一項，就是回這裡改「Constraint」節那一行。沒有就建。
2. **開樹**：`.design/system.md` 照 `templates/system.md` 建（四節：願景、全域 Law、Constraint、Features；「全域 Law」底下三個小區照模板留著——領域不變量寫「無」、層表與對外 I/O 表只有表頭：全域 Law 是從做出來的切片裡抽上去的（`laws.md`「Law 與需求」），這裡不問、不填）、`.design/modules.md` 照 `templates/modules.md` 建。`requirements/` 不在這裡建：第一條需求由 `dev-flow:require-design` 走 CLI 建檔。
   - **名詞節**（這一節一定要在，`features.md`「`.design/`」）：專案根目錄沒有 `CLAUDE.md` → 建一份，只放 `# <專案名>` 與照 `templates/glossary.md` 寫的「## 名詞」節；已經有 `CLAUDE.md` 而沒有這一節 → 在檔尾補這一節。`CLAUDE.md` 是開發者自己的檔：這一節以外的內容一個字都不准動。
3. **訪談，一題一題問，不確定就再問**。只問做之前就講得清楚、做完也不會變的東西：
   - **願景**先問：這個專案要交出的、世界上還沒有的東西是什麼，替誰改變了什麼，第一段一到三句；後面可以展開替誰做什麼、明確不做什麼。訂不出來就先不往下。寫進 `## 願景`；它是北極星，不是驗收清單，之後的需求不對它逐句對照。
   - **名詞**：把願景裡已經出現的領域名詞逐個挑出來（更新模式再加上既有需求的一句話、驗收、里程碑那一句裡已經在用的），一個一個問開發者「它是什麼、不是什麼」，一句話講定，寫進 `CLAUDE.md`「## 名詞」節的表；只有一兩個也行，之後的由 `dev-flow:require-design` 補。「型別」欄：程式碼裡已經有對應的型別就寫型別名，還沒有就寫 `-`。名詞的定義只寫在這張表，不另外寫進 `system.md`。
   - **Constraint 裡工具要讀的那幾行**：語言（決定 adapter；前後端各一種語言就問各住哪個目錄，寫成 `[<目錄> = <adapter>, …]`，`tooling.md`「language adapter」）；建置、整套測試、子集測試三道指令（多語言專案每側一組）——子集指令從 CI 設定、`Makefile`、`package.json` 或測試框架說明找，找不到問一次。這一行不問，之後每個角色都只會退回去跑整庫。IO 模組追加、忽略目錄有就填，沒有寫「無」。兩人以上會平行 claim 的專案再問號段：每人一段、以 git 的 `user.email` 為鍵（`- 號段:a@corp.com = 000-099;b@corp.com = 100-199`），新人加入時加一段；單人寫「無」。發布行問一次哪些 git tag 算一次發布（寫成「- 發布：`v*`」這樣，`tooling.md`「發布」），每個 tag 都算就寫「無」。「優先」那一行留給 `dev-flow:require-design`。
   - **Constraint 裡的硬性限制**（同一節，`features.md`「`system.md`」）：寫程式之前就定得下來、每一行程式碼與測試都照做的規定。一類一類問：語言與版本、編譯器與執行環境的版本、硬性要求或禁用的套件與框架（含版本）、環境（作業系統、部署目標、容器）、命名與寫法（變數、函數、檔案怎麼命名，格式與風格；既有程式碼裡有 linter、formatter 的設定就讀出來跟開發者確認）。一項一行「類別：限制」，類別可以自己加。只寫開發者說的，不替他訂、不猜；現在講不出來的那一類寫「無」，之後回這裡補。它不是 law：沒有三行、沒有測試，`dev-flow:spike-impl`、`dev-flow:qa` 與 `dev-flow:refactor` 照做。
   - **不問全域 Law，也不立**：領域不變量、層、對外 I/O 都等第一條切片做出來再對著它談。開發者自己提到一條領域裡的規矩（「金額不為負」「狀態不倒退」）→ 告訴他 law 只從實作裡抽出來（`laws.md`「全域 Law」）：碰到它的那條切片做出來之後，`dev-flow:scope-laws` 會對著程式碼跟他談，不在這裡寫。他講的是軟體怎麼寫（語言版本、套件、命名）→ 那是上一題的 Constraint。
4. **模組表的骨架**：有程式碼就 `devflow modules --gen` 生成一個檔一列；沒有程式碼就先列預期的目錄。層欄留白：層表由 `dev-flow:global-laws` 在第一條切片談完約束之後落筆，層欄那時一起填。
5. `devflow status`：願景與名詞節的警訊要清掉；沒有需求的警訊在這一步是正常的，交給 `dev-flow:require-design`。「全域 Law」三個小區是空的不是警訊。變更 commit。
6. **接上 require-design**：直接執行 `dev-flow:require-design`，與開發者談第一批需求並當場切成里程碑，不等開發者另外下指令。

## 收尾

回報願景一句、名詞表寫進了哪幾個名詞（`CLAUDE.md` 是新建的還是在檔尾補的）、Constraint 寫了哪幾項（逐項照抄；哪幾類是「無」）、語言與三道指令、建了哪些檔、模組表幾個檔案還沒填層；附定錨區塊（`tooling.md`「收尾定錨」）。接上 require-design 之後的收尾由它做。需求定完，才推薦切片：`dev-flow:integrate`（把立案以 `plan/<slug>` 分支合進主線），再 `dev-flow:spike-impl <最高優先需求第一條里程碑的全名>`。

## 邊界

不談需求、驗收、優先與里程碑 (`dev-flow:require-design`)；不問、不談、不寫任何一條全域 Law，也不填層表與對外 I/O 表（它們從切片裡抽上去，`dev-flow:scope-laws` 談、`dev-flow:global-laws` 落筆）；不建 feature、不寫 Steps 與 laws（那是切片之後 `dev-flow:scope-laws` 的事）；不寫任何程式碼；不開 ADR；不替開發者決定願景、名詞的定義、Constraint 的任何一項與語言。專案根目錄的 `CLAUDE.md` 只寫它的「## 名詞」節，這一節以外的內容一個字都不准動。
