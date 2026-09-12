---
language: haskell
updated: 2026-09-05
---
# save-game:把遊戲世界存成檔案再讀回來

## 願景
玩家在任何時刻存檔,之後讀回來的世界和存檔那一刻一模一樣。

## 目的
替一個小型 2D 遊戲提供存檔與讀檔。玩家按存檔,當前世界寫成一個檔案;讀檔把檔案還原成同一個世界。不處理雲端同步,不處理跨版本升級。

## 語言與工具
- 建置:`cabal build`
- 測試(整套):`cabal test`
- 測試(子集):`cabal test --test-options='-m "P-001"'`
- 模組前綴:`Game`
- 原始碼根目錄:`src-<層>`
- IO 模組追加:無

## 邊界
- types:`Game.World`(遊戲世界的不可變值,含渲染快取)、`Game.Save.State`(可存檔的投影)
- effect:無
- core:`Game.Save.Core.*`(投影與編解碼)
- shell:`Game.Save.Host`(存檔進入點)、`Game.FS`(檔案系統)

## 對外 I/O
| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline |
|---|---|---|---|---|
| 存檔檔案 | out | `ByteString` | `Game.FS` | P-001-game-save |
| 讀檔 | inn | `SaveState` | `Game.Save.Codec` | P-002-load-game |

## Pipelines
| 全名 | 類別 |
|---|---|
| P-001-game-save | IO 介面 |
