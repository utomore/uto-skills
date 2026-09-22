---
name: build
description: dev-flow(有 .design/ 的專案)的建構指揮(conductor):對 ready 的文檔派 qa 寫測試、驗首跑、派 refactor 調整實作、仲裁紅燈,每條 law 成立才改 verified;目標也可以是 R-n 或 INV-n(只補那一條驗收測試)。觸發詞:build、建構、開工、跑這條里程碑、跑 feature、補驗收測試、委派開發。Use when ready documents should be turned into tests and law-abiding code, or an acceptance test is missing.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:build — conductor

> **核心**:A document is Verified only when every Law is guarded by a test that can fail and now passes.(每條 law 都有一條會失敗、現在通過的測試守著,這份文檔才叫 verified;少一條都不是。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief build --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief build --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief build --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief build --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段(一份輸出切成幾段,每段一道指令)是載入 skill 時跑 `devflow brief build` 的輸出:規章、分支與工作樹、`system.md`「Constraint」、`gaps.md`、根目錄的測試輸出新不新、status 報告。目標是一份文檔時另有 `modules.md`、決策紀錄、那份文檔全文與逐條狀態、`lint sig` 與 `lint laws` 的結果;目標是里程碑時另有 `modules.md`、決策紀錄、它的需求檔全文、它綁的每一份文檔全文與逐條狀態、`lint sig` 與 `lint laws` 的結果;目標是 `R-n` / `INV-n` 時另有那一條的三行。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:里程碑全名 `M-n-<slug>`、文檔全名,或 `R-n` / `INV-n`。上面寫「目標未指定」就先定出目標,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief build <目標> --no-rules`;同一場裡目標文檔變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入

| 目標 | 這一波做什麼 |
|---|---|
| 里程碑全名 `M-n-<slug>` | 它綁的每一份 `ready` 文檔各一波,被引用的那一份在前 |
| 文檔全名(`dev-flow:scope-laws` 或 `dev-flow:scope-revise` 的修訂交過來的) | 那一份,只重做 REV「重委派」欄點名的;收尾時每條 law 成立,文檔回到 `verified` |
| `R-n` / `INV-n` | 驗收測試那波:只派 qa 寫那一條(需求的驗收,或一條領域不變量) |

## 前置

- **工作目錄是那條分支的工作樹** `../<repo>.worktrees/<鍵>`(`rules/roles.md`「分支」);build 不替里程碑與文檔開分支,分支由 `dev-flow:spike-impl`、`dev-flow:scope-laws`(既有文檔的 law 要調整)、`dev-flow:scope-revise` 開。不在那棵樹上就先過去。
- `devflow status`:目標文檔是 `ready`、沒有 open GAP、它引用的每份文檔都已達成。還是 `draft` → `dev-flow:scope-laws`;不是就停,回報該先做什麼。
- 目標是 `R-n` / `INV-n`(`rules/roles.md`「驗收測試」):`status` 要顯示它有三行式而沒有測試,需求另要它的里程碑全部達成。在主線、與 origin 同步、工作樹乾淨時 `git worktree add -b build/R-n ../<repo>.worktrees/R-n HEAD`,跳過第 1 到 5 步,直接第 6 步派 qa,再第 7 步整套、第 8 步收尾(決策紀錄的 `key` 寫 `R-n`,從「Verification」寫起)。里程碑還沒全部達成就停,回報還差哪條里程碑。

## 步驟

0. **基準線**:有 REV 的目標(修訂)先在這棵樹上跑整套當基準線,輸出留檔。
1. **對帳**:跑建置指令編得過、`devflow lint sig` 與 `devflow lint laws` 沒有紅、`devflow status --doc <全名>` 每列是「在」或「未實作」(修訂新增的 step)。有一列「找不到」「不一致」、或簽名裡的型別沒宣告過,就停:回報缺什麼,回交過來的那個 skill(切片那一波與 law 的調整是 `dev-flow:scope-laws`,既有的 law 不動的修訂是 `dev-flow:scope-revise`);不在這裡補宣告。
2. **派 qa**(`dev-flow:qa`,`model: "sonnet"`,prompt 用下面的模板):只給角色、目標全名與工作樹路徑;文檔、宣告、最內層、子集測試指令、歸屬寫法由 qa 載入 skill 時的 `devflow brief` 給,你不查、不填。測試檔以全名命名。**不給決策紀錄**:哪幾條該紅 qa 不必知道。修訂那一波測試檔已經在,只給 REV「重委派」欄點名 qa 的部分:調整的或新增的 law 與 example 寫那幾條;既有的 law 不動而簽名或型別變了,交代「只把既有測試裡的呼叫與建構改到對得上新的宣告,斷言與產生器的定義域不動」;重委派欄沒有點名 qa 就不派,測試原封不動。收回報先對指紋(`rules/roles.md`「委派」):`devflow brief qa <全名> --root <工作樹> --fingerprint` 與回報第一項一字不差,才往下。
3. **首跑**(`rules/roles.md`「首跑」):qa 交付後,在現有的程式碼上跑一次它的測試,輸出留檔。決策紀錄「首跑該紅」列的 law、REV「動到」欄點名的 law、打到未實作標記的要紅;其餘要綠。`dev-flow:scope-revise` 的那一波:原有的每條 law 與 example 都要綠,新增的 law 照 REV「動到」欄註明的首跑該綠或該紅;原有的紅了就停下歸因,非調整既有的 law 不可就回報給 `dev-flow:scope-revise`,由它放棄並整件轉交。沒派 qa 的那一波,首跑就是在現有的程式碼上跑本份的子集。該紅卻綠退回 qa;該綠卻紅照第 5 步歸因;一條紅都沒有就逐條拿 `|-` 行對測試的斷言。結果寫進決策紀錄「Verification」的「首跑」。環境跑不起來就明寫「本波 qa 紅綠未驗證」,不得默認通過。回報裡的 GAP 由你寫進 `.design/gaps.md` 配號,從主線最大號往上。commit。
4. **派 refactor**(`dev-flow:refactor`,`model: "sonnet"`):同一個模板,另給只有你知道的:**首跑紅的那幾條 law 的原文與歸因**、決策紀錄「Faked / Unverified」裡屬於這份文檔的列;**不給測試檔、不給測試碼**。修訂那一波另給 REV 那一句與「動到」欄(要接到新的簽名與型別、要搬的模組、來源的里程碑那一句要做到的品質),「保護」欄是護欄。`dev-flow:global-laws` 在這條分支上剛立了層表而 `devflow lint boundary` 有紅(這一片長出來的樣子與講定的層不合)→ 那幾條紅的原文一起給 refactor,調到 `lint boundary` 沒有紅。首跑全綠、沒有假的東西要換、`lint boundary` 沒有紅、REV「重委派」欄也沒有點名 refactor,就不派。收回報同樣先對指紋。
5. **判定**:跑本波子集。有紅走仲裁(`rules/roles.md`「仲裁」):每條紅先歸因到哪條 law 或 example,再照四分流處置;每輪只跑上一輪紅的加子集;同一份三輪仍紅停止並升級。commit。
6. **驗收測試**(`rules/roles.md`「驗收測試」):本波全綠後 `devflow status --tests <log>`;這份文檔讓某條需求的里程碑全部達成,而那條需求的驗收有三行式卻沒有 `R-n#ACCEPT` 測試,或這條分支上有一條領域不變量有三行式而沒有 `INV-n#LAW` 測試(`dev-flow:global-laws` 從這一片抽上去的)→ 同一條分支再派一次 qa(模板的目標寫 `R-n` 或 `INV-n`;三行原文與它引用到的文檔由 brief 給),測試檔以 `R-n` / `INV-n` 命名。抽上去的那條 law 原本在出處的文檔已經有測試 → 交代這一波的 qa 把那條測試搬進以 `INV-n` 命名的測試檔、歸屬改成 `INV-n#LAW`、產生器與斷言改成只用最內層的匯出,出處的測試檔裡不留它(留著就是幽靈引用)。紅不歸因到某個 step 的實作:開 GAP(角色 conductor,目標 `R-n#ACCEPT` 或 `INV-n#LAW`)停下:需求的驗收紅是里程碑切漏了或驗收寫錯,回 `dev-flow:require-design`;領域不變量紅,照仲裁歸因到違反它的那份文檔,該改的是那條全域 Law 就回 `dev-flow:global-laws`。沒有這種情形就跳過。
7. **整套一次**:跑整套,輸出留檔,`devflow status --tests <log>`、`devflow lint all`。領域不變量有紅 = 這條分支違反了全專案的規則,照仲裁歸因到是哪一份的實作。
8. **收尾**(`rules/roles.md`「收尾」):open GAP 清單各附「需要回答什麼」與回答該走哪個 skill(`features.md`「修訂(REV)」那一句分流);qa 與 refactor 自己決定的事整份列出;決策紀錄「Faked / Unverified」逐列對過(換成真的了,或有一條 open GAP);`status` 顯示達成就改 `verified`。照 `templates/journal.md` 寫決策紀錄的「Verification」與「合併時要看」(`rules/roles.md`「決策紀錄」):數字抄 `devflow status --doc <全名>`,動到的檔抄 `git diff --stat <base>..HEAD`,決定抄 qa 與 refactor 的回報;「Goal / Scope」「Assumptions & Invariants」「Touched」對回最後的程式碼。連同所有改動 commit。分支留著給 `dev-flow:integrate`。

## 委派 prompt 模板

```
【委派模式】你是 <qa | refactor> 角色:不提問、不寫共用檔、提到文檔寫全名、如實回報。
第一個動作:用 Skill 工具載入 dev-flow:<qa | refactor>,args 照抄下一行:
<全名 | R-n | INV-n> --root <工作樹的絕對路徑>
開工要的東西(規章、目標文檔、簽名與型別的宣告、最內層、測試怎麼寫、子集測試指令、歸屬寫法)都在載入結果裡,不必再找、不必再讀規章。
工作樹:<工作樹的絕對路徑>(所有讀寫與指令都在這裡)
回報固定六項:指紋(載入結果的第一行,照抄);改了哪些檔;完成了什麼(數字);自己決定的事;GAP 清單(局部序號,四欄);阻塞項。
```

refactor 的 prompt 另加:現在不成立的 law 原文與歸因;決策紀錄「Faked / Unverified」裡要換成真的的列;禁止讀寫任何測試檔、禁止改 Steps 上的簽名與型別宣告、只跑子集、禁止改文檔。修訂目標另附基準線的綠紅數字當護欄,不要自己重跑整庫。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」)。這條里程碑綁的每份文檔都達成 = 這條里程碑正式達成,下一步 `dev-flow:integrate`(要合的分支寫鍵);別條需求還有能開的線就先開(`dev-flow:spike-impl <M-n-slug>`),幾條一起整合;同一條需求的下一條里程碑等這一條整合進主線之後才開;`status` 列了沒有驗收測試的需求或沒有測試的領域不變量,就 `dev-flow:build R-n` / `INV-n`。**需求達成與否不在這裡結案**:驗收測試全綠只代表證據齊了,`status` 會把它列成「待審核」,由開發者親自驗過、`devflow requirement accept` 才算數(`rules/features.md`「需求的達成只有人判得了」);conductor 不代簽,回報裡寫明「等你驗收 R-n」。

## 邊界

不寫測試、不寫實作、不補 law、不改宣告、不替開發者做契約級決定、不事後追認。簽名或型別缺了是 Law 那一層沒做完,回去,不在這裡補。qa 與 refactor 互不可見;qa 先、refactor 後。只動自己這條分支的東西與本波的驗收測試(`rules/roles.md`「誰能動什麼」);驗收測試紅不放寬斷言;不合併、不發 PR。
