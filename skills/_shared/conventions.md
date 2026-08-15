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
status: open             # open | in-progress | done | closed(ADR 改用 proposed | accepted | superseded)
created: 2026-08-15
updated: 2026-08-15
depends-on: []           # spec 用:依賴的其他 spec id,判斷任務可否平行開發
related-adr: []          # 相關 ADR id
related-spec: []         # bug/enhance 回鏈到 spec id
---
```

## 通用規則

- 修改任何文檔內容時,同步更新 frontmatter 的 `updated`
- spec/bug/enhance 完成(實作完成且測試通過)後 `status` 改 `done`;確認不再需要或已廢棄時改 `closed`
- **Context 載入紀律**:分析或開發時只讀 `architecture.md`、相關(最新)ADR、當前目標文檔;已 Closed 的 bugfix 檔除非必要否則不載入
- `architecture.md` 是專案燈塔:任何文檔產出後若與其描述衝突,必須回頭檢查並(經開發者同意)更新
