---
language: haskell
updated: 2026-09-06
---
# templated:claim 建出來、還沒寫的 draft

## 目的
frozen-ref 的兩條,再加一條剛 claim、Stages 與 Laws 都還是模板佔位符的 draft。

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
| P-001-report | 里程碑 |
| P-002-count | 里程碑 |
| P-003-tally | 子流 |
