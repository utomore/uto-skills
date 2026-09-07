---
id: A-002
description: 只有一份 feature 用的抽象,收整沒有成立
status: draft
updated: 2026-09-07
---
# A-002-single:只有一份 feature 用的抽象,收整沒有成立

## Brief
夾具用:只有 F-002-other 引用它,status 該報「搬回去」。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| = | `weigh(Rule): number` | 整條 | `src/domain/rule.ts` | domain |

## Laws
- LAW-1 [bound] 權重不為負
  - forall r in Rule
  - |- weigh(r) >= 0

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `weigh(Rule)` | `1` | LAW-1 |

## 決定
無

## 修訂記錄
無
