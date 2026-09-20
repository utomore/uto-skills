---
name: require-design
description: lawful(有 .lawful/ 的 Haskell 專案)的需求設計:與開發者一次一條談需求(一句話、驗收、優先 1 到 4),當場切成有順序的里程碑 M-n-<slug>,每條是使用者看得到、展示得出來的階段;之後加需求、改驗收、重排、加調整 RF-n 也走這裡。觸發詞:需求、requirement、驗收、里程碑、milestone、調整、refinement、優先、這條 pipeline 為什麼做。Use when adding or reshaping requirements, their acceptance, priorities, milestones and refinements.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:require-design — 需求、里程碑與調整

> **核心**:A Requirement takes shape only in dialogue with the developer; every milestone MUST be a stage the user can see, demo or call.(需求只在與開發者的討論裡成形;每條里程碑是一個使用者看得到、展示得出來或呼叫得到的階段,做不到就再切。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief require-design --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief require-design --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief require-design --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief require-design --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief require-design --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief require-design --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief require-design` 的輸出:規章、`Cone.md` 全文(願景、優先各級那一行都在裡面)、`requirements/` 底下每個需求檔全文、`lawful status` 的需求表、全域 Law、等決定、警訊與建議路線。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給;要談的是某一條既有的需求就給 `R-n`;有最近一次測試輸出就加 `--tests <log>`。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief require-design --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者要得到什麼、既有的需求與 pipeline | `Cone.md`「專案約束」一行優先各級的宣告,以及 `requirements/` 裡一條需求一個檔 `R-n-<slug>.md`:一句話、驗收、優先、照先後排好的里程碑(全名 `M-n-<slug>`,綁定欄填它做出來的 pipeline,還沒有切片的留「-」);里程碑全部達成的需求可以有調整 `RF-n` |

## 前置

- 沒有 `.lawful/Cone.md`、或願景還是模板 → 停,先跑 `lawful:kickoff`。
- `lawful status` 警訊說 `Cone.md` 不存在、需求不住 `requirements/`、或 `Cone.md` 沒有「## 全域 Law」區 → 停,回 `lawful:kickoff` 的前置處理。
- 開發者講的是一件**沒有做完的一天、永遠要守**的事(實體 id 不重複、core 不准碰 IO)→ 那不是需求,是 law(`laws.md`「Law 與需求」):整個專案都要守的走 `lawful:global-laws`;只關一條 pipeline 的,要調整(修改、放寬、替換、刪除)既有的 law 走 `lawful:scope-laws`,既有的 law 不動、只是替 `verified` 的 pipeline 新增一條走 `lawful:scope-revise`。需求面的條目(需求、驗收、優先、里程碑、調整)才在這裡。
- 開發者要的是「一條資料流」而不是「誰要得到什麼」→ 那是一條里程碑的範圍:這裡先問出它讓哪條需求的使用者看得到什麼、切成里程碑,再 `lawful:spike-impl <M-n-slug>` 做出切片、`lawful:scope-laws` 談出 pipeline。

## 步驟

需求是**必須達成**的事,有做完的一天;裡面沒有 law,里程碑也不管理約束(`pipelines.md`「願景、需求與里程碑」)。每一題的答案都是開發者說的,不是推的;一次談一條需求,談完一條再談下一條。

1. **優先怎麼分**:`Cone.md`「專案約束」要有一行「- 優先:1 = …;2 = …;3 = …;4 = …」宣告各級在這個專案代表什麼(例:1 = 主軸與它的直接前提;2 = 地基;3 = 呈現與存取;4 = 工具與詞彙)。沒有這一行、或還是模板就先跟開發者訂,寫進那一節;有了就照它問。
2. **一句話**:誰在什麼情況下要得到什麼——使用者做得到什麼、或世界變成什麼樣;不寫「做完 X 模組」這種實作句。
3. **驗收**:它達成時什麼一定為真,一句可判定的話(數字、現象、使用者做得到的動作)。寫不出驗收的不是需求,回到第 2 步。程式碼還不在時驗收先只留一句話;切片做出簽名之後,能自動化的由 `lawful:scope-laws` 補成三行、build 派 qa 寫歸屬 `R-n#ACCEPT` 的驗收測試(`roles.md`「驗收測試」)。簽名已經在的,當場寫成三行式(識別字是任何一條 pipeline 的 Stages 簽名或 types 層的匯出,不含 `!` 列)。
4. **優先**:照第 1 步那行問「這條需求落在哪一級、它的直接前提是誰」;直接前提還不在就先立它。順序來自依賴與必要性,不來自離願景多近,也不來自編號:`R-n` 是流水號,永不重排,只是身分。哪條需求疊在哪條上面不寫進需求檔,由 pipeline 的引用推出來,`lawful status` 需求表的「依賴」欄印它(`pipelines.md`「願景、需求與里程碑」)。
5. **衝突檢查**(新需求、或改了既有需求的驗收,寫檔之前必做):把這條需求的驗收逐條對既有每一條需求的驗收,問「兩者有沒有無法同時達成的」(一條要「存檔一按就寫完」,另一條要「存檔要玩家確認過才寫」)。
   - **有衝突** → 先攤影響範圍,逐項列,查過而沒有的寫「無」:哪條既有需求的一句話或驗收要改;它的 `R-n#ACCEPT` 驗收測試作廢,要 `lawful:build R-n` 重派 qa;哪幾條 pipeline 的 law 因此要調整(各自走 `lawful:scope-laws <全名>`);哪幾條里程碑的那一句要改。再給選項,各附當下成本、之後的代價、可不可逆:**改既有的那一條**、**改新的這一條**、**不收新的**。開發者對著一個選項明確說了要,才落筆;沉默、「你決定」不算。選了「改既有的那一條」,那一條照第 10 步改,它牽動的 law 列成給開發者的下一步,不在這裡動。
   - **沒有衝突** → 在回報裡寫一句「與 R-x…R-y 逐條對過,無衝突」,寫明對過哪幾條。
6. **寫需求**:`lawful requirement add <slug> "<一句話>" --priority <1-4> [--accept "<句>"]`,slug 是 kebab-case 英文、講這條需求要得到什麼,檔名就是 `requirements/R-n-<slug>.md`。
7. **當場切里程碑**:問「達成這條需求,使用者會依序看到哪幾個階段」。每一條都是一個**明確的階段性使用者驗收**:使用者看得到這個階段的成果,可以展示、或呼叫這個階段的功能;「做到什麼」那一句就是展示得出來的那一句(之後切片決策紀錄的「Entry」就是展示它的那道指令)。講不出怎麼展示的(「types 層做好」「重構完」)不是里程碑,併進看得到成果的那一條。**一條里程碑仍是一條垂直切片的範圍**:從 shell 的一個進入點貫通到出口;大到一次貫通不了就再切。照先後排,每條給一個 kebab-case 英文名,`lawful requirement milestone <R-n> <slug> "<一句話>"`,表上的第一格是全名 `M-n-<slug>`,切片的分支 `build/M-n-<slug>` 與決策紀錄以它為鍵;`status` 警訊列出沒有英文名的里程碑,把第一格補成全名。綁定欄留「-」:pipeline 在切片做完之後由 `lawful:scope-laws` claim 出來填進去,一條里程碑可以綁好幾條(一條 io pipeline 與同一條切片做出來的 subflow);要撐它的 pipeline 已經存在、而且已經做到這個階段,才在這裡 `--bind <P-00x-<slug>,…>`。**里程碑只綁 pipeline**,`kind` 是 `io` 或 `subflow` 都可以。
   - **里程碑可以綁既有的 pipeline**(`pipelines.md`「願景、需求與里程碑」):這個階段不做出新的 pipeline、是靠修訂既有的 pipeline 做到的(存檔格式換版,「拿上一版存的檔在這一版讀出同一個世界」靠修訂 `P-002-save-load` 達成)→ 跟開發者講定是哪一條,綁定欄仍留「-」:那條 pipeline 現在是 `verified`,先綁上去這條里程碑會被算成已經達成。綁定欄由做修訂的 skill 在重開那條 pipeline 的同一個動作填上;回報裡把下一步寫好:`lawful:scope-revise <全名>`(既有的 law 不動,新的承諾用新增的 law 表達)或 `lawful:scope-laws <全名>`(要調整既有的 law),來源寫這條 `M-n`。需求寫的是誰得到什麼(遊戲更新之後舊存檔還讀得回來);存檔用哪一種編碼是決定(ADR)加上全域 Law 的變更(`lawful:global-laws`)與「專案約束」裡硬性要求的套件,不寫進需求。
   - **依序,一次一條**:里程碑有順序、依序完成,全部達成,這條需求的建置就走完。一條需求一次只開它下一條還沒達成的里程碑;開發者要兩條線同時開工,那兩條線屬於不同、而且互不依賴的需求——一條需求裡需要平行,就拆成兩條需求;有依賴的,後面那條被前面那條擋住。
   - `status` 說里程碑全部達成而驗收沒過,是里程碑切漏了或驗收寫錯,回到這一步或第 3 步。
8. **調整**:這條需求的里程碑全部達成之後,開發者要改既有 pipeline 的實作或行為品質(效能、大小、訊息、演算法)才開:一句「做到什麼」,`lawful requirement refinement <R-n> "<一句話>" --touch <P-00x-<slug>,…>`;動到的只能是這條需求的里程碑綁定過的 pipeline,要新能力就開里程碑,不開調整。每條調整之後需求仍要達成。調整的落地預設走 `lawful:scope-revise <它動到的全名>`(既有的 law 不動,需要新的 law 就在那裡新增;REV 的依欄引用 `RF-n`),它再接上 `lawful:build` 做回 `verified`;要調整既有的 law 才做得到的調整,整件走 `lawful:scope-laws <它動到的全名>`。
9. **把沒被綁定的 pipeline 收進里程碑**:`lawful status` 列出沒有被任何里程碑綁定的 pipeline,逐條問「它讓哪條需求的哪條里程碑看得到成果」:有就在綁定欄補上全名;沒有就問開發者要不要留,不留就走文檔退役,`lawful:scope-laws <全名>`(`pipelines.md`「修訂(REV)」),不在這裡刪檔。
10. **重排與修改**:開發者改優先或里程碑順序,直接改需求檔 frontmatter 的 `priority` 或里程碑表的列序;改一句話或驗收就改那一行(`updated` 改成今天)。編號不動、不重鑄;刪掉的需求、里程碑與調整號永久空缺。驗收已經有 `R-n#ACCEPT` 測試而那一句或三行變了,它的測試作廢,告訴開發者下一步是 `lawful:build R-n` 重派 qa。來源是 GAP(目標欄寫 `R-n#ACCEPT`)的,改完的同一個動作把條目**整條刪掉**,`gaps.md` 空了刪檔(`pipelines.md`「提問(GAP)」)。
11. `lawful status`、`lawful lint laws`:需求表與警訊裡跟需求面有關的全部清掉才收(優先各級有宣告、每條需求有合法的優先、需求檔有 frontmatter 而且與檔名對得上、有里程碑、驗收不是模板、里程碑有英文名、里程碑與調整編號不重複、綁定的 pipeline 都存在、調整只動里程碑綁過的、沒有 pipeline 不朝向需求)。還沒有切片的里程碑與待修訂的調整不是警訊。變更 commit。

## 收尾

回報需求幾條(各自的一句話、驗收、優先、依賴哪幾條、里程碑達成幾條;達成與否)、衝突檢查的結果(「與 R-x…R-y 逐條對過,無衝突」,或哪兩條衝突、影響範圍、開發者選了哪個選項)、里程碑幾條(各自的全名與展示得出來的那一句、幾條還沒有切片)、調整幾條(各什麼狀態)、綁了哪些 pipeline、哪些 pipeline 沒有被綁定;附定錨區塊(`tooling.md`「收尾定錨」)。

`Cone.md`「全域 Law」三個小區還是模板 → 直接執行 `lawful:global-laws` 定全域 Law 三區,不等開發者另外下指令。三區都定了,下一步一律從最高優先的需求第一條沒達成的里程碑推:還沒有切片 → 變更先 `lawful:integrate`(`plan/<slug>`)合進主線,再 `lawful:spike-impl <M-n-slug>`(靠修訂既有的 pipeline 達成、沒有新的一段要貫通的,直接 `lawful:scope-revise <全名>` 或 `lawful:scope-laws <全名>`,來源寫這條 `M-n`);切片做完還沒有 pipeline 或 pipeline 還是 draft → `lawful:scope-laws <M-n-slug>`;已 ready → `lawful:build <M-n-slug>`;里程碑都達成而有待修訂的調整,`lawful:scope-revise <它動到的全名>`(要調整既有的 law 才做得到的,整件走 `lawful:scope-laws`)。

## 邊界

需求只准透過這裡寫:一句話、驗收、優先、里程碑與調整都不由別的 skill 改(`lawful:scope-laws` 只把既有的驗收那一句寫成三行、填自己那條里程碑的綁定欄;做修訂的 skill 只填靠那次修訂達成的里程碑的綁定欄)。不寫 pipeline 的 Stages 與 laws;不劃模組單元(`lawful:module`);不寫程式碼;不改願景(`lawful:kickoff`),不碰「全域 Law」區(`lawful:global-laws`),只在「專案約束」補優先那一行;里程碑不帶 law、不帶測試標記;不替開發者答任何一題。開發者只說,檔一律由這裡寫;配號只走 CLI。
