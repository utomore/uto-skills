---
language: haskell
updated: 2026-09-05
---
# frozen-ref:引用排在後面、已凍結的 pipeline

## 願景
一段文字丟進來,字數統計與報表一次算對。

兩條里程碑:P-001-report-render 引用 P-002-count-tally 的 = 列;P-002-count-tally 已實作完、測試全綠、frozen,而它在檔名順序上排在引用者後面。

## 需求
### R-1:一段文字進來,報表算對
- Law:任一段文字的報表字數等於逐字計數

## 專案約束
- 語言:haskell
- 建置:`cabal build`
- 測試(整套):`cabal test`
- 測試(子集):`cabal test --test-options='-m "P-002"'`
- 模組前綴:`App`
- IO 模組追加:無
- 效果型別追加:無
- 忽略目錄:無
- 套件與框架:無
- 優先:1 = 讀寫的正確性;2 = 使用者看得到的;3 = 呈現;4 = 工具
