---
name: build
description: lawful 的建構指揮(conductor)— 對一條 ready 的 pipeline:開 build/<全名> 分支與工作樹、把 Stages 寫成骨架、先派 qa 拿測試在骨架上跑基線、再派 impl、跑子集、仲裁四分流、全綠後跑整套一次、寫 GAP、達成改 frozen、寫開發日誌 commit 在分支上;互不引用的 pipeline 可以同時各開一波,合併交給 lawful:integrate;不寫測試、不寫實作、不補 law。觸發詞:build、建構、開工、實作這條 pipeline、lawful build、委派。Use when a ready pipeline should be turned into tests and code by delegated qa and impl roles on its own branch.
user-invocable: true
---

# lawful:build — conductor

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/roles.md` 全份、`rules/pipelines.md`「提問(GAP)」「修訂(REV)」「完成度」、`rules/tooling.md`「CLI」「跑東西的紀律」「收尾定錨」。再讀目標 pipeline 檔、`.lawful/modules.md`、`.lawful/system.md` 的「語言與工具」。

## 前置

在主線、工作樹乾淨(`git status --porcelain` 空)。`lawful status`:目標是 `ready`、沒有 open GAP、不是建構中、引用的每條子流都已達成並在主線上。不是就停,回報該先做什麼;子流還沒合進主線就等它,不替它寫 stub(`roles.md`「分支與所有權」)。

## 步驟

0. **開分支**:`git worktree add -b build/<全名> ../<repo>.worktrees/<全名> HEAD`,記下 HEAD 的 sha(日誌的 `base`)。之後每道指令的工作目錄都是這棵工作樹,委派 prompt 也給它。有 REV 的目標在這棵樹上先跑整套當基準線,輸出留檔。
1. **骨架**:每條 stage 的簽名寫進它的模組並匯出,本體是 adapter 的 `stub`(Haskell `error "P-00x#name stub"`);`=` 列照 Stages 組裝純的整條,`!` 列把它接到 shell。編譯過、`lawful lint sig` 全在、`lawful status --pipeline <全名>` 每列是「骨架」或「在」。commit(訊息帶全名)。
2. **派 qa**(`lawful:qa`,委派模式,prompt 用下面的模板):給全名、pipeline 檔路徑、工作樹路徑、types 層模組清單、子集測試指令。測試模組以全名命名。
3. **基線**:qa 交付後在骨架上跑 qa 的測試模組,輸出留檔。打到 stub 的要紅、打到型別事實的要綠、REV 保護的要綠(`roles.md`「骨架與基線」)。該紅卻綠退回 qa;該綠卻紅寫成 GAP。回報裡的 GAP 由你寫進 `.lawful/gaps.md` 配號,從主線最大號往上。commit。
4. **派 impl**(`lawful:impl`,委派模式):給全名、pipeline 檔路徑、工作樹路徑、骨架檔路徑、子集指令;不給測試檔。
5. **判定**:跑本波子集。有紅走仲裁(`roles.md`「仲裁」):每條紅先歸因到哪條 law 或 example,再照四分流處置;每輪只跑上一輪紅的加子集;同一 pipeline 三輪仍紅停止並升級。commit。
6. **整套一次**:本波全綠後跑整套,輸出留檔,`lawful status --tests <log>`。
7. **收尾**(`roles.md`「收尾」):open GAP 清單各附「需要回答什麼」;qa 與 impl 自己決定的事整份列出;`status` 顯示達成就改 `frozen`。照 `templates/journal.md` 寫 `.lawful/journal/<全名>.md`(`roles.md`「開發日誌」):數字抄 `lawful status --pipeline <全名>`,動到的檔抄 `git diff --stat <base>..HEAD`,決定抄 qa 與 impl 的回報。連同所有改動 commit。回到主線的工作目錄回報;分支留著給 `lawful:integrate`。

## 委派 prompt 模板

```
【委派模式】遵守 <L>/rules/roles.md「委派」:不提問、不寫共用檔、提到 pipeline 寫全名、如實回報。
你是 <qa | impl> 角色,執行 lawful:<qa | impl>。
pipeline:<全名>,檔:<路徑>
工作樹:<路徑>(所有讀寫與指令都在這裡)
types 層模組:<清單>(qa 可讀;impl 另給骨架檔路徑)
子集測試指令:<一行>
回報固定五項:改了哪些檔;完成了什麼(數字);自己決定的事;GAP 清單(局部序號,四欄);阻塞項。
```

## 收尾

定錨區塊(`tooling.md`「收尾定錨」)。下一步:`lawful:integrate`(要合的分支寫全名);還有能開的線就先 `lawful:build <另一條全名>`,幾條一起整合。

## 邊界

不寫測試、不寫實作、不補 law、不替開發者做契約級決定、不事後追認。qa 與 impl 互不可見;開發者明說要平行才平行。只動自己 pipeline 的東西(`roles.md`「分支與所有權」);不合併、不發 PR。
