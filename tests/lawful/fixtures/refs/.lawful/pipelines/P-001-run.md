---
id: P-001
description: 讀一段文字,解析後正規化
status: ready
updated: 2026-09-06
---
# P-001-run:讀一段文字,解析後正規化

## Brief
里程碑。文字 → 解析 → 正規化 → 輸出。引用 P-002-parse 的整條。

## Stages
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `parse :: Text -> Either ParseError Doc` | 解析 | `Core.Parse`(見 P-002-parse) | pure |
| = | `run :: Text -> Either ParseError Doc` | 純的整條 | `Core.Run` | pure |
| ! | `main :: IO ()` | 進入點 | `Host.Main` | shell |

## Laws
- LAW-1 [total] 任何文字都有結果
  - forall t in Text
  - |- total (run t)

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `run ""` | `Left EmptyInput` | LAW-1 |

## 決定
無

## 修訂記錄
無
