---
name: build
description: dev-flow 的建構指揮(conductor)— 對一份 ready 的文檔:開 build/<全名> 分支與工作樹、把 Steps 寫成骨架、先派 qa 拿測試在骨架快照上跑基線、再派 impl、跑子集、仲裁四分流、全綠後跑整套一次、寫 GAP、達成後改 frozen、寫開發日誌 commit 在分支上;互不引用的文檔可以同時各開一波,合併交給 dev-flow:integrate;不寫測試、不寫實作、不補 law。觸發詞:build、建構、開工、實作這份、跑 feature、dev-flow build、委派開發、批次開發。Use when a ready feature or abstract should be turned into tests and code by delegated qa and impl roles on its own branch.
user-invocable: true
---

# dev-flow:build — conductor

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/roles.md` 全份、`rules/features.md`「提問(GAP)」「修訂(REV)」「完成度」、`rules/tooling.md`「CLI」「測試歸屬」「跑東西的紀律」「收尾定錨」。再讀目標文檔、`.design/modules.md`、`.design/system.md` 的「語言與工具」。

## 前置

在主線、工作樹乾淨(`git status --porcelain` 空)。`devflow status`:目標是 `ready`、沒有 open GAP、不是建構中、引用的每份 abstract 都已達成並在主線上。不是就停,回報該先做什麼;abstract 還沒合進主線就等它,不替它寫骨架(`roles.md`「分支與所有權」)。

## 步驟

0. **開分支**:`git worktree add -b build/<全名> ../<repo>.worktrees/<全名> HEAD`,記下 HEAD 的 sha(日誌的 `base`)。之後每道指令的工作目錄都是這棵工作樹,委派 prompt 也給它。有 REV 的目標在這棵樹上先跑整套當基準線,輸出留檔。
1. **骨架**:每條 step 的簽名寫進它的檔案並匯出,本體是該語言的骨架標記(`roles.md`「骨架與基線」的表),訊息帶 `F-00x#name`;`=` 列照 Steps 組裝整條,`!` 列把它接到最外層。**不得回傳假值。** 編譯過、`devflow lint sig` 全在、`devflow status --doc <全名>` 每列是「骨架」或「在」。commit(訊息帶全名)。
2. **記快照**:發任何委派之前記下骨架那個 commit 的 sha,`git worktree add --detach <路徑> <sha>` 建好快照工作樹(建構工作樹之外的第二棵)。先建好再用,不要等發現骨架被動過才建。
3. **派 qa**(`dev-flow:qa`,`model: "sonnet"`,prompt 用下面的模板):給全名、文檔路徑、建構工作樹路徑、最內層的檔案清單、子集測試指令。測試檔以全名命名。
4. **基線**:qa 交付後把測試檔複製進快照工作樹跑一次,輸出留檔。打到骨架標記的要紅、打到型別事實的要綠、REV 保護的要綠。該紅卻綠退回 qa;該綠卻紅寫成 GAP。驗完移除快照 worktree;環境帶不過去就明寫「本波 qa 紅綠未驗證」,不得默認通過。回報裡的 GAP 由你寫進 `.design/gaps.md` 配號,從主線最大號往上。commit。
5. **派 impl**(`dev-flow:impl`,`model: "sonnet"`):給全名、文檔路徑、建構工作樹路徑、骨架檔路徑、子集指令;**不給測試檔**。
6. **判定**:跑本波子集。有紅走仲裁(`roles.md`「仲裁」):每條紅先歸因到哪條 law 或 example,再照四分流處置;每輪只跑上一輪紅的加子集;同一份三輪仍紅停止並升級。commit。
7. **整套一次**:本波全綠後跑整套,輸出留檔,`devflow status --tests <log>`。
8. **收尾**(`roles.md`「收尾」):open GAP 清單各附「需要回答什麼」;qa 與 impl 自己決定的事整份列出;`status` 顯示達成就改 `frozen`。照 `templates/journal.md` 寫 `.design/journal/<全名>.md`(`roles.md`「開發日誌」):數字抄 `devflow status --doc <全名>`,動到的檔抄 `git diff --stat <base>..HEAD`,決定抄 qa 與 impl 的回報。連同所有改動 commit。回到主線的工作目錄回報;分支留著給 `dev-flow:integrate`。

## 委派 prompt 模板

```
【委派模式】遵守 <D>/rules/roles.md「委派」:不提問、不寫共用檔、提到文檔寫全名、如實回報。
你是 <qa | impl> 角色,執行 dev-flow:<qa | impl>。
文檔:<全名>,檔:<路徑>
工作樹:<路徑>(所有讀寫與指令都在這裡)
最內層檔案:<清單>(qa 可讀;impl 另給骨架檔路徑)
子集測試指令:<一行>
歸屬寫法:<字串 "F-00x#LAW-n" 或識別字 f_00x__law_n,依語言>
回報固定五項:改了哪些檔;完成了什麼(數字);自己決定的事;GAP 清單(局部序號,四欄);阻塞項。
```

impl 的 prompt 另加:禁止讀寫任何測試檔、禁止改簽名與型別、只跑子集、禁止改 frontmatter。修訂目標另附基準線的綠紅數字當護欄,不要自己重跑整庫。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」)。下一步:`dev-flow:integrate`(要合的分支寫全名);還有能開的線就先 `dev-flow:build <另一份全名>`,幾條一起整合。

## 邊界

不寫測試、不寫實作、不補 law、不替開發者做契約級決定、不事後追認。qa 與 impl 互不可見;開發者明說要平行才平行。只動自己這份文檔的東西(`roles.md`「分支與所有權」);不合併、不發 PR。
