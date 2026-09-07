---
name: spike
description: dev-flow 的可行性驗證 — 讀原始碼答不出來、要跑了才知道的問題,先寫問題 / 判準 / timebox,再在專案根目錄的 spike/SPK-00x-<slug>/ 寫拋棄式程式碼驗證,結論寫進 .design/spikes/ 並用 feeds 指向下游文檔;結案即刪程式碼、sha 留在文檔。觸發詞:spike、可行性驗證、試一下、驗證可不可行、PoC、prototype、原型、快速驗證、跑跑看。Use when a design decision cannot be answered by reading code and needs throwaway experimental code with a recorded verdict.
user-invocable: true
---

# dev-flow:spike — 生產證據

## 讀什麼

`rules/features.md`「spike」、`rules/roles.md`「委派」「spike」、`rules/tooling.md`「跑東西的紀律」。

## 前置

三題自問,任一答否就不派 spike:讀原始碼與文件真的答不出來嗎?判準寫得成可觀察的數字或現象嗎?結論要餵給哪份文檔的哪一格?

「impl 有沒有做到文檔」是跑測試就能答的;「這條 law 該怎麼寫」是設計的事。兩者都不派。

## 步驟

1. **建檔**:`devflow claim spike <slug> --description <句>`,它同時建出 `spike/SPK-00x-<slug>/`。候選比較就在底下開子資料夾,一個候選一個。
2. **寫 `## 問題`**:要回答什麼(可判定的形式)、為什麼讀原始碼答不出來、判準(feasible / infeasible / partial 各寫成可觀察的數字或現象)、timebox。**先寫這四樣再寫程式碼。**
3. **每一輪 `RND-n`**:先寫這輪要驗什麼、判準、timebox,再寫程式碼;跑完寫結果(對每條判準的觀察)、commit 拿 sha 填進去、環境(資料量、外部服務、額外裝了什麼)。timebox 到了就收,partial 也是答案。
4. **結論**:verdict、一句話、學到什麼(三個月後再試之前要先知道的事)、餵給哪裡(`feeds` 寫全名)、沒驗到的。
5. **結案**:`status: concluded`,`devflow spike close SPK-00x --dry-run` 看一遍再不帶旗標跑一次,資料夾刪掉、sha 留在文檔。程式碼用 `git show <sha>:spike/SPK-00x-<slug>/<檔>` 撈得回來。
6. **不會有結論的**刪檔與資料夾。

## 收尾

回報 verdict、每條判準的觀察、餵給哪份文檔的哪一格;附定錨區塊。下一步是把結論落地的那個 skill(`dev-flow:revise` 或 `dev-flow:feature`)。

## 邊界

**verdict 不是裁決**:spike 生產證據,契約怎麼改仍走 `dev-flow:revise`。程式碼只寫在自己的資料夾,產品程式碼與測試在 open 期間禁止 import 它;不動專案的套件管理檔。委派模式下不寫任何 `.design/` 文檔,四樣結果寫進回報由 conductor 寫檔。
