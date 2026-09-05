# pipeline 文檔

文檔只寫程式碼裝不下的東西:測試存在之前的 laws、為什麼這樣決定、跨過純 / IO 邊界的資料流。型別、簽名、模組匯出住程式碼;文檔引用,工具對帳。

## `.design/`

```
.design/
├── system.md          目的、語言與工具、邊界、對外 I/O、pipeline 清單(順序 = 里程碑)
├── modules.md         模組表(boundary.md「模組表」)
├── pipelines/P-00x-<slug>.md
├── gaps.md            只裝 open 的 GAP;空了刪檔
├── adr/ADR-00x-<slug>.md
└── spikes/SPK-00x-<slug>.md   程式碼在專案根目錄 spike/SPK-00x-<slug>/,結案即刪
```

## system.md

frontmatter:`language`(選 adapter)、`updated`。五節:

| 節 | 裝什麼 |
|---|---|
| `## 目的` | 三到五句:替誰做什麼、不做什麼 |
| `## 語言與工具` | 三道指令:建置、整套測試、**子集測試**;IO 模組追加清單;忽略目錄(不掃的原始碼目錄,例如搬遷中的舊樹) |
| `## 邊界` | 四層各一句(boundary.md「四層」) |
| `## 對外 I/O` | 表:名稱、方向(in / out)、型別或效果 ADT、shell 模組、進入哪條 pipeline |
| `## Pipelines` | 表:全名、類別(里程碑 / 子流)。里程碑列的順序就是里程碑順序;`lawful status` 的分母 |

description 住各 pipeline 的 frontmatter,清單不重複。

## pipeline

一段 **input → 純轉換 → output** 的資料流,由 **stage** 組成;每個 stage 是一條住在程式碼裡的簽名。

- 可以橫跨任意模組。模組是 stage 的屬性,不是文檔的歸屬。
- 兩端碰到 shell 的是**里程碑**;只在純核心裡的是**子流**。底層能力(查詢、碰撞偵測)也是子流。
- 值得端到端規格的才建檔。單一小函數的 laws 直接寫 property test;它以 stage 的身分出現在用到它的 pipeline 裡。
- stage 順序是資料流的拓撲序。`=` 列(整條的簽名)是權威。
- 依賴不手寫:A 的 Stages 表引用 B 的簽名,A 就依賴 B。

## 編號與引用

| 東西 | 編號 | 引用寫法 |
|---|---|---|
| pipeline | `P-001`,檔 `pipelines/P-001-<slug>.md` | 全名 `P-001-<slug>` |
| stage | 函數名 | `P-002#candidates` |
| law / example / 修訂 | `LAW-1` / `EX-1` / `REV-1` | `P-002#LAW-1` |
| 提問 | `GAP-1`(`gaps.md` 內遞增) | `GAP-1` |
| ADR / spike | `ADR-001` / `SPK-001` | 全名 |

- 配號只走 `lawful claim`;刪掉的號永久空缺。
- pipeline、ADR、spike 一律寫全名。
- slug 是 kebab-case 英文,講資料流做什麼,不講屬於誰。

## frontmatter 與 status

`id`、`description`、`status`、`updated`。`status` 只放人才知道的決定:

| status | 意思 |
|---|---|
| `draft` | 還在討論;`lawful:build` 拒收 |
| `ready` | 開發者口頭拍板,`lawful:pipeline` 改欄位;可以委派 |
| `frozen` | `lawful status` 顯示里程碑達成,conductor 在 build 收尾直接改,不問;不准修訂。解凍 = `lawful:revise` 在「決定」記一條為什麼,改回 `ready` |

開發者不親自改任何 `.design/` 檔;開發者說,skill 寫。`frozen` 而測試紅、或有 REV 卻沒有解凍紀錄,是不一致。進度不是欄位,由 `lawful status` 推導。不做的 pipeline 直接刪檔;值得記住為什麼,開 ADR。

## 節

六節,順序固定。`## Brief`、`## Stages`、`## Laws`、`## Examples` 不得省;`## 決定`、`## 修訂記錄` 無內容寫「無」。節裡只有事實,沒有填寫指引。

**Brief**:三到五句給第一次打開的人:意圖、input → output、流向(用 `→` 串 stage 的中文名)、它在哪條里程碑裡。

**Stages**:

```markdown
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `candidates :: World -> [(EntityId, EntityId)]` | 粗篩可能碰撞的對 | `Physics.Broadphase` | pure |
| 2 | `queryDynamic :: World -> [(EntityId, RigidBody)]` | 取非靜態剛體 | `ECS.Query`(願望,見 P-003-ecs-query) | pure |
| = | `step :: Time -> World -> (World, [CollisionEvent])` | 整條 | `Physics` | pure |
```

- 簽名欄逐字等於程式碼的型別簽名行(多行合併、空白正規化)。`lawful lint sig` 對帳。
- 模組欄與層欄與模組表一致。引用別條 pipeline 的 stage:簽名照抄,模組欄註明「見 P-00x-<slug>」。
- `=` 列恰好一列。列號只在本檔內有意義,引用用函數名。

**Laws**:純 ASCII 三行。

```markdown
- LAW-1 [invariant] 步進不改變實體數量
  - forall dt in Time, w in World
  - |- entityCount (fst (step dt w)) == entityCount w
- LAW-3 [relation] 碰撞事件只來自 broadphase 的候選對
  - forall dt in Time, w in World, (a, b) in snd (step dt w)
  - |- (a, b) in candidates w or (b, a) in candidates w
```

- `forall` 行:變數與定義域;前提寫在集合限定裡,或再加一行 `given <前提>`。
- `|-` 行:結論;每個識別字必須是 Stages 表的簽名、types 層匯出的函數,或 adapter 認得的標準函式庫函數(`length`、`fst`),`lint laws` 對帳,對不到不准 `ready`;`==`、`in`、`=>`、`.`、`and`、`or`。law 不定義型別,型別與函數一律住程式碼。
- 種類與對談時的問法:

| 種類 | 性質 | 問開發者什麼 |
|---|---|---|
| `invariant` | 某個量轉換前後不變 | 做完之後什麼一定不會變? |
| `identity` | 恆等、冪等、單位元 | 什麼輸入等於沒做?做兩次跟做一次一樣嗎? |
| `roundtrip` | 編了解回原值 | 存出去的東西要能一模一樣讀回來嗎?哪些欄位不算? |
| `relation` | 兩個 stage 輸出之間的關係 | 這一步的輸出跟上一步的輸出有什麼對應? |
| `bound` | 上下界、單調 | 哪個數字有上限?輸入變大輸出一定變大嗎? |
| `equiv` | 兩種算法等價 | 有沒有一個慢但一定對的寫法可以拿來對照? |
- 每條 law 至少一條 property test,測試以 `describe "P-002#LAW-1"` 宣告歸屬,歸屬字串只放這一個,測試輸出才對得回來。`lawful lint trace` 對帳。
- 觀察點必須是這條 pipeline 自己的簽名;要觀察別條的內部,law 屬於那條。
- bug = 某條 law 在現況下不成立:law 已存在就修碼;沒寫到就補 law(走修訂)。沒有 bug 文檔。

**Examples**:表 `# | 輸入 | 輸出 | 覆蓋`,每列指到它覆蓋的 law;指不到就先補 law。每個 example 一條 example test,歸屬 `P-002#EX-1`。

**決定**:每條一句粗體結論、否決的替代方案、理由一句;有證據引用 SPK / ADR 全名。只裝只關這條 pipeline 的決定;跨 pipeline 的開 ADR。解凍紀錄也寫這裡。

## 修訂(REV)

改既有 pipeline 的簽名、laws 或層,一律改原檔,一次修訂一條 REV。stage 在同一層內搬模組不是修訂:`lint sig` 報「搬家」,`lawful sync` 機械更新模組欄,不寫 REV。

```markdown
- REV-1(2026-09-12,依 qa 提問「零時間步進要不要清事件」):LAW-2 改成整組相等
  - 動到:LAW-2
  - 保護:LAW-1、LAW-3
  - 重委派:qa(LAW-2)
```

- 依:來源與那一句話(GAP 的提問原句、SPK / ADR 全名、開發者的話)。
- 保護:這次不准變的既有 law;要保護的行為還不是 LAW 的,先補成 LAW 再修訂。
- 重委派:law 變了重派 qa,簽名變了重派 impl。簽名變了,程式碼簽名行同步改、本體回未實作;測試只重跑 REV 點名的。
- 動到與保護只寫還在檔上的條目;`updated` 改成修訂日期。
- 引用的子流簽名變了,消費者跟著 REV;`frozen` 的消費者先解凍。

## 提問(GAP)

任何角色在文檔裡讀不出唯一答案(qa 寫不出斷言、impl 非改簽名不可、conductor 建骨架時模組表沒有那個模組):停下該項,不腦補、不與另一邊協商,其餘照做。委派期間人類決定只有這一條出口。寫在 `.design/gaps.md`:

```markdown
## GAP-1(P-002#LAW-2 / qa)
- 模糊點:「零時間步進是恆等」沒說事件列表要不要是空的
- 卡住的項目:P-002#LAW-2 的 property test 寫不出斷言
- 需要回答什麼:`step 0 w` 的第二個分量是 `[]`,還是沿用上一幀的事件?
- 狀態:open
```

- 委派模式下 subagent 不寫檔:四欄寫進回報,局部序號 `本次-1`,conductor 單線寫入配號。
- 結案 = 開發者口頭回答,`lawful:revise` 寫 REV 並刪條目,依欄帶模糊點原句。檔空了刪檔。
- open 的 GAP 擋:那條 pipeline 不算達成、`lawful:build` 前置不放行、`lawful status` exit 1。
- impl 測試全綠也不得把有 open GAP 的 stage 當完成。

## 願望 stage

需要底層還沒有的能力,在 Stages 表直接寫理想簽名,模組欄註明「願望,見 P-00x-<slug>」(還沒有子流就寫目標模組與「願望」)。程式碼找不到這列,`lawful status` 列成該模組的待實作,`lint sig` 不算紅。

底層維護者三選一:

| 判準 | 落點 |
|---|---|
| 兩條以上 pipeline 要,或需要該模組的內部表示 / 不變量 / 效能保證 | 進底層:在該模組的子流加 stage(沒有就 `claim` 一條),laws 寫在子流;原願望列改成引用 |
| 只有這條要,且用既有匯出寫得出來 | 留本地:stage 住這條 pipeline 自己的模組 |
| 會破壞底層的不變量 | 不做;改需求,記進「決定」 |

## 完成度

`lawful status` 算,每條 pipeline 三個數字:

| 數字 | 怎麼算 |
|---|---|
| 簽名 m / n | Stages n 條;程式碼找得到且逐字一致 m 條 |
| laws g / k | 寫了 k 條;測試宣告歸屬 j 條;綠 g 條 |
| 達成 | m = n、g = k、沒有 open GAP。里程碑達成 = 它與它引用的每條子流都達成 |

## ADR

`adr/ADR-00x-<slug>.md`,四節:情境、決定、否決的替代方案、後果。裝跨 pipeline 的決定:層怎麼切、效果 ADT 的形狀、刪 pipeline 的理由、語言與 adapter。

## spike

讀了也答不出來、要跑了才知道的問題,才開 spike:替決定生產證據,自己不做決定。

- frontmatter:`id`、`description`、`status`(`open | concluded`)、`verdict`(`feasible | infeasible | partial`)、`updated`、`feeds`(餵給 `P-00x-<slug>` 的決定或 ADR 全名;concluded 時非空)。
- 三節:`## 問題`(要回答什麼、為什麼讀不出來、判準、timebox)、`## 輪次`(`RND-n`:這輪要驗、判準、timebox、做法、結果、sha、環境)、`## 結論`(verdict、一句話、學到什麼、餵給哪裡、沒驗到的)。
- 判準寫成可觀察的數字或現象;每輪先寫三樣(要驗什麼、判準、timebox)再寫程式碼。
- 程式碼只在 `spike/SPK-00x-<slug>/`;open 期間產品程式碼與測試禁止 import。
- 結案:填齊 verdict / feeds / 每輪 sha,`lawful spike close SPK-00x` 刪資料夾。verdict 不是裁決,契約怎麼改仍走 `lawful:revise`。
- 不會有結論的 spike 刪檔與資料夾。
