---
name: module
description: lawful 的模組單元 — 立案時、或 lawful:spike-impl 途中切片要一個還沒有的模組單元(或既有單元還沒宣告的那一層)時,先對談出它的名字、職責範圍與有哪幾層(types / effect / core / shell 不一定都有),跑 lawful module 寫進模組表並在每一層的原始碼樹裡開好資料夾,再回去繼續切片。觸發詞:模組、新模組、module、模組單元、劃邊界、命名空間、加一層、lawful module。Use when a new module unit's name, responsibility and layers must be fixed before code moves into it.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:module — 一個模組單元

> **核心**:A module unit fixes a name, a responsibility and its layers, nothing else; what lives inside grows out of the slice.(一個模組單元只定名字、職責與有哪幾層;裡面有什麼由切片長出來。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief module --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief module --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief module --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief module --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief module --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief module --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief module` 的輸出:規章、`Cone.md`「專案約束」、`modules.md` 全文、`lint boundary` 的結果。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief module --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一件還沒有地方放的職責:立案時看得出來的單元,或切片途中要放新模組卻沒有單元(或單元沒宣告那一層) | `.lawful/modules.md` 多一列(模組、層、職責)或既有那一列補上缺的層,它宣告的每一層在那棵原始碼樹裡多一個資料夾 |

## 前置

- 沒有 `.lawful/Cone.md` → 停,先 `lawful:project`。
- `Cone.md`「專案約束」沒有模組前綴或原始碼根目錄 → 先問開發者這個專案的模組命名空間叫什麼、四層各自的原始碼根目錄怎麼命名(預設 `src-<層>`),寫進那一節。
- 那四個根目錄還不是建置系統的子函式庫 → 先請開發者在建置設定裡各開一個、`build-depends` 照 types ← effect ← core ← shell 宣告;沒有這一步,層的相依方向只有 lint 擋得住,編譯器擋不住。
- 要的東西在既有單元的範圍內、那一層也宣告過 → 不建新單元,直接把模組寫進去;單元裡加模組不必經過這裡。
- 在哪做:立案時在主線的工作目錄(之後由 `lawful:integrate` 帶上 `plan/<slug>`);切片途中就在那條 `build/M-n-<slug>` 的工作樹上,`modules.md` 的這一列屬於這條分支(`roles.md`「分支與所有權」)。

## 步驟

1. **看現有的表**:`.lawful/modules.md` 每一列的職責唸一遍,確認要的東西真的不屬於任何一列。屬於某一列、只是少一層 → 第 5 步只補層。
2. **問名字與範圍**,一題一題:這個單元負責什麼(一句話,寫得進職責欄)?範圍到哪、什麼明確不歸它?名字叫什麼(模組前綴底下一段,kebab 不用,大寫開頭)?名字講職責,不講它被誰用。
3. **問有哪幾層**(`boundary.md`「四層」):
   - **types**:它有自己的型別、標籤或狀態 ADT 嗎?
   - **effect**:它要把一種效果描述成純資料嗎?有描述就配一個純解譯器,也住這層。
   - **core**:它有純轉換要被 pipeline 當 stage 用嗎?
   - **shell**:它自己碰對外 I/O 嗎?只被別人呼叫、不碰 I/O 的單元沒有這層。
   答否的層就不建;層可以之後再補,同一道命令跑第二次就好。
4. **問要不要門面**:別的單元 import 這個單元時,想寫一個名字(`import Weft.Render`)還是直接指到裡面的模組?要一個名字就加 `--facade`,它預設開在最上層(`boundary.md`「模組單元」)。再問這個名字主要給誰用:門面住哪一層,只有那一層以上的消費者 import 得到,所以型別被別人的 types 層大量使用的單元寫 `--facade types`,真解譯器給 `Main` 接的寫 `--facade shell`。
5. **建**:`lawful module <名稱> --layers <逗號分隔> --responsibility <一句話> [--facade [層]]`。先 `--dry-run` 唸給開發者聽會在哪幾棵樹裡開資料夾、門面建在哪,說好再跑一次不帶 `--dry-run`。資料夾裡除了門面不放模組:要幾個檔、叫什麼名字由切片決定。
6. **對帳**:`lawful lint boundary`。職責欄空的、單元巢狀會紅;宣告了層還沒有程式碼是常態,只會列成訊息。
7. **接回去**:切片途中劃的,回 `lawful:spike-impl` 繼續把模組寫進去,決策紀錄「Touched」記這個新單元;立案時劃的,回 `lawful:project` / `lawful:objective`。

## 收尾

回報單元全名、層幾個(各哪幾層)、職責一句、開了哪幾個資料夾、門面在哪一層(沒有就說沒有)、`lint boundary` 的結果;附定錨區塊(`tooling.md`「收尾定錨」)。下一步:切片途中是回到那條 `lawful:spike-impl <M-n-slug>`;立案時是 `lawful:integrate`(`plan/<slug>`)再 `lawful:spike-impl`。模組單元自己不是可交付的東西,它要有一條切片住進去、一條 pipeline 走過才算數。

## 邊界

不寫任何簽名、型別或實作;除了 `--facade` 那個空門面不建任何模組檔;不改建置設定,只講要加哪幾行。裡面有什麼由切片長出來、由 pipeline 的 Stages 記下來。不動既有單元的職責與範圍(要動走 `lawful:revise`)。不替開發者決定名字與層。
