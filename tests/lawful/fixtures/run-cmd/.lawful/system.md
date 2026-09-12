---
language: haskell
updated: 2026-09-06
---
# run-cmd:指令欄帶說明文字、測試輸出沒有標記

## 願景
一段文字丟進來,字數統計與報表一次算對。

## 目的
兩條里程碑,同 frozen-ref;整套測試指令的反引號後面帶說明,--run 只能跑反引號裡的那段。

## 語言與工具
- 建置:`cabal build`
- 測試(整套):`node print-log.mjs`(在專案根目錄跑;反引號外這段是給人看的,不是指令)
- 測試(子集):`cabal test --test-options='-m "P-002"'`
- IO 模組追加:無
- 效果型別追加:無
- 忽略目錄:無

## 邊界
- types:`App.Token`
- effect:無
- core:`App.Count`、`App.Report`
- shell:`App.Report.Main`

## 對外 I/O
| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline |
|---|---|---|---|---|
| 輸入文字 | in | `Text` | `App.Report.Main` | P-001-report |

## Pipelines
| 全名 | 類別 |
|---|---|
| P-001-report | IO 介面 |
| P-002-count | IO 介面 |
