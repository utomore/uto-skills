---
name: require-design
description: dev-flow(有 .design/ 的專案)的需求設計:與開發者一次一條談需求(一句話、驗收、優先 1 到 4),當場切成有順序的里程碑 M-n-<slug>,每條是使用者看得到、展示得出來的階段;之後加需求、改驗收、重排、加調整 RF-n 也走這裡。觸發詞:需求、requirement、驗收、里程碑、milestone、調整、refinement、優先、這個功能為什麼做。Use when adding or reshaping requirements, their acceptance, priorities, milestones and refinements.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:require-design — 需求、里程碑與調整

> **核心**:A Requirement takes shape only in dialogue with the developer; every milestone MUST be a stage the user can see, demo or call.(需求只在與開發者的討論裡成形;每條里程碑是一個使用者看得到、展示得出來或呼叫得到的階段,做不到就再切。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief require-design --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief require-design --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief require-design --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief require-design --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段(一份輸出切成幾段,每段一道指令)是載入 skill 時跑 `devflow brief require-design` 的輸出:規章、`system.md` 全份(願景、優先各級那一行都在裡面)、`requirements/` 底下每個需求檔、status 報告(需求表與警訊)。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給;有最近一次測試輸出就加 `--tests <log>`。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief require-design --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者要得到什麼、既有的需求與 feature | `system.md`「語言與工具」一行優先各級的宣告,以及 `requirements/` 裡一條需求一個檔 `R-n-<slug>.md`:一句話、驗收、優先、照先後排好的里程碑(全名 `M-n-<slug>`,綁定欄填它做出來的 feature,還沒有切片的留「-」);里程碑全部達成的需求可以有調整 `RF-n` |

## 前置

- 沒有 `.design/system.md`、或願景還是模板 → 停,先跑 `dev-flow:kickoff`。
- `devflow status` 警訊說需求不住 `requirements/`、或 `system.md` 沒有「## 全域 Law」區 → 停,回 `dev-flow:kickoff` 的前置處理。
- 開發者講的是一件**沒有做完的一天、永遠要守**的事(金額不為負、內層不准碰 IO)→ 那不是需求,是 law(`laws.md`「Law 與需求」):整個專案都要守的走 `dev-flow:global-laws`;只關一份文檔的,要調整既有的 law 走 `dev-flow:scope-laws`,只是替 `verified` 的文檔新增一條走 `dev-flow:scope-revise`。

## 步驟

需求是**必須達成**的事,有做完的一天;裡面沒有 law,里程碑也不管理約束(`features.md`「願景、需求與里程碑」)。每一題的答案都是開發者說的,不是推的;一次談一條需求,談完一條再談下一條。

1. **優先怎麼分**:`system.md`「語言與工具」要有一行「- 優先:1 = …;2 = …;3 = …;4 = …」宣告各級在這個專案代表什麼(例:1 = 主軸與它的直接前提;2 = 地基;3 = 呈現與存取;4 = 工具與詞彙)。沒有這一行就先跟開發者訂,寫進那一節;有了就照它問。
2. **一句話**:誰在什麼情況下要得到什麼——使用者做得到什麼、或世界變成什麼樣;不寫「做完 X 模組」這種實作句。
3. **驗收**:它達成時什麼一定為真,一句可判定的話(數字、現象、使用者做得到的動作)。寫不出驗收的不是需求,回到第 2 步。程式碼還不在時驗收先只留一句話;切片做出簽名之後,能自動化的由 `dev-flow:scope-laws` 補成三行、build 派 qa 寫歸屬 `R-n#ACCEPT` 的驗收測試(`roles.md`「驗收測試」)。簽名已經在的,當場寫成三行式(識別字是 Steps 的簽名,不含 `!` 列)。
4. **優先**:照第 1 步那行問「這條需求落在哪一級、它的直接前提是誰」;直接前提還不在就先立它。順序來自依賴與必要性,不來自離願景多近,也不來自編號:`R-n` 是流水號,永不重排,只是身分。哪條需求疊在哪條上面不寫進需求檔,由文檔的引用推出來,`devflow status` 需求表的「依賴」欄印它(`features.md`「願景、需求與里程碑」)。
5. **衝突檢查**(新需求、或改了既有需求的驗收,寫檔之前必做):把這條需求的驗收逐條對既有每一條需求的驗收,問「兩者有沒有無法同時達成的」(一條要「送出就成立」,另一條要「審核過才成立」)。
   - **有衝突** → 先攤影響範圍,逐項列,查過而沒有的寫「無」:哪條既有需求的一句話或驗收要改;它的 `R-n#ACCEPT` 驗收測試作廢,要 `dev-flow:build R-n` 重派 qa;哪幾份 feature 的 law 因此要調整(各自走 `dev-flow:scope-laws <全名>`);哪幾條里程碑的那一句要改。再給選項,各附當下成本、之後的代價、可不可逆:**改既有的那一條**、**改新的這一條**、**不收新的**。開發者對著一個選項明確說了要,才落筆;沉默、「你決定」不算。選了「改既有的那一條」,那一條照第 10 步改,它牽動的 law 列成給開發者的下一步,不在這裡動。
   - **沒有衝突** → 在回報裡寫一句「與 R-x…R-y 逐條對過,無衝突」,寫明對過哪幾條。
6. **寫需求**:`devflow requirement add <slug> "<一句話>" --priority <1-4> [--accept "<句>"]`,slug 是 kebab-case 英文、講這條需求要得到什麼,檔名就是 `requirements/R-n-<slug>.md`。
7. **當場切里程碑**:問「達成這條需求,使用者會依序看到哪幾個階段」。每一條都是一個**明確的階段性使用者驗收**:使用者看得到這個階段的成果,可以展示、或呼叫這個階段的功能;「做到什麼」那一句就是展示得出來的那一句(之後切片決策紀錄的「Entry」就是展示它的那道指令)。講不出怎麼展示的(「資料層做好」「重構完」)不是里程碑,併進看得到成果的那一條。**一條里程碑仍是一條垂直切片的範圍**:從一個對外入口貫通到出口;大到一次貫通不了就再切。照先後排,每條給一個 kebab-case 英文名,`devflow requirement milestone <R-n> <slug> "<一句話>"`,表上的第一格是全名 `M-n-<slug>`,切片的分支 `build/M-n-<slug>` 與決策紀錄以它為鍵;`status` 警訊列出沒有英文名的里程碑,把第一格補成全名。綁定欄留「-」:feature 在切片做完之後由 `dev-flow:scope-laws` claim 出來填進去,一條里程碑可以綁好幾份;要撐它的 feature 已經存在、而且已經做到這個階段,才在這裡 `--bind <F-00x-<slug>,…>`。**里程碑只綁 feature**。
   - **里程碑可以綁既有的 feature**(`features.md`「願景、需求與里程碑」):這個階段不做出新的 feature、是靠修訂既有的 feature 做到的(整個專案的資料儲存換成資料庫,「訂單重啟後還在」靠修訂 `F-001-checkout` 達成)→ 跟開發者講定是哪一份,綁定欄仍留「-」:那份 feature 現在是 `verified`,先綁上去這條里程碑會被算成已經達成。綁定欄由做修訂的 skill 在重開那份文檔的同一個動作填上;回報裡把下一步寫好:`dev-flow:scope-revise <全名>`(既有的 law 不動,新的承諾用新增的 law 表達)或 `dev-flow:scope-laws <全名>`(要調整既有的 law),來源寫這條 `M-n-<slug>`。需求寫的是誰得到什麼(重啟後資料不遺失);用哪個資料庫是決定(ADR)加上全域 Law 的變更(`dev-flow:global-laws`),不寫進需求。
   - **依序,一次一條**:里程碑有順序、依序完成,全部達成,這條需求的建置就走完。一條需求一次只開它下一條還沒達成的里程碑;開發者要兩條線同時開工,那兩條線屬於不同、而且互不依賴的需求——一條需求裡需要平行,就拆成兩條需求;有依賴的,後面那條被前面那條擋住。
   - `status` 說里程碑全部達成而驗收沒過,是里程碑切漏了或驗收寫錯,回到這一步或第 3 步。
8. **調整**:這條需求的里程碑全部達成之後,開發者要改既有 feature 的實作或行為品質(效能、大小、訊息、演算法)才開:一句「做到什麼」,`devflow requirement refinement <R-n> "<一句話>" --touch <F-00x-<slug>,…>`;動到的只能是這條需求的里程碑綁定過的 feature,要新能力就開里程碑,不開調整。每條調整之後需求仍要達成。調整的落地預設走 `dev-flow:scope-revise <它動到的全名>`(既有的 law 不動,需要新的 law 就在那裡新增;REV 的依欄引用 `RF-n`),它再接上 `dev-flow:build` 做回 `verified`;要調整既有的 law 才做得到的調整,整件走 `dev-flow:scope-laws <它動到的全名>`。
9. **把沒被綁定的 feature 收進里程碑**:`devflow status` 列出沒有被任何里程碑綁定的 feature,逐份問「它讓哪條需求的哪條里程碑看得到成果」:有就在綁定欄補上全名;沒有就問開發者要不要留,不留就走文檔退役,`dev-flow:scope-laws <全名>`(`features.md`「修訂(REV)」),不在這裡刪檔。
10. **重排與修改**:開發者改優先或里程碑順序,直接改需求檔 frontmatter 的 `priority` 或里程碑表的列序;改一句話或驗收就改那一行(`updated` 改成今天)。編號不動、不重鑄;刪掉的需求、里程碑與調整號永久空缺。驗收已經有 `R-n#ACCEPT` 測試而那一句或三行變了,它的測試作廢,告訴開發者下一步是 `dev-flow:build R-n` 重派 qa。
11. `devflow status`、`devflow lint laws`:需求表與警訊裡跟需求面有關的全部清掉才收(優先各級有宣告、每條需求有合法的優先、有里程碑、驗收不是模板、里程碑有英文名、綁定的 feature 都存在、調整只動里程碑綁過的、沒有 feature 不朝向需求)。還沒有切片的里程碑與待修訂的調整不是警訊。變更 commit。

## 收尾

回報需求幾條(各自的一句話、驗收、優先、依賴哪幾條、里程碑達成幾條;達成與否)、衝突檢查的結果(「與 R-x…R-y 逐條對過,無衝突」,或哪兩條衝突、影響範圍、開發者選了哪個選項)、里程碑幾條(各自的全名與展示得出來的那一句、幾條還沒有切片)、調整幾條(各什麼狀態)、綁了哪些 feature、哪些 feature 沒有被綁定;附定錨區塊(`tooling.md`「收尾定錨」)。

`system.md`「全域 Law」三個小區還是模板 → 直接執行 `dev-flow:global-laws` 定全域 Law 三區,不等開發者另外下指令。三區都定了,下一步一律從最高優先的需求第一條沒達成的里程碑推:還沒有切片 → 變更先 `dev-flow:integrate`(`plan/<slug>`)合進主線,再 `dev-flow:spike-impl <M-n-slug>`(靠修訂既有的 feature 達成、沒有新的一段要貫通的,直接 `dev-flow:scope-revise <全名>` 或 `dev-flow:scope-laws <全名>`,來源寫這條 `M-n-<slug>`);切片做完還沒有文檔或文檔還是 draft → `dev-flow:scope-laws <M-n-slug>`;已 ready → `dev-flow:build <M-n-slug>`;里程碑都達成而有待修訂的調整,`dev-flow:scope-revise <它動到的全名>`(要調整既有的 law 才做得到的,整件走 `dev-flow:scope-laws`)。

## 邊界

需求只准透過這裡寫:一句話、驗收、優先、里程碑與調整都不由別的 skill 改(`dev-flow:scope-laws` 只把既有的驗收那一句寫成三行、填自己那條里程碑的綁定欄)。不寫 feature 的 Steps 與 laws;不寫程式碼;不改願景(`dev-flow:kickoff`),不碰「全域 Law」區(`dev-flow:global-laws`),只在「語言與工具」補優先那一行;里程碑不帶 law、不帶測試標記;不替開發者答任何一題。開發者只說,檔一律由這裡寫;配號只走 CLI。
