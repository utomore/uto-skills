---
language: typescript
updated: 2026-09-07
---
# shop:購物車結帳與退款

## 願景
小型電商的每一筆錢都算得對、查得到來源;結帳與退款之外再加路徑時,金額規則不必再寫一次。

替小型電商做結帳與退款兩條路徑。金額一律以分為單位、單一幣別內計算,不做跨幣別換算。

## 需求
### R-1:每一筆結帳與退款的金額都算對
- 驗收:任一筆請求,訂單付的錢與退回的錢都等於品項加總減掉折扣或手續費的結算金額
  - forall raw in RawBody
  - |- paidCents(checkout(raw)) == cents(settle(reqLines(parseCheckout(raw)), reqDiscount(parseCheckout(raw)))) and returnedCents(refund(raw)) == cents(settle(refundLines(parseRefund(raw)), refundFee(parseRefund(raw))))

### R-2:店主隨時看得到今天收了多少錢
- 驗收:店主查當日營收,看到的數字等於當日每一筆結帳減掉每一筆退款

## 全域 Law
不得違反:整個專案任何一條切片、任何一份 feature 都要守。三類各住一區,各有一道 lint 自動確認(`devflow lint global` 一次查完);新增、修改、放寬、替換或刪除都要開發者明確批准。

### 領域不變量
- INV-1 [bound] 任何一條路徑結算出來的金額都不為負
  - forall ls in MoneyList, d in Money
  - given settled(settle(ls, d))
  - |- cents(settle(ls, d)) >= 0

### 架構:層
由內而外;內層不准 import 外層,最後一列是最外層,也是唯一能做對外 I/O 的層。

| 層 | 裝什麼 |
|---|---|
| domain | 金額的型別與規則 |
| application | 把 domain 串成一條結帳或退款 |
| entry | HTTP 路由 |

### 契約:對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 | 契約 |
|---|---|---|---|---|---|---|---|
| POST /checkout | in | `RawBody` | `src/entry/routes.ts` | F-001-checkout | untrusted | `parseCheckout` | F-001#LAW-2 |
| 結帳結果 | out | `HttpRes` | `src/entry/routes.ts` | F-001-checkout | trusted | - | INV-1 |
| POST /refund | in | `RawBody` | `src/entry/routes.ts` | F-002-refund | untrusted | `parseRefund` | F-002#LAW-2 |
| 退款結果 | out | `HttpRes` | `src/entry/routes.ts` | F-002-refund | trusted | - | INV-1 |

## Constraint
- 建置:`npx tsc --noEmit`
- 測試(整套):`npx jest`
- 測試(子集):`npx jest test/<檔名>`(以一份文檔選)
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無
- 號段:無
- 優先:1 = 錢算對;2 = 查得到來源;3 = 呈現;4 = 工具

## Features
| 全名 | 類別 |
|---|---|
| F-001-checkout | feature |
| F-002-refund | feature |
