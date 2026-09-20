# feature 文檔

文檔只寫程式碼裝不下的東西:測試存在之前的 laws、為什麼這樣決定、跨過對外邊界的資料流。型別、簽名、匯出住程式碼;文檔引用,工具對帳。程式碼先到:一條里程碑先由 `dev-flow:spike-impl` 做成一條跑得通的垂直切片,`dev-flow:scope-laws` 再對著它與開發者逐條談出 laws,Steps 的簽名抄程式碼裡定下來的那一個(roles.md「五個階段」)。做之前就寫的只有需求(含驗收與切好的里程碑)、全域 Law(對外 I/O 的信任邊界是其中的契約一類);其餘都等跑得通了再講。**測試涵蓋到哪裡,這份功能的承諾就到哪裡**:沒有 law 守著的行為不是承諾,實作可以自由改。

## `.design/`

```
.design/
├── system.md          願景、全域 Law(領域不變量、架構:層、契約:對外 I/O)、語言與工具、Features 清單
├── requirements/R-n-<slug>.md     一條需求一個檔(「願景、需求與里程碑」)
├── modules.md         模組表(boundary.md「模組表」)
├── features/F-00x-<slug>.md
├── gaps.md            只裝 open 的 GAP;空了刪檔
├── adr/ADR-00x-<slug>.md
└── journal/<鍵>.md           決策紀錄,一條 build 分支一份,鍵是里程碑全名 M-n-<slug>、文檔全名或 R-n / INV-n;只存在於 build 分支,整合寫進 PR 後刪(roles.md「決策紀錄」)
```

## system.md

frontmatter:`language`(選 adapter;前後端各一種語言的專案寫 `[<目錄> = <adapter>, <目錄> = <adapter>]`,tooling.md「language adapter」)、`updated`。四節,「全域 Law」底下三個小區;需求不住這裡,住 `requirements/`(「願景、需求與里程碑」):

| 節 | 裝什麼 |
|---|---|
| `## 願景` | 北極星。第一段一到三句:這個專案要交出的、世界上還沒有的東西是什麼,替誰改變了什麼;後面可以展開替誰做什麼、明確不做什麼。立案時訂,不隨里程碑變;`devflow status` 把第一段印在第一行,還是模板就列警訊 |
| `## 全域 Law` | **不得違反**的約束,整個專案的約束都看得到住在這一區(laws.md「全域 Law」);底下三個小區 |
| `### 領域不變量` | `- INV-n [種類] 一句話` 一條一項,能寫成三行就寫;一條都沒有寫「無」 |
| `### 架構:層` | 表,由內而外(boundary.md「層」) |
| `### 契約:對外 I/O` | 表:名稱、方向(in / out)、型別、模組、進入哪份 feature、信任(trusted / untrusted)、驗證、契約(boundary.md「對外 I/O」) |
| `## 語言與工具` | 三道指令:建置、整套測試、**子集測試**;每道指令是該列第一個反引號區段,反引號外的文字是給人看的說明;指令在專案根目錄執行,要換目錄就寫進指令;多語言專案每側一段「<目錄> = `指令`」以 ; 分隔。IO 模組追加、Laws 詞彙追加(law 會用到但不是簽名也不是型別名的字)、忽略目錄;一行「優先:1 = …;2 = …;3 = …;4 = …」宣告優先各級在這個專案代表什麼 |
| `## Features` | 表:全名、類別(`feature`)。`devflow status` 的分母;交付順序不寫在這裡,由需求的優先、里程碑的順序與文檔的引用推 |

description 住各文檔的 frontmatter,清單不重複。

## 願景、需求與里程碑

需求面三層:願景 → 需求 → 里程碑,每一層都回答「為什麼做這份 feature」。這三層講的都是**必須達成**的事——有做完的一天;裡面沒有 law,也不管理約束(laws.md「Law 與需求」):

| 層 | 住哪 | 是什麼 |
|---|---|---|
| 願景 | `system.md`「願景」 | 北極星:專案要交出的、世界上還沒有的東西;只有一個,立案時訂。它是方向,不是驗收清單:需求不對它逐句對照,順序來自依賴與必要性,不來自離它多近 |
| 需求 | `requirements/R-n-<slug>.md`,一條需求一個檔;frontmatter `id`、`priority`、`updated`,標題 `# <全名>:<一句話>` | 一件使用者要得到的事,**必須達成**:一句話講誰在什麼情況下要得到什麼。各有一句**驗收**(`- 驗收:…`):可驗證、可判定的一句話,判這條需求達成了沒;最好有一條歸屬 `R-n#ACCEPT` 的驗收測試(roles.md「驗收測試」)。各有一級**優先**(frontmatter `priority`,1 到 4,1 最高)。需求不是 law:做到之前它本來就還沒達成。需求只在與開發者的討論裡成形,只由 `dev-flow:require-design` 寫。`R-n` 是流水號,永不重排,只是身分,不代表先後;slug 是 kebab-case 英文,講這條需求要得到什麼。至少一條 |
| 優先各級 | `system.md`「語言與工具」一行 `- 優先:1 = …;2 = …;3 = …;4 = …` | 各級在這個專案代表什麼,專案自己定(例:1 = 主軸與它的直接前提;2 = 地基;3 = 呈現與存取;4 = 工具與詞彙);`devflow status` 印它,沒宣告列警訊 |
| 里程碑 | 需求檔裡的表 `里程碑 \| 做到什麼 \| 綁定` | 這條需求的建置切成的階段,**有順序,依序完成;全部達成,這條需求的建置就走完**。第一格是全名 `M-n-<slug>`:`M-n` 全資料夾唯一(跨需求檔)、引用用它,slug 是 kebab-case 英文,切片的分支 `build/M-n-<slug>` 與決策紀錄以全名為鍵;表的列序就是先後。**綁定**欄是 feature 全名,「、」分隔,切片做出來的新 feature 或這個階段靠修訂做到的既有 feature 都可以;「-」的意思是**還沒有切片** |
| 調整 | 需求檔裡的表 `調整 \| 做到什麼 \| 動到` | 這條需求的里程碑全部達成之後,改既有 feature 的實作或行為品質(效能、大小、訊息、演算法),`RF-n` 全資料夾唯一(跨需求檔);**動到**欄是這條需求的里程碑綁定過的 feature 全名,「、」分隔。調整不引入新 feature:動到的 feature 不在這條需求任何里程碑的綁定裡就是警訊,新能力開里程碑。每一次調整之後需求仍要達成 |

```markdown
---
id: R-1
priority: 1
updated: 2026-09-07
---
# R-1-money-correct:每一筆結帳與退款的金額都算對

- 驗收:任一筆請求,訂單付的錢與退回的錢都等於品項加總減掉折扣或手續費的結算金額
  - forall raw in RawBody
  - |- paidCents(checkout(raw)) == cents(settle(reqLines(parseCheckout(raw)), reqDiscount(parseCheckout(raw))))

| 里程碑 | 做到什麼 | 綁定 |
|---|---|---|
| M-1-checkout | 送出一筆結帳請求,回應裡看得到算好的應付金額 | F-001-checkout |
| M-2-refund | 送出一筆退款請求,回應裡看得到退回的金額 | F-002-refund |
| M-3-receipt | 查一筆訂單,看得到它付了多少、退了多少 | - |

| 調整 | 做到什麼 | 動到 |
|---|---|---|
| RF-1 | 結帳一次走完不重算 | F-001-checkout |
```

- **里程碑怎麼切**:每一條都是一個**明確的階段性使用者驗收**——使用者看得到這個階段的成果,可以展示、或呼叫這個階段的功能。里程碑那一句話就是展示得出來的那一句;展示的方法是切片決策紀錄的「Entry」(一道指令,跑起來看得到)。一條里程碑仍然是一條垂直切片的範圍:從一個對外入口貫通到出口;大到一次貫通不了就再切。里程碑在談需求的當場就切好(`dev-flow:require-design`)。
- **依序,一次一條**:一條需求一次只開它下一條還沒達成的里程碑。要同時開工的線屬於不同需求;一條需求裡需要兩條平行的線,就拆成兩條需求。
- **新需求先對過既有的需求**:一條新需求落筆之前,它的驗收逐條對既有每一條需求的驗收,問「兩者有沒有無法同時達成的」。有衝突就先攤影響範圍(哪條既有需求的一句話或驗收要改;它的 `R-n#ACCEPT` 驗收測試作廢,要 `dev-flow:build R-n` 重派 qa;哪幾份 feature 的 law 因此要調整,各自走 `dev-flow:scope-laws`;哪幾條里程碑的那一句要改),再給選項(改既有的那一條、改新的這一條、不收新的),開發者對著一個選項明確說了要才落筆;沉默、「你決定」不算。`dev-flow:require-design` 做,沒有衝突也在回報裡寫明對過哪幾條。
- **需求的先後從引用推**:需求的編號只是身分。「哪條需求疊在哪條上面」不寫在任何欄位,由文檔的引用推出來:這條需求的里程碑綁的文檔引用了別條需求的里程碑綁的文檔(「編號與引用」),它就依賴那一條。`devflow status` 的需求表有一欄「依賴」,看板的相依頁籤把它畫出來。互不依賴的需求可以同時開工;有依賴的,後面那條被前面那條擋住:被引用的那一份達成,引用它的才算達成(「完成度」)。
- **里程碑不管理約束**:它沒有 law、沒有測試標記;約束只住全域 Law 與 scope law(laws.md「Law 與需求」)。
- 里程碑只綁 feature。綁定是里程碑對到文檔的唯一寫法,文檔經由它朝向需求。
- 每份 feature 至少被一條里程碑綁定;沒被綁的 feature 不朝向任何需求,`devflow status` 列警訊。要它就由 `dev-flow:require-design` 收進一條里程碑,不要它就走文檔退役(「修訂(REV)」)。
- 里程碑先於 feature 存在:需求剛談完時綁定欄都是「-」,`devflow status` 在該需求的「下一條里程碑」寫明還沒有切片,不是警訊。`dev-flow:spike-impl M-n-<slug>` 做出切片,`dev-flow:scope-laws` 再從切片 claim 出文檔(`devflow claim feature <slug> --milestone <M-n>`)填進綁定欄;一條里程碑可以綁好幾份 feature。綁到不存在的全名、或里程碑沒有英文名,才是警訊。
- **里程碑可以綁既有的 feature**:一條里程碑不一定做出新的 feature。它讓使用者看得到的那個階段若是靠修訂既有的 feature 做到的,綁定欄就填那份既有的 feature;一份 feature 可以被不只一條里程碑綁定。這種里程碑的切片在 `build/M-n-<slug>` 分支上對既有文檔走修訂(「修訂(REV)」):既有的 law 不動、新的承諾用新增的 law 表達,走 `dev-flow:scope-revise <全名>`;要調整既有的 law,走 `dev-flow:scope-laws <全名>`。REV 的依欄寫 `M-n` 與它那一句;綁定欄由做修訂的那個 skill 在重開那份文檔的同一個動作填上,在那之前是「-」。達成的定義不變:綁定的每份 feature 都達成。
  - 例:整個專案的資料儲存換成資料庫。需求寫的是誰得到什麼(「服務重啟後,已成立的訂單不遺失」);里程碑「訂單重啟後還在」靠修訂 `F-001-checkout` 達成,綁定欄填 `F-001-checkout`,「重啟後讀得回來」是它新增的一條 law。用哪個資料庫不是需求本身:它是決定(ADR),加上全域 Law 的變更(`dev-flow:global-laws`:對外 I/O 多一端、資料庫客戶端只准住最外層)與「語言與工具」的測試指令。
- 調整走修訂:動到的每份 feature 各寫一條 REV,依欄引用 `RF-n`(「修訂(REV)」)。調整預設走 `dev-flow:scope-revise`(既有的 law 不動;效能要一條新的 `bound` law 才驗得了,就在那裡新增);要調整既有的 law 才做得到的調整,整件走 `dev-flow:scope-laws`;調整的進度由那幾條 REV 與 feature 的達成推,表上不寫狀態。
- 進度不是欄位:里程碑達成 = 綁定的每份 feature 都達成;需求的建置進度 = 達成的里程碑 / 里程碑數;需求達成與否、調整達成與否照「完成度」;都由 `devflow status` 算。
- 配號只走 `devflow requirement add`、`devflow requirement milestone`、`devflow requirement refinement`(需求面)與 `devflow invariant add`(領域不變量);`devflow claim feature --milestone <M-n>` 把新 feature 綁進里程碑。刪掉的號永久空缺。
- 建議路線與能開的線照需求的優先、需求編號、里程碑順序排;沒被綁的排最後。

## feature

一份 **feature** 是一條 **input → 轉換 → output** 的資料流,從對外邊界進、從對外邊界出,由 **step** 組成;每個 step 是一條住在程式碼裡的簽名。

- 可以橫跨任意檔案與層。檔案是 step 的屬性,不是文檔的歸屬。**沒有子系統這一層**:feature 直接掛在 `system.md` 底下。
- 值得端到端規格的才建檔。單一小函數的性質直接寫測試;它以 step 的身分出現在用到它的 feature 裡。
- **切片可以大,文檔不跟著變大**:一條切片可以貫通好幾個模組,`dev-flow:scope-laws` 把它拆成一份講一件使用者做得到的事的 feature。一份文檔幾十條 law,拍板會變成打包追認,一條 REV 會重開一整片,互不引用的文檔才能同時各開一波。
- step 順序是資料流的拓撲序。`=` 列(**整條**)是權威:它把各步驟組合成一次呼叫,住內層,不住最外層;整條的 law 掛在它上面。
- **進入點**:feature 另有恰好一列 `!` 列,住最外層,把 `=` 列接到對外 I/O(HTTP handler、CLI 指令、UI 事件、排程)。它是程式碼裡的簽名,`lint sig` 照對帳、進簽名 m / n;不掛 law,它做的事由對外 I/O 表承接。
- **觀察點**:law 要引用、但不是資料流步驟的簽名(存取子、投影、判定),在 Steps 表列成 `#` 欄寫 `o` 的列。`lint sig` 照對帳;它不是 step:不掛 law、不進簽名 m / n。最內層匯出的函數 law 本來就能引用,不必列成觀察點。

feature 之間**可以互相引用**,不論它們屬於哪條需求:兩份 feature 用到同一個 step,它與它的 law 只住先做出它的那一份,另一份引用(「編號與引用」)。

依賴不手寫:F-002 的 Steps 表某列的模組欄註明「見 F-001-<slug>」,F-002 就依賴 F-001;F-001 不因為被引用而依賴 F-002。同名簽名出現在兩份文檔而沒有一邊註明「見」,或註明的那一份沒有這個 step,`lint sig` 紅。

## 編號與引用

| 東西 | 編號 | 引用寫法 |
|---|---|---|
| 需求 | `R-1`,檔 `requirements/R-1-<slug>.md` | `R-1`;它的驗收測試歸屬 `R-1#ACCEPT` |
| 領域不變量 | `INV-1`,`system.md`「全域 Law」區「領域不變量」的清單項 | `INV-1`;它的測試歸屬 `INV-1#LAW` |
| 里程碑 / 調整 | `M-1` / `RF-1`,需求檔裡的表,跨需求檔唯一;里程碑的第一格是全名 `M-1-<slug>` | `M-1`(分支與決策紀錄用全名 `M-1-<slug>`)/ `RF-1` |
| feature | `F-001`,檔 `features/F-001-<slug>.md` | 全名 `F-001-<slug>` |
| step | 函數名 | `F-002#refresh`;別份文檔用它,在 Steps 表的模組欄註明「見 F-002-<slug>」 |
| law / example / 修訂 | `LAW-1` / `EX-1` / `REV-1` | `F-002#LAW-1` |
| 提問 | `GAP-1`(`gaps.md` 內遞增) | `GAP-1` |
| ADR | `ADR-001` | 全名 |

- **一個 step 與它的 law 只住在一份文檔——先做出它的那一份。** 別的文檔要用它,就在 Steps 表的模組欄註明「見 <那份文檔的全名>」引用它,簽名照抄;law 不重寫、不複製。feature 可以引用另一份 feature,不論它們屬於哪條需求。實作先行:後做的切片直接呼叫既有的程式碼,同一個 step 沒有第二份。
  - 被引用的那一份達成,引用它的才算達成(「完成度」);要對那個 step 多一條承諾,law 加在它住的那一份(「修訂(REV)」)。
  - 兩條切片平行開工、各寫了一份同樣的 step:整合時選一份留著(`dev-flow:integrate` 問開發者,預設留先合進主線的那一份),另一份刪掉自己的那個 step 與它的 law,改成引用。刪既有的 law,所以走 `dev-flow:scope-laws <另一份的全名>`。
  - `lint sig` 對帳:同名簽名出現在兩份文檔而沒有一邊註明「見」即紅;註明的那一份不存在、或它沒有這個 step(或它自己也是引用)即紅。
- 配號只走 `devflow claim`、`devflow requirement add / milestone / refinement`、`devflow invariant add`;刪掉的號永久空缺。
- `devflow claim` 配號時看同一個 repo 的每一棵工作樹:每條切片住自己的 build 工作樹、各自 claim,別棵樹上 claim 走的號不重配。
- `system.md`「語言與工具」沒有號段行時,`devflow claim` 從該類別全部文檔的最大號往上配。有號段行時(每人一段,以 git 的 `user.email` 為鍵:`- 號段:a@corp.com = 000-099;b@corp.com = 100-199`),從自己區間內的最大號往上配,frontmatter 多一欄 `owner: <email>`;email 對不到任何區間、或區間用完,claim 停下,由架構負責人改號段行。號段只管 feature 與 ADR;需求、領域不變量、里程碑、調整一律從最大號往上配(里程碑與調整跨需求檔、跨工作樹)。
- `lint ids`:兩個檔案同號、號段行讀不懂或兩段重疊、`owner` 的號不在自己的區間內即紅。不同機器上各自 claim 時彼此看不到,同號在合進主線時才浮現,這條在 PR 的 CI 上跑。
- feature 與 ADR 一律寫全名。
- slug 是 kebab-case 英文,講資料流做什麼。

## 簽名怎麼寫

文檔一律寫**正規式**,adapter 負責把各語言的宣告正規化成它,兩邊才是同一把尺:

```
name(型別, 型別): 回傳型別
```

- **參數名不寫**:改參數名是實作自由,不是契約變動。
- 方法與關聯函數寫 `型別.方法`(`TokenStore.rotate(TokenId): TokenPair`);接收者 / `self` / `cls` 不算參數。
- 回傳型別可以省略(`name(T): ` 寫成 `name(T)`);程式碼那一側也沒有註記時,`lint sig` 只比名字與參數個數,並列 info 說明只對到這兩樣。
- 泛型與命名空間照抄程式碼的寫法,空白正規化後逐字比。
- **簽名裡的每個型別都在程式碼裡宣告過**:自訂的(大寫開頭)要找得到,標準函式庫的 adapter 認得,真的少一個字就加進 `system.md`「Laws 詞彙追加」;帶命名空間的不查。`lint sig` 對帳。
- **step 之間傳遞的值用有名字的型別。** `dict`、`Any`、`any`、`unknown`、`object`、`interface{}`、`serde_json::Value` 這類無名容器沒有地方寫形狀,qa 與 refactor 會各猜一套鍵名;`lint sig` 紅。`!` 列接的是對外的東西,不查。

## frontmatter 與 status

`id`、`description`、`status`、`updated`;`system.md` 有號段行的專案多一欄 `owner`(`devflow claim` 寫,是 GAP 分派的依據)。`status` 只放**人才知道的決定**,進度不是欄位:

| status | 意思 |
|---|---|
| `draft` | `dev-flow:scope-laws` claim 出來、Law 還在談;`dev-flow:build` 拒收 |
| `ready` | 開發者逐條口頭拍板了 laws、Steps 的每條簽名在程式碼裡對得上,skill 改欄位;可以委派 |
| `verified` | qa 與 refactor 做完、`devflow status` 顯示達成(每條 law 都有一條會失敗、現在通過的測試守著),conductor 在 build 收尾直接改,不問;不重開不准動。重開 = `dev-flow:scope-laws`(要調整既有的 law)或 `dev-flow:scope-revise`(既有的 law 不動)在「決定」記一條為什麼,改回 `ready`;build 收尾時每條 law 成立,它再回到 `verified` |

開發者不親自改任何 `.design/` 檔;開發者說,skill 寫。`verified` 而測試紅、或有 REV 卻沒有重開紀錄,是不一致。用不到的 feature 走文檔退役(「修訂(REV)」),為什麼退役由整合寫成 ADR。

## 節

六節,順序固定。`## Brief`、`## Steps`、`## Laws`、`## Examples` 不得省;`## 決定`、`## 修訂記錄` 無內容寫「無」。節裡只有事實,沒有填寫指引。

**Brief**:三到五句給第一次打開的人:意圖、input → output、流向(用 `→` 串 step 的中文名)、哪個對外入口進來。

**Steps**:

```markdown
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `parseRefresh(RawBody): Result<RefreshReq, ParseError>` | 解析請求 | `src/app/refresh.ts` | application |
| 2 | `lookup(TokenId, TokenStore): Option<Token>` | 取出 token | `src/domain/token.ts`(見 F-001-login) | domain |
| o | `isValid(Token, Instant): boolean` | 觀察:這個 token 當下可不可用 | `src/domain/token.ts` | domain |
| = | `refresh(RefreshReq, TokenStore, Instant): Result<TokenPair, AuthError>` | 整條 | `src/app/refresh.ts` | application |
| ! | `refreshHandler(HttpReq): Promise<HttpRes>` | 進入點:接到 POST /auth/refresh | `src/entry/routes.ts` | entry |
```

- 簽名欄照上面「簽名怎麼寫」,而且是該檔案對外匯出的名字。`devflow lint sig` 對帳。
- 模組欄是**相對專案根目錄的檔案路徑**;層欄與模組表一致。引用別份文檔的 step:簽名照抄,模組欄註明「見 <那份文檔的全名>」;它的 law 住那一份,這裡不重寫(「編號與引用」)。
- `#` 欄:數字是步驟,`=` 是整條,`o` 是觀察點,`!` 是進入點。`=` 列恰好一列,不在最外層;`o` 列幾列都可以,不在最外層,放在 `=` 列之前;`!` 列恰好一列,在最外層,放在最後。列號只在本檔內有意義,引用用函數名。

**Laws**:純 ASCII 三行,呼叫式語法。

```markdown
- LAW-1 [state] 換發成功之後,舊的 TokenId 立刻失效
  - forall t in TokenId, s in TokenStore, now in Instant
  - given isOk(refresh(mkReq(t), s, now))
  - |- isValid(lookup(t, s), now) == false
- LAW-2 [invariant] 換發失敗不改變任何 token 的可用性
  - forall t in TokenId, u in TokenId, s in TokenStore, now in Instant
  - given isErr(refresh(mkReq(t), s, now))
  - |- isValid(lookup(u, s), now) == isValid(lookup(u, s), now)
```

- `forall` 行:變數與定義域。一個 step 的回傳值要拆開用,寫成綁定(`p in refresh(r, s, now)`),`in` 對單一值就是綁定。
- `given` 行也是純 ASCII 表達式。**`given` 行的呼叫先發生,`|-` 行在其後求值**——命令式語言的時序靠這一句表達,不必另立語法。前提寫不成表達式,代表少一個觀察點:補 `o` 列,或開 GAP;不寫散文。
- `|-` 行:結論。每個識別字必須是 Steps 表的簽名(步驟、整條或觀察點)、最內層匯出的函數、程式碼裡的型別或列舉名,或 adapter 認得的標準函式庫名;真的少一個字就加進 `system.md`「Laws 詞彙追加」。`lint laws` 對帳,對不到不准 `ready`。運算子 `==`、`!=`、`<`、`<=`、`>`、`>=`、`in`、`=>`、`and`、`or`、`not`。字串與數字字面值直接寫,不為它造常數。law 不定義型別,型別與函數一律住程式碼。`!` 列不准出現在 law 裡。
- 種類與對談時的問法:

| 種類 | 性質 | 問開發者什麼 |
|---|---|---|
| `invariant` | 某個量轉換前後不變 | 做完之後什麼一定不會變? |
| `identity` | 恆等、冪等、單位元 | 什麼輸入等於沒做?做兩次跟做一次一樣嗎? |
| `roundtrip` | 編了解回原值 | 存出去的東西要能一模一樣讀回來嗎?哪些欄位不算? |
| `relation` | 兩個 step 輸出之間的關係 | 這一步的輸出跟上一步的輸出有什麼對應? |
| `bound` | 上下界、單調 | 哪個數字有上限?輸入變大輸出一定變大嗎? |
| `equiv` | 兩種算法等價 | 有沒有一個慢但一定對的寫法可以拿來對照? |
| `total` | 定義域內每個輸入都有值:不拋例外、不回錯誤 | 哪些輸入看起來合法卻會爆?空的、最大的、負的呢? |
| `commute` | 順序無關 | 先做 A 再做 B,跟先 B 再 A 一樣嗎? |

- 每條 law 至少一條 property test,測試宣告歸屬 `F-002#LAW-1`(寫法見 tooling.md「測試歸屬」),歸屬字串只放這一個。`devflow lint trace` 對帳。
- `=` 列至少被一條 law 引用:整條的端到端性質,不是各 step law 的加總。`lint laws` 對帳。
- 觀察點必須是這份文檔自己的簽名;要觀察別份的內部,law 屬於那一份。
- 需求的驗收可以寫成同一套三行式,只差識別字可以是任何一份文檔的 Steps 簽名;寫了三行就承諾了驗收測試(roles.md「驗收測試」),沒有測試時達成與否是未知;寫不成三行就只留一句話,由里程碑全部達成推得。`lint laws` 對帳。
- bug = 某條 law 在現況下不成立:law 已存在就修碼,沒寫到就補一條 law 再修碼;兩種都走 `dev-flow:scope-revise`(既有的 law 不動,只新增)。**沒有 bug 文檔。**

## 什麼要有 law

law 只掛在 step 上,所以先問一個函數是不是 step,再問它有沒有性質。兩題都答是,才立 law;每份文檔的 `=` 列至少一條。

| 問 | 答否 | 答是 |
|---|---|---|
| 1. 有沒有任何文檔把它寫進 Steps 表當步驟?(數字列或 `=` 列) | 不是 step,不寫 law。law 要拿它當觀察點就列成 `o` 列;只給自己檔案用的支架歸內部單元測試,不標歸屬、不進分母 | 往下 |
| 2. 型別留下多少自由度?(有幾個型別正確、行為不同的實作) | 一個,不寫 law:回常數的存取子、只包一層的建構子、只是轉個名字的委派。這些由編譯器或初始狀態驗收 | 有限幾個,每個自由度一條 law;無限多(演算法決定),law 寫不變量與邊界,寫不出 `\|-` 行的部分靠 example |

介面 / trait / 抽象類別照同一套:給全專案實作或呼叫的抽象是 step,它的性質寫成 law,**一條 law、每個實作一條測試**,歸屬都標同一個 `F-00x#LAW-n`;個別實作不另寫 law。只在一個檔案裡用的不是 step。

不寫 law 的:常數與設定值、`!` 列、最外層的 I/O 函數(它們在對外 I/O 表)、只有型別層知識的東西。law 的條數不是進度,是自由度的數量。

**需求的驗收**不是 law,也不掛在 step 上,掛在「這件事達成了沒」上:一條需求一句。它講的是使用者看得到的結果,不是某個函數的性質;能寫成三行、有驗收測試最好(歸屬 `R-n#ACCEPT`,誰寫、什麼時候寫見 roles.md「驗收測試」),不能就一句可判定的話,由里程碑全部達成推得(「完成度」)。

**Examples**:表 `# | 輸入 | 輸出 | 覆蓋`,每列指到它覆蓋的 law;指不到就先補 law。每個 example 一條 example test,歸屬 `F-002#EX-1`。輸入輸出裡**不准出現真的密碼、金鑰或 token**(`lint io` 擋)。

**決定**:每條一句粗體結論、否決的替代方案、理由一句;有證據引用 ADR 全名。只裝只關這份文檔的決定:切片的決策紀錄「Decisions」裡只關這一份的,`dev-flow:scope-laws` 搬進這裡;跨文檔的留在決策紀錄,由 `dev-flow:integrate` 判要不要升 ADR。重開紀錄也寫這裡。

## 修訂(REV)

改既有文檔的簽名、laws 或層,一律改原檔,一次修訂一條 REV。**任何對既有功能的改動都修訂原檔,不另開檔。** 修訂是文檔先行:既有文檔的形狀已知,先改條文、再改測試與實作,比重做一條切片便宜。 step 在同一層內搬檔案不是修訂:`lint sig` 報「搬家」,`devflow sync` 機械更新模組欄,不寫 REV。

誰做,一句話分流:**要調整(修改、放寬、替換、刪除)既有的 law → `dev-flow:scope-laws`;law 不動、或只新增 law,而文檔或實作要變 → `dev-flow:scope-revise`;全域 Law → `dev-flow:global-laws`;需求面的條目(需求、驗收、優先、里程碑、調整)→ `dev-flow:require-design`。** **一件修訂從頭到尾只有一個修訂類的 skill(`dev-flow:scope-laws` 或 `dev-flow:scope-revise`)在跑,跑到 `verified` 為止**:不交錯、不接力,一條 REV 裝下這一件的全部。

| | `dev-flow:scope-laws` | `dev-flow:scope-revise` |
|---|---|---|
| 收什麼 | 任何一條既有的 law 要修改、放寬、替換或刪除,連同這一件修訂連帶要改的 Steps 簽名、型別、模組、Examples、新增的 law 與實作方向,一手包辦;刪除 step(連帶刪它的 law),含兩份文檔重複的 step 留一份、另一份改成引用;文檔退役;既有 example 的輸入輸出要變;還沒 `verified` 的文檔(切片那一波)的任何改動 | `verified` 的文檔,既有的 law 一條都不動:Steps 的簽名或型別要改、新增 step、step 跨層搬家、層的歸屬修正、Brief / 決定 / 描述要改、實作品質的調整(`RF-n`:效能、大小、訊息、演算法)、law 在而實作不符或行為沒有 law 守著的 bug、答案不必調整既有 law 的 GAP;過程中可以**新增** law(保護用的、效能的新上界、新 step 的)與新的 example |
| 開發者做什麼 | 看過影響範圍,對著一個選項明確說要(laws.md「影響範圍與選項」) | 看過影響範圍(「直接動到」不含任何既有的 law),確認;新增的 law 逐條拍板(laws.md「Law 怎麼談」) |
| REV 的「動到」欄 | 調整的與新增的 law、簽名、型別、step、模組、example | 只准是簽名、型別、模組、層、實作,與**新增的** `LAW-n`、`EX-n`(新增的 law 各註明首跑該紅還是該綠) |
| REV 的「保護」欄 | 這次不准變的既有 law | 這份文檔原有的每一條 law 與每一個 example |
| 收尾 | 接上 build;首跑時「動到」欄的 law 要紅;文檔回到 `verified` | 接上 build;原有的每條 law 修訂前後都成立,新增的也成立,文檔回到 `verified` |

- `dev-flow:scope-revise` 攤影響範圍時或做到一半發現**非調整既有的 law 不可**(簽名一改某條 law 的意思就跟著變、既有的 law 擋著這次要的品質、開發者看了結果要放寬一條)→ 停下並**放棄這一次修訂**:它在這一場改過的文檔與宣告還原到開工時的樣子,不留半套;整件(連同原本打算改的簽名、型別、實作)交給 `dev-flow:scope-laws <全名>`,由它一手做到 `verified`。不是「那一條 law 交過去、做完再回來」。
- 簽名或型別改名,law 三行與 Examples 裡的識別字跟著換,是**機械同步**:law 的意思一個字都不變,不算調整 law;REV 的「動到」欄註明「LAW-n 的識別字隨 `<原名>` → `<新名>` 機械同步,意思不變」。
- 目標文檔還不是 `verified`(切片那一波的 `draft` / `ready`)→ 不是 `dev-flow:scope-revise` 的事:那一波的簽名、型別與 law 都由 `dev-flow:scope-laws` 改,實作由 `dev-flow:build`。
- **刪 step**:刪掉一個有 law 的 step 等於刪既有的 law,整件走 `dev-flow:scope-laws`。兩份文檔重複的 step 留一份、另一份改成引用(「編號與引用」),也是刪 step:改成引用的那一份走 `dev-flow:scope-laws`,REV 的「動到」欄列刪掉的 step 與 law、「連動」欄寫留著的那一份。
- **文檔退役**:一份 feature 用不到了(一次性的搬遷腳本跑完了、功能下架)→ 走 `dev-flow:scope-laws <全名>`。影響範圍照列(laws.md「影響範圍與選項」):誰引用它、哪條里程碑綁它、哪條需求的驗收引用它的 law、哪些測試要一起刪。開發者確認後刪文檔、刪它的測試與程式碼,從里程碑的綁定欄、`system.md` 的 Features 表與對外 I/O 表拿掉它,編號永久空缺。還有別份引用它的 step 時,先把那幾個 step 連同 law 搬到還活著的、用得最多的那一份(引用它的各份改指過去,搬進去的與改指的各記一條 REV),再刪。為什麼退役由 `dev-flow:integrate` 寫成 ADR(「ADR」)。

```markdown
- REV-1(2026-09-12,依 qa 提問「過期判定用哪個時鐘」):過期判定改用伺服器時鐘
  - 動到:LAW-2、`refresh` 多一個 Instant 參數
  - 保護:LAW-1、LAW-3
  - 重委派:qa(LAW-2)、refactor(`refresh`)
  - 連動:F-003-invoice 的 Steps 表引用了 `refresh`,同步改
```

- 依:來源與那一句話(GAP 的提問原句、ADR 全名、`RF-n` 與它那一句、靠修訂這份文檔達成的里程碑 `M-n` 與它那一句、開發者的話、整合的仲裁選了什麼、整合時留了哪一份重複的 step)。調整(`RF-n`)一律從這裡進來:動到的每份 feature 各一條 REV,依欄寫 `RF-n`,`devflow status` 靠它算調整的進度;調整的保護一定含需求的驗收引用到的每條 law,優化不准讓需求退回未達成。
- 保護:這次不准變的既有 law;要保護的行為還不是 LAW 的,做修訂的那個 skill 先與開發者把它補成 LAW 再修訂(新增的保護用 law 列在「動到」欄,註明首跑該綠)。**沒有 law 守著的「行為不變」等於沒有保護。**
- 重委派:law 變了或新增了重派 qa,行為、簽名或型別變了重派 refactor;既有的 law 不動而簽名或型別變了,qa 只把既有測試裡的呼叫與建構改到對得上新的宣告,斷言不動,新增的 law 另寫新的測試。簽名或型別變了,做修訂的 skill 同步改程式碼裡的宣告、編得過,行為留給 refactor;修訂新增的 step,本體先是未實作標記(roles.md「首跑」)。測試只重跑 REV 點名的。
- 動到與保護只寫還在檔上的條目;`updated` 改成修訂日期。
- law 編號單調遞增,**刪掉的號永久空缺**:`lint trace` 的幽靈引用靠這條才抓得到「測試還在守一條已經不存在的 law」。
- 被引用的 step 簽名變了,引用它的每一份文檔跟著 REV;`verified` 的先重開。

## 提問(GAP)

任何角色在文檔裡讀不出唯一答案(qa 寫不出斷言、refactor 非改簽名或型別不可、law 與 law 互相矛盾):停下該項,不腦補、不與另一邊協商,其餘照做。委派期間人類決定只有這一條出口。寫在 `.design/gaps.md`:

```markdown
## GAP-1(F-002-token-refresh#LAW-2 / qa)
- 模糊點:「換發失敗不改變可用性」沒說「失敗」含不含 token 不存在
- 卡住的項目:F-002#LAW-2 的 property test 寫不出斷言
- 需要回答什麼:`refresh` 對不存在的 TokenId 回 Err 還是拋例外?
- 狀態:open
```

- 委派模式下 subagent 不寫檔:四欄寫進回報,局部序號 `本次-1`,conductor 單線寫入配號;在 build 分支上從主線的最大號往上配,整合時撞號的由整合者把後合進來的往上移(roles.md「整合」)。
- 結案 = 開發者口頭回答,照「修訂(REV)」那一句分流:答案要調整既有的 law(或文檔還沒 `verified`)由 `dev-flow:scope-laws`、答案不動既有的 law 或只要新增一條(`verified` 文檔的簽名、型別、實作)由 `dev-flow:scope-revise` 寫 REV 並刪條目,依欄帶模糊點原句;目標是一條全域 Law 的 GAP 由 `dev-flow:global-laws` 落筆後刪條目,目標是 `R-n#ACCEPT` 的由 `dev-flow:require-design`。檔空了刪檔。**不留 resolved**:定案後的問題不需要被找回。
- open 的 GAP 擋:那份文檔不算達成、`dev-flow:build` 前置不放行、`devflow status` exit 1。
- refactor 測試全綠也不得把有 open GAP 的 step 當完成。

## 完成度

`devflow status` 算,每份文檔四個數字:

| 數字 | 怎麼算 |
|---|---|
| 簽名 m / n | Steps 的步驟(數字列、`=` 列與 `!` 列)n 條;程式碼找得到且簽名對得上 m 條。`o` 列另計「觀察點 j / k」。整格還是 `<…>` 佔位符的列是模板,不算 step,警訊列「還是模板」;law 與 example 同理 |
| 未實作 s | m 條裡本體還是未實作標記的 s 條(修訂新增、還沒輪到 refactor 的 step);`devflow status` 列成待實作 |
| laws g / k | 寫了 k 條;測試宣告歸屬 j 條;綠 g 條 |
| 達成 | m = n、s = 0、觀察點全在、g = k、examples 全綠、沒有 open GAP。feature 達成 = 它與它引用的每份文檔都達成 |

往上推:

| 東西 | 怎麼判 |
|---|---|
| 里程碑達成 | 綁定的每份 feature 都達成 |
| 需求的建置進度 | 達成的里程碑 / 里程碑數;全部達成,這條需求的建置就走完。沒有里程碑的需求印「-」並列警訊 |
| 全域 Law | 三類各一列:那一道 lint 幾條不合規;契約欄指到的 law 幾條成立;領域不變量幾條成立(laws.md「全域 Law」) |
| 需求達成 | 有歸屬 `R-n#ACCEPT` 的驗收測試就以它為準;驗收寫了三行式卻沒有測試是「未知」;一句話的驗收沒有測試 = 它的里程碑全部達成(報告標「推得」),一條里程碑都沒有就未達成。達成的需求分「測試」與「推得」兩種,報告分開數。測試在而沒跑是「未知」;驗收還是模板是「未達成」。里程碑全部達成而驗收測試沒過是警訊:里程碑切漏了,或驗收寫錯,回 `dev-flow:require-design` |
| 調整達成 | 動到的每份 feature 都有一條依欄引用 `RF-n` 的 REV、都達成,而且需求仍達成。沒有任何 REV 引用它是「待修訂」;有 REV 而 feature 未達成或需求未達成是「進行中」。動到的 feature 達成而需求未達成是警訊:優化讓需求退回未達成 |

## ADR

`adr/ADR-00x-<slug>.md`,四節:情境、決定、否決的替代方案、後果。裝跨文檔、而且回不了頭的決定:選了什麼外部系統、資料怎麼存、兩條互斥的 law 怎麼裁、一份 feature 為什麼退役。

- ADR 不是 law,記的是「為什麼」。它的決定寫得成可執行形式時,約束進全域 Law(經開發者批准、由 `dev-flow:global-laws` 落筆),ADR 只留理由;law 不住在 ADR 裡。
- ADR 由 `dev-flow:integrate` 寫(`devflow claim adr <slug>`):切片做完、幾條分支要合在一起的那一刻,哪個決定真的跨文檔、真的回不了頭才看得出來。來源是決策紀錄「Decisions」表裡「可逆」欄為否、而且「跨文檔」欄為是的那幾列,與整合仲裁的結果(roles.md「整合」)。
- 走不通的切片也留一條 ADR:否決的做法與理由,日後才不會再試一次。文檔退役也留一條:為什麼退役、它的 step 搬去了哪一份。
- 只關一份文檔的決定不開 ADR,住那份文檔的「決定」。層怎麼切、語言與 adapter 直接住 `system.md`,表本身就是決定。
