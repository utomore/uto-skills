---
id: F-002
owner: dave@corp.com
description: 另一份 feature,F-001 引用它,也與它各寫了一條同名的 step
status: draft
updated: 2026-09-07
---
# F-002-other：另一份 feature，F-001 引用它，也與它各寫了一條同名的 step

## Brief
夾具用。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `weigh(Rule): number` | 取權重（F-001-score 也寫了這一條，兩邊都沒註明見） | `src/domain/rule.ts` | domain |
| 2 | `load(string): Rule` | 讀出一條規則 | `src/app/store.ts` | application |
| = | `helperOnly(Raw): number` | 整條 | `src/app/store.ts` | application |

## Laws
- LAW-1 [invariant] 恆為正
  - forall raw in Raw
  - |- helperOnly(raw) > 0

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `helperOnly("x")` | `1` | LAW-1 |

## 決定
無

## 修訂記錄
無
