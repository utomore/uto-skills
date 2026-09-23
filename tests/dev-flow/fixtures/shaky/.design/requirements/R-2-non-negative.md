---
id: R-2
priority: 2
updated: 2026-09-07
---
# R-2-non-negative：寫了三行卻沒有驗收測試，也沒有里程碑

- 驗收：任何輸入分數不為負
  - forall raw in Raw
  - |- score(raw) >= 0
