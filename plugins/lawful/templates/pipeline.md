---
id: P-00x
description: <一句話:input 到 output>
status: draft
updated: <YYYY-MM-DD>
---
# P-00x-<slug>:<同 description>

## Brief
<意圖一句。input 是什麼、output 是什麼。流向:A → B → C。它是 P-00y-<slug> 的第 n 個 stage,或它是里程碑。>

## Stages
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `<name :: Type>` | <一句> | `<Module>` | pure |
| 2 | `<name :: Type>` | <一句> | `<Module>`(願望,見 P-00z-<slug>) | pure |
| o | `<name :: Type>` | 觀察:<law 要看的量,一句> | `<Module.Internal>` | pure |
| = | `<name :: Type>` | 整條 | `<Module>` | pure |

## Laws
- LAW-1 [<invariant | identity | roundtrip | relation | bound | equiv>] <一句中文>
  - forall <x> in <Type>
  - |- <結論,只用 Stages 的簽名(含 o 列)、types 層的函數與字面值>

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `<expr>` | `<value>` | LAW-1 |

## 決定
- **<決定一句。>** 否決:<替代方案>。<理由一句>。證據:<SPK-00x-<slug> 或 ADR-00x-<slug>,無則省略>

## 修訂記錄
無
