---
id: R-3
priority: 1
updated: 2026-09-07
---
# R-3-refund-correct:每一筆退款退回的錢都算對

- 驗收:任一筆請求,退回的錢都等於要退的品項加總減掉手續費的結算金額
  - forall raw in RawBody
  - |- returnedCents(refund(raw)) == cents(settle(refundLines(parseRefund(raw)), refundFee(parseRefund(raw))))

| 里程碑 | 做到什麼 | 綁定 |
|---|---|---|
| M-2-refund | 退款走通 | F-002-refund |
