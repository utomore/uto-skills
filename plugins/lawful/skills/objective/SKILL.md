---
name: objective
description: lawful 的目標 — 對談後在 .lawful/objectives.md 訂專案目標(O-n):開發者答三問 What 做到什麼(一句話)、How 怎麼看得出做到了(可觀察的判準)、Which 落在哪一級優先(1 到 4,各級代表什麼由檔頭一行宣告)與由哪幾條 pipeline 撐;每個目標切成有順序的里程碑(M-n),里程碑綁定它要做到的 pipeline,還沒有 pipeline 的里程碑是待 claim;也回答「這條 pipeline 服務哪個目標」、重排優先。配號只走 lawful objective add / milestone。觸發詞:目標、專案目標、objective、里程碑、milestone、優先、priority、這條 pipeline 為什麼做、朝向目標、lawful objective。Use when adding or reshaping project objectives, their priorities and milestones, or binding pipelines to a milestone.
user-invocable: true
---

# lawful:objective — 目標與里程碑

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/pipelines.md`「願景、目標與里程碑」「完成度」、`rules/tooling.md`「CLI」「status 報告」「收尾定錨」。再讀 `.lawful/system.md` 的「願景」與 `.lawful/objectives.md`(有的話),跑 `lawful status` 看目標表與警訊。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者要達成什麼、既有的目標與 pipeline | `objectives.md` 開頭一行優先各級的宣告,以及一個或多個目標,各有優先、判準與里程碑;里程碑綁定 pipeline,還沒有的標成待 claim |

## 前置

- 沒有 `.lawful/system.md` 或願景還是模板 → 停,先跑 `lawful:design`。
- 開發者要的是「一條資料流」而不是「為什麼做」→ 那是 pipeline,走 `lawful:pipeline`;這裡先把它綁進里程碑再去。

## 步驟

一個目標是一個能力承諾,由開發者答三問決定;答案都是開發者說的,不是推的。

1. **優先怎麼分**:`objectives.md` 開頭要有一行「優先:1 = …;2 = …;3 = …;4 = …」宣告各級在這個專案代表什麼(例:1 = 主軸與它的直接前提;2 = 地基;3 = 呈現與存取;4 = 工具與詞彙)。沒有這一行就先跟開發者訂,寫在 `# 目標` 底下、第一個 `## O-n` 之前;有了就照它問。
2. **What,一句話**:這個目標做到什麼——使用者做得到什麼、或世界變成什麼樣;不寫「做完 X 模組」這種實作句。
3. **How,判準**:達成時看得到什麼,一句可觀察的話(數字、現象、使用者做得到的動作)。寫不出判準的目標還沒想清楚,回到第 2 步。
4. **Which,優先**:照第 1 步那行問「這個目標落在哪一級、它的直接前提是誰」;直接前提還不在表上就先立它。同優先的照檔裡順序。順序來自依賴與必要性,不來自別的。
5. **寫目標**:`lawful objective add "<一句話>" --priority <1-4> --criteria "<判準>"`。
6. **切里程碑**:問「達成這個目標要經過哪幾個階段」,每個階段一條里程碑,一句「做到什麼」,照先後排;`lawful objective milestone <O-n> "<一句話>" --bind <P-00x-<slug>,…>`。要撐它的 pipeline 已經存在就綁;還沒有就不綁,綁定欄留「-」,`status` 把它列成待 claim,之後 `lawful claim <slug> --milestone <M-n>` 填進去(要的模組單元模組表上沒有,先 `lawful:module`)。IO 介面與子流都能綁,看得見的階段通常綁 IO 介面,底層能力的階段綁子流。
7. **把沒有目標的 pipeline 收進來**:`lawful status` 列出沒有被任何里程碑綁定的 pipeline,逐條問「它服務哪個目標的哪條里程碑」:有就在綁定欄補上全名;沒有就問開發者要不要留,不留就刪檔(值得記住為什麼,開 ADR)。
8. **重排**:開發者改優先或里程碑順序,直接改 `objectives.md` 的優先列或表的列序;編號不動、不重鑄。刪掉的目標與里程碑號永久空缺。
9. `lawful status`:目標表與警訊裡跟目標有關的全部清掉才收(優先各級有宣告、優先合法、每個目標有判準與里程碑、綁定的 pipeline 都存在、沒有 pipeline 不朝向目標)。待 claim 的里程碑不是警訊。

## 收尾

回報目標幾個(各優先與完成度)、里程碑幾條(幾條待 claim)、綁了哪些 pipeline、哪些 pipeline 沒有目標;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律是最高優先目標第一條沒達成的里程碑綁定的第一條 pipeline:`lawful:pipeline <全名>`(還是 draft)或 `lawful:build <全名>`(已 ready);那條里程碑待 claim 時,它要的模組單元模組表上沒有就先 `lawful:module`,有就 `lawful claim <slug> --milestone <M-n>`。

## 邊界

不寫 pipeline 的 Stages 與 laws;不寫程式碼;不改願景(那是 `lawful:design`);不替開發者答三問。開發者只說,檔一律由這裡寫;配號只走 CLI。
