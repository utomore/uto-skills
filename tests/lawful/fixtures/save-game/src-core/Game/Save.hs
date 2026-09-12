-- core 層:P-001-save-game 的 = 列,純的整條。
module Game.Save
  ( saveBytes
  ) where

import Data.ByteString (ByteString)
import Game.Save.Codec (encode)
import Game.Save.Project (toSave)
import Game.World (World)

saveBytes :: World -> ByteString
saveBytes = encode . toSave
