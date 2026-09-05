-- 沒有匯出清單:整個模組都公開,lint boundary 要紅。
module Save.Project where

import World (World, entityCount)

projectSize :: World -> Int
projectSize = entityCount
