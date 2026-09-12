-- toSave 從 Save.Project 搬到這裡(同層搬家);decode 簽名與文檔不一致;core 層碰 IO。
module Game.Save.Codec
  ( toSave
  , encode
  , decode
  , dumpSave
  ) where

import Data.ByteString (ByteString)
import Game.Save.Project.Internal (savedIds)
import Game.Save.State (DecodeError, SaveState)
import System.IO (hPutStrLn, stderr)
import Game.World (World)

toSave :: World -> SaveState
toSave = undefined

encode :: SaveState -> ByteString
encode = undefined

decode :: ByteString -> Maybe SaveState
decode = undefined

dumpSave :: SaveState -> IO ()
dumpSave = undefined
