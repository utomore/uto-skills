-- pure 層:P-001-save-game 的觀察點(o 列)。只給 law 看,沒有 production 消費者,所以住 Internal。
module Save.Project.Internal
  ( savedIds
  ) where

import Save.State (SaveState, SavedEntity (..), savedEntities)
import World (EntityId)

savedIds :: SaveState -> [EntityId]
savedIds = map savedId . savedEntities
