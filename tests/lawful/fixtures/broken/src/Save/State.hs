module Save.State
  ( SaveState
  , SavedEntity (..)
  , DecodeError (..)
  , mkSaveState
  , savedEntities
  , emptySave
  ) where

import World (EntityId)
import Host.FS (writeSave)

data SavedEntity = SavedEntity { savedId :: EntityId, savedX :: Double, savedY :: Double }
  deriving (Eq, Show)

data SaveState = SaveState { savedEntities :: [SavedEntity], savedDropped :: [(String, Int)], savedTag :: Maybe (Int, Int) }
  deriving (Eq, Show)

data DecodeError = EmptyInput | Malformed String
  deriving (Eq, Show)

mkSaveState :: [SavedEntity] -> SaveState
mkSaveState = SaveState

emptySave :: SaveState
emptySave = SaveState []
