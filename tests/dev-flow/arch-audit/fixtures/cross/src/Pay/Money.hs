module Pay.Money (Money) where
data Money = Money { amount :: Fixed E2, currency :: Text }
