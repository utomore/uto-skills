# `build-log.md` 版面模板

路徑 `.design/subsystems/<slug>/build-log.md`,frontmatter 規格見 `_shared/frontmatter.md`。
建檔或更新時照這份抄;五個章節都要有,沒內容的先留標題與表頭。

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
(批次澄清中「執行取向類」的問答結論;契約類的已回寫 design.md,這裡不重複)

| # | 問題 | 開發者決定 | 影響範圍 |
|---|------|-----------|---------|
| D1 | <問題> | <決定> | <哪些 feature> |

## 配號表
(fan out 前預先分配,平行執行不得自行配號;模型欄填實際用的,繼承就寫「繼承」)

| feature | id | 檔名 | 設計模型 | 實作模型 | 狀態 |
|---|---|---|---|---|---|
| <feature-slug> | F001 | F001-<slug>.md | 繼承 | sonnet | design-done / impl-done |

模型欄是閘門的診斷依據:品質有問題時,能區分是契約卡寫得不夠,還是模型降級造成的。

## 待確認假設彙總
(各 feature 文檔「待確認假設」段落的彙總,含開發者在閘門的裁決)

| 來源 | 假設 | 採取的判斷 | 閘門裁決 |
|---|---|---|---|
| F001 A1 | <...> | <...> | 接受 / 要改 |

## 階段結果
### 階段一
(完成的 features、測試結果、arch-audit 發現、閘門結論、契約有無變更)
```
