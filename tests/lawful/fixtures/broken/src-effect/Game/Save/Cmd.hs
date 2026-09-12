-- 同一個模組名也出現在 src-core/,編譯期會撞名。
module Game.Save.Cmd
  ( SaveCmd (..)
  ) where

data SaveCmd = Write | Read
