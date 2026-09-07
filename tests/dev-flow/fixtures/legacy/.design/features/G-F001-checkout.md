---
id: G-F001
type: feature
title: checkout
description: 使用者把購物車結成一張已付款的訂單
status: planned
rev: 0
stage: S2
subsystems: [auth, billing]
created: 2026-08-16
updated: 2026-08-16
---
# G-F001: 結帳

## 契約
- **核心判準**:少了它,S2 無法達成
- **驗收標準**:端到端從購物車走到已付款

## 介面
| 簽名 | 語意 | 骨架位置 |
|---|---|---|
| `charge(amount: Cents): boolean` | 收款那一段 | `src/billing/charge.ts#charge` |
