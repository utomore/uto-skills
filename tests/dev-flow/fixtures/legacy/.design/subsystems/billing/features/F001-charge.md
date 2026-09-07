---
id: F001
type: feature
title: charge
description: 對一張訂單收款
status: specced
rev: 0
stage: S2
created: 2026-08-15
updated: 2026-08-15
depends-on: [auth/F001]
code-paths: []
---
# F001: 收款

## 契約
- **核心判準**:少了它,billing 就無法「向使用者收款」
- **驗收標準**:金額非負才收得成

## 介面
| 簽名 | 語意 | 骨架位置 |
|---|---|---|
| `charge(amount: Cents): boolean` | 對一張訂單收款 | `src/billing/charge.ts#charge` |
| `rotate(id: string): string` | 換發收款代碼 | `src/billing/charge.ts#rotate` |

## Laws
- LAW-1: 負金額收不成
  - 量詞:對所有 a
  - 定義域:a ∈ Cents
  - 前提:a < 0
  - 觀察點:charge(a) == false

## Examples
| # | 輸入 | 預期輸出 | 覆蓋的邊界 |
|---|---|---|---|
| EX-1 | `charge(-1)` | `false` | LAW-1 |
