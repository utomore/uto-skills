# lawful 規章

`lawful` 替純函數式專案(functional core / imperative shell)做 spec 驅動開發,實作先行。文檔的單位是 **pipeline**:一段 input → 純轉換 → output 的資料流,類別寫在 `kind`:兩端碰 shell 的是 `io`、只在純核心裡的是 `subflow`;stage 是住在程式碼裡的簽名,laws 是開發者對著跑得通的切片逐條拍板的承諾。兩棵樹各管各的。需求面三層:`Cone.md` 的**願景**(北極星)→ `requirements/` 一檔一條的**需求**(必須達成的事,各有一句可判定的驗收與優先 1 到 4)→ 需求檔裡的**里程碑** `M-n-<slug>`(有順序、依序完成;每一條是一個使用者看得到、展示得出來的階段,也是一條垂直切片的範圍;全部達成,這條需求的建置就走完);里程碑走完之後的**調整**只改既有 pipeline 的品質,每一次之後需求仍要達成。約束面只有兩種範圍:**全域 Law**(領域不變量、架構的四層、契約的對外 I/O,住 `Cone.md` 一區,每類一道 lint)與 **scope law**(一條 pipeline 的 Laws 節);任何程式碼都受全域 Law 加上它自己那條 pipeline 的 scope law 約束。判準:這件事有沒有做完的一天,有 = 需求,沒有 = law。

做之前只寫判得出真假的東西(願景、需求與里程碑、全域 Law),其餘等跑得通了再講。一條里程碑走五個階段:

| 階段 | skill | 產出 |
|---|---|---|
| 立案 | `lawful:kickoff`(開樹、願景、專案約束、已經看得出來的模組單元)→ `lawful:require-design`(需求,當場切成里程碑)→ `lawful:global-laws`(全域 Law 三區);之後要多劃一個模組單元走 `lawful:module` | `Cone.md`、`requirements/`、模組單元表;經 `plan/<slug>` 合進主線 |
| 切片 | `lawful:spike-impl <M-n-slug>` | `build/M-n-<slug>` 上一條從進入點貫通到出口、跑得通的切片,與決策紀錄;途中要一個還沒有的模組單元,先 `lawful:module` |
| Law | `lawful:scope-laws <M-n-slug>` | 根據切片的決策紀錄、對著切片與開發者逐條談約束(資料交互、資料儲存在哪、外部串接方法、軟體架構四項都問到),從切片 claim 出來的 pipeline:Stages 抄程式碼、laws 逐條拍板,`ready` |
| 建構 | `lawful:build`(scope-laws 與 scope-revise 收尾自動接上),委派 `lawful:qa` 與 `lawful:refactor` | 測試、讓每條 law 成立的實作,`verified` |
| 整合 | `lawful:integrate` | 整合分支、仲裁、ADR、PR |

一個 stage 與它的 law 只住在一條 pipeline——先做出它的那一條(通常是一條 subflow);別條要用它就引用,law 不重寫。需求的編號只是身分,需求之間誰疊在誰上面由 pipeline 的引用推出來。既有 pipeline 的改動一句話分流:要調整(修改、放寬、替換、刪除)既有的 law 走 `lawful:scope-laws`,整件修訂由它一手包辦;law 不動、或只新增 law,而 `verified` 的 pipeline 的簽名、型別、模組或實作要變走 `lawful:scope-revise`(原有的每條 law 修訂前後都成立);全域 Law 的每一次變更走 `lawful:global-laws`;需求面的條目走 `lawful:require-design`。一件修訂從頭到尾只有一個修訂類的 skill 在跑,跑到 `verified` 為止;兩種修訂都在被動到的每一條 pipeline 記一條 REV,改完同樣接上 build。`lawful:status` 講現況與下一步,`lawful:audit` 對帳,`lawful:study` 導讀。

模組單元只劃邊界,不決定裡面有什麼函數;單元裡的簽名由切片長出來、由 pipeline 的 Stages 表記下來,在既有單元裡加、改、搬東西不必回頭動模組表。

`rules/` 五份主題規章是每條規則唯一的住處;skill 只寫步驟並用檔名加節名引用,不重述。

| 檔 | 主題 |
|---|---|
| `pipelines.md` | `.lawful/` 樹、Cone.md、願景、需求與里程碑、pipeline 文檔怎麼寫:編號與引用、簽名怎麼寫、節、什麼要有 law、REV(含刪 stage 與文檔退役)、GAP、完成度、ADR |
| `laws.md` | law 是不得違反、需求是必須達成,判準是有沒有做完的一天;law 的兩種範圍、全域 Law 三類與准入四條、Law 怎麼談、調整 law 之前的影響範圍與選項、全域 Law 的第一次定義與變更 |
| `boundary.md` | 四層、模組單元、模組表、效果的判定、對外 I/O、測試與邊界 |
| `roles.md` | 五個階段、分支與所有權、spike-impl / conductor / qa / refactor、委派、切片、首跑、驗收測試、收尾、仲裁、測試跑幾次、決策紀錄、整合、委派模型 |
| `tooling.md` | CLI 子命令與 exit code、status 報告版面、language adapter、跑東西的紀律、收尾定錨 |

## 名詞

| 名詞 | 在哪 |
|---|---|
| 願景、專案約束、優先各級 | pipelines.md「Cone.md」「願景、需求與里程碑」 |
| 需求、`R-n`、需求檔 `requirements/R-n-<slug>.md`、驗收、`R-n#ACCEPT`、優先 | pipelines.md「願景、需求與里程碑」 |
| 里程碑、`M-n`、全名 `M-n-<slug>`、階段性使用者驗收、依序一次一條、綁定、還沒有切片 | pipelines.md「願景、需求與里程碑」 |
| 調整、`RF-n`、動到、待修訂 | pipelines.md「願景、需求與里程碑」「修訂(REV)」 |
| 需求的依賴、新需求的衝突檢查、里程碑綁既有的 pipeline | pipelines.md「願景、需求與里程碑」 |
| 需求達成 / 未達成 / 未知、完成度、調整達成 | pipelines.md「完成度」 |
| 必須達成與不得違反、有沒有做完的一天、全域 Law 與 scope law、law 住哪裡、誰定哪一種、里程碑不管理約束 | laws.md「Law 與需求」 |
| 領域不變量、`INV-n`、`INV-n#LAW`、准入四條、`lint invariants`、`lint global` | laws.md「全域 Law」 |
| 要 / 不准 / 不在乎、讓它變假的實作、第一次談約束的四項(資料交互、資料儲存在哪、外部串接方法、軟體架構) | laws.md「Law 怎麼談」 |
| 影響範圍、選項、「不改」 | laws.md「影響範圍與選項」 |
| 全域 Law 的第一次定義與變更、明確批准、重新驗證 | laws.md「全域 Law 的變更」 |
| pipeline、stage、`=` 列 / 純的整條、`!` 列 / 進入點、`o` 列 / 觀察點、`kind`、`io`、`subflow` | pipelines.md「pipeline」「frontmatter 與 status」 |
| 全名、`P-00x#name`、`P-00x#LAW-n`、號段、`owner`、`lint ids` | pipelines.md「編號與引用」 |
| 引用別條 pipeline 的 stage(「見 <全名>」)、一個 stage 只住一條 pipeline、重複的 stage 留一份 | pipelines.md「編號與引用」;roles.md「整合」 |
| 簽名逐字、存取子、class 方法、有名字的型別 | pipelines.md「簽名怎麼寫」 |
| `draft` / `ready` / `verified`、重開 | pipelines.md「frontmatter 與 status」 |
| Brief、Stages、Laws、law 種類、Examples、決定 | pipelines.md「節」 |
| 什麼要有 law、自由度、內部支架、class 法則 | pipelines.md「什麼要有 law」 |
| REV、依 / 動到 / 保護 / 重委派 / 連動、修訂的分流(調整既有的 law / 既有的 law 不動)、一件修訂一個 skill、放棄並整件轉交、機械同步 | pipelines.md「修訂(REV)」;laws.md「影響範圍與選項」 |
| 刪 stage、文檔退役 | pipelines.md「修訂(REV)」 |
| GAP、`gaps.md` | pipelines.md「提問(GAP)」 |
| 簽名 m / n、未實作 s、laws g / k、達成 | pipelines.md「完成度」 |
| ADR | pipelines.md「ADR」 |
| types / effect / core / shell、效果 ADT、匯出清單、架構:四層 | boundary.md「四層」 |
| 模組單元、原始碼樹、子函式庫、門面、模組前綴、原始碼根目錄 | boundary.md「模組單元」 |
| 模組表、未登記、`--module` | boundary.md「模組表」 |
| 效果型別、IO 模組、`isEffectful`、純解譯器、真解譯器 | boundary.md「效果的判定」 |
| 契約:對外 I/O、契約欄、`lint io` | boundary.md「對外 I/O」 |
| `*.Internal`、後門 | boundary.md「測試與邊界」 |
| 五個階段、核心 | roles.md「五個階段」 |
| `plan/` / `build/` 分支、工作樹、建構中、宣告與本體、所有權 | roles.md「分支與所有權」 |
| spike-impl、conductor、qa、refactor | roles.md「角色」 |
| 委派、開工 context(`lawful brief`)、指紋、回報六項 | roles.md「委派」;tooling.md「CLI」 |
| 切片、離場四項、走不通、`verdict` | roles.md「切片」 |
| 首跑、首跑該紅、未實作標記 | roles.md「首跑」 |
| 驗收測試、`build/R-n`、`build/INV-n` | roles.md「驗收測試」 |
| 產生器、shrink、覆蓋率、案例數上限 | roles.md「qa 的交付」 |
| 仲裁四分流 | roles.md「仲裁」 |
| 決策紀錄、`journal/<鍵>.md`、Decisions、Constraint、Faked / Unverified | roles.md「決策紀錄」 |
| 整合分支、清單型衝突、合併後紅、仲裁三選項、變更建議、走不通的切片、清理 | roles.md「整合」 |
| `<L>`、子命令、exit code、`migrate laws`、`migrate cone`、`migrate requirements` | tooling.md「CLI」 |
| 需求表的「依賴」欄、建構中走到哪一步 | tooling.md「status 報告」 |
| adapter | tooling.md「language adapter」 |
| 三道關 | tooling.md「跑東西的紀律」 |
| 定錨區塊 | tooling.md「收尾定錨」 |

## 每個 skill 讀什麼

不必查表:每份 SKILL.md 的「開工 context」在載入 skill 的那一刻跑 `lawful brief <skill> [<目標>]`,它要讀的規章節與它在這個專案裡要看的東西(目標 pipeline、逐條狀態、簽名與型別的宣告、types 層、`Cone.md`、需求檔、決策紀錄、分支與工作樹、lint、status 報告,依 skill 而定)一次給齊。哪個 skill 讀哪幾節的表住在 CLI 裡,是唯一來源;`lawful brief <skill>` 印出來的「規章」那一塊就是它。

`<L>` 是 plugin 根目錄,也就是 skill 的基準目錄往上兩層(tooling.md「CLI」);單獨要一節時用 `node "<L>/bin/lawful.mjs" section <檔> <節>…`。
