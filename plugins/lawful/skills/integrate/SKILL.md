---
name: integrate
description: lawful 的整合 — 把幾條 build/<全名> 分支依開發日誌合成一條 integrate/<日期>-<slug> 分支:先清掉已合進主線的 build 分支與工作樹,讀每份日誌定順序與衝突預報,逐條 merge(清單型衝突兩邊都留、同一本體兩邊改就停)、GAP 撞號後合的往上移、整套跑一次、每份日誌宣稱達成的 pipeline 合併後仍要達成、合併後紅只歸因寫 GAP 不改碼,綠了把日誌寫進 PR 內文並刪檔,gh pr create 直接送出(標題英文、內文繁中)。觸發詞:整合、integrate、合併分支、merge build、發 PR、lawful integrate。Use when finished build branches should be merged into one integration branch, verified together, and sent as a pull request.
user-invocable: true
---

# lawful:integrate — 幾條 build 分支合成一條 PR

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/roles.md`「分支與所有權」「開發日誌」「整合」「仲裁」、`rules/pipelines.md`「提問(GAP)」「完成度」、`rules/tooling.md`「CLI」「跑東西的紀律」「收尾定錨」。再讀 `.lawful/system.md` 的「語言與工具」。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 要合的 build 分支(寫全名;沒指定就全部有日誌的) | 一條整合分支、整套綠、PR 一條;日誌內容在 PR 裡 |

## 前置

在主線、工作樹乾淨、`git fetch --all --prune` 過,`gh repo view --json defaultBranchRef` 確認主線名。

## 步驟

0. **清理**:`git branch --merged <主線>` 裡的 `build/*` 分支,連同 `git worktree list` 裡對應的工作樹,`git worktree remove` 後 `git branch -d`。
1. **候選與日誌**:`git branch --list 'build/*'`,每條 `git show <分支>:.lawful/journal/<全名>.md` 讀日誌;沒有日誌的不是候選,回報「還沒收尾」。開發者指定的只合那些。
2. **順序與預報**:`lawful status` 的目標優先與里程碑順序排;被引用的子流排在消費者前。每條 `git diff --name-only <base>..<分支>`(`base` 從日誌抄),兩條以上都動的檔列成預報,對照各日誌「合併時要看」。
3. **開整合分支**:`git switch -c integrate/<YYYY-MM-DD>-<slug>` 從主線。
4. **逐條 merge**:`git merge --no-ff <分支>`。衝突照 `roles.md`「整合」三類處置:清單型與相鄰行兩邊都留;同一個簽名或本體兩邊都改,停下,回報哪條 stage、哪兩條分支。`gaps.md` 撞號,後合的往上移,一條 commit 記「移 GAP-n → GAP-m」。每條合完 commit 就是 merge commit 本身。
5. **整套一次**:建置、`system.md` 的整套指令,輸出留檔;`lawful status --tests <log>`、`lawful lint all`。判準:每份日誌宣稱達成的 pipeline 仍達成、日誌預期的變化如期發生、沒有新的紅與新的警訊。
6. **合併後紅**:歸因不改碼(`roles.md`「整合」):law 屬於哪條 pipeline、它在自己的分支上綠不綠、哪幾條分支與它共用模組;寫成 GAP(角色 conductor)進 `.lawful/gaps.md`,commit,停下回報。候選分支超過一條才從主線另開臨時分支逐條重合、跑那條 pipeline 的子集,找出第一條讓它紅的,臨時分支刪掉。
7. **發 PR**:全綠後把每份日誌的內容寫進 PR 內文,`git rm .lawful/journal/*.md` commit,push,`gh pr create` 直接送出:
   - **標題**:英文 conventional commit 風格加全名,例 `feat: save and load game (P-001-save-game, P-002-load-game)`
   - **內文**:繁體中文,章節固定:

     ```markdown
     ## 摘要
     (兩句話:這批合了哪幾條 pipeline、讓哪個目標的哪條里程碑往前)

     ## 包含的 pipeline
     | 全名 | 分支 | 目標 · 里程碑 | 達成 |
     |---|---|---|---|

     ## 各條做了什麼與決定
     (每條一小節:日誌的「做了什麼」「決定」原文)

     ## 合併
     - 順序:<分支順序與理由>
     - 解掉的衝突:<檔、類型、怎麼解>;無則「無」
     - 移號:<GAP-n → GAP-m>;無則「無」

     ## 測試結果
     (整套指令、綠紅分佈、lawful status 的達成數字)

     ## open GAP
     (各附「需要回答什麼」;無則「無」)

     ## 注意事項
     (日誌「合併時要看」裡合併後仍要盯的事)

     🤖 Generated with [Claude Code](https://claude.com/claude-code)
     ```

   - **Labels**(英文):`build`;含 REV 的加 `revision`。Label 不存在先 `gh label create`。

## 收尾

回報 PR 網址、標題、包含的分支、解掉的衝突、測試結果;附定錨區塊(`tooling.md`「收尾定錨」),位置樹把本 PR 涵蓋的 pipeline 全部標出。下一步:PR 合併後 `lawful:status`;停在 GAP 的話 `lawful:revise`。

## 邊界

不寫實作、不寫測試、不補 law、不改任何 pipeline 檔;衝突不猜;帶著紅燈不發 PR;不合沒有日誌的分支。
