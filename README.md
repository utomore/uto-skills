# uto-skills

utomore 的 Claude Code plugin marketplace。目前收錄兩個 plugins:

## dev-flow

文檔驅動開發流程的 Claude Code plugin,包含六個 skills:

| 指令 | 職責 |
|---|---|
| `/arch-design` | 專案整體架構設計 — 深度訪談後產出 `docs/arch/architecture.md` + `docs/adr/adr-000x-*.md`,並規劃子系統邊界 |
| `/subarch-design` | 子系統架構設計 — 基於整體架構產出 `docs/arch/subarch-000x-*.md`(含 ASCII 架構圖、對外介面、完成子系統所需的 feature 規劃列表),並回填主架構的 `subarchs` 清單 |
| `/func-spec` | 功能/改善規格書 — `:feature` 深度討論新功能後產出 `docs/spec/func-000x-*.md`;`:enhance` 檢視現有程式碼後產出 `docs/enhance/enhance-000x-*.md`(皆含相依性、介面、TodoList、1-to-1 測試),寫完回頭檢查架構文件 |
| `/code-audit` | 專案分析 — `status` 模式用腳本掃 metadata 進度;預設模式先掃狀態、再拿文檔對照程式碼分析(穩健性/解耦/資安/效能/過時套件),產出同時涵蓋文檔狀態總覽與程式碼發現的 `docs/analysis/report-*.md` |
| `/spec-impl` | 依文檔開發 — 開發者指定要實作哪一份(feature / enhance / bugfix),逐項勾 TodoList、跑 1-to-1 測試、回寫 status |
| `/branch-pr` | 整合多條 branch 發 PR(標題英文 conventional commit、內文繁中、labels 英文) |

共用文檔慣例(資料夾結構、命名、YAML frontmatter)在 `plugins/dev-flow/skills/_shared/conventions.md`。

## talk-flow

演講內容產生流程的 Claude Code plugin,投影片以 **Marp Markdown** 撰寫、**marp-cli** 建置輸出(html / pdf / pptx),SVG 只用來畫圖形(架構圖、流程圖等),講稿簡化為頁內備註(presenter notes,提醒式、不寫逐字稿)。包含五個 skills:

| 指令 | 職責 |
|---|---|
| `/topic-design` | 演講主軸設計 — 深度訪談時長/聽眾/會議類型/輸出格式,提供 3 組主題方案供選擇,產出燈塔文件 `docs/topic.md`(含**文字規範**:字級↔情境、強調方式用途、列表符號語意,執行期只能從中選用)、Marp 鷹架(`talk/src/`:theme.css、deck-header.md、build.mjs、.marprc.yml)與各 section 佔位文檔 |
| `/section-design` | 段落設計 — 逐段規劃討論方向、內文內容與形式(條列/表格/段落)、從 topic.md 文字規範圈出本段的**文字技法選用**、是否需要圖形輔助與圖形類型(架構圖/流程圖/分層圖/金字塔圖/象限圖…),產出完整 `docs/section-0x-*.md`;子命令 `status` 用腳本掃描各段落狀態並比對 `topic.md` 的 `sections` 清單 |
| `/section-impl` | 段落實作 — 依設計文件逐頁決定 Layout(整頁單一區塊/左右/上下/上中下/三等份/四象限/上三下二…,版型詞彙見 `_shared/layouts.md`)並對每頁說得出**視覺動線**,文字技法只從文字規範選用,撰寫 `talk/src/section-0x-*.md` 的 Marp 頁面與 `<!-- 備註 -->`,繪製圖形 SVG(`talk/assets/diagram-*`;使用者提供截圖/參考圖時可用**截圖加註**:原圖 base64 內嵌 SVG 疊編號標記 + 圖下對應圖例)嵌入,`node build.mjs` 建置驗收;需要時建立 `demo/` |
| `/page-adjust` | 單頁調整 — 針對指定頁面深談 Layout/內文/圖形/備註調整(文字技法仍受 topic.md 文字規範約束),修改 Marp 原始碼與 SVG 後重 build,同步 section 設計文件 |
| `/review` | 整體審查 — 腳本交叉比對段落覆蓋、deck↔docs 頁數同步、圖形引用完整性、依賴順序、時間帳與產物新鮮度,再 **build 後逐頁目視** Layout、視覺引導動線、文字規範遵循(字級/強調/列表符號/行距)、版型與配色收斂、圖形連接線轉折(>2 折扣分)、備註品質、用語概念一致與 AI 感,並判斷主軸貼合度、偏題比例、銜接與難度峰值,產出十三項指標的審查報告 `review/review-<日期>-<序號>.md`;不修改任何原始碼 |

演講專案的資料夾結構:`docs/`(topic.md 與 section 設計文件)、`talk/src/`(Marp 原始碼與設定:deck-header.md、每 section 一檔 `section-0x-*.md`、theme.css、build.mjs、.marprc.yml)、`talk/assets/`(圖形 SVG,`diagram-<section>-<序號>-<slug>.svg`)、`talk/dist/`(marp-cli 輸出產物,不手改)、`review/`(審查報告)、`demo/`(可選)。每份手寫文件(含圖形 SVG)都有 metadata;共用慣例在 `plugins/talk-flow/skills/_shared/conventions.md`,版型詞彙在 `_shared/layouts.md`。

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
