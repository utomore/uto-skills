-- core 層:P-002-count-tally 的 stage 1 與 = 列。
module App.Count
  ( tokens
  , count
  ) where

import Data.Text (Text)
import qualified Data.Text as T
import App.Token (Token (..))

tokens :: Text -> [Token]
tokens = map Token . T.words

count :: Text -> Int
count = length . tokens
