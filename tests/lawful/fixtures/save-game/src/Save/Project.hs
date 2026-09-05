-- pure 層:P-001-save-game stage 1。本體是 conductor 寫的骨架。
module Save.Project
  ( toSave
  ) where

import Save.State (SaveState)
import World (World)

toSave :: World -> SaveState
toSave = error "P-001#toSave stub"
