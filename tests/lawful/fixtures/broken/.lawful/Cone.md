---
language: haskell
updated: 2026-09-05
---
# save-game:把遊戲世界存成檔案再讀回來

## 願景
玩家在任何時刻存檔,之後讀回來的世界和存檔那一刻一模一樣。

替一個小型 2D 遊戲提供存檔與讀檔。玩家按存檔,當前世界寫成一個檔案;讀檔把檔案還原成同一個世界。不處理雲端同步,不處理跨版本升級。

## 需求
### R-1:玩家存檔後能讀回同一個世界
- 驗收:任一 World 存檔再讀回,可存檔的投影一模一樣
  - forall w in World
  - |- restore (saveGame w) == w

### R-2:存檔壞了讀得出是哪裡壞
- 驗收:<一句可判定的話:這條需求達成時,什麼一定為真>

## 全域 Law
不得違反:整個專案任何一條切片、任何一條 pipeline 都要守。三類各住一區,各有一道 lint 自動確認(`lawful lint global` 一次查完);新增、修改、放寬、替換或刪除都要開發者明確批准。

### 領域不變量
- INV-1 [invariant] 存檔裡的實體 id 不重複
- INV-2 [roundtrip] 可存檔的狀態收進什麼實體,就吐出什麼實體
  - forall es in [SavedEntity]
  - |- decode (encode (mkSaveState es)) == Right (mkSaveState es)
- INV-3 [always] 實體的座標是有限的數
- INV-2 [bound] 一個存檔最多一萬個實體

### 架構:四層
- types:`Game.World`(遊戲世界的不可變值,含渲染快取)、`Game.Save.State`(可存檔的投影)
- effect:無
- core:`Game.Save.Core.*`(投影與編解碼)
- shell:`Game.Save.Host`(存檔進入點)、`Game.FS`(檔案系統)

### 契約:對外 I/O
| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline | 契約 |
|---|---|---|---|---|---|
| 存檔檔案 | out | `ByteString` | `Game.FS` | P-001-game-save | P-001#LAW-9、INV-7、roundtrip |
| 讀檔 | inn | `SaveState` | `Game.Save.Codec` | P-002-load-game | - |

## 專案約束
- 語言:haskell
- 建置:`cabal build`
- 測試(整套):`cabal test`
- 測試(子集):`cabal test --test-options='-m "P-001"'`
- 模組前綴:`Game`
- 原始碼根目錄:`src-<層>`
- IO 模組追加:無
- 號段:amy@corp.com = 000-099;bob@corp.com = 050-149;carol@corp.com = 1x0-199
- 套件與框架:無
