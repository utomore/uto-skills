# pipeline 文檔

文檔只寫程式碼裝不下的東西:測試存在之前的 laws、為什麼這樣決定、跨過純 / IO 邊界的資料流。型別、簽名、模組匯出住程式碼;文檔引用,工具對帳。它們在設計階段就住進去:一條 pipeline 拍板 `ready` 之前,它的型別與每條簽名的骨架已經在主線的程式碼裡(roles.md「骨架與基線」)。

## `.lawful/`

```
.lawful/
├── Cone.md            願景、需求(各有 Requirement Law)、專案約束
├── objectives/R-x-O-y-<slug>.md   一個目標一個檔:對一條需求、有 Objective Law、建置路線的里程碑、優化路線的調整
├── modules.md         邊界、模組單元表、對外 I/O(boundary.md「模組表」)
├── pipelines/P-00x-<slug>.md
├── gaps.md            只裝 open 的 GAP;空了刪檔
├── adr/ADR-00x-<slug>.md
├── spikes/SPK-00x-<slug>.md   程式碼在專案根目錄 spike/SPK-00x-<slug>/,結案即刪
└── journal/<全名>.md          開發日誌,只存在於 build 分支;整合寫進 PR 後刪(roles.md「開發日誌」)
```

只有 `system.md` 體系的樹、或目標還擠在一份 `objectives.md` 的樹 → `lawful migrate cone --write` 換成上面這棵。

## Cone.md

frontmatter:`language`(選 adapter)、`updated`。標題一行 `# <專案名>:<一句話>`,三節:

| 節 | 裝什麼 |
|---|---|
| `## 願景` | 北極星:這個專案要交出的、世界上還沒有的東西是什麼,替誰改變了什麼。第一段一到三句,後面可以展開;系統設計時訂,不隨里程碑變;`lawful status` 把第一段印在第一行,還是模板就列警訊 |
| `## 需求` | 每條 `### R-n:<一句話>`:誰在什麼情況下要得到什麼。底下 `- Law:<一句可判定的話>`,可以再接三行式(forall / given / `\|-`,識別字是任何一條 pipeline 的 Stages 簽名或 types 層匯出);一條需求有兩個以上目標時再加 `- 蘊含:<那幾個目標的 Law 都成立 ⟹ 本 Law 成立,因為 …>` |
| `## 專案約束` | 使用者的硬性要求,清單:語言;三道指令:建置、整套測試、**子集測試**(每道指令是該列第一個反引號區段,反引號外的文字是給人看的說明;指令在專案根目錄執行,要換目錄就寫進指令);模組前綴;原始碼根目錄(帶 `<層>` 的樣式,預設 `src-<層>`);IO 模組追加;效果型別追加(boundary.md「效果的判定」);忽略目錄(不掃的原始碼目錄,例如搬遷中的舊樹);套件與框架(硬性要求的套件、框架、版本);優先(一行 `1 = …;2 = …;3 = …;4 = …`,各級在這個專案代表什麼)。其餘的列給人看,工具不讀 |

其他一切不寫在 Cone.md:邊界與對外 I/O 在 `modules.md`,pipeline 清單就是 `pipelines/` 裡的檔,類別在各 pipeline 的 frontmatter。

## 願景、需求、目標與路線

四層,每一層都回答「為什麼做這條 pipeline」:

| 層 | 住哪 | 是什麼 |
|---|---|---|
| 願景 | `Cone.md`「願景」 | 北極星:專案要交出的、世界上還沒有的東西;只有一個,系統設計時訂。它是方向,不是驗收清單:需求與目標不對它逐句對照,順序來自依賴與必要性,不來自離它多近 |
| 需求 | `Cone.md`「需求」的 `### R-n:<一句話>` | 一件使用者要得到的事,各有一條 **Requirement Law**:可驗證、可判定的一句話,最好有一條歸屬 `R-n#LAW` 的驗收測試(roles.md「驗收測試」)。至少一條 |
| 目標 | `objectives/R-x-O-y-<slug>.md`,一個目標一個檔;frontmatter `id`、`requirement`、`priority`、`updated`,標題 `# <全名>:<一句話>` | 解決**恰好一條需求**的一個能力承諾(frontmatter 的 `requirement`,也是檔名的 `R-x`;一條需求可以有多個目標),由開發者答三問:**What** 做到什麼(一句話:使用者做得到什麼、或世界變成什麼樣)、**How** 怎麼看得出做到了(`- Law:…`,一句可判定的話;需求與目標一對一時寫 `- Law:繼承 R-n`,不另寫)、**Which** 落在哪一級**優先**(frontmatter `priority`,1 到 4,1 最高)。slug 是 kebab-case 英文,講這個目標做到什麼;目標換需求就改檔名。要哪幾條 pipeline 撐是之後路線的事 |
| 優先各級 | `Cone.md`「專案約束」一行 `- 優先:1 = …;2 = …;3 = …;4 = …` | 各級在這個專案代表什麼,專案自己定(例:1 = 主軸與它的直接前提;2 = 地基;3 = 呈現與存取;4 = 工具與詞彙);`lawful status` 印它,沒宣告列警訊 |
| 建置路線 | 目標檔裡的表 `里程碑 \| 做到什麼 \| 綁定` | 為了達成目標而切出來的階段,`M-n` 全資料夾唯一,表的順序就是先後;**綁定**欄是 pipeline 全名,「、」分隔;還沒有 pipeline 就填「-」,意思是**待 claim**。建置路線走完,需求的 Law 第一次成立 |
| 優化路線 | 目標檔裡的表 `調整 \| 做到什麼 \| 動到` | 建置路線之後,改既有 pipeline 的實作或行為品質,`RF-n` 全資料夾唯一;**動到**欄是本目標里程碑綁定過的 pipeline 全名,「、」分隔。調整不引入新 feature:動到的 pipeline 不在本目標任何里程碑的綁定裡就是警訊,新能力開里程碑。每一次調整之後需求的 Law 仍要成立 |

```markdown
---
id: O-1
requirement: R-1
priority: 1
updated: 2026-09-05
---
# R-1-O-1-save-roundtrip:玩家存檔後能讀回同一個世界

- Law:繼承 R-1

| 里程碑 | 做到什麼 | 綁定 |
|---|---|---|
| M-1 | 存檔寫得出檔案 | P-001-save-write |
| M-2 | 讀檔還原世界 | P-002-save-load |
| M-3 | 存檔壞了看得出來 | - |

| 調整 | 做到什麼 | 動到 |
|---|---|---|
| RF-1 | 存檔檔案壓縮後不超過 1 MB | P-001-save-write |
```

- 里程碑綁 pipeline,IO 介面與子流都可以;看得見的階段通常綁 IO 介面,底層能力的階段綁子流。綁定是里程碑對到 pipeline 的唯一寫法。
- 每條 pipeline 至少被一條里程碑綁定;沒被綁的 pipeline 不朝向任何目標,`lawful status` 列警訊。要它就綁進一條里程碑,不要它就刪檔。
- 里程碑可以先於 pipeline 存在:綁定欄「-」的里程碑是待 claim,`lawful status` 在該目標的「下一個里程碑」行寫明,不是警訊;`lawful claim <slug> --milestone <M-n>` 填進去。綁到不存在的全名才是警訊。
- 調整走修訂:動到的每條 pipeline 各寫一條 REV,依欄引用 `RF-n`(「修訂(REV)」);調整的進度由那幾條 REV 與 pipeline 的達成推,表上不寫狀態。
- 一條需求有兩個以上目標,Cone.md 的那條需求要有蘊含說明,每個目標要有自己的 Law(不繼承);`lawful status` 對帳。
- 進度不是欄位:里程碑達成 = 綁定的每條 pipeline 都達成;目標完成度 = 達成的里程碑 / 里程碑數;Law 成立與否、調整達成與否照「完成度」;都由 `lawful status` 算。
- 配號只走 `lawful requirement add`、`lawful objective add`、`lawful objective milestone`、`lawful objective refinement`;`lawful claim <slug> --milestone <M-n>` 把新 pipeline 綁進里程碑。刪掉的號永久空缺。
- 建議路線與能開的線照目標優先、目標順序、里程碑順序排;沒被綁的排最後。

## pipeline

一段 **input → 純轉換 → output** 的資料流,由 **stage** 組成;每個 stage 是一條住在程式碼裡的簽名。

- 可以橫跨任意模組。模組是 stage 的屬性,不是文檔的歸屬。
- 兩端碰到 shell 的是 **IO 介面**;只在純核心裡的是**子流**。底層能力(查詢、碰撞偵測)也是子流。類別寫在 frontmatter 的 `kind`,講的是形狀,不是先後;先後由目標與里程碑定。
- 值得端到端規格的才建檔。單一小函數的 laws 直接寫 property test;它以 stage 的身分出現在用到它的 pipeline 裡。
- stage 順序是資料流的拓撲序。`=` 列(**純的整條**)是權威:它把純的步驟組合成一個值,住 core 或 effect,不住 shell;整條的 law 掛在它上面。
- **進入點**:IO 介面另有恰好一列 `!` 列,shell 的函數,把 `=` 列接到解譯器與對外 I/O(讀檔、寫檔、跑效果描述)。它是程式碼裡的簽名,`lint sig` 照對帳、進簽名 m / n;不掛 law,它做的事由對外 I/O 表與 shell 的步驟承接。子流沒有 `!` 列。
- **觀察點**:law 要引用、但不是資料流步驟的簽名(存取子、投影、輔助判定、效果描述的純解譯器),在 Stages 表列成 `#` 欄寫 `o` 的列。它是程式碼裡的簽名,`lint sig` 照對帳;它不是 stage:不掛 law、不進簽名 m / n、不算依賴。types 層匯出的函數 law 本來就能引用,不必列成觀察點。
- 依賴不手寫:A 的 Stages 表某列的模組欄註明「見 B」,A 就依賴 B;B 不因為被引用而依賴 A。同名簽名出現在兩條 pipeline 而沒有一邊註明「見」,分不出誰引用誰,`lint sig` 紅、`lawful status` 警訊,不算依賴。

## 編號與引用

| 東西 | 編號 | 引用寫法 |
|---|---|---|
| 需求 | `R-1`,`Cone.md`「需求」的 `### R-1:<一句話>` | `R-1`;它的 Law 是 `R-1#LAW` |
| 目標 | `O-1`,檔 `objectives/R-1-O-1-<slug>.md` | `O-1`;它的 Law 是 `O-1#LAW` |
| 里程碑 / 調整 | `M-1` / `RF-1`,目標檔裡的表 | `M-1` / `RF-1` |
| pipeline | `P-001`,檔 `pipelines/P-001-<slug>.md` | 全名 `P-001-<slug>` |
| stage | 函數名 | `P-002#candidates` |
| law / example / 修訂 | `LAW-1` / `EX-1` / `REV-1` | `P-002#LAW-1` |
| 提問 | `GAP-1`(`gaps.md` 內遞增) | `GAP-1` |
| ADR / spike | `ADR-001` / `SPK-001` | 全名 |

- 配號只走 `lawful claim`;刪掉的號永久空缺。
- `Cone.md`「專案約束」沒有號段行時,`lawful claim` 從全部 pipeline 的最大號往上配。有號段行時(每人一段,以 git 的 `user.email` 為鍵:`- 號段:a@corp.com = 000-099;b@corp.com = 100-199`),從自己區間內的最大號往上配,frontmatter 多一欄 `owner: <email>`;email 對不到任何區間、或區間用完,claim 停下,由架構負責人改號段行。號段只管一檔一號的 pipeline、spike、ADR;需求、目標、里程碑、調整住共用檔、經設計 review,一律從最大號往上配。
- `lint ids`:兩個檔案同號、號段行讀不懂或兩段重疊、`owner` 的號不在自己的區間內即紅。分支上各自 claim 時彼此看不到,同號在合進主線時才浮現,這條在 PR 的 CI 上跑。
- pipeline、ADR、spike 一律寫全名。
- slug 是 `<領域名詞>-<動詞或動名詞>`,kebab-case 英文,至少兩段。領域名詞是 `=` 列住的**模組單元**:去掉模組前綴、大駝峰拆成 kebab(`Weft.ActionSequence` → `action-sequence`);後面接這條資料流做什麼(`inventory-step`、`render-compose`、`snapshot-rewind`、`save-write`)。`lawful claim` 查領域名詞對得上模組表,`lint sig` 查它是 `=` 列住的單元;`=` 列搬到別的單元就 `lawful rename <P-00x> <slug>`,編號不動,專案裡寫著舊全名的每一處一起改。

## frontmatter 與 status

`id`、`description`、`kind`、`status`、`updated`;`Cone.md` 有號段行的專案多一欄 `owner`(`lawful claim` 寫,是 GAP 分派的依據)。`kind` 是 `IO 介面` 或 `子流`(「pipeline」);`claim --kind` 填,沒填的還是佔位符,`lawful status` 列警訊。`status` 只放人才知道的決定:

| status | 意思 |
|---|---|
| `draft` | 還在討論;`lawful:build` 拒收 |
| `ready` | 開發者口頭拍板、型別與簽名的骨架已在程式碼裡,`lawful:pipeline` 改欄位;可以委派 |
| `frozen` | `lawful status` 顯示達成,conductor 在 build 收尾直接改,不問;不准修訂。解凍 = `lawful:revise` 在「決定」記一條為什麼,改回 `ready` |

開發者不親自改任何 `.lawful/` 檔;開發者說,skill 寫。`frozen` 而測試紅、或有 REV 卻沒有解凍紀錄,是不一致。進度不是欄位,由 `lawful status` 推導。不做的 pipeline 直接刪檔;值得記住為什麼,開 ADR。

## 節

六節,順序固定。`## Brief`、`## Stages`、`## Laws`、`## Examples` 不得省;`## 決定`、`## 修訂記錄` 無內容寫「無」。節裡只有事實,沒有填寫指引。

**Brief**:三到五句給第一次打開的人:意圖、input → output、流向(用 `→` 串 stage 的中文名)、它是 IO 介面還是哪條 IO 介面的子流、它讓哪條里程碑往前一步。

**Stages**:

```markdown
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `candidates :: World -> [(EntityId, EntityId)]` | 粗篩可能碰撞的對 | `Weft.Physics.Broadphase` | core |
| 2 | `queryDynamic :: World -> [(EntityId, RigidBody)]` | 取非靜態剛體 | `Weft.ECS.Query`(見 P-003-ecs-query) | core |
| o | `overlaps :: EntityId -> EntityId -> World -> Bool` | 觀察:兩實體是否相交 | `Weft.Physics.Broadphase.Internal` | core |
| = | `step :: Time -> World -> (World, [CollisionEvent])` | 純的整條 | `Weft.Physics` | core |
```

IO 介面多一列進入點,放在最後:

```markdown
| = | `saveBytes :: World -> ByteString` | 純的整條:投影再編碼 | `Weft.Save` | core |
| ! | `saveGame :: FilePath -> World -> IO ()` | 進入點:整條接到寫檔 | `Weft.Save.Host` | shell |
```

- 簽名欄逐字等於程式碼的型別簽名行(多行合併、空白正規化),而且是該模組匯出的名字。`lawful lint sig` 對帳。
- 模組欄與層欄與模組表一致。引用別條 pipeline 的 stage:簽名照抄,模組欄註明「見 P-00x-<slug>」。
- **簽名裡的每個型別都在程式碼裡宣告過**:自訂的(大寫開頭)要找得到,標準函式庫的 adapter 認得;帶模組前綴的與型別變數不查。`lint sig` 對帳。
- **stage 之間傳遞的值用有名字的型別。** aeson 的 `Value` / `Object`、`Dynamic`、以它們為值的 `Map` 這類無名容器沒有地方寫形狀,qa 與 impl 會各猜一套鍵名;`lint sig` 紅。`!` 列接的是對外的東西,不查。
- `#` 欄:數字是步驟,`=` 是純的整條,`o` 是觀察點,`!` 是進入點。`=` 列恰好一列,不在 shell;`o` 列幾列都可以,不在 shell,放在 `=` 列之前;`!` 列 IO 介面恰好一列、子流沒有,在 shell,放在最後。步驟可以在 shell(寫檔、讀檔),它們沒有 law。列號只在本檔內有意義,引用用函數名。

**Laws**:純 ASCII 三行。

```markdown
- LAW-1 [invariant] 步進不改變實體數量
  - forall dt in Time, w in World
  - |- entityCount (fst (step dt w)) == entityCount w
- LAW-3 [relation] 碰撞事件只來自 broadphase 的候選對
  - forall dt in Time, w in World, (a, b) in snd (step dt w)
  - |- (a, b) in candidates w or (b, a) in candidates w
```

- `forall` 行:變數與定義域;一個 stage 的回傳值要拆開用,寫成 `(w1, effs) in step dt w`,`in` 對單一值就是綁定;前提寫在集合限定裡,或再加一行 `given <表達式>`。
- `given` 行也是純 ASCII 表達式,識別字規則同 `|-` 行。前提寫不成表達式,代表少一個觀察點(像 `emittedBy :: SystemId -> StepReport -> [SomeEvent]`):補 `o` 列,或開 GAP;不寫散文。
- `|-` 行:結論;每個識別字必須是 Stages 表的簽名(步驟、純的整條或觀察點)、types 層匯出的函數,或 adapter 認得的標準函式庫函數(`length`、`fst`),`lint laws` 對帳,對不到不准 `ready`;運算子 `==`、`/=`、`<`、`<=`、`>`、`>=`、`in`、`=>`、`.`、`and`、`or`、`not`。字串與數字字面值(`"teleport"`、`0`)不是識別字,直接寫,不為它造常數。law 不定義型別,型別與函數一律住程式碼。`!` 列不准出現在 law 裡。
- 需求與目標的 Law 三行式同一套規矩,只差識別字可以是任何一條 pipeline 的 Stages 簽名;寫了三行就承諾了驗收測試(roles.md「驗收測試」),沒有測試時這條 Law 是未知;寫不成三行就只留一句話,由底下的 Law 或建置路線推。
- 種類與對談時的問法:

| 種類 | 性質 | 問開發者什麼 |
|---|---|---|
| `invariant` | 某個量轉換前後不變 | 做完之後什麼一定不會變? |
| `identity` | 恆等、冪等、單位元 | 什麼輸入等於沒做?做兩次跟做一次一樣嗎? |
| `roundtrip` | 編了解回原值 | 存出去的東西要能一模一樣讀回來嗎?哪些欄位不算? |
| `relation` | 兩個 stage 輸出之間的關係 | 這一步的輸出跟上一步的輸出有什麼對應? |
| `bound` | 上下界、單調 | 哪個數字有上限?輸入變大輸出一定變大嗎? |
| `equiv` | 兩種算法等價 | 有沒有一個慢但一定對的寫法可以拿來對照? |
| `total` | 定義域內每個輸入都有值:不拋例外、不回 `Left` / `Nothing`;`\|-` 行寫 `total (f x)` 或 `isRight (f x)` | 哪些輸入看起來合法卻會爆?空的、最大的、負的呢? |
| `commute` | 順序無關:兩步對調、兩個輸入對調結果相同 | 先做 A 再做 B,跟先 B 再 A 一樣嗎?合併 a b 跟合併 b a 一樣嗎? |
- 每條 law 至少一條 property test,測試以 `describe "P-002#LAW-1"` 宣告歸屬,歸屬字串只放這一個,測試輸出才對得回來。`lawful lint trace` 對帳。
- `=` 列至少被一條 law 引用:整條的端到端性質(往返、不變量),不是各 stage law 的加總。`lint laws` 對帳。
- 觀察點必須是這條 pipeline 自己的簽名;要觀察別條的內部,law 屬於那條。
- bug = 某條 law 在現況下不成立:law 已存在就修碼;沒寫到就補 law(走修訂)。沒有 bug 文檔。

**Examples**:表 `# | 輸入 | 輸出 | 覆蓋`,每列指到它覆蓋的 law;指不到就先補 law。每個 example 一條 example test,歸屬 `P-002#EX-1`。

## 什麼要有 law

law 只掛在 stage 上,所以先問一個函數是不是 stage,再問它有沒有性質。兩題都答是,才立 law;每條 pipeline 的 `=` 列至少一條。

| 問 | 答否 | 答是 |
|---|---|---|
| 1. 有沒有任何 pipeline 把它寫進 Stages 表當步驟?(數字列或 `=` 列:別的模組或別的層拿它當資料流的一步) | 不是 stage,不寫 law。law 要拿它當觀察點就列成 `o` 列;只給自己模組用的支架(型別層遍歷的輔助 class、`where` 裡的區域函數、只為了寫出上層公開函數而存在的 method)歸內部單元測試,不標歸屬、不進分母 | 往下 |
| 2. 型別留下多少自由度?(有幾個型別正確、行為不同的實作) | 一個,不寫 law:回常數或名字的 method、只包一層的 smart constructor、instance 存在與否、deriving。這些由編譯器或初始狀態驗收 | 有限幾個,每個自由度一條 law;無限多(演算法決定),law 寫不變量與邊界,寫不出 `|-` 行的部分靠 example |

typeclass 照同一套:給全專案實作或呼叫的抽象(碰撞的 `Shape`、component 的 codec)是 stage,它的代數性質在 class 所屬的子流寫成 law,**一條 law、每個 instance 一條測試**,歸屬都標同一個 `P-00x#LAW-n`;instance 不另寫 law。只在模組內遞迴用的 class 不是 stage。

手寫的標準 class instance(`Semigroup`、`Monoid`、`Functor`、`Traversable`、`Ord`)自由度無限:class 的法則照一般 law 寫在該型別所屬的 pipeline(結合律是 `relation`、單位元是 `identity`),qa 可以用 class 法則套件承接,一條 law 對一個 `describe`。`deriving` 出來的不寫。

不寫 law 的:常數與設定值、`!` 列(進入點只接線,由對外 I/O 表承接)、shell 層的 IO 函數(它們在對外 I/O 表)、只有型別層知識的東西。law 的條數不是進度,是自由度的數量。

**需求與目標的 Law** 不掛在 stage 上,掛在「這件事成立了沒」上:一條需求一條、一個目標一條。它講的是使用者看得到的結果,不是某個函數的性質;能寫成三行、有驗收測試最好(歸屬 `R-n#LAW` / `O-n#LAW`,誰寫、什麼時候寫見 roles.md「驗收測試」),不能就一句可判定的話,由底下的 Law 或建置路線推(「完成度」)。

**決定**:每條一句粗體結論、否決的替代方案、理由一句;有證據引用 SPK / ADR 全名。只裝只關這條 pipeline 的決定;跨 pipeline 的開 ADR。解凍紀錄也寫這裡。

## 修訂(REV)

改既有 pipeline 的簽名、laws、層或效能承諾,一律改原檔,一次修訂一條 REV。stage 在同一層內搬模組不是修訂:`lint sig` 報「搬家」,`lawful sync` 機械更新模組欄,不寫 REV。

```markdown
- REV-1(2026-09-12,依 qa 提問「零時間步進要不要清事件」):LAW-2 改成整組相等
  - 動到:LAW-2
  - 保護:LAW-1、LAW-3
  - 重委派:qa(LAW-2)
```

- 依:來源與那一句話(GAP 的提問原句、SPK / ADR 全名、`RF-n` 與它那一句、開發者的話)。優化路線的調整一律從這裡進來:動到的每條 pipeline 各一條 REV,依欄寫 `RF-n`,`lawful status` 靠它算調整的進度。
- 保護:這次不准變的既有 law;要保護的行為還不是 LAW 的,先補成 LAW 再修訂。
- 重委派:law 變了重派 qa,簽名變了重派 impl。簽名變了,程式碼簽名行同步改、本體回未實作;測試只重跑 REV 點名的。
- 動到與保護只寫還在檔上的條目;`updated` 改成修訂日期。
- 引用的子流簽名變了,消費者跟著 REV;`frozen` 的消費者先解凍。

## 提問(GAP)

任何角色在文檔裡讀不出唯一答案(qa 寫不出斷言、impl 非改簽名不可、conductor 建骨架時模組表沒有那個模組):停下該項,不腦補、不與另一邊協商,其餘照做。委派期間人類決定只有這一條出口。寫在 `.lawful/gaps.md`:

```markdown
## GAP-1(P-002#LAW-2 / qa)
- 模糊點:「零時間步進是恆等」沒說事件列表要不要是空的
- 卡住的項目:P-002#LAW-2 的 property test 寫不出斷言
- 需要回答什麼:`step 0 w` 的第二個分量是 `[]`,還是沿用上一幀的事件?
- 狀態:open
```

- 委派模式下 subagent 不寫檔:四欄寫進回報,局部序號 `本次-1`,conductor 單線寫入配號;在 build 分支上從主線的最大號往上配,整合時撞號的由整合者把後合進來的往上移(roles.md「整合」)。
- 結案 = 開發者口頭回答,`lawful:revise` 寫 REV 並刪條目,依欄帶模糊點原句。檔空了刪檔。
- open 的 GAP 擋:那條 pipeline 不算達成、`lawful:build` 前置不放行、`lawful status` exit 1。
- impl 測試全綠也不得把有 open GAP 的 stage 當完成。

## 完成度

`lawful status` 算。每條 pipeline 三個數字:

| 數字 | 怎麼算 |
|---|---|
| 簽名 m / n | Stages 的步驟(數字列、`=` 列與 `!` 列)n 條;程式碼找得到且逐字一致 m 條。`o` 列另計「觀察點 j / k」。整格還是 `<…>` 佔位符的列是模板,不算 stage,警訊列「還是模板」;law 與 example 同理 |
| 骨架 s | m 條裡本體還是 `stub` 的 s 條;`lawful status` 列成待實作 |
| laws g / k | 寫了 k 條;測試宣告歸屬 j 條;綠 g 條 |
| 達成 | m = n、s = 0、觀察點全在、g = k、沒有 open GAP。pipeline 達成 = 它與它引用的每條子流都達成 |

往上推:

| 東西 | 怎麼判 |
|---|---|
| 里程碑達成 | 綁定的每條 pipeline 都達成 |
| 目標完成度 | 達成的里程碑 / 里程碑數,印成百分比;沒有里程碑的目標印「-」並列警訊 |
| 目標 Law 成立 | 有歸屬 `O-n#LAW` 的測試就以它綠 / 紅為準;Law 是繼承而需求有 `R-n#LAW` 測試就用那一條;寫了三行式卻沒有測試是「未知」;一句話的 Law 沒有測試 = 建置路線的里程碑全部達成(報告標「推得」)。測試在而沒跑是「未知」 |
| 需求 Law 成立 | 有歸屬 `R-n#LAW` 的測試就以它為準;寫了三行式卻沒有測試是「未知」;一句話的 Law 沒有測試 = 它底下每個目標的 Law 都成立(報告標「推得」),一個目標都沒有就未成立。成立的需求分「測試」與「推得」兩種,報告分開數。建置路線全部達成而 Law 未成立是警訊:最低限度的 Law 沒達到 |
| 調整達成 | 動到的每條 pipeline 都有一條依欄引用 `RF-n` 的 REV、都達成,而且需求 Law 仍成立。沒有任何 REV 引用它是「待修訂」;有 REV 而 pipeline 未達成或需求 Law 未成立是「進行中」。動到的 pipeline 達成而需求 Law 未成立是警訊:優化破壞了 Law |

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
