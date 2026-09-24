# 工具

## CLI

一支 CLI `lawful`，入口 `bin/lawful.mjs`。`<L>` 是 plugin 根目錄：載入 skill 時給的基準目錄往上兩層（`skills/<名字>/` 的上上層），規章在 `<L>/rules/`。SKILL.md 裡寫成 `${CLAUDE_PLUGIN_ROOT}` 的就是它；被委派的角色載入自己的 skill 就拿到基準目錄。手上沒有基準目錄時才用這道找：

```bash
dirname "$(dirname "$(find ~/.claude/plugins . -maxdepth 8 -type f -path '*lawful/bin/lawful.mjs' 2>/dev/null | head -1)")"
```

之後每道指令寫解析出來的實際路徑：`node "<L>/bin/lawful.mjs" <子命令> …`，在專案根目錄（有 `.lawful/` 的那層；build 分支上就是那棵工作樹）執行。

| 子命令 | 做什麼 |
|---|---|
| `status [--tests <log> \| --run]` | 派工報告。laws 綠幾條、需求達成與否、領域不變量成立與否要有測試輸出：`--tests` 給留檔的輸出，`--run` 在專案根目錄跑「Constraint」的整套指令；兩者都沒給、或輸出裡一條歸屬標記都沒有，就列「未跑」並在開頭寫明。專案根目錄有 `.git` 時查分支，有 `build/<鍵>` 分支而且還沒合進主線的列成建構中，並從它的工作樹讀它走到哪一步 |
| `status --pipeline <P-00x>` / `--module <M>` | 一條 pipeline 的 stage 與 law 逐條狀態 / 住在該模組的所有 stage 的狀態 |
| `status --json` | 同一份報告的資料原樣輸出：願景、名詞表（`glossary`：`.lawful/vocabulary.md` 的每一列，名詞、定義、型別）、需求（一句話、驗收、優先、達成與否與來源、它依賴哪幾條需求、它的里程碑，每條里程碑是不是靠修訂達成的、REV 引用了沒）、領域不變量（成立與否與來源）、每條 pipeline（類別、stage、law、example、GAP、引用與被引用、與程式碼對不上的 stage、等哪條里程碑、住哪些模組與哪幾個單元）、模組單元（職責、宣告的層、每一層在原始碼樹裡有哪些模組、住在裡面的 pipeline 與待實作）、未登記的模組、能開的線、警訊、建議路線。數字與文字都與報告同源，給別的工具讀 |
| `status --html [檔名] [--open]` | 報告照印，另外把同一份資料畫成看板（「看板」） |
| `section <file> <節>…` | 取節 |
| `brief <skill> [<目標>] [--tests <log>] [--fingerprint] [--no-rules]` | 一個 skill 開工要的東西一次印完：它要讀的規章節，加上它在這個專案裡要看的那幾塊。哪個 skill 收哪幾種目標、拿到哪幾塊，由它自己的 SKILL.md「開工 context」寫明；給錯種類就講它收哪幾種。`--args '<一整串>'` 是 SKILL.md 注入行的寫法：目標與旗標（`--root`、`--tests`、`--no-rules`、`--fingerprint`）從那一串裡認，其餘的字不理；`--part <k> --of <N>` 只印第 k 段（整份切成每段不超過 28KB，SKILL.md 放 N 道注入行各取一段，最後一道還有沒印完的會講怎麼接著拿）。第一行是指紋，`--fingerprint` 只印它；`--no-rules` 不重印規章的節。沒指定 `--tests` 而根目錄恰好一份比每個原始碼與測試檔都新的測試輸出，status 那一塊就接上它。唯讀，永遠 exit 0，問題用文字講 |

exit code:`status` 盤點 = 驗收（有未達成的 pipeline、open GAP、需求未達成、或領域不變量不是成立即 1），`status --pipeline` / `--module` = 查得到 0、查不到 1；`lint` 一律 0 / 1；`brief` 一律 0。

## lint

| 子命令 | 紅在哪 |
|---|---|
| `lint ids` | 一檔一號：兩個檔案同號即紅；號段行讀不懂或兩段重疊即紅；有號段行時，寫了 `owner` 的 pipeline / ADR 的號要在 owner 的區間內 |
| `lint boundary` | 全域 Law 的**架構**一類：import 與簽名 vs 四層與模組單元表；types / effect / core 命中效果型別即紅；未登記模組、單元巢狀、檔不在任何一棵原始碼樹底下、所在那棵樹的層沒宣告、檔案位置對不上模組名、同一個模組名有兩個檔即紅；職責欄空的即紅；表上有而程式碼還沒有的單元或層列成訊息；非 shell 模組沒有匯出清單即紅；production 模組 import 別人的 `*.Internal` 即紅 |
| `lint sig` | Stages 簽名（含 `o` 列與 `!` 列）vs 程式碼簽名，逐字，且要在匯出清單裡；`=` 列與 `o` 列不在 shell、`!` 列在 shell、`kind: io` 恰好一列 `!`、`kind: subflow` 沒有；引用別條 pipeline 的 stage：註明「見」的那一條不存在、或它沒有這個 stage（或它自己也是引用）即紅；找不到的簽名即紅；簽名裡的型別在程式碼的宣告、import 清單點名的名字與標準函式庫都找不到即紅；stage 之間傳遞的值用了無名容器即紅，`!` 列不查；簽名一致但模組不同列「搬家」；同名簽名在兩條 pipeline 都沒註明「見」即紅 |
| `lint laws` | pipeline 的 scope law：三行齊全、種類合法、`\|-` 的識別字對得到 Stages 簽名、types 層匯出或 adapter 的標準函式庫清單（字串字面值不算識別字）、`=` 列至少被一條 law 引用、`!` 列不被引用、example 指得到 law。需求的驗收：一句話必填、不是模板；寫了三行就照同一套查，識別字可以是任何一條 pipeline 的 Stages 簽名，不准引用 `!` 列。名詞表的「型別」欄填了而程式碼裡找不到這個型別即紅，還沒有型別就寫 `-`；沒有程式碼可對就不查 |
| `lint trace` | laws / examples ↔ 測試歸屬：未翻譯、幽靈引用即紅；沒有歸屬的測試檔列成內部測試，不算紅。需求的驗收寫了三行式卻沒有 `R-n#ACCEPT` 測試即紅；一句話的沒有測試列成訊息 |
| `lint io` | 全域 Law 的**契約**一類：「契約：對外 I/O」表：方向是 in / out、pipeline 存在且是 `kind: io`、shell 模組在模組表是 shell 層且程式碼裡有、型別住 types 或 effect；每條 io pipeline 至少一列；契約欄指到的 law（`P-00x#LAW-n` 或 `INV-n`）要存在 |
| `lint invariants` | 全域 Law 的**領域不變量**一類：第一行 `INV-n [種類] 一句話`、編號不重複、種類合法、三行齊全；三行照 law 的三行式查，識別字只准 types 層的匯出、型別名與標準函式庫；沒有 `INV-n#LAW` 測試即紅 |
| `lint global` | 全域 Law 三類一次查完：`lint boundary`、`lint io`、`lint invariants`。切片離場、全域 Law 變更之後、整合合完都跑這一道 |
| `lint all` | 以上全部 |
| `sync` | 把「搬家」的 stage 模組欄改成程式碼的實際模組（同層才改，跨層列紅要走修訂） |
| `modules --gen` | 從程式碼的模組名推出模組單元與它有哪幾層，補進模組表，職責欄留白；已有的列不動 |

## 落筆指令

`.lawful/` 的編號與那幾張表只由這幾道寫；沒有哪個 skill 自己動手編號。

| 子命令 | 做什麼 |
|---|---|
| `module <名稱> [--layers <types,effect,core,shell>] [--responsibility <句>] [--facade [層]] [--dry-run]` | 劃一個模組單元：`modules.md`「模組單元」寫一列，它宣告的每一層在那棵原始碼樹裡開好資料夾，不放任何模組。名稱沒有 `.` 就接上 `Cone.md` 的模組前綴；已經在表上的單元補上缺的層，已經有的資料夾不動。層預設 `types,core`；職責沒給就提醒 `lint boundary` 會紅。`--facade` 另外建一個與單元同名的門面模組（只有 module 宣告與空匯出清單），沒指定層就開在最上層；門面只准一個，別層已經有就停下不建 |
| `claim <slug> [--description <句>] [--kind <io \| subflow>] [--milestone <M-n-slug>]` | 鑄號建 pipeline 檔 (`status: draft`)，`--kind` 填進 frontmatter（沒給就還是佔位符，`status` 列警訊），綁進 `--milestone` 那條里程碑，沒給就提醒它還不朝向任何需求；綁定寫進那條里程碑所在的需求檔。slug 是 `<領域名詞>-<動詞或動名詞>`：領域名詞對不到模組表上任何單元就停。配號看同一個 repo 的每一棵工作樹；有號段行時從 git `user.email` 對到的區間內配並寫 `owner` |
| `requirement add <slug> <一句話> --priority <1-4> [--accept <句>]` | 鑄 `R-n`，從模板建 `requirements/R-n-<slug>.md`；優先 1 最高、4 最低；驗收沒給就留佔位符並提醒。只由 `lawful:require-design` 在與開發者談過之後用 |
| `requirement milestone <R-n> <slug> <一句話> [--bind <全名,全名>] [--verify <指令>]` | 鑄 `M-n`（跨需求檔、跨工作樹唯一），以全名接在該需求檔里程碑表的最後；綁定的全名要是 `pipelines/` 裡有的 pipeline，不存在的拒絕，沒給就留「-」。`--bind` 既有的 pipeline 就是靠修訂達成的里程碑：那條 pipeline 的修訂記錄有一條 REV 的依欄引用這條里程碑才算達成，在那之前 `status` 顯示「待修訂」 |
| `invariant add <一句話> [--kind <種類>]` | 鑄 `INV-n` 寫進「全域 Law」區的「領域不變量」（沒有這一小區就補在區的最前面）；種類沒給就是 `invariant`。只在開發者批准之後、由 `lawful:global-laws` 用 |

## 看板

`lawful status --html [檔名] [--open]`：報告照印，另外把同一份資料畫成一個自帶資料的單檔網頁，結尾附上它的 `file://` 網址；沒給檔名就寫進系統暫存區的 `lawful-board/<專案資料夾名>-status.html`，不在專案裡留檔。`--open` 直接用系統預設瀏覽器打開。不連網、不起服務，瀏覽器打開就看。

可平移縮放的畫布上由上而下一棵樹：願景一張（第一段），往下一層一條需求一個區塊（優先與那一級代表什麼、驗收達成與否與來源、里程碑的達成數），再一層是里程碑（照先後排，各標它的狀態，還沒綁 pipeline 的標成還沒有切片），最底下一條 pipeline 一張便利貼、顏色是狀態。pipeline 之間的引用是另一種線，預設只在選取時出現；相依頁籤把引用與由它推出來的需求依賴畫出來。約束頁籤把 law 全部攤開，一條一張卡、顏色是測試結果：上半是全域 Law 三類（領域不變量、四層、對外 I/O 表的每一列），下半是 Scope Law、一條 pipeline 一叢；對外 I/O 的契約欄畫成指到那條 law 的箭頭，點卡看三行式與它守哪個對外 I/O。點便利貼看它的 stage 與 law 逐條、牽動誰、住哪幾個模組單元、警訊；點需求或里程碑縮放到那一叢。側欄的首頁另有一段**模組**：一個模組單元一列，層是它在原始碼樹裡的落點（還沒有程式碼的那一層淡的），列裡的 pipeline 點得進去。

## migrate

| 子命令 | 做什麼 |
|---|---|
| `migrate laws [--write]` | `Cone.md` 沒有「## 全域 Law」區、或需求寫著「- Law：」的樹：先印帳本，`--write` 才落地。`modules.md` 的「邊界」與「對外 I/O」搬進「## 全域 Law」區的「架構：四層」與「契約：對外 I/O」（對外 I/O 表補契約欄「-」），補「領域不變量」小區寫「無」；需求的「- Law：」改成「- 驗收：」、需求的「- 蘊含：」刪掉；只有 `M-n` 的里程碑補英文名（從第一條綁定的 pipeline 的 slug 推）；`status: frozen` 改成 `verified`；`.lawful/spikes/` 列成人要判的清單。測試裡的歸屬標記不動 |
| `migrate cone [--write]` | 只有 `system.md` 的樹，換成 `Cone.md` 體系：先印帳本，`--write` 才落地。願景與目的併成「願景」、「語言與工具」節的內容進「Constraint」、邊界與對外 I/O 收進「全域 Law」區、Pipelines 表的類別寫進各 pipeline 的 `kind`、里程碑補英文名，最後刪 `system.md`；需求面的條目接著跑 `migrate requirements` 收進 `requirements/` |
| `migrate requirements [--write]` | 需求不住 `requirements/` 的樹、或需求檔裡除了里程碑表還有別張表的樹：先印帳本，`--write` 才落地。每條需求寫成一個 `requirements/R-n-<slug>.md`（一句話、驗收、優先、里程碑表），`Cone.md` 只留願景、全域 Law 與 Constraint 三節，每條 pipeline 的 `kind` 寫成 `io` 或 `subflow`；需求檔裡里程碑表以外的那張表，每一列換成里程碑表最後的一列（配新的 `M-n`，綁定那一列點名的 pipeline），各條 pipeline 修訂記錄的依欄裡引用那一列的編號跟著換成新的 `M-n`，那張表刪掉，帳本逐列印對照；帳本另列人要判的：里程碑串接的順序對不對（或者該拆成兩條需求）、沒有里程碑的需求、無處可去的里程碑、沒有英文名的里程碑。與 `migrate laws`、`migrate cone` 可以接連跑，先後都行 |
| `migrate vocabulary [--write]` | 名詞表住在專案根目錄 `CLAUDE.md`「## 名詞」節的樹：先印帳本，`--write` 才落地。整節搬進 `.lawful/vocabulary.md`（標題寫成「名詞」、內容照抄），`CLAUDE.md` 那一節換成一行 `@.lawful/vocabulary.md`，其餘不動；已經有 `vocabulary.md` 就停，兩邊怎麼合由人判。與其他 migrate 互不相干，先後都行 |
| `migrate from-dev-flow <.design> [--write <file>] [--ignore <dir,dir>]` | 盤點 `subsystems/<slug>/` 體系的 `.design`，印一份帳本，不改任何檔：每份 F / E / G-* 的介面簽名在程式碼裡對到幾條、四格 law 翻成三行草稿（散文的標「需形式化」）、按簽名所在模組分組並建議 `claim` 的 slug、開發階段表列成需求與里程碑候選、退場清單、人要判的清單。分組、需求與里程碑怎麼綁、law 形式化由人做 |

## status 報告

給開發者讀的派工報告，版面固定。第一行印願景的第一段（還是模板就不印，列警訊），第二行是數字（需求、已驗收幾條、等人工審核幾條、有待重審的再印待重審幾條；領域不變量與成立數；里程碑、io pipeline、pipeline、模組單元、待實作 stage、open GAP）；接著四張表：

- **需求**：先一行優先各級的意思（pipelines.md「願景、需求與里程碑」），再每條需求一列（需求、優先、一句話、**審核**：已驗收 / 待審核 / 待重審 / 建構中 / 未知 / 未達成與判定來源、**依賴**、里程碑總數、里程碑達成、完成度），照優先、需求編號排。「依賴」欄從 pipeline 的引用推，沒有依賴印「-」；表後每條沒達成的需求一行「下一條里程碑」，附綁定的 pipeline 各在什麼狀態，還沒綁的寫成還沒有切片與開它的命令，靠修訂達成而還沒有 REV 引用它的寫成待修訂與修訂它的命令；最後一行列沒有被任何里程碑綁定的 pipeline。**這一段答的是「必須達成的事達成了沒」**
- **全域 Law**：先一張表，三類各一列（住哪一小區、哪一道 lint、現在的結果：幾條不合規、契約欄指到的 law 幾條成立、領域不變量幾條成立；沒給測試輸出時成立數印 `nan`）；再一張表，領域不變量每條一列（種類、一句話、成立 / 未成立 / 未知與判定來源），一條都沒有印「無」。三個小區是空的是正常的，照樣印 0 列、0 條與通過，不列警訊。**這一段答的是「不得違反的約束有沒有被踩到」**
- **pipelines**：每條 pipeline 一列（類別、status、簽名、未實作、law、狀態）
- **模組**：每個模組單元一列（職責、宣告的層、還沒有程式碼的層、住在這裡的 pipeline、stage 幾個、待實作幾個），表下兩行列還沒有任何 stage 住進去的單元、以及程式碼有而模組表沒有的模組。**這一段答的是「東西住在哪」**

然後七段：

1. **今天能開幾條線**：兩種。build 開得了的 pipeline(`lawful:build`):`ready`、沒 open GAP、每個 stage 在程式碼裡（在、搬家或未實作，沒有找不到或不一致的）、引用的 pipeline 全部達成、綁它的里程碑是所在需求下一條還沒達成的（任何一條需求的下一條里程碑綁它就算；沒被綁的不受這條限制）——build 對帳那一步會停的事都在這裡先擋，每條附它綁在哪條需求的哪條里程碑；每條需求下一條還沒達成、還沒有切片、有英文名的里程碑 (`lawful:spike-impl`)，一條需求一次只列這一條。都照需求的優先排。**專案的第一條切片單獨走完**：三個小區都還是空的、而且已經有一條切片的分支在建構中時，別的切片不列成能開的線，改印一句「專案的第一條切片單獨走完：build/<鍵> 抽出全域 Law 並合進主線之後才開下一條」，後面附等著的里程碑。有 `build/<鍵>` 分支而且還沒合進主線的列成建構中，不算能開，後面附它走到哪一步——還沒有決策紀錄是切片中、有決策紀錄而里程碑還沒綁 pipeline 是切片完成、綁的 pipeline 有 `draft` 是 Law 討論中、都拍板而 law 還沒有測試歸屬是 Law 已定、有歸屬而還有紅是調整中、都 `verified` 是 qa 與 refactor 做完、每條 law 成立是等整合；全部從那棵工作樹的檔案推，沒有人手寫。已經合進主線的分支是殘留，不擋任何線。兩條能開的線的 stage 住同一個模組單元，附一行提示
2. **卡住的**：停在 GAP 的 stage、等重派、等被引用的 pipeline（它還是 `draft`、卡 GAP、建構中、或還不存在）、`ready` 而有 stage 與程式碼對不上的 pipeline（找不到或不一致：列出哪幾個，宣告由寫這條的 skill 補——切片那一波 `lawful:scope-laws`，修訂新增的 stage `lawful:scope-revise`——不在 build 補）、綁在所在需求後面幾條里程碑的 pipeline（等前面那一條達成，附是哪一條）
3. **等決定**：證據齊了等人工審核的需求（每條一段：那一句話、驗收那一句、證據是哪幾條、怎麼驗——建置指令接每條里程碑的怎麼驗欄、最後看驗收那一句成不成立——與認可的那道 `lawful requirement accept` 指令；待重審的同樣列）、open 的 GAP、`draft` 的 pipeline
4. **牽動誰**：誰引用了這條的簽名
5. **待實作**：按模組單元分組，單元底下再按模組列找不到的 stage、本體還是未實作標記的 stage
6. **警訊**：沒有名詞表（提示 `lawful:kickoff` 建）、名詞表還住在 `CLAUDE.md` 的「## 名詞」節（提示 `migrate vocabulary`）、專案根目錄的 `CLAUDE.md` 沒有一行 `@.lawful/vocabulary.md`（提示 `lawful:kickoff` 補上）、同一個名詞出現兩列、`Cone.md` 不存在（只有 `system.md` 的樹提示 `migrate cone`）、`Cone.md` 沒有「## 全域 Law」區或需求寫著「- Law：」（提示 `migrate laws`）、需求不住 `requirements/`、需求檔裡除了里程碑表還有別張表（都提示 `migrate requirements`）、願景還是模板、沒有需求、需求沒有優先或優先不在 1 到 4、需求檔沒有 frontmatter 或檔名與 frontmatter 對不上、需求沒有里程碑、需求或它的驗收還是模板、驗收寫了三行卻沒有驗收測試、里程碑全部達成而驗收沒過、全域 Law 三類各自那一道 lint 有不合規、領域不變量未成立、領域不變量沒有測試（三個小區是空的不是警訊）、里程碑沒有英文名、里程碑綁到不存在的 pipeline、里程碑編號重複、pipeline 沒有被任何里程碑綁定、`kind` 缺或還是模板或不合法、`verified` 而紅、REV 沒重開紀錄、未登記模組、簽名不一致、GAP 編號重複、`build/<鍵>` 分支已合進主線卻還在、還是模板（claim 建出來的檔還留著 `<…>` 佔位符的 Stages / Laws / Examples 列；這些列不算 stage、law、example，不進任何數字）
7. **建議路線**：從最高優先的需求第一條沒達成的里程碑推。先回答 GAP（照 laws.md「分流」）、再 build 能開的線（只有第 1 段那幾條，照需求的優先、里程碑順序排，每條附需求與里程碑；等別條的、等前一條里程碑的不列，它們在第 2 段）、`ready` 而有 stage 與程式碼對不上的先補宣告（寫這條的 skill 補，補上才 build）、`draft` 的 pipeline 照需求的優先排，走 `lawful:scope-laws` 把 Law 談完（這棵樹沒有它的切片——沒有決策紀錄、也沒有它或綁它的里程碑的分支——就改走那條里程碑的 `lawful:spike-impl`:scope-laws 的前置要切片）、還沒有切片的里程碑走 `lawful:spike-impl`（先收在途的，再開新的；專案的第一條切片還在建構中時這幾條換成那一句）、待修訂的里程碑照「分流」、里程碑全部達成而驗收寫了三行卻沒有驗收測試的需求、寫了三行卻沒有測試的領域不變量走 `lawful:build R-n` / `INV-n`（只派 qa）、**證據齊了的需求請開發者親自審核**（認可了才 `lawful requirement accept R-n`；機器到此為止）。沒有可派的線時分三種：pipeline 全部達成而某條需求不是已驗收或某條領域不變量不是成立，寫哪一條與判定來源，先補上；全部達成且每條需求已驗收、每條領域不變量成立寫「目前功能全部正常運作，可以加新功能」；沒達成寫哪幾條沒達成、缺什麼輸入，不催加新功能

分母是 `pipelines/` 的檔數與其中 `kind: io` 的條數，`Cone.md`「全域 Law」區領域不變量的條數，`requirements/` 的檔數與各檔的里程碑數，以及 `modules.md` 的模組單元數。

## language adapter

`Cone.md` 的 `language` 選 adapter；語言相關的事全部走 adapter，讀取層不認識任何語言：

| adapter 提供 | 用在 |
|---|---|
| `signatures(file)`：頂層簽名（名字、型別文字、模組） | `lint sig`、`status` |
| `exports(file)`：匯出清單；沒寫回 null | `lint sig`、`lint boundary` |
| `typeNames(file)`：宣告的型別名 | `lint sig`、`lint io`、`lint invariants` |
| `importedTypes(file)`:import 清單裡點名的型別名 | `lint sig` |
| `dataConstructors(file)`:`data` / `newtype` 的建構子名；簽名裡升格的 `'Ctor` 對它查 | `lint sig` |
| `stubs(file)`：本體還是未實作標記的名字 | `status` |
| `imports(file)`:import 的模組 | `lint boundary` |
| `isEffectful(signature, extra)`：簽名是否碰到效果；`extra` 是 `Cone.md` 追加的效果型別 | `lint boundary` |
| `effectTypes`、`ioModules`：預設效果型別、預設 IO 模組黑名單 | `lint boundary` |
| `testMarkers(file)`：測試檔裡的歸屬 | `lint trace`、`lint invariants` |
| `testResults(log)`：測試輸出 → 每個歸屬標記綠 / 紅 / pending | `status` |
| `stdlib`:law 裡可直接用的標準函式庫函數 | `lint laws`、`lint invariants` |
| `stub(marker)`：帶 `P-00x#name` 的未實作標記 | 修訂新增的 stage 的本體 |
| `modulePath(module)`：模組名 → 它在自己那棵原始碼樹底下的相對路徑 | `lint boundary`、`module --facade` |
| `moduleFile(module)`：一個只有 module 宣告與空匯出清單的新檔 | `module --facade` |

Haskell adapter:`.hs`；簽名認欄位 0 的頂層簽名（含運算子、多行）、record 欄位（存取子型別 `Record -> 欄位型別`，Stages 表照這個寫）、`class` 底下的方法；不認 `instance` 底下的方法與函數本體 `where` 裡的區域函數；匯出清單認 `Foo (..)`、`Foo (a, b)`、`(<+>)`、`module X`；型別名認 `data` / `newtype` / `type` / `class` 的宣告頭（可以跨行），context 不論是一個約束、括號包住的一串、還是沒括號的多參數約束 (`class Each Show ss => Stamped ss`) 都先去掉，名字是 `=>` 後面的那一個；import 清單點名的型別名認 `import M (T, U (..))`（清單可以跨行），整個模組 import 進來的與 `hiding` 不認，那種寫法的外部型別要在清單裡點名或帶模組前綴；建構子認 `data` / `newtype` 的 `=` 與 `|` 右邊與 GADT `where` 底下的 `Ctor ::`，簽名裡 DataKinds 升格的 `'Ctor` 對它查；效果型別 `IO`、`IOE`、`MonadIO`、`MonadUnliftIO`、`STM`、`IORef`、`MVar`、`TVar`、`TMVar`、`Chan` 出現在簽名即效果；歸屬只認字串字面值 `"P-00x#LAW-n"`、`"P-00x#EX-n"`、`"R-n#ACCEPT"`、`"INV-n#LAW"`；測試輸出認 hspec(specdoc) 與 tasty 兩種版面，標記可以是群組名或單一測試名；未實作標記 = `error "P-00x#name not implemented"`，本體只有一個 `error "…"` 呼叫或 `undefined` 的都算未實作；模組名的每一段是一層資料夾、最後一段加 `.hs`，前面接它那一層的原始碼根目錄；四棵樹在 `.cabal` 裡各是一個 sub-library，`build-depends` 只往下一層宣告。沒有 adapter 的語言：`lint sig` 與 `lint boundary` 印「此語言尚無 adapter」跳過，其餘照常。

## 跑東西的紀律

測試、建置、lint 都照三道關：

1. **該不該跑**：輸出會改變接下來做什麼才跑。不拿測試判「文檔與程式碼哪邊過期」（看 `updated` 與原始碼）；不為了回報裡的一個數字而跑。
2. **是不是重跑**：輸入沒變就沿用上次輸出並寫「沿用」。有變只跑涵蓋得到改動的範圍；整套一個迴圈一次。
3. **輸出留檔**：`<指令> > <log> 2>&1; tail -20 <log>`，之後從檔案 grep。同一道指令連續失敗兩次，第三次前先換做法。

## 收尾定錨

每個 skill 的收尾，回報最後附這四段，不超過一個畫面。委派模式的 subagent 不輸出。

1. **位置樹**：願景一行 → 全域 Law 一行（三類各有沒有紅）→ 每條需求一行（優先、達成 / 未達成 / 未知、里程碑達成 n / m）→ 每條里程碑一行（達成 / 進行中 / 待修訂 / 未開工）→ 綁定的 pipeline → 目前 pipeline 展開到 stage 與 law，各標簽名在不在、law 綠不綠；它引用到的 pipeline 掛在它底下；沒被任何里程碑綁定的 pipeline 掛在最後的「沒有需求」底下。目前節點標 `◀ 目前`。全部寫全名。
2. **完成度**三行：需求（最高優先還沒達成的需求 R-n · 里程碑達成 n / m · 驗收達成與否；全域 Law 三類有沒有紅）、產品（io pipeline 達成 n / m · pipeline 達成 n / m · 待實作 stage n）、本次（目前 pipeline 簽名 m / n · laws g / k）。數字只來自 `lawful status` 與實際跑過的測試；沒跑寫「沿用 <哪一次>」或「未跑」。
3. **主軸檢查**：本次對應哪條需求的哪條里程碑、哪條 pipeline 的哪個 stage 或 law；偏離清單，每條附位置與建議，沒有寫「無」。偏離指：做的事不在任何里程碑的範圍裡、靠修訂達成的里程碑的 REV 依欄沒有寫它的全名、比最高優先需求的里程碑先做了低優先的、同一條需求同時開了兩條里程碑、簽名與 Stages 不符、import 越層、core 碰了效果、測試後門、未登記模組、open GAP、切片裡有假的東西沒記進決策紀錄、law 只是在描述程式碼現在做了什麼、在 laws.md「分流」指定的 skill 之外改了 law 或需求、一件修訂由兩個修訂類的 skill 交錯著做、同一個 stage 與它的 law 在兩條 pipeline 各寫了一次而沒有一邊改成引用。
4. **下一步**：一條具體命令（參數寫全名），附下面四題的答案；最多兩條替代，各附同四題，外加一句為什麼不是第一。下一步必須從樹上推得出來。
   - **必要性**：不做它，樹上哪條需求停在哪條里程碑、哪條 pipeline 的哪個 stage 或 law、哪條功能因此無法正常運作。答不出具體的一條與一格，它就不是下一步，也排不進替代。
   - **替代為什麼排後面**：需求的優先較低、等一個決定、等被引用的那一條先達成、只是清警訊；寫明是哪一個。
   - **需求來源**：這條命令對到位置樹的哪條需求與哪條里程碑、警訊表的哪一列、`gaps.md` 的哪一條、或開發者的哪一句話。都對不到的是自己長出來的需求，不列。
   - **架構缺口**：重切 pipeline、把 stage 搬到另一條 pipeline、改層、換效果型別或外部系統這類架構級動作，只能因為現在的架構解決不了一個具體問題才提；寫出那個問題。寫不出來就不提。
   - **全部正常時**：每條 pipeline 達成、每條需求都經開發者親自驗收、全域 Law 三類沒有紅、每條領域不變量成立、測試全綠、沒有 open GAP、警訊為空，明寫「目前功能全部正常運作，沒有非做不可的事，可以加新功能」，下一步是 `lawful:require-design`（新需求，或既有需求底下的新里程碑）再 `lawful:spike-impl <M-n-slug>`；不另造下一步。
