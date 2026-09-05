-- types 層:可存檔的投影。
module Save.State
  ( SaveState
  , SavedEntity (..)
  , DecodeError (..)
  , mkSaveState
  , savedEntities
  , emptySave
  ) where

import World (EntityId)

data SavedEntity = SavedEntity
  { savedId :: EntityId
  , savedX  :: Double
  , savedY  :: Double
  }
  deriving (Eq, Show)

newtype SaveState = SaveState
  { savedEntities :: [SavedEntity]
  }
  deriving (Eq, Show)

data DecodeError
  = EmptyInput
  | Malformed String
  deriving (Eq, Show)

mkSaveState :: [SavedEntity] -> SaveState
mkSaveState = SaveState

emptySave :: SaveState
emptySave = SaveState []
