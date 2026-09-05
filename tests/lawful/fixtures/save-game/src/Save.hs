-- pure 層:P-001-save-game 的 = 列,純的整條。
module Save
  ( saveBytes
  ) where

import Data.ByteString (ByteString)
import Save.Codec (encode)
import Save.Project (toSave)
import World (World)

saveBytes :: World -> ByteString
saveBytes = encode . toSave
