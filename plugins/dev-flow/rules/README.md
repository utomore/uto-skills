# dev-flow 規章

`dev-flow` 替一般程式語言的專案做需求導向的開發:**需求(必須達成)與全域 Law(不得違反)先講好,先用實作貫通一條垂直切片,再對著跑得通的東西談 Law、寫測試、調整實作**。兩棵樹各管各的。需求面三層:`system.md` 的**願景**(北極星)→ `requirements/` 一檔一條的**需求**(必須達成的事,各有一句可判定的驗收與優先 1 到 4)→ 需求檔裡的**里程碑**(有順序、依序完成;每一條是一個使用者看得到、展示得出來的階段,也是一條切片的範圍;全部達成,這條需求的建置就走完);把既有的東西改快、改小、改好,也是這條需求底下的一條里程碑:綁既有的 feature,靠修訂它達成。約束面只有兩種範圍:**全域 Law**(住 `system.md`「全域 Law」一區,三類:領域不變量、架構的層、契約的對外 I/O),與住在一份 feature 裡的 **scope law**;任何程式碼都受全域 Law 加上它自己那份文檔的 scope law 約束。判準:這件事有沒有做完的一天,有 = 需求,沒有 = law。做之前就寫的只有願景、需求(含里程碑)與全域 Law。

立案三步:`dev-flow:kickoff` 開樹(願景、語言與工具、模組表)→ `dev-flow:require-design` 與開發者談需求並當場切成里程碑 → `dev-flow:global-laws` 定全域 Law 三區。之後一條里程碑的一生都在同一條分支、同一棵工作樹上:`dev-flow:spike-impl` 貫通切片並留下決策紀錄 → `dev-flow:scope-laws` 根據切片的決策紀錄、對著切片與開發者逐條談約束(資料交互、資料儲存在哪、外部串接方法、軟體架構四項都問到),寫成 **feature**(一段從對外邊界進、從對外邊界出的資料流,直接掛在 `system.md` 底下,沒有子系統這一層)→ `dev-flow:build` 派 qa 只讀文檔寫測試、驗首跑、派 refactor 調整實作,每條 law 成立才算達成 → `dev-flow:integrate` 把達成的分支合在一起,仲裁互斥的 law、寫 ADR、發 PR。測試涵蓋到哪裡,功能的承諾就到哪裡。一個 step 與它的 law 只住在一份文檔——先做出它的那一份;別的文檔要用它就引用,law 不重寫。需求的編號只是身分,需求之間誰疊在誰上面由文檔的引用推出來。既有文檔的改動一句話分流:要調整(修改、放寬、替換、刪除)既有的 law 走 `dev-flow:scope-laws`,整件修訂由它一手包辦;law 不動、或只新增 law,而 `verified` 文檔的簽名、型別、模組或實作要變走 `dev-flow:scope-revise`(原有的每條 law 修訂前後都成立);全域 Law 的每一次變更走 `dev-flow:global-laws`;需求面的條目走 `dev-flow:require-design`。一件修訂從頭到尾只有一個修訂類的 skill 在跑,跑到 `verified` 為止;兩種修訂都在被動到的每一份文檔記一條 REV。進度不是欄位,由 `devflow status` 從檔案、程式碼與測試推導。

`rules/` 五份主題規章是每條規則唯一的住處;skill 只寫步驟並用檔名加節名引用,不重述。

| 檔 | 主題 |
|---|---|
| `laws.md` | law 是不得違反、需求是必須達成,判準是有沒有做完的一天;law 的兩種範圍(全域 Law 住 `system.md`「全域 Law」區,scope law 住一份 feature)、全域 Law 三類與准入四條、Law 怎麼談、調整 law 之前的影響範圍與選項、全域 Law 的第一次定義與變更 |
| `features.md` | `.design/` 樹、system.md、願景、需求與里程碑、feature 文檔怎麼寫:編號與引用、簽名寫法、節、什麼要有 law、REV(含刪 step 與文檔退役)、GAP、完成度、ADR |
| `boundary.md` | 層、模組表、IO 模組、匯出、對外 I/O(信任、驗證、契約)與安全三條、測試與邊界 |
| `roles.md` | 五個階段、分支與所有權、spike-impl / conductor / qa / refactor、委派、切片、首跑、驗收測試、收尾、仲裁、測試跑幾次、決策紀錄、整合、委派模型 |
| `tooling.md` | CLI 子命令與 exit code、status 報告版面、測試歸屬、language adapter、跑東西的紀律、收尾定錨 |

## 名詞

| 名詞 | 在哪 |
|---|---|
| 願景、優先各級 | features.md「system.md」「願景、需求與里程碑」 |
| 需求、`R-n`、需求檔 `requirements/R-n-<slug>.md`、驗收、優先 | features.md「願景、需求與里程碑」 |
| 必須達成與不得違反、有沒有做完的一天、全域 Law 與 scope law、law 住哪裡、誰定哪一種、里程碑不管理約束 | laws.md「Law 與需求」 |
| 里程碑、`M-n`、全名 `M-n-<slug>`、引用寫全名、階段性使用者驗收、依序一次一條、綁定、還沒有切片 | features.md「願景、需求與里程碑」 |
| 靠修訂達成的里程碑、做出文檔的里程碑、`--bind`、待修訂 | features.md「願景、需求與里程碑」「修訂(REV)」「完成度」 |
| 全域 Law、三類(領域不變量、架構、契約)、`INV-n`、准入四條、變更要開發者明確批准、`lint global` | laws.md「全域 Law」 |
| 影響範圍與選項、全域 Law 的第一次定義與變更、重新驗證受影響的工作 | laws.md「影響範圍與選項」「全域 Law 的變更」 |
| 需求達成、完成度、里程碑達成 | features.md「完成度」 |
| feature、step、`=` 列 / 整條、`!` 列 / 進入點、`o` 列 / 觀察點 | features.md「feature」 |
| 全名、`F-00x#name`、`F-00x#LAW-n`、`R-n#ACCEPT`、`INV-n#LAW`、號段、`owner`、`lint ids` | features.md「編號與引用」 |
| 正規式簽名、`型別.方法`、型別註記可省 | features.md「簽名怎麼寫」;tooling.md「language adapter」 |
| `draft` / `ready` / `verified`、重開 | features.md「frontmatter 與 status」 |
| Brief、Steps、Laws、law 種類、`given` 的時序、Examples、決定 | features.md「節」 |
| 什麼要有 law、自由度、內部支架 | features.md「什麼要有 law」 |
| 要 / 不准 / 不在乎、用例子問、寫得出反例實作才是 law、第一次談約束的四項(資料交互、資料儲存在哪、外部串接方法、軟體架構) | laws.md「Law 怎麼談」 |
| REV、動到 / 保護 / 重委派 / 連動、修訂的分流(調整既有的 law / 既有的 law 不動)、一件修訂一個 skill、放棄並整件轉交、機械同步 | features.md「修訂(REV)」;laws.md「影響範圍與選項」 |
| 引用別份文檔的 step(「見 <全名>」)、一個 step 只住一份文檔、重複的 step 留一份 | features.md「編號與引用」;roles.md「整合」 |
| 刪 step、文檔退役 | features.md「修訂(REV)」 |
| 需求的依賴、新需求的衝突檢查、里程碑綁既有的 feature(靠修訂達成的里程碑) | features.md「願景、需求與里程碑」 |
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
| 委派、開工 context(`devflow brief`)、指紋、回報六項 | roles.md「委派」;tooling.md「CLI」 |
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

不必查表:每份 SKILL.md 的「開工 context」在載入 skill 的那一刻跑 `devflow brief <skill> [<目標>]`,它要讀的規章節與它在這個專案裡要看的東西(目標文檔、逐條狀態、宣告、需求檔、決策紀錄、分支與工作樹、lint、status 報告,依 skill 而定)一次給齊。哪個 skill 讀哪幾節的表住在 CLI 裡,是唯一來源;`devflow brief <skill>` 印出來的「規章」那一塊就是它。

同一場裡要再查別的節:`node "<D>/bin/devflow.mjs" section <檔> <節>…`,`<D>` 是 skill 的基準目錄往上兩層(tooling.md「CLI」)。
