# uto-skills

utomore 的 Claude Code plugin marketplace。目前收錄一個 plugin:

## dev-flow

文檔驅動開發流程的 Claude Code plugin,包含五個 skills:

| 指令 | 職責 |
|---|---|
| `/arch-design` | 專案初始架構設計 — 深度訪談後產出 `docs/architecture.md` + `docs/adr/adr-000x-*.md` |
| `/func-spec` | 新功能規格書 — 深度討論後產出 `docs/spec/func-000x-*.md`(相依性、介面、TodoList、1-to-1 測試),寫完回頭檢查 architecture.md |
| `/code-audit` | 專案分析 — `status` 模式用腳本掃 metadata 進度;預設模式先掃狀態、再拿文檔對照程式碼分析(穩健性/解耦/資安/效能/過時套件),產出同時涵蓋文檔狀態總覽與程式碼發現的 `docs/analysis/report-*.md` |
| `/spec-impl` | 依 spec / bug / enhance 文檔開發,逐項勾 TodoList、跑 1-to-1 測試、回寫 status |
| `/branch-pr` | 整合多條 branch 發 PR(標題英文 conventional commit、內文繁中、labels 英文) |

共用文檔慣例(資料夾結構、命名、YAML frontmatter)在 `skills/_shared/conventions.md`。

## 安裝(新環境一鍵導入)

在 Claude Code 內執行:

```
/plugin marketplace add utomore/uto-skills
/plugin install dev-flow@uto-skills
```

或在終端機執行:

```
claude plugin marketplace add utomore/uto-skills
claude plugin install dev-flow@uto-skills
```

## 更新

repo 有新版本後:

```
/plugin marketplace update uto-skills
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
└── enhance/enhance-0001-<slug>.md
```

檔名以**編號優先**、四位數遞增,不放日期(日期在 frontmatter 的 `created` / `updated`);只有 `analysis/report-*` 以日期命名。

spec / bugfix / enhance 開頭必須有 YAML frontmatter(`id` / `type` / `title` / `description` / `status` / `created` / `updated` / `depends-on` / `related-adr` / `related-spec`),`status` 取值 `open | in-progress | done | closed`,狀態掃描腳本(`skills/code-audit/scripts/scan-status.mjs`)只解析這一段。

`description` 為**一句話、繁體中文、40 字以內**的文檔主軸,**所有類型都要寫**(spec 寫「這功能做什麼」、bug 寫「什麼壞了」、enhance 寫「要改善什麼」、adr 寫「決定了什麼」、report 寫「分析了什麼」),讓 `/code-audit status` 不必開檔就能看出每份文檔在講什麼;缺這欄會被腳本列為不合規並以 exit code 1 收場。

`/code-audit status` 的表格欄位順序為 `主軸 | id | type | status | created | depends-on | file` — 主軸擺第一欄、id 第二欄,先看內容再看編號。

## Repo 結構

本 repo 同時是 marketplace 與 plugin 本體:

- `.claude-plugin/marketplace.json` — marketplace `uto-skills`,登錄的 plugin 以 `source: "./"` 指向 repo 根目錄
- `.claude-plugin/plugin.json` — plugin `dev-flow`(skill 前綴 `dev-flow:`)
- `skills/` — 各 skill 的 `SKILL.md` 與腳本

marketplace 名稱、plugin 名稱與 GitHub repo 名稱彼此獨立;日後要在同 repo 新增第二個 plugin,把各 plugin 移進子目錄並改 `plugins[].source` 即可。
