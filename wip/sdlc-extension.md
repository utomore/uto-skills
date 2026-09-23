# dev-flow 延伸成 SDLC：發布與事故

2026-09-22，分支 `feat/sdlc-release-incident`。設計稿，是紀錄不是規章。

## 起點

dev-flow 蓋掉的是 SDLC 的前半條，而且每一段都有機器判得出來的證據：

| SDLC 階段 | dev-flow | 證據 |
|---|---|---|
| 需求 | `require-design` | 一句可判定的驗收、`R-n#ACCEPT` |
| 設計 | `spike-impl` → `scope-laws` → `global-laws` | 決策紀錄、`lint sig` / `lint laws` |
| 實作與測試 | `build`（qa / refactor 互不可見） | 首跑該紅、測試歸屬 |
| 架構治理 | 全域 Law 三類 | `lint global` |
| 審查與合併 | `integrate` + `ci/dev-flow/contract.mjs` + CODEOWNERS | CI 紅就合不進主線 |
| 驗收 | `requirement accept` | 人簽的是當時那份證據 |
| **發布** | 沒有 | — |
| **維運** | 沒有 | — |
| **事故回流** | 分流表答得出該走哪個 skill，但沒有入口 | — |
| **角色** | 只有「開發者」 | 號段的 `owner`、CODEOWNERS |

合進主線之後就沒有了：「R-3 已驗收」答不出使用者拿到了沒；線上壞了要靠人記得走哪個 skill。

## 判準

每個新階段先答兩題才做：

1. **需求來源**：現在就答不出來的具體問題是什麼。「可能會發生」不算 (memory:no-mechanism-for-hypotheticals)。
2. **證據是什麼、誰判**：沒有機器判得出來的證據，加進去只是一份流水帳文檔。

| 候選 | 需求來源 | 證據 | 決定 |
|---|---|---|---|
| 發布 | 已驗收不等於使用者拿到了，現在答不出 | git tag，已經存在的事實 | 做 |
| 事故入口 | 線上壞了靠人記得分流 | 一條首跑該紅的測試，本來就是這套流程的單位 | 做 |
| 維運觀測（對外 I/O 表加「觀測」欄） | 找不到 | 要接外部系統 | 不做；而且它動全域 Law 表的欄位，既有的樹都要 migrate，是四條裡唯一不好回頭的 |
| 角色表 | 等第二個人真的用這套 | — | 不做 |

## 做了什麼

### 1. `devflow release`(`lib/commands/release.mjs`)

- **發布 = 一個 git tag**。`system.md`「Constraint」可以有一行 `- 發布:`v*``（`git tag --list` 的樣式）；沒寫、「無」、佔位符 = 每個 tag 都算。`design.mjs` 讀成 `system.releaseTags`。
- **上線**：需求的里程碑綁的每份文檔、與它們一路引用下去的每一份，自己住的 step 所在的檔（引用別份的 step 不算這一份的）在主線上最新的 commit，都進了同一個發布的 tag；最早的那一個是它上線的版本。
  - 主線 = `mainRef`(origin/HEAD → origin/main → main …)，解不到用 HEAD。
  - 「最新的 commit」：`git log -1 <主線> -- <那幾個檔>`。tag 之後又改了那幾個檔 → 未上線。上線講的是**現在這一版**，不是「曾經上過線」。
  - 每份各自進過 tag、卻沒有一個 tag 同時帶齊（tag 打在不同分支上）→ 未上線，每一份都列。
- 只問**證據齊了**的需求（已驗收、待審核、待重審）。建構中的需求程式碼還在長，它進了哪個 tag 講不出「使用者拿到了這件事」。
- 報告三段：每條需求一列、已驗收而還沒上線、每個發布帶上線的需求（新的在前，可以直接當發布說明）。
- 唯讀；不是 git repo 的根 exit 1。需求的審核狀態要看驗收測試，所以吃同一套 `--tests` / `--run`。
- 沒有新的文檔單位、沒有新欄位：符合「進度不是欄位」。

### 2. `status` 的「上線」欄與「等決定」

- 需求表在「審核」後面多一欄「上線」：tag / 未上線 / `-`。不是 git repo 的根（夾具、匯出的樹）一律 `-`，報告不受環境影響，與 `branchState` 同一個做法。
- 第 3 段「等決定」多一種：已驗收而還沒上線。發不發布是人的決定，工具不打 tag。
- `status --json` 每條需求多 `release: { tag, word, pending[] } | null`。看板頁面沒動（兩個 plugin 共用同一份，要動得兩邊一起改、跑 `tests/board`）。
- 建議路線與 exit code 不變：沒上線不算功能不正常。

### 3. `dev-flow:incident`（`skills/incident/SKILL.md`、`roles.md`「事故」）

它**不寫測試、不改程式碼、不改 `.design/`**，只做三件事：

1. **重現**：現象 → 一組輸入、實際的輸出、預期的輸出（預期照開發者或使用者的話，不自己推）。在**使用者手上的那一版**重現：`devflow release` 讀那條需求上線在哪個 tag，`git worktree add --detach` 開在那個 tag 跑；再在主線上跑一次——主線上已經好了就回報「等下一次發布」與修好它的 commit，不交棒。重現不出來就停，不猜。
2. **歸因**：對外 I/O 表 → 哪一端、哪份 feature 的 `!` 列 → 沿 Steps（`o` 列是觀察點）找第一次變錯的 step → 對它的 law。
3. **交棒**：照分流表一行指令，依欄寫事故原句、重現的那一組、對到的 law。

| 歸因 | 交給 |
|---|---|
| law 對，這個輸入讓它不成立（產生器沒涵蓋到） | `scope-revise`：新增 example，首跑該紅 |
| 沒有 law 講這件事 | `scope-revise`：它的 Law 對談問要 / 不准 / 不在乎 |
| 使用者要的與既有的 law 相反 | `scope-laws` |
| 全域 Law 本身講錯 | `global-laws`（程式碼踩了它就照前三列歸到那份 feature） |
| 驗收那一句講錯 | `require-design` |
| 不在程式碼裡 | 不交棒 |

**「會紅的測試」怎麼出現、為什麼不違反「commit 一定全綠」**：紅的測試只活在 `build/<全名>` 分支上。接手的 skill 把重現的那一組寫進文檔（example 或新 law），`build` 的 qa 從文檔寫出測試，conductor 的首跑在現有的程式碼上看它紅——紅了才證明這條測試抓得到這次事故（否則它是一條假測試，refactor 之後的綠也不代表修好）。refactor 調綠，整套綠才 `integrate`。主線永遠是綠的。這就是既有的「首跑該紅」，事故只是它的另一個來源。

決定權沒有新增地方：law 要不要承諾、要不要調整，在接手的 skill 裡由開發者決定（`roles.md`「收尾」的五個地方不變）。歸因只是攤給開發者看，他說歸錯了就重歸。

沒有 GAP、沒有事故文檔：事故到交棒為止，之後的紀錄在 REV 的依欄。考慮過寫一條 GAP 讓 `status` 在修好之前一直紅，沒做——交棒是當場自動接上的，中間沒有空窗；GAP 的定義是「文檔讀不出唯一答案」，事故不是。

## 動到的檔

- 程式碼：`lib/commands/release.mjs`（新）、`status.mjs`（`gitLines` / `mainRef` 匯出、`statusReport` 多一個 `root` 參數）、`board.mjs`（`statusJson` 多 `root`）、`design.mjs`（發布行）、`brief.mjs`（`incident` 的 RULES 與 BLOCKS；`status` 多讀「發布」）、`bin/devflow.mjs`。
- 規章：`roles.md`「事故」（新節）、`tooling.md`「發布」（新節）與 CLI、status 報告、exit code；`features.md`「system.md」的工具行；`rules/README.md` 的節表與名詞表；`templates/system.md` 的發布行。
- skill:`incident`（新）；`kickoff`（問發布行）、`scope-revise` 與 `scope-laws`（來源多一種：事故）、`status`（講上線欄）。
- 其他：`README.md`、`plugin.json` 與 `marketplace.json` 的 description、`CLAUDE.md` 的測試描述。
- 測試：`shop-release-no-git`、`shop-brief-incident` 兩個 golden；`--help` 查 `release`；一個真的開 repo 的「上線」檢查（沒 tag → 未上線、`rc-1` 不符合 `v*` 不算、`v1.0.0` → 上線、tag 之後改 `src/app/refund.ts` → 只有 F-002-refund 列回未上線）；32 份 status / brief golden 因為需求表多一欄、JSON 多 `release: null`、skill 名單多 `incident` 而重產（diff 只有這三種）。

## 沒做的

- **lawful**：流程同構，同一套可以照搬（`lawful release`、`incident`、`Cone.md` 的發布行）。這次只做 dev-flow。
- **看板**：`status --json` 已經帶 `release`，頁面還沒畫。
- **CI**：`contract.mjs` 沒動。可以考慮在打 tag 的 pipeline 跑 `devflow release`，把「每個發布帶上線的需求」貼成 release notes——要不要做等有人真的在發布。
- **維運觀測、角色表**：見判準表，沒有需求來源。

## 待定

- `status` 的「上線」欄在不是 git repo 的根時印 `-`，讓夾具的 golden 不受環境影響。要不要只在 git repo 裡才出現這一欄（版面就不固定了）——目前選版面固定。
- 上線用「最早的那個 tag」。hotfix 分支上打的 tag 若不在主線上，`git tag --contains` 看不到主線的 commit，會算成未上線；照實，沒有特別處理。
