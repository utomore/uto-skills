---
id: F-001
description: 使用者把購物車結成一張已付款的訂單
status: frozen
updated: 2026-09-07
---
# F-001-checkout:使用者把購物車結成一張已付款的訂單

## Brief
把一段請求文字解析成購物車,結算應付金額,產生一張訂單。
input 是 POST /checkout 的 RawBody,output 是 HttpRes。
流向:解析 → 結算 → 產生訂單。從對外 I/O 表的「POST /checkout」進來,從「結帳結果」出去。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `parseCheckout(RawBody): CheckoutReq` | 解析並夾住請求裡的數字,不信任任何一段 | `src/app/checkout.ts` | application |
| 2 | `settle(MoneyList, Money): Settlement` | 結算應付金額 | `src/domain/money.ts`(見 A-001-settle) | domain |
| 3 | `toOrder(CheckoutReq, Settlement): CheckoutResult` | 結算成功就產生訂單,失敗就帶回理由 | `src/app/checkout.ts` | application |
| o | `reqLines(CheckoutReq): MoneyList` | 觀察:這張購物車有哪些品項 | `src/app/checkout.ts` | application |
| o | `reqDiscount(CheckoutReq): Money` | 觀察:這張購物車的折扣 | `src/app/checkout.ts` | application |
| o | `paidCents(CheckoutResult): number` | 觀察:訂單付了多少分,沒成單回 -1 | `src/app/checkout.ts` | application |
| = | `checkout(RawBody): CheckoutResult` | 整條:解析 → 結算 → 產生訂單 | `src/app/checkout.ts` | application |
| ! | `checkoutHandler(HttpReq): HttpRes` | 進入點:接到 POST /checkout | `src/entry/routes.ts` | entry |

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

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `checkout("c1\|100,50\|20")` | `paidCents 是 130` | LAW-1、LAW-3 |
| EX-2 | `checkout("c1\|100\|300")` | `paidCents 是 -1,reason 是 negative-total` | LAW-1、LAW-2 |
| EX-3 | `checkout("")` | `paidCents 是 0` | LAW-2、LAW-3 |

## 決定
- **解析階段就把數字夾成非負整數,而不是讓結算去擋。** 否決:原樣傳進 domain 再回錯誤。`parseCheckout` 是 untrusted 入口的驗證 step,不合法的輸入不該有機會走到 domain。
- **解凍一次**(2026-09-07):為了 REV-1 的收整解凍,收整做完由 build 重新 frozen。

## 修訂記錄
- REV-1(2026-09-07,依 dev-flow:refactor 收整):金額計算改成引用 A-001-settle
  - 動到:第 2 步改成「見 A-001-settle」
  - 保護:LAW-1、LAW-2、LAW-3
  - 重委派:qa(LAW-1)
  - 連動:A-001-settle 建檔
