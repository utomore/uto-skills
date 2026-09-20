---
language: haskell
updated: 2026-09-05
---
# frozen-ref:引用排在後面、已凍結的 pipeline

## 願景
一段文字丟進來,字數統計與報表一次算對。

兩條里程碑:P-001-report-render 引用 P-002-count-tally 的 = 列;P-002-count-tally 已實作完、測試全綠、frozen,而它在檔名順序上排在引用者後面。

## 全域 Law
不得違反:整個專案任何一條切片、任何一條 pipeline 都要守。三類各住一區,各有一道 lint 自動確認(`lawful lint global` 一次查完);新增、修改、放寬、替換或刪除都要開發者明確批准。

### 領域不變量
無

### 架構:四層
- types:`App.Token`
- effect:無
- core:`App.Count`、`App.Report`
- shell:`App.Report.Main`

### 契約:對外 I/O
| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline | 契約 |
|---|---|---|---|---|---|
| 輸入文字 | in | `Text` | `App.Report.Main` | P-001-report-render | - |

## Constraint
硬性限制:寫程式之前就定得下來、每一行程式碼與測試都照做的規定,與工具要讀的那幾行(語言、三道指令、模組前綴、原始碼根目錄、追加清單、忽略目錄、號段、優先)。開發者定,`lawful:kickoff` 寫,之後隨時回 `lawful:kickoff` 補或改;限制的類別可以自己加。
- 套件與框架:無
- 語言:haskell
- 建置:`cabal build`
- 測試(整套):`cabal test`
- 測試(子集):`cabal test --test-options='-m "P-002"'`
- 模組前綴:`App`
- IO 模組追加:無
- 效果型別追加:無
- 忽略目錄:無
- 優先:1 = 讀寫的正確性;2 = 使用者看得到的;3 = 呈現;4 = 工具
