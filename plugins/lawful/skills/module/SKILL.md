---
name: module
description: lawful 的模組單元 — 架構先行的那條路線:一條 pipeline 要一個還沒有的模組單元時,先對談出它的名字、職責範圍與有哪幾層(types / effect / core / shell 不一定都有),跑 lawful module 寫進模組表並在每一層的原始碼樹裡開好資料夾,再回去 claim pipeline。觸發詞:模組、新模組、module、模組單元、劃邊界、架構先行、命名空間、加一層、lawful module。Use when a new module unit's name, responsibility and layers must be fixed before any pipeline is written.
user-invocable: true
---

# lawful:module — 一個模組單元

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/boundary.md`「模組單元」「模組表」「四層」、`rules/tooling.md`「CLI」「收尾定錨」。再讀 `.lawful/modules.md` 與 `.lawful/system.md`「語言與工具」「邊界」。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一件還沒有地方放的職責、或一條 pipeline 點名的新模組 | `.lawful/modules.md` 多一列(模組、層、職責),它宣告的每一層在那棵原始碼樹裡多一個資料夾 |

## 前置

- 沒有 `.lawful/system.md` → 停,先 `lawful:design`。
- `system.md`「語言與工具」沒有模組前綴或原始碼根目錄 → 先問開發者這個專案的模組命名空間叫什麼、四層各自的原始碼根目錄怎麼命名(預設 `src-<層>`),寫進那一節。
- 那四個根目錄還不是建置系統的子函式庫 → 先請開發者在建置設定裡各開一個、`build-depends` 照 types ← effect ← core ← shell 宣告;沒有這一步,層的相依方向只有 lint 擋得住,編譯器擋不住。
- 要的東西在既有單元的範圍內 → 不建新單元,直接走 `lawful claim` 與 `lawful:pipeline`;單元裡加簽名不必經過這裡。

## 步驟

1. **看現有的表**:`.lawful/modules.md` 每一列的職責唸一遍,確認要的東西真的不屬於任何一列。屬於某一列就停,回 `lawful:pipeline`。
2. **問名字與範圍**,一題一題:這個單元負責什麼(一句話,寫得進職責欄)?範圍到哪、什麼明確不歸它?名字叫什麼(模組前綴底下一段,kebab 不用,大寫開頭)?名字講職責,不講它被誰用。
3. **問有哪幾層**(`boundary.md`「四層」):
   - **types**:它有自己的型別、標籤或狀態 ADT 嗎?
   - **effect**:它要把一種效果描述成純資料嗎?有描述就配一個純解譯器,也住這層。
   - **core**:它有純轉換要被 pipeline 當 stage 用嗎?
   - **shell**:它自己碰對外 I/O 嗎?只被別人呼叫、不碰 I/O 的單元沒有這層。
   答否的層就不建;層可以之後再補,同一道命令跑第二次就好。
4. **問要不要門面**:別的單元 import 這個單元時,想寫一個名字(`import Weft.Render`)還是直接指到裡面的模組?要一個名字就加 `--facade`,它預設開在最上層(`boundary.md`「模組單元」)。再問這個名字主要給誰用:門面住哪一層,只有那一層以上的消費者 import 得到,所以型別被別人的 types 層大量使用的單元寫 `--facade types`,真解譯器給 `Main` 接的寫 `--facade shell`。
5. **建**:`lawful module <名稱> --layers <逗號分隔> --responsibility <一句話> [--facade [層]]`。先 `--dry-run` 唸給開發者聽會在哪幾棵樹裡開資料夾、門面建在哪,說好再跑一次不帶 `--dry-run`。資料夾裡除了門面不放模組:要幾個檔、叫什麼名字由 pipeline 的 Stages 決定。
6. **對帳**:`lawful lint boundary`。職責欄空的、單元巢狀會紅;宣告了層還沒有程式碼是架構先行的常態,只會列成訊息。
7. **接回 pipeline**:這個單元是為了哪條資料流而劃的,就 `lawful claim <slug> --milestone <M-n>` 建 pipeline,內容交給 `lawful:pipeline`。

## 收尾

回報單元全名、層幾個(各哪幾層)、職責一句、開了哪幾個資料夾、門面在哪一層(沒有就說沒有)、`lint boundary` 的結果;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律是 `lawful claim <slug> --milestone <M-n>` 或 `lawful:pipeline <全名>`:模組單元自己不是可交付的東西,它要有一條 pipeline 走過才算數。

## 邊界

不寫任何簽名、型別或實作;除了 `--facade` 那個空門面不建任何模組檔;不改建置設定,只講要加哪幾行。裡面有什麼由 pipeline 的 Stages 長出來。不動既有單元的職責與範圍(要動走 `lawful:revise`)。不替開發者決定名字與層。
