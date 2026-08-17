---
name: code-audit
description: 專案分析 — 模式 A「status」用腳本掃描 spec/bugfix/enhance 的 metadata 完成度與各子系統(subarch 功能規劃)的進度;模式 B 先掃狀態再拿文檔對照程式碼分析穩健性、解耦、資安、效能、過時套件,產出涵蓋文檔狀態、子系統進度與程式碼發現的 docs/analysis/report。觸發詞:程式碼分析、code audit、專案健檢、status、狀態掃描、進度確認、子系統進度。Use for doc-vs-code analysis or scanning spec/bugfix/enhance completion status and subsystem progress.
user-invocable: true
---

# /code-audit — 專案分析

先讀取 `../_shared/conventions.md`,遵守其中所有文檔慣例。

## 模式判斷

- 引數含 `status` / 「狀態」 / 「進度」 → **模式 A:狀態掃描**(只跑腳本、不產文檔)
- 其他(或無引數) → **模式 B:文檔對照程式碼分析**;範圍不明確時先問開發者。模式 B **包含**模式 A 的狀態掃描,報告要同時涵蓋文檔狀態與程式碼分析

---

## 模式 A — 狀態掃描(只跑腳本,不讀文檔全文)

執行本 skill 目錄下的腳本(解析 spec/bugfix/enhance 的 frontmatter,以及 `docs/arch/` 的架構與子系統狀態):

```
node "<本 SKILL.md 所在目錄>/scripts/scan-status.mjs" [docs目錄,預設 ./docs]
```

腳本輸出兩張表(任務文檔表 + 子系統狀態表)加數個清單,**兩張表都要**整理後呈現給開發者。

### 任務文檔表

- 欄位順序為 `主軸 | id | 子系統 | type | status | created | depends-on | file`;轉成 markdown 表格呈現時**維持這個順序**,讓「主軸」是第一眼看到的欄位、id 與所屬子系統緊接在後
- `主軸`(frontmatter 的 `description`)可直接看出每份文檔在做什麼,不必開檔
- `子系統`由各 `subarch-*` 的「功能規劃」清單回推:spec 直接對應,bug/enhance 經 `related-spec` 推導(值後面加 `*` 表示是推導來的);`-` 代表這份文檔不屬於任何子系統的功能規劃(小專案未拆子系統時正常,已拆子系統時要提醒開發者回填 subarch 的 spec 欄)
- 有 `missing-metadata` 警示時,提醒開發者該檔案缺 frontmatter 或 status 欄位,違反慣例;`主軸` 顯示為 `-` 代表缺 `description`,提醒補上

### 子系統狀態表

- 表頭上方一行是主架構本身(id、主軸、status、`subarchs` 權威清單);顯示「找不到 architecture.md」時提醒開發者先跑 `/arch-design`
- 表格欄位 `主軸 | id | status | 階段 | features | 已建規格 | 已完成 | 進度`:`features` 是該 subarch「功能規劃」列出的 feature 總數、`已建規格` 是已回填 spec id 的數量、`已完成` 是那些 spec 已 done/closed 的數量,`進度` 即子系統完成度
- 欄位顯示 `-` 代表該 subarch 沒有「功能規劃」表格(0.5.0 前建立的舊檔常見),進度無法估算 — 建議用 `/subarch-design` 更新模式補上
- 「子系統待展開的 feature」= 功能規劃有列、`spec` 欄仍是 `-` 的項目,這是下一步 `/func-spec:feature` 的待辦清單
- 「架構 / 子系統不一致」必須逐條轉達,包含:`subarchs` 清單與實際檔案對不上(雙向)、功能規劃指向不存在的 spec、同一份 spec 被兩個子系統認領、subarch 缺 `parent-arch`
- 有「frontmatter 格式不合規」時,把該清單欄位改回行內陣列(`depends-on: [func-0001]`、`subarchs: [subarch-0001]`)再重跑;寫成 YAML 區塊列表時腳本讀不到內容,`depends-on`、`subarchs` 欄會空掉、相依關係與子系統歸屬都不可信

**禁止**為了補充資訊而去讀取各文檔全文 — 此模式的重點就是省 context(subarch 的功能規劃已由腳本解析成進度數字,不必自己開檔)。

## 模式 B — 文檔對照程式碼分析

### 1. 決定分析範圍

- **全局**:對照 architecture.md(及其 `subarchs` 列出的子系統架構)分析整個程式碼庫
- **特定 func-spec**:只分析該 spec 對應的程式碼

不明確就用 AskUserQuestion 問。

### 2. 先跑狀態掃描(必做)

模式 B 的報告必須是**完整**的,所以動手分析前先執行模式 A 的腳本,把結果留著寫進報告:

```
node "<本 SKILL.md 所在目錄>/scripts/scan-status.mjs" [docs目錄,預設 ./docs]
```

- 任務文檔表(`主軸 | id | 子系統 | type | status | created | depends-on | file`)、統計、子系統狀態表、待展開 feature 清單、未完成清單、缺 description 清單、架構不一致清單都要原樣帶進報告
- 未完成(非 done/closed)的項目,分析時要對照程式碼確認「文檔說沒做完,程式碼是不是其實已經做了」以及反過來的情況,把落差寫進報告
- 子系統進度同理:進度顯示 0/N 但程式碼已有該子系統的實作(或反過來標了 done 卻找不到對應程式碼),都要寫進「文檔與程式碼落差」

### 3. Context 載入紀律(嚴格遵守)

只讀:`docs/arch/architecture.md`(舊專案為 `docs/architecture.md`)、與分析範圍相關的 `docs/arch/subarch-*`(全局模式讀全部 subarch;特定 spec 模式只讀該功能所屬子系統)、**最新的**相關 `docs/adr/`、當前目標 func-spec(全局模式則讀 status 非 closed 的 spec)。已 Closed 的 bugfix 檔除非必要否則不載入。狀態表已提供每份文檔的主軸,**不要**為了寫報告去讀文檔全文。

### 4. 分析面向

對照文檔逐項檢查程式碼:

1. **穩健性**:錯誤處理、邊界條件、資源釋放、並發安全
2. **解耦程度**:模組邊界是否清晰、是否符合 architecture.md 與相關 subarch 的架構規劃(含子系統邊界與對外介面)、有無循環依賴
3. **潛在資安問題**:注入、未驗證輸入、秘密硬編碼、不安全的反序列化等
4. **潛在效能疑慮**:N+1、不必要的複製、演算法複雜度與 spec 描述不符
5. **過時語法 / 工具 / 套件**:是否採用已被淘汰或棄用的寫法;套件是否已 deprecated 或有已知漏洞(不確定時可 WebSearch 查證)

### 5. 產出報告 `docs/analysis/report-<YYYY-MM-DD>-<slug>.md`

一份完整報告 = **文檔狀態(步驟 2)+ 程式碼分析(步驟 4)**,兩者缺一不可;下列章節全部都要有,某節沒發現就寫「無」,不要整節刪掉。

```markdown
---
id: report-<date>-<slug>
type: report
title: <slug>
description: <一句話,40 字內:這份報告分析了什麼>
status: done
created: <today>
updated: <today>
related-spec: []        # 分析特定 spec 時填入
---

# 分析報告:<標題>

## 分析範圍
(全局 or 特定 spec;掃了哪些目錄、對照哪些文檔)

## 文檔狀態總覽
(步驟 2 的腳本輸出,轉成 markdown 表格,欄位順序維持 `主軸 | id | 子系統 | type | status | created | depends-on | file`)

### 進度統計
(各 status 的數量;done/closed 佔比)

### 子系統狀態
(主架構一行 + 子系統表格 `主軸 | id | status | 階段 | features | 已建規格 | 已完成 | 進度`;
 附「待展開的 feature」清單與「架構 / 子系統不一致」清單,沒有就寫「無」)

### 未完成項目
(非 done/closed 的清單,附主軸與所屬子系統;未完成的子系統另列一段)

### Metadata 不合規
(missing-metadata、缺 description 的檔案清單;沒有就寫「無」)

### 文檔與程式碼落差
(文檔標 done 但程式碼沒做 / 程式碼已做但文檔還開著 / spec 的 depends-on 指向未完成項目 /
 子系統進度與實際程式碼不符 / 程式碼存在的模組在任何 subarch 功能規劃中都找不到)

## 發現摘要(依嚴重度排序)
## 穩健性
## 解耦程度
## 資安
## 效能
## 過時語法 / 工具 / 套件
## 建議後續行動
```

### 6. 視情況產生後續文檔(先詢問開發者)

兩者的 frontmatter **都必須有 `description`**(一句話主軸,缺了會被 `/code-audit status` 列為不合規)。編號皆為四位數遞增,建檔前先掃該資料夾取最大編號 +1。

- 確定的缺陷 → `docs/bugfix/bug-000x-<slug>.md`,內容:重現方式、根因分析、修復方向、驗證方式

  ```yaml
  ---
  id: bug-000x
  type: bug
  title: <slug>
  description: <一句話,40 字內:什麼壞了>
  status: open
  created: <today>
  updated: <today>
  related-spec: []        # 回鏈到出問題的 spec id
  ---
  ```

- 改善建議 → `docs/enhance/enhance-000x-<slug>.md`,內容:現況、建議做法、預期效益;需要展開成可直接實作的完整改善規格(含介面表、TodoList、1-to-1 測試)時,改用或後續接 `/func-spec:enhance`

  ```yaml
  ---
  id: enhance-000x
  type: enhance
  title: <slug>
  description: <一句話,40 字內:要改善什麼>
  status: open
  created: <today>
  updated: <today>
  related-spec: []        # 回鏈到相關 spec id
  ---
  ```

### 7. 收尾

摘要:報告路徑、文檔進度(done/總數)、子系統進度(各 subarch 的完成度與待展開 feature 數)、metadata 不合規與架構不一致數、發現數量(依嚴重度)、產生了哪些 bug/enhance 檔案。
