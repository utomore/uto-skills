# 工具

## CLI

一支 CLI `devflow`,入口 `bin/devflow.mjs`。`<D>` 是 plugin 根目錄:載入 skill 時給的基準目錄往上兩層(`skills/<名字>/` 的上上層),規章在 `<D>/rules/`。被委派的角色從 conductor 的 prompt 拿 `<D>` 的實際路徑。手上沒有基準目錄時才用這道找:

```bash
dirname "$(dirname "$(find ~/.claude/plugins . -maxdepth 8 -type f -path '*dev-flow/bin/devflow.mjs' 2>/dev/null | head -1)")"
```

之後每道指令寫解析出來的實際路徑:`node "<D>/bin/devflow.mjs" <子命令> …`,在專案根目錄(有 `.design/` 的那層)執行。

| 子命令 | 做什麼 |
|---|---|
| `status [--tests <log> \| --run]` | 派工報告。laws 綠幾條、需求達成與否、領域不變量成立與否要有測試輸出:`--tests` 給留檔的輸出,`--run` 在專案根目錄跑 `system.md` 的整套指令;兩者都沒給、或輸出裡一條 `F-00x#LAW-n` 標記都沒有,就列「未跑」並在開頭寫明。多語言專案每側一份輸出:`--tests <目錄>=<log>,<目錄>=<log>`,目錄是 `language` 欄宣告的,指到沒宣告的目錄就不讀;只給一份輸出就每一側的 adapter 都掃它一遍;`--run` 照整套指令每側各跑一道、各用自己的 adapter 掃。專案根目錄有 `.git` 時查分支,有 `build/<鍵>` 分支而且它還沒合進主線的線列成建構中(鍵是里程碑全名、文檔全名或 `R-n` / `INV-n`);分支有工作樹就從那棵樹的檔案推它走到哪一步(「status 報告」) |
| `status --doc <F-00x>` / `--module <路徑>` | 一份文檔的 step 與 law 逐條狀態 / 住在該檔案或目錄的所有 step 的狀態 |
| `status --json` | 同一份報告的資料原樣輸出:願景、名詞表(`glossary`:專案根目錄 `CLAUDE.md`「## 名詞」節的每一列,名詞、定義、型別)、需求(一句話、驗收、優先、達成與否與來源、它依賴哪幾條需求、它的里程碑,每條里程碑是不是靠修訂達成的、REV 引用了沒)、領域不變量(成立與否與來源)、每份文檔(step、law、example、GAP、引用與被引用、模組)、能開的線、警訊、建議路線。數字與文字都與報告同源,給別的工具讀 |
| `status --html [檔名] [--open]` | **報告照印**,另外把同一份資料畫成看板,寫成一個自帶資料的單檔網頁,結尾附上它的 `file://` 網址;沒給檔名就寫進系統暫存區的 `devflow-board/<專案資料夾名>-status.html`,不在專案裡留檔。`--open` 直接用系統預設瀏覽器打開。可平移縮放的畫布上由上而下一棵樹:願景一張(第一段),往下一層一條需求一個區塊(寫優先與那一級代表什麼、驗收達成與否與來源、里程碑的達成數),再一層是里程碑(照先後排,各標它的狀態,還沒綁 feature 的標成還沒有切片),最底下一份文檔一張便利貼、顏色是狀態。文檔之間的引用是另一種線,預設只在選取時出現;相依頁籤把引用與由它推出來的需求依賴畫出來。點便利貼看它的 step 與 law 逐條、牽動誰、警訊;點需求或里程碑縮放到那一叢。不連網、不起服務,瀏覽器打開就看 |
| `claim feature\|adr <slug> [--description <句>] [--milestone <M-n-slug>]` | 鑄號建檔(feature 是 `status: draft`);feature 另在 `system.md` Features 表加一列並綁進 `--milestone` 那條里程碑(給全名 `M-n-<slug>`),沒給就提醒它還不朝向任何需求;綁定寫進那條里程碑所在的需求檔。配號看同一個 repo 的每一棵工作樹,別條 build 分支上 claim 走的號不重配;`system.md` 有號段行時,號從 git `user.email` 對到的區間內配並寫 `owner`(features.md「編號與引用」) |
| `requirement add <slug> <一句話> --priority <1-4> [--accept <句>]` | 鑄 `R-n`,從模板建 `requirements/R-n-<slug>.md`(slug 是 kebab-case 英文,講這條需求要得到什麼);優先 1 最高、4 最低;驗收沒給就留佔位符並提醒。只由 `dev-flow:require-design` 在與開發者談過之後用 |
| `requirement milestone <R-n> <slug> <一句話> [--bind <全名,全名>]` | 鑄 `M-n`(全資料夾唯一,跨需求檔、跨工作樹),以全名 `M-n-<slug>` 接在該需求檔里程碑表的最後;slug 是 kebab-case 英文,切片的分支與決策紀錄以全名為鍵;綁定的全名要是 `features/` 裡有的 feature,不存在的拒絕,沒給就留「-」。`--bind` 既有的 feature 就是靠修訂達成的里程碑(features.md「願景、需求與里程碑」):那份 feature 的修訂記錄有一條 REV 的依欄引用這條里程碑才算達成,在那之前 `status` 顯示「待修訂」 |
| `invariant add <一句話> [--kind <種類>]` | 鑄 `INV-n` 寫進 `system.md`「全域 Law」區的「領域不變量」(區裡沒有這一小區就補在區的最前面);種類沒給就是 `invariant`。只在開發者批准之後、由 `dev-flow:global-laws` 用(laws.md「全域 Law」) |
| `lint ids` | 一檔一號:兩個檔案同號即紅;號段行讀不懂或兩段重疊即紅;有號段行時,寫了 `owner` 的 feature / ADR 的號要在 owner 的區間內 |
| `lint boundary` | 全域 Law 的**架構**一類。import 方向 vs 層表;內層 import 外層即紅;非最外層 import IO 模組即紅;未登記與幽靈檔案即紅 |
| `lint sig` | Steps 簽名(含 `o` 列與 `!` 列)vs 程式碼簽名,而且要匯出;`=` 列與 `o` 列不在最外層、`!` 列在最外層、恰好一列;引用別份文檔的 step:註明「見」的那一份不存在、或它沒有這個 step(或它自己也是引用)即紅,同名簽名在兩份文檔都沒註明「見」即紅(features.md「編號與引用」);找不到的簽名即紅;簽名裡的型別在程式碼與標準函式庫都找不到即紅;step 之間傳遞的值用了無名容器(`dict`、`any`、`interface{}` …)即紅,`!` 列不查;簽名一致但檔案不同列「搬家」 |
| `sync` | 把「搬家」的 step 模組欄改成程式碼裡的實際檔案(同層才改,跨層列紅要走 REV:`dev-flow:scope-revise`) |
| `lint laws` | 文檔的 scope law:三行齊全、種類合法、`\|-` 的識別字對得到 Steps 簽名 / 最內層匯出 / 型別名 / 標準函式庫 / `system.md` 的詞彙追加、`=` 列至少被一條 law 引用、`!` 列不被引用、example 指得到 law。需求的驗收:一句話必填、不是模板;寫了三行就照同一套查,識別字可以是任何一份文檔的 Steps 簽名,不准引用 `!` 列。名詞表(專案根目錄 `CLAUDE.md` 的「## 名詞」節):「型別」欄填了而程式碼裡找不到這個型別即紅,還沒有型別就寫 `-`;沒有程式碼可對就不查 |
| `lint trace` | laws / examples ↔ 測試歸屬:未翻譯、幽靈引用即紅;沒有歸屬的測試檔列成內部測試,不算紅。需求的驗收寫了三行式卻沒有 `R-n#ACCEPT` 測試即紅;一句話的沒有測試列成訊息 |
| `lint io` | 全域 Law 的**契約**一類。對外 I/O 表:方向、feature 存在且是 feature、模組在最外層且程式碼裡有、信任欄、`untrusted` 的入口有驗證 step、契約欄指到的 law 存在;文檔的秘密字面值;最外層沒登記的出入口 |
| `lint invariants` | 全域 Law 的**領域不變量**一類:第一行 `INV-n [種類] 一句話`、編號不重複、種類合法;寫了三行就照 law 的三行式查,識別字只准最內層的匯出、型別名與標準函式庫;寫了三行卻沒有 `INV-n#LAW` 測試即紅,只有一句話的列成訊息 |
| `lint global` | 全域 Law 三類一次查完:`lint boundary`(架構)、`lint io`(契約)、`lint invariants`(領域不變量)。切片離場、全域 Law 變更之後、整合合完都跑這一道 |
| `lint all` | 以上全部 |
| `modules --gen` | 從程式碼補模組表缺的檔案,層欄留白 |
| `section <file> <節>…` | 取節 |
| `brief <skill> [<目標>] [--tests <log>] [--fingerprint] [--no-rules]` | 一個 skill 開工要的東西一次印完:它要讀的規章節,加上它在這個專案裡要看的那幾塊——`.design/` 現在有哪些檔、`system.md` 全份與 `modules.md`(kickoff);`system.md` 全份、每個需求檔與 status 報告(require-design);分支與工作樹、`system.md` 全份、每個需求檔、`modules.md`、`gaps.md`、`lint global` 與 status 報告(global-laws);分支與工作樹、`.design/` 現在有哪些檔、里程碑的需求檔全文、`system.md` 全份、`modules.md` 與 status 報告(spike-impl);分支與工作樹、`system.md` 全份、決策紀錄,目標是里程碑時加上 `.design/` 現在有哪些檔、它的需求檔全文、`modules.md`、它綁的每一份文檔的全文與逐條狀態,目標是文檔時加上文檔全文、逐條狀態、Steps 上每條簽名與型別的宣告(`檔案:行號` 與原文,不含本體)、引用與被引用的文檔全文、它朝向的里程碑連同需求檔全文、`gaps.md`、`lint sig` 與 `lint laws`、status 報告(scope-laws);分支與工作樹、目標文檔全文、逐條狀態、宣告、引用與被引用的文檔全文、它朝向的里程碑連同需求檔全文、`modules.md`、`gaps.md`、`lint sig` 與 `lint laws`、status 報告(scope-revise);分支與工作樹、`system.md`「語言與工具」、`gaps.md`、測試輸出新不新、status 報告,目標是文檔時加上 `modules.md`、決策紀錄、文檔全文、逐條狀態、`lint sig` 與 `lint laws`,目標是里程碑時加上 `modules.md`、決策紀錄、它的需求檔全文、它綁的每一份文檔的全文與逐條狀態、`lint sig` 與 `lint laws`,目標是 `R-n` / `INV-n` 時加上那一條的三行(build);目標文檔全文、逐條狀態、宣告(目標是 `R-n` / `INV-n` 時是那一條的三行,需求的驗收再加上它引用到的文檔的 Steps 與宣告)、最內層(行數上限以內的全文,其餘列匯出)、這個專案的測試怎麼寫(qa);目標文檔全文、逐條狀態、宣告、要開的檔(refactor);分支與工作樹、決策紀錄清單、「語言與工具」、`gaps.md`(integrate);「語言與工具」與測試輸出新不新(status);`lint all`、每個需求檔、status 報告、`modules.md`(audit);`.design/` 現在有哪些檔、「語言與工具」與 `modules.md`(study)。目標是文檔全名、里程碑全名 `M-n-<slug>`、`R-n` / `INV-n`,或不給,依 skill 而定;給錯種類就講它收哪幾種。每份 SKILL.md 的「開工 context」在載入時自動執行它,輸出直接是 skill 內容的一部分;那裡的寫法是 `--args '<載入時的整串參數>'`,目標與旗標從那一串裡認,其餘的字不理。第一行是指紋 `brief <skill> <目標> @doc:<雜湊> rules:<雜湊>`,`--fingerprint` 只印它(conductor 對帳用);`--no-rules` 不重印規章的節(同一場裡重跑用);`--tests` 接上測試輸出,status 報告那一塊才有紅綠。唯讀,永遠 exit 0,問題用文字講 |
| `migrate laws [--write]` | `system.md` 沒有「## 全域 Law」區、或需求寫著「- Law:」的樹:先印帳本,`--write` 才落地。「層」「對外 I/O」「領域不變量」三節收進「## 全域 Law」區的三個小區(缺的先寫「無」)、需求的「- Law:」改成「- 驗收:」、需求的蘊含說明刪掉;測試裡的歸屬標記不動 |
| `migrate requirements [--write]` | 需求不住 `requirements/` 的樹(`system.md` 有「## 需求」節)、或需求檔裡除了里程碑表還有別張表的樹:先印帳本,`--write` 才落地。每條需求寫成一個 `requirements/R-n-<slug>.md`(一句話、驗收、優先、里程碑表),`system.md` 的「## 需求」節整節刪掉;需求檔裡里程碑表以外的那張表,每一列換成里程碑表最後的一列(配新的 `M-n`,綁定那一列點名的 feature),各份 feature 修訂記錄的依欄裡引用那一列的編號跟著換成新的 `M-n`,那張表刪掉,帳本逐列印對照;帳本另列人要判的:里程碑串接的順序對不對(或者該拆成兩條需求)、沒有里程碑的需求、無處可去的里程碑、沒有英文名的里程碑。與 `migrate laws` 可以接連跑,先後都行 |
| `migrate <.design>` | 盤點 `subsystems/` 體系的 `.design`,印一份帳本,不改任何檔:每份任務文檔的介面在程式碼裡對到幾條、四格 law 翻成三行草稿、共用的簽名列出來(只住一份文檔,別份引用)、退場清單、人要判的清單 |

exit code:`status` 盤點 = 驗收(有未達成的文檔、open GAP、需求未達成、或領域不變量不是成立即 1),`status --doc` / `--module` = 查得到 0、查不到 1;`lint` 一律 0 / 1。

## status 報告

給開發者讀的派工報告,版面固定。第一行印願景的第一段(還是模板就不印,列警訊),第二行是數字(需求與達成數,達成的再分測試幾條、推得幾條;領域不變量與成立數;里程碑、feature、文檔、待實作 step、open GAP);接著三張表:

- **需求**:先一行 `system.md`「語言與工具」宣告的優先各級,再每條需求一列(需求、優先、一句話、驗收達成 / 未達成 / 未知與判定來源、**依賴**、里程碑總數與達成數、完成度),照優先、需求編號排。「依賴」欄列這條需求疊在哪幾條需求上面:它不是手寫的欄位,從文檔的引用推——這條需求的里程碑綁的文檔引用了別條需求的里程碑綁的文檔,或綁了別條需求的里程碑先綁過的文檔,它就依賴那一條(features.md「願景、需求與里程碑」);互不依賴的需求可以同時開工,沒有依賴印「-」;表後每條需求一段,列它的里程碑(照先後,各自達成與否,附綁定的文檔各在什麼狀態,還沒綁的寫成還沒有切片與開它的命令,靠修訂達成而還沒有 REV 引用它的寫成待修訂與修訂它的命令);最後一行列沒有被任何里程碑綁定的 feature。**這一段答的是「必須達成的事達成了沒、我們有沒有朝向需求」**
- **全域 Law**:先一張表,三類各一列(住 `system.md`「全域 Law」區的哪一小區、哪一道 lint 自動確認、現在的結果:幾條不合規、契約欄指到的 law 幾條成立、領域不變量幾條成立;沒給測試輸出時成立數印 `nan`);再一張表,領域不變量每條一列(種類、一句話、成立 / 未成立 / 未知與判定來源),一條都沒有印「無」。**這一段答的是「不得違反的約束有沒有被踩到」**
- **文檔**:每份文檔一列

然後八段:

1. 今天能開幾條線:兩種。`ready`、沒 open GAP、引用的文檔全部達成的文檔(`dev-flow:build`),每條附它綁在哪條需求的哪條里程碑;每條需求下一條還沒達成、還沒有切片、有英文名的里程碑(`dev-flow:spike-impl`),一條需求一次只列這一條。都照需求的優先排。專案根目錄有 `.git` 時查分支:有 `build/<鍵>` 分支而且它還沒合進主線的列成建構中,不算能開,後面附它走到哪一步——還沒有決策紀錄是切片中、有決策紀錄而里程碑還沒綁文檔是切片完成、綁的文檔有 `draft` 是 Law 討論中、都拍板而 law 還沒有測試歸屬是 Law 已定、有歸屬是調整中、都 `verified` 是 qa 與 refactor 做完、每條 law 成立,等整合;全部從那棵工作樹的檔案推,沒有人手寫。已經合進主線的分支是殘留,不擋任何線。兩條能開的線的 step 住同一個檔案,附一行提示:同時開,整合時那個檔案兩邊都動
2. 卡住的:停在 GAP 的 step、等重派、等被引用的文檔(它還是 `draft`、卡 GAP、建構中、或還不存在)
3. 等決定:open 的 GAP、`draft` 的文檔(Law 還沒談完)
4. 牽動誰:誰引用了這份的簽名
5. 待實作:按檔案列找不到的 step、本體還是未實作標記的 step
6. 修訂熱點:REV 條數最多的三份與最後一條、被兩份以上引用的文檔。**這一段答的是穩定度**:一直在改的地方就是設計還沒收斂的地方
7. 警訊:願景還是模板、專案根目錄的 `CLAUDE.md` 沒有「## 名詞」節(檔案不存在也算;提示 `dev-flow:kickoff` 補上)、同一個名詞在名詞表出現兩列、需求不住 `requirements/`、需求檔裡除了里程碑表還有別張表(都提示 `migrate requirements`)、沒有需求、`system.md` 沒有「## 全域 Law」區(提示 `migrate laws`)、優先各級代表什麼沒有宣告、需求沒有優先或優先不在 1 到 4、需求檔沒有 frontmatter 或檔名與 frontmatter 對不上、需求沒有里程碑、需求或它的驗收還是模板、驗收寫了三行卻沒有驗收測試(達成與否未知)、里程碑全部達成而驗收沒過(里程碑切漏了,或驗收寫錯)、全域 Law 三類各自那一道 lint 有不合規、領域不變量未成立(有程式碼違反了它)、還沒有三行式或寫了三行卻沒有測試、里程碑沒有英文名、里程碑綁到不存在的檔、里程碑編號重複、feature 沒有被任何里程碑綁定、`verified` 而紅、REV 沒重開紀錄、簽名不一致、GAP 編號重複(兩條 build 分支各自配了同一個號,整合時後合的往上移)、`build/<鍵>` 分支已合進主線卻還在(整合開頭會清掉)、還是模板
8. 建議路線:從最高優先的需求第一條沒達成的里程碑推。先回答 GAP(答案要調整既有的 law 走 `dev-flow:scope-laws`,既有的 law 不動或只新增走 `dev-flow:scope-revise`,問的是全域 Law 走 `dev-flow:global-laws`)、再 build 能開的線(照需求的優先、里程碑順序排,每條附需求與里程碑)、`draft` 的文檔走 `dev-flow:scope-laws` 把 Law 談完、還沒有切片的里程碑走 `dev-flow:spike-impl`(先收在途的,再開新的)、待修訂的里程碑(靠修訂達成、還沒有 REV 引用它)走 `dev-flow:scope-revise <它綁的feature全名>`(既有的 law 不動,新的承諾用新增的 law 表達;要調整既有的 law 才做得到,整件走 `dev-flow:scope-laws`)、里程碑全部達成而驗收寫了三行卻沒有驗收測試的需求、寫了三行卻沒有測試的領域不變量走 `dev-flow:build R-n` / `INV-n`(只派 qa)。沒有可派的線時分三種:文檔全部達成而某條需求未達成或某條領域不變量不是成立,寫哪一條與判定來源,先補上;全部達成且每條需求達成、每條領域不變量成立寫「目前功能全部正常運作,可以加新功能」;沒達成寫哪幾份沒達成、缺什麼輸入,不催加新功能

分母是 `system.md`「Features」表的份數、「全域 Law」區領域不變量的條數,以及 `requirements/` 的檔數與各檔的里程碑數。

## 測試歸屬

每條 law 與 example 至少一條測試,測試宣告歸屬 `F-00x#LAW-n`;需求的驗收與領域不變量寫了三行式的各一條測試,歸屬 `R-n#ACCEPT` / `INV-n#LAW`(各只有一條,沒有序號)。歸屬有兩種寫法,同一個意思:

| 寫法 | 用在 | 例 |
|---|---|---|
| 字串 `F-001#LAW-1`、`R-1#ACCEPT`、`INV-1#LAW` | 測試名可以是任意字串 | `describe("F-001#LAW-1 …")`、`t.Run("R-1#ACCEPT", …)` |
| 識別字 `f_001__law_1`、`r_1__accept`、`inv_1__law` | 測試名必須是識別字(`-` 換 `_`,`#` 換 `__`,大小寫不拘) | `def test_f_001__law_1_rotate(…)`、`fn r_1__accept_roundtrip()` |

一條測試只放一個歸屬字串,測試輸出才對得回來。`devflow lint trace` 兩種都認。

## language adapter

`system.md` 的 `language` 選 adapter:一種語言寫它的名字;前後端各一種語言的專案寫 `[<目錄> = <adapter>, <目錄> = <adapter>]`,每個目錄一個 adapter,只掃該目錄、只用該 adapter。語言相關的事全部走 adapter,讀取層不認識任何語言:

| adapter 提供 | 用在 |
|---|---|
| `signatures(file)`:頂層與方法的簽名,正規化成 `name(T1, T2): R` | `lint sig`、`status` |
| `exports(file)`:對外匯出的名字 | `lint sig` |
| `typeNames(file)`:型別、列舉成員 | `lint laws`、`lint io` |
| `stubs(file)`:本體還是未實作標記的名字 | `status` |
| `imports(file)`:import 的目標 | `lint boundary`、`lint io` |
| `ioModules`:預設 IO 模組黑名單 | `lint boundary`、`lint io` |
| `testMarkers(file)`:測試檔裡的 `F-00x#LAW-n` / `F-00x#EX-n` / `R-n#ACCEPT` / `INV-n#LAW` 歸屬 | `lint trace`、`lint invariants` |
| `testResults(log)`:測試輸出 → 每個歸屬綠 / 紅 / pending | `status` |
| `stdlib`:law 裡可直接用的標準函式庫名 | `lint laws` |
| `stub(marker)`:帶 `F-00x#name` 的未實作標記 | 修訂新增的 step(roles.md「首跑」) |

現有 adapter:

| adapter | 副檔名 | 匯出 | 未實作標記 | 測試輸出 |
|---|---|---|---|---|
| `typescript`(含 javascript) | `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` | `export` | `throw new Error(…)` | jest / vitest / mocha |
| `python` | `.py` | `__all__`,沒寫就是不以底線開頭的 | `raise NotImplementedError` | pytest / unittest |
| `go` | `.go` | 大寫開頭 | `panic(…)` | `go test -v` |
| `rust` | `.rs` | `pub` | `todo!()` | `cargo test` |

- 模組的身分是**相對專案根目錄的檔案路徑**。import 的目標:相對路徑直接相加;`a/b`、`a.b`、`a::b` 這種至少兩段的,拿尾段去對專案裡的檔案與資料夾;單段的(`os`、`fmt`、`react`)一律當外部套件。
- **型別註記可有可無的語言**(Python、JavaScript)照樣對得到帳:程式碼那一側沒有註記時,只比名字與參數個數,`lint sig` 列 info 說明只對到這兩樣。
- Rust 的 `#[cfg(test)] mod` 不算產品程式碼:它的 `use` 與 `fn` 不進簽名與 import 圖,但裡面的歸屬標記照樣掃得到。
- 沒有 adapter 的語言:`lint sig` 與 `lint boundary` 印「此語言尚無 adapter」跳過,其餘照常;多語言專案有一側沒有 adapter,整棵都跳過。
- **多語言專案**:層表、模組表、對外 I/O 表與 feature 都是一棵,兩側共用同一套層名;模組路徑帶目錄前綴(`web/src/…`、`api/cart/…`),一份文檔屬於哪一側看它 Steps 的模組路徑。IO 模組黑名單依每個檔案自己的 adapter,law 裡可用的標準函式庫名是每側 adapter 的聯集。三道指令每側一組,寫成「- 測試(整套):<目錄> = `指令`;<目錄> = `指令`」,仍在專案根目錄執行;一道指令就跑完兩側的,照單一指令寫。兩側之間的呼叫(前端打後端的 HTTP)是各自的對外 I/O,兩邊各登記一列,型別是否一致由人看。

## 跑東西的紀律

測試、建置、lint 都照三道關:

1. **該不該跑**:輸出會改變接下來做什麼才跑。不拿測試判「文檔與程式碼哪邊過期」(看 `updated` 與原始碼);不為了回報裡的一個數字而跑。
2. **是不是重跑**:輸入沒變就沿用上次輸出並寫「沿用」。有變只跑涵蓋得到改動的範圍;整套一個迴圈一次(roles.md「測試跑幾次」)。
3. **輸出留檔**:`<指令> > <log> 2>&1; tail -20 <log>`,之後從檔案 grep。同一道指令連續失敗兩次,第三次前先換做法。

## 收尾定錨

每個 skill 的收尾,回報最後附這四段,不超過一個畫面。委派模式的 subagent 不輸出。

1. **位置樹**:願景一行 → 全域 Law 一行(三類各有沒有紅)→ 每條需求一行(優先、達成 / 未達成 / 未知、里程碑達成 n / m)→ 每條里程碑一行(達成 / 進行中 / 待修訂 / 未開工)→ 綁定的 feature → 目前文檔展開到 step 與 law,各標簽名在不在、law 綠不綠;它引用到的文檔掛在它底下;沒被任何里程碑綁定的 feature 掛在最後的「沒有需求」底下。目前節點標 `◀ 目前`。全部寫全名。
2. **完成度**三行:需求(最高優先還沒達成的需求 R-n · 里程碑達成 n / m · 驗收達成與否;全域 Law 三類有沒有紅)、產品(feature 達成 n / m · 文檔達成 n / m · 待實作 step n)、本次(目前文檔簽名 m / n · laws g / k)。數字只來自 `devflow status` 與實際跑過的測試;沒跑寫「沿用 <哪一次>」或「未跑」。
3. **主軸檢查**:本次對應哪條需求的哪條里程碑、哪份文檔的哪個 step 或 law;偏離清單(做的事不在任何里程碑的範圍裡、靠修訂達成的里程碑的 REV 依欄沒有寫它的全名、比最高優先需求的里程碑先做了低優先的、同一條需求同時開了兩條里程碑、簽名與 Steps 不符、內層 import 外層、測試後門、未登記檔案、open GAP、切片裡有假的東西沒記進決策紀錄、law 只是在描述程式碼現在做了什麼、在 `dev-flow:scope-laws` 之外調整了既有的 scope law、一件修訂由兩個修訂類的 skill 交錯著做、在 `dev-flow:global-laws` 之外動了全域 Law、在 `dev-flow:require-design` 之外寫了需求、同一個 step 與它的 law 在兩份 feature 各寫了一次而沒有一邊改成引用),每條附位置與建議;沒有寫「無」。
4. **下一步**:一條具體命令(參數寫全名),附下面四題的答案;最多兩條替代,各附同四題,外加一句為什麼不是第一。下一步必須從樹上推得出來。
   - **必要性**:不做它,樹上哪條需求停在哪條里程碑、哪份文檔的哪個 step 或 law、哪條功能因此無法正常運作。答不出具體的一份與一條,它就不是下一步,也排不進替代。
   - **替代為什麼排後面**:需求的優先較低、等一個決定、等別份先達成、只是清警訊;寫明是哪一個。
   - **需求來源**:這條命令對到位置樹的哪條需求與哪條里程碑、警訊表的哪一列、`gaps.md` 的哪一條、或開發者的哪一句話。都對不到的是自己長出來的需求,不列。
   - **架構缺口**:重切 feature、把 step 搬到另一份文檔、改層、換外部系統這類架構級動作,只能因為現在的架構解決不了一個具體問題才提;寫出那個問題。寫不出來就不提。
   - **全部正常時**:每份文檔達成、每條需求達成、全域 Law 三類沒有紅、每條領域不變量成立、測試全綠、沒有 open GAP、警訊為空,明寫「目前功能全部正常運作,沒有非做不可的事,可以加新功能」,下一步是 `dev-flow:require-design`(新需求,或既有需求底下的新里程碑)再 `dev-flow:spike-impl <M-n-slug>`;不另造下一步。
