---
language: go
updated: 2026-09-07
---
# go-svc:優先權佇列

## 願景
工作永遠按優先權出隊,先來的同權工作先出。

夾具:證明 Go adapter 的簽名(含接收者方法與多回傳值)、匯出、import 與子測試歸屬(含需求 Law 的字串形式)對得上。

## 需求
### R-1:推進去的工作一個都不會少
- Law:推一個 job 之後深度多一
  - forall jobs in Job, j in Job
  - |- Depth(Push(jobs, j)) == Depth(jobs) + 1

## 語言與工具
- 建置:`go build ./...`
- 測試(整套):`go test -v ./...`
- 測試(子集):`go test -v ./internal/queue`
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無
- 優先:1 = 出隊順序;2 = 進入點;3 = 呈現;4 = 工具

## 層
| 層 | 裝什麼 |
|---|---|
| core | 佇列的規則 |
| entry | 程序進入點 |

## 對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 |
|---|---|---|---|---|---|---|
| stdin 一行 | in | `Job` | `cmd/main.go` | F-001-queue | untrusted | `Push` |
| 佇列深度 | out | `int` | `cmd/main.go` | F-001-queue | trusted | - |

## Features
| 全名 | 類別 |
|---|---|
| F-001-queue | feature |
