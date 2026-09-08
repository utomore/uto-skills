# dev-flow 規章

`dev-flow` 替一般程式語言的專案做 spec 驅動開發。文檔的單位是 **feature**:一段從對外邊界進、從對外邊界出的資料流,直接掛在 `system.md` 底下,沒有子系統這一層。feature 之上是三層「為什麼」:`system.md` 的**願景**、`objectives.md` 的**目標**(優先 1 到 4)與目標底下的**里程碑**,每條里程碑綁定它要做到的 feature。feature 之間長出來的共同部分由 `dev-flow:refactor` 收整成 **abstract**,被收整的每一份 feature 記一條 REV。進度不是欄位,由 `devflow status` 從程式碼與測試推導。

`rules/` 四份主題規章是每條規則唯一的住處;skill 只寫步驟並用檔名加節名引用,不重述。

| 檔 | 主題 |
|---|---|
| `features.md` | `.design/` 樹、system.md、願景、目標與里程碑、feature 與 abstract、簽名寫法、節、laws、REV、收整、GAP、願望 step、完成度、ADR、spike |
| `boundary.md` | 層、模組表、IO 模組、匯出、對外 I/O 與安全三條、測試與邊界 |
| `roles.md` | 兩個階段、conductor / qa / impl、委派、骨架與基線、收尾、仲裁、測試跑幾次、委派模型 |
| `tooling.md` | CLI 子命令與 exit code、status 報告版面、測試歸屬、language adapter、跑東西的紀律、收尾定錨 |

## 名詞

| 名詞 | 在哪 |
|---|---|
| 願景、目標、`O-n`、優先、判準、里程碑、`M-n`、綁定、完成度 | features.md「願景、目標與里程碑」 |
| feature、abstract、step、`=` 列 / 整條、`!` 列 / 進入點、`o` 列 / 觀察點 | features.md「feature 與 abstract」 |
| 全名、`F-00x#name`、`F-00x#LAW-n` | features.md「編號與引用」 |
| 正規式簽名、`型別.方法`、型別註記可省 | features.md「簽名怎麼寫」;tooling.md「language adapter」 |
| `draft` / `ready` / `frozen`、解凍 | features.md「frontmatter 與 status」 |
| Brief、Steps、Laws、law 種類、`given` 的時序、Examples、決定 | features.md「節」 |
| 什麼要有 law、自由度、內部支架 | features.md「什麼要有 law」 |
| REV、動到 / 保護 / 重委派 / 連動 | features.md「修訂(REV)」 |
| 收整、abstract 的存在條件、抽出來的是資料流 | features.md「收整(refactor)」 |
| GAP、`gaps.md` | features.md「提問(GAP)」 |
| 願望 step | features.md「願望 step」 |
| 簽名 m / n、骨架 s、laws g / k、達成 | features.md「完成度」 |
| ADR、spike、SPK、RND、verdict、feeds | features.md「ADR」「spike」 |
| 層、由內而外、最外層 | boundary.md「層」 |
| 模組表、未登記、幽靈、`目錄/**` | boundary.md「模組表」 |
| IO 模組、匯出 | boundary.md「IO 模組」「匯出」 |
| 對外 I/O、信任、驗證、秘密字面值、沒登記的出入口 | boundary.md「對外 I/O」 |
| 後門 | boundary.md「測試與邊界」 |
| conductor、qa、impl | roles.md「三角色」 |
| 委派、回報五項 | roles.md「委派」 |
| 骨架標記、基線、骨架快照 | roles.md「骨架與基線」 |
| 產生器、shrink、覆蓋率、案例數上限 | roles.md「qa 的交付」 |
| 仲裁四分流 | roles.md「仲裁」 |
| `<D>`、子命令、exit code | tooling.md「CLI」 |
| 修訂熱點 | tooling.md「status 報告」 |
| 測試歸屬的兩種寫法 | tooling.md「測試歸屬」 |
| adapter | tooling.md「language adapter」 |
| 三道關 | tooling.md「跑東西的紀律」 |
| 定錨區塊 | tooling.md「收尾定錨」 |

## 每個 skill 讀什麼

`<D>` 解析一次(tooling.md「CLI」);節用 `node "<D>/bin/devflow.mjs" section <檔> <節>…` 取,一次讀完。

| skill | 必讀 |
|---|---|
| `dev-flow:project` | features.md「`.design/`」「system.md」「願景、目標與里程碑」「ADR」;boundary.md 全份;tooling.md「language adapter」「收尾定錨」 |
| `dev-flow:objective` | features.md「願景、目標與里程碑」「完成度」;tooling.md「CLI」「status 報告」「收尾定錨」 |
| `dev-flow:feature` | features.md「feature 與 abstract」「編號與引用」「簽名怎麼寫」「frontmatter 與 status」「節」「什麼要有 law」「願望 step」;boundary.md「模組表」「對外 I/O」;tooling.md「收尾定錨」 |
| `dev-flow:refactor` | features.md「收整(refactor)」「feature 與 abstract」「修訂(REV)」「節」;boundary.md「層」「模組表」;tooling.md「CLI」「收尾定錨」 |
| `dev-flow:build` | roles.md 全份;features.md「提問(GAP)」「修訂(REV)」「完成度」;tooling.md「CLI」「測試歸屬」「跑東西的紀律」「收尾定錨」 |
| `dev-flow:qa` | roles.md「三角色」「委派」「qa 的交付」;features.md「節」「什麼要有 law」「提問(GAP)」;boundary.md「測試與邊界」;tooling.md「測試歸屬」 |
| `dev-flow:impl` | roles.md「三角色」「委派」;features.md「節」「提問(GAP)」;boundary.md「層」「匯出」 |
| `dev-flow:revise` | features.md「frontmatter 與 status」「修訂(REV)」「提問(GAP)」;tooling.md「收尾定錨」 |
| `dev-flow:status` | tooling.md「CLI」「status 報告」「收尾定錨」;features.md「願景、目標與里程碑」「完成度」 |
| `dev-flow:audit` | tooling.md「CLI」「status 報告」;boundary.md 全份;features.md「願景、目標與里程碑」「節」「什麼要有 law」「完成度」「收整(refactor)」 |
| `dev-flow:spike` | features.md「spike」;roles.md「委派」「spike」;tooling.md「跑東西的紀律」 |

prompt 標明委派模式的執行另讀 roles.md「委派」,不讀「收尾定錨」。

`dev-flow:branch-pr` 與 `dev-flow:study` 不碰文檔模型,不讀本規章。
