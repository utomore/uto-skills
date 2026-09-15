---
name: objective
description: lawful 的目標 — 對談後在 .lawful/objectives/ 訂專案目標(一個目標一個檔 R-x-O-y-<slug>.md):每個目標解決 Cone.md 的恰好一條需求,開發者答三問 What 做到什麼(一句話)、How 怎麼看得出做到了(Objective Law,一對一的需求直接繼承 Requirement Law)、Which 落在哪一級優先(1 到 4,各級代表什麼由檔頭一行宣告);目標底下兩條路線:建置路線的里程碑(M-n)綁定它要做到的 pipeline、還沒有的是待 claim,優化路線的調整(RF-n)只動既有 pipeline 的品質;一條需求有多個目標時補蘊含說明;也回答「這條 pipeline 服務哪個目標」、重排優先。配號只走 lawful objective add / milestone / refinement。觸發詞:目標、專案目標、objective、里程碑、milestone、調整、優化、refinement、優先、priority、這條 pipeline 為什麼做、朝向目標、lawful objective。Use when adding or reshaping project objectives, their laws, priorities, milestones and refinements, or binding pipelines to a milestone.
user-invocable: true
---

# lawful:objective — 目標、里程碑與調整

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/pipelines.md`「願景、需求、目標與路線」「完成度」、`rules/tooling.md`「CLI」「status 報告」「收尾定錨」。再讀 `.lawful/Cone.md` 的「願景」「需求」與「專案約束」的優先那行、`.lawful/objectives/` 底下每一檔(有的話),跑 `lawful status` 看需求表、目標表與警訊。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者要達成什麼、既有的需求、目標與 pipeline | `Cone.md`「專案約束」一行優先各級的宣告,以及 `objectives/` 裡一個目標一個檔,各對到一條需求、各有優先、Law、里程碑;里程碑綁定 pipeline,還沒有的標成待 claim;建置路線達成的目標可以有調整;一條需求有多個目標時 `Cone.md` 那條需求有蘊含說明 |

## 前置

- 沒有 `.lawful/Cone.md`、願景還是模板、或一條需求都沒有 → 停,先跑 `lawful:design`。
- 開發者要的是「一條資料流」而不是「為什麼做」→ 那是 pipeline,走 `lawful:pipeline`;這裡先把它綁進里程碑再去。

## 步驟

一個目標是解決一條需求的能力承諾,由開發者答三問決定;答案都是開發者說的,不是推的。

1. **優先怎麼分**:`Cone.md`「專案約束」要有一行「- 優先:1 = …;2 = …;3 = …;4 = …」宣告各級在這個專案代表什麼(例:1 = 主軸與它的直接前提;2 = 地基;3 = 呈現與存取;4 = 工具與詞彙)。沒有這一行就先跟開發者訂,寫進那一節;有了就照它問。
2. **對到哪條需求**:把 `Cone.md` 的需求唸一遍,問這個目標解決哪一條;答不出來就不是目標,是新需求(`lawful:design` 先立)。一條需求可以拆成幾個目標,每個目標只解決一條。
3. **What,一句話**:這個目標做到什麼——使用者做得到什麼、或世界變成什麼樣;不寫「做完 X 模組」這種實作句。
4. **How,Law**:達成時什麼一定為真,一句可判定的話(數字、現象、使用者做得到的動作),能寫成三行式就寫、能自動化就之後由 build 派 qa 寫歸屬 `O-n#LAW` 的驗收測試(`roles.md`「驗收測試」)。這條需求只有這一個目標時不另寫,`- Law:繼承 R-n`;一條需求有兩個以上目標時,每個目標要有自己的 Law,而且 `Cone.md` 那條需求要補一行「蘊含:O-a、O-b 的 Law 都成立 ⟹ 本 Law 成立,因為 …」,說不出「因為」就是目標切錯了。寫不出 Law 的目標還沒想清楚,回到第 3 步。
5. **Which,優先**:照第 1 步那行問「這個目標落在哪一級、它的直接前提是誰」;直接前提還不在表上就先立它。同優先的照檔裡順序。順序來自依賴與必要性,不來自別的。
6. **寫目標**:`lawful objective add <slug> "<一句話>" --requirement <R-n> --priority <1-4> [--law "<句>"]`,slug 是 kebab-case 英文、講這個目標做到什麼,檔名就是 `R-n-O-n-<slug>.md`;三行式與蘊含說明直接寫進檔。目標之後換需求,檔名的 `R-x` 跟著改。
7. **建置路線,切里程碑**:問「達成這個目標要經過哪幾個階段」,每個階段一條里程碑,一句「做到什麼」,照先後排;`lawful objective milestone <O-n> "<一句話>" --bind <P-00x-<slug>,…>`。要撐它的 pipeline 已經存在就綁;還沒有就不綁,綁定欄留「-」,`status` 把它列成待 claim,之後 `lawful claim <slug> --milestone <M-n>` 填進去(要的模組單元模組表上沒有,先 `lawful:module`)。IO 介面與子流都能綁,看得見的階段通常綁 IO 介面,底層能力的階段綁子流。建置路線走完,需求的 Law 要第一次成立;`status` 說建置路線達成而 Law 未成立,是里程碑切漏了或 Law 寫錯,回到這裡。
8. **優化路線,切調整**:建置路線達成之後,開發者要改既有 pipeline 的實作或行為品質(效能、大小、訊息、演算法)才開:一句「做到什麼」,`lawful objective refinement <O-n> "<一句話>" --touch <P-00x-<slug>,…>`;動到的只能是本目標里程碑綁定過的 pipeline,要新能力就開里程碑,不開調整。每條調整之後需求的 Law 仍要成立。調整的實作走 `lawful:revise`(REV 的依欄引用 `RF-n`)再 `lawful:build`。
9. **把沒有目標的 pipeline 收進來**:`lawful status` 列出沒有被任何里程碑綁定的 pipeline,逐條問「它服務哪個目標的哪條里程碑」:有就在綁定欄補上全名;沒有就問開發者要不要留,不留就刪檔(值得記住為什麼,開 ADR)。
10. **重排**:開發者改優先或里程碑順序,直接改目標檔 frontmatter 的 `priority` 或表的列序;編號不動、不重鑄。刪掉的目標、里程碑與調整號永久空缺。
11. `lawful status`、`lawful lint laws`:需求表、目標表與警訊裡跟需求、目標有關的全部清掉才收(優先各級有宣告、優先合法、每個目標對到存在的需求、有 Law 與里程碑、綁定的 pipeline 都存在、調整只動里程碑綁過的、多目標的需求有蘊含說明且沒有目標在繼承、沒有 pipeline 不朝向目標)。待 claim 的里程碑與待修訂的調整不是警訊。

## 收尾

回報目標幾個(各對哪條需求、優先、Law 成立與否、完成度)、里程碑幾條(幾條待 claim)、調整幾條(各什麼狀態)、綁了哪些 pipeline、哪些 pipeline 沒有目標;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律是最高優先目標第一條沒達成的里程碑綁定的第一條 pipeline:`lawful:pipeline <全名>`(還是 draft)或 `lawful:build <全名>`(已 ready);那條里程碑待 claim 時,它要的模組單元模組表上沒有就先 `lawful:module`,有就 `lawful claim <slug> --milestone <M-n>`;建置路線都達成而有待修訂的調整,`lawful:revise <它動到的全名>`。

## 邊界

不寫 pipeline 的 Stages 與 laws;不寫程式碼;不改願景與需求的一句話(那是 `lawful:design`),只在多目標時替需求補蘊含說明、在「專案約束」補優先那一行;不替開發者答三問。開發者只說,檔一律由這裡寫;配號只走 CLI。
