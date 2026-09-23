---
id: R-1
priority: 1
updated: 2026-09-07
---
# R-1-money-correct：每一筆結帳的金額都算對

- 驗收：任一筆請求，訂單付的錢都等於品項加總減掉折扣的結算金額
  - forall raw in RawBody
  - |- paidCents(checkout(raw)) == cents(settle(reqLines(parseCheckout(raw)), reqDiscount(parseCheckout(raw))))

| 里程碑 | 做到什麼 | 綁定 | 怎麼驗 |
|---|---|---|---|
| M-1-checkout | 結帳走通 | F-001-checkout | `npx ts-node web/demo/checkout.ts` |

## 驗收記錄

| 日期 | 誰 | 憑據 | 結論 |
|---|---|---|---|
| 2026-09-07 | dev@example.com | 驗收測試 green，兩側的 demo 都跑過，金額與手算相同 | 已驗收 |
