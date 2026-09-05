module World
  ( World
  , Entity (..)
  , EntityId (..)
  , mkWorld
  , entityCount
  , emptyWorld
  ) where

newtype EntityId = EntityId Int
  deriving (Eq, Ord, Show)

data Entity = Entity { entityId :: EntityId, posX :: Double, posY :: Double }
  deriving (Eq, Show)

data World = World { worldEntities :: [Entity], renderCache :: [Int] }
  deriving (Show)

mkWorld :: [Entity] -> World
mkWorld es = World es []

entityCount :: World -> Int
entityCount = length . worldEntities

emptyWorld :: World
emptyWorld = mkWorld []
