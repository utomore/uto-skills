---
id: A-00x
description: <一句話:這段共用能力做什麼>
status: draft
updated: <YYYY-MM-DD>
---
# A-00x-<slug>:<同 description>

## Brief
<意圖一句。input 是什麼、output 是什麼。哪幾份 feature 從哪一步引用它——**至少兩份**,只有一份就該搬回那一份。>

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `<name(T1): R>` | <一句> | `<src/domain/y.ts>` | <domain> |
| o | `<name(T1): R>` | 觀察:<law 要看的量,一句> | `<src/domain/y.ts>` | <domain> |
| = | `<name(T1, T2): R>` | 整條 | `<src/domain/y.ts>` | <domain> |

## Laws
- LAW-1 [<invariant | identity | roundtrip | relation | bound | equiv | total | commute>] <一句中文>
  - forall <x> in <Type>
  - |- <結論>

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `<expr>` | `<value>` | LAW-1 |

## 決定
- **<決定一句:為什麼這段值得從 <哪幾份 feature> 抽出來。>** 否決:<留在原地各寫一份>。<理由一句>

## 修訂記錄
無
