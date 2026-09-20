---
language: go
updated: 2026-09-07
---
# go-svc:優先權佇列

## 願景
工作永遠按優先權出隊,先來的同權工作先出。

夾具:證明 Go adapter 的簽名(含接收者方法與多回傳值)、匯出、import 與子測試歸屬(含需求驗收測試歸屬的字串形式)對得上。

## 全域 Law
不得違反:整個專案任何一條切片、任何一份 feature 都要守。三類各住一區,各有一道 lint 自動確認(`devflow lint global` 一次查完);新增、修改、放寬、替換或刪除都要開發者明確批准。

### 領域不變量
無

### 架構:層
| 層 | 裝什麼 |
|---|---|
| core | 佇列的規則 |
| entry | 程序進入點 |

### 契約:對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 |
|---|---|---|---|---|---|---|
| stdin 一行 | in | `Job` | `cmd/main.go` | F-001-queue | untrusted | `Push` |
| 佇列深度 | out | `int` | `cmd/main.go` | F-001-queue | trusted | - |

## 語言與工具
- 建置:`go build ./...`
- 測試(整套):`go test -v ./...`
- 測試(子集):`go test -v ./internal/queue`
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無
- 優先:1 = 出隊順序;2 = 進入點;3 = 呈現;4 = 工具

## Features
| 全名 | 類別 |
|---|---|
| F-001-queue | feature |
