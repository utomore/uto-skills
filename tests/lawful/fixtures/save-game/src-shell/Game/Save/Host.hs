-- shell 層:P-001-save-game 的 ! 列,把純的整條接到檔案系統。
module Game.Save.Host
  ( saveGame
  ) where

import Game.FS (writeSave)
import Game.Save (saveBytes)
import Game.World (World)

saveGame :: FilePath -> World -> IO ()
saveGame path = writeSave path . saveBytes
