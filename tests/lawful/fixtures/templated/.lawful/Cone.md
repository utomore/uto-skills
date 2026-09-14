---
language: haskell
updated: 2026-09-05
---
# templated:claim 建出來、還沒寫的 draft

## 願景
一段文字丟進來,字數統計與報表一次算對。

frozen-ref 的兩條,再加一條剛 claim、Stages 與 Laws 都還是模板佔位符的 draft。

## 需求
### R-1:<一句話:誰在什麼情況下要得到什麼>
- Law:<一句可判定的話:這條需求成立時,什麼一定為真>

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
