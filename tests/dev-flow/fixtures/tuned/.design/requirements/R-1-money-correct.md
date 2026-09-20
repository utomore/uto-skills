---
id: R-1
priority: 1
updated: 2026-09-07
---
# R-1-money-correct:每一筆結帳與退款的金額都算對

- 驗收:任一筆請求,訂單付的錢與退回的錢都等於品項加總減掉折扣或手續費的結算金額
  - forall raw in RawBody
  - |- paidCents(checkout(raw)) == cents(settle(reqLines(parseCheckout(raw)), reqDiscount(parseCheckout(raw)))) and returnedCents(refund(raw)) == cents(settle(refundLines(parseRefund(raw)), refundFee(parseRefund(raw))))

| 里程碑 | 做到什麼 | 綁定 |
|---|---|---|
| M-1-checkout | 結帳走通 | F-001-checkout |
| M-2-refund | 退款走通 | F-002-refund |

| 調整 | 做到什麼 | 動到 |
|---|---|---|
| RF-1 | 手續費大過要退的金額也結得出來 | F-001-checkout |
| RF-2 | 退款一秒內完成 | F-002-refund |
