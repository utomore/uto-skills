---
id: P-001
description: 把一段文字的字數寫成報告
status: ready
updated: 2026-09-06
---
# P-001-report-render:把一段文字的字數寫成報告

## Brief
IO 介面。文字 → 數字數 → 報告。數字數引用 P-002-count-tally 的整條。

## Stages
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `count :: Text -> Int` | 數字數 | `App.Count`(見 P-002-count-tally) | core |
| = | `report :: Text -> Text` | 純的整條 | `App.Report` | core |
| ! | `main :: IO ()` | 進入點 | `App.Report.Main` | shell |

## Laws
- LAW-1 [total] 任何文字都有報告
  - forall t in Text
  - |- total (report t)

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `report ""` | `"0 words"` | LAW-1 |

## 決定
無

## 修訂記錄
無
