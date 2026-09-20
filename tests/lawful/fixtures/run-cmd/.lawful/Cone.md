---
language: haskell
updated: 2026-09-05
---
# run-cmd:指令欄帶說明文字、測試輸出沒有標記

## 願景
一段文字丟進來,字數統計與報表一次算對。

兩條里程碑,同 frozen-ref;整套測試指令的反引號後面帶說明,--run 只能跑反引號裡的那段。

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

## 專案約束
- 語言:haskell
- 建置:`cabal build`
- 測試(整套):`node print-log.mjs`(在專案根目錄跑;反引號外這段是給人看的,不是指令)
- 測試(子集):`cabal test --test-options='-m "P-002"'`
- 模組前綴:`App`
- IO 模組追加:無
- 效果型別追加:無
- 忽略目錄:無
- 套件與框架:無
- 優先:1 = 讀寫的正確性;2 = 使用者看得到的;3 = 呈現;4 = 工具
