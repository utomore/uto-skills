---
language: typescript
updated: 2026-09-07
---
# shop：購物車結帳與退款

## 願景
小型電商的每一筆錢都算得對、查得到來源；結帳與退款之外再加路徑時，金額規則不必再寫一次。

替小型電商做結帳與退款兩條路徑。金額一律以分為單位、單一幣別內計算，不做跨幣別換算。

## 全域 Law
不得違反：整個專案任何一條切片、任何一份 feature 都要守。三類各住一區，各有一道 lint 自動確認（`devflow lint global` 一次查完）；新增、修改、放寬、替換或刪除都要開發者明確批准。

### 領域不變量
- INV-1 [bound] 任何一條路徑結算出來的金額都不為負
  - forall ls in MoneyList, d in Money
  - given settled(settle(ls, d))
  - |- cents(settle(ls, d)) >= 0

### 架構：層
由內而外；內層不准 import 外層，最後一列是最外層，也是唯一能做對外 I/O 的層。

| 層 | 裝什麼 |
|---|---|
| domain | 金額的型別與規則 |
| application | 把 domain 串成一條結帳或退款 |
| entry | HTTP 路由 |

### 契約：對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 | 契約 |
|---|---|---|---|---|---|---|---|
| POST /checkout | in | `RawBody` | `src/entry/routes.ts` | F-001-checkout | untrusted | `parseCheckout` | F-001#LAW-2 |
| 結帳結果 | out | `HttpRes` | `src/entry/routes.ts` | F-001-checkout | trusted | - | INV-1 |
| POST /refund | in | `RawBody` | `src/entry/routes.ts` | F-002-refund | untrusted | `parseRefund` | F-002#LAW-2 |
| 退款結果 | out | `HttpRes` | `src/entry/routes.ts` | F-002-refund | trusted | - | INV-1 |

## Constraint
硬性限制：寫程式之前就定得下來、每一行程式碼與測試都照做的規定，與工具要讀的那幾行（三道指令、追加清單、忽略目錄、號段、優先）。開發者定，`dev-flow:kickoff` 寫，之後隨時回 `dev-flow:kickoff` 補或改；限制的類別可以自己加。
- 語言與版本：TypeScript 5.4，`strict` 全開
- 編譯器與執行環境：Node 20
- 套件與框架：測試只用 jest；金額運算不准引入浮點數的函式庫
- 環境：無
- 命名與寫法：型別 PascalCase、函數與變數 camelCase、檔名 kebab-case；讀出整數分的函數以 `Cents` 結尾
- 建置：`npx tsc --noEmit`
- 測試（整套）：`npx jest`
- 測試（子集）：`npx jest test/<檔名>`（以一份文檔選）
- IO 模組追加：無
- Laws 詞彙追加：無
- 忽略目錄：無
- 號段：無
- 優先：1 = 錢算對；2 = 查得到來源；3 = 呈現；4 = 工具

## Features
| 全名 | 類別 |
|---|---|
| F-001-checkout | feature |
| F-002-refund | feature |
