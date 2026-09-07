---
id: F-001
description: 把一行輸入排進優先權佇列並回報深度
status: ready
updated: 2026-09-07
---
# F-001-queue:把一行輸入排進優先權佇列並回報深度

## Brief
把一行輸入變成一個 Job 推進佇列,回報目前深度。
input 是 stdin 的一行,output 是深度。流向:推入 → 取深度。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `Push([]Job, Job): []Job` | 推一個 job 進佇列 | `internal/queue/queue.go` | core |
| o | `Peek([]Job): (Job, bool)` | 觀察:優先權最高的那個是誰 | `internal/queue/queue.go` | core |
| o | `Queue.Size(): int` | 觀察:佇列物件裡有幾個 | `internal/queue/queue.go` | core |
| = | `Depth([]Job): int` | 整條:佇列現在有多深 | `internal/queue/queue.go` | core |
| ! | `Serve(string): string` | 進入點:接到 stdin 的一行 | `cmd/main.go` | entry |

## Laws
- LAW-1 [invariant] 推一個進去,深度多一
  - forall jobs in Job, j in Job
  - |- Depth(Push(jobs, j)) == Depth(jobs) + 1
- LAW-2 [total] 空佇列取不到東西,但不會炸
  - forall jobs in Job
  - |- total(Peek(jobs))

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `Depth(nil)` | `0` | LAW-1 |

## 決定
無

## 修訂記錄
無
