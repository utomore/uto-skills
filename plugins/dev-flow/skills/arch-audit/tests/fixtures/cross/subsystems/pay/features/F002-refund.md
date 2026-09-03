---
id: F002
type: feature
title: refund
description: 退款
status: open
created: 2026-08-10
updated: 2026-08-10
depends-on: []
---
## 數據
| 型別 | 動作 | 定義 | 擁有的知識 |
|---|---|---|---|
| `Money` | 新增 | `{ amount: Decimal, currency: Text }` | 一筆金額 |
| `ChargeId` | 新增 | `newtype ChargeId = ChargeId Text` | 扣款單號 |
## 介面
| 簽名 | 語意 | 骨架位置 |
|---|---|---|
| `refund :: ChargeId -> IO ()` | 退一筆款 | `src/Pay/Refund.hs#refund` |
## 依賴
### 依賴方向
- **新增的依賴邊**:無
## Laws(行為性質)
- LAW-1: refund 對同一單號冪等
  - 量詞:對所有 c
  - 定義域:c ∈ ChargeId
  - 前提:無
  - 觀察點:`refund` 呼叫兩次與一次結果相同
