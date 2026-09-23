---
id: R-1
priority: 1
updated: 2026-09-07
---
# R-1-span-merge：合併出來的區間蓋住原本每一個

- 驗收：合併之後的寬度不小於任一邊
  - forall a in Span, b in Span
  - |- width(merge(a, b)) >= width(a) and width(merge(a, b)) >= width(b)

| 里程碑 | 做到什麼 | 綁定 | 怎麼驗 |
|---|---|---|---|
| M-1-span | 建區間與合併走通 | F-001-span | `cargo run --example demo` |

## 驗收記錄

| 日期 | 誰 | 憑據 | 結論 |
|---|---|---|---|
| 2026-09-07 | dev@example.com | R-1#ACCEPT green，demo 合併相鄰區間的結果正確 | 已驗收 |
