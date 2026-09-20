---
name: objective
description: lawful 的目標 — 對談後在 .lawful/objectives/ 訂專案目標(一個目標一個檔 R-x-O-y-<slug>.md):每個目標解決 Cone.md 的恰好一條需求,開發者答兩問 What 做到什麼(一句話)、Which 落在哪一級優先(1 到 4,各級代表什麼由 Cone.md 一行宣告);目標沒有自己的判準也沒有 law:它達成 = 建置路線的里程碑全部達成,需求達成了沒由需求的驗收判;目標底下兩條路線:建置路線的里程碑(全名 M-n-<slug>)一條就是一條垂直切片的範圍,綁定欄在切片做完、law-design claim 出 pipeline 之後才填,優化路線的調整(RF-n)只動既有 pipeline 的品質;也回答「這條 pipeline 服務哪個目標」、重排優先。配號只走 lawful objective add / milestone / refinement;里程碑的英文名是切片分支 build/M-n-<slug> 的鍵。觸發詞:目標、專案目標、objective、里程碑、milestone、調整、優化、refinement、優先、priority、這條 pipeline 為什麼做、朝向目標、lawful objective。Use when adding or reshaping project objectives, their priorities, milestones and refinements, or binding pipelines to a milestone.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:objective — 目標、里程碑與調整

> **核心**:A milestone MUST be one sentence that a single running slice can make observably true.(一條里程碑是一句話,而且一條跑得起來的切片就能讓它看得到地成真;做不到就再切。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief objective --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief objective --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief objective --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief objective --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief objective --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief objective --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief objective` 的輸出:規章、`Cone.md` 全文、每個目標檔全文、`lawful status` 的需求表、目標表、等決定、警訊與建議路線。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給;有最近一次測試輸出就加 `--tests <log>`。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief objective --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者要達成什麼、既有的需求、目標與 pipeline | `Cone.md`「專案約束」一行優先各級的宣告,以及 `objectives/` 裡一個目標一個檔,各對到一條需求、各有優先與里程碑;里程碑有英文名(全名 `M-n-<slug>`),綁定欄填它做出來的 pipeline,還沒有切片的留「-」;建置路線達成的目標可以有調整 |

## 前置

- 沒有 `.lawful/Cone.md`、願景還是模板、或一條需求都沒有 → 停,先跑 `lawful:project`。
- 只有 `system.md` 的樹、或目標還擠在一份 `objectives.md` → 先 `lawful migrate cone`(印帳本)再 `--write`。
- `lawful status` 警訊說 `Cone.md` 沒有「## 全域 Law」區、或需求與目標檔寫著「- Law:」→ 先 `lawful migrate laws`(印帳本)再 `--write`。
- 開發者要的是「一條資料流」而不是「為什麼做」→ 那是一條里程碑的範圍:這裡先把它切成里程碑,再 `lawful:spike-impl <M-n-slug>` 做出切片、`lawful:law-design` 談出 pipeline。

## 步驟

一個目標是解決一條需求的能力承諾,由開發者答兩問決定;答案都是開發者說的,不是推的。目標講的是**必須達成**的事,裡面沒有 law:判它做到了沒的是里程碑,判需求達成了沒的是需求的驗收(`pipelines.md`「願景、需求、目標與路線」)。

1. **優先怎麼分**:`Cone.md`「專案約束」要有一行「- 優先:1 = …;2 = …;3 = …;4 = …」宣告各級在這個專案代表什麼(例:1 = 主軸與它的直接前提;2 = 地基;3 = 呈現與存取;4 = 工具與詞彙)。沒有這一行就先跟開發者訂,寫進那一節;有了就照它問。
2. **對到哪條需求**:把 `Cone.md` 的需求唸一遍,問這個目標解決哪一條;答不出來就不是目標,是新需求(`lawful:project` 先立)。一條需求可以拆成幾個目標,每個目標只解決一條。
3. **What,一句話**:這個目標做到什麼——使用者做得到什麼、或世界變成什麼樣;不寫「做完 X 模組」這種實作句。
4. **Which,優先**:照第 1 步那行問「這個目標落在哪一級、它的直接前提是誰」;直接前提還不在表上就先立它。同優先的照檔名順序。順序來自依賴與必要性,不來自別的。
5. **寫目標**:`lawful objective add <slug> "<一句話>" --requirement <R-n> --priority <1-4>`,slug 是 kebab-case 英文、講這個目標做到什麼,檔名就是 `R-n-O-n-<slug>.md`。目標之後換需求,檔名的 `R-x` 跟著改。
6. **建置路線,切里程碑**:問「達成這個目標要經過哪幾個看得見的階段」,每個階段一條里程碑,一句「做到什麼」,照先後排。**一條里程碑就是一條垂直切片的範圍**:從一個 shell 的進入點貫通到出口、跑起來看得到那一句話;大到一次貫通不了就再切。每條給一個 kebab-case 英文名,`lawful objective milestone <O-n> <slug> "<一句話>"`,表上的第一格是全名 `M-n-<slug>`,切片的分支 `build/M-n-<slug>` 與決策紀錄以它為鍵;`status` 警訊列出沒有英文名的里程碑,把第一格補成全名。綁定欄留「-」:pipeline 在切片做完之後由 `lawful:law-design` claim 出來填進去,一條里程碑可以綁好幾條(IO 介面與它引用的子流);要撐它的 pipeline 已經存在才在這裡 `--bind`。每個目標一次只開它下一條還沒達成的里程碑,要同時開的線分到不同目標底下。需求底下每個目標的建置路線都走完,需求要第一次達成;`status` 說建置路線達成而需求未達成,是里程碑切漏了或驗收寫錯,回到這裡(驗收寫錯的回 `lawful:project`)。
7. **優化路線,切調整**:建置路線達成之後,開發者要改既有 pipeline 的實作或行為品質(效能、大小、訊息、演算法)才開:一句「做到什麼」,`lawful objective refinement <O-n> "<一句話>" --touch <P-00x-<slug>,…>`;動到的只能是本目標里程碑綁定過的 pipeline,要新能力就開里程碑,不開調整。每條調整之後需求仍要達成。調整的實作走 `lawful:revise`(REV 的依欄引用 `RF-n`)再 `lawful:build`。
8. **把沒有目標的 pipeline 收進來**:`lawful status` 列出沒有被任何里程碑綁定的 pipeline,逐條問「它服務哪個目標的哪條里程碑」:有就在綁定欄補上全名;沒有就問開發者要不要留,不留就刪檔(值得記住為什麼,跟開發者要一句話寫進 commit 訊息,整合時升成 ADR)。
9. **重排**:開發者改優先或里程碑順序,直接改目標檔 frontmatter 的 `priority` 或表的列序;編號不動、不重鑄。刪掉的目標、里程碑與調整號永久空缺。
10. `lawful status`、`lawful lint laws`:需求表、目標表與警訊裡跟需求、目標有關的全部清掉才收(優先各級有宣告、優先合法、每個目標對到存在的需求、有里程碑、里程碑有英文名、綁定的 pipeline 都存在、調整只動里程碑綁過的、沒有 pipeline 不朝向目標)。還沒有切片的里程碑與待修訂的調整不是警訊。

## 收尾

回報目標幾個(各對哪條需求、優先、完成度;它的需求達成與否)、里程碑幾條(各自的全名、幾條還沒有切片)、調整幾條(各什麼狀態)、綁了哪些 pipeline、哪些 pipeline 沒有目標;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律從最高優先目標第一條沒達成的里程碑推:還沒有切片 → 變更先 `lawful:integrate`(`plan/<slug>`)合進主線,再 `lawful:spike-impl <M-n-slug>`;切片做完還沒有 pipeline 或 pipeline 還是 draft → `lawful:law-design`;已 ready → `lawful:build <M-n-slug>`;建置路線都達成而有待修訂的調整,`lawful:revise <它動到的全名>`。

## 邊界

不寫 pipeline 的 Stages 與 laws;不寫程式碼;不改願景、需求與它的驗收(那是 `lawful:project`),不碰「全域 Law」區,只在「專案約束」補優先那一行;不替開發者答那兩問。開發者只說,檔一律由這裡寫;配號只走 CLI。
