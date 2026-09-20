# uto-skills

Claude Code 的 plugin marketplace:**spec 驅動開發**與**演講內容產生**的工作流程。

| Plugin | 用途 | Skills | CLI |
|---|---|---|---|
| [dev-flow](#dev-flow) | 一般程式語言專案的需求導向開發:先貫通切片,再談 Law、寫測試、調整實作 | 13 | `devflow` |
| [lawful](#lawful) | Haskell 這類純函數式專案(functional core / imperative shell)的需求導向開發,流程與 dev-flow 相同 | 14 | `lawful` |
| [talk-flow](#talk-flow) | Marp 投影片的主軸、段落、實作與審查 | 6 | — |

dev-flow 與 lawful 共用同一組地基:簽名住在程式碼裡、性質寫成三行的 law 並由 property test 承接、每條需求各有一句可判定的話、進度由 CLI 從程式碼與測試推導。兩者的流程與 skill 名稱相同:先用實作貫通一條垂直切片,再對著它談 Law,再委派測試與調整實作。差別在邊界:前者由專案自己宣告(層由內而外),後者由純度決定(四層固定)。

## 目錄

- [安裝](#安裝)
- [dev-flow](#dev-flow)
- [lawful](#lawful)
- [talk-flow](#talk-flow)
- [環境需求](#環境需求)
- [Repo 結構](#repo-結構)
- [開發與測試](#開發與測試)
- [貢獻](#貢獻)

## 安裝

在 Claude Code 內:

```
/plugin marketplace add utomore/uto-skills
/plugin install dev-flow@uto-skills
/plugin install lawful@uto-skills
/plugin install talk-flow@uto-skills
```

或在終端機:

```bash
claude plugin marketplace add utomore/uto-skills
claude plugin install dev-flow@uto-skills
claude plugin install lawful@uto-skills
claude plugin install talk-flow@uto-skills
```

更新到最新版:

```
/plugin marketplace update uto-skills
claude plugin update dev-flow@uto-skills
```

marketplace 是 git 來源,Claude Code 以 commit 判斷更新;dev-flow 與 lawful 的 `plugin.json` 不寫 `version`,每次合進 `main` 就是一個版本。

## dev-flow

一般程式語言專案的需求導向開發,不限語言:**需求(必須達成)與全域 Law(不得違反)先講好,先用實作貫通一條垂直切片,再對著跑得通的東西談 Law、寫測試、調整實作。** 所有文檔住專案的 `.design/`,檔名英文 kebab-case,內文繁體中文。

### 核心概念

- **程式碼先到,文檔是對著它談出來的承諾**:做之前只寫需求(驗收與切好的里程碑)、全域 Law;簽名、步驟怎麼拆、放哪個檔案,是做了才知道的事,留給切片。測試涵蓋到哪裡,功能的承諾就到哪裡:沒有 law 守著的行為不是承諾,實作可以自由改。
- **一條里程碑就是一條切片**:需求底下的里程碑有順序、依序完成,每一條是一個使用者看得到、展示得出來的階段,有英文名(全名 `M-n-<slug>`);從切片、談 Law、測試到調整實作,都在同一條 `build/M-n-<slug>` 分支與工作樹上;qa 與 refactor 做完、每條 law 都有一條會失敗而現在通過的測試守著,文檔才是 `verified`,verified 才整合。
- **每個階段一句核心**:立案只寫做之前判得出真假的東西;切片讓里程碑那一句話看得到地成真、不違反全域 Law、每個決定與每一處假都留紀錄;law 必須講得出怎樣算違反、而且是開發者的決定;每條 law 都被會失敗的測試守著才叫 verified;*Integration MUST NOT reduce Law satisfaction*。步驟與核心衝突時核心贏。
- **決策紀錄是為了達成這條里程碑的 Goal / Scope 而產生的實作決策**,不是過程的流水帳:每一列 Decision / Reason / Constraint,加上這一片當成成立的前提(law 的直接來源)、哪裡是假的、動到了什麼。
- **Law 是一次一條、用例子談出來的**:「現在的行為是 …,這是你要的、你不准的、還是你不在乎的?」要的寫成 law、不准的寫成 law 並記成首跑該紅、不在乎的不寫不測。每條 law 都要講得出一個讓它變假的實作,講不出來的只是在描述程式碼。
- **feature 是文檔單位**:一段從對外邊界進、從對外邊界出的資料流,一份 `F-00x-<slug>.md` 就是它的唯一真相。切片可以大,文檔不跟著變大;沒有子系統這一層,沒有 bug 文檔:bug 就是某條 law 在現況下不成立。
- **簽名住在程式碼裡**:Steps 表每一列是一條正規式簽名 `name(T1, T2): R`,抄程式碼裡定下來的那一個,`lint sig` 對帳。`=` 列是整條、`o` 列是觀察點、`!` 列是進入點。
- **law 是純 ASCII 三行**:`forall` / `given` / `|-`,識別字只能是 Steps 的簽名、最內層的匯出或型別名;`given` 的呼叫先發生,命令式的時序也寫得出來。每條 law 由一條 property test 承接,測試以 `F-00x#LAW-n` 宣告歸屬。
- **需求是必須達成,law 是不得違反**:判準是這件事有沒有做完的一天,有 = 需求,沒有 = law。需求附一句驗收,由歸屬 `R-n#ACCEPT` 的驗收測試、或里程碑全部達成判它達成了沒。law 只有兩種範圍:**全域 Law** 住 `system.md` 的「全域 Law」一區,整個專案都要守;**scope law** 住一份 feature 的「Laws」節,只約束那一份,由 `scope-laws` 對著切片談出來,之後要調整既有的 law 也只在它。任何程式碼都受全域 Law 加上它自己那份文檔的 scope law 約束。需求、里程碑、決策紀錄、ADR 裡都沒有 law;里程碑不管理約束,law 也不必朝向需求。
- **全域 Law 三類,住同一區,各有一道 lint 自動確認**:領域不變量 `INV-n` 只引用最內層共用的東西,由歸屬 `INV-n#LAW` 的測試長駐守著(`lint invariants`);架構的層由內而外、內層不准 import 外層、最外層是唯一能做對外 I/O 的層(`lint boundary`);契約的對外 I/O 表帶信任、驗證與契約,`untrusted` 的入口必須指名驗證 step(`lint io`)。`lint global` 三道一次查完,`status` 的「全域 Law」表印每一類現在的結果。
- **全域 Law 的變更要開發者明確批准**:任何全域 Law 的修改、放寬、替換或刪除,都必須經開發者明確批准;`integrate` 只能提出變更建議,不得自行決定變更,也不直接修改全域 Law;經批准的變更由 `global-laws` 完成,完成後重新驗證受影響的工作。調整任何一條 law 之前(scope law 在 `scope-laws`,全域 Law 在 `global-laws`),先攤影響範圍(動到哪幾條、哪些文檔連動、哪些測試重寫、哪些 `verified` 要重開、哪些分支要重驗、需求還達不達成),再給至少兩個選項(一定含「不改」),開發者選了才落筆。
- **改既有的東西,一句話分流**:要調整(修改、放寬、替換、刪除)既有的 law → `scope-laws`;law 不動、或只新增 law,而文檔或實作要變 → `scope-revise`;全域 Law → `global-laws`;需求面的條目 → `require-design`。一件修訂從頭到尾只有一個修訂類的 skill 在跑,跑到 `verified` 為止;GAP 的結案與調整 `RF-n` 的落地照同一句(`RF-n` 預設走 `scope-revise`)。
- **三層「為什麼」**:`system.md` 的願景(北極星);`requirements/` 一檔一條需求(必須達成:一句話、一句可判定的驗收、優先 1 到 4);需求檔裡的里程碑(依序完成,全部達成這條需求的建置就走完;一條需求一次只開下一條,要平行就拆成兩條需求)。里程碑綁 feature:切片做出來的新 feature,或這個階段靠修訂做到的既有 feature。里程碑走完之後的調整(`RF-n`)只動既有 feature 的品質。
- **一個 step 與它的 law 只住一份文檔**:先做出它的那一份。別的文檔要用它,就在 Steps 表的模組欄註明「見 <那份文檔的全名>」引用,law 不重寫、不複製;feature 可以引用另一份 feature,不論它們屬於哪條需求。實作先行:後做的切片直接呼叫既有的程式碼,同一個 step 沒有第二份。被引用的那一份達成,引用它的才算達成。
- **需求的先後從引用推**:需求的編號是流水號,只是身分。哪條需求疊在哪條上面不寫在任何欄位:這條需求的里程碑綁的文檔引用了別條需求的里程碑綁的文檔,它就依賴那一條;`devflow status` 的需求表有一欄「依賴」,看板的相依頁籤畫出來。互不依賴的需求可以同時開工。新需求落筆之前,它的驗收先逐條對過既有每一條需求的驗收;有無法同時達成的,先攤影響範圍與選項,開發者選了才落筆。
- **進度不是欄位**:`status` 只有 `draft` / `ready` / `verified` 三格,都是人才知道的決定;做到哪、每條分支走到哪一步、需求達成了沒、全域 Law 有沒有被踩到、下一步做什麼,由 `devflow status` 從檔案、程式碼與測試推。

### 工作流程

```
/kickoff ──▶ /require-design ──▶ /global-laws ──▶ /spike-impl ──▶ /scope-laws ──▶ /build ──▶ /integrate
 開樹         需求與驗收           全域 Law 三區            貫通一條切片     根據決策紀錄談約束      qa → 首跑     合成一條 PR
 願景         當場切里程碑         開發者批准才落筆         決策紀錄         拍板才 ready            → refactor    仲裁、ADR
 語言與工具                                                     └──────────── 同一條 build/M-n-<slug> 工作樹 ────────────┘
                                                                                      ▲
                                        /scope-laws(要調整既有的 law)──────────┤  既有文檔的改動:文檔先行,留 REV,
                                        /scope-revise(law 不動或只新增,verified → verified)─┘  自動接上 build 做回 verified
```

- 立案三步(`kickoff` → `require-design` → `global-laws`)只寫做之前就講得清楚的東西,經 `integrate` 以 `plan/<slug>` 分支發 PR 合進主線。需求只在與開發者的討論裡成形,里程碑在談需求的當場切好;全域 Law 的每一條都由開發者批准。
- 切片(`spike-impl`)從對外入口貫通到出口,同時是可行性驗證;從第一行程式碼就守全域 Law,可以假、但每一處都記進決策紀錄;走不通也是答案,整合時升成 ADR。
- Law(`scope-laws`):切片剛做完,根據切片的決策紀錄把它拆成 feature,Steps 抄程式碼,與開發者把約束談出來——資料交互、資料儲存在哪、外部串接方法、軟體架構四項逐項問到——laws 逐條拍板;碰到全域的事不在這裡寫,列成給 `global-laws` 的變更提議。既有文檔的 law 要調整(修改、放寬、替換、刪除)也只在這裡:先攤影響範圍與選項,連帶的簽名、型別、實作一手包辦,留一條 REV;刪 step、兩份重複的 step 留一份而另一份改成引用、文檔退役,都是刪既有的 law,也在這裡。收尾自動接上 build。
- 修訂(`scope-revise`):既有的 law 一條都不動,改 `verified` 文檔的簽名、型別、模組與層的歸屬、描述,或落地調整 `RF-n` 的實作品質;可以新增 law(保護用的、新的上界、新 step 的)。攤影響範圍、開發者確認、重開、留 REV、自動接上 build,收尾時原有的每條 law 仍然綠、文檔回到 `verified`。非調整既有的 law 不可就放棄並還原,替開發者寫好一行 `/dev-flow:scope-laws <全名> <原因>`,整件交過去。
- 建構(`build`)由 conductor 帶兩個互不可見的角色:`qa` 只讀文檔寫測試;conductor 在現有的程式碼上驗首跑(該紅的紅、該綠的綠);`refactor` 不讀測試,調整或整份重寫實作直到每條 law 成立。互不依賴的需求,里程碑同時各開一條。
- 整合(`integrate`)是唯一發 PR 的出口:每一條 law 都仍然成立才發;兩條分支的 law 互斥時不改碼,拿縮小後的反例問開發者三選一(以 A 為主 / 收窄定義域 / 提煉上層 Law);兩條分支各寫了一份同樣的 step 時問開發者留哪一份,另一份退回由 `scope-laws` 改成引用;它不改任何一條 law,只提變更建議,批准的 scope law 由 `scope-laws`、全域 Law 由 `global-laws` 落筆;不可逆又跨文檔的權衡升成 ADR。
- 隨時可跑:`status` 派工報告、`audit` 稽核、`study` 專案導讀。

### Skills

| Skill | 做什麼 |
|---|---|
| `/kickoff` | 專案的第一個命令:開 `.design/` 的樹,訪談出 `system.md` 的願景、語言與工具,與 `modules.md` 的骨架;不談需求也不談全域 Law,收尾自動接上 `require-design` |
| `/require-design` | 與開發者一次一條談需求:一句話、驗收、優先,寫檔之前先與既有每一條需求的驗收逐條對過有沒有衝突,當場切成依序完成的里程碑(每條是使用者看得到、展示得出來的階段,有英文名);之後加需求、改驗收、重排、加調整 `RF-n`、把沒被綁定的 feature 收進里程碑也走這裡 |
| `/global-laws` | 全域 Law 一區三類(領域不變量、架構的層、契約的對外 I/O)的第一次定義與之後每一次新增、修改、放寬、替換、刪除:先攤影響範圍與選項,開發者明確批准才落筆,落筆後重新驗證受影響的工作 |
| `/spike-impl` | 一條里程碑:開 `build/M-n-<slug>` 工作樹,貫通一條跑得通的垂直切片,留下決策紀錄(Goal / Scope、Decisions:Decision / Reason / Constraint、Assumptions & Invariants、Faked / Unverified、Touched);走不通就記下為什麼 |
| `/scope-laws` | 談約束,與既有 law 的調整。對著切片、根據決策紀錄:claim 出 feature、Steps 抄程式碼、資料交互 / 資料儲存在哪 / 外部串接方法 / 軟體架構四項逐項問到、與開發者一次一條談 Law、記下首跑該紅,拍板改 `ready`;碰到全域的列成給 `global-laws` 的變更提議。既有文檔的 law 要修改、放寬、替換、刪除:先攤影響範圍與選項、`verified` 先重開、連帶的簽名、型別、實作一手包辦、寫一條 REV;刪 step、重複的 step 改成引用、文檔退役也在這裡。收尾自動接上 build |
| `/scope-revise` | 既有的 law 不動的修訂,verified → verified:改 `verified` 文檔的簽名、型別、模組與層的歸屬、描述,或落地調整 `RF-n`(效能、大小、訊息、演算法);可以新增 law,不得修改、放寬、替換、刪除既有的。攤影響範圍、開發者確認、重開、寫 REV(保護欄是原有的每一條 law 與 example)、自動接上 build;非調整既有的 law 不可就放棄並還原,寫好一行指令整件交給 `scope-laws` |
| `/build` | conductor:對帳 → 派 qa → 首跑 → 派 refactor → 仲裁 → 驗收測試 → 整套 → 決策紀錄;目標也可以直接是 `R-n` / `INV-n`(只派 qa 寫那一條測試) |
| `dev-flow:qa` | 委派角色:每條 law 一條 property test、每個 example 一條 example test;禁止讀任何實作本體 |
| `dev-flow:refactor` | 委派角色:調整或重寫實作直到每條 law 成立,假的換成真的;禁止讀寫測試、禁止改簽名與型別宣告 |
| `/status` | 派工報告:每條需求達成了沒與它的里程碑走到哪、全域 Law 三類有沒有被踩到、今天能開幾條線、每條分支走到哪一步、卡住的、警訊、建議路線;`--html` 畫成看板 |
| `/audit` | 四段稽核:對帳、需求與里程碑(含里程碑是不是看得到的階段、law 是不是只在描述程式碼、全域 Law 有沒有膨脹)、穩定度、安全度,產出「哪裡 / 什麼事 / 怎麼辦」表 |
| `/study` | 六層縮放的專案導讀:全景 → 架構 → 理念 → 資料結構 → trace → 細讀,每個結論附 `檔案:行號` |
| `/integrate` | 唯一發 PR 的出口:清理已合的、盤點候選、逐條 merge、每條 law 仍成立才發;law 互斥時仲裁、寫 ADR;不改任何一條 law,全域 Law 只提變更建議;標題英文、內文繁中 |

### `.design/` 結構

```
.design/
├── system.md                       # 願景、全域 Law(領域不變量 INV-n、架構:層、契約:對外 I/O)、語言與工具、Features
├── requirements/R-1-<slug>.md      # 一檔一條需求:一句話、驗收、優先、里程碑(M-n-<slug>,依序)、調整(RF-n)
├── modules.md                      # 模組表:相對路徑樣式 → 層
├── features/F-001-<slug>.md        # 一條從對外邊界進出的資料流;一個 step 與它的 law 只住一份,別份引用
├── gaps.md                         # 只裝 open 的 GAP
├── adr/ADR-001-<slug>.md           # 跨文檔、回不了頭的決定;整合時寫
└── journal/M-1-<slug>.md           # 決策紀錄:為了達成這條里程碑的 Goal / Scope 而產生的實作決策;只活在 build 分支,整合寫進 PR 後刪
```

### CLI:`devflow`

規章不靠自覺,靠一支 CLI 對帳。在有 `.design/` 的專案根目錄執行 `node <plugin>/bin/devflow.mjs <子命令>`;`--help` 列全部。

| 子命令 | 做什麼 |
|---|---|
| `status [--tests <log> \| --run]` | 派工報告;建構中的分支從它的工作樹讀出走到哪一步;`--doc` / `--module` 追問單份文檔或單一檔案;`--json` 給工具讀;`--html` 畫成看板 |
| `claim feature\|adr <slug>` | 鑄號建檔;feature 另加進 Features 表並綁進 `--milestone`;配號看同一個 repo 的每一棵工作樹 |
| `requirement add` / `milestone` / `refinement` | 鑄 `R-n` 建需求檔 `requirements/R-n-<slug>.md` / 鑄 `M-n-<slug>` 接在該需求的里程碑表最後 / 鑄 `RF-n` 指定動到的 feature |
| `invariant add` | 鑄 `INV-n` 寫進 `system.md`「全域 Law」區的領域不變量 |
| `lint ids` | 兩個檔案同號、號段行讀不懂或重疊、`owner` 的號不在自己的區間內 |
| `lint boundary` | 全域 Law 的架構:import 方向 vs 層表;非最外層碰 IO 模組;未登記與幽靈檔案 |
| `lint sig` | Steps 簽名 vs 程式碼:找得到、匯出、簽名一致、型別都宣告過、`=` / `o` / `!` 列的層與份數、引用別份文檔的 step 指得到它真正住的那一份、同名簽名沒有在兩份文檔各寫一次 |
| `lint laws` | scope law:三行齊全、種類合法、識別字對得到簽名或型別、`=` 列至少一條 law、example 指得到 law;需求的驗收同一套查 |
| `lint trace` | laws / examples ↔ 測試歸屬:未翻譯、幽靈引用;需求的驗收寫了三行卻沒有驗收測試 |
| `lint io` | 全域 Law 的契約:`untrusted` 的入口有驗證 step、契約欄指到的 law 存在、文檔沒有秘密字面值、最外層沒有未登記的出入口 |
| `lint invariants` | 全域 Law 的領域不變量:編號、種類、三行只准引用最內層、寫了三行就有 `INV-n#LAW` 測試 |
| `lint global` | 全域 Law 三類一次查完:`boundary`(架構)+ `io`(契約)+ `invariants`(領域不變量) |
| `lint all` | 以上全部 |
| `sync` / `modules --gen` | 同層搬家的 step 改模組欄 / 從程式碼補模組表 |
| `migrate laws` / `migrate requirements` / `migrate <.design>` | `system.md` 沒有「全域 Law」區的樹把三類約束收進那一區 / 需求不住 `requirements/` 的樹把每條需求寫成一個需求檔 / `subsystems/` 體系的遷移帳本(只印不改) |

### 語言 adapter

語言相關的事全部走 adapter,讀取層不認識任何語言。模組的身分是相對專案根目錄的檔案路徑。

| adapter | 副檔名 | 匯出 | 未實作標記 | 測試輸出 |
|---|---|---|---|---|
| `typescript`(含 javascript) | `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` | `export` | `throw new Error(…)` | jest / vitest / mocha |
| `python` | `.py` | `__all__`,沒寫就是不以底線開頭的 | `raise NotImplementedError` | pytest / unittest |
| `go` | `.go` | 大寫開頭 | `panic(…)` | `go test -v` |
| `rust` | `.rs` | `pub` | `todo!()` | `cargo test` |

前端與後端各一種語言的專案,`system.md` 的 `language` 欄寫 `[web = typescript, api = python]`,每個目錄一個 adapter,三道指令每側一組,`status` 合併兩側的測試輸出。

### 多人協作

兩人以上會平行 claim 的專案,在 `system.md`「語言與工具」加一行號段,以 git 的 `user.email` 為鍵每人一段:

```markdown
- 號段:amy@corp.com = 100-199;bob@corp.com = 200-299
```

`devflow claim` 自動讀 `git config user.email`(`GIT_AUTHOR_EMAIL` 優先),從自己區間內的最大號往上配,frontmatter 寫 `owner`;email 不在號段行上就停。號段只管 feature / ADR;需求、領域不變量、里程碑、調整一律從最大號往上配。同一台機器上每條切片各住各的工作樹,`claim` 配號時看得到彼此;不同機器上各自 claim 的同號由 `lint ids` 抓,放進 PR 的 CI 就是安全網。單人專案寫 `無` 或不寫這一行,行為不變。

## lawful

Haskell 這類純函數式專案(functional core / imperative shell)的需求導向開發。流程、skill 名稱與 Law 的定義都與 dev-flow 相同:需求(必須達成)與全域 Law(不得違反)先講好,立案三步 `kickoff`(開樹、願景、專案約束)→ `require-design`(需求,當場切成依序的里程碑)→ `global-laws`(全域 Law 三區),`spike-impl` 先貫通一條切片,`scope-laws` 根據切片的決策紀錄對著它談 Law,`build` 帶 qa 與 refactor 讓每條 law 成立,`integrate` 是唯一發 PR 的出口;既有 pipeline 要調整既有的 law 走 `scope-laws`,既有的 law 不動走 `scope-revise`。文檔住 `.lawful/`,單位是 **pipeline**:input → 純轉換 → output 的資料流,`kind` 是 `io`(兩端碰 shell)或 `subflow`(只在純核心裡)。

與 dev-flow 的差異:

- **四層固定**:`types ← effect ← core ← shell`,一層一棵原始碼樹(預設 `src-<層>`),各是建置系統的一個子函式庫,依賴方向由編譯器擋、`lint boundary` 再對一次。`=` 列是純的整條、`!` 列是 shell 進入點、`o` 列是觀察點。
- **模組單元**:`modules.md` 一列一個單元(名字、職責、有哪幾層);切片要一個還沒有的單元或層,先 `lawful module` 劃邊界。pipeline 的 slug 是 `<領域名詞>-<動詞>`,領域名詞是 `=` 列住的單元。
- **Cone.md**:願景、全域 Law(領域不變量 INV-n、架構:四層、契約:對外 I/O)、專案約束(語言、三道指令、模組前綴、原始碼根目錄、硬性要求的套件、號段、優先各級)。領域不變量只引用 types 層。
- **stage 之間不用無名容器**:`lint sig` 擋 aeson `Value` 這類型別,形狀要有名字。
- 一個 stage 與它的 law 只住一條 pipeline,別條引用它;被引用的那一條通常是 `kind: subflow` 的 pipeline。

Skills:`kickoff`、`require-design`、`global-laws`、`module`、`spike-impl`、`scope-laws`、`scope-revise`、`build`、`qa`、`refactor`、`integrate`、`status`、`audit`、`study`。CLI `lawful` 的子命令與 `devflow` 相同(status、claim、requirement、invariant、lint、sync、section、brief),另有 `module`、`rename`、`migrate laws`(全域 Law 還沒收進 `Cone.md`、需求還寫著 Law 的樹)、`migrate cone`(只有 `system.md` 的樹)、`migrate requirements`(需求不住 `requirements/` 的樹)與 `migrate from-dev-flow`。adapter 是 Haskell(認 hspec 與 tasty 兩種測試輸出)。

```
.lawful/
├── Cone.md                         # 願景、全域 Law 三區、專案約束
├── requirements/R-1-<slug>.md      # 一檔一條需求:一句話、驗收、優先、里程碑(M-n-<slug>,依序)、調整(RF-n)
├── modules.md                      # 模組單元表
├── pipelines/P-001-<slug>.md       # Brief、Stages、Laws、Examples、決定
├── gaps.md
├── adr/
└── journal/M-1-<slug>.md           # 決策紀錄;只活在 build 分支,整合寫進 PR 後刪
src-types/ src-effect/ src-core/ src-shell/   # 一層一棵樹
```

## talk-flow

演講內容產生流程。投影片以 Marp Markdown 撰寫、marp-cli 建置(html / pdf / pptx),圖形用 SVG,講稿是頁內備註。流程是三層階梯,每層只決定自己顆粒度的事:

| Level | Skill | 決定什麼 |
|---|---|---|
| 1 語意 | `/topic-design` | 訪談時長、聽眾、場合,選風格基底與前景 / 背景分層的語意,三組主題方案擇一,產出 `docs/topic.md` 與 Marp 鷹架 |
| 2 內容 | `/section-design` | 逐段規劃討論方向、內文形式、要不要圖與圖的類型,產出 `docs/section-0x-<slug>.md`;`status` 掃各段狀態 |
| 3 呈現 | `/section-impl` | 逐頁決定版型、背景類別、視覺動線,寫 `talk/src/section-0x-<slug>.md` 與 SVG,`node build.mjs` 驗收 |
| 3 呈現 | `/page-adjust` | 針對單頁深談版面、內文、圖形、備註的調整,改完重 build 並同步設計文件 |
| 3 呈現 | `/svg-layout` | 架構圖 SVG 的排版量測:`normalize.py` 補語意標註、`inspect_svg.py` 出 scene digest、`lint.py` 診斷 15 條規則 |
| 審查 | `/review` | 腳本交叉比對加 build 後逐頁目視,十四項指標(含文案語感與分層),產出 `review/review-<日期>-<序號>.md`,不改任何原始碼 |

視覺數值的唯一真相是 `talk/src/theme.css`,`docs/` 只記決定與理由。全流程禁用對比翻轉句與人稱代名詞,每頁標題一句話寫出這頁的重點。共用規範在 `plugins/talk-flow/skills/_shared/`(conventions、layouts、styles、layers、diagrams、wording)。

演講專案的結構:

```
docs/               # topic.md 與各 section 設計文件
talk/src/           # Marp 原始碼:deck-header.md、section-0x-<slug>.md、theme.css、build.mjs、.marprc.yml
talk/assets/        # diagram-<section>-<序號>-<slug>.svg、bg-<slug>.svg、logo.svg
talk/dist/          # marp-cli 輸出,不手改
review/             # 審查報告
```

## 環境需求

| 工具 | 誰用 |
|---|---|
| Claude Code | 全部 |
| Node.js 18 以上 | `devflow`、`lawful`、talk-flow 的 `build.mjs` |
| git | `build` / `integrate` 的分支與工作樹、`claim` 讀 `user.email` |
| GitHub CLI `gh` | `integrate` 發 PR |
| 專案自己的建置與測試工具 | `system.md` / `Cone.md` 宣告的三道指令 |
| marp-cli | talk-flow 建置投影片 |
| uv 與 Python(fontTools) | talk-flow 的 `svg-layout` 腳本 |

## Repo 結構

本 repo 同時是 marketplace 與 plugin 本體。安裝時只有 `marketplace.json` 裡 `source` 指到的那個子目錄會被複製到使用者電腦。

```
.claude-plugin/marketplace.json     # marketplace「uto-skills」
plugins/
├── dev-flow/
│   ├── .claude-plugin/plugin.json
│   ├── rules/                      # 五份主題規章(laws / features / boundary / roles / tooling):每條規則唯一的住處
│   ├── skills/<name>/SKILL.md      # 只寫步驟,規則用檔名加節名引用
│   ├── bin/devflow.mjs             # 單一 CLI
│   ├── lib/                        # 讀取層、lint、status、語言 adapter
│   └── templates/                  # 建檔用的骨架與看板頁面
├── lawful/                         # 同形:rules / skills / bin / lib / templates
└── talk-flow/skills/               # 六個 skill 與 _shared/ 規範
tests/                              # 夾具、golden、看板的瀏覽器測試;不隨 plugin 安裝
docs/skill-authoring.md             # 給改 skill 的人看的維護準則
wip/                                # 設計稿與決定紀錄,不被任何 session 載入
```

`plugins/` 底下的每一句話都會變成某個 session 的行為,所以規章一律宣告式:只寫當下的規則,不寫版本、歷史或舊制;推理與決定紀錄住 `wip/`。

## 開發與測試

改了 `plugins/dev-flow/{bin,lib,templates}/` 或 `plugins/lawful/{bin,lib}/`:

```bash
bash tests/dev-flow/run.sh    # 十個夾具的 golden 回歸 + --help
bash tests/lawful/run.sh      # 九個夾具的 golden 回歸 + --help
```

改了 `templates/status-board.html`:

```bash
bash tests/board/run.sh       # 用 CDP 開 headless Chrome 把看板點過一遍;找不到 Chrome 用 CHROME_PATH 指
```

夾具本身也是規章的一部分:`shop` / `save-game` 是全綠的完整範例,`shaky` / `broken` 讓每一道紅各出現一次,`team` 證明號段配號,其餘各證明一個 adapter 或一種遷移輸入。行為刻意改了才 `--update` 重產 golden,並在 PR 說明為什麼變。

## 貢獻

- 從 `main` 開分支,一個主題一條 PR;`integrate` skill 的固定章節就是 PR 內文的格式,標題英文、內文繁體中文。
- 規章與 skill 的寫法見 [`docs/skill-authoring.md`](docs/skill-authoring.md);成本模型是執行者一次要記住多少條規則,不是檔案長度。
- 新增 plugin:在 `plugins/` 開目錄,`marketplace.json` 的 `plugins[]` 加一筆。
