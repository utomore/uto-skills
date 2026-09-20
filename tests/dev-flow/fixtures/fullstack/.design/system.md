---
language: [web = typescript, api = python]
updated: 2026-09-07
---
# fullstack:購物車前端與購物籃後端

## 願景
同一個 repo 裡前端算錢、後端算籃子,兩邊各用自己的語言,一張看板看得到兩邊。

前端 TypeScript 做結帳與退款,後端 Python 做購物籃。

夾具:證明多語言專案的 language 欄「目錄 = adapter」清單、每側一組指令、兩側各自的簽名與 import 對帳、兩份測試輸出各用自己的 adapter 解析後合併。

## 全域 Law
不得違反:整個專案任何一條切片、任何一份 feature 都要守。三類各住一區,各有一道 lint 自動確認(`devflow lint global` 一次查完);新增、修改、放寬、替換或刪除都要開發者明確批准。

### 領域不變量
無

### 架構:層
| 層 | 裝什麼 |
|---|---|
| domain | 金額與購物籃的型別與規則 |
| application | 把 domain 串成一條結帳或退款 |
| entry | HTTP 路由 |

### 契約:對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 |
|---|---|---|---|---|---|---|
| POST /checkout | in | `RawBody` | `web/src/entry/routes.ts` | F-001-checkout | untrusted | `parseCheckout` |
| 結帳結果 | out | `HttpRes` | `web/src/entry/routes.ts` | F-001-checkout | trusted | - |
| POST /refund | in | `RawBody` | `web/src/entry/routes.ts` | F-002-refund | untrusted | `parseRefund` |
| 退款結果 | out | `HttpRes` | `web/src/entry/routes.ts` | F-002-refund | trusted | - |
| POST /basket | in | `str` | `api/cart/api.py` | F-003-basket | untrusted | `add_item` |
| 總金額 | out | `str` | `api/cart/api.py` | F-003-basket | trusted | - |

## 語言與工具
- 建置:web = `npx tsc --noEmit -p web`;api = `python -m compileall api/cart`
- 測試(整套):web = `npx jest --rootDir web`;api = `pytest -v api`
- 測試(子集):web = `npx jest --rootDir web test/<檔名>`;api = `pytest -v api/tests/<檔名>`(以一份文檔選)
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無
- 優先:1 = 錢算對;2 = 查得到來源;3 = 呈現;4 = 工具

## Features
| 全名 | 類別 |
|---|---|
| F-001-checkout | feature |
| F-002-refund | feature |
| A-001-settle | abstract |
| F-003-basket | feature |
