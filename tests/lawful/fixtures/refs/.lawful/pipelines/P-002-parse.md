---
id: P-002
description: 文字解析成 Doc
status: ready
updated: 2026-09-06
---
# P-002-parse:文字解析成 Doc

## Brief
子流。文字 → 切 token → Doc。shared 是它與 P-003-normalize 共用的步驟,兩邊都沒註明見。

## Stages
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `shared :: Text -> [Token]` | 切 token | `Core.Token` | pure |
| = | `parse :: Text -> Either ParseError Doc` | 純的整條 | `Core.Parse` | pure |

## Laws
- LAW-1 [total] 任何文字都解得出結果或錯誤
  - forall t in Text
  - |- total (parse t)

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `parse ""` | `Left EmptyInput` | LAW-1 |

## 決定
無

## 修訂記錄
無
