---
name: feature-impl
description: Level 3 功能實作 — 依指定的 feature 設計文檔(如 auth/F001)逐項實作 TodoList、執行 1-to-1 測試並回寫狀態;在 Level 2 契約內擁有完全的內部實作自主權。觸發詞:功能實作、feature impl、實作功能、開發功能、implement feature。Use when implementing code from a feature design document.
user-invocable: true
---

# /feature-impl — Level 3 功能實作

先讀取 `../_shared/conventions.md`,遵守其中所有文檔慣例。

## 實作自主權(本階段的核心原則)

只要符合上層定義的 Public Interface 與 DTO 規範,你擁有**完全的內部實作自主權**:內部演算法選擇、私有輔助函數、私有變數命名、內部狀態設計都由你決定,不需要也**不得**為了這些內部選擇回頭修改架構文檔。只有「邊界契約本身要變」才回頭走設計流程。

## 委派模式(prompt 標明【委派模式】時)

被 `/subsys-build` 委派執行時,先讀 `../_shared/conventions.md` 的「委派模式共通契約」,並對本 skill 做以下替換(**沒有這個標記時完全不適用,照原流程走**):

| 步驟 | 委派模式下的作法 |
|---|---|
| 1. 確定目標文檔 | **跳過選檔**。文檔 id 由編排者在 prompt 指定,不跑 scan-status、不用 AskUserQuestion |
| 2. 載入 context | 照原規則。`depends-on` 未完成時**不詢問是否繼續**:依編排者 prompt 給的前置狀態判斷——前置未 done 就不動工,記為阻塞項回報 |
| 3. 實作 | 照原規則。**唯一差別**:發現「文檔方案行不通」或「公開介面需偏離契約」時,原本要問開發者——委派模式下改為**停下該 Todo**(不擅自改契約、也不硬做),寫進「實作備註」與「待確認假設」,列為阻塞項回報 |
| 4. 測試 | 照原規則,**如實回報**。失敗就貼輸出並嘗試修復;修不掉就列為阻塞項,**絕不宣稱通過** |
| 回寫架構文檔 | **不做**。要改 `design.md` / `system.md` 的,寫進回報給編排者裁決 |
| 5. 收尾 | 全綠才把 `status` 改 `done`;有阻塞項則留 `in-progress`。輸出改為 conventions 定義的**結構化回報** |

實作階段的自主權在委派模式下**完全不變**——內部演算法、私有函數、變數命名照樣由你決定,不需要為這些記假設或回報。只有「碰到契約邊界」才需要停下來。

## 1. 確定目標文檔

- 開發者有指定(id 如 `F001` / `auth/F001`,或檔名、路徑、功能描述)→ 在 `.design/subsystems/*/features/` 找到對應檔案;只給 `F001` 而多個子系統都有時,列出候選讓開發者確認
- 沒指定 → 執行 `node "<arch-audit skill 目錄>/scripts/scan-status.mjs" .design` 列出未完成項目,用 AskUserQuestion 讓開發者選

## 2. 載入 context(遵守載入紀律)

- 目標文檔全文 + `.design/system.md` + 所屬子系統的 `design.md` + frontmatter `related-adr` 列出的 ADR;不相關的子系統不讀
- 目標的 `depends-on` 非空 → 先確認被依賴的文檔是否已 done;未完成時警告開發者並詢問是否繼續
- 目標「對應的 Level 2 契約」引用的介面,動工前先確認 `design.md` 的定義仍如文檔所述;已漂移就先回報開發者再議

## 3. 實作

1. 開工前:目標文檔 `status` 改 `in-progress`、更新 `updated`
2. 依 TodoList **逐項**實作;項目帶 `dep:` 標註時,先確認前置 Todo 已完成、引用的文檔 id 已 done,否則不得開工該項;**每完成一項就把該 checkbox 勾掉**(`- [x]`)並更新 `updated`
3. 公開介面以文檔的「新增的介面」「對應的 Level 2 契約」為準;內部實作自主決定。發現文檔方案行不通或公開介面需偏離時,先與開發者確認,並把偏差寫進「實作備註」
4. 程式碼風格遵循專案既有慣例;不得越過子系統邊界直接存取其他子系統的內部模組(只能走對方的對外契約)

## 4. 測試(1-to-1)

- 按「1-to-1 測試對照表」撰寫每一條測試,確保 Todo 與測試一一對應
- 測試覆蓋邊界條件、正常流程與例外流程
- 執行完整測試,**如實回報結果**:失敗就貼出輸出並修復,不得宣稱通過

## 5. 收尾

- 全部 Todo 完成且測試通過 → `status` 改 `done`、更新 `updated`
- 摘要給開發者:完成了哪些 Todo、測試結果、文檔狀態變更、有無偏差記錄
- 提醒:可用 `/branch-pr` 整合分支發 PR,或用 `/arch-audit status` 檢視整體進度;整個子系統還有多個 feature 待做時,可用 `/subsys-build <slug>` 委派展開剩下的階段
