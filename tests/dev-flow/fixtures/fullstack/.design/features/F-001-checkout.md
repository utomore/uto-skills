---
id: F-001
description: 使用者把購物車結成一張已付款的訂單
status: verified
updated: 2026-09-07
---
# F-001-checkout:使用者把購物車結成一張已付款的訂單

## Brief
把一段請求文字解析成購物車,結算應付金額,產生一張訂單。
input 是 POST /checkout 的 RawBody,output 是 HttpRes。
流向:解析 → 結算 → 產生訂單。從對外 I/O 表的「POST /checkout」進來,從「結帳結果」出去。
第 2 步的 settle 與它的 law 住在這一份;F-002-refund 的第 2 步引用它。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `parseCheckout(RawBody): CheckoutReq` | 解析並夾住請求裡的數字,不信任任何一段 | `web/src/app/checkout.ts` | application |
| 2 | `settle(MoneyList, Money): Settlement` | 結算應付金額:同幣別的品項相加再扣掉一筆金額,幣別不同或扣成負的就是錯誤 | `web/src/domain/money.ts` | domain |
| 3 | `toOrder(CheckoutReq, Settlement): CheckoutResult` | 結算成功就產生訂單,失敗就帶回理由 | `web/src/app/checkout.ts` | application |
| o | `reqLines(CheckoutReq): MoneyList` | 觀察:這張購物車有哪些品項 | `web/src/app/checkout.ts` | application |
| o | `reqDiscount(CheckoutReq): Money` | 觀察:這張購物車的折扣 | `web/src/app/checkout.ts` | application |
| o | `paidCents(CheckoutResult): number` | 觀察:訂單付了多少分,沒成單回 -1 | `web/src/app/checkout.ts` | application |
| o | `cents(Settlement): number` | 觀察:結算出來是多少分,沒結算成回 -1 | `web/src/domain/money.ts` | domain |
| o | `settled(Settlement): boolean` | 觀察:這次結算成功了沒 | `web/src/domain/money.ts` | domain |
| = | `checkout(RawBody): CheckoutResult` | 整條:解析 → 結算 → 產生訂單 | `web/src/app/checkout.ts` | application |
| ! | `checkoutHandler(HttpReq): HttpRes` | 進入點:接到 POST /checkout | `web/src/entry/routes.ts` | entry |

## Laws
- LAW-1 [relation] 訂單付的錢就是這張購物車的結算金額
  - forall raw in RawBody
  - |- paidCents(checkout(raw)) == cents(settle(reqLines(parseCheckout(raw)), reqDiscount(parseCheckout(raw))))
- LAW-2 [total] 任何一段請求文字都得到一個結果,不拋例外
  - forall raw in RawBody
  - |- total(checkout(raw))
- LAW-3 [bound] 成單時付款金額不為負
  - forall raw in RawBody
  - given paidCents(checkout(raw)) != -1
  - |- paidCents(checkout(raw)) >= 0
- LAW-4 [invariant] 結算成功時金額不為負
  - forall ls in MoneyList, d in Money
  - given settled(settle(ls, d))
  - |- cents(settle(ls, d)) >= 0
- LAW-5 [identity] 扣掉的金額是零時,結算金額等於各品項相加
  - forall ls in MoneyList
  - given settled(sumLines(ls))
  - |- cents(settle(ls, money(0, "TWD"))) == cents(sumLines(ls))
- LAW-6 [total] 任何品項清單與任何一筆要扣的金額都得到一個 Settlement,不拋例外
  - forall ls in MoneyList, d in Money
  - |- total(settle(ls, d))

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `checkout("c1\|100,50\|20")` | `paidCents 是 130` | LAW-1、LAW-3 |
| EX-2 | `checkout("c1\|100\|300")` | `paidCents 是 -1,reason 是 negative-total` | LAW-1、LAW-2 |
| EX-3 | `checkout("")` | `paidCents 是 0` | LAW-2、LAW-3 |
| EX-4 | `settle([money(100,"TWD"),money(50,"TWD")], money(20,"TWD"))` | `cents 是 130` | LAW-4、LAW-5 |
| EX-5 | `settle([money(100,"TWD")], money(300,"TWD"))` | `cents 是 -1,error 是 negative-total` | LAW-4、LAW-6 |

## 決定
- **解析階段就把數字夾成非負整數,而不是讓結算去擋。** 否決:原樣傳進 domain 再回錯誤。`parseCheckout` 是 untrusted 入口的驗證 step,不合法的輸入不該有機會走到 domain。
- **金額只在同一個幣別內計算,跨幣別是錯誤不是換算。** 否決:內建匯率換算。匯率是會過期的外部事實,放進純的結算會讓它需要一個時鐘與一個來源。
- **重開一次**(2026-09-07):為了 REV-1 重開,由 build 重新 verified。

## 修訂記錄
- REV-1(2026-09-07,依開發者:退款也走 settle,手續費可能大過要退的金額):settle 補一條 total 的 law
  - 動到:新增 LAW-6、EX-5
  - 保護:LAW-1、LAW-2、LAW-3、LAW-4、LAW-5
  - 重委派:qa(LAW-6、EX-5)
  - 連動:F-002-refund 的第 2 步引用本檔的 settle
