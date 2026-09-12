# 工具

## CLI

一支 CLI `lawful`,入口 `bin/lawful.mjs`。`<L>` 是 plugin 根目錄,一場對話解析一次:

```bash
dirname "$(dirname "$(find ~/.claude/plugins . -maxdepth 8 -type f -path '*lawful/bin/lawful.mjs' 2>/dev/null | head -1)")"
```

之後每道指令寫解析出來的實際路徑:`node "<L>/bin/lawful.mjs" <子命令> …`,在專案根目錄(有 `.lawful/` 的那層)執行。

| 子命令 | 做什麼 |
|---|---|
| `status [--tests <log> \| --run]` | 派工報告。laws 綠幾條要有測試輸出:`--tests` 給留檔的輸出,`--run` 在專案根目錄跑 `system.md` 的整套指令;兩者都沒給、或輸出裡一條 `P-00x#LAW-n` 標記都沒有,就列「未跑」並在開頭寫明 |
| `status --pipeline <P-00x>` / `--module <M>` | 一條 pipeline 的 stage 與 law 逐條狀態 / 住在該模組的所有 stage 的狀態 |
| `status --json` | 同一份報告的資料原樣輸出:願景、目標與里程碑、每條 pipeline(stage、law、example、GAP、引用與被引用、模組)、能開的線、警訊、建議路線。數字與文字都與報告同源,給別的工具讀 |
| `status --html [檔名]` | 同一份報告畫成看板,寫成一個自帶資料的單檔網頁(預設 `lawful-status.html`):一條 pipeline 一張便利貼,顏色是狀態,連線是引用(箭頭指向被引用的那一條),點一張看它的 stage 與 law 逐條、牽動誰、警訊。不連網、不起服務,瀏覽器打開就看 |
| `claim <slug> [--description <句>] [--milestone <M-n>]` | 鑄號建 pipeline 檔(`status: draft`),`system.md` Pipelines 表加一列(類別欄由人填 IO 介面或子流),綁進 `--milestone` 那條里程碑,沒給就提醒它還不朝向任何目標 |
| `objective add <一句話> --priority <1-4> [--criteria <句>]` | 鑄 `O-n` 寫進 `objectives.md`;優先 1 最高、4 最低;判準沒給就留佔位符並提醒 |
| `objective milestone <O-n> <一句話> [--bind <全名,全名>]` | 鑄 `M-n`(全檔唯一)加進該目標的表;綁定的全名要是 `pipelines/` 裡有的 pipeline |
| `lint boundary` | import 與簽名 vs 模組表;types / effects / pure 命中效果型別即紅;未登記與幽靈模組即紅;非 shell 模組沒有匯出清單即紅;production 模組 import 別人的 `*.Internal` 即紅 |
| `lint sig` | Stages 簽名(含 `o` 列與 `!` 列)vs 程式碼簽名,逐字,且要在匯出清單裡;`=` 列與 `o` 列不在 shell、`!` 列在 shell、IO 介面恰好一列 `!`、子流沒有;願望 stage 列待實作不算紅;簽名一致但模組不同列「搬家」;同名簽名在兩條 pipeline 都沒註明「見」即紅 |
| `sync` | 把「搬家」的 stage 模組欄改成程式碼的實際模組(同層才改,跨層列紅要走 REV) |
| `lint laws` | 三行齊全、種類合法、`\|-` 的識別字對得到 Stages 簽名、types 層匯出或 adapter 的標準函式庫清單(字串字面值不算識別字)、`=` 列至少被一條 law 引用、`!` 列不被引用、example 指得到 law |
| `lint trace` | laws / examples ↔ 測試歸屬:未翻譯、幽靈引用即紅;沒有歸屬的測試檔列成內部測試,不算紅 |
| `lint io` | `system.md`「對外 I/O」表:方向是 in / out、pipeline 存在且是 IO 介面、shell 模組在模組表是 shell 層且程式碼裡有、型別住 types 或 effects;每條 IO 介面至少一列 |
| `lint all` | 以上全部 |
| `modules --gen` | 從程式碼生成模組表骨架,層欄留白;已有的表保留層欄、只補新模組 |
| `section <file> <節>…` | 取節 |
| `spike close <SPK-00x>` | 檢查 verdict / feeds / sha 齊全,刪 `spike/SPK-00x-<slug>/` |
| `migrate from-dev-flow <.design> [--write <file>] [--ignore <dir,dir>]` | 盤點 `subsystems/<slug>/` 體系的 `.design`,印一份帳本,不改任何檔:每份 F / E / G-* 的介面簽名在程式碼裡對到幾條、四格 law 翻成三行草稿(散文的標「需形式化」)、按簽名所在模組分組並建議 `claim` 的 slug、開發階段表列成目標與里程碑候選、退場清單、人要判的清單。分組、目標與里程碑怎麼綁、law 形式化由人做 |

exit code:`status` 盤點 = 驗收(有未達成或 open GAP 即 1),`status --pipeline` / `--module` = 查得到 0、查不到 1;`lint` 一律 0 / 1。

## status 報告

給開發者讀的派工報告,版面固定。第一行印願景(還是模板就不印,列警訊),第二行是數字(目標、里程碑、IO 介面、pipeline、待實作 stage、open GAP);接著兩張表:

- **目標**:每個目標一列(優先、一句話、里程碑總數、里程碑達成、完成度),照優先排;每個沒達成的目標一行「下一個里程碑」,附綁定的 pipeline 各在什麼狀態;最後一行列沒有被任何里程碑綁定的 pipeline。**這一段答的是「我們有沒有朝向目標」**
- **pipelines**:每條 pipeline 一列

然後七段:

1. 今天能開幾條線:`ready`、沒 open GAP、引用的子流全部達成的 pipeline;每條附它綁在哪個目標與里程碑,照目標優先排。專案根目錄有 `.git` 時查分支:已有 `build/<全名>` 分支的列成建構中,不算能開。兩條能開的線的 stage 住同一個模組,附一行提示:同時開,整合時那個模組的檔會兩邊都動
2. 卡住的:停在 GAP 的 stage、等重派、等子流(子流還是 `draft`、卡 GAP、建構中、或還沒建)
3. 等決定:open 的 GAP、open 的 spike、`draft` 的 pipeline
4. 牽動誰:誰引用了這條的簽名
5. 待實作:按模組列願望 stage、找不到的 stage、本體還是骨架的 stage
6. 警訊:願景還是模板、沒有任何目標、優先不在 1 到 4、目標沒有判準或沒有里程碑、里程碑沒有綁定或綁到不存在的 pipeline、里程碑編號重複、pipeline 沒有被任何里程碑綁定、`frozen` 而紅、REV 沒解凍紀錄、未登記模組、簽名不一致、GAP 編號重複(兩條 build 分支各自配了同一個號,整合時後合的往上移)、還是模板(claim 建出來的檔還留著 `<…>` 佔位符的 Stages / Laws / Examples 列;這些列不算 stage、law、example,不進任何數字)
7. 建議路線:先回答 GAP、再 build 能開的線(照目標優先、里程碑順序排,每條附目標與里程碑)、`draft` 討論完改 `ready`。沒有可派的線時分兩種:全部達成寫「目前功能全部正常運作,可以加新功能」;沒達成寫哪幾條沒達成、缺什麼輸入,不催加新功能

分母是 `system.md`「Pipelines」表的 pipeline 數與其中 IO 介面的條數,以及 `objectives.md` 的目標數與里程碑數。

## language adapter

`system.md` 的 `language` 選 adapter;語言相關的事全部走 adapter,讀取層不認識任何語言:

| adapter 提供 | 用在 |
|---|---|
| `signatures(file)`:頂層簽名(名字、型別文字、模組) | `lint sig`、`status` |
| `exports(file)`:匯出清單;沒寫回 null | `lint sig`、`lint boundary` |
| `typeNames(file)`:宣告的型別名 | `lint io` |
| `stubs(file)`:本體還是 `stub` 的名字 | `status` |
| `imports(file)`:import 的模組 | `lint boundary` |
| `isEffectful(signature, extra)`:簽名是否碰到效果;`extra` 是 `system.md` 追加的效果型別 | `lint boundary` |
| `effectTypes`、`ioModules`:預設效果型別、預設 IO 模組黑名單 | `lint boundary` |
| `testMarkers(file)`:測試檔裡的 `P-00x#LAW-n` / `P-00x#EX-n` 歸屬 | `lint trace` |
| `testResults(log)`:測試輸出 → 每個歸屬標記綠 / 紅 / pending | `status` |
| `stdlib`:law 裡可直接用的標準函式庫函數 | `lint laws` |
| `stub(marker)`:帶 `P-00x#name` 的未實作本體 | conductor 寫骨架 |

Haskell adapter:`.hs`;簽名認欄位 0 的頂層簽名(含運算子、多行)、record 欄位(存取子型別 `Record -> 欄位型別`,Stages 表照這個寫)、`class` 底下的方法;不認 `instance` 底下的方法與函數本體 `where` 裡的區域函數;匯出清單認 `Foo (..)`、`Foo (a, b)`、`(<+>)`、`module X`;型別名認 `data` / `newtype` / `type` / `class`;`import` 行;效果型別 `IO`、`IOE`、`MonadIO`、`MonadUnliftIO`、`STM`、`IORef`、`MVar`、`TVar`、`TMVar`、`Chan` 出現在簽名即效果;歸屬只認字串字面值 `"P-00x#LAW-n"`;測試輸出認 hspec(specdoc)與 tasty 兩種版面,標記可以是群組名或單一測試名;`stub` = `error "P-00x#name stub"`,`undefined` 也算骨架。沒有 adapter 的語言:`lint sig` 與 `lint boundary` 印「此語言尚無 adapter」跳過,其餘照常。

## 跑東西的紀律

測試、建置、lint 都照三道關:

1. **該不該跑**:輸出會改變接下來做什麼才跑。不拿測試判「文檔與程式碼哪邊過期」(看 `updated` 與原始碼);不為了回報裡的一個數字而跑。
2. **是不是重跑**:輸入沒變就沿用上次輸出並寫「沿用」。有變只跑涵蓋得到改動的範圍;整套一個迴圈一次(roles.md「測試跑幾次」)。
3. **輸出留檔**:`<指令> > <log> 2>&1; tail -20 <log>`,之後從檔案 grep。同一道指令連續失敗兩次,第三次前先換做法。

## 收尾定錨

每個 skill 的收尾,回報最後附這四段,不超過一個畫面。委派模式的 subagent 不輸出。

1. **位置樹**:願景一行 → 每個目標一行(優先、完成度)→ 每條里程碑一行(達成 / 進行中 / 未開工)→ 綁定的 pipeline → 目前 pipeline 展開到 stage 與 law,各標簽名在不在、law 綠不綠;沒被任何里程碑綁定的 pipeline 掛在最後的「沒有目標」底下。目前節點標 `◀ 目前`。全部寫全名。
2. **完成度**三行:目標(最高優先還沒達成的目標 O-n 完成度 x% · 里程碑達成 n / m)、產品(IO 介面達成 n / m · pipeline 達成 n / m · 待實作 stage n)、本次(目前 pipeline 簽名 m / n · laws g / k)。數字只來自 `lawful status` 與實際跑過的測試;沒跑寫「沿用 <哪一次>」或「未跑」。
3. **主軸檢查**:本次對應哪個目標的哪條里程碑、哪條 pipeline 的哪個 stage 或 law;偏離清單(做的事不在任何里程碑的綁定裡、比最高優先目標的里程碑先做了低優先的、簽名與 Stages 不符、import 越層、測試後門、未登記模組、open GAP、動了文檔沒寫的東西),每條附位置與建議;沒有寫「無」。
4. **下一步**:一條具體命令(參數寫全名),附下面四題的答案;最多兩條替代,各附同四題,外加一句為什麼不是第一。下一步必須從樹上推得出來。
   - **必要性**:不做它,樹上哪個目標的哪條里程碑停在哪條 pipeline 的哪個 stage 或 law、哪條功能因此無法正常運作。答不出具體的一條與一格,它就不是下一步,也排不進替代。
   - **替代為什麼排後面**:目標優先較低、等一個決定、等子流先達成、只是清警訊;寫明是哪一個。
   - **需求來源**:這條命令對到位置樹的哪個目標與里程碑、警訊表的哪一列、`gaps.md` 的哪一條、或開發者的哪一句話。都對不到的是自己長出來的需求,不列。
   - **架構缺口**:重切 pipeline、改層、換效果型別或外部系統這類架構級動作,只能因為現在的架構解決不了一個具體問題才提;寫出那個問題。寫不出來就不提。
   - **全部正常時**:每條 pipeline 達成、測試全綠、沒有 open GAP、警訊為空,明寫「目前功能全部正常運作,沒有非做不可的事,可以加新功能」,下一步是 `lawful:objective`(訂下一個目標或里程碑)再 `lawful claim <slug> --milestone <M-n>`;不另造下一步。
