---
name: integrate
description: dev-flow(有 .design/ 的專案)的整合,唯一發 PR 的出口:把達成的 build 分支合成一條,整套綠、每條 law 仍成立才發 PR;兩條線的 law 互斥時向開發者仲裁、寫 ADR;全域 Law 只提變更建議。觸發詞:發 PR、pull request、整合、integrate、合併分支、merge、仲裁、ADR。Use when finished branches should be merged, verified together and sent as a pull request.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:integrate — 分支合成一條 PR

> **核心**：Integration MUST NOT reduce Law satisfaction, and MUST NOT change a Law: it proposes, the developer approves, scope-laws or global-laws writes.（合併之前成立的每一條 law，合併之後都要仍然成立；做不到就不合，拿反例去問開發者。整合不改任何一條 law——scope law 與全域 Law 都一樣：只提變更建議，開發者明確批准，scope law 由 scope-laws、全域 Law 由 global-laws 落筆。）步驟與這一句衝突時，這一句贏：停下，回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief integrate --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief integrate --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief integrate --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief integrate --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段（一份輸出切成幾段，每段一道指令）是載入 skill 時跑 `devflow brief integrate` 的輸出：規章、分支與工作樹（建構中的與已合進主線卻還在的 build 分支都列了）、這棵樹的決策紀錄清單、`system.md`「Constraint」、`gaps.md`；專案沒有 `.design/` 時只有分支那一塊，規章不必讀，照 git 與 PR 的部分做完即可。開工要讀的規章與專案現況都在這裡，不再另外讀。

目標：不必給。專案現況在這一場裡變過、要重看，再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief integrate --no-rules`。看到的若是那道指令的原文而不是它的輸出，自己跑一次（不加 `--no-rules`）。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 要合的分支（寫鍵或分支名；沒指定就全部沒合進主線、已經達成的） | 一條整合分支、建置與整套綠、需要的 ADR、PR 一條；決策紀錄內容在 PR 裡 |

## 0. 確認當前分支（必做，不得跳過）

1. `git fetch --all --prune`；`gh repo view --json defaultBranchRef` 確認主線名，`git branch --show-current` 取得當前分支。
2. 當前分支不是主線 → 進 §1，它自己也是候選。
3. 當前分支是主線：**禁止從主線發 PR**。`git status --porcelain` 與 `git log origin/<主線>..HEAD --oneline` 盤點未提交的變更與領先 origin 的本地 commit。
   - 兩者都空 → 主線乾淨，進 §1 收別的分支。
   - 有東西 → 先開新分支把它帶走：只動 `.design/` 的 `system.md`、`requirements/`、`modules.md`（立案、需求與全域 Law 的變更）→ `plan/<slug>`；其餘從變更內容推斷是哪一份文檔與哪個 type，`git switch -c <type>/<slug>`（如 `fix/F-002-refund`）；推斷不出來才用 AskUserQuestion 問分支名。未提交變更與領先的 commit 都跟著過去；接著 `git branch -f <主線> origin/<主線>` 把本地主線還原，避免主線留著沒發 PR 的 commit。未提交的變更在新分支上 commit（conventional commit 風格，訊息帶**文檔全名**或改了哪條需求、里程碑、全域 Law）。這條新分支進 §1。
   - 主線乾淨，又沒有任何候選分支 → 沒有東西可發，回報後停止。

## 1. 清理與盤點

1. **清理**：`git branch --merged <主線>` 裡的 `build/*` 與 `plan/*` 分支（與主線同一個 sha、剛開還沒有 commit 的不算），連同 `git worktree list` 裡對應的工作樹，`git worktree remove` 後 `git branch -d`。
2. **候選**：`git branch -a --no-merged <主線>`；開發者指定就只收那些。每條標出它是哪一種：
   - **建構分支** `build/<鍵>`（鍵是里程碑全名、文檔全名或 `R-n` / `INV-n`）：`git show <分支>:.design/journal/<鍵>.md` 讀決策紀錄。文檔退役的分支（決策紀錄的「Goal / Scope」寫為什麼退役、文檔已經刪了）照收，§3 替它寫一條 ADR。讀不到、或決策紀錄沒有「Verification」節 → 還沒收尾，不收，回報它走到哪一步（`devflow status` 的建構中那一行）。決策紀錄 `verdict: infeasible` → 走不通的切片，不合它的程式碼，§3 只把決策紀錄升成 ADR。
   - **立案分支** `plan/<slug>`：只動 `.design/`；在那條分支上 `devflow lint all` 沒有新的紅才收。它排最前面。
   - **其餘分支**：從分支名或 commit 訊息推出對應的**文檔全名**（寫 `F-001-checkout`，不要只寫 `F-001`——PR 描述會被沒讀過這份文檔的人讀到）；對不到文檔就寫分支名。
3. **順序**：`plan/` 最先；有決策紀錄的照 `devflow status` 的需求優先與里程碑順序排，被引用的文檔排在引用它的之前（需求表的「依賴」欄：被依賴的那條需求的分支在前）；其餘照開發者指定的順序，沒指定且推不出取捨才用 AskUserQuestion 問。
4. **預報**：每條 `git diff --name-only <base>..<分支>`（有決策紀錄的 `base` 從決策紀錄抄，其餘用 `git merge-base`），兩條以上都動到的檔列成預報，對照各決策紀錄的「Touched」與「合併時要看」；兩份決策紀錄的「Assumptions & Invariants」對同一個型別或同一個檔案各有一列的，先標出來——那是最可能互斥的地方。

## 2. 整合

1. 候選只有一條 → 直接用它，跳到 §3。
2. 從主線開整合分支：`git switch -c integrate/<YYYY-MM-DD>-<slug>`。
3. 依 §1 的順序逐條 `git merge --no-ff <分支>`。衝突照 `roles.md`「整合」三類處置：清單型（建置設定的檔案清單、匯出清單、`gaps.md`、模組表、對外 I/O 表、Features 表）與相鄰行的加法兩邊都留；同一個簽名或本體兩邊都改 → `git merge --abort`，這一條走 §4 的仲裁。`gaps.md` 撞號，後合的往上移，一條 commit 記「移 GAP-n → GAP-m」。每條合完的 commit 就是 merge commit 本身。

## 3. 驗收

1. 跑建置與整套測試（有 `.design/` 就是 `system.md`「Constraint」的那兩道），輸出留檔；有 `.design/` 再跑 `devflow status --tests <log>`（多語言專案每側一份：`--tests <目錄>=<log>,<目錄>=<log>`）與 `devflow lint all`（`lint global` 的三道在裡面：架構、契約、領域不變量）。
2. 判準：**每一條 law 都仍然成立**——每份決策紀錄宣稱達成的文檔合併後仍達成、全域 Law 三類沒有新的紅、領域不變量全綠；原本達成的需求沒有退回未達成；決策紀錄「合併時要看」預期的變化如期發生；沒有新的紅、沒有新的警訊。**帶著紅燈不發 PR。**
3. **重複的 step**（`roles.md`「整合」、`features.md`「編號與引用」）：`lint sig` 報同名簽名在兩份文檔都沒註明「見」= 兩條切片平行開工、各寫了一份同樣的 step。一個 step 與它的 law 只住一份文檔：用 AskUserQuestion 問開發者留哪一份（你的傾向放第一個，預設留先合進主線的那一份），各附當下成本與之後的代價。另一份的分支不進這次整合：在它的工作樹的 `.design/gaps.md` 加一條 GAP（角色 conductor，目標那個 step，「需要回答什麼」寫留了哪一份與開發者的原話）並 commit；留著的那一份合進主線後，它的工作樹合入主線，`dev-flow:scope-laws <它的全名>` 刪掉自己的那個 step 與它的 law、改成引用，再 build。你不改條文。剩下的候選回 §2 重合。
4. **合併後紅**：歸因不改碼（`roles.md`「整合」）：那條 law 屬於哪份文檔、它在自己的分支上綠不綠（看決策紀錄的「Verification」）、哪幾條分支與它共用檔案。候選超過一條才從主線另開臨時分支逐條重合、跑那份文檔的子集，找出第一條讓它紅的，臨時分支刪掉。分支綠、合併紅 → §4。
5. **ADR**（`features.md`「ADR」）：每份決策紀錄「Decisions」表裡可逆欄為否、而且跨文檔欄為是的列，各問開發者一次要不要升 ADR；要就 `devflow claim adr <slug> --description <句>`，四節從那一列與決策紀錄的「Goal / Scope」寫。走不通的切片：決策紀錄升成一條 ADR（情境 = 那條里程碑要做到什麼，決定 = 這個做法不走，否決的替代方案 = 試過的做法與卡住的地方，後果 = 下次之前要先知道的事），它的分支與工作樹刪掉。文檔退役的分支一定有一條：情境 = 那份 feature 原本替誰做什麼，決定 = 退役，否決的替代方案 = 不退役，後果 = 它的 step 搬去了哪一份、哪條里程碑的綁定少了它。ADR commit 在要發 PR 的分支上。

## 4. 仲裁（兩條分支的 law 或假設互斥）

一次一條，用 AskUserQuestion 問開發者；整合者自己不改 law、不改本體、不現場合併兩邊的邏輯。選項是給開發者的**變更建議**：你不准自己選，也不准因為哪一個讓合併最快過就推它——讓合併過得去最省事的辦法永遠是把 law 改鬆。

1. **呈現反例，不是兩段條文**：測試縮小後的那個輸入、那條 law 說結果該是什麼、合併後的程式碼算出什麼、兩邊各依哪一條 law 或決策紀錄「Assumptions & Invariants」的哪一列。合不起來的文字衝突同樣：兩邊各把那一段改成什麼、各為了哪條 law。
2. **三個選項**，各附當下成本、之後的代價、可不可逆；你的傾向放第一個：
   - **以 A 為主**：B 不進這次整合。A 合進主線後，B 的工作樹合入主線，`dev-flow:scope-laws` 改 B 那條 law，再 build。
   - **收窄定義域**：兩條 law 各自的 `forall` / `given` 排除對方的情境。兩份文檔各一次 `dev-flow:scope-laws` 的修訂，只重派 qa 改那條測試；實作多半不必動。兩條分支都先退回。
   - **提煉上層 Law**：建議立一條領域不變量，寫出那一句話與它過不過得了准入四條（`laws.md`「全域 Law」）。開發者明確批准後，由 `dev-flow:global-laws` 走「全域 Law 的變更」落筆，不是你；兩條分支都退回，各自 `dev-flow:scope-laws` 讓自己的 law 服從它，再 build。它的 `plan/` 分支之後進來的那次整合，你替它寫一條 ADR 記為什麼。
3. **寫下結果**：被退回的每條分支，在它的工作樹的 `.design/gaps.md` 加一條 GAP（角色 conductor，目標那條 law，「模糊點」寫反例，「需要回答什麼」寫開發者選的選項與原話）並 commit；那條分支從這次的候選拿掉。仲裁的結果都是調整既有的 law，所以被退回的分支之後走 `dev-flow:scope-laws <全名>`，整件修訂由它一手做到 `verified`（既有的 law 不動的修訂才是 `dev-flow:scope-revise`）。剩下的候選回 §2 重合。
4. **全域 Law 的變更建議**：合併後紅的是全域 Law（`devflow lint global` 的紅、領域不變量的測試紅），或決策紀錄的 Constraint 欄顯示某一條全域 Law 逼出了沒道理的決定 → 照同一個格式提建議：反例、選項（一定含「不改，退回違反它的那條分支」）、各自的當下成本、之後的代價（放寬與刪除寫明之後哪些行為不再被擋）、可不可逆。**任何全域 Law 的修改、放寬、替換或刪除，都必須經開發者明確批准；你只能提出變更建議，不得自行決定變更，也不直接修改全域 Law。** 「明確」= 開發者對著那一條、那一個選項說了要。批准的選項寫成 GAP（角色 conductor，目標寫那條全域 Law，例 `INV-2`），告訴開發者下一步是 `dev-flow:global-laws`：它攤開完整的影響範圍、落筆、重新驗證受影響的工作。這次整合只合不受那條變更影響的分支。

## 5. 發 PR

1. 再次確認 `git branch --show-current` 不是主線，push 要發 PR 的分支。
2. **刪決策紀錄之前先把「Entry」留下來**：每份以里程碑全名為鍵的決策紀錄，把它「Entry」那道指令寫進那條里程碑的怎麼驗欄（`devflow requirement verify <M-n-slug> "<Entry 那道指令>"`）。決策紀錄不上主線，開發者審核這條需求時要的手段只剩這一欄（`features.md`「需求的達成只有人判得了」）。
3. 有決策紀錄就把每份決策紀錄的內容寫進 PR 內文，`git rm .design/journal/*.md` commit。
4. 組好內容**直接 `gh pr create` 送出，不需先向開發者確認**（發完在 §6 回報大綱）：
   - **標題**：英文 conventional commit 風格加全名，例 `feat: checkout and refund (F-001-checkout, F-002-refund)`、`refactor: refund references checkout's settle (F-002-refund)`、立案分支 `plan: add shipping requirement (R-2, M-3-ship)`
   - **內文**：繁體中文，章節固定：

     ```markdown
     ## 摘要
     (兩到三句:這個 PR 處理什麼、主要處理的是什麼、讓哪條需求的哪條里程碑達成;沒有 .design/ 的專案寫改了系統的哪個部分、為什麼)

     ### 新增 Feature
     (這次做出來的每份 feature 一段:全名、一句話做什麼、綁哪條需求的哪條里程碑、Steps 表引用了哪幾份既有的 feature(模組欄註明「見」的那幾列);無則「無」)

     ### 調整既有 Feature (Revise)
     (這次被修訂的每份 feature 一段:全名、REV-n、依什麼(GAP-n / 里程碑全名 / 開發者的話)、動到什麼、保護了什麼、走的是 `dev-flow:scope-laws` 還是 `dev-flow:scope-revise`;文檔退役也列在這裡;無則「無」)

     ## Laws
     (一句話:這次的 law 共幾條、全綠沒有。law 的狀況就是測試的狀況,同一句話寫完:附實際跑的整套指令與結果,與 `devflow status` 的 laws 綠幾條 / 共幾條、全域 Law 三類的結果、領域不變量成立幾條)
     - 擋到了實作的全域 Law:<INV-n / 層的規則 / 對外 I/O 的契約:哪條分支、擋掉了什麼做法>;抄各決策紀錄「Decisions」表裡 Constraint 欄指到全域 Law 的列,供開發者判斷哪一條該瘦身;無則「無」
     - 提出而還沒批准的全域 Law 變更建議:<哪一條、反例、選項>;無則「無」

     ### 改動既有 Global Laws
     (每條一段:`INV-n` / 層 / 對外 I/O 的哪一列、改了什麼、開發者哪一句話批准的、對應哪條 ADR;只來自 `dev-flow:global-laws` 落筆的;無則「無」)

     ### 新增 Global Laws
     (每條一段:`INV-n [種類] 一句話`、從哪份文檔的哪條 law 抽上去的、開發者哪一句話批准的、`INV-n#LAW` 測試綠沒有;無則「無」)

     ### 改動既有 Scope Laws
     (每條一段:`F-00x#LAW-n`、原本承諾什麼、改成什麼、為什麼、哪條 REV 記著它;只來自 `dev-flow:scope-laws`;無則「無」)

     ### 新增 Scope Laws
     (每條一段:`F-00x#LAW-n [種類] 一句話`、首跑該紅還是該綠、現在綠沒有;無則「無」)

     ## Requirements
     (每條一列:`<新增 | 調整>` `R-n-<slug>` · 現在的狀態(已驗收 / 待審核 / 待重審 / 建構中 / 未知 / 未達成)與判定來源。**待審核的寫明「等開發者親自驗收」與那道 `devflow requirement accept` 指令**(`features.md`「需求的達成只有人判得了」);里程碑的新增或改動也寫在它那一列底下;無則「無」)

     ## Constraints
     (`<新增 | 調整>` `system.md`「Constraint」的哪一行、為什麼:語言與版本、三道指令、套件與框架、命名與寫法、忽略目錄、號段;無則「無」)

     ## ADRs
     (`<新增 | 調整>` `ADR-00x-<slug>`:一句話。收進這次 PR 的每一條全域 Law 變更、每一份退役的文檔、每一條走不通的切片都各有一條;無則「無」)

     ## 詳細說明 PR 調整
     (為什麼做這些改動、做了哪些決策、每個決策從哪幾個選項裡選的、否決了什麼與為什麼、可不可逆。每條分支一小節:有決策紀錄的抄決策紀錄的「Goal / Scope」「Decisions」與「Verification」原文;沒有決策紀錄的寫動了哪個部分與為什麼、新增的依賴邊、實作層級決定、發現但沒做的事)

     ## 補充
     (擴充區塊,固定先寫這幾條,之後有別的資訊(CI、工具)接在後面)
     - 包含的分支:<分支 → 對到的全名;單一分支寫「單一分支,不需整合」>
     - 合併:順序與理由;解掉的衝突<檔、類型、怎麼解>;移號<GAP-n → GAP-m>;無則「無」
     - 仲裁:<哪兩條 law 互斥、反例、開發者選了什麼、哪條分支被退回>;重複的 step<哪個 step、留了哪一份、哪條分支被退回改成引用>;無則「無」
     - 對應文檔:`.design/features/F-001-checkout.md`;專案沒有 .design/ 寫「無」
     - open GAP:<各附「需要回答什麼」>;無則「無」
     - 注意事項:<決策紀錄「合併時要看」裡合併後仍要盯的事、還留著的「Faked / Unverified」>;無則「無」

     🤖 Generated with [Claude Code](https://claude.com/claude-code)
     ```

   - **Labels**（英文）：立案分支 → `plan`、新的 feature → `feature`、重複的 step 改成引用或文檔退役 → `refactor`、含 REV 或修訂既有文檔 → `revision`、只有驗收測試的 `build/R-n` → `test`、帶 ADR → `adr`；混合就都打上。Label 不存在先 `gh label create <name>`。

## 6. 收尾

回報 PR 網址、標題、內文各章節的重點摘要、包含的分支清單、labels、解掉的衝突、仲裁的結果與被退回的分支、寫了哪幾條 ADR、測試結果；附定錨區塊（`tooling.md`「收尾定錨」），位置樹把本 PR 涵蓋的文檔全部標出，PR 內有變更卻對不到任何文檔的檔案上偏離清單。下一步：PR 合併後 `dev-flow:status`；被退回的分支 `dev-flow:scope-laws <那份文檔的全名>`（在它的工作樹上）；批准了的全域 Law 變更 `dev-flow:global-laws`；重複的 step 沒留下的那一份 `dev-flow:scope-laws <它的全名>`（改成引用）。

## 邊界

不寫實作、不寫測試、不補 law、不改任何 feature 的條文、不改任何本體；不寫 `system.md` 的「全域 Law」區：全域 Law 的新增、修改、放寬、替換、刪除你只提建議，開發者明確批准後由 `dev-flow:global-laws` 落筆；不寫需求檔 (`dev-flow:require-design`)；衝突不猜、互斥不自己裁；帶著紅燈不發 PR；不合沒有決策紀錄、或還沒達成的 `build/` 分支。
