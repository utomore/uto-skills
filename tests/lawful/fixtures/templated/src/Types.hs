-- types 層:一個字。
module Types
  ( Token (..)
  ) where

import Data.Text (Text)

newtype Token = Token Text
  deriving (Eq, Show)
