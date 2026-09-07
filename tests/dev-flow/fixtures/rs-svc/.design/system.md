---
language: rust
updated: 2026-09-07
---
# rs-svc:區間合併

## 目的
夾具:證明 Rust adapter 的簽名(含 impl 方法與泛型回傳)、pub 匯出、cfg(test) 的排除與內嵌測試歸屬對得上。

## 語言與工具
- 建置:`cargo build`
- 測試(整套):`cargo test`
- 測試(子集):`cargo test span`
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無

## 層
| 層 | 裝什麼 |
|---|---|
| core | 區間的型別與規則 |
| entry | CLI 進入點 |

## 對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 |
|---|---|---|---|---|---|---|
| stdin 一行 | in | `Span` | `src/bin/cli.rs` | F-001-span | untrusted | `make` |
| 區間寬度 | out | `u32` | `src/bin/cli.rs` | F-001-span | trusted | - |

## Features
| 全名 | 類別 | 階段 |
|---|---|---|
| F-001-span | feature | S1 |
