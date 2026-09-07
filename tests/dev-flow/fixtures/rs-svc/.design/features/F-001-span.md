---
id: F-001
description: 把一行輸入解析成區間並合併出寬度
status: ready
updated: 2026-09-07
---
# F-001-span:把一行輸入解析成區間並合併出寬度

## Brief
把一行 `start,end` 解析成區間,合併之後回報寬度。
input 是 stdin 的一行,output 是寬度字串。流向:建構 → 合併 → 取寬度。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `make(u32, u32): Result<Span, SpanError>` | 建構區間,顛倒或空的就是錯誤 | `src/core/span.rs` | core |
| 2 | `merge(Span, Span): Span` | 合併兩個區間 | `src/core/span.rs` | core |
| o | `Span.contains(u32): bool` | 觀察:某個點在不在區間內 | `src/core/span.rs` | core |
| = | `width(Span): u32` | 整條:合併之後的寬度 | `src/core/span.rs` | core |
| ! | `run(&str): String` | 進入點:接到 stdin 的一行 | `src/bin/cli.rs` | entry |

## Laws
- LAW-1 [bound] 合併之後的寬度不小於任一邊
  - forall a in Span, b in Span
  - |- width(merge(a, b)) >= width(a)
- LAW-2 [total] 任何一組數字都得到 Result,不 panic
  - forall s in u32, e in u32
  - |- total(make(s, e))

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `width(merge(make(0,5), make(3,9)))` | `9` | LAW-1 |

## 決定
無

## 修訂記錄
無
