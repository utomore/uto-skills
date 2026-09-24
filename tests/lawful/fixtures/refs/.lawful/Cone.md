---
language: <haskell | …>
updated: 2026-09-05
---
# refs：引用方向的夾具，沒有 language，只看 .lawful

## 願景
輸入檔解析、正規化後跑完整條。

三條 pipeline：里程碑 P-001 引用 P-002 的 = 列（有註明見）；P-002 與 P-003 都把 shared 列成步驟而沒註明見。

## 全域 Law
不得違反：整個專案任何一條切片、任何一條 pipeline 都要守。三類各住一區，各有一道 lint 自動確認（`lawful lint global` 一次查完）；新增、修改、放寬、替換或刪除都要開發者明確批准。

### 領域不變量
無

### 架構：四層
- types:`App.Doc`
- effect：無
- core:`App.Syntax`、`App.Canon`、`App.Cli`
- shell:`App.Cli.Main`

### 契約：對外 I/O
| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline | 契約 |
|---|---|---|---|---|---|
| 輸入檔 | in | `Text` | `App.Cli.Main` | P-001-cli-run | - |

## Constraint
硬性限制：寫程式之前就定得下來、每一行程式碼與測試都照做的規定，與工具要讀的那幾行（語言、三道指令、模組前綴、原始碼根目錄、追加清單、忽略目錄、號段、優先）。開發者定，`lawful:kickoff` 寫，之後隨時回 `lawful:kickoff` 補或改；限制的類別可以自己加。
- 套件與框架：無
- 語言：<haskell | …>
- 建置：無
- 測試（整套）：無
- 測試（子集）：無
- 模組前綴：`App`
- IO 模組追加：無
- 效果型別追加：無
- 忽略目錄：無
