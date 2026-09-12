-- 沒有匯出清單:整個模組都公開,lint boundary 要紅。
module Game.Save.Project where

import Game.World (World, entityCount)

projectSize :: World -> Int
projectSize = entityCount
