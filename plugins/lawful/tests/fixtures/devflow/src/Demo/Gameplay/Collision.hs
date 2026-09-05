module Demo.Gameplay.Collision
  ( Collider (..)
  , SolidLayer (..)
  , resolveMove
  , scanFast
  ) where

import Demo.Types

data Collider = Collider { colBox :: Rect, colSolid :: Bool }

newtype SolidLayer = SolidLayer Text

resolveMove :: MapStatic -> SolidLayer -> [(EntityId, Rect)] -> EntityId -> Rect -> Vec2 -> Vec2
resolveMove = undefined

scanFast :: MapStatic -> [Coord]
scanFast = undefined
