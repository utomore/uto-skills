-- shell 層:P-001-save-game 的 = 列。
module Host.Save
  ( saveGame
  ) where

import Host.FS (writeSave)
import Save.Codec (encode)
import Save.Project (toSave)
import World (World)

saveGame :: FilePath -> World -> IO ()
saveGame path = writeSave path . encode . toSave
