---
id: R-1
priority: 1
updated: 2026-09-05
---
# R-1-report-correct:一段文字進來,報表算對

- 驗收:任一段文字的報表字數等於逐字計數

| 里程碑 | 做到什麼 | 綁定 |
|---|---|---|
| M-1-count-tally | 字數算得對 | P-002-count-tally |
| M-2-report-render | 報表印得出來 | P-001-report-render |

| 調整 | 做到什麼 | 動到 |
|---|---|---|
| RF-1 | 切字改成一趟掃描 | P-002-count-tally |
| RF-2 | 報表一秒內印完 | P-001-report-render |
| RF-3 | <一句話:改既有 pipeline 的哪一種品質> | P-00x-<slug> |
