---
id: R-1
priority: 1
updated: 2026-09-07
---
# R-1-span-merge:合併出來的區間蓋住原本每一個

- 驗收:合併之後的寬度不小於任一邊
  - forall a in Span, b in Span
  - |- width(merge(a, b)) >= width(a) and width(merge(a, b)) >= width(b)

| 里程碑 | 做到什麼 | 綁定 |
|---|---|---|
| M-1-span | 建區間與合併走通 | F-001-span |
