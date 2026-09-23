---
id: F-001
owner: bob@corp.com
description: 把一段輸入算成分數
status: verified
updated: 2026-09-07
---
# F-001-score：把一段輸入算成分數

## Brief
夾具用：一份每一格都出點問題的 feature。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `weigh(Rule): string` | 取出權重（簽名故意與程式碼不一致） | `src/domain/rule.ts` | domain |
| 2 | `missingStep(Ghost): any` | 程式碼裡沒有這條；Ghost 沒宣告過、any 沒有名字 | `src/app/store.ts` | application |
| 3 | `helperOnly(Raw): number` | 別份文檔的 = 列，卻沒註明見 | `src/app/store.ts` | application |
| 4 | `load(string): Rule` | 引用別份文檔的 step | `src/app/store.ts`（見 F-002-other） | application |
| 5 | `reload(string): Rule` | 寫著見別份，那一份卻沒有這個 step | `src/domain/rule.ts`（見 F-002-other） | domain |
| o | `weigh(Rule): string` | 觀察 | `src/domain/rule.ts` | domain |
| = | `score(Raw): number` | 整條（模組欄指到別的檔，sync 該把它搬回來） | `src/app/other.ts` | application |
| ! | `scoreHandler(Raw): number` | 進入點 | `src/entry/api.ts` | entry |

## Laws
- LAW-1 [invariant] 分數不為負
  - forall raw in Raw
  - |- score(raw) >= 0
- LAW-2 [nonsense] 種類不合法，而且引用了不存在的東西
  - forall raw in Raw
  - |- mysteryFn(raw) == score(raw)

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `score("api_key=abc123def456")` | `1` | LAW-1 |
| EX-2 | `score("x")` | `1` | LAW-7 |

## 決定
無

## 修訂記錄
- REV-1（2026-09-07，依 開發者）：改了但沒有重開紀錄
  - 動到：LAW-1
  - 保護：無
  - 重委派：qa(LAW-1)
