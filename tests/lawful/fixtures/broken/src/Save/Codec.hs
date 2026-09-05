-- toSave 從 Save.Project 搬到這裡(同層搬家);decode 簽名與文檔不一致;pure 層碰 IO。
module Save.Codec
  ( toSave
  , encode
  , decode
  , dumpSave
  ) where

import Data.ByteString (ByteString)
import Save.Project.Internal (savedIds)
import Save.State (DecodeError, SaveState)
import System.IO (hPutStrLn, stderr)
import World (World)

toSave :: World -> SaveState
toSave = undefined

encode :: SaveState -> ByteString
encode = undefined

decode :: ByteString -> Maybe SaveState
decode = undefined

dumpSave :: SaveState -> IO ()
dumpSave = undefined
