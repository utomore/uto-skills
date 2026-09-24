# lawful 規章

`lawful` 替純函數式專案 (functional core / imperative shell) 做 spec 驅動開發，實作先行。文檔的單位是 **pipeline**：一段 input → 純轉換 → output 的資料流，`kind` 兩端碰 shell 的是 `io`、只在純核心裡的是 `subflow`；stage 是住在程式碼裡的簽名，laws 是開發者對著跑得通的切片逐條拍板的承諾。判準只有一題：這件事有沒有做完的一天？有 = 需求，沒有 = law。

- **需求面三層**：`Cone.md` 的願景 → `requirements/` 一檔一條的需求（各有一句可判定的驗收與優先 1 到 4）→ 需求檔裡的里程碑 `M-n-<slug>`（有順序、依序完成，每一條是一個使用者看得到、展示得出來的階段，也是一條垂直切片的範圍）。
- **約束面兩種範圍**：全域 Law（領域不變量、架構的四層、契約的對外 I/O，住 `Cone.md` 一區，每類一道 lint）與 scope law（一條 pipeline 的 Laws 節）。任何程式碼都受全域 Law 加上它自己那條 pipeline 的 scope law 約束。
- **做之前就寫的**只有願景、需求（含里程碑）與 `Cone.md` 的 Constraint（硬性限制；它不是 law，沒有三行也沒有測試）。law 一律從做出來的實作裡抽出來，不在沒有程式碼的時候立；四層是 plugin 固定的，立案時照建，每一層「裝什麼」那一句、領域不變量與對外 I/O 表的列等切片長出來。
- 一個 stage 與它的 law 只住在一條 pipeline——先做出它的那一條（通常是一條 subflow）；別條要用它就引用，law 不重寫。需求之間誰疊在誰上面由 pipeline 的引用推出來。
- 模組單元只劃邊界，不決定裡面有什麼函數；在既有單元裡加、改、搬東西不必回頭動模組表。
- 既有 pipeline 的改動照 laws.md「分流」。進度不是欄位，由 `lawful status` 從檔案、程式碼與測試推導。

一條里程碑走五個階段，從切片到達成都在同一條分支、同一棵工作樹上：

| 階段 | skill | 產出 |
|---|---|---|
| 立案 | `lawful:kickoff`（開樹、願景、Constraint、已經看得出來的模組單元）→ `lawful:require-design`（需求，當場切成里程碑）；之後要多劃一個模組單元走 `lawful:module` | `Cone.md`、`requirements/`、模組單元表；經 `plan/<slug>` 合進主線 |
| 切片 | `lawful:spike-impl <M-n-slug>` | `build/M-n-<slug>` 上一條從進入點貫通到出口、跑得通的切片，與決策紀錄；途中要一個還沒有的模組單元，先 `lawful:module` |
| Law | `lawful:scope-laws <M-n-slug>` | 從切片 claim 出來的 pipeline:Stages 抄程式碼、laws 逐條拍板，`ready`；這一片跨過 shell 的那幾端寫進對外 I/O 表；有全域的候選就接上 `lawful:global-laws` |
| 建構 | `lawful:build`（scope-laws、global-laws 與 scope-revise 收尾自動接上），委派 `lawful:qa` 與 `lawful:refactor` | 測試、讓每條 law 成立的實作，`verified` |
| 整合 | `lawful:integrate` | 整合分支、仲裁、ADR、PR |

`lawful:status` 講現況與下一步，`lawful:audit` 對帳，`lawful:study` 導讀。

`rules/` 五份主題規章是每條規則唯一的住處；skill 只寫步驟並用檔名加節名引用，不重述。

| 檔 | 節 |
|---|---|
| `pipelines.md` | `.lawful/`、名詞、Cone.md、願景、需求與里程碑、談需求、靠修訂達成的里程碑、pipeline、編號與引用、簽名怎麼寫、frontmatter 與 status、節、Stages、Laws、什麼要有 law、修訂 (REV)、提問 (GAP)、需求的達成只有人判得了、完成度、ADR |
| `laws.md` | 分流、Law 與需求、全域 Law、全域 Law 怎麼長出來、影響範圍與選項、Law 怎麼談、全域 Law 的變更 |
| `boundary.md` | 四層、模組單元、模組表、效果的判定、對外 I/O、測試與邊界 |
| `roles.md` | 流程、分支、誰能動什麼、角色、委派、切片、首跑、驗收測試、qa 的交付、仲裁、測試跑幾次、收尾、決策紀錄、整合 |
| `tooling.md` | CLI、lint、落筆指令、看板、migrate、status 報告、language adapter、跑東西的紀律、收尾定錨 |

## 名詞

| 名詞 | 在哪 |
|---|---|
| 願景、Constraint（硬性限制與工具要讀的那幾行） | pipelines.md「Cone.md」 |
| 專案的名詞表（專案根目錄 `CLAUDE.md` 的「## 名詞」節）、型別欄、誰寫 | pipelines.md「名詞」 |
| 需求、`R-n`、驗收、`R-n#ACCEPT`、優先與它的四級、里程碑、`M-n`、全名 `M-n-<slug>`、綁定、還沒有切片、需求的依賴 | pipelines.md「願景、需求與里程碑」 |
| 階段性使用者驗收、里程碑怎麼切、新需求的衝突檢查 | pipelines.md「談需求」 |
| 靠修訂達成的里程碑、做出文檔的里程碑、`--bind`、待修訂 | pipelines.md「靠修訂達成的里程碑」 |
| 必須達成與不得違反、全域 Law 與 scope law、law 住哪裡、里程碑不管理約束 | laws.md「Law 與需求」 |
| 修訂的分流（調整既有的 law / 既有的 law 不動）、一件修訂一個 skill、放棄並整件轉交 | laws.md「分流」 |
| 領域不變量、`INV-n`、`INV-n#LAW`、`lint invariants`、`lint global` | laws.md「全域 Law」 |
| 准入四條、從切片裡抽上去（三類各自誰談、誰落筆）、全域的候選、law 只從實作裡抽出來 | laws.md「全域 Law 怎麼長出來」 |
| 影響範圍、選項、「不改」 | laws.md「影響範圍與選項」 |
| 全域 Law 的抽上去與變更、明確批准、重新驗證 | laws.md「全域 Law 的變更」 |
| 背景 / 行為 / 例子三段問法、對 / 不對，應該是 / 不在乎、讓它變假的實作、第一次談約束的四項 | laws.md「Law 怎麼談」 |
| pipeline、stage、`=` 列 / 純的整條、`!` 列 / 進入點、`o` 列 / 觀察點、`kind`、`io`、`subflow` | pipelines.md「pipeline」「frontmatter 與 status」 |
| 全名、`P-00x#name`、`P-00x#LAW-n`、號段、`owner`、`lint ids`、引用別條 pipeline 的 stage、一個 stage 只住一條 pipeline | pipelines.md「編號與引用」 |
| 簽名逐字、存取子、class 方法、有名字的型別 | pipelines.md「簽名怎麼寫」 |
| `draft` / `ready` / `verified`、重開 | pipelines.md「frontmatter 與 status」 |
| Brief、決定 | pipelines.md「節」 |
| Stages 表、`#` 欄 | pipelines.md「Stages」 |
| 三行式、law 種類、Examples | pipelines.md「Laws」 |
| 什麼要有 law、自由度、內部支架、class 法則 | pipelines.md「什麼要有 law」 |
| REV、依 / 動到 / 保護 / 重委派 / 連動、機械同步、刪 stage、文檔退役 | pipelines.md「修訂 (REV)」 |
| GAP、`gaps.md` | pipelines.md「提問 (GAP)」 |
| 需求的審核六種狀態、驗收記錄、人簽的是當時那份證據 | pipelines.md「需求的達成只有人判得了」 |
| 簽名 m / n、未實作 s、laws g / k、達成、里程碑達成 | pipelines.md「完成度」 |
| ADR | pipelines.md「ADR」 |
| types / effect / core / shell、效果 ADT、匯出清單、架構：四層 | boundary.md「四層」 |
| 模組單元、原始碼樹、子函式庫、門面、模組前綴、原始碼根目錄 | boundary.md「模組單元」 |
| 模組表、未登記、`--module` | boundary.md「模組表」 |
| 效果型別、IO 模組、`isEffectful`、純解譯器、真解譯器 | boundary.md「效果的判定」 |
| 契約：對外 I/O、契約欄、`lint io` | boundary.md「對外 I/O」 |
| `*.Internal`、後門 | boundary.md「測試與邊界」 |
| 五個階段與它們的核心 | roles.md「流程」；各 SKILL.md 開頭 |
| `plan/` / `build/` 分支、工作樹、建構中、專案的第一條切片單獨走完 | roles.md「分支」 |
| 分支上准動與不准動的、宣告歸設計本體歸實作 | roles.md「誰能動什麼」 |
| spike-impl、conductor、qa、refactor | roles.md「角色」 |
| 委派、`model: sonnet`、開工 context(`lawful brief`)、指紋、回報六項 | roles.md「委派」 |
| 切片、離場四項、走不通、`verdict` | roles.md「切片」 |
| 首跑、首跑該紅、未實作標記 | roles.md「首跑」 |
| 驗收測試、`build/R-n`、`build/INV-n` | roles.md「驗收測試」 |
| 產生器、shrink、覆蓋率、案例數上限 | roles.md「qa 的交付」 |
| 仲裁四分流 | roles.md「仲裁」 |
| 收尾、開發者的決定只在五個地方 | roles.md「收尾」 |
| 決策紀錄、`journal/<鍵>.md`、Decisions、Constraint、Faked / Unverified、開發者推翻了某一列、收尾時對回最後的程式碼 | roles.md「決策紀錄」 |
| 整合分支、清單型衝突、合併後紅、仲裁三選項、變更建議、走不通的切片、清理 | roles.md「整合」 |
| `<L>`、子命令、exit code、`brief` | tooling.md「CLI」 |
| 各道 lint 紅在哪 | tooling.md「lint」 |
| `module`、`claim`、`requirement`、`invariant add` | tooling.md「落筆指令」 |
| `migrate laws`、`migrate cone`、`migrate requirements` | tooling.md「migrate」 |
| 需求表的「依賴」欄、建構中走到哪一步、建議路線 | tooling.md「status 報告」 |
| adapter | tooling.md「language adapter」 |
| 三道關 | tooling.md「跑東西的紀律」 |
| 定錨區塊 | tooling.md「收尾定錨」 |

## 每個 skill 讀什麼

不必查表：每份 SKILL.md 的「開工 context」在載入 skill 的那一刻跑 `lawful brief <skill> [<目標>]`，它要讀的規章節與它在這個專案裡要看的東西一次給齊。哪個 skill 讀哪幾節的表住在 CLI 的 `RULES`(`lib/commands/brief.mjs`)，是唯一來源；一個 skill 只拿它做決定要用的節。

同一場裡要再查別的節：`node "<L>/bin/lawful.mjs" section <檔> <節>…`，`<L>` 是 skill 的基準目錄往上兩層。
