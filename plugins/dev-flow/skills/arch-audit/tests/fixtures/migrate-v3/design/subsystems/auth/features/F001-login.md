---
id: F001
type: feature
title: login
description: 登入
status: done
created: 2026-07-10
updated: 2026-07-20
stage: S0
modules: []
depends-on: []
related-adr: []
related-feature: []
code-paths: [src/Auth/Login.hs]
---
## 契約

- **階段**:S0
- **負責模組**:Session
- **實作的 Level 2 介面**:對外契約 §1 login
- **資料流管線段落**:輸入 → 驗證 → 輸出
- **驗收標準**:登入成功回傳 token — 觀察點:對外契約 §1 login
- **明確不做**:二次驗證

## 介面
| 簽名 | 語意 | 骨架位置 |
|---|---|---|
| `login :: A -> B` | 登入 | `src/Auth/Login.hs#login` |
## Laws(行為性質)
- LAW-1: 登入成功後 session 存在
  - 量詞:對所有 u
  - 定義域:u ∈ User
  - 前提:`login u` 成功
  - 觀察點:`login u` 回傳 Right
## Examples
| # | 輸入 | 預期輸出 | 覆蓋的邊界 |
|---|---|---|---|
| EX-1 | a | b | 正常 |
## 待確認假設
- ASM-1: session 存哪
  - 現況原文:`login :: A -> B`
  - 暫採:記憶體
  - 裁決:接受 a(WAVE-1 閘門 2026-07-18);已回寫 design.md
