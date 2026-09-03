---
id: E001
type: enhancement
title: money
description: 金額改用定點數
status: planned
created: 2026-08-12
updated: 2026-08-12
depends-on: []
---
## 數據與介面變動
| 項目 | 動作 | 簽名 / 定義 | 語意(做什麼) | 受影響呼叫端 | 骨架位置 |
|---|---|---|---|---|---|
| `Money` | 修改 | `{ amount: Fixed E2, currency: Text }` | 一筆金額 | `charge` | `src/Pay/Money.hs#Money` |
## 相依性
### 依賴方向
- **新增的依賴邊**:無
