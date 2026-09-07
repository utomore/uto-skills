---
id: F-002
description: 另一份 feature,被 F-001 錯誤地引用
status: draft
updated: 2026-09-07
---
# F-002-other:另一份 feature,被 F-001 錯誤地引用

## Brief
夾具用。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `weigh(Rule): number` | 取權重 | `src/domain/rule.ts`(見 A-002-single) | domain |
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
