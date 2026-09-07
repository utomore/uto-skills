---
id: F-00x
description: <一句話:使用者能做到什麼>
status: draft
updated: <YYYY-MM-DD>
---
# F-00x-<slug>:<同 description>

## Brief
<意圖一句。input 是什麼、output 是什麼。流向:A → B → C。哪個對外入口進來、從哪個出口出去。>

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `<name(T1, T2): R>` | <一句> | `<src/app/x.ts>` | <application> |
| 2 | `<name(T1): R>` | <一句> | `<src/domain/y.ts>`(見 A-00x-<slug>) | <domain> |
| o | `<name(T1): R>` | 觀察:<law 要看的量,一句> | `<src/domain/y.ts>` | <domain> |
| = | `<name(T1, T2): R>` | 整條 | `<src/app/x.ts>` | <application> |
| ! | `<name(T1): R>` | 進入點:<接到哪一列對外 I/O> | `<src/entry/z.ts>` | <entry> |

## Laws
- LAW-1 [<invariant | identity | roundtrip | relation | bound | equiv | total | commute>] <一句中文>
  - forall <x> in <Type>
  - given <前提表達式;沒有前提就刪這行。given 的呼叫先發生,|- 行在其後求值>
  - |- <結論,只用 Steps 的簽名(含 o 列與 = 列,不含 ! 列)、最內層的匯出、型別名與字面值>

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `<expr>` | `<value>` | LAW-1 |

## 決定
- **<決定一句。>** 否決:<替代方案>。<理由一句>。證據:<SPK-00x-<slug> 或 ADR-00x-<slug>,無則省略>

## 修訂記錄
無
