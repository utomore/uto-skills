-- *.Internal:只准 Save.Project 自己與測試 import;Save.Codec import 它要紅。
module Save.Project.Internal
  ( savedIds
  ) where

import Save.State (SaveState, SavedEntity (..), savedEntities)
import World (EntityId)

savedIds :: SaveState -> [EntityId]
savedIds = map savedId . savedEntities
