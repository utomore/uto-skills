---
language: rust
updated: 2026-09-07
---
# rs-svc:區間合併

## 願景
任何一組區間都能合併成不重疊的最少區間。

夾具:證明 Rust adapter 的簽名(含 impl 方法與泛型回傳)、pub 匯出、cfg(test) 的排除與內嵌測試歸屬(含需求 Law 的識別字形式)對得上。

## 需求
### R-1:合併出來的區間蓋住原本每一個
- Law:合併之後的寬度不小於任一邊
  - forall a in Span, b in Span
  - |- width(merge(a, b)) >= width(a) and width(merge(a, b)) >= width(b)

## 語言與工具
- 建置:`cargo build`
- 測試(整套):`cargo test`
- 測試(子集):`cargo test span`
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無
- 優先:1 = 合併正確;2 = 進入點;3 = 呈現;4 = 工具

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
| 全名 | 類別 |
|---|---|
| F-001-span | feature |
