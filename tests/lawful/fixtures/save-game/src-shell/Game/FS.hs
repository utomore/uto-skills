-- shell 層:P-001-save-game stage 4。
module Game.FS
  ( writeSave
  ) where

import Data.ByteString (ByteString)
import System.IO ()

writeSave :: FilePath -> ByteString -> IO ()
writeSave = undefined
