# dev-flow 規章

`dev-flow` 替一般程式語言的專案做需求導向的開發:**需求(必須達成)先講好,先用實作貫通一條垂直切片,再對著跑得通的東西談 Law(不得違反)、把整個專案都該守的抽成全域 Law、寫測試、調整實作**。判準只有一題:這件事有沒有做完的一天?有 = 需求,沒有 = law。

- **需求面三層**:`system.md` 的願景 → `requirements/` 一檔一條的需求(各有一句可判定的驗收與優先 1 到 4)→ 需求檔裡的里程碑(有順序、依序完成,每一條是一個使用者看得到、展示得出來的階段,也是一條切片的範圍)。
- **約束面兩種範圍**:全域 Law(住 `system.md`「全域 Law」一區,三類:領域不變量、架構的層、契約的對外 I/O)與住在一份 feature 裡的 scope law。任何程式碼都受全域 Law 加上它自己那份文檔的 scope law 約束。
- **做之前就寫的**只有願景、需求(含里程碑)與 `system.md` 的 Constraint(硬性限制;它不是 law,沒有三行也沒有測試)。law 一律從做出來的實作裡抽出來,不在沒有程式碼的時候立。
- **一條里程碑的一生**都在同一條分支、同一棵工作樹上:`kickoff` → `require-design` → `spike-impl` → `scope-laws`(→ `global-laws`)→ `build` → `integrate`。既有文檔的改動照 laws.md「分流」。
- **合進主線之後**:上線與否從 git tag 推(`devflow release`);線上壞了由 `dev-flow:incident` 重現、歸因,交給分流指定的 skill。
- 進度不是欄位,由 `devflow status` 從檔案、程式碼與測試推導。

`rules/` 五份主題規章是每條規則唯一的住處;skill 只寫步驟並用檔名加節名引用,不重述。

| 檔 | 節 |
|---|---|
| `laws.md` | 分流、Law 與需求、全域 Law、全域 Law 怎麼長出來、影響範圍與選項、Law 怎麼談、全域 Law 的變更 |
| `features.md` | `.design/`、名詞、system.md、願景、需求與里程碑、談需求、靠修訂達成的里程碑、feature、編號與引用、簽名怎麼寫、frontmatter 與 status、節、Steps、Laws、什麼要有 law、修訂(REV)、提問(GAP)、需求的達成只有人判得了、完成度、ADR |
| `boundary.md` | 層、模組表、IO 模組、匯出、對外 I/O、測試與邊界 |
| `roles.md` | 流程、分支、誰能動什麼、角色、委派、切片、首跑、驗收測試、qa 的交付、仲裁、測試跑幾次、收尾、決策紀錄、整合、事故 |
| `tooling.md` | CLI、lint、落筆指令、看板、migrate、status 報告、發布、測試歸屬、language adapter、跑東西的紀律、收尾定錨 |

## 名詞

| 名詞 | 在哪 |
|---|---|
| 願景、優先各級、Constraint(硬性限制與工具要讀的那幾行) | features.md「system.md」 |
| 專案的名詞表(專案根目錄 `CLAUDE.md` 的「## 名詞」節)、型別欄、誰寫 | features.md「名詞」 |
| 需求、`R-n`、驗收、優先、里程碑、`M-n`、全名 `M-n-<slug>`、綁定、還沒有切片、需求的依賴 | features.md「願景、需求與里程碑」 |
| 階段性使用者驗收、里程碑怎麼切、新需求的衝突檢查 | features.md「談需求」 |
| 靠修訂達成的里程碑、做出文檔的里程碑、`--bind`、待修訂 | features.md「靠修訂達成的里程碑」 |
| 必須達成與不得違反、全域 Law 與 scope law、law 住哪裡、里程碑不管理約束 | laws.md「Law 與需求」 |
| 修訂的分流(調整既有的 law / 既有的 law 不動)、一件修訂一個 skill、放棄並整件轉交 | laws.md「分流」 |
| 全域 Law、三類、`INV-n`、`lint global` | laws.md「全域 Law」 |
| 准入四條、從切片裡抽上去(三類各自誰談、誰落筆)、全域的候選、law 只從實作裡抽出來 | laws.md「全域 Law 怎麼長出來」 |
| 影響範圍與選項 | laws.md「影響範圍與選項」 |
| 全域 Law 的抽上去與變更、變更要開發者明確批准、重新驗證受影響的工作 | laws.md「全域 Law 的變更」 |
| 要 / 不准 / 不在乎、用例子問、寫得出反例實作才是 law、第一次談約束的四項 | laws.md「Law 怎麼談」 |
| feature、step、`=` 列 / 整條、`!` 列 / 進入點、`o` 列 / 觀察點 | features.md「feature」 |
| 全名、`F-00x#name`、`F-00x#LAW-n`、`R-n#ACCEPT`、`INV-n#LAW`、號段、`owner`、`lint ids`、引用別份文檔的 step、一個 step 只住一份文檔 | features.md「編號與引用」 |
| 正規式簽名、`型別.方法`、型別註記可省 | features.md「簽名怎麼寫」;tooling.md「language adapter」 |
| `draft` / `ready` / `verified`、重開 | features.md「frontmatter 與 status」 |
| Brief、決定 | features.md「節」 |
| Steps 表、`#` 欄 | features.md「Steps」 |
| 三行式、law 種類、`given` 的時序、Examples | features.md「Laws」 |
| 什麼要有 law、自由度、內部支架 | features.md「什麼要有 law」 |
| REV、動到 / 保護 / 重委派 / 連動、機械同步、刪 step、文檔退役 | features.md「修訂(REV)」 |
| GAP、`gaps.md` | features.md「提問(GAP)」 |
| 需求的審核六種狀態、驗收記錄、人簽的是當時那份證據 | features.md「需求的達成只有人判得了」 |
| 簽名 m / n、未實作 s、laws g / k、達成、里程碑達成 | features.md「完成度」 |
| ADR、誰寫 | features.md「ADR」;roles.md「整合」 |
| 層、由內而外、最外層 | boundary.md「層」 |
| 模組表、未登記、幽靈、`目錄/**` | boundary.md「模組表」 |
| IO 模組、匯出 | boundary.md「IO 模組」「匯出」 |
| 對外 I/O、信任、驗證、契約、秘密字面值 | boundary.md「對外 I/O」 |
| 後門 | boundary.md「測試與邊界」 |
| 五個階段與它們的核心 | roles.md「流程」;各 SKILL.md 開頭 |
| `plan/` 與 `build/` 分支、鍵、工作樹、建構中、專案的第一條切片單獨走完 | roles.md「分支」 |
| 分支上准動與不准動的、宣告歸設計本體歸實作 | roles.md「誰能動什麼」 |
| spike-impl、conductor、qa、refactor | roles.md「角色」 |
| 委派、`model: sonnet`、開工 context(`devflow brief`)、指紋、回報六項 | roles.md「委派」 |
| 切片、離場條件、可以假、`verdict`、草稿 | roles.md「切片」 |
| 首跑、首跑該紅、未實作標記 | roles.md「首跑」 |
| 驗收測試、`build/R-n`、`build/INV-n` | roles.md「驗收測試」 |
| 產生器、shrink、覆蓋率、案例數上限 | roles.md「qa 的交付」 |
| 仲裁四分流 | roles.md「仲裁」 |
| 收尾、開發者的決定只在五個地方 | roles.md「收尾」 |
| 決策紀錄、`journal/<鍵>.md`、切片六節、Verification、合併時要看 | roles.md「決策紀錄」 |
| 整合分支、清單型衝突、合併後紅、整合的仲裁三選項、清理 | roles.md「整合」 |
| `<D>`、子命令、exit code、`brief` | tooling.md「CLI」 |
| 各道 lint 紅在哪 | tooling.md「lint」 |
| `claim`、`requirement`、`invariant add` | tooling.md「落筆指令」 |
| 建構中走到哪一步、修訂熱點、建議路線 | tooling.md「status 報告」 |
| 發布、上線、發布行、`devflow release`、已驗收而還沒上線 | tooling.md「發布」 |
| 事故、重現、使用者手上的那一版、歸因、會紅的測試只活在 build 分支上 | roles.md「事故」 |
| 測試歸屬的兩種寫法 | tooling.md「測試歸屬」 |
| adapter | tooling.md「language adapter」 |
| 三道關 | tooling.md「跑東西的紀律」 |
| 定錨區塊 | tooling.md「收尾定錨」 |

## 每個 skill 讀什麼

不必查表:每份 SKILL.md 的「開工 context」在載入 skill 的那一刻跑 `devflow brief <skill> [<目標>]`,它要讀的規章節與它在這個專案裡要看的東西一次給齊。哪個 skill 讀哪幾節的表住在 CLI 的 `RULES`(`lib/commands/brief.mjs`),是唯一來源;一個 skill 只拿它做決定要用的節。

同一場裡要再查別的節:`node "<D>/bin/devflow.mjs" section <檔> <節>…`,`<D>` 是 skill 的基準目錄往上兩層。
