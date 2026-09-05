---
id: F001
type: feature
title: drift
description: 三種骨架漂移
status: open
created: 2026-08-10
updated: 2026-08-10
depends-on: []
---
## 介面
| 簽名 | 語意 | 骨架位置 |
|---|---|---|
| `keep :: Int -> Int` | 留著 | `src/Thing.hs#keep` |
| `gone :: Int -> Int` | 符號被改名了 | `src/Thing.hs#gone` |
| `other :: Int -> Int` | 簽名與骨架符號不同名 | `src/Thing.hs#keep` |
| `far :: Int -> Int` | 檔案不存在 | `src/Missing.hs#far` |
## Laws(行為性質)
- LAW-1: keep 是恆等
  - 量詞:對所有 n
  - 定義域:n ∈ Int
  - 前提:無
  - 觀察點:`keep` 回傳 n
