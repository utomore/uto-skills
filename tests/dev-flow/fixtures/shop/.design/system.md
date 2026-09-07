---
language: typescript
updated: 2026-09-07
---
# shop:購物車結帳與退款

## 目的
替小型電商做結帳與退款兩條路徑。金額一律以分為單位、單一幣別內計算,不做跨幣別換算。
三個月後期望它仍然只有這兩條路徑,金額的規則集中在一處,加第三條路徑時不必再寫一次金額計算。

## 語言與工具
- 建置:`npx tsc --noEmit`
- 測試(整套):`npx jest`
- 測試(子集):`npx jest test/<檔名>`(以一份文檔選)
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無

## 層
由內而外;內層不准 import 外層,最後一列是最外層,也是唯一能做對外 I/O 的層。

| 層 | 裝什麼 |
|---|---|
| domain | 金額的型別與規則 |
| application | 把 domain 串成一條結帳或退款 |
| entry | HTTP 路由 |

## 對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 |
|---|---|---|---|---|---|---|
| POST /checkout | in | `RawBody` | `src/entry/routes.ts` | F-001-checkout | untrusted | `parseCheckout` |
| 結帳結果 | out | `HttpRes` | `src/entry/routes.ts` | F-001-checkout | trusted | - |
| POST /refund | in | `RawBody` | `src/entry/routes.ts` | F-002-refund | untrusted | `parseRefund` |
| 退款結果 | out | `HttpRes` | `src/entry/routes.ts` | F-002-refund | trusted | - |

## Features
| 全名 | 類別 | 階段 |
|---|---|---|
| F-001-checkout | feature | S1 |
| F-002-refund | feature | S2 |
| A-001-settle | abstract | - |
