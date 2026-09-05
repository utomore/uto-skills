module Host.Save
  ( saveGame
  ) where

import Host.FS (writeSave)
import Save.Codec (encode, toSave)
import World (World)

saveGame :: FilePath -> World -> IO ()
saveGame path = writeSave path . encode . toSave
