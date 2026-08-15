---
name: arch-design
description: 專案初始架構設計 — 透過深度訪談產出 docs/architecture.md 與 ADR 文件。觸發詞:架構設計、architecture、ADR、專案初始化、技術選型、系統設計、開新專案。Use when starting a new project, designing system architecture, or recording architecture decisions (ADR).
user-invocable: true
---

# /arch-design — 專案初始架構設計

先讀取本檔同層的 `../_shared/conventions.md`,遵守其中所有文檔慣例(資料夾結構、命名、frontmatter)。

## 目標

產出專案的燈塔文件 `docs/architecture.md` 與對應的 `docs/adr/adr-000x-<slug>.md`,確立整體專案方向與指引。**在需求與架構明確之前,禁止產出任何文件。**

## 模式判斷

- `docs/architecture.md` 不存在 → **初始模式**:完整訪談後從零產出
- 已存在 → **更新模式**:先讀取現有內容,針對要調整的部分訪談,更新文件並視情況新增 ADR

## 流程

### 1. 訪談階段(核心,不可跳過)

分多輪「瘋狂詢問」開發者,直到需求與架構完全明確。**不確定就再問,禁止自行腦補需求。** 選擇題用 AskUserQuestion,開放式問題直接問。必須涵蓋:

1. **需求釐清**:這個專案要解決什麼問題?核心功能有哪些?誰會使用?希望的功能清單與優先順序?
2. **垂直切片分析**:把需求切成端到端的垂直切片,和開發者確認切片邊界
3. **專案體量評估**:預期規模(原型/工具/長期產品)、資料量、使用者量、效能要求
4. **技術選型**:語言、框架、執行環境 — 每個選擇都要問偏好並給出建議與理由
5. **資料儲存**:要儲存什麼資料?用什麼儲存(檔案/SQLite/PostgreSQL/其他)?資料結構的框架格式?
6. **關鍵演算法**:核心邏輯用什麼演算法?有無效能或正確性的取捨?
7. **開發階段切分**:整個專案分幾個階段?每階段的里程碑?

每輪訪談後摘要目前已確認的內容,列出仍不明確的點繼續問。全部明確後,向開發者做最終確認再產出。

### 2. 產出 `docs/architecture.md`

內文繁體中文,固定章節:

```markdown
---
id: architecture
type: architecture
title: <project-slug>
status: active
created: <today>
updated: <today>
---

# <專案名稱> 系統架構

## 需求說明
## 架構規劃(含垂直切片說明)
## 使用的技術
## 架構圖
(ASCII 繪製,呈現元件與資料流)
## 資料結構的框架格式
## 使用到的套件
## 開發階段
```

### 3. 產出 ADR

每個**重大技術選擇**(語言/框架、儲存方案、關鍵演算法、重要套件)各產出一份 `docs/adr/adr-000x-<slug>.md`,編號遞增,標準 ADR 格式:

```markdown
---
id: adr-0001
type: adr
title: <decision-slug>
status: accepted        # proposed | accepted | superseded
created: <today>
updated: <today>
---

# ADR-0001: <決策標題>

## 狀態(Status)
## 背景(Context)
## 決策(Decision)
## 考慮過的替代方案(Alternatives Considered)
## 影響(Consequences)
```

### 4. 收尾

- 向開發者摘要:產出了哪些檔案、架構重點、各階段規劃
- 說明 `docs/architecture.md` 是專案燈塔,之後 `/func-spec` 撰寫規格都會以它為依據;`docs/adr/` 未來有新決策會持續擴充
