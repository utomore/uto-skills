module Demo.Gameplay.Text
  ( localesOf
  , hasLocale
  , localize
  ) where

import Demo.Types

localesOf :: I18nTables -> [LocaleId]
localesOf = undefined

hasLocale :: I18nTables -> LocaleId -> Bool
hasLocale = undefined

-- 簽名與文檔不一致:少了參數表
localize :: I18nTables -> LocaleId -> TextKey -> Text
localize = undefined
