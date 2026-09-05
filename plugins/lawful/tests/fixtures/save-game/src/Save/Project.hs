-- pure 層:P-001-save-game stage 1。
module Save.Project
  ( toSave
  ) where

import Save.State (SaveState)
import World (World)

toSave :: World -> SaveState
toSave = undefined
