---
language: python
updated: 2026-09-07
---
# py-svc:購物籃小服務

## 願景
購物籃的總金額永遠等於品項加總。

夾具:證明 Python adapter 的簽名、匯出、import 與測試歸屬(含需求驗收測試歸屬的識別字形式)對得上。

## 全域 Law
不得違反:整個專案任何一條切片、任何一份 feature 都要守。三類各住一區,各有一道 lint 自動確認(`devflow lint global` 一次查完);新增、修改、放寬、替換或刪除都要開發者明確批准。

### 領域不變量
無

### 架構:層
| 層 | 裝什麼 |
|---|---|
| core | 購物籃的規則 |
| entry | HTTP 進入點 |

### 契約:對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 |
|---|---|---|---|---|---|---|
| POST /basket | in | `str` | `cart/api.py` | F-001-basket | untrusted | `add_item` |
| 總金額 | out | `str` | `cart/api.py` | F-001-basket | trusted | - |

## Constraint
- 建置:`python -m compileall cart`
- 測試(整套):`pytest -v`
- 測試(子集):`pytest -v tests/test_basket.py`
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無
- 優先:1 = 算得對;2 = 進入點;3 = 呈現;4 = 工具

## Features
| 全名 | 類別 |
|---|---|
| F-001-basket | feature |
