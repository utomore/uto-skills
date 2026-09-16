# lawful 規章

`lawful` 替純函數式專案(functional core / imperative shell)做 spec 驅動開發,不限語言。文檔的單位是 **pipeline**:一段 input → 純轉換 → output 的資料流,兩端碰 shell 的是 IO 介面、只在純核心裡的是子流;stage 是住在程式碼裡的簽名,laws 是測試存在之前的性質。pipeline 之上是四層「為什麼」:`Cone.md` 的**願景**與**需求**(各有一條可判定的 Requirement Law)、`objectives/` 一檔一個的**目標**(每個解決恰好一條需求,各有 Objective Law 與優先 1 到 4)與目標底下的兩條路線:**建置路線**的里程碑綁定它要做到的 pipeline,走完需求 Law 第一次成立;**優化路線**的調整只改既有 pipeline 的品質,每一次之後需求 Law 仍要成立。

目標與里程碑訂好之後有兩條路線走到一條 pipeline:

| 路線 | 什麼時候走 | 怎麼走 |
|---|---|---|
| **資料流導向** | 這條資料流只動既有的模組單元 | `lawful claim <slug> --milestone <M-n>` 直接建 pipeline,`lawful:pipeline` 寫它的 Stages 與 laws |
| **架構先行** | 這條資料流要一個還沒有的模組單元 | 先 `lawful:module` 劃好單元的名字、範圍與有哪幾層,再 `lawful claim` 走上面那條 |

模組單元只劃邊界,不決定裡面有什麼函數;單元裡的簽名一律由 pipeline 的 Stages 表長出來,pipeline 要在既有單元裡加、改、搬東西不必回頭動模組表。

`rules/` 四份主題規章是每條規則唯一的住處;skill 只寫步驟並用檔名加節名引用,不重述。

| 檔 | 主題 |
|---|---|
| `pipelines.md` | `.lawful/` 樹、Cone.md、願景、需求、目標與兩條路線、pipeline 文檔的節、laws、REV、GAP、完成度、ADR、spike |
| `boundary.md` | 四層、模組表(邊界、模組單元、對外 I/O)、效果的判定、測試與邊界 |
| `roles.md` | 三個階段、分支與所有權、conductor / qa / impl、委派、骨架與基線、驗收測試、收尾、仲裁、測試跑幾次、開發日誌、整合 |
| `tooling.md` | CLI 子命令與 exit code、status 報告版面、language adapter、跑東西的紀律、收尾定錨 |

## 名詞

| 名詞 | 在哪 |
|---|---|
| 願景、需求、`R-n`、Requirement Law、蘊含、專案約束 | pipelines.md「Cone.md」「願景、需求、目標與路線」 |
| 目標、`O-n`、需求欄、優先、Objective Law、繼承 | pipelines.md「願景、需求、目標與路線」 |
| 建置路線、里程碑、`M-n`、綁定、待 claim | pipelines.md「願景、需求、目標與路線」 |
| 優化路線、調整、`RF-n`、動到、待修訂 | pipelines.md「願景、需求、目標與路線」「修訂(REV)」 |
| Law 成立、完成度、調整達成 | pipelines.md「完成度」 |
| pipeline、stage、`=` 列 / 純的整條、`!` 列 / 進入點、`o` 列 / 觀察點、IO 介面、子流、`kind` | pipelines.md「pipeline」「frontmatter 與 status」 |
| 全名、`P-00x#name`、`P-00x#LAW-n`、`R-n#LAW`、`O-n#LAW` | pipelines.md「編號與引用」 |
| `draft` / `ready` / `frozen`、解凍 | pipelines.md「frontmatter 與 status」 |
| Brief、Stages、Laws、law 種類、Examples、決定 | pipelines.md「節」 |
| 什麼要有 law、自由度、內部支架 | pipelines.md「什麼要有 law」 |
| REV、動到 / 保護 / 重委派 | pipelines.md「修訂(REV)」 |
| GAP、`gaps.md` | pipelines.md「提問(GAP)」 |
| 簽名 m / n、骨架 s、laws g / k、達成 | pipelines.md「完成度」 |
| law 種類(`invariant` … `total`、`commute`)、class 法則 | pipelines.md「節」「什麼要有 law」 |
| ADR、spike、SPK、RND、verdict、feeds | pipelines.md「ADR」「spike」 |
| types / effect / core / shell、效果 ADT、匯出清單 | boundary.md「四層」 |
| 模組單元、原始碼樹、子函式庫、模組前綴、原始碼根目錄 | boundary.md「模組單元」 |
| 模組表、邊界節、未登記、幽靈、`--module` | boundary.md「模組表」 |
| 效果型別、IO 模組、`isEffectful`、純解譯器、真解譯器 | boundary.md「效果的判定」 |
| 對外 I/O、`lint io` | boundary.md「對外 I/O」 |
| `*.Internal`、後門 | boundary.md「測試與邊界」 |
| conductor、qa、impl | roles.md「三角色」 |
| build 分支、工作樹、建構中、所有權 | roles.md「分支與所有權」 |
| 委派、回報五項 | roles.md「委派」 |
| 開發日誌、`journal/<全名>.md` | roles.md「開發日誌」 |
| 整合分支、清單型衝突、合併後紅、清理 | roles.md「整合」 |
| 骨架、`stub`、基線 | roles.md「骨架與基線」 |
| 驗收測試、`build/R-n` | roles.md「驗收測試」 |
| 產生器、shrink、覆蓋率、案例數上限 | roles.md「qa 的交付」 |
| 波末收尾 | roles.md「收尾」 |
| 仲裁四分流 | roles.md「仲裁」 |
| `<L>`、子命令、exit code、`migrate cone` | tooling.md「CLI」 |
| adapter | tooling.md「language adapter」 |
| 三道關 | tooling.md「跑東西的紀律」 |
| 定錨區塊 | tooling.md「收尾定錨」 |

## 每個 skill 讀什麼

`<L>` 解析一次(tooling.md「CLI」);節用 `node "<L>/bin/lawful.mjs" section <檔> <節>…` 取,一次讀完。

| skill | 必讀 |
|---|---|
| `lawful:module` | boundary.md「模組單元」「模組表」「四層」;tooling.md「CLI」「收尾定錨」 |
| `lawful:design` | pipelines.md「`.lawful/`」「Cone.md」「願景、需求、目標與路線」「ADR」;boundary.md 全份;tooling.md「language adapter」「收尾定錨」 |
| `lawful:objective` | pipelines.md「願景、需求、目標與路線」「完成度」;tooling.md「CLI」「status 報告」「收尾定錨」 |
| `lawful:pipeline` | pipelines.md「pipeline」「編號與引用」「frontmatter 與 status」「節」「什麼要有 law」;roles.md「骨架與基線」;boundary.md「模組表」;tooling.md「CLI」「收尾定錨」 |
| `lawful:build` | roles.md 全份;pipelines.md「提問(GAP)」「修訂(REV)」「完成度」;tooling.md「CLI」「跑東西的紀律」「收尾定錨」 |
| `lawful:integrate` | roles.md「分支與所有權」「開發日誌」「整合」「仲裁」;pipelines.md「提問(GAP)」「完成度」;tooling.md「CLI」「跑東西的紀律」「收尾定錨」 |
| `lawful:qa` | roles.md「三角色」「委派」「qa 的交付」;pipelines.md「節」「什麼要有 law」「提問(GAP)」;boundary.md「測試與邊界」 |
| `lawful:impl` | roles.md「三角色」「委派」;pipelines.md「節」「提問(GAP)」;boundary.md「四層」 |
| `lawful:revise` | pipelines.md「frontmatter 與 status」「修訂(REV)」「提問(GAP)」「願景、需求、目標與路線」;tooling.md「收尾定錨」 |
| `lawful:status` | tooling.md「CLI」「status 報告」「收尾定錨」;pipelines.md「願景、需求、目標與路線」「完成度」 |
| `lawful:audit` | tooling.md「CLI」(含 `sync`);boundary.md 全份;pipelines.md「願景、需求、目標與路線」「節」「什麼要有 law」「完成度」 |
| `lawful:spike` | pipelines.md「spike」;roles.md「委派」「spike」;tooling.md「跑東西的紀律」 |
| `lawful:study` | tooling.md「跑東西的紀律」「收尾定錨」;專案有 `.lawful/` 時加 boundary.md「四層」「效果的判定」、pipelines.md「pipeline」 |

prompt 標明委派模式的執行另讀 roles.md「委派」,不讀「收尾定錨」。
