---
language: python
updated: 2026-09-07
---
# py-svc:購物籃小服務

## 目的
夾具:證明 Python adapter 的簽名、匯出、import 與測試歸屬對得上。

## 語言與工具
- 建置:`python -m compileall cart`
- 測試(整套):`pytest -v`
- 測試(子集):`pytest -v tests/test_basket.py`
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無

## 層
| 層 | 裝什麼 |
|---|---|
| core | 購物籃的規則 |
| entry | HTTP 進入點 |

## 對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 |
|---|---|---|---|---|---|---|
| POST /basket | in | `str` | `cart/api.py` | F-001-basket | untrusted | `add_item` |
| 總金額 | out | `str` | `cart/api.py` | F-001-basket | trusted | - |

## Features
| 全名 | 類別 | 階段 |
|---|---|---|
| F-001-basket | feature | S1 |
