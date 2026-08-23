# `build-log.md` 版面模板

路徑 `.design/subsystems/<slug>/build-log.md`,frontmatter 規格見 `_shared/frontmatter.md`。
建檔或更新時照這份抄;六個章節都要有,沒內容的先留標題與表頭。

```markdown
---
id: <subsystem-slug>-build
type: build-log
title: <subsystem-slug>-build
description: <一句話,40 字內:這次委派展開了什麼>
status: in-progress
created: <today>
updated: <today>
parent: <subsystem-slug>
---

# <子系統名稱> 委派展開紀錄

## 排程
(階段 → 波次 → features;跨子系統依賴的處理決定)

| 階段 | 波次 | features | 狀態 |
|---|---|---|---|
| 階段一 | W1 | a, b | done |
| 階段一 | W2 | c | in-progress |

## 委派決策記錄
(批次澄清中「執行取向類」與「測試框架類」的問答結論;契約類的已回寫 design.md,這裡不重複)

| # | 問題 | 開發者決定 | 影響範圍 |
|---|------|-----------|---------|
| D1 | <問題> | <決定> | <哪些 feature> |

## 配號表
(fan out 前預先分配,平行執行不得自行配號或自選骨架路徑)

| feature | id | 檔名 | 骨架檔案 | spec 模型 | qa 模型 | impl 模型 | 狀態 |
|---|---|---|---|---|---|---|---|
| <feature-slug> | F001 | F001-<slug>.md | src/A.hs | opus | sonnet | sonnet | spec-done / qa-done / impl-done |

兩個欄位是防撞用的:**骨架檔案**同一波內不得重疊(平行的 spec subagent 會同時寫),**模型欄**固定 spec `opus`、qa 與 impl `sonnet`,所以品質有問題時歸因得回 spec 寫得夠不夠,不會混進模型差異。

## 待確認假設彙總
(各 spec 文檔「待確認假設」段落的彙總,含開發者在閘門的裁決)

| 來源 | 假設 | 採取的判斷 | 閘門裁決 |
|---|---|---|---|
| F001 A1 | <...> | <...> | 接受 / 要改 |

## 仲裁紀錄
(每一輪紅燈的裁決;這張表是事後判斷「spec 哪裡寫不清楚」的唯一資料。同一 feature 上限 3 輪)

| feature | 輪次 | 失敗的測試 | 對應的 spec 條文 | 歸因 | 處置 |
|---|---|---|---|---|---|
| F001 | 1 | prop_rotate_idempotent | L1 | impl 錯 | 附 L1 原文重派 impl |
| F001 | 2 | test_refresh_expired | 對應不上 | **spec bug** | 停下,回報開發者 |

## 階段結果
### 階段一
(完成的 features、介面實作數、測試結果、未結的 spec-gaps、arch-audit 發現、閘門結論、契約有無變更)
```
