---
name: code-audit
description: 專案分析 — 模式 A「status」用腳本掃描 spec/bugfix/enhance 的 metadata 完成度;模式 B 拿文檔對照程式碼分析穩健性、解耦、資安、效能、過時套件,產出 docs/analysis/report。觸發詞:程式碼分析、code audit、專案健檢、status、狀態掃描、進度確認。Use for doc-vs-code analysis or scanning spec/bugfix/enhance completion status.
user-invocable: true
---

# /code-audit — 專案分析

先讀取 `../_shared/conventions.md`,遵守其中所有文檔慣例。

## 模式判斷

- 引數含 `status` / 「狀態」 / 「進度」 → **模式 A:狀態掃描**
- 其他(或無引數) → **模式 B:文檔對照程式碼分析**;範圍不明確時先問開發者

---

## 模式 A — 狀態掃描(只跑腳本,不讀文檔全文)

執行本 skill 目錄下的腳本(只解析 frontmatter metadata):

```
node "<本 SKILL.md 所在目錄>/scripts/scan-status.mjs" [docs目錄,預設 ./docs]
```

- 把腳本輸出(表格 + 統計 + 未完成清單)整理後呈現給開發者
- 有 `missing-metadata` 警示時,提醒開發者該檔案缺 frontmatter 或 status 欄位,違反慣例
- **禁止**為了補充資訊而去讀取各文檔全文 — 此模式的重點就是省 context

## 模式 B — 文檔對照程式碼分析

### 1. 決定分析範圍

- **全局**:對照 architecture.md 分析整個程式碼庫
- **特定 func-spec**:只分析該 spec 對應的程式碼

不明確就用 AskUserQuestion 問。

### 2. Context 載入紀律(嚴格遵守)

只讀:`docs/architecture.md`、**最新的**相關 `docs/adr/`、當前目標 func-spec(全局模式則讀 status 非 closed 的 spec)。已 Closed 的 bugfix 檔除非必要否則不載入。

### 3. 分析面向

對照文檔逐項檢查程式碼:

1. **穩健性**:錯誤處理、邊界條件、資源釋放、並發安全
2. **解耦程度**:模組邊界是否清晰、是否符合 architecture.md 的架構規劃、有無循環依賴
3. **潛在資安問題**:注入、未驗證輸入、秘密硬編碼、不安全的反序列化等
4. **潛在效能疑慮**:N+1、不必要的複製、演算法複雜度與 spec 描述不符
5. **過時語法 / 工具 / 套件**:是否採用已被淘汰或棄用的寫法;套件是否已 deprecated 或有已知漏洞(不確定時可 WebSearch 查證)

### 4. 產出報告 `docs/analysis/report-<YYYY-MM-DD>-<slug>.md`

```markdown
---
id: report-<date>-<slug>
type: report
title: <slug>
status: done
created: <today>
updated: <today>
related-spec: []        # 分析特定 spec 時填入
---

# 分析報告:<標題>

## 分析範圍
## 發現摘要(依嚴重度排序)
## 穩健性
## 解耦程度
## 資安
## 效能
## 過時語法 / 工具 / 套件
## 建議後續行動
```

### 5. 視情況產生後續文檔(先詢問開發者)

- 確定的缺陷 → `docs/bugfix/bug-000x-<slug>.md`(編號遞增,status: open,`related-spec` 回鏈,內容:重現方式、根因分析、修復方向、驗證方式)
- 改善建議 → `docs/enhance/enhance-<YYYY-MM-DD>-<slug>.md`(status: open,`related-spec` 回鏈,內容:現況、建議做法、預期效益)

### 6. 收尾

摘要:報告路徑、發現數量(依嚴重度)、產生了哪些 bug/enhance 檔案。
