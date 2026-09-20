module Game.Save.State
  ( SaveState
  , SavedEntity (..)
  , DecodeError (..)
  , Lane (..)
  , Some (..)
  , mkSaveState
  , savedEntities
  , emptySave
  , route
  , misroute
  , Stamped (..)
  , stampAll
  ) where

import Data.Constraint.Each (Each)
import Data.Proxy (Proxy)
import Data.Tick
  ( Tick
  , firstTick
  )
import Game.World (EntityId)
import Game.FS (writeSave)
import Type.Reflection (SomeTypeRep)

class Each Show ss => Stamped ss where
  stamps :: Proxy ss -> [Int]

stampAll :: Stamped ss => Proxy ss -> Tick -> [Int]
stampAll p _ = stamps p

data Lane = State | Command | Fact
  deriving stock (Eq, Show)

data Some (l :: Lane) where
  Some :: Show m => m -> Some l

route :: SomeTypeRep -> Some 'Command -> Lane
route _ _ = Command

misroute :: Some 'Command -> Lane
misroute _ = Command

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
