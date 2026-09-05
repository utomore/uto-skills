---
id: SPK-001
description: CBOR 編 1000 個實體會不會超過 128 KB
status: concluded
verdict: feasible
updated: 2026-09-05
feeds: [ADR-001-save-format]
---
# SPK-001-cbor-size:CBOR 編 1000 個實體會不會超過 128 KB

## 問題
- 要回答什麼:1000 個實體的 SaveState 用 cborg 編碼會不會超過 128 KB
- 為什麼讀原始碼答不出來:cborg 的整數與浮點編碼長度隨值變
- 判準:feasible = 128 KB 以下;infeasible = 以上
- timebox:一小時

## 輪次
### RND-1(2026-09-05)
- 這輪要驗:1000 個隨機實體
- 判準:同上
- timebox:一小時
- 做法:generate 1000 筆丟進 cborg
- 結果:31 KB
- sha:abc1234
- 環境:本機

## 結論
- verdict:feasible
- 一句話結論:每個實體約 31 位元組
- 學到什麼:浮點用 Double 佔最多
- 餵給哪裡:ADR-001-save-format
- 沒驗到的:無
