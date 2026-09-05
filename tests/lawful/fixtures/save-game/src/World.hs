-- types 層:遊戲世界的不可變值。
module World
  ( World
  , Entity (..)
  , EntityId (..)
  , mkWorld
  , entities
  , entityCount
  , emptyWorld
  ) where

newtype EntityId = EntityId Int
  deriving (Eq, Ord, Show)

data Entity = Entity
  { entityId :: EntityId
  , posX     :: Double
  , posY     :: Double
  }
  deriving (Eq, Show)

-- | 渲染快取是衍生資料,不進存檔。
data World = World
  { worldEntities :: [Entity]
  , renderCache   :: [Int]
  }
  deriving (Show)

mkWorld :: [Entity] -> World
mkWorld es = World es []

entities :: World -> [Entity]
entities = worldEntities

entityCount :: World -> Int
entityCount = length . worldEntities

emptyWorld :: World
emptyWorld = mkWorld []
