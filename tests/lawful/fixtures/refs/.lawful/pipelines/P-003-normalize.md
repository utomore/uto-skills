---
id: P-003
description: Doc 正規化
status: ready
updated: 2026-09-06
---
# P-003-normalize:Doc 正規化

## Brief
子流。Doc → 正規化 → Doc。shared 與 P-002-parse 同名而沒註明見。

## Stages
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `shared :: Text -> [Token]` | 切 token | `Core.Token` | pure |
| = | `normalize :: Doc -> Doc` | 純的整條 | `Core.Normalize` | pure |

## Laws
- LAW-1 [identity] 正規化冪等
  - forall d in Doc
  - |- normalize (normalize d) == normalize d

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `normalize emptyDoc` | `emptyDoc` | LAW-1 |

## 決定
無

## 修訂記錄
無
