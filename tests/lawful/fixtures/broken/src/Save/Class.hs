-- types 層:class 方法要被當成簽名;instance 底下的與 where 區塊裡的不算。
module Save.Class
  ( Persist (..)
  , (<+>)
  , combine
  ) where

import Data.ByteString (ByteString)
import Save.State (SaveState)

class Persist a where
  persistName :: a -> String
  persistEncode
    :: a
    -> ByteString
  persistPolicy :: a -> Int
  persistPolicy _ = 0

instance Persist SaveState where
  persistName _ = "SaveState"
  persistEncode = undefined

(<+>) :: SaveState -> SaveState -> SaveState
(<+>) = undefined

combine :: [SaveState] -> SaveState
combine = go
  where
    go :: [SaveState] -> SaveState
    go = undefined
