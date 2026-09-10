# uto-skills

utomore 的 Claude Code plugin marketplace。目前收錄三個 plugins:**dev-flow**(一般程式語言的 spec 驅動開發)、**lawful**(純函數式專案的 spec 驅動開發)、**talk-flow**(演講內容產生流程)。

## dev-flow

一般程式語言專案的 **spec 驅動開發** plugin,不限語言。

文檔的單位是 **feature**:一段從對外邊界進、從對外邊界出的資料流,直接掛在 `system.md` 底下 —— **沒有子系統這一層**。feature 之上是三層「為什麼」:`system.md` 的**願景**、`objectives.md` 的**目標**(優先 1 到 4、可觀察的判準)與目標底下的**里程碑**,每條里程碑綁定它要做到的 feature。feature 之間長出來的共同部分由 `refactor` 收整成 **abstract**,被動到的每一份記一條 REV。**進度不是欄位**:`devflow status` 從程式碼與測試推導,沒有任何一格要人記得改。

| 指令 | 職責 |
|---|---|
| `/project` | 立案 — 訪談後產出 `.design/system.md`(目的與期望、語言與工具、**由內而外的層**、對外 I/O 表含**信任與驗證**兩欄、Features 清單)與 `modules.md` 模組表,跨文檔的決定寫 ADR,每條要交付的能力 `devflow claim` 成 `draft` |
| `/objective` | 目標與里程碑 — `O-n` 一句話加優先(1 到 4)與可觀察的判準,切成有順序的 `M-n`,每條里程碑綁定它要做到的 feature;也回答「這份 feature 服務哪個目標」。**每個目標都要能說出它服務願景的哪一句**,說不出來就是分歧 |
| `/feature` | 一份功能文檔 — `F-00x` 是一條使用者能做到的事的唯一真相:Brief、Steps(正規式簽名 `name(T1, T2): R`,`=` 整條 / `o` 觀察點 / `!` 進入點)、Laws(純 ASCII 三行)、Examples、決定,寫完改 `ready` |
| `/refactor` | 收整 — 把兩份以上 feature 之間可以抽象統一的部分抽成 `A-00x`,原檔那幾列改成「見 A-00x-…」,每一份被動到的 feature 各記一條 REV。**abstract 少於兩個消費者就該搬回去**,腳本盯著 |
| `/build` | 建構指揮(conductor)— 開 `build/<全名>` 分支與工作樹 → 骨架 → 派 qa → 在骨架快照上跑基線 → 派 impl → 跑子集 → 仲裁四分流 → 全綠後整套一次 → 達成改 `frozen` → 寫開發日誌。**互不引用的文檔可以同時各開一波**,合併交給 `/integrate` |
| `dev-flow:qa` | **委派角色**(不在斜線選單)— 只讀文檔、最內層的匯出與骨架簽名,每條 law 一條 property test;禁止讀任何實作 |
| `dev-flow:impl` | **委派角色** — 把骨架標記換成實作;禁止讀寫任何測試檔、禁止改簽名 |
| `/revise` | 修訂 — 任何對既有文檔的改動都改原檔:回答 GAP、寫一條 REV(依 / 動到 / 保護 / 重委派 / 連動)、必要時解凍。**不開第二份檔** |
| `/status` | 派工報告 — 先講願景與目標表(最高優先的目標卡在哪條里程碑、哪份 feature 不朝向任何目標),再照八段講今天能開幾條線、卡住的、等決定、牽動誰、待實作、**修訂熱點**、警訊、建議路線 |
| `/audit` | 稽核四段 — **對帳**(機械紅逐條分類)、**目標貼合度**(每個目標服務願景的哪一句、工作有沒有集中在最高優先、有沒有 feature 不朝向任何目標)、**穩定度**(修訂熱點、改動半徑、收整成立了沒、卡多久)、**安全度**(信任與驗證、秘密字面值、沒登記的出入口、進入點有沒有繞過整條) |
| `/spike` | 可行性驗證 — 讀原始碼答不出來的問題,先寫問題 / 判準 / timebox,再在 `spike/SPK-00x-<slug>/` 寫拋棄式程式碼,結案即刪、sha 留在文檔 |
| `/study` | 專案導讀 — 六層縮放(全景 → 架構 → 理念 → 資料結構 → trace → 細讀),每個結論附 `檔案:行號` 證據,一次一課 |
| `/integrate` | 整合分支發 PR — 唯一發 PR 的出口:清掉已合的 build 分支與工作樹、`build/<全名>` 讀它的開發日誌定順序與衝突預報、逐條 merge、建置與整套綠了才發;標題英文、內文繁中、打 labels |

### CLI:`devflow`

規章不靠自覺,靠一支 CLI 對帳(`plugins/dev-flow/bin/devflow.mjs`,吃 `--help`):

| 子命令 | 回答什麼 |
|---|---|
| `status [--tests <log> \| --run]` | 派工報告;`--doc` / `--module` 追問單份文檔或單一檔案 |
| `claim feature\|abstract\|spike\|adr <slug>` | 鑄號建檔;feature 另在 Features 表加一列並綁進 `--milestone` 那條里程碑,spike 另建程式碼資料夾 |
| `objective add` / `objective milestone` | 鑄 `O-n`(優先 1 到 4、判準)/ 鑄 `M-n` 加進該目標並綁定 feature;綁 abstract 或不存在的全名會被擋 |
| `lint boundary` | import 方向 vs 層表;內層 import 外層、非最外層碰 IO 模組、未登記與幽靈檔案 |
| `lint sig` | Steps 簽名 vs 程式碼,而且要匯出;`=` / `o` / `!` 列的層與份數;**abstract 沒有消費者**、**feature 引用 feature**、同名簽名兩邊都沒註明「見」 |
| `lint laws` | 三行齊全、種類合法、識別字對得到簽名或型別、`=` 列至少一條 law、example 指得到 law |
| `lint trace` | laws / examples ↔ 測試歸屬:未翻譯、幽靈引用 |
| `lint io` | 對外 I/O 表;**untrusted 的入口必須指名驗證 step**;文檔裡的秘密字面值;最外層沒登記的出入口 |
| `sync` / `modules --gen` | 同層搬家的 step 改模組欄 / 從程式碼補模組表 |
| `migrate <.design>` | 舊 `subsystems/` 樹的遷移帳本:介面在程式碼裡對到幾條、四格 law 翻成三行草稿、共用簽名列成 abstract 候選、退場清單。**只印帳本,不改任何檔** |

### language adapter

語言相關的事全部走 adapter,讀取層不認識任何語言:

| adapter | 副檔名 | 匯出 | 骨架標記 | 測試輸出 |
|---|---|---|---|---|
| `typescript`(含 javascript) | `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` | `export` | `throw new Error(…)` | jest / vitest / mocha |
| `python` | `.py` | `__all__`,沒寫就是不以底線開頭的 | `raise NotImplementedError` | pytest / unittest |
| `go` | `.go` | 大寫開頭 | `panic(…)` | `go test -v` |
| `rust` | `.rs` | `pub` | `todo!()` | `cargo test` |

模組的身分是**相對專案根目錄的檔案路徑**(package / crate / dotted module 各語言不一致,路徑一致)。**型別註記可有可無的語言**(Python、JavaScript)照樣對得到帳:程式碼那一側沒有註記時只比名字與參數個數,並列 info 說明。沒有 adapter 的語言 `lint sig` 與 `lint boundary` 跳過,其餘照常。

規章住 `plugins/dev-flow/rules/` 四份主題檔(`features.md` / `boundary.md` / `roles.md` / `tooling.md`),**每條規則只有一個住處**;skill 只寫步驟並用檔名加節名引用,不重述。

## lawful

**純函數式專案**(functional core / imperative shell)的 spec 驅動開發,不限語言。文檔單位是 **pipeline**(input → 純轉換 → output),stage 是住在程式碼裡的簽名,laws 是純 ASCII 三行的形式化性質、由 property test 承接;模組表宣告 `types / effects / pure / shell` 四層邊界,`=` 列是純的整條、`!` 列是 shell 進入點。pipeline 之上同樣是願景、目標與里程碑。skills:`design`、`objective`、`pipeline`、`build`、`qa`、`impl`、`revise`、`status`、`audit`、`spike`、`integrate`;CLI `lawful` 的子命令與 dev-flow 同形,第一個 adapter 是 Haskell。

dev-flow 與 lawful 是**同一套方法的兩種形狀**:前者的邊界由專案自己宣告(層由內而外),後者的邊界由純度決定(四層固定)。專案是純函數式的用 lawful,其餘用 dev-flow。


## talk-flow

演講內容產生流程的 Claude Code plugin,投影片以 **Marp Markdown** 撰寫、**marp-cli** 建置輸出(html / pdf / pptx),SVG 只用來畫圖形(架構圖、流程圖等),講稿簡化為頁內備註(presenter notes,提醒式、不寫逐字稿)。**投影片上的文案一律直述句** —— 對比翻轉句(「分不出差別,不等於一樣好」)與人稱代名詞(「我們」「大家」)是全流程的硬性禁區,**每頁標題一句話寫出這頁的重點主軸**(非必要不用逗號、不寫「介紹/說明什麼」的描述),產文時不得違反、`/review` 逐條扣分,規範見 `_shared/wording.md`。包含六個 skills:

流程是三層階梯,**每層只決定自己顆粒度的事**:Level 1 定語意(核心訊息、段落切分、視覺規範的語意)、Level 2 定內容(每頁講什麼、要不要圖)、Level 3 定呈現(版型、動線、SVG 幾何、theme 數值)。**視覺數值的唯一真相是 `talk/src/theme.css`**,`docs/` 的文件只記決定與理由,不複製一份 px 或色碼;下層需要上層沒定義的東西就回上層加,不在本層私設。

| 指令 | 職責 |
|---|---|
| `/topic-design` | **Level 1** 演講主軸設計 — 深度訪談時長/聽眾/會議類型/輸出格式,依場合選定**風格基底**(tech-deep/keynote-impact/intro-friendly/workshop-guide/exec-brief,見 `_shared/styles.md`,為版面/配色/分層/文字/圖形/節奏定預設方向),討論**前景/背景分層**的語意(要不要背景、素材從哪來、幾套各對應演講的什麼結構,見 `_shared/layers.md`),提供 3 組主題方案供選擇,產出燈塔文件 `docs/topic.md`(含**文字規範**:級別↔情境、強調方式用途、列表符號語意,執行期只能從中選用;與**投影片分層**:背景套數↔語意、角標 —— 兩節都只記語意不記數值)、Marp 鷹架(`talk/src/`:theme.css 填起始值、deck-header.md、build.mjs、.marprc.yml)與各 section 佔位文檔 |
| `/section-design` | **Level 2** 段落設計 — 逐段規劃討論方向、內文內容與形式(條列/表格/段落)、是否需要圖形輔助與圖形類型(見 `_shared/diagrams.md` 的選型表)、每頁的一句話重點與背景的語意需求;不指定版型、背景類別與圖形畫法。產出完整 `docs/section-0x-*.md`;子命令 `status` 用腳本掃描各段落狀態並比對 `topic.md` 的 `sections` 清單 |
| `/section-impl` | **Level 3** 段落實作(在上層規範內有完全的呈現自主權)— 逐頁決定 Layout(整頁單一區塊/左右/上下/上中下/三等份/四象限/上三下二…,版型詞彙見 `_shared/layouts.md`)與**背景類別**(`bg-none`/`bg-soft`/`bg-strong`/`bg-2`/`bg-3`),並對每頁說得出**視覺動線**,文字技法只從文字規範選用,撰寫 `talk/src/section-0x-*.md` 的 Marp 頁面與 `<!-- 備註 -->`,繪製圖形 SVG(規範見 `_shared/diagrams.md`,含**截圖加註**:原圖 base64 內嵌 SVG 疊編號標記 + 圖下對應圖例),`node build.mjs` 建置驗收;第一段完成後做**分層強度定案**(調 theme.css 的 `--bg-opacity`,不回寫 topic.md);需要時建立 `demo/` |
| `/page-adjust` | **Level 3** 單頁調整 — 針對指定頁面深談 Layout/內文/圖形/背景/備註調整(文字技法仍受 topic.md 文字規範約束、背景仍受投影片分層的語意約束;theme.css 數值調整屬本層職權,不回寫 topic.md),修改 Marp 原始碼與 SVG 後重 build,同步 section 設計文件 |
| `/svg-layout` | 架構圖 SVG 排版量測(唯讀三腳本)— `normalize.py` 補齊語意化 id 與 `data-role/from/to`(只寫標註不動幾何,id 穩定不漂移);`inspect_svg.py` 輸出 scene digest(累積巢狀 transform 的絕對 bbox、以 fontTools 實測中英混排標籤寬度、edge 拓撲、對齊與間距序列);`lint.py` 診斷 15 條規則(文字溢出/內距/投影字級/對比、連線端點間隙/穿越節點/標籤壓線/缺箭頭/交叉、尺寸間距不一致/幾乎對齊/超出畫布),每條給量化偏差與修正方向 |
| `/review` | 整體審查 — 腳本交叉比對段落覆蓋、deck↔docs 頁數同步、圖形引用完整性、**分層資產與背景槽位**、依賴順序、時間帳與產物新鮮度,再 **build 後逐頁目視** Layout、視覺引導動線、文字規範遵循(字級/強調/列表符號/行距)、版型與配色收斂、**前景/背景分層**(背景有沒有搶第一眼、正文讀不讀得清、換背景對不對得上語意)、圖形連接線轉折(>2 折扣分)、備註品質、用語概念一致、**文案語感**(對比翻轉句「A,不等於 B」「不是 A,而是 B」、人稱代名詞「我們/你/大家」、空泛詞,以及**標題寫法**「逗號串兩件事/描述式標題/標題帶前提」 —— 腳本先給命中清單,確認後逐條扣分,標題/副標出現翻轉句或人稱是阻斷項)與 AI 感,並判斷主軸貼合度、偏題比例、銜接與難度峰值,產出十四項指標的審查報告 `review/review-<日期>-<序號>.md`;不修改任何原始碼 |

演講專案的資料夾結構:`docs/`(topic.md 與 section 設計文件)、`talk/src/`(Marp 原始碼與設定:deck-header.md、每 section 一檔 `section-0x-*.md`、theme.css、build.mjs、.marprc.yml)、`talk/assets/`(圖形 SVG `diagram-<section>-<序號>-<slug>.svg`、背景 `bg-<slug>.svg`、角標 `logo.svg`)、`talk/dist/`(marp-cli 輸出產物,不手改)、`review/`(審查報告)、`demo/`(可選)。每份手寫文件(含圖形與背景 SVG)都有 metadata;共用慣例與**層級顆粒度表**在 `plugins/talk-flow/skills/_shared/conventions.md`,版型詞彙在 `_shared/layouts.md`,風格基底在 `_shared/styles.md`,分層(前景/背景)詞彙在 `_shared/layers.md`,圖形(選型表、繪圖紀律、截圖加註)在 `_shared/diagrams.md`,**文案語感**(禁用句型、人稱指稱與正面寫法)在 `_shared/wording.md`。

投影片分**背景層**(裝飾,`section::before` 畫,不承載資訊)與**前景層**(標題、內文、圖形、頁碼、固定角標)。背景可以是 CSS 漸層、使用者提供的圖片,或 LLM 依討論出的風格現畫的 SVG(`topic-design/assets/backgrounds/` 附三張起手範本);全場最多三套背景槽(`--bg-image` / `--bg-image-2` / `--bg-image-3`),**每頁背景都可以不同** —— 頁面用 `<!-- _class: bg-2 bg-strong -->` 這類類別切換,強度由 `--bg-opacity` 控制,圖表/截圖頁用 `bg-none` 關掉。`/topic-design` 定「幾套、各代表什麼」,`/section-impl` 決定逐頁用哪一個並在有真實頁面後定案強度。

## 安裝(新環境一鍵導入)

在 Claude Code 內執行:

```
/plugin marketplace add utomore/uto-skills
/plugin install dev-flow@uto-skills
/plugin install lawful@uto-skills
/plugin install talk-flow@uto-skills
```

或在終端機執行:

```
claude plugin marketplace add utomore/uto-skills
claude plugin install dev-flow@uto-skills
claude plugin install lawful@uto-skills
claude plugin install talk-flow@uto-skills
```

## 更新

repo 有新版本後:

```
/plugin marketplace update uto-skills
```

## 文檔慣例摘要(dev-flow)

所有文檔放在專案 `.design/`,檔名英文 kebab-case、內文繁體中文:

```
.design/
├── system.md                   # /project:目的、語言與工具、層、對外 I/O、Features 清單
├── modules.md                  # 模組表:相對路徑 → 層(`src/domain/**` 這種樣式)
├── features/F-001-<slug>.md    # /feature:一條從對外邊界進出的資料流
├── abstracts/A-001-<slug>.md   # /refactor:兩份以上 feature 收整出來的共用能力
├── gaps.md                     # 只裝 open 的 GAP;空了刪檔
├── adr/ADR-001-<slug>.md       # 跨文檔的決定
└── spikes/SPK-001-<slug>.md    # /spike;程式碼在專案根目錄 spike/SPK-001-<slug>/,結案即刪

spike/SPK-001-<slug>/           # 與 .design/ 同層,只活在 open 期間
```

### 進度是推導出來的,不是欄位

`status` 只有 `draft`(還在討論)、`ready`(開發者拍板,可以委派)、`frozen`(達成,不准修訂),**三格都只放人才知道的決定**。做到哪由 `devflow status` 算:

| 數字 | 怎麼算 |
|---|---|
| 簽名 m / n | Steps 的步驟 n 條;程式碼找得到且簽名對得上 m 條 |
| 骨架 s | m 條裡本體還是骨架標記的 s 條 |
| laws g / k | 寫了 k 條;測試宣告歸屬 j 條;綠 g 條 |
| 達成 | m = n、s = 0、觀察點全在、g = k、examples 全綠、沒有 open GAP;feature 還要它引用的每份 abstract 都達成 |

沒有 `planned / specced / done`、沒有 `rev` 欄、沒有 `code-paths`、沒有生成的索引表 —— 那些都是「要記得改」的格子,而要記得改的格子一定會爛掉。

### 簽名:一種正規式,四種語言

文檔一律寫 `name(型別, 型別): 回傳型別`,adapter 負責把各語言的宣告正規化成它。**參數名不寫**(改參數名是實作自由,不是契約變動);方法寫 `型別.方法`,接收者 / `self` / `cls` 不算參數。

### law:純 ASCII 三行,`given` 帶時序

```markdown
- LAW-1 [state] 換發成功之後,舊的 TokenId 立刻失效
  - forall t in TokenId, s in TokenStore, now in Instant
  - given isOk(refresh(mkReq(t), s, now))
  - |- isValid(lookup(t, s), now) == false
```

`|-` 行的每個識別字必須對得到 Steps 的簽名、最內層的匯出、程式碼裡的型別名,或 adapter 的標準函式庫名 —— `lint laws` 對帳,對不到不准 `ready`。**`given` 行的呼叫先發生,`|-` 行在其後求值**:命令式語言的時序靠這一句表達,不必另立語法。

測試宣告歸屬 `F-00x#LAW-n`;測試名必須是識別字的框架(Python 的 `def`、Rust 的 `fn`)寫成 `f_00x__law_n`,兩種寫法 `lint trace` 都認。

### abstract 的存在條件

| 消費者 | 判定 |
|---|---|
| 0 份 | `lint sig` 紅:死的抽象,刪掉 |
| 1 份 | `status` 警訊:收整沒有成立,搬回那一份 feature |
| 2 份以上 | 成立 |

**feature 之間不互相引用**:兩份 feature 需要同一段東西,那一段就是一份 abstract。同名簽名出現在兩份文檔而沒有一邊註明「見」就是紅 —— 那正是該走 `/refactor` 的訊號。

### 安全度掛在對外 I/O 表上,不是一份通用清單

`system.md` 的對外 I/O 表帶 **信任**(`trusted` / `untrusted`)與 **驗證**(哪個 step 做驗證)兩欄。`lint io` 對帳三條:`untrusted` 的入口沒有驗證 step、Laws 與 Examples 出現密碼 / 金鑰 / token 樣式的字面值、最外層 import 了 IO 模組卻沒登記在表上。三條都是這個專案自己的事實。

### 沒有 bug 文檔

bug = 某條 law 在現況下不成立:law 已存在就修碼,沒寫到就補 law 走 REV。一個功能一份檔,從搖籃到墳墓。

### 測試

改過 `plugins/dev-flow/{bin,lib}/` 之後跑 `bash tests/dev-flow/run.sh`:七個夾具(健康的 TypeScript 樹、剛從模板複製出來的空樹、每一種紅各一次的破樹、Python / Go / Rust 各一份、舊樹的遷移帳本)三十三道 golden 逐字比對,加 `--help`。行為刻意改了才 `--update`。測試與夾具住 repo 根目錄的 `tests/`,不隨 plugin 安裝。


## Repo 結構

本 repo 同時是 marketplace 與 plugin 本體,但兩者分層:

```
.claude-plugin/marketplace.json     # marketplace「uto-skills」定義
plugins/
├── dev-flow/                       # ← 安裝時只有被裝的 plugin 目錄被複製
│   ├── .claude-plugin/plugin.json  # plugin「dev-flow」(skill 前綴 dev-flow:)
│   ├── rules/                      # 四份主題規章:每條規則唯一的住處
│   ├── bin/devflow.mjs             # 單一 CLI
│   ├── lib/                        # 讀取層與 language adapter
│   ├── templates/                  # 建檔用的骨架
│   └── skills/                     # 各 skill 的 SKILL.md(只寫步驟,規則引用 rules/)
├── lawful/                         # 同形,四層邊界由純度決定
└── talk-flow/
    ├── .claude-plugin/plugin.json  # plugin「talk-flow」(skill 前綴 talk-flow:)
    └── skills/
tests/                              # 夾具與 golden,不隨 plugin 安裝
wip/                                # 設計稿與決定紀錄,只在 repo,不進 payload
README.md                           # 只在 repo,不進 payload
```

`marketplace.json` 的 `plugins[].source` 指向各 plugin 目錄(如 `./plugins/dev-flow`),安裝時**只有該子目錄**會被複製進使用者的 `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`。repo 根目錄的 `README.md`、`docs/` 等開發用檔案不會進到 payload — 使用者每裝一個版本就多一份快照,payload 保持精簡是有意義的。

日後新增 plugin:在 `plugins/` 下開新目錄,到 `marketplace.json` 的 `plugins[]` 加一筆即可。marketplace 名稱、plugin 名稱與 GitHub repo 名稱彼此獨立。

`wip/` 放**設計稿與決定紀錄**:推理過程、否決了什麼、為什麼這樣切。它不被任何 session 載入,所以可以有歷史;`plugins/` 底下的規章不行(規則見 `CLAUDE.md`)。還沒上架的 plugin 草稿也放這裡,目錄結構與 `plugins/` 下的一樣,但不在 `marketplace.json` 裡,Claude Code 也不會把它當成 skill(發現路徑是 `plugins/<plugin>/skills/<name>/SKILL.md`)。
