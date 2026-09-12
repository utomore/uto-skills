module Game.Save.Host
  ( saveGame
  ) where

import Game.FS (writeSave)
import Game.Save.Codec (encode, toSave)
import Game.World (World)

saveGame :: FilePath -> World -> IO ()
saveGame path = writeSave path . encode . toSave
