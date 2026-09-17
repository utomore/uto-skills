# uto-skills

Claude Code 的 plugin marketplace:**spec 驅動開發**與**演講內容產生**的工作流程。

| Plugin | 用途 | Skills | CLI |
|---|---|---|---|
| [dev-flow](#dev-flow) | 一般程式語言專案的 spec 驅動開發 | 13 | `devflow` |
| [lawful](#lawful) | 純函數式專案(functional core / imperative shell)的 spec 驅動開發 | 13 | `lawful` |
| [talk-flow](#talk-flow) | Marp 投影片的主軸、段落、實作與審查 | 6 | — |

dev-flow 與 lawful 是同一套方法的兩種形狀:文檔是唯一真相、簽名住在程式碼裡、性質由 property test 承接、進度由 CLI 從程式碼與測試推導。前者的邊界由專案自己宣告(層由內而外),後者的邊界由純度決定(四層固定)。

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

一般程式語言專案的 spec 驅動開發,不限語言。所有文檔住專案的 `.design/`,檔名英文 kebab-case,內文繁體中文。

### 核心概念

- **feature 是文檔單位**:一段從對外邊界進、從對外邊界出的資料流,一份 `F-00x-<slug>.md` 就是它的唯一真相,從搖籃到墳墓。沒有子系統這一層,沒有 bug 文檔:bug 就是某條 law 在現況下不成立。
- **簽名住在程式碼裡**:Steps 表每一列是一條正規式簽名 `name(T1, T2): R`,型別與簽名的骨架在設計階段就與文檔一起寫進 `design/<全名>` 分支,`lint sig` 全綠才能拍板 `ready`,經 PR 合進主線後才 `build`。`=` 列是整條、`o` 列是觀察點、`!` 列是進入點。
- **law 是純 ASCII 三行**:`forall` / `given` / `|-`,識別字只能是 Steps 的簽名、最內層的匯出或型別名;`given` 的呼叫先發生,命令式的時序也寫得出來。每條 law 由一條 property test 承接,測試以 `F-00x#LAW-n` 宣告歸屬。
- **四層「為什麼」**:`system.md` 的願景(北極星)與需求(每條一個可判定的 Requirement Law);`objectives/` 一檔一個目標(解決恰好一條需求,有 Objective Law 與優先 1 到 4);目標底下的建置路線(里程碑綁定 feature)與優化路線(調整只動既有 feature 的品質)。
- **邊界由專案宣告**:層由內而外,內層不准 import 外層,最外層是唯一能做對外 I/O 的層;對外 I/O 表帶信任與驗證兩欄,`untrusted` 的入口必須指名驗證 step。
- **abstract 是收整出來的**:兩份以上 feature 長出同一段東西,`refactor` 抽成 `A-00x`,被動到的每一份記一條 REV;少於兩個消費者就該搬回去。feature 之間不互相引用。
- **進度不是欄位**:`status` 只有 `draft` / `ready` / `frozen` 三格,都是人才知道的決定;做到哪、需求 Law 成立了沒、下一步做什麼,由 `devflow status` 從程式碼與測試推。

### 工作流程

```
/project ──▶ /objective ──▶ /feature ──▶ /integrate ──▶ /build ──▶ /integrate
 立案         目標與里程碑     一份文檔      設計 PR        qa + impl    合成一條 PR
                                  ▲                          │
                                  └──────── /revise ◀────────┘  GAP 答完、契約要改
```

- 設計階段(`project` / `objective` / `feature` / `refactor`)由開發者與 skill 對談,在 `design/<全名>` 分支上產出文檔與骨架,經 `integrate` 發 PR 合進主線後才能 `build`。
- 建構階段(`build`)由 conductor 在 `build/<全名>` 分支與工作樹上帶兩個互不可見的角色:`qa` 只讀文檔寫測試,`impl` 只讀骨架填本體;先在骨架快照上跑基線,再仲裁每一條紅。互不引用的文檔同時各開一波。
- 整合階段(`integrate`)是唯一發 PR 的出口:依開發日誌定順序、逐條 merge、整套綠了才 `gh pr create`。
- 隨時可跑:`status` 派工報告、`audit` 稽核、`spike` 可行性驗證、`study` 專案導讀。

### Skills

| Skill | 做什麼 |
|---|---|
| `/project` | 訪談後產出 `system.md`(願景、需求與 Requirement Law、語言與工具、層、對外 I/O、Features 清單)、`objectives/` 與 `modules.md`;每條要交付的能力 `devflow claim` 成 `draft` |
| `/objective` | 目標三問(What / How / Which)、里程碑綁定 feature、調整動到哪些 feature、重排優先 |
| `/feature` | 一份 `F-00x`:Brief、Steps、Laws、Examples、決定;把型別與簽名的骨架寫進程式碼,三道 lint 過了改 `ready` |
| `/refactor` | 兩份以上 feature 的共同部分抽成 `A-00x`,原檔改成「見 A-00x」,各記一條 REV |
| `/build` | conductor:開分支與工作樹 → 對帳骨架 → 派 qa → 基線 → 派 impl → 仲裁 → 驗收測試 → 整套 → 日誌;目標也可以直接是 `R-n` / `O-n`(只派 qa 寫驗收測試) |
| `dev-flow:qa` | 委派角色:每條 law 一條 property test、每個 example 一條 example test;禁止讀任何實作 |
| `dev-flow:impl` | 委派角色:把骨架標記換成實作;禁止讀寫測試、禁止改簽名與型別 |
| `/revise` | 任何對既有文檔的改動都改原檔:回答 GAP、落地調整、寫一條 REV、必要時解凍 |
| `/status` | 派工報告:需求 Law 成立了沒、目標與里程碑完成度、今天能開幾條線、卡住的、警訊、建議路線;`--html` 畫成看板 |
| `/audit` | 四段稽核:對帳、需求與目標、穩定度、安全度,產出「哪裡 / 什麼事 / 怎麼辦」表 |
| `/spike` | 讀原始碼答不出的問題:問題 / 判準 / timebox,拋棄式程式碼寫在 `spike/`,結案即刪、sha 留在文檔 |
| `/study` | 六層縮放的專案導讀:全景 → 架構 → 理念 → 資料結構 → trace → 細讀,每個結論附 `檔案:行號` |
| `/integrate` | 唯一發 PR 的出口:設計分支單獨一條直接發;建構分支清理已合的、盤點候選、逐條 merge、建置與整套綠了才發,標題英文、內文繁中 |

### `.design/` 結構

```
.design/
├── system.md                       # 願景、需求(R-n 與 Requirement Law)、語言與工具、層、對外 I/O、Features
├── objectives/R-1-O-1-<slug>.md    # 一檔一個目標:Objective Law、優先、里程碑(M-n)、調整(RF-n)
├── modules.md                      # 模組表:相對路徑樣式 → 層
├── features/F-001-<slug>.md        # 一條從對外邊界進出的資料流
├── abstracts/A-001-<slug>.md       # 兩份以上 feature 收整出來的共用能力
├── gaps.md                         # 只裝 open 的 GAP
├── adr/ADR-001-<slug>.md           # 跨文檔的決定
└── spikes/SPK-001-<slug>.md        # 可行性驗證的結論;程式碼在 spike/SPK-001-<slug>/,結案即刪
```

### CLI:`devflow`

規章不靠自覺,靠一支 CLI 對帳。在有 `.design/` 的專案根目錄執行 `node <plugin>/bin/devflow.mjs <子命令>`;`--help` 列全部。

| 子命令 | 做什麼 |
|---|---|
| `status [--tests <log> \| --run]` | 派工報告;`--doc` / `--module` 追問單份文檔或單一檔案;`--json` 給工具讀;`--html` 畫成看板 |
| `claim feature\|abstract\|spike\|adr <slug>` | 鑄號建檔;feature 另加進 Features 表並綁進 `--milestone` |
| `requirement add` | 鑄 `R-n` 寫進 `system.md` |
| `objective add` / `milestone` / `refinement` | 鑄 `O-n` 建目標檔 / 鑄 `M-n` 綁 feature / 鑄 `RF-n` 指定動到的 feature |
| `lint ids` | 兩個檔案同號、號段行讀不懂或重疊、`owner` 的號不在自己的區間內 |
| `lint boundary` | import 方向 vs 層表;非最外層碰 IO 模組;未登記與幽靈檔案 |
| `lint sig` | Steps 簽名 vs 程式碼:找得到、匯出、簽名一致、型別都宣告過、`=` / `o` / `!` 列的層與份數、abstract 有消費者、feature 不引用 feature |
| `lint laws` | 三行齊全、種類合法、識別字對得到簽名或型別、`=` 列至少一條 law、example 指得到 law;需求與目標的 Law 同一套查 |
| `lint trace` | laws / examples ↔ 測試歸屬:未翻譯、幽靈引用;需求與目標 Law 寫了三行卻沒有驗收測試 |
| `lint io` | 對外 I/O 表:`untrusted` 的入口有驗證 step、文檔沒有秘密字面值、最外層沒有未登記的出入口 |
| `lint all` | 以上全部 |
| `sync` / `modules --gen` | 同層搬家的 step 改模組欄 / 從程式碼補模組表 |
| `spike close` | 檢查 verdict / feeds / sha 齊全,刪 `spike/` 的程式碼 |
| `migrate objectives` / `migrate <.design>` | 目標還擠在一份 `objectives.md` 的樹拆成 `objectives/` / `subsystems/` 體系的遷移帳本(只印不改) |

### 語言 adapter

語言相關的事全部走 adapter,讀取層不認識任何語言。模組的身分是相對專案根目錄的檔案路徑。

| adapter | 副檔名 | 匯出 | 骨架標記 | 測試輸出 |
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

`devflow claim` 自動讀 `git config user.email`(`GIT_AUTHOR_EMAIL` 優先),從自己區間內的最大號往上配,frontmatter 寫 `owner`;email 不在號段行上就停。號段只管一檔一號的 feature / abstract / spike / ADR;需求、目標、里程碑、調整住共用檔,經設計 review。`lint ids` 抓同號與區間重疊,放進 PR 的 CI 就是安全網。單人專案寫 `無` 或不寫這一行,行為不變。

## lawful

純函數式專案的 spec 驅動開發。文檔住 `.lawful/`,單位是 **pipeline**:input → 純轉換 → output 的資料流,兩端碰 shell 的是 IO 介面、只在純核心裡的是子流。

與 dev-flow 的差異:

- **四層固定**:`types ← effect ← core ← shell`,一層一棵原始碼樹(預設 `src-<層>`),各是建置系統的一個子函式庫,依賴方向由編譯器擋、`lint boundary` 再對一次。`=` 列是純的整條、`!` 列是 shell 進入點。
- **模組單元先於 pipeline**:`modules.md` 一列一個單元(名字、職責、有哪幾層);要新單元先 `lawful module` 劃邊界再 claim。pipeline 的 slug 是 `<領域名詞>-<動詞>`,領域名詞是 `=` 列住的單元。
- **Cone.md 取代 system.md**:願景、需求、專案約束(語言、三道指令、模組前綴、原始碼根目錄、硬性要求的套件、號段、優先各級)。
- **stage 之間不用無名容器**:`lint sig` 擋 aeson `Value` 這類型別,形狀要有名字。

Skills 與 dev-flow 同形:`design`、`objective`、`module`、`pipeline`、`build`、`qa`、`impl`、`revise`、`status`、`audit`、`spike`、`integrate`、`study`。CLI `lawful` 的子命令同形,另有 `module`、`rename`、`migrate cone`(只有 `system.md` 的樹換成 `Cone.md` 體系)與 `migrate from-dev-flow`。第一個 adapter 是 Haskell(認 hspec 與 tasty 兩種測試輸出)。

```
.lawful/
├── Cone.md                         # 願景、需求、專案約束
├── objectives/R-1-O-1-<slug>.md
├── modules.md                      # 四層邊界、模組單元表、對外 I/O
├── pipelines/P-001-<slug>.md       # Brief、Stages、Laws、Examples、決定
├── gaps.md
├── adr/
└── spikes/
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
│   ├── rules/                      # 四份主題規章(features / boundary / roles / tooling):每條規則唯一的住處
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
