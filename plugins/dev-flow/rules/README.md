# dev-flow 規章

`dev-flow` 替一般程式語言的專案做需求導向的開發:**需求(必須達成)與全域 Law(不得違反)先講好,先用實作貫通一條垂直切片,再對著跑得通的東西談 Law、寫測試、調整實作**。做之前就寫的只有 `system.md` 的**願景**(北極星)、**需求**(必須達成的事,各有一句可判定的驗收)、**全域 Law**(不得違反的約束,住「全域 Law」一區,三類:領域不變量、架構的層、契約的對外 I/O),與 `objectives/` 一檔一個的**目標**(每個解決恰好一條需求,各有優先 1 到 4)。目標底下兩條路線:**建置路線**的里程碑一條就是一條切片的範圍,走完需求第一次達成;**優化路線**的調整只改既有 feature 的品質,每一次之後需求仍要達成。law 只有兩種範圍:全域 Law,與住在一份 feature 或 abstract 裡的 scope law。

一條里程碑的一生都在同一條分支、同一棵工作樹上:`dev-flow:spike-impl` 貫通切片並留下決策紀錄 → `dev-flow:law-design` 對著切片與開發者逐條談 Law,寫成 **feature**(一段從對外邊界進、從對外邊界出的資料流,直接掛在 `system.md` 底下,沒有子系統這一層)→ `dev-flow:build` 派 qa 只讀文檔寫測試、驗首跑、派 refactor 調整實作,每條 law 成立才算達成 → `dev-flow:integrate` 把達成的分支合在一起,仲裁互斥的 law、寫 ADR、發 PR。測試涵蓋到哪裡,功能的承諾就到哪裡。feature 之間長出來的共同部分由 `dev-flow:abstract` 收整成 **abstract**,既有文檔的改動走 `dev-flow:revise`,兩者都在被動到的每一份 feature 記一條 REV。進度不是欄位,由 `devflow status` 從檔案、程式碼與測試推導。

`rules/` 五份主題規章是每條規則唯一的住處;skill 只寫步驟並用檔名加節名引用,不重述。

| 檔 | 主題 |
|---|---|
| `laws.md` | law 是不得違反、需求是必須達成;law 的兩種範圍(全域 Law 住 `system.md`「全域 Law」區,scope law 住一份 feature 或 abstract)、全域 Law 三類與准入四條、Law 怎麼談、調整 law 之前的影響範圍與選項、全域 Law 的變更 |
| `features.md` | `.design/` 樹、system.md、願景、需求、目標與兩條路線、feature 與 abstract 文檔怎麼寫:編號、簽名寫法、節、什麼要有 law、REV、收整、GAP、完成度、ADR |
| `boundary.md` | 層、模組表、IO 模組、匯出、對外 I/O(信任、驗證、契約)與安全三條、測試與邊界 |
| `roles.md` | 五個階段、分支與所有權、spike-impl / conductor / qa / refactor、委派、切片、首跑、驗收測試、收尾、仲裁、測試跑幾次、決策紀錄、整合、委派模型 |
| `tooling.md` | CLI 子命令與 exit code、status 報告版面、測試歸屬、language adapter、跑東西的紀律、收尾定錨 |

## 名詞

| 名詞 | 在哪 |
|---|---|
| 願景、需求、`R-n`、驗收、優先各級 | features.md「system.md」「願景、需求、目標與路線」 |
| 必須達成與不得違反、全域 Law 與 scope law、law 住哪裡、誰定哪一種 | laws.md「Law 與需求」 |
| 目標、`O-n`、需求欄、優先 | features.md「願景、需求、目標與路線」 |
| 建置路線、里程碑、`M-n`、全名 `M-n-<slug>`、綁定、還沒有切片 | features.md「願景、需求、目標與路線」 |
| 優化路線、調整、`RF-n`、動到、待修訂 | features.md「願景、需求、目標與路線」「修訂(REV)」 |
| 全域 Law、三類(領域不變量、架構、契約)、`INV-n`、准入四條、變更要開發者明確批准、`lint global` | laws.md「全域 Law」 |
| 影響範圍與選項、全域 Law 的變更、重新驗證受影響的工作 | laws.md「影響範圍與選項」「全域 Law 的變更」 |
| 需求達成、完成度、調整達成 | features.md「完成度」 |
| feature、abstract、step、`=` 列 / 整條、`!` 列 / 進入點、`o` 列 / 觀察點 | features.md「feature 與 abstract」 |
| 全名、`F-00x#name`、`F-00x#LAW-n`、`R-n#ACCEPT`、`INV-n#LAW`、號段、`owner`、`lint ids` | features.md「編號與引用」 |
| 正規式簽名、`型別.方法`、型別註記可省 | features.md「簽名怎麼寫」;tooling.md「language adapter」 |
| `draft` / `ready` / `verified`、重開 | features.md「frontmatter 與 status」 |
| Brief、Steps、Laws、law 種類、`given` 的時序、Examples、決定 | features.md「節」 |
| 什麼要有 law、自由度、內部支架 | features.md「什麼要有 law」 |
| 要 / 不准 / 不在乎、用例子問、寫得出反例實作才是 law | laws.md「Law 怎麼談」 |
| REV、動到 / 保護 / 重委派 / 連動 | features.md「修訂(REV)」 |
| 收整、abstract 的存在條件、抽出來的是資料流 | features.md「收整(abstract)」 |
| GAP、`gaps.md` | features.md「提問(GAP)」 |
| 簽名 m / n、未實作 s、laws g / k、達成 | features.md「完成度」 |
| ADR、誰寫、走不通的切片 | features.md「ADR」;roles.md「整合」 |
| 層、由內而外、最外層 | boundary.md「層」 |
| 模組表、未登記、幽靈、`目錄/**` | boundary.md「模組表」 |
| IO 模組、匯出 | boundary.md「IO 模組」「匯出」 |
| 對外 I/O、信任、驗證、契約、秘密字面值、沒登記的出入口 | boundary.md「對外 I/O」 |
| 後門 | boundary.md「測試與邊界」 |
| spike-impl、conductor、qa、refactor | roles.md「角色」 |
| `plan/` 與 `build/` 分支、鍵、工作樹、建構中、宣告歸設計本體歸實作 | roles.md「分支與所有權」 |
| 委派、回報五項 | roles.md「委派」 |
| 切片、離場條件、可以假、`verdict`、草稿 | roles.md「切片」 |
| 首跑、首跑該紅、未實作標記 | roles.md「首跑」 |
| 驗收測試、`build/R-n`、`build/INV-n` | roles.md「驗收測試」 |
| 產生器、shrink、覆蓋率、案例數上限 | roles.md「qa 的交付」 |
| 仲裁四分流 | roles.md「仲裁」 |
| 決策紀錄、`journal/<鍵>.md`、Goal / Scope、Decisions(Decision、Reason、Constraint)、切片六節、Verification、合併時要看 | roles.md「決策紀錄」 |
| 每個階段的核心 | roles.md「五個階段」;各 SKILL.md 開頭 |
| 整合分支、清單型衝突、合併後紅、整合的仲裁三選項、清理 | roles.md「整合」 |
| `<D>`、子命令、exit code | tooling.md「CLI」 |
| 建構中走到哪一步、修訂熱點 | tooling.md「status 報告」 |
| 測試歸屬的兩種寫法 | tooling.md「測試歸屬」 |
| adapter | tooling.md「language adapter」 |
| 三道關 | tooling.md「跑東西的紀律」 |
| 定錨區塊 | tooling.md「收尾定錨」 |

## 每個 skill 讀什麼

`<D>` 解析一次(tooling.md「CLI」);節用 `node "<D>/bin/devflow.mjs" section <檔> <節>…` 取,一次讀完。

| skill | 必讀 |
|---|---|
| `dev-flow:project` | features.md「`.design/`」「system.md」「願景、需求、目標與路線」;laws.md「Law 與需求」「全域 Law」;boundary.md 全份;tooling.md「language adapter」「收尾定錨」 |
| `dev-flow:objective` | features.md「願景、需求、目標與路線」「完成度」;tooling.md「CLI」「status 報告」「收尾定錨」 |
| `dev-flow:spike-impl` | roles.md「五個階段」「分支與所有權」「角色」「切片」「決策紀錄」;features.md「願景、需求、目標與路線」;laws.md「全域 Law」;boundary.md 全份;tooling.md「CLI」「跑東西的紀律」「收尾定錨」 |
| `dev-flow:law-design` | features.md「feature 與 abstract」「編號與引用」「簽名怎麼寫」「frontmatter 與 status」「節」「什麼要有 law」;laws.md「Law 怎麼談」「Law 與需求」「全域 Law」;roles.md「分支與所有權」「首跑」「決策紀錄」;boundary.md「模組表」「對外 I/O」;tooling.md「CLI」「收尾定錨」 |
| `dev-flow:build` | roles.md 全份;features.md「提問(GAP)」「修訂(REV)」「完成度」;tooling.md「CLI」「測試歸屬」「跑東西的紀律」「收尾定錨」 |
| `dev-flow:qa` | roles.md「角色」「委派」「驗收測試」「qa 的交付」;features.md「節」「什麼要有 law」「提問(GAP)」;boundary.md「測試與邊界」;tooling.md「測試歸屬」 |
| `dev-flow:refactor` | roles.md「角色」「分支與所有權」「委派」「切片」;features.md「節」「提問(GAP)」;boundary.md「層」「匯出」 |
| `dev-flow:integrate` | roles.md「分支與所有權」「決策紀錄」「整合」「仲裁」;features.md「提問(GAP)」「完成度」「ADR」;laws.md「全域 Law」;tooling.md「CLI」「跑東西的紀律」「收尾定錨」 |
| `dev-flow:revise` | features.md「frontmatter 與 status」「修訂(REV)」「提問(GAP)」「願景、需求、目標與路線」「完成度」;laws.md「影響範圍與選項」「全域 Law 的變更」「Law 與需求」「全域 Law」;roles.md「分支與所有權」「首跑」;tooling.md「收尾定錨」 |
| `dev-flow:abstract` | features.md「收整(abstract)」「feature 與 abstract」「修訂(REV)」「節」;laws.md「Law 怎麼談」;roles.md「分支與所有權」;boundary.md「層」「模組表」;tooling.md「CLI」「收尾定錨」 |
| `dev-flow:status` | tooling.md「CLI」「status 報告」「收尾定錨」;features.md「願景、需求、目標與路線」「完成度」;laws.md「全域 Law」 |
| `dev-flow:audit` | tooling.md「CLI」「status 報告」;boundary.md 全份;features.md「願景、需求、目標與路線」「節」「什麼要有 law」「完成度」「收整(abstract)」;laws.md「全域 Law」「Law 怎麼談」 |

prompt 標明委派模式的執行另讀 roles.md「委派」,不讀「收尾定錨」。

`dev-flow:study` 不碰文檔模型,不讀本規章。
