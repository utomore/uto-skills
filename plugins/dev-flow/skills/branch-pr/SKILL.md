---
name: branch-pr
description: 整合多條 branch 並發 PR 到主 branch — 建整合分支、依序 merge、跑測試、gh pr create 直接送出(標題英文、內文繁中)並打上對應 labels,不需使用者確認內容,發完回報 PR 大綱與說明。觸發詞:發 PR、整合分支、merge branch、pull request、整合開發分支。Use when integrating feature branches and creating a pull request.
user-invocable: true
---

# /branch-pr — 整合 branch 發 PR

先讀取 `../_shared/conventions.md`(核心慣例)。本 skill 不動 `.design/` 文檔,不需要另外兩片分片。

## 1. 盤點

1. `git fetch --all --prune`;用 `gh repo view --json defaultBranchRef` 確認主 branch
2. 列出候選 branch(`git branch -a --no-merged <主branch>`)與各自對應的文檔 id(從 branch 名或 commit 訊息推斷;引用格式如 `auth/F001`、`G-E001`)
3. 若使用者已指明要整合的 branch,或候選只有一條、順序無疑義,直接進行;僅在多條候選且無法從文檔或 branch 名推斷取捨時,才用 AskUserQuestion 詢問要整合哪些 branch 與順序

## 2. 整合

1. 從主 branch 開整合分支:`integrate/<YYYY-MM-DD>-<slug>`(單一 branch 直接發 PR 時可跳過,直接用該 branch)
2. 依確認的順序逐條 merge:
   - 無衝突 → 繼續
   - 簡單衝突(格式、相鄰行)→ 處理後向開發者說明怎麼解的
   - 實質衝突(邏輯互斥)→ 停下,呈現兩邊差異,詢問開發者
3. 整合完成後執行專案的測試 / build,**如實回報結果**;失敗則停下回報,不得帶著紅燈發 PR

## 3. 發 PR

1. Push 整合分支
2. 測試 / build 全綠後,組好 PR 內容**直接 `gh pr create` 送出,不需先向開發者確認**(發完後在收尾階段回報大綱與說明):
   - **標題**:英文 conventional commit 風格 + 對應文檔 id
     例:`feat: add user authentication (auth/F001)`、`fix: login timeout (auth/B002)`、`perf: incremental file scan (G-E001)`
   - **內文**:繁體中文,固定章節:

     ```markdown
     ## 摘要

     ## 變更內容
     (依 branch / 文檔分組列點)

     ## 對應文檔
     - .design/subsystems/auth/features/F001-user-authentication.md
     - .design/subsystems/auth/bugfixes/B002-login-timeout.md

     ## 測試結果
     (實際執行的指令與結果)

     ## 注意事項

     🤖 Generated with [Claude Code](https://claude.com/claude-code)
     ```

   - **Labels**(英文):依整合內容的文檔 type 對應 — feature → `feature`、bugfix → `bugfix`、enhance → `enhancement`;多種混合就都打上。Label 不存在時先 `gh label create <name>` 再套用

## 4. 收尾

- 向使用者回報 PR 的大綱與說明:PR 網址、標題、內文各章節的重點摘要(摘要 / 變更內容 / 對應文檔 / 測試結果 / 注意事項)、包含的 branch 清單、labels
- 提醒:PR merge 後可執行 `/arch-audit status` 確認對應文檔狀態是否已標 done
