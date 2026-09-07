---
id: E001
type: enhance
title: remember-device
description: 記住裝置 30 天內免二次驗證
status: planned
rev: 0
created: 2026-08-05
updated: 2026-08-05
depends-on: [auth/F001]
code-paths: []
---
# E001: 記住裝置

## 契約
- **非核心判準**:少了它,auth 照樣完成登入
- **驗收標準**:同一裝置 30 天內不再要求二次驗證

## 介面
| 簽名 | 語意 | 骨架位置 |
|---|---|---|
| `verify(id: TokenId): boolean` | 回報可不可用 | `src/auth/token.ts#verify` |

## Laws
- LAW-1: 記住的裝置在 30 天內不再要求驗證
  - 量詞:對所有 d
  - 定義域:d ∈ DeviceId
  - 前提:無
  - 觀察點:講不清楚,要看實作
