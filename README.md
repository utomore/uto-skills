# uto-skills

Claude Code 的 plugin marketplace:**spec 驅動開發**與**演講內容產生**的工作流程。

| Plugin | 用途 | Skills | CLI |
|---|---|---|---|
| [dev-flow](#dev-flow) | 一般程式語言專案的需求導向開發:先貫通切片,再談 Law、寫測試、調整實作 | 13 | `devflow` |
| [lawful](#lawful) | Haskell 這類純函數式專案(functional core / imperative shell)的需求導向開發,流程與 dev-flow 相同 | 13 | `lawful` |
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

- **程式碼先到,文檔是對著它談出來的承諾**:做之前只寫需求與它的驗收、全域 Law;簽名、步驟怎麼拆、放哪個檔案,是做了才知道的事,留給切片。測試涵蓋到哪裡,功能的承諾就到哪裡:沒有 law 守著的行為不是承諾,實作可以自由改。
- **一條里程碑就是一條切片**:目標底下的里程碑有英文名(全名 `M-n-<slug>`),從切片、談 Law、測試到調整實作,都在同一條 `build/M-n-<slug>` 分支與工作樹上;qa 與 refactor 做完、每條 law 都有一條會失敗而現在通過的測試守著,文檔才是 `verified`,verified 才整合。
- **每個階段一句核心**:立案只寫做之前判得出真假的東西;切片讓里程碑那一句話看得到地成真、不違反全域 Law、每個決定與每一處假都留紀錄;law 必須講得出怎樣算違反、而且是開發者的決定;每條 law 都被會失敗的測試守著才叫 verified;*Integration MUST NOT reduce Law satisfaction*。步驟與核心衝突時核心贏。
- **決策紀錄是為了達成這條里程碑的 Goal / Scope 而產生的實作決策**,不是過程的流水帳:每一列 Decision / Reason / Constraint,加上這一片當成成立的前提(law 的直接來源)、哪裡是假的、動到了什麼。
- **Law 是一次一條、用例子談出來的**:「現在的行為是 …,這是你要的、你不准的、還是你不在乎的?」要的寫成 law、不准的寫成 law 並記成首跑該紅、不在乎的不寫不測。每條 law 都要講得出一個讓它變假的實作,講不出來的只是在描述程式碼。
- **feature 是文檔單位**:一段從對外邊界進、從對外邊界出的資料流,一份 `F-00x-<slug>.md` 就是它的唯一真相。切片可以大,文檔不跟著變大;沒有子系統這一層,沒有 bug 文檔:bug 就是某條 law 在現況下不成立。
- **簽名住在程式碼裡**:Steps 表每一列是一條正規式簽名 `name(T1, T2): R`,抄程式碼裡定下來的那一個,`lint sig` 對帳。`=` 列是整條、`o` 列是觀察點、`!` 列是進入點。
- **law 是純 ASCII 三行**:`forall` / `given` / `|-`,識別字只能是 Steps 的簽名、最內層的匯出或型別名;`given` 的呼叫先發生,命令式的時序也寫得出來。每條 law 由一條 property test 承接,測試以 `F-00x#LAW-n` 宣告歸屬。
- **需求是必須達成,law 是不得違反**:需求不是 law,它附一句驗收,由歸屬 `R-n#ACCEPT` 的驗收測試或建置路線判它達成了沒。law 只有兩種範圍:**全域 Law** 住 `system.md` 的「全域 Law」一區,整個專案都要守;**scope law** 住一份 feature 或 abstract 的「Laws」節,只約束那一份,`law-design` 只設計這一種。目標、里程碑、決策紀錄、ADR 裡都沒有 law。
- **全域 Law 三類,住同一區,各有一道 lint 自動確認**:領域不變量 `INV-n` 只引用最內層共用的東西,由歸屬 `INV-n#LAW` 的測試長駐守著(`lint invariants`);架構的層由內而外、內層不准 import 外層、最外層是唯一能做對外 I/O 的層(`lint boundary`);契約的對外 I/O 表帶信任、驗證與契約,`untrusted` 的入口必須指名驗證 step(`lint io`)。`lint global` 三道一次查完,`status` 的「全域 Law」表印每一類現在的結果。
- **全域 Law 的變更要開發者明確批准**:任何全域 Law 的修改、放寬、替換或刪除,都必須經開發者明確批准;`integrate` 只能提出變更建議,不得自行決定變更,也不直接修改全域 Law;經批准的變更由 `revise` 完成,完成後重新驗證受影響的工作。調整任何一條 law 之前,`revise` 先攤影響範圍(動到哪幾條、哪些文檔連動、哪些測試重寫、哪些 `verified` 要重開、哪些分支要重驗、需求還達不達成),再給至少兩個選項(一定含「不改」),開發者選了才落筆。
- **四層「為什麼」**:`system.md` 的願景(北極星)與需求(必須達成,每條一句可判定的驗收);`objectives/` 一檔一個目標(解決恰好一條需求,優先 1 到 4;達成 = 里程碑全部達成);目標底下的建置路線(里程碑)與優化路線(調整只動既有 feature 的品質)。
- **abstract 是收整出來的**:切片各切各的,兩份以上 feature 長出同一段東西,`abstract` 抽成 `A-00x`,被動到的每一份記一條 REV;少於兩個消費者就該搬回去。feature 之間不互相引用。
- **進度不是欄位**:`status` 只有 `draft` / `ready` / `verified` 三格,都是人才知道的決定;做到哪、每條分支走到哪一步、需求達成了沒、全域 Law 有沒有被踩到、下一步做什麼,由 `devflow status` 從檔案、程式碼與測試推。

### 工作流程

```
/project ──▶ /objective ──▶ /spike-impl ──▶ /law-design ──▶ /build ──▶ /integrate
 立案         目標與里程碑     貫通一條切片     對著切片談 Law    qa → 首跑     合成一條 PR
 需求與驗收                   決策紀錄         拍板才 ready      → refactor    仲裁、ADR
 全域 Law                          └──────── 同一條 build/M-n-<slug> 工作樹 ────────┘
                                                    ▲
                                  /revise ──────────┘  既有文檔的改動:文檔先行,留 REV,自動接上 build
```

- 立案(`project` / `objective`)只寫做之前就講得清楚的東西,經 `integrate` 以 `plan/<slug>` 分支發 PR 合進主線。
- 切片(`spike-impl`)從對外入口貫通到出口,同時是可行性驗證;從第一行程式碼就守全域 Law,可以假、但每一處都記進決策紀錄;走不通也是答案,整合時升成 ADR。
- Law(`law-design`)把切片拆成 feature,Steps 抄程式碼,laws 逐條拍板;收尾自動接上 build。
- 建構(`build`)由 conductor 帶兩個互不可見的角色:`qa` 只讀文檔寫測試;conductor 在現有的程式碼上驗首跑(該紅的紅、該綠的綠);`refactor` 不讀測試,調整或整份重寫實作直到每條 law 成立。互不相干的里程碑同時各開一條。
- 整合(`integrate`)是唯一發 PR 的出口:每一條 law 都仍然成立才發;兩條分支的 law 互斥時不改碼,拿縮小後的反例問開發者三選一(以 A 為主 / 收窄定義域 / 提煉上層 Law);它不改任何一條 law,只提變更建議,批准的由 `revise` 落筆;不可逆又跨文檔的權衡升成 ADR。
- 隨時可跑:`status` 派工報告、`audit` 稽核、`study` 專案導讀。

### Skills

| Skill | 做什麼 |
|---|---|
| `/project` | 訪談後產出 `system.md`(願景、需求與驗收、全域 Law 一區三類:領域不變量、架構的層、契約的對外 I/O、語言與工具)、`objectives/` 與 `modules.md`;不建 feature |
| `/objective` | 目標兩問(What / Which)、里程碑(一條就是一條切片,有英文名)、調整動到哪些 feature、重排優先 |
| `/spike-impl` | 一條里程碑:開 `build/M-n-<slug>` 工作樹,貫通一條跑得通的垂直切片,留下決策紀錄(Goal / Scope、Decisions:Decision / Reason / Constraint、Assumptions & Invariants、Faked / Unverified、Touched);走不通就記下為什麼 |
| `/law-design` | 對著切片:claim 出 feature、Steps 抄程式碼、與開發者一次一條談 Law、記下首跑該紅,拍板改 `ready`,自動接上 build |
| `/build` | conductor:對帳 → 派 qa → 首跑 → 派 refactor → 仲裁 → 驗收測試 → 整套 → 日誌;目標也可以直接是 `R-n` / `INV-n`(只派 qa 寫那一條測試) |
| `dev-flow:qa` | 委派角色:每條 law 一條 property test、每個 example 一條 example test;禁止讀任何實作本體 |
| `dev-flow:refactor` | 委派角色:調整或重寫實作直到每條 law 成立,假的換成真的;禁止讀寫測試、禁止改簽名與型別宣告 |
| `/revise` | 任何對既有文檔的改動都改原檔,文檔先行:回答 GAP、落地調整、寫一條 REV、必要時解凍,自動接上 build |
| `/abstract` | 兩份以上 feature 的共同部分抽成 `A-00x`,程式碼搬到一處,原檔改成「見 A-00x」,各記一條 REV |
| `/status` | 派工報告:需求達成了沒、全域 Law 三類有沒有被踩到、目標與里程碑完成度、今天能開幾條線、每條分支走到哪一步、卡住的、警訊、建議路線;`--html` 畫成看板 |
| `/audit` | 四段稽核:對帳、需求與目標(含 law 是不是只在描述程式碼、全域 Law 有沒有膨脹)、穩定度、安全度,產出「哪裡 / 什麼事 / 怎麼辦」表 |
| `/study` | 六層縮放的專案導讀:全景 → 架構 → 理念 → 資料結構 → trace → 細讀,每個結論附 `檔案:行號` |
| `/integrate` | 唯一發 PR 的出口:清理已合的、盤點候選、逐條 merge、每條 law 仍成立才發;law 互斥時仲裁、寫 ADR;不改任何一條 law,全域 Law 只提變更建議;標題英文、內文繁中 |

### `.design/` 結構

```
.design/
├── system.md                       # 願景、需求(R-n 與驗收)、全域 Law(領域不變量 INV-n、架構:層、契約:對外 I/O)、語言與工具、Features
├── objectives/R-1-O-1-<slug>.md    # 一檔一個目標:優先、里程碑(M-n-<slug>)、調整(RF-n)
├── modules.md                      # 模組表:相對路徑樣式 → 層
├── features/F-001-<slug>.md        # 一條從對外邊界進出的資料流
├── abstracts/A-001-<slug>.md       # 兩份以上 feature 收整出來的共用能力
├── gaps.md                         # 只裝 open 的 GAP
├── adr/ADR-001-<slug>.md           # 跨文檔、回不了頭的決定;整合時寫
└── journal/M-1-<slug>.md           # 決策紀錄:為了達成這條里程碑的 Goal / Scope 而產生的實作決策;只活在 build 分支,整合寫進 PR 後刪
```

### CLI:`devflow`

規章不靠自覺,靠一支 CLI 對帳。在有 `.design/` 的專案根目錄執行 `node <plugin>/bin/devflow.mjs <子命令>`;`--help` 列全部。

| 子命令 | 做什麼 |
|---|---|
| `status [--tests <log> \| --run]` | 派工報告;建構中的分支從它的工作樹讀出走到哪一步;`--doc` / `--module` 追問單份文檔或單一檔案;`--json` 給工具讀;`--html` 畫成看板 |
| `claim feature\|abstract\|adr <slug>` | 鑄號建檔;feature 另加進 Features 表並綁進 `--milestone`;配號看同一個 repo 的每一棵工作樹 |
| `requirement add` / `invariant add` | 鑄 `R-n` / `INV-n` 寫進 `system.md` |
| `objective add` / `milestone` / `refinement` | 鑄 `O-n` 建目標檔 / 鑄 `M-n-<slug>` / 鑄 `RF-n` 指定動到的 feature |
| `lint ids` | 兩個檔案同號、號段行讀不懂或重疊、`owner` 的號不在自己的區間內 |
| `lint boundary` | 全域 Law 的架構:import 方向 vs 層表;非最外層碰 IO 模組;未登記與幽靈檔案 |
| `lint sig` | Steps 簽名 vs 程式碼:找得到、匯出、簽名一致、型別都宣告過、`=` / `o` / `!` 列的層與份數、abstract 有消費者、feature 不引用 feature |
| `lint laws` | scope law:三行齊全、種類合法、識別字對得到簽名或型別、`=` 列至少一條 law、example 指得到 law;需求的驗收同一套查 |
| `lint trace` | laws / examples ↔ 測試歸屬:未翻譯、幽靈引用;需求的驗收寫了三行卻沒有驗收測試 |
| `lint io` | 全域 Law 的契約:`untrusted` 的入口有驗證 step、契約欄指到的 law 存在、文檔沒有秘密字面值、最外層沒有未登記的出入口 |
| `lint invariants` | 全域 Law 的領域不變量:編號、種類、三行只准引用最內層、寫了三行就有 `INV-n#LAW` 測試 |
| `lint global` | 全域 Law 三類一次查完:`boundary`(架構)+ `io`(契約)+ `invariants`(領域不變量) |
| `lint all` | 以上全部 |
| `sync` / `modules --gen` | 同層搬家的 step 改模組欄 / 從程式碼補模組表 |
| `migrate laws` / `migrate objectives` / `migrate <.design>` | `system.md` 沒有「全域 Law」區的樹把三類約束收進那一區 / 目標還擠在一份 `objectives.md` 的樹拆成 `objectives/` / `subsystems/` 體系的遷移帳本(只印不改) |

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

`devflow claim` 自動讀 `git config user.email`(`GIT_AUTHOR_EMAIL` 優先),從自己區間內的最大號往上配,frontmatter 寫 `owner`;email 不在號段行上就停。號段只管一檔一號的 feature / abstract / ADR;需求、領域不變量、目標、里程碑、調整住共用檔,一律從最大號往上配。同一台機器上每條切片各住各的工作樹,`claim` 配號時看得到彼此;不同機器上各自 claim 的同號由 `lint ids` 抓,放進 PR 的 CI 就是安全網。單人專案寫 `無` 或不寫這一行,行為不變。

## lawful

Haskell 這類純函數式專案(functional core / imperative shell)的需求導向開發。流程、skill 名稱與 Law 的定義都與 dev-flow 相同:需求(必須達成)與全域 Law(不得違反)先講好,`spike-impl` 先貫通一條切片,`law-design` 對著它談 Law,`build` 帶 qa 與 refactor 讓每條 law 成立,`integrate` 是唯一發 PR 的出口。文檔住 `.lawful/`,單位是 **pipeline**:input → 純轉換 → output 的資料流,兩端碰 shell 的是 IO 介面、只在純核心裡的是子流。

與 dev-flow 的差異:

- **四層固定**:`types ← effect ← core ← shell`,一層一棵原始碼樹(預設 `src-<層>`),各是建置系統的一個子函式庫,依賴方向由編譯器擋、`lint boundary` 再對一次。`=` 列是純的整條、`!` 列是 shell 進入點、`o` 列是觀察點。
- **模組單元**:`modules.md` 一列一個單元(名字、職責、有哪幾層);切片要一個還沒有的單元或層,先 `lawful module` 劃邊界。pipeline 的 slug 是 `<領域名詞>-<動詞>`,領域名詞是 `=` 列住的單元。
- **Cone.md**:願景、需求(R-n 與驗收)、全域 Law(領域不變量 INV-n、架構:四層、契約:對外 I/O)、專案約束(語言、三道指令、模組前綴、原始碼根目錄、硬性要求的套件、號段、優先各級)。領域不變量只引用 types 層。
- **stage 之間不用無名容器**:`lint sig` 擋 aeson `Value` 這類型別,形狀要有名字。
- 共用的東西是被引用的**子流** pipeline,沒有 abstract。

Skills:`project`、`objective`、`module`、`spike-impl`、`law-design`、`build`、`qa`、`refactor`、`revise`、`integrate`、`status`、`audit`、`study`。CLI `lawful` 的子命令與 `devflow` 相同(status、claim、requirement / invariant / objective、lint、sync、section、brief),另有 `module`、`rename`、`migrate laws`(全域 Law 還沒收進 `Cone.md`、需求還寫著 Law 的樹)、`migrate cone`(只有 `system.md` 的樹)與 `migrate from-dev-flow`。adapter 是 Haskell(認 hspec 與 tasty 兩種測試輸出)。

```
.lawful/
├── Cone.md                         # 願景、需求(R-n 與驗收)、全域 Law 三區、專案約束
├── objectives/R-1-O-1-<slug>.md    # 一檔一個目標:優先、里程碑(M-n-<slug>)、調整(RF-n)
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
