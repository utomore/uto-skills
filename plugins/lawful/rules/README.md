# lawful 規章

`lawful` 替純函數式專案(functional core / imperative shell)做 spec 驅動開發,實作先行。文檔的單位是 **pipeline**:一段 input → 純轉換 → output 的資料流,兩端碰 shell 的是 IO 介面、只在純核心裡的是子流;stage 是住在程式碼裡的簽名,laws 是開發者對著跑得通的切片逐條拍板的承諾。兩個詞不混用:**需求是必須達成,law 是不得違反。** pipeline 之上是四層「為什麼」:`Cone.md` 的**願景**與**需求**(各有一句可判定的驗收)、`objectives/` 一個目標一個檔的**目標**(每個解決恰好一條需求,有優先 1 到 4)與目標底下的兩條路線:**建置路線**的里程碑 `M-n-<slug>` 一條就是一條垂直切片的範圍,走完需求第一次達成;**優化路線**的調整只改既有 pipeline 的品質,每一次之後需求仍要達成。law 只有兩種範圍:**全域 Law**(領域不變量、架構的四層、契約的對外 I/O,住 `Cone.md` 一區,每類一道 lint)與 **scope law**(一條 pipeline 的 Laws 節)。

做之前只寫判得出真假的東西(需求與驗收、全域 Law),其餘等跑得通了再講。一條里程碑走五個階段:

| 階段 | skill | 產出 |
|---|---|---|
| 立案 | `lawful:project`、`lawful:objective`、`lawful:module` | `Cone.md`、`objectives/`、模組單元表;經 `plan/<slug>` 合進主線 |
| 切片 | `lawful:spike-impl <M-n-slug>` | `build/M-n-<slug>` 上一條從進入點貫通到出口、跑得通的切片,與決策紀錄;途中要一個還沒有的模組單元,先 `lawful:module` |
| Law | `lawful:law-design <M-n-slug>` | 從切片 claim 出來的 pipeline:Stages 抄程式碼、laws 逐條拍板,`ready` |
| 建構 | `lawful:build`(law-design 收尾自動接上),委派 `lawful:qa` 與 `lawful:refactor` | 測試、讓每條 law 成立的實作,`verified` |
| 整合 | `lawful:integrate` | 整合分支、仲裁、ADR、PR |

既有 pipeline 的改動走 `lawful:revise`(文檔先行,一條 REV),改完同樣接上 build。`lawful:status` 講現況與下一步,`lawful:audit` 對帳,`lawful:study` 導讀。

模組單元只劃邊界,不決定裡面有什麼函數;單元裡的簽名由切片長出來、由 pipeline 的 Stages 表記下來,在既有單元裡加、改、搬東西不必回頭動模組表。

`rules/` 五份主題規章是每條規則唯一的住處;skill 只寫步驟並用檔名加節名引用,不重述。

| 檔 | 主題 |
|---|---|
| `pipelines.md` | `.lawful/` 樹、Cone.md、願景、需求、目標與兩條路線、pipeline 文檔的節、簽名怎麼寫、laws 的寫法、REV、GAP、完成度、ADR |
| `laws.md` | law 與需求的分別、全域 Law 三類與准入、全域 Law 的變更、Law 怎麼談、影響範圍與選項 |
| `boundary.md` | 四層、模組單元、模組表、效果的判定、對外 I/O、測試與邊界 |
| `roles.md` | 五個階段、分支與所有權、spike-impl / conductor / qa / refactor、委派、切片、首跑、驗收測試、收尾、仲裁、測試跑幾次、決策紀錄、整合、委派模型 |
| `tooling.md` | CLI 子命令與 exit code、status 報告版面、language adapter、跑東西的紀律、收尾定錨 |

## 名詞

| 名詞 | 在哪 |
|---|---|
| 願景、需求、`R-n`、驗收、`R-n#ACCEPT`、專案約束 | pipelines.md「Cone.md」「願景、需求、目標與路線」 |
| 目標、`O-n`、需求欄、優先 | pipelines.md「願景、需求、目標與路線」 |
| 建置路線、里程碑、`M-n-<slug>`、綁定、還沒有切片 | pipelines.md「願景、需求、目標與路線」 |
| 優化路線、調整、`RF-n`、動到、待修訂 | pipelines.md「願景、需求、目標與路線」「修訂(REV)」 |
| 需求達成 / 未達成 / 未知、完成度、調整達成 | pipelines.md「完成度」 |
| law、全域 Law、scope law、需求不是 law | laws.md「Law 與需求」 |
| 領域不變量、`INV-n`、`INV-n#LAW`、准入四條、`lint invariants`、`lint global` | laws.md「全域 Law」 |
| 要 / 不准 / 不在乎、讓它變假的實作 | laws.md「Law 怎麼談」 |
| 影響範圍、選項、「不改」 | laws.md「影響範圍與選項」 |
| 全域 Law 的變更、明確批准、重新驗證 | laws.md「全域 Law 的變更」 |
| pipeline、stage、`=` 列 / 純的整條、`!` 列 / 進入點、`o` 列 / 觀察點、IO 介面、子流、`kind` | pipelines.md「pipeline」「frontmatter 與 status」 |
| 全名、`P-00x#name`、`P-00x#LAW-n`、號段、`owner`、`lint ids` | pipelines.md「編號與引用」 |
| 簽名逐字、存取子、class 方法、有名字的型別 | pipelines.md「簽名怎麼寫」 |
| `draft` / `ready` / `verified`、重開 | pipelines.md「frontmatter 與 status」 |
| Brief、Stages、Laws、law 種類、Examples、決定 | pipelines.md「節」 |
| 什麼要有 law、自由度、內部支架、class 法則 | pipelines.md「什麼要有 law」 |
| REV、依 / 動到 / 保護 / 重委派 / 連動 | pipelines.md「修訂(REV)」 |
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
| `<L>`、子命令、exit code、`migrate laws`、`migrate cone` | tooling.md「CLI」 |
| adapter | tooling.md「language adapter」 |
| 三道關 | tooling.md「跑東西的紀律」 |
| 定錨區塊 | tooling.md「收尾定錨」 |

## 每個 skill 讀什麼

不必查表:每份 SKILL.md 的「開工 context」在載入 skill 的那一刻跑 `lawful brief <skill> [<目標>]`,它要讀的規章節與它在這個專案裡要看的東西(目標 pipeline、逐條狀態、簽名與型別的宣告、types 層、`Cone.md`、目標檔、決策紀錄、分支與工作樹、lint、status 報告,依 skill 而定)一次給齊。哪個 skill 讀哪幾節的表住在 CLI 裡,是唯一來源;`lawful brief <skill>` 印出來的「規章」那一塊就是它。

`<L>` 是 plugin 根目錄,也就是 skill 的基準目錄往上兩層(tooling.md「CLI」);單獨要一節時用 `node "<L>/bin/lawful.mjs" section <檔> <節>…`。
