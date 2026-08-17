# uto-skills

utomore 的 Claude Code plugin marketplace。目前收錄兩個 plugins:

## dev-flow

文檔驅動開發流程的 Claude Code plugin,包含六個 skills:

| 指令 | 職責 |
|---|---|
| `/arch-design` | 專案整體架構設計 — 深度訪談後產出 `docs/arch/architecture.md` + `docs/adr/adr-000x-*.md`,並規劃子系統邊界 |
| `/subarch-design` | 子系統架構設計 — 基於整體架構產出 `docs/arch/subarch-000x-*.md`(含 ASCII 架構圖、對外介面),並回填主架構的 `subarchs` 清單 |
| `/func-spec` | 新功能規格書 — 深度討論後產出 `docs/spec/func-000x-*.md`(相依性、介面、TodoList、1-to-1 測試),寫完回頭檢查架構文件 |
| `/code-audit` | 專案分析 — `status` 模式用腳本掃 metadata 進度;預設模式先掃狀態、再拿文檔對照程式碼分析(穩健性/解耦/資安/效能/過時套件),產出同時涵蓋文檔狀態總覽與程式碼發現的 `docs/analysis/report-*.md` |
| `/spec-impl` | 依 spec / bug / enhance 文檔開發,逐項勾 TodoList、跑 1-to-1 測試、回寫 status |
| `/branch-pr` | 整合多條 branch 發 PR(標題英文 conventional commit、內文繁中、labels 英文) |

共用文檔慣例(資料夾結構、命名、YAML frontmatter)在 `plugins/dev-flow/skills/_shared/conventions.md`。

## talk-flow

演講內容產生流程的 Claude Code plugin,協助產出投影片(SVG + HTML)與講稿(.md),包含五個 skills:

| 指令 | 職責 |
|---|---|
| `/topic-design` | 演講主軸設計 — 深度訪談時長/聽眾/會議類型,提供 3 組主題方案供選擇,產出燈塔文件 `docs/topic.md`、資料夾結構(`docs/`、`talk/assets/`)與各 section 佔位文檔 |
| `/section-discuss` | 段落討論 — 逐段深談存在理由、內容要點、先備知識與頁面規劃,產出完整 `docs/section-0x-*.md`;子命令 `status` 用腳本掃描各段落狀態(open / in-progress / done / rejected)並比對 `topic.md` 的 `sections` 清單 |
| `/section-impl` | 段落實作 — 依 topic.md 與 section 文檔撰寫 `talk/scripts.md` 講稿、產出 SVG 頁面並組進 `talk/slide.html`,需要時建立 `demo/`(預設 uv + python + notebook) |
| `/page-adjust` | 單頁調整 — 針對指定頁碼的 SVG 深談風格/描述/圖畫/Layout,修改 SVG 並同步 section 文檔、講稿與 slide.html |
| `/review` | 整體審查(唯讀)— 腳本交叉比對頁碼五處同步、段落覆蓋、依賴順序、講稿對時與 SVG 視覺規格(viewBox/字級/色票/溢出),再**逐頁開 SVG 目視** Layout、配色統一、用語概念一致與 AI 感,並判斷主軸貼合度、偏題比例、段落/頁面銜接與難度峰值,輸出十項指標的符合度與修正優先序;不產出任何文檔 |

演講專案的資料夾結構:`docs/`(topic.md 與 section 設計文件)、`talk/assets/`(SVG 頁面,全域兩位數頁碼)、`talk/scripts.md`(講稿,含 `(→ page XX)` 翻頁標記)、`talk/slide.html`(鍵盤翻頁的離線簡報)、`demo/`(可選)。每份文件(含 SVG 與 slide.html)都有 metadata;共用慣例在 `plugins/talk-flow/skills/_shared/conventions.md`。

## 安裝(新環境一鍵導入)

在 Claude Code 內執行:

```
/plugin marketplace add utomore/uto-skills
/plugin install dev-flow@uto-skills
/plugin install talk-flow@uto-skills
```

或在終端機執行:

```
claude plugin marketplace add utomore/uto-skills
claude plugin install dev-flow@uto-skills
claude plugin install talk-flow@uto-skills
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
├── arch/
│   ├── architecture.md                    # 專案燈塔(整體架構,frontmatter `subarchs` 列出子系統)
│   └── subarch-0001-<slug>.md             # 子系統架構(frontmatter `parent-arch` 回鏈主架構)
├── adr/adr-0001-<slug>.md
├── spec/func-0001-<slug>.md
├── analysis/report-<YYYY-MM-DD>-<slug>.md
├── bugfix/bug-0001-<slug>.md
└── enhance/enhance-0001-<slug>.md
```

檔名以**編號優先**、四位數遞增,不放日期(日期在 frontmatter 的 `created` / `updated`);只有 `analysis/report-*` 以日期命名。

spec / bugfix / enhance 開頭必須有 YAML frontmatter(`id` / `type` / `title` / `description` / `status` / `created` / `updated` / `depends-on` / `related-adr` / `related-spec`),`status` 取值 `open | in-progress | done | closed`,狀態掃描腳本(`plugins/dev-flow/skills/code-audit/scripts/scan-status.mjs`)只解析這一段。

`description` 為**一句話、繁體中文、40 字以內**的文檔主軸,**所有類型都要寫**(spec 寫「這功能做什麼」、bug 寫「什麼壞了」、enhance 寫「要改善什麼」、adr 寫「決定了什麼」、report 寫「分析了什麼」),讓 `/code-audit status` 不必開檔就能看出每份文檔在講什麼;缺這欄會被腳本列為不合規並以 exit code 1 收場。

`/code-audit status` 的表格欄位順序為 `主軸 | id | type | status | created | depends-on | file` — 主軸擺第一欄、id 第二欄,先看內容再看編號。

## Repo 結構

本 repo 同時是 marketplace 與 plugin 本體,但兩者分層:

```
.claude-plugin/marketplace.json     # marketplace「uto-skills」定義
plugins/
├── dev-flow/                       # ← 安裝時只有被裝的 plugin 目錄被複製
│   ├── .claude-plugin/plugin.json  # plugin「dev-flow」(skill 前綴 dev-flow:)
│   └── skills/                     # 各 skill 的 SKILL.md 與腳本
└── talk-flow/
    ├── .claude-plugin/plugin.json  # plugin「talk-flow」(skill 前綴 talk-flow:)
    └── skills/
README.md                           # 只在 repo,不進 payload
```

`marketplace.json` 的 `plugins[].source` 指向各 plugin 目錄(如 `./plugins/dev-flow`),安裝時**只有該子目錄**會被複製進使用者的 `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`。repo 根目錄的 `README.md`、`docs/` 等開發用檔案不會進到 payload — 使用者每裝一個版本就多一份快照,payload 保持精簡是有意義的。

日後新增 plugin:在 `plugins/` 下開新目錄,到 `marketplace.json` 的 `plugins[]` 加一筆即可。marketplace 名稱、plugin 名稱與 GitHub repo 名稱彼此獨立。
