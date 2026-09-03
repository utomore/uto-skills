---
id: F002
type: feature
title: token-refresh
description: 登入
status: in-progress
created: 2026-08-10
updated: 2026-08-20
depends-on: []
related-adr: [ADR-001]
related-feature: []
code-paths: [src/Auth/Login.hs]
---
## 介面
| 簽名 | 語意 | 骨架位置 |
|---|---|---|
| `token-refresh :: A -> B` | 登入 | `src/Auth/Login.hs#token-refresh` |
## Laws(行為性質)
- LAW-1: 登入成功後 session 存在
  - 量詞:對所有 u
  - 定義域:u ∈ User
  - 前提:`token-refresh u` 成功
  - 觀察點:`token-refresh u` 回傳 Right
- LAW-2: 失敗不建 session
  - 量詞:對所有 u
  - 定義域:u ∈ User
  - 前提:`token-refresh u` 失敗
  - 觀察點:`token-refresh u` 回傳 Left
## Examples
| # | 輸入 | 預期輸出 | 覆蓋的邊界 |
|---|---|---|---|
| EX-1 | a | b | 正常 |
| EX-2 | c | d | 例外 |
## 待確認假設
- ASM-1: 要決定 session 存哪
