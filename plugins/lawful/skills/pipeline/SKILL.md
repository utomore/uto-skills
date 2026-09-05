---
name: pipeline
description: lawful 的 pipeline 設計 — 一次一條,與開發者對談出 Brief、Stages(簽名、模組、層、願望 stage)、形式化 laws、examples 與決定;lint laws 與 lint sig 過了、開發者拍板,改 ready。觸發詞:設計 pipeline、寫 pipeline、lawful pipeline、寫 law、定簽名、規格、spec。Use when specifying one data-flow pipeline with laws before any code is written.
user-invocable: true
---

# lawful:pipeline — 一條 pipeline

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/pipelines.md`「pipeline」「編號與引用」「frontmatter 與 status」「節」「願望 stage」、`rules/boundary.md`「模組表」、`rules/tooling.md`「收尾定錨」。再讀 `.design/system.md`、`.design/modules.md`,以及 types 層模組的匯出(law 只准引用它們與 Stages 的簽名)。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一條 pipeline 的全名(沒有就 `lawful claim <slug>`)、開發者的意圖 | 該 pipeline 檔六節寫齊,`status: ready` |

## 步驟

1. **Brief**:問清楚 input 是什麼、output 是什麼、它在哪條里程碑裡;三到五句寫下,用 `→` 串 stage 的中文名。
2. **Stages,從 output 往回推**:每一步一條簽名,逐字寫成程式碼會長的樣子;模組與層對模組表;`=` 列是整條。底層還沒有的能力,寫理想簽名並在模組欄註明「願望,見 P-00x-<slug>」或只寫目標模組。引用別條 pipeline 的 stage 照抄簽名並註明「見」。
3. **Laws,照種類問法表逐種問**(`pipelines.md`「節」的 Laws 表):做完什麼一定不變、什麼輸入等於沒做、存出去要不要一模一樣讀回來、兩步的輸出有什麼對應、哪個數字有上限、有沒有慢但一定對的寫法。每條三行,純 ASCII,`|-` 只引用 Stages 的簽名與 types 層匯出。問出來的「哪些欄位不算」這種答案,常常是一個新的 stage(投影),當場加進 Stages。
4. **Examples**:每條 law 至少一個具體例子,邊界值優先;覆蓋欄指到 law。
5. **決定**:對談中否決掉的替代方案,一句結論、一句理由;要證據的派 `lawful:spike`,結論回來再寫。
6. **對帳**:`lawful lint laws`、`lawful lint sig`(願望與找不到的 stage 不算紅,不一致才紅)。紅的回到對應步驟。
7. **拍板**:把 Stages 與 Laws 唸給開發者聽,開發者說好,改 `status: ready`,`system.md` Pipelines 表的類別欄填里程碑或子流。

## 收尾

回報 stage 幾條(其中願望幾條)、law 幾條、example 幾條、決定幾條;附定錨區塊。下一步:`lawful:build <全名>`,或願望 stage 指向的子流還沒有就先 `lawful:pipeline` 那一條。

## 邊界

不寫測試、不寫實作、不動別條 pipeline(要動走 `lawful:revise`)。開發者只說,檔一律由這裡寫。
