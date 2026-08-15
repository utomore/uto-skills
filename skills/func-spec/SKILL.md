---
name: func-spec
description: 撰寫新功能規格書 — 參考 architecture.md 與 ADR,深度討論後產出 docs/spec/func-000x-<slug>.md,含相依性、介面、TodoList 與 1-to-1 測試。觸發詞:功能規格、func spec、新功能、規格書、feature spec。Use when specifying a new feature before implementation.
user-invocable: true
---

# /func-spec — 新功能規格書

先讀取 `../_shared/conventions.md`,遵守其中所有文檔慣例。

## 前置

1. 讀取 `docs/architecture.md`(燈塔文件)。**不存在時**:告知開發者建議先執行 `/arch-design`,除非開發者明確要求直接寫 spec
2. 讀取與本功能相關的 `docs/adr/` 文件(依主題挑選,不必全讀)
3. 掃描 `docs/spec/` 現有檔名,決定新編號(最大值 +1)

## 流程

### 1. 深度討論(不可跳過)

與開發者反覆討論直到功能完全明確,**不確定就問,禁止腦補**:

- 功能邊界:做什麼、不做什麼
- 與 architecture.md 中哪個垂直切片/階段對應
- 資料流:輸入、處理、輸出、儲存變化
- **相依性**:依賴哪些已存在或進行中的 spec?→ 這決定了任務能否與其他 spec 平行開發
- 介面:會用到哪些既有介面?需要新增哪些介面?
- 驗收標準:怎樣算完成?

### 2. 產出 `docs/spec/func-000x-<slug>.md`

檔名英文 kebab-case、內文繁體中文,固定結構:

```markdown
---
id: func-000x
type: spec
title: <slug>
status: open
created: <today>
updated: <today>
depends-on: []          # 依賴的 spec id;空陣列 = 可平行開發
related-adr: []
related-spec: []
---

# <功能名稱> 功能規格

## 功能概述
(要解決的問題、驗收標準)

## 相依性
(frontmatter depends-on 的文字說明:依賴哪些 spec、為什麼、
 是否可與其他進行中任務平行處理)

## 實作方式
(細到可直接開工:模組劃分、資料流、演算法、錯誤處理)

## 使用到的既有串接介面
(列出會呼叫的既有函式/API/模組,含簽名)

## 新增的介面
(本功能會新增的函式/API/模組定義,含簽名與說明)

## TodoList
- [ ] T1: <任務>
- [ ] T2: <任務>

## 1-to-1 測試對照表
| Todo | 測試 | 說明 |
|------|------|------|
| T1   | test_xxx | <驗證什麼> |
| T2   | test_yyy | <驗證什麼> |

## 實作備註
(開發過程中與規格的偏差記錄於此,撰寫時留空)
```

TodoList 的每一項都必須在測試對照表有對應的一條測試(1-to-1)。

### 3. 回頭檢查 architecture.md(必做)

寫完 spec 後,比對 `docs/architecture.md`:

- 是否引入了新技術、新套件、新資料結構、新階段?
- 架構圖是否需要反映新元件?

需要更新時:列出差異給開發者確認,同意後更新 architecture.md(同步 `updated`);若涉及新的重大技術決策,同時補一份 ADR。

### 4. 收尾

摘要:spec 檔案路徑、編號、相依性結論(可否平行)、architecture.md 是否有更新。
