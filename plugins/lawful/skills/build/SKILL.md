---
name: build
description: lawful 的建構指揮(conductor)— 對一條 ready 的 pipeline:開 build/<全名> 分支與工作樹、對帳設計階段寫好的骨架、先派 qa 拿測試在骨架上跑基線、再派 impl、跑子集、仲裁四分流、全綠後跑整套一次、這條讓某個目標的建置路線全部達成而它的 Law 有三行式卻沒有驗收測試就再派一次 qa 寫 R-n#LAW / O-n#LAW、寫 GAP、達成改 frozen、寫開發日誌 commit 在分支上;目標也可以直接是 R-n / O-n(只派 qa 寫那條驗收測試);互不引用的 pipeline 可以同時各開一波,合併交給 lawful:integrate;不寫測試、不寫實作、不寫骨架、不補 law。觸發詞:build、建構、開工、實作這條 pipeline、驗收測試、lawful build、委派。Use when a ready pipeline should be turned into tests and code by delegated qa and impl roles on its own branch, or when a requirement or objective Law needs its acceptance test.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:build — conductor

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief build --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief build --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief build --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief build --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief build --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief build --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief build` 的輸出:規章、分支與工作樹(含建構中與殘留的 build 分支、設計分支)、`Cone.md`「專案約束」、目標 pipeline 全文與逐條狀態、它引用的 pipeline 的 Stages 表與引用它的那幾列、`lint sig` 與 `lint laws` 裡講到它的、`gaps.md`、根目錄的測試輸出新不新、`lawful status` 裡講到它的每一行;目標是 `R-n` / `O-n` 時是那條 Law 的三行、它引用到的 pipeline 的 Stages 表與宣告。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:pipeline 全名,或 `R-n` / `O-n`。上面寫「目標未指定」就先定出目標,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief build <目標> --no-rules`;同一場裡目標文檔或專案現況變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 前置

在主線、與 origin 同步(`git fetch` 後 `git status -sb` 沒有 ahead / behind)、工作樹乾淨(`git status --porcelain` 空);目標 pipeline 與它的骨架因此都已合進主線,設計還在 `design/<全名>` 上就先 `lawful:integrate`。`lawful status`:目標是 `ready`、沒有 open GAP、不是建構中、引用的每條子流都已達成並在主線上。不是就停,回報該先做什麼;子流還沒合進主線就等它(`roles.md`「分支與所有權」)。

目標是 `R-n` / `O-n`(`roles.md`「驗收測試」):`status` 的需求表或目標表要顯示它的建置路線全部達成、Law 有三行式而沒有測試。是就走「驗收測試那波」:`git worktree add -b build/R-n ../<repo>.worktrees/R-n HEAD`,跳過第 1 到 5 步,直接第 6 步派 qa,再第 7 步整套、第 8 步收尾(日誌的 `pipeline` 寫 `R-n`)。建置路線沒達成就停,回報還差哪條里程碑。

## 步驟

0. **開分支**:`git worktree add -b build/<全名> ../<repo>.worktrees/<全名> HEAD`,記下 HEAD 的 sha(日誌的 `base`)。之後每道指令的工作目錄都是這棵工作樹,委派 prompt 也給它。有 REV 的目標在這棵樹上先跑整套當基準線,輸出留檔。
1. **對帳骨架**(`roles.md`「骨架與基線」):跑建置指令編得過、`lawful lint sig` 沒有紅、`lawful status --pipeline <全名>` 每列是「骨架」或「在」。有一列「找不到」「不一致」、或簽名裡的型別沒宣告過,就停:回報缺什麼,回 `lawful:pipeline` 或 `lawful:revise`;不在分支上補簽名或型別。
2. **派 qa**(`lawful:qa`,委派模式,prompt 用下面的模板):只給角色、全名與工作樹路徑;pipeline 檔、types 層、子集測試指令由 qa 載入 skill 時的開工 context 給(`roles.md`「委派」)。測試模組以全名命名。收到回報先對指紋:`lawful brief qa <全名> --root <工作樹> --fingerprint` 要等於回報的第一項,對不上就作廢重派。
3. **基線**:qa 交付後在骨架上跑 qa 的測試模組,輸出留檔。打到 stub 的要紅、打到型別事實的要綠、REV 保護的要綠(`roles.md`「骨架與基線」)。該紅卻綠退回 qa;該綠卻紅寫成 GAP。回報裡的 GAP 由你寫進 `.lawful/gaps.md` 配號,從主線最大號往上。commit。
4. **派 impl**(`lawful:impl`,委派模式,同一個模板):只給角色、全名與工作樹路徑,另附基線裡只有你知道的事(哪幾條 law 打到哪個 stub 而紅);不給測試檔。收到回報一樣先對指紋(`lawful brief impl <全名> --root <工作樹> --fingerprint`)。
5. **判定**:跑本波子集。有紅走仲裁(`roles.md`「仲裁」):每條紅先歸因到哪條 law 或 example,再照四分流處置;每輪只跑上一輪紅的加子集;同一 pipeline 三輪仍紅停止並升級。commit。
6. **驗收測試**(`roles.md`「驗收測試」):本波全綠後 `lawful status --tests <log>`;這條 pipeline 讓某個目標的建置路線全部達成,而該目標的 Law(繼承時是需求的 Law)有三行式卻沒有 `O-n#LAW` / `R-n#LAW` 測試 → 同一條分支再派一次 qa(`lawful:qa`,委派模式,prompt 用下面的模板,args 那一行的目標寫 `R-n` / `O-n`;三行原文與它引用到的 pipeline 由開工 context 給),測試模組以 `R-n` / `O-n` 命名。紅不歸因到 impl:開 GAP(角色 conductor,目標 `R-n#LAW`)停下,回 `lawful:objective` 或 `lawful:revise`。沒有這種目標就跳過。
7. **整套一次**:跑整套,輸出留檔,`lawful status --tests <log>`。
8. **收尾**(`roles.md`「收尾」):open GAP 清單各附「需要回答什麼」;qa 與 impl 自己決定的事整份列出;`status` 顯示達成就改 `frozen`。照 `templates/journal.md` 寫 `.lawful/journal/<全名>.md`(`roles.md`「開發日誌」):數字抄 `lawful status --pipeline <全名>`,動到的檔抄 `git diff --stat <base>..HEAD`,決定抄 qa 與 impl 的回報。連同所有改動 commit。回到主線的工作目錄回報;分支留著給 `lawful:integrate`。

## 委派 prompt 模板

```
【委派模式】你是 <qa | impl> 角色:不提問、不寫共用檔、提到 pipeline 寫全名、如實回報。
第一個動作:用 Skill 工具載入 lawful:<qa | impl>,args 照抄下一行:
<全名 | R-n | O-n> --root <工作樹的絕對路徑>
開工要的東西(規章、目標 pipeline、逐條狀態、簽名與型別的宣告、types 層、測試怎麼寫或要開的檔)都在載入結果裡,不必再找、不必再讀規章。
工作樹:<工作樹的絕對路徑>(所有讀寫與指令都在這裡)
<只有 conductor 知道的事:基線裡哪幾條該紅卻綠、仲裁後的歸因、REV 的重委派清單;沒有就不寫這一行>
回報固定六項:指紋(載入結果的第一行,照抄);改了哪些檔;完成了什麼(數字);自己決定的事;GAP 清單(局部序號,四欄);阻塞項。
```

## 收尾

定錨區塊(`tooling.md`「收尾定錨」)。下一步:`lawful:integrate`(要合的分支寫全名);還有能開的線就先 `lawful:build <另一條全名>`,幾條一起整合;`status` 列了建置路線達成而沒有驗收測試的需求或目標,就 `lawful:build R-n`。

## 邊界

不寫測試、不寫實作、不寫骨架、不補 law、不替開發者做契約級決定、不事後追認。簽名或型別缺了是設計沒做完,回設計,不在分支上補。qa 與 impl 互不可見;開發者明說要平行才平行。只動自己 pipeline 的東西與本波的驗收測試(`roles.md`「分支與所有權」);驗收測試紅不派 impl、不放寬斷言;不合併、不發 PR。
