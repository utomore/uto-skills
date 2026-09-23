---
id: R-2
priority: 1
updated: 2026-09-07
---
# R-2-basket-total：任何一籃子都算得出不為負的總金額

- 驗收：任一品項清單的總金額不為負
  - forall items in list
  - |- total_cents(items) >= 0

| 里程碑 | 做到什麼 | 綁定 | 怎麼驗 |
|---|---|---|---|
| M-3-basket | 加品項與算總額走通 | F-003-basket | `python -m api.cart.demo` |

## 驗收記錄

| 日期 | 誰 | 憑據 | 結論 |
|---|---|---|---|
| 2026-09-07 | dev@example.com | 驗收測試 green，兩側的 demo 都跑過，金額與手算相同 | 已驗收 |
