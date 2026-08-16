# 開發流程文檔慣例(共用)

所有開發流程 skills(arch-design、func-spec、code-audit、spec-impl、branch-pr)共用本慣例。

## 資料夾結構(專案內)

```
docs/
├── architecture.md                        # 專案燈塔:需求、架構、技術、階段
├── adr/
│   └── adr-0001-<slug>.md                 # 架構決策紀錄
├── spec/
│   └── func-0001-<slug>.md                # 功能規格書
├── analysis/
│   └── report-<YYYY-MM-DD>-<slug>.md      # 分析報告
├── bugfix/
│   └── bug-0001-<slug>.md                 # 缺陷紀錄
└── enhance/
    └── enhance-<YYYY-MM-DD>-<slug>.md     # 改善提案
```

## 命名規則

- 檔名一律**英文 kebab-case**;內文一律**繁體中文**
- 編號四位數遞增(`func-0001`、`bug-0001`、`adr-0001`):建立新檔前先掃描該資料夾現有檔名,取最大編號 +1
- 日期一律 `YYYY-MM-DD`

## Metadata 標準(YAML frontmatter)

spec / bugfix / enhance / adr / report 文件**開頭必須**是 YAML frontmatter,狀態掃描腳本只解析這一段:

```yaml
---
id: func-0003            # func-XXXX | bug-XXXX | enhance-<date>-<slug> | adr-XXXX | report-<date>-<slug>
type: spec               # spec | bug | enhance | adr | report
title: user-authentication
description: 以 JWT 實作使用者註冊、登入與權限驗證   # 一句話主軸,見下方規則
status: open             # open | in-progress | done | closed(ADR 改用 proposed | accepted | superseded)
created: 2026-08-15
updated: 2026-08-15
depends-on: []           # spec 用:依賴的其他 spec id,判斷任務可否平行開發
related-adr: []          # 相關 ADR id
related-spec: []         # bug/enhance 回鏈到 spec id
---
```

### `description` 欄位規則(必填)

- **一句話**描述本文檔的**主軸/主題**:這份文檔在講什麼、要達成什麼
- **繁體中文、40 字以內**,不加句號;超過就是寫太細,砍掉細節只留主軸
- 只寫主題,不寫實作細節、不列步驟、不寫理由(那些屬於內文)
- 值含冒號 `:` 或 `#` 時整句用雙引號括起來(YAML 規則)
- 建立文檔時就要寫;除非文檔主題本身改變,否則後續修改不動這欄

各類型的寫法:

| 類型 | 描述對象 | 範例 |
|---|---|---|
| architecture | 專案在做什麼 | `本地端 Markdown 筆記管理與全文檢索工具` |
| adr | 決定了什麼 | `選用 SQLite FTS5 作為全文檢索引擎` |
| spec | 這個功能做什麼 | `以 JWT 實作使用者註冊、登入與權限驗證` |
| bug | 什麼壞了 | `並發寫入時索引損毀導致搜尋結果缺漏` |
| enhance | 要改善什麼 | `將檔案掃描改為增量更新以縮短啟動時間` |
| report | 分析了什麼 | `全專案穩健性與資安面向的健檢結果` |

## 通用規則

- 修改任何文檔內容時,同步更新 frontmatter 的 `updated`
- 每份文檔都必須有 `description`(一句話、40 字以內);缺少時視同 metadata 不合規
- spec/bug/enhance 完成(實作完成且測試通過)後 `status` 改 `done`;確認不再需要或已廢棄時改 `closed`
- **Context 載入紀律**:分析或開發時只讀 `architecture.md`、相關(最新)ADR、當前目標文檔;已 Closed 的 bugfix 檔除非必要否則不載入
- `architecture.md` 是專案燈塔:任何文檔產出後若與其描述衝突,必須回頭檢查並(經開發者同意)更新
