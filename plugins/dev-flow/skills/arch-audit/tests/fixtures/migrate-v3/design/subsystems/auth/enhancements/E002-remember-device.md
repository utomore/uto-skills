---
id: E002
type: enhance
title: remember-device
description: 記住裝置,30 天內免二次驗證
status: specced
created: 2026-08-05
updated: 2026-08-05
depends-on: [auth/F001]
related-adr: []
related-feature: []
code-paths: []
---

# E002: remember-device

## 數據與介面變動
| 項目 | 動作 | 簽名 / 定義 | 語意(做什麼) | 受影響呼叫端 | 骨架位置 |
|---|---|---|---|---|---|
| `remember` | 新增 | `remember :: Device -> IO ()` | 記住裝置 | - | `src/Auth/Device.hs#remember` |

## Laws(行為性質)
- LAW-1: 記住的裝置 30 天內免二次驗證
  - 量詞:對所有 d
  - 定義域:d ∈ Device
  - 前提:`remember d` 成功且未滿 30 天
  - 觀察點:`remember d` 之後同裝置登入不觸發二次驗證

## Examples
| # | 輸入 | 預期輸出 | 覆蓋的邊界 |
|---|---|---|---|
| EX-1 | d | 免驗 | 正常 |
