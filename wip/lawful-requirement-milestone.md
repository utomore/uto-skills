# lawful：照 dev-flow 收束成同一套（需求 → 里程碑、global-laws / scope-laws / scope-revise、subflow）

2026-09-20。這份是 lawful 這一個 PR（分支 `feat/lawful-requirement-milestone`）的契約；模型與決定的全文在 `wip/requirement-milestone.md`，dev-flow 已經照它做完並合併（PR #79、#80），**lawful 的每一處都以 dev-flow 在 main 上的現況為樣板**，只把名詞換成 lawful 的。這份是紀錄，不是規章。

## 名詞對照
| dev-flow | lawful |
|---|---|
| `.design/`、`system.md` | `.lawful/`、`Cone.md` |
| feature `F-00x`、`features/` | pipeline `P-00x`、`pipelines/`（`kind: io` 或 `kind: subflow`） |
| 「語言與工具」節 | 「專案約束」節 |
| 架構：層（自訂的層表） | 架構：四層 `types ← effect ← core ← shell` |
| CLI `devflow`、`bin/devflow.mjs` | CLI `lawful`、`bin/lawful.mjs` |
| 注入行四道 `--of 4` | 注入行六道 `--of 6` |
| 沒有 | `modules.md` 的模組單元、`lawful:module` skill（不變） |

## 1. 需求面：Requirement → Milestone
- 一條需求一個檔 `.lawful/requirements/R-n-<slug>.md`（frontmatter `id`、`priority`、`updated`；`# R-n-<slug>:<一句話>`；`- 驗收:` 連同三行；里程碑表 `| 里程碑 | 做到什麼 | 綁定 |`；調整表 `| 調整 | 做到什麼 | 動到 |`），模板 `templates/requirement.md`（取代 `templates/objective.md`）。`Cone.md` 沒有「## 需求」節；`objectives/`、`O-n`、目標這一層不存在。
- 里程碑有順序、依序完成；全部達成 = 這條需求的建置走完；切分依據是使用者看得到、展示得出來或呼叫得到的階段；里程碑不管理約束；一條需求一次只開下一條里程碑，平行來自不同需求。里程碑只綁 pipeline；可以綁既有的 pipeline（靠修訂達成的里程碑）。
- 優先 1 到 4 掛在需求上；`Cone.md`「專案約束」那一行「優先：1 = …」照舊。調整 `RF-n` 掛在需求底下，只准動這條需求的里程碑綁過的 pipeline。
- 需求編號是流水號、只是身分；需求的先後從引用推（這條需求的里程碑綁的 pipeline 引用了別條需求綁的 pipeline，或綁了別條需求先綁過的 pipeline），status 的需求表有「依賴」欄，看板資料帶 `dependsOn`，建議路線把還在等別份的排後面。
- 需求達成：有 `R-n#ACCEPT` 測試以它為準；三行沒測試 = 未知；一句話 = 里程碑全部達成時推得；里程碑全部達成而驗收沒過 → 警訊。

## 2. 約束面與 skills（十四個）
`kickoff`（原 `project`）、`require-design`（原 `objective` 加上 project 裡談需求的部分；含衝突檢查）、`global-laws`（原 `revise` 的全域 Law 部分；含 kickoff 之後第一次定義三區）、`scope-laws`（原 `law-design` 加上既有 law 的調整、重複的 step 留一份、文檔退役；討論四項：資料交互、資料儲存在哪、外部串接方法、軟體架構）、`scope-revise`（新：verified → verified，既有的 law 不動、可以新增；非調整既有的 law 不可就還原、放棄，替開發者寫好可直接貼上的 `/lawful:scope-laws <全名> <原因>`）、`module`、`spike-impl`、`build`、`qa`、`refactor`、`integrate`、`status`、`audit`、`study`。`project`、`objective`、`law-design`、`revise` 四個名稱不存在。
分流的一句話：要調整（修改、放寬、替換、刪除）既有的 law → `scope-laws`；既有的 law 不動、或只新增 law，而文檔或實作要變 → `scope-revise`；全域 Law → `global-laws`；需求面的條目 → `require-design`。一件修訂從頭到尾只有一個修訂類的 skill 在跑。GAP 機制保留，結案照同一句分流。
一個 step 與它的 law 只住一份 pipeline；別份引用它。lawful 裡被引用的那一份通常是 `kind: subflow`，這件事 lawful 原本就是這樣，不變。

## 3. subflow
pipeline frontmatter 的 `kind` 值是 `io` 或 `subflow`（取代「IO 介面」「子流」）；規章、模板、夾具、CLI 的訊息一律講 subflow，不講子流。CLI 靜默照讀中文值（規章不提）；`migrate requirements --write` 順手把每份 pipeline 的 `kind` 改寫成新值並列在帳本上。

## 4. CLI（與 dev-flow 同形）
`requirement add <slug> <一句話> --priority <1-4> [--accept <句>]`、`requirement milestone <R-n> <slug> <一句話> [--bind …]`、`requirement refinement <R-n> <一句話> --touch …`；`objective …` 不存在。`migrate requirements [--write]`：「`Cone.md` 的『## 需求』節 + `objectives/`」→ `requirements/`（併法、人要判的、對不到需求的目標檔留著，全部照 dev-flow 的 `migrateRequirements`）；還沒換的樹 CLI 在記憶體裡用同一支函式併成同一個形狀照讀、status 警訊指到這道指令、寫檔的指令停下來叫人先 migrate。`migrate laws`、`migrate cone` 照舊（訊息裡的 skill 名換新）；三道 migrate 以任何先後接連跑都要行。
status：需求表（需求 | 優先 | 一句話 | 驗收 | 依賴 | 里程碑總數 | 里程碑達成 | 完成度 | 調整達成）與每條需求的下一條里程碑，沒有目標表；警訊、建議路線、`requirement refinement` 的下一步照分流那一句寫。`--json` / 看板資料已經是新形狀（`board.mjs` 現在是從目標串出來的過渡寫法，換成直接讀需求）。
brief:skill 名單換成 §2 的十四個；`objective` 區塊 → `requirement`、`objectives` → `requirements`；`scope-laws` 收里程碑全名或 pipeline 全名，`scope-revise` 只收 pipeline 全名，`global-laws` 不給或 `INV-n`，`require-design` 不給或 `R-n`。規章節：`pipelines.md` 的 `## 願景、需求、目標與路線` 改名 `## 願景、需求與里程碑`，**其餘 `##` 節名不動**；各 skill 點哪幾節照 dev-flow 的 `RULES` 對應到 lawful 的檔名與節名（`scope-revise` 要含「Law 怎麼談」「什麼要有 law」）。

## 5. 夾具
全部換成 `requirements/` 與 `kind: io | subflow`；`broken` 補需求面的新警訊（優先不合法、沒有里程碑、需求檔沒有 frontmatter、檔名與 frontmatter 對不上、里程碑編號重複）；`preflow` 同時是 `migrate laws` 與 `migrate requirements` 的輸入（保留 `objectives/`、「## 需求」節、中文的 `kind` 值；讓其中一條需求有兩個目標檔、一條沒有、一個目標檔對不到需求）；留一個夾具讓「依賴」欄印得出東西。夾具全部自造。

## 6. 其餘
`ci/lawful/`（contract.mjs、README、CODEOWNERS）裡的 `objectives/` 與舊 skill 名；`tests/lawful/run.mjs` 的案例表與四道檢查（加一道照 dev-flow 的「SKILL.md 的 frontmatter」：skills/ 的資料夾與 brief 名單一一對上、`name` 等於資料夾名、description 是 YAML 讀得成的單行、沒有「半形冒號加空白」）；`tests/ci/run.mjs`、`tests/board/run.mjs` 的 lawful 那一塊；`README.md` 的 lawful 一節與開頭段、`plugins/lawful/.claude-plugin/plugin.json` 與 `marketplace.json` 的 lawful 說明；`CLAUDE.md` 的 lawful 夾具描述與「舊 → 新只准出現在…」那一句（兩個 plugin 的立案 skill 都叫 `kickoff`）。

## 7. 規章與 skills 落筆時自己定的（契約沒寫到的）
2026-09-20，規章與十四份 SKILL.md 這一側。

- **「IO 介面」當名詞用的地方寫「io pipeline」**，當 `kind` 值的地方寫 `io`（`kind: io`、`--kind io`）；「子流」一律 subflow；「消費者」（引用某條 subflow 的 pipeline）寫成「引用它的 pipeline」。一般意義的 IO（IO 模組、`IO` monad、對外 I/O、不碰 IO）與 boundary.md 裡門面、production 的「消費者」不動。
- **`##` 節名只改一處**：`pipelines.md` 的 `## 願景、需求、目標與路線` → `## 願景、需求與里程碑`。沒有新增、沒有刪除；dev-flow 多出來的內容（修訂的分流表、刪 stage、文檔退役、四項、第一次定義三區、重複的 stage）全部寫進既有的節。
- **`Cone.md` 從四節變三節**（願景、全域 Law、專案約束）。
- **靠修訂達成的里程碑，例子是存檔格式換版**：需求「遊戲更新之後，玩家更新前存的檔還讀得回來」，里程碑靠修訂 `P-002-save-load` 達成，新增一條 law、原有的往返 law 不動；用哪一種編碼是 ADR 加全域 Law 的變更（對外 I/O 表存檔那一端的契約）。
- **四項的問法改寫成純函數式的版本**（laws.md「Law 怎麼談」）：types 層的型別與 smart constructor、效果描述與純解譯器的替身、效果 ADT 與 shell 的真解譯器、模組單元的哪一層與 `=` 列是不是純的、要不要拆成 subflow。
- **需求的依賴有兩種來源**都寫進規章：引用了別條需求綁的 pipeline，或綁了別條需求先綁過的 pipeline。
- **`scope-revise` 多收一種**：`=` 列搬到別的模組單元而要換 slug(`lawful rename`)；層變了檔搬到那一層的樹、單元沒宣告那一層就 `lawful module <單元> --layers`，由做修訂的 skill 直接下，不轉給 `lawful:module`。
- **文檔退役時模組表不動**：單元因此沒有程式碼只是 `lint boundary` 的訊息。lawful 沒有 Features 表，退役只從綁定欄與對外 I/O 表拿掉。
- **立案時已經看得出來的模組單元由 `kickoff` 劃**（層欄當場填，因為四層是固定的）；之後多劃一個走 `lawful:module`。「優先各級」那一行照 dev-flow 留給 `require-design` 的第一步。
- **status 報告維持七段、四張表**（需求、全域 Law、pipelines、模組）：lawful 的報告沒有 dev-flow 的「修訂熱點」段，沒有加。
- **`tooling.md` 的三道 migrate 只用條件描述輸入的樹**，不提目標與 `objectives/`；「## 需求」節只出現在 `kickoff` 前置那一句。`migrate laws` 那一列留著「需求的『- 蘊含：』刪掉」，與 dev-flow 那一列同形。
- **`migrate from-dev-flow` 那一列**的「目標與里程碑候選」改寫成「需求與里程碑候選」；CLI 的輸出要跟上。
- **`audit` 的里程碑順序判準**：後面的里程碑綁的 pipeline 被前面的引用了，順序是反的。由「里程碑依序完成」與「被引用的那一條達成，引用它的才算達成」推得，規章沒有另立一條。
- **效能基準線的例子用存檔大小**(1 MB / 3 MB)，不用 p95。

### 規章與 CLI 還對不上的地方（CLI 那一側要定）
- `tooling.md` 的 `brief` 那一列照 dev-flow 的分組寫；`brief.mjs` 目前：`build` 的 pipeline 目標不給需求檔、`audit` 不給需求檔、`global-laws` 不給 `modules.md`、`scope-laws` 的 pipeline 目標不給 `modules.md`、里程碑目標不給 `gaps.md`。skill 的「開工 context」段照 `brief.mjs` 的實況寫，兩邊以哪一邊為準還沒定。
- `KIND_WORD` 對 `global-laws` 與 `require-design` 都講「R-n 或 INV-n」，規章寫的是各收一種。
- `status.mjs` 沒有「全域 Law 三個小區還是模板」的警訊（dev-flow 有）；`require-design` 收尾要不要接 `global-laws` 靠讀 `Cone.md` 判。
- `lawful rename` 之後 pipeline 的全名換了，修訂的分支 `build/<原全名>` 與決策紀錄的鍵還是原全名；status 與 brief 怎麼對鍵，規章沒有講。
