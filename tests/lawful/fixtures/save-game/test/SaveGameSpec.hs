module SaveGameSpec (spec) where

import qualified Data.ByteString as BS
import Data.List (nub)
import Save.Codec (decode, encode)
import Save.Project (toSave)
import Save.Project.Internal (savedIds)
import Save.State
import Test.Hspec
import Test.QuickCheck
import World

genEntity :: Gen Entity
genEntity = Entity <$> (EntityId <$> choose (0, 10000)) <*> arbitrary <*> arbitrary

genWorld :: Gen World
genWorld = mkWorld <$> resize 200 (listOf genEntity)

genSaveState :: Gen SaveState
genSaveState = mkSaveState <$> resize 200 (listOf genSaved)
  where
    genSaved = SavedEntity <$> (EntityId <$> choose (0, 10000)) <*> arbitrary <*> arbitrary

limited :: Testable prop => prop -> Property
limited = withMaxSuccess 100 . property

spec :: Spec
spec = do
  describe "P-001#LAW-1" $
    it "decode (encode s) == Right s" $
      limited $ forAll genSaveState $ \s -> decode (encode s) == Right s

  describe "P-001#LAW-2" $
    it "length (savedEntities (toSave w)) == entityCount w" $
      limited $ forAll genWorld $ \w -> length (savedEntities (toSave w)) == entityCount w

  describe "P-001#LAW-3" $
    it "length (encode s) <= 64 + 128 * length (savedEntities s)" $
      limited $ forAll genSaveState $ \s ->
        BS.length (encode s) <= 64 + 128 * length (savedEntities s)

  describe "P-001#LAW-4" $
    it "nub (savedIds (toSave w)) == savedIds (toSave w)" $
      limited $ forAll genWorld $ \w -> nub (savedIds (toSave w)) == savedIds (toSave w)

  describe "P-001#EX-1" $
    it "decode \"\" == Left EmptyInput" $
      decode BS.empty `shouldBe` Left EmptyInput

  describe "P-001#EX-2" $
    it "toSave emptyWorld == emptySave" $
      toSave emptyWorld `shouldBe` emptySave
