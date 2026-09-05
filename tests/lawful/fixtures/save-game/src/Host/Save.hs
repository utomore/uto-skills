-- shell 層:P-001-save-game 的 ! 列,把純的整條接到檔案系統。
module Host.Save
  ( saveGame
  ) where

import Host.FS (writeSave)
import Save (saveBytes)
import World (World)

saveGame :: FilePath -> World -> IO ()
saveGame path = writeSave path . saveBytes
