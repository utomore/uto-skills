---
id: R-1
priority: 1
updated: 2026-09-07
---
# R-1-queue-order:推進去的工作一個都不會少

- 驗收:推一個 job 之後深度多一
  - forall jobs in Job, j in Job
  - |- Depth(Push(jobs, j)) == Depth(jobs) + 1

| 里程碑 | 做到什麼 | 綁定 |
|---|---|---|
| M-1-queue | 入隊與出隊走通 | F-001-queue |
