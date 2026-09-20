---
id: R-1
priority: 1
updated: 2026-09-07
---
# R-1-basket-total:任何一籃子都算得出不為負的總金額

- 驗收:任一品項清單的總金額不為負
  - forall items in list
  - |- total_cents(items) >= 0

| 里程碑 | 做到什麼 | 綁定 | 怎麼驗 |
|---|---|---|---|
| M-1-basket | 加品項與算總額走通 | F-001-basket | `python -m cart.demo` |

## 驗收記錄

| 日期 | 誰 | 憑據 | 結論 |
|---|---|---|---|
| 2026-09-07 | dev@example.com | R-1#ACCEPT green,demo 加了三個品項總額與手算相同 | 已驗收 |
