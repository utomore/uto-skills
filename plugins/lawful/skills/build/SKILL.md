---
name: build
description: lawful 的建構指揮(conductor)— 對一條 ready 的 pipeline:開 build/<全名> 分支與工作樹、對帳設計階段寫好的骨架、先派 qa 拿測試在骨架上跑基線、再派 impl、跑子集、仲裁四分流、全綠後跑整套一次、這條讓某個目標的建置路線全部達成而它的 Law 有三行式卻沒有驗收測試就再派一次 qa 寫 R-n#LAW / O-n#LAW、寫 GAP、達成改 frozen、寫開發日誌 commit 在分支上;目標也可以直接是 R-n / O-n(只派 qa 寫那條驗收測試);互不引用的 pipeline 可以同時各開一波,合併交給 lawful:integrate;不寫測試、不寫實作、不寫骨架、不補 law。觸發詞:build、建構、開工、實作這條 pipeline、驗收測試、lawful build、委派。Use when a ready pipeline should be turned into tests and code by delegated qa and impl roles on its own branch, or when a requirement or objective Law needs its acceptance test.
user-invocable: true
---

# lawful:build — conductor

## 讀什麼

`<L>` 是 plugin 根目錄,也就是本 skill 的基準目錄往上兩層;下面的 `rules/…` 都在 `<L>/rules/`。一次讀完:`rules/roles.md` 全份、`rules/pipelines.md`「提問(GAP)」「修訂(REV)」「完成度」、`rules/tooling.md`「CLI」「跑東西的紀律」「收尾定錨」。再讀目標 pipeline 檔、`.lawful/modules.md`、`.lawful/Cone.md` 的「專案約束」。

## 前置

在主線、與 origin 同步(`git fetch` 後 `git status -sb` 沒有 ahead / behind)、工作樹乾淨(`git status --porcelain` 空);目標 pipeline 與它的骨架因此都已合進主線,設計還在 `design/<全名>` 上就先 `lawful:integrate`。`lawful status`:目標是 `ready`、沒有 open GAP、不是建構中、引用的每條子流都已達成並在主線上。不是就停,回報該先做什麼;子流還沒合進主線就等它(`roles.md`「分支與所有權」)。

目標是 `R-n` / `O-n`(`roles.md`「驗收測試」):`status` 的需求表或目標表要顯示它的建置路線全部達成、Law 有三行式而沒有測試。是就走「驗收測試那波」:`git worktree add -b build/R-n ../<repo>.worktrees/R-n HEAD`,跳過第 1 到 5 步,直接第 6 步派 qa,再第 7 步整套、第 8 步收尾(日誌的 `pipeline` 寫 `R-n`)。建置路線沒達成就停,回報還差哪條里程碑。

## 步驟

0. **開分支**:`git worktree add -b build/<全名> ../<repo>.worktrees/<全名> HEAD`,記下 HEAD 的 sha(日誌的 `base`)。之後每道指令的工作目錄都是這棵工作樹,委派 prompt 也給它。有 REV 的目標在這棵樹上先跑整套當基準線,輸出留檔。
1. **對帳骨架**(`roles.md`「骨架與基線」):跑建置指令編得過、`lawful lint sig` 沒有紅、`lawful status --pipeline <全名>` 每列是「骨架」或「在」。有一列「找不到」「不一致」、或簽名裡的型別沒宣告過,就停:回報缺什麼,回 `lawful:pipeline` 或 `lawful:revise`;不在分支上補簽名或型別。
2. **派 qa**(`lawful:qa`,委派模式,prompt 用下面的模板):給全名、pipeline 檔路徑、工作樹路徑、types 層模組清單、子集測試指令。測試模組以全名命名。
3. **基線**:qa 交付後在骨架上跑 qa 的測試模組,輸出留檔。打到 stub 的要紅、打到型別事實的要綠、REV 保護的要綠(`roles.md`「骨架與基線」)。該紅卻綠退回 qa;該綠卻紅寫成 GAP。回報裡的 GAP 由你寫進 `.lawful/gaps.md` 配號,從主線最大號往上。commit。
4. **派 impl**(`lawful:impl`,委派模式):給全名、pipeline 檔路徑、工作樹路徑、骨架檔路徑、子集指令;不給測試檔。
5. **判定**:跑本波子集。有紅走仲裁(`roles.md`「仲裁」):每條紅先歸因到哪條 law 或 example,再照四分流處置;每輪只跑上一輪紅的加子集;同一 pipeline 三輪仍紅停止並升級。commit。
6. **驗收測試**(`roles.md`「驗收測試」):本波全綠後 `lawful status --tests <log>`;這條 pipeline 讓某個目標的建置路線全部達成,而該目標的 Law(繼承時是需求的 Law)有三行式卻沒有 `O-n#LAW` / `R-n#LAW` 測試 → 同一條分支再派一次 qa(`lawful:qa`,委派模式,prompt 用下面的模板,「pipeline」那行改成「Law:R-n / O-n,三行原文」並列出它引用到的簽名所在的每條 pipeline 檔路徑),測試模組以 `R-n` / `O-n` 命名。紅不歸因到 impl:開 GAP(角色 conductor,目標 `R-n#LAW`)停下,回 `lawful:objective` 或 `lawful:revise`。沒有這種目標就跳過。
7. **整套一次**:跑整套,輸出留檔,`lawful status --tests <log>`。
8. **收尾**(`roles.md`「收尾」):open GAP 清單各附「需要回答什麼」;qa 與 impl 自己決定的事整份列出;`status` 顯示達成就改 `frozen`。照 `templates/journal.md` 寫 `.lawful/journal/<全名>.md`(`roles.md`「開發日誌」):數字抄 `lawful status --pipeline <全名>`,動到的檔抄 `git diff --stat <base>..HEAD`,決定抄 qa 與 impl 的回報。連同所有改動 commit。回到主線的工作目錄回報;分支留著給 `lawful:integrate`。

## 委派 prompt 模板

```
plugin 根目錄 <L>:<解析出來的實際路徑>(規章在它底下的 rules/)
【委派模式】遵守 <L>/rules/roles.md「委派」:不提問、不寫共用檔、提到 pipeline 寫全名、如實回報。
你是 <qa | impl> 角色,執行 lawful:<qa | impl>。
pipeline:<全名>,檔:<路徑>
工作樹:<路徑>(所有讀寫與指令都在這裡)
types 層模組:<清單>(qa 可讀;impl 另給骨架檔路徑)
子集測試指令:<一行>
回報固定五項:改了哪些檔;完成了什麼(數字);自己決定的事;GAP 清單(局部序號,四欄);阻塞項。
```

## 收尾

定錨區塊(`tooling.md`「收尾定錨」)。下一步:`lawful:integrate`(要合的分支寫全名);還有能開的線就先 `lawful:build <另一條全名>`,幾條一起整合;`status` 列了建置路線達成而沒有驗收測試的需求或目標,就 `lawful:build R-n`。

## 邊界

不寫測試、不寫實作、不寫骨架、不補 law、不替開發者做契約級決定、不事後追認。簽名或型別缺了是設計沒做完,回設計,不在分支上補。qa 與 impl 互不可見;開發者明說要平行才平行。只動自己 pipeline 的東西與本波的驗收測試(`roles.md`「分支與所有權」);驗收測試紅不派 impl、不放寬斷言;不合併、不發 PR。
