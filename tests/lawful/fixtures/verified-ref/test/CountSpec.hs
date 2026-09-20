module CountSpec (spec) where

import App.Count (count, tokens)
import qualified Data.Text as T
import Test.Hspec
import Test.QuickCheck

genText :: Gen T.Text
genText = T.pack <$> resize 200 (listOf (elements " ab"))

spec :: Spec
spec = do
  describe "P-002#LAW-1" $
    it "count t == length (tokens t)" $
      withMaxSuccess 100 $ forAll genText $ \t -> count t == length (tokens t)

  describe "P-002#EX-1" $
    it "count \"\" == 0" $
      count T.empty `shouldBe` 0
