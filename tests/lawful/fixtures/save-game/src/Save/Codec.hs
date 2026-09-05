-- pure 層:P-001-save-game stage 2、3。
module Save.Codec
  ( encode
  , decode
  ) where

import Data.ByteString (ByteString)
import Save.State (DecodeError, SaveState)

encode :: SaveState -> ByteString
encode = undefined

-- 多行簽名,lint sig 要合併後比對
decode
  :: ByteString
  -> Either DecodeError SaveState
decode = undefined
