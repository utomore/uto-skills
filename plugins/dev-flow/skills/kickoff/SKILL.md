---
name: kickoff
description: dev-flow 的立案,專案的第一個命令(還沒有 .design/ 的專案從這裡開始):建立 .design/ 的樹,與開發者訂願景、語言與工具(三道指令)、模組表的骨架;不談需求也不談全域 Law,收尾自動接上 require-design。觸發詞:開新專案、立案、kickoff、建立 .design、專案願景、技術選型、模組表。Use when starting a new dev-flow project and creating its .design tree, vision, language, tooling and module table.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:kickoff — 開樹與願景

> **核心**:Kickoff opens the tree and fixes only the north star and the toolchain; Requirements and global Laws are each settled in their own dialogue, never here.(開樹,只訂北極星與工具鏈;需求與全域 Law 各有自己的對談,不在這裡談。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief kickoff --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief kickoff --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief kickoff --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief kickoff --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段(一份輸出切成幾段,每段一道指令)是載入 skill 時跑 `devflow brief kickoff` 的輸出:規章、`.design/` 現在有哪些檔、`system.md` 與 `modules.md` 全份(已經有的話)。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief kickoff --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者的意圖、既有程式碼(有的話) | `.design/system.md`(願景、語言與工具填好;「全域 Law」三個小區與 Features 表還是模板)、`.design/modules.md`(路徑欄的骨架);然後接上 `dev-flow:require-design` |

## 前置

不合規的樹先遷移,再照更新模式往下:

- 只有 `subsystems/` 體系的 `.design/` → `devflow migrate .design --language <adapter>` 印帳本,帶開發者逐項判,再照本 skill 建新樹。
- 需求不住 `requirements/` 的樹(`system.md` 有「## 需求」節,里程碑住 `objectives/` 的各檔或一份 `objectives.md`)→ `devflow migrate requirements` 印帳本,帳本列的「人要判的」(里程碑串接的順序、沒有里程碑的需求、無處可去的里程碑)帶開發者逐項判,再 `--write`。
- `devflow status` 警訊說 `system.md` 沒有「## 全域 Law」區、或需求寫著「- Law:」→ `devflow migrate laws` 印帳本再 `--write`。兩道遷移可以接連跑,先後都行。
- 要談的是需求、里程碑或調整 → 不在這裡,走 `dev-flow:require-design`。要定或要改的是全域 Law(領域不變量、層、對外 I/O)→ 不在這裡,走 `dev-flow:global-laws`。

## 步驟

1. **看現況。** 有 `.design/system.md` 就是更新模式:只改開發者點名的節(願景、語言與工具、模組表),其餘不動。沒有就建。
2. **開樹**:`.design/system.md` 照 `templates/system.md` 建(四節:願景、全域 Law、語言與工具、Features;「全域 Law」底下三個小區先留模板,等 `dev-flow:global-laws`)、`.design/modules.md` 照 `templates/modules.md` 建。`requirements/` 不在這裡建:第一條需求由 `dev-flow:require-design` 走 CLI 建檔。
3. **訪談,一題一題問,不確定就再問**。只問做之前就講得清楚、做完也不會變的東西:
   - **願景**先問:這個專案要交出的、世界上還沒有的東西是什麼,替誰改變了什麼,第一段一到三句;後面可以展開替誰做什麼、明確不做什麼。訂不出來就先不往下。寫進 `## 願景`;它是北極星,不是驗收清單,之後的需求不對它逐句對照。
   - **語言與工具**:語言(決定 adapter;前後端各一種語言就問各住哪個目錄,寫成 `[<目錄> = <adapter>, …]`,`tooling.md`「language adapter」);建置、整套測試、子集測試三道指令(多語言專案每側一組)——子集指令從 CI 設定、`Makefile`、`package.json` 或測試框架說明找,找不到問一次。這一行不問,之後每個角色都只會退回去跑整庫。IO 模組追加、忽略目錄有就填,沒有寫「無」。兩人以上會平行 claim 的專案再問號段:每人一段、以 git 的 `user.email` 為鍵(`- 號段:a@corp.com = 000-099;b@corp.com = 100-199`),新人加入時加一段;單人寫「無」。「優先」那一行留給 `dev-flow:require-design`。
4. **模組表的骨架**:有程式碼就 `devflow modules --gen` 生成一個檔一列;沒有程式碼就先列預期的目錄。層欄留白:層是全域 Law 的架構一類,由 `dev-flow:global-laws` 與開發者定了層表之後填。
5. `devflow status`:願景的警訊要清掉;沒有需求、全域 Law 三區還是模板的警訊在這一步是正常的,交給後面兩個 skill。變更 commit。
6. **接上 require-design**:直接執行 `dev-flow:require-design`,與開發者談第一批需求並當場切成里程碑,不等開發者另外下指令;需求定完,它接上 `dev-flow:global-laws` 定全域 Law 三區。

## 收尾

回報願景一句、語言與三道指令、建了哪些檔、模組表幾個檔案還沒填層;附定錨區塊(`tooling.md`「收尾定錨」)。接上 require-design 之後的收尾由它做。需求與全域 Law 三區都定完,才推薦切片:`dev-flow:integrate`(把立案以 `plan/<slug>` 分支合進主線),再 `dev-flow:spike-impl <最高優先需求第一條里程碑的全名>`。

## 邊界

不談需求、驗收、優先與里程碑(`dev-flow:require-design`);不談、不寫任何一條全域 Law,也不填層表與對外 I/O 表(`dev-flow:global-laws`);不建 feature、不寫 Steps 與 laws(那是切片之後 `dev-flow:scope-laws` 的事);不寫任何程式碼;不開 ADR;不替開發者決定願景與語言。
