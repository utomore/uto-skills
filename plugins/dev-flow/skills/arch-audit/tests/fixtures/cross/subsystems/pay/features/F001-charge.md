---
id: F001
type: feature
title: charge
description: 扣款
status: open
created: 2026-08-10
updated: 2026-08-10
depends-on: []
---
## 數據
| 型別 | 動作 | 定義 | 擁有的知識 |
|---|---|---|---|
| `Money` | 新增 | `{ amount: Int, currency: Text }` | 一筆金額 |
| `ChargeId` | 新增 | `newtype ChargeId = ChargeId Text` | 扣款單號 |
## 介面
| 簽名 | 語意 | 骨架位置 |
|---|---|---|
| `charge :: Money -> IO ChargeId` | 扣一筆款 | `src/Pay/Charge.hs#charge` |
## 依賴
### 依賴方向
- 依賴誰:Ledger
- **新增的依賴邊**:Charge → Ledger;Charge → Notify
## Laws(行為性質)
- LAW-1: charge 成功會產生單號
  - 量詞:對所有 m
  - 定義域:m ∈ Money
  - 前提:無
  - 觀察點:`charge` 回傳一個 ChargeId
