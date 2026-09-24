---
language: rust
updated: 2026-09-07
---
# rs-svc：區間合併

## 願景
任何一組區間都能合併成不重疊的最少區間。

夾具：證明 Rust adapter 的簽名（含 impl 方法與泛型回傳）、pub 匯出、cfg(test) 的排除與內嵌測試歸屬（含需求驗收測試歸屬的識別字形式）對得上。

## 全域 Law
不得違反：整個專案任何一條切片、任何一份 feature 都要守。三類各住一區，各有一道 lint 自動確認（`devflow lint global` 一次查完）；新增、修改、放寬、替換或刪除都要開發者明確批准。

### 領域不變量
無

### 架構：層
| 層 | 裝什麼 |
|---|---|
| core | 區間的型別與規則 |
| entry | CLI 進入點 |

### 契約：對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 |
|---|---|---|---|---|---|---|
| stdin 一行 | in | `Span` | `src/bin/cli.rs` | F-001-span | untrusted | `make` |
| 區間寬度 | out | `u32` | `src/bin/cli.rs` | F-001-span | trusted | - |

## Constraint
- 建置：`cargo build`
- 測試（整套）：`cargo test`
- 測試（子集）：`cargo test span`
- IO 模組追加：無
- Laws 詞彙追加：無
- 忽略目錄：無

## Features
| 全名 | 類別 |
|---|---|
| F-001-span | feature |
