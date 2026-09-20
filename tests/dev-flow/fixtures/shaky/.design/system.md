---
language: typescript
updated: 2026-09-07
---
# shaky:每一種紅都示範一次

## 願景
<一到三句:這個專案做完時世界長什麼樣、替誰改變了什麼。>

## 全域 Law
不得違反:整個專案任何一條切片、任何一份 feature 都要守。三類各住一區,各有一道 lint 自動確認(`devflow lint global` 一次查完);新增、修改、放寬、替換或刪除都要開發者明確批准。

### 領域不變量
- INV-1 [bound] 沒有三行的不變量
- INV-2 [invariant] 寫了三行卻沒有測試,而且引用了一份 feature 的簽名
  - forall raw in Raw
  - |- score(raw) >= 0
- INV-2 [invariant] 編號重複
- INV-3 [nonsense] 種類不合法

### 架構:層
| 層 | 裝什麼 |
|---|---|
| domain | 規則 |
| application | 用例 |
| entry | 路由 |

### 契約:對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 | 契約 |
|---|---|---|---|---|---|---|---|
| POST /score | in | `Raw` | `src/entry/api.ts` | F-001-score | untrusted | - | F-001#LAW-9、INV-9、冪等 |

## Constraint
- 建置:`npx tsc --noEmit`
- 測試(整套):`npx jest`
- 測試(子集):`npx jest test/<檔名>`
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無
- 號段:amy@corp.com = 000-099;bob@corp.com = 050-149;carol@corp.com = 1x0-199

## Features
| 全名 | 類別 |
|---|---|
| F-001-score | feature |
| F-003-missing | feature |
