# uto-skills

utomore 的 Claude Code plugin marketplace。目前收錄兩個 plugins:

## dev-flow

三層階梯式(Level 1 主架構 → Level 2 子系統 → Level 3 Feature 實作)文檔驅動開發流程的 Claude Code plugin,遵循關注點分離與契約優先:架構階段只定義邊界契約與資料流(嚴禁過早具體化),實作階段在契約內擁有完全自主權。包含十一個 skills:

| 指令 | 層級 | 職責 |
|---|---|---|
| `/system-design` | L1 | 系統主架構 — 深度訪談後產出 `.design/system.md` + `.design/adr/ADR-00x-*.md`:技術棧、對外 I/O 契約、子系統劃分(Bounded Contexts)、通訊拓撲;只到子系統邊界顆粒度 |
| `/subsys-design` | L2 | 子系統架構 — 產出 `.design/subsystems/<slug>/design.md`:公開介面與 DTO、內部模組劃分、資料流管線、模組間抽象介面、feature 路線圖(功能規劃)與每個 feature 的**契約卡**,並回填主架構 `subsystems` 清單 |
| `/subsys-build` | L2→L3 | 子系統委派展開 — 依功能規劃的「依賴」欄排波次,**批次澄清一次問完** → 預先配號 → 委派 subagent 平行寫設計、階段內序列實作 → 每階段跑 `arch-audit` 後**停下來給人驗收**;配號、`design.md` 回填、`build-log.md` 由編排者單線負責 |
| `/feature-design` | L3 | 功能設計 — 深度討論後產出 `features/F00x-*.md`,介面必須落在 L2 契約內;含相依性查證、介面表、TodoList、1-to-1 測試(被委派時走「委派模式」:不提問,不確定寫成「待確認假設」) |
| `/enhance-design` | L3 | 優化設計 — 先讀程式碼、**與開發者討論確認 scope 涵蓋範圍**後,產出 `enhancements/E00x-*.md`(跨子系統為 `.design/enhancements/G-E00x-*.md`) |
| `/feature-impl` | L3 | 功能實作 — 依 feature 文檔逐項勾 TodoList、跑 1-to-1 測試、回寫 status;L2 契約內實作自主(被委派時碰到契約邊界就停下回報,不擅自改契約) |
| `/enhance-impl` | L3 | 優化實作 — 回歸測試先行,scope 標明不動的範圍絕對不碰,收尾記錄量化結果 |
| `/bugfix` | L3 | 缺陷修復 — 重現 → 建 `bugfixes/B00x-*.md`(跨子系統為 `G-B00x`)→ 先寫重現測試再修 → 保留回歸測試 |
| `/arch-audit` | 全 | 架構檢測 — `system`(子系統循環依賴、對外 I/O 契約一致性)/ `subsys`(資料流管線、SRP、邊界外洩、契約卡對帳)/ `feature`(L2 介面符合度、edge cases、型別安全、待確認假設)/ `status`(腳本盤點各 feature 完成度、契約卡就緒度與待優化模組) |
| `/branch-pr` | — | 整合多條 branch 發 PR(先確認當前分支,在 main 上就先開新分支;標題英文 conventional commit、內文繁中、labels 英文) |
| `/study` | — | 專案導讀(唯讀)— 由上而下帶開發者理解既有專案:全景(入口、技術棧、目錄職責)→ 架構(子系統邊界、依賴方向、通訊方式)→ 設計理念(理由逐條標來源:`[文檔]`/`[註解]`/`[commit]`/`[推測]`)→ 核心資料結構(定義、生產者/消費者、邊界轉換、不變量)→ **逐跳 trace code**(沿一條真實路徑從入口到輸出,附呼叫鏈摘要表);每課固定「結論 → 理由 → `檔案:行號` 原文片段證據 → 檢查點」,一次一課等開發者消化;有 `.design/` 就以它為地圖並對照程式碼驗證,沒有就從入口與目錄樹建工作假說 |

共用文檔慣例放在 `plugins/dev-flow/skills/_shared/`,依**載入時機**分五片:`conventions.md`(核心:樹狀資料夾結構、編號、引用格式、資訊抽象邊界規範,每個 skill 都讀)、`frontmatter.md`(YAML frontmatter 規格,要建檔時才讀)、`delegation.md`(**委派模式共通契約**,被委派或身為編排者時才讀)、`codegraph.md`(**程式碼知識圖整合**,專案建過圖時才讀)、`anchor.md`(**收尾定錨區塊**,每次收尾與階段閘門才讀)。每個 skill 開頭明列自己要讀哪幾片。

改 skill 前請先看 [docs/skill-authoring.md](docs/skill-authoring.md)——撰寫與維護準則(追加閘門、分片規則、成本量測)。

### 收尾定錨

每個 skill 的收尾與 `/subsys-build` 的每個階段閘門,回報的最後都固定附一個**定錨區塊**(格式在 `_shared/anchor.md`),四段順序固定:

1. **位置樹**:從 `.design/system.md` 畫到目前工作的文檔的 ASCII 樹,只畫最近的(所在子系統展開、其他子系統各一行),目前文檔之下列出它的介面與資料結構,狀態只用五個詞——契約 / 設計 / 實作中 / 完成 / 偏離——每條介面都註明對應 `design.md` 的哪一章,找不到就是偏離
2. **完成度**:整體 → 所在子系統 → 目前文檔的 done/Todo/測試數字,只能來自 `scan-status.mjs` 與文檔,不准估百分比
3. **主軸檢查**:本次動作對應到 `system.md` / `design.md` / 契約卡的哪一條,以及**偏離清單**(做了但上層沒寫的事,每條附位置與建議;沒有也要寫「無」)
4. **下一步**:一條具體命令,必須從樹上的「目前」推得出來,不得建議樹上沒有的工作

目的只有一個:一次執行只看得到自己那一小塊,連做幾次方向就會被眼前的工作帶走;把「在哪、多遠、偏了沒、接著做什麼」釘在每次收尾的最後,開發者每次都用同一個視角核對,LLM 就帶不歪。

### 選配:程式碼知識圖

專案裡有程式碼知識圖時,dev-flow 會把它當成**導航層**:`/arch-audit` 的 system / subsys scope 用 `scan-graph.mjs` 直接算出子系統依賴矩陣、循環依賴(附每條邊的 `檔案:行號` 證據)、跨界引用清單與架構 hub;`/feature-design` 用它定位既有介面在哪個檔案;`/enhance-design` 估改動的影響面;`/bugfix` 追呼叫鏈;實作類 skill 收尾時把圖更新到最新。

**契約是 `graph.json` 的格式,不是產生它的工具。** 下游只認「節點帶 `source_file`、邊帶 `relation`」這個形狀(完整規格見 `_shared/codegraph.md`),換產生器只要吐同格式,`scan-graph.mjs` 與七個 skill 接點一行都不用改;只給 `graph.json`、沒有查詢 CLI 的產生器也可用,架構檢測那一整塊由腳本自己算。目前登記的產生器有兩個:graphify(多語言啟發式抽取,不含 Haskell)與 [knot](https://github.com/utomore/knot-hs)(只服務 Haskell,從 GHC `.hie` 抽型別檢查後的事實,圖直接落在專案根的 `codegraph.json`);支援語言、建圖 / 更新指令與各自的查詢對應見該片的「目前的產生器」表。

界線只有一條:**圖是導航,不是查證**——它只說「去哪裡看」,寫進 `.design/` 的每個簽名、相依、契約違反都必須回原始碼讀到原文再確認。圖會過期、會漏抽、`INFERRED` 的邊是推測的,所以它不能取代 `/feature-design` 那條「必須打開原始碼讀到實際定義」的防線。

檔案級的圖要捲回子系統級,靠 `design.md` frontmatter 的選填欄位 `code-paths: [src/auth]`;沒填就只能猜路徑,腳本會把可信度警告印出來。**沒有圖的專案完全不受影響**:各 skill 判定不到圖就整段略過,照原流程走。

### 委派展開(`/subsys-build`)的設計要點

Level 2 把契約鎖死之後,Level 3 就變成**可委派**的:相依性查證、介面表、TodoList、1-to-1 測試都是機械性工作,不需要人。真正需要人的只有「功能邊界的取捨」,而那些可以**批次前置**到一次問完。整個流程建立在三個約束上:

- **subagent 問不了人** → 所有人類決策移到 fan out 之前的「批次澄清」;之後的不確定一律寫成文檔裡的「待確認假設」,由編排者在階段閘門呈報
- **誤差沿依賴鏈複利** → 閘門設在**階段**邊界(不是每個 feature,也不是全自動跑完);測試失敗或有阻塞就立刻停下本階段後續實作
- **平行會撞** → 配號(`F00x`)、`design.md` 回填、`build-log.md` 一律由編排者**單線**負責;feature 設計平行(各寫各的檔案),實作在階段內**序列**(同子系統常改同一批檔案)

用 subagent 的主要理由是 **context 隔離**:相依性查證要讀大量原始碼,那些 context 留在 subagent 裡,編排者只收結構化回報——即 conventions 裡「Context 載入紀律」的自動化版本。`build-log.md` 記配號表、委派決策、待確認假設彙總與各階段結果,讓中斷後能接續、事後查得到當初為什麼這樣決定。

## talk-flow

演講內容產生流程的 Claude Code plugin,投影片以 **Marp Markdown** 撰寫、**marp-cli** 建置輸出(html / pdf / pptx),SVG 只用來畫圖形(架構圖、流程圖等),講稿簡化為頁內備註(presenter notes,提醒式、不寫逐字稿)。**投影片上的文案一律直述句** —— 對比翻轉句(「分不出差別,不等於一樣好」)與人稱代名詞(「我們」「大家」)是全流程的硬性禁區,**每頁標題一句話寫出這頁的重點主軸**(非必要不用逗號、不寫「介紹/說明什麼」的描述),產文時不得違反、`/review` 逐條扣分,規範見 `_shared/wording.md`。包含六個 skills:

流程是三層階梯,**每層只決定自己顆粒度的事**:L1 定語意(核心訊息、段落切分、視覺規範的語意)、L2 定內容(每頁講什麼、要不要圖)、L3 定呈現(版型、動線、SVG 幾何、theme 數值)。**視覺數值的唯一真相是 `talk/src/theme.css`**,`docs/` 的文件只記決定與理由,不複製一份 px 或色碼;下層需要上層沒定義的東西就回上層加,不在本層私設。

| 指令 | 職責 |
|---|---|
| `/topic-design` | **L1** 演講主軸設計 — 深度訪談時長/聽眾/會議類型/輸出格式,依場合選定**風格基底**(tech-deep/keynote-impact/intro-friendly/workshop-guide/exec-brief,見 `_shared/styles.md`,為版面/配色/分層/文字/圖形/節奏定預設方向),討論**前景/背景分層**的語意(要不要背景、素材從哪來、幾套各對應演講的什麼結構,見 `_shared/layers.md`),提供 3 組主題方案供選擇,產出燈塔文件 `docs/topic.md`(含**文字規範**:級別↔情境、強調方式用途、列表符號語意,執行期只能從中選用;與**投影片分層**:背景套數↔語意、角標 —— 兩節都只記語意不記數值)、Marp 鷹架(`talk/src/`:theme.css 填起始值、deck-header.md、build.mjs、.marprc.yml)與各 section 佔位文檔 |
| `/section-design` | **L2** 段落設計 — 逐段規劃討論方向、內文內容與形式(條列/表格/段落)、是否需要圖形輔助與圖形類型(見 `_shared/diagrams.md` 的選型表)、每頁的一句話重點與背景的語意需求;不指定版型、背景類別與圖形畫法。產出完整 `docs/section-0x-*.md`;子命令 `status` 用腳本掃描各段落狀態並比對 `topic.md` 的 `sections` 清單 |
| `/section-impl` | **L3** 段落實作(在上層規範內有完全的呈現自主權)— 逐頁決定 Layout(整頁單一區塊/左右/上下/上中下/三等份/四象限/上三下二…,版型詞彙見 `_shared/layouts.md`)與**背景類別**(`bg-none`/`bg-soft`/`bg-strong`/`bg-2`/`bg-3`),並對每頁說得出**視覺動線**,文字技法只從文字規範選用,撰寫 `talk/src/section-0x-*.md` 的 Marp 頁面與 `<!-- 備註 -->`,繪製圖形 SVG(規範見 `_shared/diagrams.md`,含**截圖加註**:原圖 base64 內嵌 SVG 疊編號標記 + 圖下對應圖例),`node build.mjs` 建置驗收;第一段完成後做**分層強度定案**(調 theme.css 的 `--bg-opacity`,不回寫 topic.md);需要時建立 `demo/` |
| `/page-adjust` | **L3** 單頁調整 — 針對指定頁面深談 Layout/內文/圖形/背景/備註調整(文字技法仍受 topic.md 文字規範約束、背景仍受投影片分層的語意約束;theme.css 數值調整屬本層職權,不回寫 topic.md),修改 Marp 原始碼與 SVG 後重 build,同步 section 設計文件 |
| `/svg-layout` | 架構圖 SVG 排版量測(唯讀三腳本)— `normalize.py` 補齊語意化 id 與 `data-role/from/to`(只寫標註不動幾何,id 穩定不漂移);`inspect_svg.py` 輸出 scene digest(累積巢狀 transform 的絕對 bbox、以 fontTools 實測中英混排標籤寬度、edge 拓撲、對齊與間距序列);`lint.py` 診斷 15 條規則(文字溢出/內距/投影字級/對比、連線端點間隙/穿越節點/標籤壓線/缺箭頭/交叉、尺寸間距不一致/幾乎對齊/超出畫布),每條給量化偏差與修正方向 |
| `/review` | 整體審查 — 腳本交叉比對段落覆蓋、deck↔docs 頁數同步、圖形引用完整性、**分層資產與背景槽位**、依賴順序、時間帳與產物新鮮度,再 **build 後逐頁目視** Layout、視覺引導動線、文字規範遵循(字級/強調/列表符號/行距)、版型與配色收斂、**前景/背景分層**(背景有沒有搶第一眼、正文讀不讀得清、換背景對不對得上語意)、圖形連接線轉折(>2 折扣分)、備註品質、用語概念一致、**文案語感**(對比翻轉句「A,不等於 B」「不是 A,而是 B」、人稱代名詞「我們/你/大家」、空泛詞,以及**標題寫法**「逗號串兩件事/描述式標題/標題帶前提」 —— 腳本先給命中清單,確認後逐條扣分,標題/副標出現翻轉句或人稱是阻斷項)與 AI 感,並判斷主軸貼合度、偏題比例、銜接與難度峰值,產出十四項指標的審查報告 `review/review-<日期>-<序號>.md`;不修改任何原始碼 |

演講專案的資料夾結構:`docs/`(topic.md 與 section 設計文件)、`talk/src/`(Marp 原始碼與設定:deck-header.md、每 section 一檔 `section-0x-*.md`、theme.css、build.mjs、.marprc.yml)、`talk/assets/`(圖形 SVG `diagram-<section>-<序號>-<slug>.svg`、背景 `bg-<slug>.svg`、角標 `logo.svg`)、`talk/dist/`(marp-cli 輸出產物,不手改)、`review/`(審查報告)、`demo/`(可選)。每份手寫文件(含圖形與背景 SVG)都有 metadata;共用慣例與**層級顆粒度表**在 `plugins/talk-flow/skills/_shared/conventions.md`,版型詞彙在 `_shared/layouts.md`,風格基底在 `_shared/styles.md`,分層(前景/背景)詞彙在 `_shared/layers.md`,圖形(選型表、繪圖紀律、截圖加註)在 `_shared/diagrams.md`,**文案語感**(禁用句型、人稱指稱與正面寫法)在 `_shared/wording.md`。

投影片分**背景層**(裝飾,`section::before` 畫,不承載資訊)與**前景層**(標題、內文、圖形、頁碼、固定角標)。背景可以是 CSS 漸層、使用者提供的圖片,或 LLM 依討論出的風格現畫的 SVG(`topic-design/assets/backgrounds/` 附三張起手範本);全場最多三套背景槽(`--bg-image` / `--bg-image-2` / `--bg-image-3`),**每頁背景都可以不同** —— 頁面用 `<!-- _class: bg-2 bg-strong -->` 這類類別切換,強度由 `--bg-opacity` 控制,圖表/截圖頁用 `bg-none` 關掉。`/topic-design` 定「幾套、各代表什麼」,`/section-impl` 決定逐頁用哪一個並在有真實頁面後定案強度。

## 安裝(新環境一鍵導入)

在 Claude Code 內執行:

```
/plugin marketplace add utomore/uto-skills
/plugin install dev-flow@uto-skills
/plugin install talk-flow@uto-skills
```

或在終端機執行:

```
claude plugin marketplace add utomore/uto-skills
claude plugin install dev-flow@uto-skills
claude plugin install talk-flow@uto-skills
```

## 更新

repo 有新版本後:

```
/plugin marketplace update uto-skills
```

## 文檔慣例摘要(dev-flow)

設計文檔樹與系統架構樹同構:根節點是主架構、第二層是各 subsystem。所有文檔放在專案 `.design/`,檔名英文 kebab-case、內文繁體中文:

```
.design/
├── system.md                        # /system-design:Level 1 主架構(frontmatter `subsystems` 為權威清單)
├── subsystems/
│   └── <subsystem-slug>/
│       ├── design.md                # /subsys-design:Level 2 子系統架構(功能規劃 + Feature 契約卡;`parent: system` 回鏈)
│       ├── build-log.md             # /subsys-build:配號表、委派決策、待確認假設彙總、階段結果(跑過才有)
│       ├── features/F001-<slug>.md          # /feature-design
│       ├── enhancements/E001-<slug>.md      # /enhance-design
│       └── bugfixes/B001-<slug>.md          # /bugfix
├── enhancements/G-E001-<slug>.md    # 跨子系統的全域優化
├── bugfixes/G-B001-<slug>.md        # 跨子系統的全域修復
└── adr/ADR-001-<slug>.md            # 架構決策紀錄,全局共用
```

編號**三位數**遞增、不放日期(日期在 frontmatter 的 `created` / `updated`);**每個子系統自己一組編號**(F/E/B 各自計數)、全域 G- 自己一組、ADR 全局一組。跨子系統引用寫 `<subsystem>/<id>`(如 `auth/F002`),同子系統直寫 id,全域直寫 `G-E001` / `ADR-003`。

任務文檔開頭必須有 YAML frontmatter(`id` / `type` / `title` / `description` / `status` / `created` / `updated` / `depends-on` / `related-adr` / `related-feature`;全域文檔另加 `subsystems`),`status` 取值 `open | in-progress | done | closed`,狀態掃描腳本(`plugins/dev-flow/skills/arch-audit/scripts/scan-status.mjs`)只解析這一段,清單欄位一律行內陣列 `[a, b]`。子系統 `design.md` 另有選填的 `code-paths`(程式碼路徑前綴),供 `scan-graph.mjs` 把檔案級的圖捲回子系統級。

`description` 為**一句話、繁體中文、40 字以內**的文檔主軸,**所有類型都要寫**(feature 寫「這功能做什麼」、bugfix 寫「什麼壞了」、enhance 寫「要改善什麼」、adr 寫「決定了什麼」),讓 `/arch-audit status` 不必開檔就能看出每份文檔在講什麼;缺這欄會被腳本列為不合規並以 exit code 1 收場。

## Repo 結構

本 repo 同時是 marketplace 與 plugin 本體,但兩者分層:

```
.claude-plugin/marketplace.json     # marketplace「uto-skills」定義
plugins/
├── dev-flow/                       # ← 安裝時只有被裝的 plugin 目錄被複製
│   ├── .claude-plugin/plugin.json  # plugin「dev-flow」(skill 前綴 dev-flow:)
│   └── skills/                     # 各 skill 的 SKILL.md 與腳本
└── talk-flow/
    ├── .claude-plugin/plugin.json  # plugin「talk-flow」(skill 前綴 talk-flow:)
    └── skills/
README.md                           # 只在 repo,不進 payload
```

`marketplace.json` 的 `plugins[].source` 指向各 plugin 目錄(如 `./plugins/dev-flow`),安裝時**只有該子目錄**會被複製進使用者的 `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`。repo 根目錄的 `README.md`、`docs/` 等開發用檔案不會進到 payload — 使用者每裝一個版本就多一份快照,payload 保持精簡是有意義的。

日後新增 plugin:在 `plugins/` 下開新目錄,到 `marketplace.json` 的 `plugins[]` 加一筆即可。marketplace 名稱、plugin 名稱與 GitHub repo 名稱彼此獨立。
