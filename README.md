# dev-flow

文檔驅動開發流程的 Claude Code plugin,包含五個 skills:

| 指令 | 職責 |
|---|---|
| `/arch-design` | 專案初始架構設計 — 深度訪談後產出 `docs/architecture.md` + `docs/adr/adr-000x-*.md` |
| `/func-spec` | 新功能規格書 — 深度討論後產出 `docs/spec/func-000x-*.md`(相依性、介面、TodoList、1-to-1 測試),寫完回頭檢查 architecture.md |
| `/code-audit` | 專案分析 — `status` 模式用腳本掃 metadata 進度;預設模式拿文檔對照程式碼分析(穩健性/解耦/資安/效能/過時套件)→ `docs/analysis/report-*.md` |
| `/spec-impl` | 依 spec / bug / enhance 文檔開發,逐項勾 TodoList、跑 1-to-1 測試、回寫 status |
| `/branch-pr` | 整合多條 branch 發 PR(標題英文 conventional commit、內文繁中、labels 英文) |

共用文檔慣例(資料夾結構、命名、YAML frontmatter)在 `skills/_shared/conventions.md`。

## 安裝(新環境一鍵導入)

在 Claude Code 內執行:

```
/plugin marketplace add utomore/dev-flow
/plugin install dev-flow@dev-flow
```

或在終端機執行:

```
claude plugin marketplace add utomore/dev-flow
claude plugin install dev-flow@dev-flow
```

## 更新

repo 有新版本後:

```
/plugin marketplace update dev-flow
```

## 文檔慣例摘要

所有文檔放在專案 `docs/`,檔名英文 kebab-case、內文繁體中文:

```
docs/
├── architecture.md                        # 專案燈塔
├── adr/adr-0001-<slug>.md
├── spec/func-0001-<slug>.md
├── analysis/report-<YYYY-MM-DD>-<slug>.md
├── bugfix/bug-0001-<slug>.md
└── enhance/enhance-<YYYY-MM-DD>-<slug>.md
```

spec / bugfix / enhance 開頭必須有 YAML frontmatter(`id` / `type` / `status` / `created` / `updated` / `depends-on` / `related-adr` / `related-spec`),`status` 取值 `open | in-progress | done | closed`,狀態掃描腳本(`skills/code-audit/scripts/scan-status.mjs`)只解析這一段。
