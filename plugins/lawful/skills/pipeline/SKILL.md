---
name: pipeline
description: lawful 的 pipeline 設計 — 一次一條,與開發者對談出 Brief、Stages(簽名、模組、層)、形式化 laws、examples 與決定,把型別與每條簽名的骨架寫進程式碼;lint laws 與 lint sig 過了、開發者拍板,改 ready。觸發詞:設計 pipeline、寫 pipeline、lawful pipeline、寫 law、定簽名、規格、spec。Use when specifying one data-flow pipeline with laws before any code is written.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:pipeline — 一條 pipeline

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief pipeline --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief pipeline --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief pipeline --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief pipeline --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief pipeline --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief pipeline --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief pipeline` 的輸出:規章、分支與工作樹、目標 pipeline 全文與逐條狀態、它朝向哪條里程碑與那條需求的 Law、`Cone.md`「專案約束」、`modules.md` 全文、types 層每個模組的匯出、它引用的 pipeline 的 Stages 表與引用它的那幾列、`lint sig` 與 `lint laws` 裡講到它的;沒給目標時是 `Cone.md` 全文、每個目標檔、`modules.md` 與 types 層的匯出。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:pipeline 全名 `P-00x-<slug>`;還沒 claim 就不給,claim 之後再跑一次。上面寫「目標未指定」就先定出目標,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief pipeline <目標> --no-rules`;同一場裡目標文檔或專案現況變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一條 pipeline 的全名(沒有就 `lawful claim <slug> --kind <IO 介面 \| 子流> --milestone <M-n>`,slug 是 `<領域名詞>-<動詞>`,領域名詞是 `=` 列會住的模組單元)、開發者的意圖 | 該 pipeline 檔六節寫齊,`kind` 填了,`status: ready`;骨架:型別與每條簽名在程式碼裡,本體是 `stub` |

## 前置

- 願景還是模板、`Cone.md` 一條需求都沒有、或 `objectives/` 一個目標都沒有 → 停,先跑 `lawful:design` 或 `lawful:objective`。
- 這條 pipeline 沒有被任何里程碑綁定 → 先問開發者它服務哪個目標的哪條里程碑,`lawful:objective` 綁進去;答不出來就是不該做的資料流,停。
- Stages 要用的模組單元 `.lawful/modules.md` 上沒有 → 先 `lawful:module` 把它的名字、職責與層劃出來,再回來;既有單元裡加簽名不必經過那裡。
- 從與 origin 同步、工作樹乾淨的主線開 `design/<全名>`(`git switch -c`;剛 claim 的新檔跟著過去),之後每一步都在這條分支上(`roles.md`「分支與所有權」)。

## 步驟

1. **Brief**:問清楚 input 是什麼、output 是什麼、它是 IO 介面還是哪條 IO 介面的子流(frontmatter 的 `kind` 照答案填)、它讓哪條里程碑往前一步、那條里程碑的目標服務哪條需求的 Law;三到五句寫下,用 `→` 串 stage 的中文名。
2. **Stages,從 output 往回推**:每一步一條簽名,逐字寫成程式碼會長的樣子;模組欄寫模組名(不寫層,層在資料夾上),層欄要是那個模組單元在模組表上宣告過的層。`=` 列是純的整條:把純的步驟組成一個 core 或 effect 層的值;IO 介面再加一列 `!`,shell 的進入點,把 `=` 列接到對外 I/O。只有資料流的步驟才是數字列。引用別條 pipeline 的 stage 照抄簽名並註明「見」。**stage 之間傳遞的值,現在就定型別**:有名字、建構子與欄位講得出來(`pipelines.md`「節」的 Stages 說明)。types 層已經有的直接用;沒有的,這一步就是它出生的地方,跟開發者把每個欄位問清楚。定不下來的型別就是還沒討論完的設計,pipeline 留在 `draft`。
3. **Laws,先過「什麼要有 law」的兩問**(是不是 stage、型別留下幾個自由度),再照種類問法表逐種問(`pipelines.md`「節」的 Laws 表):做完什麼一定不變、什麼輸入等於沒做、存出去要不要一模一樣讀回來、兩步的輸出有什麼對應、哪個數字有上限、有沒有慢但一定對的寫法、哪些輸入看起來合法卻會爆、順序對調一不一樣。`=` 列至少一條端到端的 law。需求的 Law 寫了三行而識別字是這條 pipeline 的簽名,`=` 列的 law 要撐得起它:需求 Law 講的性質這裡沒有對應的 law,就是漏了。每條三行,純 ASCII,`|-` 只引用 Stages 的簽名(不含 `!` 列)、types 層匯出與字面值。問出來的「哪些欄位不算」「怎麼看得到這個量」這種答案,是一個觀察點(投影、存取子、判定):當場加成 `o` 列,住 `*.Internal` 或它本來的模組;它是資料流的一步才加成數字列。`=` 列是效果描述時,觀察點是它的純解譯器(`boundary.md`「效果的判定」),law 拿純解譯器的結果寫。
4. **Examples**:每條 law 至少一個具體例子,邊界值優先;覆蓋欄指到 law。
5. **決定**:對談中否決掉的替代方案,一句結論、一句理由;要證據的派 `lawful:spike`,結論回來再寫。
6. **骨架**(`roles.md`「骨架與基線」):第 2 步定下的型別宣告與每條簽名寫進 Stages 表模組欄指的模組並匯出,本體是 `stub`(Haskell `error "P-00x#name stub"`);`=` 列照 Stages 組裝純的整條,`!` 列把它接到 shell。程式碼已經有的照舊。跑 `Cone.md`「專案約束」的建置指令,編得過。
7. **對帳**:`lawful lint laws`、`lawful lint sig`(沒有紅:每列找得到、簽名一致、型別都宣告過),`lawful status --pipeline <全名>` 每列是「骨架」或「在」。紅的回到對應步驟。
8. **拍板**:把 Stages 與 Laws 唸給開發者聽,開發者說好,改 `status: ready`;frontmatter 的 `kind` 還是佔位符就填 IO 介面或子流。pipeline 檔與骨架同一個 commit,訊息帶全名,在 `design/<全名>` 上。

## 收尾

回報 stage 幾條、觀察點幾個、law 幾條、example 幾條、決定幾條、骨架寫了幾條簽名與幾個型別;附定錨區塊。下一步:`lawful:integrate`(發設計 PR),合進主線後 `lawful:build <全名>`;引用的子流還沒有就先 `lawful:pipeline` 那一條。

## 邊界

程式碼只寫宣告:型別、簽名、匯出、`stub`;不寫本體、不寫測試。不動別條 pipeline(要動走 `lawful:revise`)。開發者只說,檔一律由這裡寫。
