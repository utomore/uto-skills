---
id: R-1
priority: 1
updated: 2026-09-05
---
# R-1-game-save:玩家存檔後能讀回同一個世界

- 驗收:任一 World 存檔再讀回,可存檔的投影一模一樣
  - forall w in World
  - |- restore (saveGame w) == w

| 里程碑 | 做到什麼 | 綁定 |
|---|---|---|
| M-1-game-save | 存檔寫得出檔案 | P-001-game-save |
| M-2-load-game | 讀檔還原世界 | P-002-load-game |
| M-6 | 靠修訂達成卻沒有英文名,綁的另一條 pipeline 也不存在 | P-001-game-save、P-009-nope |
