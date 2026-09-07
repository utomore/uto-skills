---
id: F-001
description: 把一串品項加進購物籃並算出總金額
status: ready
updated: 2026-09-07
---
# F-001-basket:把一串品項加進購物籃並算出總金額

## Brief
把 JSON 解析成品項,逐一加進購物籃,算出總金額。
input 是 POST /basket 的字串,output 是總金額字串。流向:加入 → 加總。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `add_item(list[Item], Item): list[Item]` | 加一項進購物籃 | `cart/basket.py` | core |
| o | `Basket.size(): int` | 觀察:購物籃裡有幾項 | `cart/basket.py` | core |
| = | `total_cents(list[Item]): int` | 整條:算出總金額 | `cart/basket.py` | core |
| ! | `handle(str): str` | 進入點:接到 POST /basket | `cart/api.py` | entry |

## Laws
- LAW-1 [invariant] 加一項之後品項數多一
  - forall items in list, it in Item
  - |- len(add_item(items, it)) == len(items) + 1
- LAW-2 [bound] 總金額不為負
  - forall items in list
  - |- total_cents(items) >= 0

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `total_cents(add_item([], Item))` | `100` | LAW-2 |

## 決定
無

## 修訂記錄
無
