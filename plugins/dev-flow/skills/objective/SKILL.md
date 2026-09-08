---
name: objective
description: dev-flow 的目標 — 對談後在 .design/objectives.md 訂專案目標(O-n,一句話、優先 1 到 4、可觀察的判準),每個目標切成有順序的里程碑(M-n),每條里程碑綁定它要做到的 feature;也回答「這份 feature 服務哪個目標」、重排優先、判目標與願景有沒有分歧。配號只走 devflow objective add / milestone。觸發詞:目標、專案目標、objective、里程碑、milestone、優先、priority、這個功能為什麼做、朝向目標、dev-flow objective。Use when adding or reshaping project objectives, their priorities and milestones, or binding features to a milestone.
user-invocable: true
---

# dev-flow:objective — 目標與里程碑

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/features.md`「願景、目標與里程碑」「完成度」、`rules/tooling.md`「CLI」「status 報告」「收尾定錨」。再讀 `.design/system.md` 的「願景」與 `.design/objectives.md`(有的話),跑 `devflow status` 看目標表與警訊。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者要達成什麼、願景、既有的目標與 feature | `objectives.md` 裡一個或多個目標,各有優先、判準與至少一條綁定了 feature 的里程碑 |

## 前置

- 沒有 `.design/system.md` 或願景還是模板 → 停,先跑 `dev-flow:project` 訂願景。目標是通往願景的一步,沒有願景就沒有東西可以對。
- 開發者要的是「一條使用者做得到的事」而不是「為什麼做」→ 那是 feature,走 `dev-flow:feature`;這裡先把它綁進里程碑再去。

## 步驟

1. **對願景**:把願景唸一次,問「這個目標達成時,願景的哪一句往前了」。答不出來就不是目標,是分歧:記下來回報,不寫進檔。
2. **一句話**:使用者做得到什麼、或世界變成什麼樣;不寫「做完 X 模組」這種實作句。
3. **優先**:1 到 4,1 最高。同優先的照檔裡順序。問「這個不做,願景會不會停」:會就是 1;只是更好就是 3 或 4。
4. **判準**:達成時看得到什麼,一句可觀察的話(數字、現象、使用者做得到的動作)。寫不出判準的目標還沒想清楚,回到第 2 步。
5. **寫目標**:`devflow objective add "<一句話>" --priority <1-4> --criteria "<判準>"`。
6. **切里程碑**:問「達成這個目標要經過哪幾個看得見的階段」,每個階段一條里程碑,一句「做到什麼」,照先後排;`devflow objective milestone <O-n> "<一句話>" --bind <F-00x-<slug>,…>`。綁定的 feature 還不存在,就先 `devflow claim feature <slug> --description <句> --milestone <M-n>`。**每條里程碑至少綁一份 feature;里程碑只綁 feature**,abstract 跟著 feature 達成。
7. **把沒有目標的 feature 收進來**:`devflow status` 列出沒有被任何里程碑綁定的 feature,逐份問「它服務哪個目標的哪條里程碑」:有就在綁定欄補上全名;沒有就問開發者要不要留,不留就刪檔(值得記住為什麼,開 ADR)。
8. **重排**:開發者改優先或里程碑順序,直接改 `objectives.md` 的優先列或表的列序;編號不動、不重鑄。刪掉的目標與里程碑號永久空缺。
9. `devflow status`:目標表與警訊裡跟目標有關的全部清掉才收(優先合法、每個目標有判準與里程碑、每條里程碑有綁定且綁的都存在、沒有 feature 不朝向目標)。

## 收尾

回報目標幾個(各優先與完成度)、里程碑幾條、綁了哪些 feature、哪些 feature 沒有目標、有沒有與願景分歧的目標;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律是最高優先目標第一條沒達成的里程碑綁定的第一份 feature:`dev-flow:feature <全名>`(還是 draft)或 `dev-flow:build <全名>`(已 ready)。

## 邊界

不寫 feature 的 Steps 與 laws;不寫程式碼;不改願景(那是 `dev-flow:project`);不替開發者決定優先與要不要留一份 feature。開發者只說,檔一律由這裡寫;配號只走 CLI。
