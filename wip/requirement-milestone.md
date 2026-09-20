# 需求兩層、約束兩種:Requirement → Milestone,Global Law + Scope Law

2026-09-20 與使用者拍板。這份是 dev-flow 與 lawful 兩個 plugin 這一輪改動的契約;規章、skills、CLI、模板、夾具、CI 範本、README 全部以它為準。這份是紀錄,不是規章。

## 1. 模型

兩棵樹,各管各的:

| | 需求面(必須達成) | 約束面(不得違反) |
|---|---|---|
| 層 | 願景 → Requirement `R-n` → Milestone `M-n-<slug>` | Global Law → Scope Law |
| 判準 | 有做完的一天 | 沒有做完的一天,永遠要守 |
| 誰談 | `require-design` | Global Law:`glaws-revise`;Scope Law:`law-design` |
| 怎麼驗 | 需求的驗收(`R-n#ACCEPT` 測試);沒有測試時由里程碑全部達成推得 | 每條 law 一條會失敗而現在通過的測試;架構與契約另有 lint |

- **約束只有兩種**。Global Law 三類(領域不變量 `INV-n`、架構的層、契約的對外 I/O),住 `system.md` / `Cone.md` 的「## 全域 Law」區,整個專案每一行程式碼都要守,從 spike-impl 的第一行起。Scope Law 住一份文檔的 Laws 節(dev-flow:feature、abstract;lawful:pipeline,`kind` 是 IO 介面或 subflow),由 `law-design` 對著 spike-impl 做出來的切片與開發者談出來,`build` 帶 `qa` 與 `refactor` 讓它成立。任何程式碼都受 Global Law 加上它自己那份文檔的 Scope Law 約束。
- **需求面只有兩層**。目標(Objective、`O-n`、`objectives/`)這一層不存在。一條需求一個檔;里程碑是需求檔裡的一張表,**有順序,依序完成;全部達成,這條需求的建置就走完**。里程碑**不管理約束**:它沒有 law、沒有測試標記,達成的定義是它綁定的文檔全部 `verified`。
- **里程碑怎麼切**:每一條都是一個明確的階段性使用者驗收——使用者看得到這個階段的成果,可以展示、或呼叫這個階段的功能。里程碑那一句話就是展示得出來的那一句;展示的方法是切片決策紀錄的 Entry(一道指令,跑起來看得到)。一條里程碑仍然是一條垂直切片的範圍。
- **平行**:一條需求一次只開它下一條還沒達成的里程碑。要同時開工的線屬於不同需求;一條需求裡需要兩條平行的線,就拆成兩條需求。
- **優先**(1 到 4)掛在需求上;`system.md` / `Cone.md`「語言與工具 / 專案約束」那一行「優先:1 = …」照舊宣告各級的意思。
- **調整 `RF-n`** 掛在需求底下(需求檔的第二張表)。只有這條需求的里程碑全部達成之後才開;只准動這條需求的里程碑綁定過的文檔;每條調整之後需求仍要達成。
- law-design 不必指出一條 Scope Law 滿足哪條需求。文檔經由里程碑的綁定欄朝向需求,law 不朝向需求。
- 需求達成:有 `R-n#ACCEPT` 測試以測試為準;沒有測試而寫了三行 = 未知(警訊);只有一句話 = 里程碑全部達成時「推得」。里程碑全部達成而驗收測試沒過 → 警訊「里程碑切漏了,或驗收寫錯」,回 `require-design`。

## 2. 文檔

### dev-flow `.design/`

```
system.md        願景、## 全域 Law(三區)、## 語言與工具、## Features
requirements/    R-n-<slug>.md,一條需求一個檔
modules.md  features/  abstracts/  adr/  gaps.md  journal/
```

`system.md` 沒有「## 需求」節。`objectives/` 不存在。

### lawful `.lawful/`

```
Cone.md          願景、## 全域 Law(三區)、## 專案約束
requirements/    R-n-<slug>.md
modules.md  pipelines/  adr/  gaps.md  journal/
```

### 需求檔 `requirements/R-n-<slug>.md`

```markdown
---
id: R-n
priority: <1 到 4,1 最高>
updated: <YYYY-MM-DD>
---
# R-n-<slug>:<一句話:誰在什麼情況下要得到什麼>

- 驗收:<一句可判定的話:這條需求達成時,什麼一定為真>
  - forall <變數 in 定義域>
  - |- <結論>

| 里程碑 | 做到什麼 | 綁定 |
|---|---|---|
| M-1-<slug> | <一句話:使用者在這個階段看得到、展示得出來或呼叫得到什麼> | F-00x-<slug> 或 -(還沒有切片) |

| 調整 | 做到什麼 | 動到 |
|---|---|---|
| RF-1 | <一句話:改既有文檔的哪一種品質> | F-00x-<slug> |
```

- `R-n` 全資料夾唯一,slug 是 kebab-case 英文、講這條需求要得到什麼。`M-n`、`RF-n` 也是全資料夾唯一(跨需求檔),刪掉的號永久空缺。
- 里程碑表的列序就是先後。
- lawful 的綁定 / 動到欄寫 pipeline 全名(`P-00x-<slug>`)。
- 驗收的三行、測試歸屬 `R-n#ACCEPT` 照舊。

## 3. skills

兩個 plugin 同名:

| skill | 取代 | 做什麼 |
|---|---|---|
| `kickoff` | `project` | 專案的第一個命令。開樹:複製模板、願景、語言與工具(lawful:專案約束)、模組表的骨架。**不談需求、不談全域 Law**。既有的樹不合規時叫人跑 migrate(舊 → 新只准出現在這裡與 migrate 本身)。收尾自動接 `require-design` 談第一批需求;需求定完之後接 `glaws-revise` 定全域 Law 三區;兩者都走完才推薦 `spike-impl`。 |
| `require-design` | `objective` 與 `project` 裡談需求的部分 | 與開發者談需求,一次一條:一句話、驗收、優先、**當場切成里程碑**。之後加需求、改驗收、重排優先與里程碑、加調整 `RF-n`、把沒有被綁定的文檔收進某條里程碑,都走這裡。需求只准透過它寫。 |
| `global-laws` | `revise` 裡全域 Law 的部分(第一輪叫 `glaws-revise`;2026-09-20 第二次調整時只改名,先叫 `global-laws-revise`,同一天再定成 `global-laws`) | 全域 Law 的新增、修改、放寬、替換、刪除,一律在這裡;kickoff 之後第一次定義三區也在這裡。先攤影響範圍、給選項(含「不改」),開發者對著一個選項明確說要才落筆;`integrate` 只能提出變更建議。落筆後重新驗證受影響的工作。 |
| `scope-laws` | 原 `law-design` 加上 `revise` 裡調整既有 Scope Law 的部分(第一輪叫 `law-design`;第二次調整先叫 `scope-laws-revise`,同一天再定成 `scope-laws`) | 兩種情形:(a) 主場景,切片剛做完:**根據切片的決策紀錄**與開發者討論,claim 文檔、Steps 抄程式碼、把約束談出來,ready 後自動接 build。**注重第一次約束的討論**,四項逐項問到:資料交互、資料儲存在哪、外部串接方法、軟體架構;結論屬於這份文檔的寫成 Scope Law 或記進「決定」,碰到全域的(還沒講定的對外 I/O、層要變、整個專案的規則)不在這裡寫,列成給 `global-laws` 的變更提議,由開發者決定要不要走。(b) 既有文檔(含 `verified`)任何一條**既有的 law 要調整**(修改、放寬、替換、刪除):攤影響範圍與選項、開發者對著一個選項明確說要、`verified` 先重開、先補保護、改條文、寫 REV、連動、結案 GAP、宣告跟著;這一件修訂連帶要改的簽名、型別、模組、Examples、新增的 law、實作方向**一手包辦**,同一條 REV,直接接 build 做回 `verified`。參數裡全名後面的那一段話就是來源與原因(`scope-revise` 放棄時寫好的那一行),照它開工。 |
| `scope-revise` | 新 skill;`revise` 裡不調整既有 law 的部分 | 修訂既有 `verified` 的技術文檔而**不調整任何既有的 law**:Steps 的簽名或型別要改、加 step、模組跨層搬家、層的歸屬修正、Brief / 決定 / 描述要改、實作品質的調整(`RF-n`:效能、大小、訊息、演算法)、bug、答案不必調整既有 law 的 GAP。**核心是 verified → verified**。**可以新增 Scope Law**(保護用的、效能的新上界、新 step 的),在這裡與開發者談定、自己寫進 Laws 節;**不得修改、放寬、替換、刪除任何既有的 law**,既有 example 的輸入輸出也不動。流程:判既有的 law 動不動 → 攤影響範圍六項(「直接動到」不得列任何既有的 law)→ 開發者確認 → 重開成 `ready` → 談新增的 law → 改條文(改名造成 law 三行的識別字跟著換是機械同步,REV 註明)→ 寫 REV(「動到」只准簽名、型別、模組、層、實作與新增的 LAW-n;「保護」= 原有的每一條 law 與 example)→ 連動 → 宣告跟著 → 自動接 build,收尾時每條 law 綠、文檔回到 `verified`。攤影響範圍時或做到一半發現**非調整既有的 law 不可** → **停下並放棄這一次修訂**:還原這一場改過的文檔與宣告,不留半套;用一兩句話講還原了什麼、為什麼放棄,再單獨一個程式碼區塊替開發者寫好一行 `/dev-flow:scope-laws <全名> <原因>`(原因寫完整、單行:原本要做什麼、哪一條 law 為什麼非調整不可與往哪個方向改、連帶要改的簽名、型別、模組),然後結束。目標文檔不是 `verified` → 回 `scope-laws` 或 build。 |
| `spike-impl` `build` `qa` `refactor` `integrate` `status` `audit` `study`,dev-flow 的 `abstract`,lawful 的 `module` | 不變 | 內文裡的「目標」「objective」「project」「revise」換成新的概念與 skill 名。 |

2026-09-20 使用者第二次調整(只動 dev-flow 的三個修訂類 skill;lawful 還是第一輪的名稱):`glaws-revise` 改名 `global-laws`,`law-design` 改名 `scope-laws` 並把「不調整既有 law 的修訂」分出去成新 skill `scope-revise`。分流的一句話:**要調整(修改、放寬、替換、刪除)既有的 law → `scope-laws`;law 不動、或只新增 law,而文檔或實作要變 → `scope-revise`;全域 Law → `global-laws`;需求面的條目 → `require-design`。** GAP 的結案與 `RF-n` 的落地照同一句(`RF-n` 預設走 `scope-revise`,需要新 law 就在那裡新增;要調整既有的 law 才做得到的調整,整件走 `scope-laws`)。原則:**一件修訂從頭到尾只有一個 revise 類的 skill 在跑,跑到 verified 為止**,不交錯。GAP 這個機制保留,定義不變。這一輪裡使用者的決定依序是:三個 skill 的分工與 `-revise` 結尾的名稱 → `scope-revise` 可以新增 law、非調整既有的 law 不可就放棄並整件轉交(不交錯)→ 放棄時替開發者寫好一行 `/dev-flow:scope-laws <全名> <原因>` → 名稱定成 `global-laws`、`scope-laws`(與 `scope-revise` 明顯分開);`global-laws-revise`、`scope-laws-revise` 兩個名稱不存在。

`revise`、`objective`、`project` 三個 skill 名稱不存在;dev-flow 裡 `law-design`、`glaws-revise` 兩個名稱也不存在。

2026-09-20 使用者第三次決定(只動 dev-flow,分支 `feat/dev-flow-scope-revise`,同一個 PR;上面 §1、§2、§3 表裡提到 abstract 的地方以這一段為準):

1. **abstract 整個退場**。`dev-flow:abstract` skill、`A-00x` 共用文檔、`abstracts/` 資料夾、「收整」這個動作都拿掉,dev-flow 的 skill 從十四個變十三個。取代它的只有一條規矩,住 `features.md`「編號與引用」:一個 step 與它的 law 只住在一份文檔——先做出它的那一份;別的文檔要用它,就在 Steps 表的模組欄註明「見 <那份文檔的全名>」,law 不重寫、不複製;feature 可以引用另一份 feature,不論屬於哪條需求。理由:實作先行,後做的切片直接呼叫既有的程式碼,不會有第二份要抽。兩條切片平行開工各寫了一份 → 整合時選一份留著,另一份走 `scope-laws` 刪掉自己的 step 與 law 改成引用。被引用的那一份達成,引用它的才算達成(原有的規則)。里程碑只綁 feature。CLI 對 `abstracts/` 底下的檔靜默照讀,規章不提。`features.md` 的節名 `## feature 與 abstract` 改成 `## feature`,`## 收整(abstract)` 整節刪掉;brief 的節名表跟著改。
2. **需求的先後從引用推**。`R-n` 是流水號、永不重排、只是身分;「哪條需求疊在哪條上面」不寫在任何欄位,由文檔的引用推(這條需求的里程碑綁的文檔引用了別條需求的里程碑綁的文檔,它就依賴那一條)。`devflow status` 的需求表多一欄「依賴」,`--json` 的 `requirements[].dependsOn`,看板的相依頁籤畫出來。互不依賴的需求可以同時開工。
3. **`require-design` 多一步「衝突檢查」**,放在談出一句話、驗收與優先之後、寫檔之前:新需求的驗收逐條對既有每一條需求的驗收,問有沒有無法同時達成的。有 → 攤影響範圍(哪條既有需求要改、它的 `R-n#ACCEPT` 測試作廢要 `build R-n` 重派 qa、哪幾份 feature 的 law 要走 `scope-laws`、哪幾條里程碑那一句要改)、給三個選項(改既有的 / 改新的 / 不收新的),開發者對著一個選項明確說要才落筆;沒有衝突也在回報寫一句「與 R-x…R-y 逐條對過,無衝突」。
4. **補三條規矩,不加機制**:
   - 刪 step:刪一個有 law 的 step 等於刪既有的 law,整件走 `scope-laws`。
   - 文檔退役:一份 feature 不再需要 → `scope-laws <全名>`;影響範圍照列、開發者確認後刪文檔與它的測試、程式碼,從綁定欄與 Features 表拿掉,編號永久空缺;別份還引用它的 step 時,先把那幾個 step 連同 law 搬到還活著、用得最多的那一份再刪;為什麼退役由整合寫成 ADR。
   - 里程碑可以綁既有的 feature:這個階段靠修訂既有的 feature 做到時,綁定欄填那份既有的 feature,一份 feature 可以被不只一條里程碑綁定;在 `build/M-n-<slug>` 上走 `scope-revise`(既有的 law 不動,新的承諾用新增的 law 表達)或 `scope-laws`(要調整既有的 law)。例子是「整個專案的資料儲存換成資料庫」:需求寫誰得到什麼(重啟後資料不遺失),用哪個資料庫是決定(ADR)加上全域 Law 的變更(`global-laws`),不是需求本身。

這一輪落筆時規章側自己定的(使用者沒講到的):靠修訂達成的里程碑,綁定欄在修訂重開那份文檔的同一個動作才填,之前留「-」——先填的話那份 `verified` 的 feature 會讓里程碑當場被算成達成;`system.md` Features 表的「類別」欄留著、值只有 `feature`,因為 `devflow claim` 寫進去的列是兩格;文檔退役那一波的決策紀錄由 `scope-laws` 寫,整合靠它升 ADR;退役時對外 I/O 表上它那幾列跟著拿掉。

每份 SKILL.md 照現行的固定長相:frontmatter(`name`、四段式 `description`、`user-invocable`、`allowed-tools`)、核心句、注入行(dev-flow 四道、lawful 六道,`brief <skill名>`)、目標說明、前置、步驟、收尾、邊界。

## 4. CLI(兩邊同形,dev-flow `devflow`、lawful `lawful`)

| 指令 | 說明 |
|---|---|
| `requirement add <slug> <一句話> --priority <1-4> [--accept <句>]` | 配 `R-n`,從模板建 `requirements/R-n-<slug>.md` |
| `requirement milestone <R-n> <slug> <一句話> [--bind <全名,…>]` | 配 `M-n`(跨需求檔、跨工作樹),接在里程碑表最後 |
| `requirement refinement <R-n> <一句話> --touch <全名,…>` | 配 `RF-n` |
| `claim … --milestone <M-n 或全名>` | 照舊,綁定寫進那條里程碑所在的需求檔 |
| `invariant add` | 照舊 |
| `migrate requirements [--write]` | 把「`system.md`/`Cone.md` 的『## 需求』節 + `objectives/`(或一份 `objectives.md`)」換成 `requirements/`;見 §6 |
| `brief <skill>` | skill 名單換成 §3;`objective` 區塊改成 `requirement`(目標文檔朝向的那條里程碑與它的需求檔全文),`objectives` 區塊改成 `requirements`(每個需求檔) |
| `objective …` | 不存在 |

status 報告:需求表(需求 | 優先 | 里程碑 已達成/全部 | 達成 | 下一條里程碑與它走到哪一步)、每條需求底下的里程碑與調整、全域 Law 表、文檔表、警訊、建議路線(從最高優先的需求第一條沒達成的里程碑推)。沒有目標表。`--json` 與看板資料:`requirements[]` 各帶 `milestones[]`、`refinements[]`;沒有 `objectives`。

警訊(需求面):優先那一行沒宣告、需求沒有優先或不合法、需求沒有里程碑、驗收還是模板、寫了三行沒測試、里程碑沒有英文名、綁定的文檔不存在、文檔沒有被任何里程碑綁定、調整動到這條需求的里程碑沒綁過的文檔、里程碑全部達成而驗收沒過、樹還是「## 需求」節加 `objectives/` 的長相(指到 `migrate requirements`)。

靜默容忍(規章不提):沒有 `requirements/` 而 `system.md` / `Cone.md` 有「## 需求」節時,CLI 在記憶體裡把需求與它的目標併成同一個形狀照讀(與 migrate 同一支函式),status 多一條警訊指到 `migrate requirements`。

## 5. 看板

`templates/status-board.html` 兩邊逐位元組相同。資料換成需求 → 里程碑兩層;頁面原本「目標」那一層的欄位拿掉或由需求取代。改了就跑 `bash tests/board/run.sh`。

## 6. migrate requirements

輸入:「## 需求」節的每條 `R-n`(一句話、驗收)加上朝向它的每個目標檔(優先、里程碑表、調整表)。輸出:

- 每條需求一個 `requirements/R-n-<slug>.md`:slug 取它第一個目標的 slug;優先取它的目標裡最高的;里程碑表 = 各目標的里程碑依(優先、目標號)串接;調整表同理。
- `system.md` / `Cone.md` 的「## 需求」節整節刪掉;`objectives/` 刪掉。
- **人要判的**(帳本列出,不自動決定):一條需求有兩個以上目標(串接的順序對不對,或者該拆成兩條需求);一條需求沒有目標(檔名暫用 `R-n-unnamed`,沒有里程碑);目標對不到需求(里程碑無處可去,列出原檔內容)。
- 輸入是一份 `objectives.md` 的樹:同一道指令先在記憶體裡拆,再照上面寫。`migrate objectives` 不存在。
- `migrate laws` 照舊;兩道可以接連跑(先 `laws` 再 `requirements`,或反過來,都要行)。

## 7. 夾具

- dev-flow:`shop` 等全綠夾具換成 `requirements/`;`shaky` 的「目標對不到需求」那條警訊退場,換成需求面的新警訊各出現一次(需求沒有優先、需求沒有里程碑);`flat`(一份 `objectives.md`、沒有全域 Law 區)留給 `migrate requirements` 與 `migrate laws` 當輸入;新增一個夾具 `goals`(「## 需求」節加 `objectives/`,其中一條需求有兩個目標、一條沒有目標)給 `migrate requirements` 當輸入,也驗靜默容忍的讀法。
- lawful:同理;`preflow` 是 `migrate laws` 與 `migrate requirements` 的共同輸入。
- 夾具全部自造,不取自任何真實專案。

## 8. 順序

1. dev-flow:分支 `feat/dev-flow-requirement-milestone`,一個 PR。
2. lawful:dev-flow 合併後從 main 開 `feat/lawful-requirement-milestone`,一個 PR;同一個 PR 把 lawful 的「子流」改叫 subflow。
3. 每個 PR:三道回歸(加看板那一道,如果動了頁面)、規章自查 0 條、控制字元掃描、說明的觸發對照。
