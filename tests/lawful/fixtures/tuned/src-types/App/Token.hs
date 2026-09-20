-- types 層:一個字。
module App.Token
  ( Token (..)
  ) where

import Data.Text (Text)

newtype Token = Token Text
  deriving (Eq, Show)
