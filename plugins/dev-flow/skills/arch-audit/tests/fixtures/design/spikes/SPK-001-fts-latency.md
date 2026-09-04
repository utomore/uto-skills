---
id: SPK-001
type: spike
title: fts-latency
description: SQLite FTS5 在 50 萬筆下的查詢延遲
status: concluded
verdict: feasible
created: 2026-08-05
updated: 2026-08-06
subsystems: [auth]
feeds: [ADR-001-jwt, auth/F002-token-refresh, auth/F999]
related-adr: [ADR-001]
code-paths: [spike/SPK-001-fts-latency]
---

# SPK-001-fts-latency

## 問題
- **要回答什麼**:FTS5 在 50 萬筆筆記下,單字查詢能不能在 200ms 內回來
- **為什麼讀原始碼答不出來**:延遲取決於索引大小與機器,文件沒有這個量級的數字
- **判準**:feasible = p95 < 200ms;infeasible = p95 > 1s;partial = 介於其間
- **下游**:ADR-001-jwt 的替代方案、auth/F002-token-refresh 的不可逆決定

## 輪次
### RND-1(2026-08-05)
- 這輪要驗:同上
- 判準:同上
- timebox:半天
- 做法:灌 50 萬筆假資料,跑 100 次隨機單字查詢
- 結果:p95 120ms
- sha:abc1234
- 環境:筆電、本機 SSD

## 結論
- **verdict**:feasible
- **一句話結論**:FTS5 撐得住這個量級
- **學到什麼**:索引要先建好,冷啟動 40 秒
- **餵給哪裡**:
  - ADR-001-jwt 的替代方案(2026-08-06):記下 FTS5 可行
- **沒驗到的**:並發寫入
