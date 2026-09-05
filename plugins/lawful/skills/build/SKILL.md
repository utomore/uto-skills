---
name: build
description: lawful 的建構指揮(conductor)— 對一條 ready 的 pipeline:把 Stages 寫成骨架、先派 qa 拿測試在骨架上跑基線、再派 impl、跑子集、仲裁四分流、全綠後跑整套一次、寫 GAP、里程碑達成改 frozen;不寫測試、不寫實作、不補 law。觸發詞:build、建構、開工、實作這條 pipeline、lawful build、委派。Use when a ready pipeline should be turned into tests and code by delegated qa and impl roles.
user-invocable: true
---

# lawful:build — conductor

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/roles.md` 全份、`rules/pipelines.md`「提問(GAP)」「修訂(REV)」「完成度」、`rules/tooling.md`「CLI」「跑東西的紀律」「收尾定錨」。再讀目標 pipeline 檔、`.lawful/modules.md`、`.lawful/system.md` 的「語言與工具」。

## 前置

`lawful status`:目標是 `ready`、沒有 open GAP、引用的子流達成或同一波先做。不是就停,回報該先做什麼。有 REV 的目標先跑整套當基準線,輸出留檔。

## 步驟

1. **骨架**:每條 stage 的簽名寫進它的模組,本體是 adapter 的 `stub`(Haskell `undefined`);`=` 列照 Stages 組裝。編譯過、`lawful lint sig` 全在。
2. **派 qa**(`lawful:qa`,委派模式,prompt 用下面的模板):給全名、pipeline 檔路徑、types 層模組清單、子集測試指令。
3. **基線**:qa 交付後在骨架上跑 qa 的測試模組,輸出留檔。打到 stub 的要紅、打到型別事實的要綠、REV 保護的要綠(`roles.md`「骨架與基線」)。該紅卻綠退回 qa;該綠卻紅寫成 GAP。回報裡的 GAP 由你寫進 `.lawful/gaps.md` 配號。
4. **派 impl**(`lawful:impl`,委派模式):給全名、pipeline 檔路徑、骨架檔路徑、子集指令;不給測試檔。
5. **判定**:跑本波子集。有紅走仲裁(`roles.md`「仲裁」):每條紅先歸因到哪條 law 或 example,再照四分流處置;每輪只跑上一輪紅的加子集;同一 pipeline 三輪仍紅停止並升級。
6. **整套一次**:本波全綠後跑整套,輸出留檔,`lawful status --tests <log>`。
7. **收尾**(`roles.md`「收尾」):open GAP 清單各附「需要回答什麼」;qa 與 impl 自己決定的事整份列出;`status` 顯示里程碑達成就改 `frozen`。

## 委派 prompt 模板

```
【委派模式】遵守 <L>/rules/roles.md「委派」:不提問、不寫共用檔、提到 pipeline 寫全名、如實回報。
你是 <qa | impl> 角色,執行 lawful:<qa | impl>。
pipeline:<全名>,檔:<路徑>
types 層模組:<清單>(qa 可讀;impl 另給骨架檔路徑)
子集測試指令:<一行>
回報固定五項:改了哪些檔;完成了什麼(數字);自己決定的事;GAP 清單(局部序號,四欄);阻塞項。
```

## 邊界

不寫測試、不寫實作、不補 law、不替開發者做契約級決定、不事後追認。qa 與 impl 互不可見;開發者明說要平行才平行。
