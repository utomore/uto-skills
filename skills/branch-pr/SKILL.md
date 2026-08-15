---
name: branch-pr
description: 整合多條 branch 並發 PR 到主 branch — 建整合分支、依序 merge、跑測試、gh pr create(標題英文、內文繁中)並打上對應 labels。觸發詞:發 PR、整合分支、merge branch、pull request、整合開發分支。Use when integrating feature branches and creating a pull request.
user-invocable: true
---

# /branch-pr — 整合 branch 發 PR

先讀取 `../_shared/conventions.md`,遵守其中所有文檔慣例。

## 1. 盤點

1. `git fetch --all --prune`;用 `gh repo view --json defaultBranchRef` 確認主 branch
2. 列出候選 branch(`git branch -a --no-merged <主branch>`)與各自對應的文檔 id(從 branch 名或 commit 訊息推斷)
3. 用 AskUserQuestion 讓開發者確認:要整合哪些 branch、merge 順序、PR 目標 branch

## 2. 整合

1. 從主 branch 開整合分支:`integrate/<YYYY-MM-DD>-<slug>`(單一 branch 直接發 PR 時可跳過,直接用該 branch)
2. 依確認的順序逐條 merge:
   - 無衝突 → 繼續
   - 簡單衝突(格式、相鄰行)→ 處理後向開發者說明怎麼解的
   - 實質衝突(邏輯互斥)→ 停下,呈現兩邊差異,詢問開發者
3. 整合完成後執行專案的測試 / build,**如實回報結果**;失敗則停下詢問,不得帶著紅燈發 PR

## 3. 發 PR

1. Push 整合分支
2. 組 PR 內容並**先給開發者確認**(標題 / 內文 / labels),確認後才 `gh pr create`:
   - **標題**:英文 conventional commit 風格 + 對應文檔 id
     例:`feat: add user authentication (func-0003)`、`fix: login timeout (bug-0007)`
   - **內文**:繁體中文,固定章節:

     ```markdown
     ## 摘要

     ## 變更內容
     (依 branch / 文檔分組列點)

     ## 對應文檔
     - docs/spec/func-0003-user-authentication.md
     - docs/bugfix/bug-0007-login-timeout.md

     ## 測試結果
     (實際執行的指令與結果)

     ## 注意事項

     🤖 Generated with [Claude Code](https://claude.com/claude-code)
     ```

   - **Labels**(英文):依整合內容的文檔 type 對應 — spec → `feature`、bug → `bugfix`、enhance → `enhancement`;多種混合就都打上。Label 不存在時先 `gh label create <name>` 再套用

## 4. 收尾

- 回報 PR 網址、包含的 branch 清單、labels
- 提醒:PR merge 後可執行 `/code-audit status` 確認對應文檔狀態是否已標 done
