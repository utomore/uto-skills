---
name: integrate
description: dev-flow 的整合 — 把分支合成一條整合分支、驗過再發 PR,是唯一發 PR 的出口。先確認當前分支(在主 branch 上有變更就先開新分支把它帶走,禁止從主 branch 直接發 PR)、清掉已合進主線的 build 分支與工作樹、盤點候選(build/<全名> 分支讀它的開發日誌定順序與衝突預報,其餘分支對到文檔全名)、逐條 merge(清單型衝突兩邊都留、同一本體兩邊改就停)、GAP 撞號後合的往上移、跑建置與整套一次、合併後紅只歸因寫 GAP 不改碼,綠了把日誌寫進 PR 內文並刪檔,gh pr create 直接送出(標題英文、內文繁中)並打上 labels,不需使用者確認內容。觸發詞:發 PR、pull request、整合、integrate、整合分支、合併分支、merge branch、合 build 分支、dev-flow integrate。Use when finished branches should be merged, verified together, and sent as a pull request.
user-invocable: true
---

# dev-flow:integrate — 分支合成一條 PR

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/roles.md`「分支與所有權」「開發日誌」「整合」「仲裁」、`rules/features.md`「提問(GAP)」「完成度」、`rules/tooling.md`「CLI」「跑東西的紀律」「收尾定錨」。再讀 `.design/system.md` 的「語言與工具」。專案沒有 `.design/` 的話規章都不必讀,照 git 與 PR 的部分做完即可。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 要合的分支(寫全名或分支名;沒指定就全部沒合進主線的) | 一條整合分支、建置與整套綠、PR 一條;日誌內容在 PR 裡 |

## 0. 確認當前分支(必做,不得跳過)

1. `git fetch --all --prune`;`gh repo view --json defaultBranchRef` 確認主線名,`git branch --show-current` 取得當前分支。
2. 當前分支不是主線 → 進 §1,它自己也是候選。
3. 當前分支是主線:**禁止從主線發 PR**。`git status --porcelain` 與 `git log origin/<主線>..HEAD --oneline` 盤點未提交的變更與領先 origin 的本地 commit。
   - 兩者都空 → 主線乾淨,進 §1 收別的分支。
   - 有東西 → 先開新分支把它帶走:從變更內容推斷是哪一份文檔與哪個 type,`git switch -c <type>/<slug>`(如 `feat/F-001-checkout`、`fix/F-002-refund`、`refactor/A-001-settle`);推斷不出來才用 AskUserQuestion 問分支名。未提交變更與領先的 commit 都跟著過去;接著 `git branch -f <主線> origin/<主線>` 把本地主線還原,避免主線留著沒發 PR 的 commit。未提交的變更在新分支上 commit(conventional commit 風格,訊息帶**文檔全名**)。這條新分支進 §1。
   - 主線乾淨,又沒有任何候選分支 → 沒有東西可發,回報後停止。

## 1. 清理與盤點

1. **清理**:`git branch --merged <主線>` 裡的 `build/*` 分支,連同 `git worktree list` 裡對應的工作樹,`git worktree remove` 後 `git branch -d`。
2. **候選**:`git branch -a --no-merged <主線>`;開發者指定就只收那些。每條標出它是哪一種:
   - **建構分支** `build/<全名>`:`git show <分支>:.design/journal/<全名>.md` 讀日誌。讀不到代表還沒收尾,不收,回報。
   - **其餘分支**:從分支名或 commit 訊息推出對應的**文檔全名**(寫 `F-001-checkout`、`A-001-settle`,不要只寫 `F-001`——PR 描述會被沒讀過這份文檔的人讀到);對不到文檔就寫分支名。
3. **順序**:有日誌的照 `devflow status` 的目標優先與里程碑順序排,被引用的 abstract 排在消費者之前;其餘照開發者指定的順序,沒指定且推不出取捨才用 AskUserQuestion 問。
4. **預報**:每條 `git diff --name-only <base>..<分支>`(有日誌的 `base` 從日誌抄,其餘用 `git merge-base`),兩條以上都動到的檔列成預報,對照各日誌的「合併時要看」。

## 2. 整合

1. 候選只有一條 → 直接用它,跳到 §3。
2. 從主線開整合分支:`git switch -c integrate/<YYYY-MM-DD>-<slug>`。
3. 依 §1 的順序逐條 `git merge --no-ff <分支>`。衝突照 `roles.md`「整合」三類處置:清單型(建置設定的檔案清單、匯出清單、`gaps.md`)與相鄰行的加法兩邊都留;同一個簽名或本體兩邊都改,停下,回報哪條 step、哪兩條分支,不猜。`gaps.md` 撞號,後合的往上移,一條 commit 記「移 GAP-n → GAP-m」。每條合完的 commit 就是 merge commit 本身。

## 3. 驗收

1. 跑建置與整套測試(有 `.design/` 就是 `system.md`「語言與工具」的那兩道),輸出留檔;有 `.design/` 再跑 `devflow status --tests <log>` 與 `devflow lint all`。
2. 判準:每份日誌宣稱達成的文檔合併後仍達成;日誌「合併時要看」預期的變化如期發生;沒有新的紅、沒有新的警訊。**帶著紅燈不發 PR。**
3. **合併後紅**:歸因不改碼(`roles.md`「整合」):那條 law 屬於哪份文檔、它在自己的分支上綠不綠(看日誌的「測試」)、哪幾條分支與它共用檔案(看日誌的「合併時要看」)。寫成 GAP(角色 conductor)進 `.design/gaps.md`,commit,停下回報。候選超過一條才從主線另開臨時分支逐條重合、跑那份文檔的子集,找出第一條讓它紅的,臨時分支刪掉。

## 4. 發 PR

1. 再次確認 `git branch --show-current` 不是主線,push 要發 PR 的分支。
2. 有日誌就把每份日誌的內容寫進 PR 內文,`git rm .design/journal/*.md` commit。
3. 組好內容**直接 `gh pr create` 送出,不需先向開發者確認**(發完在 §5 回報大綱):
   - **標題**:英文 conventional commit 風格加全名,例 `feat: checkout and refund (F-001-checkout, F-002-refund)`、`refactor: lift money settlement (A-001-settle)`
   - **內文**:繁體中文,章節固定:

     ```markdown
     ## 摘要
     (兩句話:這批合了什麼、讓哪個目標的哪條里程碑往前;沒有 .design/ 的專案寫改了系統的哪個部分、為什麼)

     ## 包含什麼
     | 全名 | 類別 | 分支 | 目標 · 里程碑 | 達成 |
     |---|---|---|---|---|
     (對不到文檔的分支:全名欄寫分支名,其餘欄寫「-」)

     ## 做了什麼與決定
     (每條分支一小節。有日誌的抄日誌的「做了什麼」「決定」原文;沒有日誌的寫:動了哪個部分與為什麼、新增的依賴邊、實作層級決定、發現但沒做的事)

     ## 合併
     - 順序:<分支順序與理由>;單一分支寫「單一分支,不需整合」
     - 解掉的衝突:<檔、類型、怎麼解>;無則「無」
     - 移號:<GAP-n → GAP-m>;無則「無」

     ## 對應文檔
     - `.design/features/F-001-checkout.md`;專案沒有 .design/ 寫「無」

     ## 測試結果
     (實際跑的指令與結果;有 .design/ 時附 devflow status 的達成數字)

     ## open GAP
     (各附「需要回答什麼」;無則「無」)

     ## 注意事項
     (日誌「合併時要看」裡合併後仍要盯的事;無則「無」)

     🤖 Generated with [Claude Code](https://claude.com/claude-code)
     ```

   - **Labels**(英文):新的 feature → `feature`、abstract 收整 → `refactor`、含 REV 或修訂既有文檔 → `revision`;混合就都打上。Label 不存在先 `gh label create <name>`。

## 5. 收尾

回報 PR 網址、標題、內文各章節的重點摘要、包含的分支清單、labels、解掉的衝突、測試結果;附定錨區塊(`tooling.md`「收尾定錨」),位置樹把本 PR 涵蓋的文檔全部標出,PR 內有變更卻對不到任何文檔的檔案上偏離清單。下一步:PR 合併後 `dev-flow:status`;停在 GAP 的話 `dev-flow:revise`。

## 邊界

不寫實作、不寫測試、不補 law、不改任何 feature 與 abstract 檔;衝突不猜;帶著紅燈不發 PR;不合沒有日誌的 `build/` 分支。
