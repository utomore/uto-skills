---
id: P-002
description: 數一段文字的字數
kind: io
status: verified
updated: 2026-09-06
---
# P-002-count-tally：數一段文字的字數

## Brief
io。文字 → 切字 → 數個數。

## Stages
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `tokens :: Text -> [Token]` | 切字 | `App.Count` | core |
| = | `count :: Text -> Int` | 純的整條 | `App.Count` | core |

## Laws
- LAW-1 [invariant] 字數等於切出來的字的個數
  - forall t in Text
  - |- count t == length (tokens t)

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `count ""` | `0` | LAW-1 |

## 決定
- **重開一次**(2026-09-06)：為了 REV-1 重開，由 build 重新 verified。

## 修訂記錄
- REV-1（2026-09-06，依 RF-1）：切字改成一趟掃描
  - 動到：切字的做法，簽名與 law 不動
  - 保護：LAW-1
  - 重委派：impl
