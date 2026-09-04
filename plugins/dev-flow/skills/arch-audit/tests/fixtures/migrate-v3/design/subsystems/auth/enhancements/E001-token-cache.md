---
id: E001
type: enhance
title: token-cache
description: 將 token 驗證改為快取以縮短延遲
status: specced
created: 2026-08-01
updated: 2026-08-01
depends-on: [auth/F001]
related-adr: []
related-feature: [auth/F001]
code-paths: []
---

# E001: token-cache

## 現況分析
login 每次都重算雜湊(src/Auth/Login.hs)。

## Scope(涵蓋範圍)
只動 auth 的 Session 模組。

## 改善目標
p95 從 400ms 壓到 80ms。

## 數據與介面變動
| 項目 | 動作 | 簽名 / 定義 | 語意(做什麼) | 受影響呼叫端 | 骨架位置 |
|---|---|---|---|---|---|
| `login` | 修改 | `login :: A -> IO B` | 登入(快取) | - | `src/Auth/Login.hs#login` |

## Laws(行為性質)
- REG-1: 優化前後 login 結果相同
  - 量詞:對所有 u
  - 定義域:u ∈ User
  - 前提:無
  - 觀察點:`login u` 的回傳值與基準線相同
- LAW-1: 第二次 login 不重算雜湊
  - 量詞:對所有 u
  - 定義域:u ∈ User
  - 前提:先前已成功呼叫過 `login u`
  - 觀察點:第二次 `login u` 期間雜湊函式呼叫次數為 0

## Examples
| # | 輸入 | 預期輸出 | 覆蓋的邊界 |
|---|---|---|---|
| EX-1 | u | = 現況 | 正常 |
