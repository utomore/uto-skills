---
name: enhance-impl
description: Level 3 優化實作 — 依指定的優化設計文檔(E00x 或全域 G-E00x)先寫回歸測試保護現有行為,再逐項實作 TodoList、驗證量化目標並回寫狀態;scope 標明不動的範圍絕對不碰。觸發詞:優化實作、enhance impl、實作優化、重構實作、執行優化。Use when implementing code from an enhancement design document.
user-invocable: true
---

# /enhance-impl — Level 3 優化實作

先讀取 `../_shared/conventions.md`(核心慣例)與 `../_shared/boundary-rules.md`(**邊界判斷規則** + 實作階段規則)。本 skill 只改既有文檔的 `status` / `updated`,不需要 `../_shared/frontmatter.md`;收尾時另讀 `../_shared/anchor.md`(定錨區塊格式)。

## 實作自主權與範圍紀律(本階段的核心原則)

符合文檔「介面變動」定案的公開介面與 DTO 的前提下,內部實作(演算法、私有輔助函數、內部狀態)由你自主決定,**不得**為了內部選擇回頭改架構文檔。文檔沒涵蓋的情況照 `boundary-rules.md`「層級判斷」分流:實作層級自己決定並記進「實作備註」;架構層級停下來按發問協議問。

## 1. 確定目標文檔

- 開發者有指定(id 如 `E001` / `auth/E001` / `G-E001`,或檔名、路徑、描述)→ 在 `.design/subsystems/*/enhancements/` 或 `.design/enhancements/` 找到對應檔案;有歧義時列出候選讓開發者確認
- 沒指定 → 執行 `node "<arch-audit skill 目錄>/scripts/scan-status.mjs" .design` 列出未完成項目,用 AskUserQuestion 讓開發者選

## 2. 載入 context(遵守載入紀律)

- 目標文檔全文 + `.design/system.md` + 相關子系統的 `design.md`(子系統文檔讀所屬子系統;全域 G-E 文檔讀 frontmatter `subsystems` 列出的每一個)+ `related-adr` 的 ADR + `related-feature` 指向的 feature 文檔
- 目標的 `depends-on` 非空 → 先確認被依賴的文檔是否已 done;未完成時警告開發者並詢問是否繼續
- 文檔「現況分析」指到的原始碼位置,**動工前先打開確認現況仍如文檔所述**;已漂移就先回報開發者再議

## 3. 實作

1. 開工前:目標文檔 `status` 改 `in-progress`、更新 `updated`
2. **回歸測試優先**:「1-to-1 測試對照表」中保護現有行為的回歸測試先寫、先跑綠,再動手改
3. 依 TodoList **逐項**實作;`dep:` 前置未完成不得開工該項;**每完成一項就勾掉 checkbox** 並更新 `updated`
4. **Scope 紀律**:文檔「Scope」標明**不動**的範圍絕對不碰;實作中發現必須越界時,停下來與開發者確認(可能要回 `/enhance-design` 擴 scope 或另開文檔)
5. 公開介面以「介面變動」為準;發現方案行不通或介面需偏離時,先與開發者確認,把偏差寫進「實作備註」
6. **依賴檢查(每次提交前自查)**:本次改動新增 / 移除了哪些 import 方向?與文檔「介面變動」對不上 = 架構變更,停下來發問。核心層有沒有冒出表現層 / 前端 / 測試的概念?有 → 移除

## 4. 測試(1-to-1)

- 按對照表撰寫每一條測試,Todo 與測試一一對應;回歸測試全程保持綠燈
- **預設只測公開介面**,要看內部時走 `*.Internal`;**不得為測試在核心層開後門**——不開後門就測不到 = 介面設計缺陷,停下來回報(`boundary-rules.md`「測試政策」)
- 執行完整測試,**如實回報結果**:失敗就貼出輸出並修復,不得宣稱通過

## 5. 收尾

- 全部 Todo 完成且測試通過 → `status` 改 `done`、更新 `updated`
- 在「實作備註」記錄改善目標的**量化結果**(改善前後的數字或狀態,對照「改善目標」的驗收標準)
- 專案有程式碼知識圖時,依 `../_shared/codegraph.md`「目前的產生器」表的更新指令讓圖跟上這次的改動(重構會大幅改變依賴關係,圖不更新會誤導下一次架構檢測);沒有圖或跑不動就略過並在摘要提一句
- 摘要給開發者:完成了哪些 Todo、量化結果、測試結果、文檔狀態變更、有無偏差記錄;另外列出**新增/移除的依賴邊**、做過的**實作層級決定**、**發現但沒做的事**(這三項直接進 PR 描述)
- 最後輸出**定錨區塊**(`../_shared/anchor.md`):位置樹把本文檔標為「目前」,其下列「介面變動」各條的狀態;scope 標明不動的範圍若被碰到,必上偏離清單;下一步從樹上推(常見:`/arch-audit subsys <slug>` 確認重構後的邊界,或 `/branch-pr`)
