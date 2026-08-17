---
name: spec-impl
description: 依文檔開發 — 開發者指定要實作哪一份文檔(feature 規格 func-XXXX、改善規格 enhance-XXXX、缺陷 bug-XXXX),依該文檔的 TodoList 或修復方向實作、執行 1-to-1 測試並回寫狀態。觸發詞:實作 spec、開發功能、修 bug、bug fix、enhance 實作、implement spec、依文檔開發。Use when implementing code from a func-spec, enhance, or bugfix document.
user-invocable: true
---

# /spec-impl — 依文檔開發

先讀取 `../_shared/conventions.md`,遵守其中所有文檔慣例。

本 skill 不限於 func-spec:**任何可實作的文檔都能執行**——新功能(`docs/spec/func-XXXX`)、改善優化(`docs/enhance/enhance-XXXX`)、缺陷修復(`docs/bugfix/bug-XXXX`)。開發者直接告訴你要看哪一份來實作。

## 1. 確定目標文檔

- 開發者有指定(id `func-XXXX` / `enhance-XXXX` / `bug-XXXX`,或檔名、路徑、功能描述)→ 在 `docs/spec|enhance|bugfix/` 找到對應檔案;用描述指定而比對到多份時,列出候選讓開發者確認
- 沒指定 → 執行 `node "<code-audit skill 目錄>/scripts/scan-status.mjs" docs` 列出未完成項目,用 AskUserQuestion 讓開發者選

## 2. 載入 context(遵守載入紀律)

- 目標文檔全文 + `docs/arch/architecture.md`(舊專案為 `docs/architecture.md`)+ frontmatter `related-adr` 列出的 ADR
- 目標落在某個子系統(主架構 `subarchs` 有對應文件)時,加讀該 `docs/arch/subarch-*`;不相關的子系統不讀
- bug / enhance 另讀 `related-spec` 指向的規格
- 目標的 `depends-on` 非空 → 先確認被依賴的 spec/enhance 是否已 done;未完成時警告開發者並詢問是否繼續
- enhance 檔的「現況分析」指到的原始碼位置,動工前先打開確認現況仍如文檔所述;已漂移就先回報開發者再議

## 3. 實作

1. 開工前:目標文檔 `status` 改為 `in-progress`、更新 `updated`
2. **有 TodoList 的文檔**(func-spec、enhance,及部分 bug 檔):依 TodoList **逐項**實作;項目帶 `dep:` 標註時,先確認其前置 Todo 已完成、引用的 spec id 已 done,否則不得開工該項;**每完成一項就把該 checkbox 勾掉**(`- [x]`)並更新 `updated`
3. **沒有 TodoList 的 bug 檔**(如 `/code-audit` 產出的缺陷紀錄):依「根因分析」與「修復方向」實作;動工前先把修復步驟整理成 TodoList 補進文檔,再逐項執行與勾選,讓進度可追蹤
4. 實作方式以文檔為準;發現文檔方案行不通或需偏離時,先與開發者確認,並把偏差寫進文檔的「實作備註」節(bug 檔無此節時新增)
5. 程式碼風格遵循專案既有慣例與 architecture.md(及相關 subarch)的架構規劃;enhance 檔標明「不動」的範圍**絕對不碰**

## 4. 測試(1-to-1)

- 文檔有「1-to-1 測試對照表」(func-spec、enhance)→ 按表撰寫每一條測試,確保 Todo 與測試一一對應;enhance 檔的回歸測試優先寫,先保護現有行為再動手改
- bug 檔 → 以「驗證方式」為依據,**先寫一條能重現缺陷的測試**(修復前應失敗),修復後轉綠,並保留為回歸測試
- 執行完整測試,**如實回報結果**:失敗就貼出輸出並修復,不得宣稱通過

## 5. 收尾

- 全部 Todo 完成且測試通過 → `status` 改 `done`、更新 `updated`
- bug 檔:在文內補上根因與修法摘要
- enhance 檔:在「實作備註」記錄改善目標的量化結果(改善前後的數字或狀態)
- 摘要給開發者:完成了哪些 Todo、測試結果、文檔狀態變更、有無偏差記錄
- 提醒:可用 `/branch-pr` 整合分支發 PR,或用 `/code-audit status` 檢視整體進度
