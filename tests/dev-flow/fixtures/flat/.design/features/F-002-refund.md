---
id: F-002
description: 客服把一張訂單的部分品項退款給使用者
status: frozen
updated: 2026-09-07
---
# F-002-refund:客服把一張訂單的部分品項退款給使用者

## Brief
把一段請求文字解析成要退的品項,扣掉手續費,得到退款金額。
input 是 POST /refund 的 RawBody,output 是 HttpRes。
流向:解析 → 結算 → 產生退款。從對外 I/O 表的「POST /refund」進來,從「退款結果」出去。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `parseRefund(RawBody): RefundReq` | 解析並夾住請求裡的數字,不信任任何一段 | `src/app/refund.ts` | application |
| 2 | `settle(MoneyList, Money): Settlement` | 扣掉手續費之後的退款金額 | `src/domain/money.ts`(見 A-001-settle) | domain |
| 3 | `toRefund(RefundReq, Settlement): RefundResult` | 結算成功就產生退款,失敗就帶回理由 | `src/app/refund.ts` | application |
| o | `refundLines(RefundReq): MoneyList` | 觀察:這次要退哪些品項 | `src/app/refund.ts` | application |
| o | `refundFee(RefundReq): Money` | 觀察:這次的手續費 | `src/app/refund.ts` | application |
| o | `returnedCents(RefundResult): number` | 觀察:退了多少分,沒退成回 -1 | `src/app/refund.ts` | application |
| = | `refund(RawBody): RefundResult` | 整條:解析 → 結算 → 產生退款 | `src/app/refund.ts` | application |
| ! | `refundHandler(HttpReq): HttpRes` | 進入點:接到 POST /refund | `src/entry/routes.ts` | entry |

## Laws
- LAW-1 [relation] 退回的錢就是這些品項扣掉手續費的結算金額
  - forall raw in RawBody
  - |- returnedCents(refund(raw)) == cents(settle(refundLines(parseRefund(raw)), refundFee(parseRefund(raw))))
- LAW-2 [total] 任何一段請求文字都得到一個結果,不拋例外
  - forall raw in RawBody
  - |- total(refund(raw))

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `refund("o1\|100,50\|30")` | `returnedCents 是 120` | LAW-1 |
| EX-2 | `refund("o1\|10\|30")` | `returnedCents 是 -1` | LAW-1、LAW-2 |

## 決定
- **手續費用同一條結算走,不另寫一條扣款。** 否決:退款自己寫扣手續費。同一件事寫兩次就是 A-001-settle 存在的理由。
- **解凍一次**(2026-09-07):為了 REV-1 的收整解凍,收整做完由 build 重新 frozen。

## 修訂記錄
- REV-1(2026-09-07,依 dev-flow:refactor 收整):金額計算改成引用 A-001-settle
  - 動到:第 2 步改成「見 A-001-settle」
  - 保護:LAW-1、LAW-2
  - 重委派:qa(LAW-1)
  - 連動:A-001-settle 建檔
