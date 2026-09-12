-- shell 層:P-001-report 的 ! 列。
module App.Report.Main
  ( main
  ) where

import qualified Data.Text.IO as TIO
import App.Report (report)

main :: IO ()
main = TIO.getContents >>= TIO.putStrLn . report
