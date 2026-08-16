---
name: spec-impl
description: 依文檔開發 — 根據 func-spec、bugfix 或 enhance 文件實作,逐項完成 TodoList 並執行 1-to-1 測試,同步回寫文檔狀態。觸發詞:實作 spec、開發功能、修 bug、bug fix、enhance 實作、implement spec。Use when implementing code from a func-spec, bugfix, or enhance document.
user-invocable: true
---

# /spec-impl — 依文檔開發

先讀取 `../_shared/conventions.md`,遵守其中所有文檔慣例。

## 1. 確定目標文檔

- 開發者有給 id(`func-XXXX` / `bug-XXXX` / `enhance-XXXX`)→ 在 `docs/spec|bugfix|enhance/` 找到對應檔案
- 沒給 → 執行 `node "<code-audit skill 目錄>/scripts/scan-status.mjs" docs` 列出未完成項目,用 AskUserQuestion 讓開發者選

## 2. 載入 context(遵守載入紀律)

- 目標文檔全文 + `docs/architecture.md` + frontmatter `related-adr` 列出的 ADR
- bug / enhance 另讀 `related-spec` 指向的規格
- 目標是 spec 且 `depends-on` 非空 → 先確認被依賴的 spec 是否已 done;未完成時警告開發者並詢問是否繼續

## 3. 實作

1. 開工前:目標文檔 `status` 改為 `in-progress`、更新 `updated`
2. 依 TodoList **逐項**實作;**每完成一項就把該 checkbox 勾掉**(`- [x]`)並更新 `updated`
3. 實作方式以文檔為準;發現文檔方案行不通或需偏離時,先與開發者確認,並把偏差寫進文檔的「實作備註」節
4. 程式碼風格遵循專案既有慣例與 architecture.md 的架構規劃

## 4. 測試(1-to-1)

- 按文檔的「1-to-1 測試對照表」撰寫每一條測試,確保 Todo 與測試一一對應
- 執行完整測試,**如實回報結果**:失敗就貼出輸出並修復,不得宣稱通過

## 5. 收尾

- 全部 Todo 完成且測試通過 → `status` 改 `done`、更新 `updated`
- bug 檔:在文內補上根因與修法摘要
- 摘要給開發者:完成了哪些 Todo、測試結果、文檔狀態變更、有無偏差記錄
- 提醒:可用 `/branch-pr` 整合分支發 PR,或用 `/code-audit status` 檢視整體進度
