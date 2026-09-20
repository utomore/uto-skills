---
id: R-2
priority: 1
updated: 2026-09-07
---
# R-2-basket-total:任何一籃子都算得出不為負的總金額

- 驗收:任一品項清單的總金額不為負
  - forall items in list
  - |- total_cents(items) >= 0

| 里程碑 | 做到什麼 | 綁定 |
|---|---|---|
| M-3-basket | 加品項與算總額走通 | F-003-basket |
