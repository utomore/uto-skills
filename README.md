# uto-skills

utomore 的 Claude Code plugin marketplace。目前收錄兩個 plugins:

## dev-flow

三層階梯式(Level 1 主架構 → Level 2 子系統 → Level 3 Feature 實作)文檔驅動開發流程的 Claude Code plugin,遵循關注點分離與契約優先:架構階段只定義邊界契約與資料流(嚴禁過早具體化),實作階段在契約內擁有完全自主權。包含九個 skills:

| 指令 | 層級 | 職責 |
|---|---|---|
| `/system-design` | L1 | 系統主架構 — 深度訪談後產出 `.design/system.md` + `.design/adr/ADR-00x-*.md`:技術棧、對外 I/O 契約、子系統劃分(Bounded Contexts)、通訊拓撲;只到子系統邊界顆粒度 |
| `/subsys-design` | L2 | 子系統架構 — 產出 `.design/subsystems/<slug>/design.md`:公開介面與 DTO、內部模組劃分、資料流管線、模組間抽象介面、feature 路線圖(功能規劃),並回填主架構 `subsystems` 清單 |
| `/feature-design` | L3 | 功能設計 — 深度討論後產出 `features/F00x-*.md`,介面必須落在 L2 契約內;含相依性查證、介面表、TodoList、1-to-1 測試 |
| `/enhance-design` | L3 | 優化設計 — 先讀程式碼、**與開發者討論確認 scope 涵蓋範圍**後,產出 `enhancements/E00x-*.md`(跨子系統為 `.design/enhancements/G-E00x-*.md`) |
| `/feature-impl` | L3 | 功能實作 — 依 feature 文檔逐項勾 TodoList、跑 1-to-1 測試、回寫 status;L2 契約內實作自主 |
| `/enhance-impl` | L3 | 優化實作 — 回歸測試先行,scope 標明不動的範圍絕對不碰,收尾記錄量化結果 |
| `/bugfix` | L3 | 缺陷修復 — 重現 → 建 `bugfixes/B00x-*.md`(跨子系統為 `G-B00x`)→ 先寫重現測試再修 → 保留回歸測試 |
| `/arch-audit` | 全 | 架構檢測 — `system`(子系統循環依賴、對外 I/O 契約一致性)/ `subsys`(資料流管線、SRP、邊界外洩)/ `feature`(L2 介面符合度、edge cases、型別安全)/ `status`(腳本盤點各 feature 完成度與待優化模組) |
| `/branch-pr` | — | 整合多條 branch 發 PR(標題英文 conventional commit、內文繁中、labels 英文) |

共用文檔慣例(樹狀資料夾結構、編號、引用格式、YAML frontmatter、資訊抽象邊界規範)在 `plugins/dev-flow/skills/_shared/conventions.md`。

## talk-flow

演講內容產生流程的 Claude Code plugin,投影片以 **Marp Markdown** 撰寫、**marp-cli** 建置輸出(html / pdf / pptx),SVG 只用來畫圖形(架構圖、流程圖等),講稿簡化為頁內備註(presenter notes,提醒式、不寫逐字稿)。包含六個 skills:

| 指令 | 職責 |
|---|---|
| `/topic-design` | 演講主軸設計 — 深度訪談時長/聽眾/會議類型/輸出格式,依場合選定**風格基底**(tech-deep/keynote-impact/intro-friendly/workshop-guide/exec-brief,見 `_shared/styles.md`,為版面/配色/文字/圖形/節奏定預設方向),提供 3 組主題方案供選擇,產出燈塔文件 `docs/topic.md`(含**文字規範**:字級↔情境、強調方式用途、列表符號語意,執行期只能從中選用)、Marp 鷹架(`talk/src/`:theme.css、deck-header.md、build.mjs、.marprc.yml)與各 section 佔位文檔 |
| `/section-design` | 段落設計 — 逐段規劃討論方向、內文內容與形式(條列/表格/段落)、從 topic.md 文字規範圈出本段的**文字技法選用**、是否需要圖形輔助與圖形類型(架構圖/流程圖/分層圖/金字塔圖/象限圖…),產出完整 `docs/section-0x-*.md`;子命令 `status` 用腳本掃描各段落狀態並比對 `topic.md` 的 `sections` 清單 |
| `/section-impl` | 段落實作 — 依設計文件逐頁決定 Layout(整頁單一區塊/左右/上下/上中下/三等份/四象限/上三下二…,版型詞彙見 `_shared/layouts.md`)並對每頁說得出**視覺動線**,文字技法只從文字規範選用,撰寫 `talk/src/section-0x-*.md` 的 Marp 頁面與 `<!-- 備註 -->`,繪製圖形 SVG(`talk/assets/diagram-*`;使用者提供截圖/參考圖時可用**截圖加註**:原圖 base64 內嵌 SVG 疊編號標記 + 圖下對應圖例)嵌入,`node build.mjs` 建置驗收;需要時建立 `demo/` |
| `/page-adjust` | 單頁調整 — 針對指定頁面深談 Layout/內文/圖形/備註調整(文字技法仍受 topic.md 文字規範約束),修改 Marp 原始碼與 SVG 後重 build,同步 section 設計文件 |
| `/svg-layout` | 架構圖 SVG 排版量測(唯讀三腳本)— `normalize.py` 補齊語意化 id 與 `data-role/from/to`(只寫標註不動幾何,id 穩定不漂移);`inspect.py` 輸出 scene digest(累積巢狀 transform 的絕對 bbox、以 fontTools 實測中英混排標籤寬度、edge 拓撲、對齊與間距序列);`lint.py` 診斷 15 條規則(文字溢出/內距/投影字級/對比、連線端點間隙/穿越節點/標籤壓線/缺箭頭/交叉、尺寸間距不一致/幾乎對齊/超出畫布),每條給量化偏差與修正方向 |
| `/review` | 整體審查 — 腳本交叉比對段落覆蓋、deck↔docs 頁數同步、圖形引用完整性、依賴順序、時間帳與產物新鮮度,再 **build 後逐頁目視** Layout、視覺引導動線、文字規範遵循(字級/強調/列表符號/行距)、版型與配色收斂、圖形連接線轉折(>2 折扣分)、備註品質、用語概念一致與 AI 感,並判斷主軸貼合度、偏題比例、銜接與難度峰值,產出十三項指標的審查報告 `review/review-<日期>-<序號>.md`;不修改任何原始碼 |

演講專案的資料夾結構:`docs/`(topic.md 與 section 設計文件)、`talk/src/`(Marp 原始碼與設定:deck-header.md、每 section 一檔 `section-0x-*.md`、theme.css、build.mjs、.marprc.yml)、`talk/assets/`(圖形 SVG,`diagram-<section>-<序號>-<slug>.svg`)、`talk/dist/`(marp-cli 輸出產物,不手改)、`review/`(審查報告)、`demo/`(可選)。每份手寫文件(含圖形 SVG)都有 metadata;共用慣例在 `plugins/talk-flow/skills/_shared/conventions.md`,版型詞彙在 `_shared/layouts.md`,風格基底在 `_shared/styles.md`。

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

## 文檔慣例摘要(dev-flow)

設計文檔樹與系統架構樹同構:根節點是主架構、第二層是各 subsystem。所有文檔放在專案 `.design/`,檔名英文 kebab-case、內文繁體中文:

```
.design/
├── system.md                        # /system-design:Level 1 主架構(frontmatter `subsystems` 為權威清單)
├── subsystems/
│   └── <subsystem-slug>/
│       ├── design.md                # /subsys-design:Level 2 子系統架構(frontmatter `parent: system` 回鏈)
│       ├── features/F001-<slug>.md          # /feature-design
│       ├── enhancements/E001-<slug>.md      # /enhance-design
│       └── bugfixes/B001-<slug>.md          # /bugfix
├── enhancements/G-E001-<slug>.md    # 跨子系統的全域優化
├── bugfixes/G-B001-<slug>.md        # 跨子系統的全域修復
└── adr/ADR-001-<slug>.md            # 架構決策紀錄,全局共用
```

編號**三位數**遞增、不放日期(日期在 frontmatter 的 `created` / `updated`);**每個子系統自己一組編號**(F/E/B 各自計數)、全域 G- 自己一組、ADR 全局一組。跨子系統引用寫 `<subsystem>/<id>`(如 `auth/F002`),同子系統直寫 id,全域直寫 `G-E001` / `ADR-003`。

任務文檔開頭必須有 YAML frontmatter(`id` / `type` / `title` / `description` / `status` / `created` / `updated` / `depends-on` / `related-adr` / `related-feature`;全域文檔另加 `subsystems`),`status` 取值 `open | in-progress | done | closed`,狀態掃描腳本(`plugins/dev-flow/skills/arch-audit/scripts/scan-status.mjs`)只解析這一段,清單欄位一律行內陣列 `[a, b]`。

`description` 為**一句話、繁體中文、40 字以內**的文檔主軸,**所有類型都要寫**(feature 寫「這功能做什麼」、bugfix 寫「什麼壞了」、enhance 寫「要改善什麼」、adr 寫「決定了什麼」),讓 `/arch-audit status` 不必開檔就能看出每份文檔在講什麼;缺這欄會被腳本列為不合規並以 exit code 1 收場。

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
