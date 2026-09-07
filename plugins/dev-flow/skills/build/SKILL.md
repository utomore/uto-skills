---
name: build
description: dev-flow 的建構指揮(conductor)— 對一份 ready 的文檔:把 Steps 寫成骨架、先派 qa 拿測試在骨架快照上跑基線、再派 impl、跑子集、仲裁四分流、全綠後跑整套一次、寫 GAP、達成後改 frozen;不寫測試、不寫實作、不補 law。觸發詞:build、建構、開工、實作這份、跑 feature、dev-flow build、委派開發、批次開發。Use when a ready feature or abstract should be turned into tests and code by delegated qa and impl roles.
user-invocable: true
---

# dev-flow:build — conductor

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/roles.md` 全份、`rules/features.md`「提問(GAP)」「修訂(REV)」「完成度」、`rules/tooling.md`「CLI」「測試歸屬」「跑東西的紀律」「收尾定錨」。再讀目標文檔、`.design/modules.md`、`.design/system.md` 的「語言與工具」。

## 前置

`devflow status`:目標是 `ready`、沒有 open GAP、引用的 abstract 達成或同一波先做。不是就停,回報該先做什麼。有 REV 的目標先跑整套當基準線,輸出留檔。

## 步驟

1. **骨架**:每條 step 的簽名寫進它的檔案並匯出,本體是該語言的骨架標記(`roles.md`「骨架與基線」的表),訊息帶 `F-00x#name`;`=` 列照 Steps 組裝整條,`!` 列把它接到最外層。**不得回傳假值。** 編譯過、`devflow lint sig` 全在、`devflow status --doc <全名>` 每列是「骨架」或「在」。
2. **記快照**:發任何委派之前記下 `HEAD` 的 sha,`git worktree add --detach <路徑> <sha>` 建好快照工作樹。先建好再用,不要等發現骨架被動過才建。
3. **派 qa**(`dev-flow:qa`,`model: "sonnet"`,prompt 用下面的模板):給全名、文檔路徑、最內層的檔案清單、子集測試指令。
4. **基線**:qa 交付後把測試檔複製進快照工作樹跑一次,輸出留檔。打到骨架標記的要紅、打到型別事實的要綠、REV 保護的要綠。該紅卻綠退回 qa;該綠卻紅寫成 GAP。驗完移除 worktree;環境帶不過去就明寫「本波 qa 紅綠未驗證」,不得默認通過。回報裡的 GAP 由你寫進 `.design/gaps.md` 配號。
5. **派 impl**(`dev-flow:impl`,`model: "sonnet"`):給全名、文檔路徑、骨架檔路徑、子集指令;**不給測試檔**。
6. **判定**:跑本波子集。有紅走仲裁(`roles.md`「仲裁」):每條紅先歸因到哪條 law 或 example,再照四分流處置;每輪只跑上一輪紅的加子集;同一份三輪仍紅停止並升級。
7. **整套一次**:本波全綠後跑整套,輸出留檔,`devflow status --tests <log>`。
8. **收尾**(`roles.md`「收尾」):open GAP 清單各附「需要回答什麼」;qa 與 impl 自己決定的事整份列出;`status` 顯示達成就改 `frozen`。

## 委派 prompt 模板

```
【委派模式】遵守 <D>/rules/roles.md「委派」:不提問、不寫共用檔、提到文檔寫全名、如實回報。
你是 <qa | impl> 角色,執行 dev-flow:<qa | impl>。
文檔:<全名>,檔:<路徑>
最內層檔案:<清單>(qa 可讀;impl 另給骨架檔路徑)
子集測試指令:<一行>
歸屬寫法:<字串 "F-00x#LAW-n" 或識別字 f_00x__law_n,依語言>
回報固定五項:改了哪些檔;完成了什麼(數字);自己決定的事;GAP 清單(局部序號,四欄);阻塞項。
```

impl 的 prompt 另加:禁止讀寫任何測試檔、禁止改簽名與型別、只跑子集、禁止改 frontmatter。修訂目標另附基準線的綠紅數字當護欄,不要自己重跑整庫。

## 邊界

不寫測試、不寫實作、不補 law、不替開發者做契約級決定、不事後追認。qa 與 impl 互不可見;開發者明說要平行才平行。
