---
language: haskell
updated: 2026-09-06
---
# frozen-ref:引用排在後面、已凍結的 pipeline

## 願景
一段文字丟進來,字數統計與報表一次算對。

## 目的
兩條里程碑:P-001-report 引用 P-002-count 的 = 列;P-002-count 已實作完、測試全綠、frozen,而它在檔名順序上排在引用者後面。

## 語言與工具
- 建置:`cabal build`
- 測試(整套):`cabal test`
- 測試(子集):`cabal test --test-options='-m "P-002"'`
- IO 模組追加:無
- 效果型別追加:無
- 忽略目錄:無

## 邊界
- types:`Types`
- effects:無
- pure:`Count`、`Report`
- shell:`Host.*`

## 對外 I/O
| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline |
|---|---|---|---|---|
| 輸入文字 | in | `Text` | `Host.Main` | P-001-report |

## Pipelines
| 全名 | 類別 |
|---|---|
| P-001-report | IO 介面 |
| P-002-count | IO 介面 |
