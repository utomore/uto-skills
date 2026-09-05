module Demo.Types where

data Rect = Rect Double Double Double Double
data Vec2 = Vec2 Double Double
data Coord = Coord Int Int
newtype EntityId = EntityId Int
data MapStatic = MapStatic
newtype LocaleId = LocaleId Text
newtype TextKey = TextKey Text
newtype I18nTables = I18nTables [(LocaleId, [(TextKey, Text)])]
type Text = String
