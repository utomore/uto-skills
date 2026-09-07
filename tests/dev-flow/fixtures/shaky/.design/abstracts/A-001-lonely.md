---
id: A-001
description: 沒有任何人引用的抽象
status: draft
updated: 2026-09-07
---
# A-001-lonely:沒有任何人引用的抽象

## Brief
夾具用:零個消費者,lint sig 該報紅。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| = | `reload(string): Rule` | 整條 | `src/domain/rule.ts` | domain |
| ! | `dumpHandler(Raw): string` | abstract 不該有 ! 列 | `src/entry/api.ts` | entry |

## Laws
- LAW-1 [invariant] 重讀不改名字
  - forall n in string
  - |- weigh(reload(n)) >= 0

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `reload("a")` | `weight 是 1` | LAW-1 |

## 決定
無

## 修訂記錄
無
