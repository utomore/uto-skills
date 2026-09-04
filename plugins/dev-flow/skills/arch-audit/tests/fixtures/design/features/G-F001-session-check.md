---
id: G-F001
type: feature
title: session-check
description: 跨子系統的工作階段驗證
status: specced
rev: 0
stage: S1
subsystems: [auth, billing]
created: 2026-08-25
updated: 2026-08-25
depends-on: []
related-adr: []
code-paths: []
---
## 契約

- **核心判準**:少了它,S1(帳務)無法達成——billing 的每一個請求都要拿 auth 發的 session 驗證
- **分工**:
  | 子系統 | 負責的段 | 承接的 feature |
  |---|---|---|
  | auth | 發 session、驗 session | auth/F001-login |
  | billing | 每個請求先驗 session | billing/F001-verify |
- **端到端介面**:`G-C001-session#SessionToken`
- **驗收標準**:billing 拿到 auth 發的 token 能驗過;拿到偽造的驗不過
- **明確不做**:session 續期(那是 auth/F002-token-refresh)

## 介面
| 簽名 | 語意 | 骨架位置 |
|---|---|---|
| `verifyAcross :: SessionToken -> IO Bool` | 跨界驗證 | `src/Session/Check.hs#verifyAcross` |

## Laws(行為性質)
- LAW-1: auth 發的 token,billing 驗得過
  - 量詞:對所有 u
  - 定義域:u ∈ User
  - 前提:`login u` 回傳 Right t
  - 觀察點:billing 的 `verifyAcross t` 回傳 True

## Examples
| # | 輸入 | 預期輸出 | 覆蓋的邊界 |
|---|---|---|---|
| EX-1 | 合法 token | True | 正常(LAW-1) |
