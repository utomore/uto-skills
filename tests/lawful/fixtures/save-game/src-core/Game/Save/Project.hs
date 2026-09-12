-- core 層:P-001-save-game stage 1。本體是 conductor 寫的骨架。
module Game.Save.Project
  ( toSave
  ) where

import Game.Save.State (SaveState)
import Game.World (World)

toSave :: World -> SaveState
toSave = error "P-001#toSave stub"
