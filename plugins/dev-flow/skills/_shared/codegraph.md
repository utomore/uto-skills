# 程式碼知識圖整合

`_shared/conventions.md` 的分片。適用範圍分三級:

| | skill | 規則 |
|---|---|---|
| **必用** | `/feature-design`、`/enhance-design` | 設計階段一定要用圖查清楚既有符號與影響面再落筆;圖跑不了(專案沒建過、產生器不支援這個語言、`extract` 失敗)時退回一般搜尋,並在收尾寫**具體原因** |
| **選配** | `/arch-audit`、`/bugfix`、實作類 skill | 有圖就用,沒有就整段略過、照原流程走,不主動勸開發者裝工具 |
| **限用** | `/spec-qa` | 只准用來**導航測試面與型別結構**,不准用來推論受測函數的行為(見下) |

## 選用規則(先決定用哪個工具)

按專案語言選,沒有第二種判準:

| 專案語言 | 用什麼 | 建圖 / 更新 |
|---|---|---|
| **Haskell** | **knot** | `knot extract .`(同一指令增量更新) |
| **其他語言**(py / ts / js / go / rs / java / c / cpp / rb / swift / kt / cs / scala / php / lua…) | **graphify** | `graphify extract . --code-only --directed` / `graphify update .` |
| 兩種都裝不起來或建不出圖 | **傳統方式**:一般的檔案搜尋與逐檔閱讀 | — |

graphify **不支援 Haskell**,knot **只支援 Haskell**(cabal 專案),兩者不重疊也不互為備援——語言決定工具,不必比較優劣。混合語言的專案就對各自那一塊各用各的。

退回傳統方式時,把**具體原因**寫進收尾(專案不是 Haskell 也不在 graphify 支援清單、工具沒裝、`extract` 失敗貼一句錯誤、圖建得起來但這次任務不需要導航)——**不准用「不適用」帶過**。原因具體,下次才知道是工具的問題還是專案的問題。

## `/spec-qa` 的限用界線

qa 需要圖來寫出好的測試:型別有哪些建構子、既有測試放在哪、改到這個符號會牽動哪些既有測試。但圖同時也是**實作的投影**,順著呼叫鏈往下看就等於偷看實作。界線劃在**斷言的依據**上:

| | 用法 |
|---|---|
| **允許** | `find` 定位骨架符號、型別與其建構子、既有測試模組的位置;`tests-of` 列出依賴受測符號的既有測試(避免重複、對齊慣例、enhance 抓回歸候選);`rank` / `--level module` 看測試面的全景 |
| **禁止** | 用 `reachable` / `path` 追**受測函數往下的內部呼叫鏈**;任何「因為它呼叫了 X,所以預期輸出應該是 Y」的推論;把圖查到的行為當成 spec 沒寫到的部分的答案 |

> **鐵律:圖決定「測試放哪、輸入怎麼建」,不決定「預期輸出是什麼」。** 每一條斷言的唯一依據都是 spec 的 law 或 example 原文;圖上看到什麼都不能改變斷言。spec 沒寫到的行為,照樣記 `spec-gaps` 停下該項——**不准拿圖去把 gap 填掉**。

## 鐵律:圖是導航,不是查證

> **圖只能告訴你「去哪裡看」,不能告訴你「那裡是什麼」。**

圖是索引,會過期(建圖後程式碼又改了)、會漏抽、`confidence: INFERRED` 的邊是推測的。所以:

- **可以**用它找候選、算影響面、看全景
- **禁止**拿它當相依性查證的依據。`/feature-design` 的「必須打開原始碼讀到實際定義」一字不改——圖給你檔案與行號,你還是要打開檔案讀到簽名原文
- **禁止**把節點標籤當簽名抄進文檔(標籤是符號名,不是簽名)
- 圖說「沒有」只代表**這張圖裡沒有**,要退回一般搜尋,不得據此下「專案裡不存在」的結論

## 契約是格式,不是工具

下游(`scan-graph.mjs` 與各 skill 接點)只認 `graph.json` 的這個形狀:

```json
{ "directed": true,
  "nodes": [{ "id": "…", "label": "…", "source_file": "src/a.ts", "source_location": "L42" }],
  "links": [{ "source": "<node id>", "target": "<node id>", "relation": "calls", "confidence": "EXTRACTED" }] }
```

必要欄位只有 `nodes[].id` / `label` / `source_file` 與 `links[].source` / `target` / `relation`;`source_location`(證據用)、`confidence`、`built_at_commit`(新鮮度比對)選填。`relation` 分兩類:**依賴類**(`imports` `imports_from` `calls` `uses` `references` `extends` `implements` `inherits` `instantiates` `depends_on`)才算進依賴圖,**結構類**(`contains` `method` `defines` …)不算,認不得的一律排除並列出。

**換產生器只要吐同格式,下游一行都不用改。** 只提供 `graph.json`、沒有查詢 CLI 的產生器也完全可用——架構檢測那一整塊由 `scan-graph.mjs` 自己算,不依賴任何工具。

## 目前的產生器

| 產生器 | 建圖 | 更新 | 圖的位置 | 語言 |
|---|---|---|---|---|
| graphify | `graphify extract . --code-only --directed` | `graphify update .` | `graphify-out/graph.json` | py / ts / js / go / rs / java / c / cpp / rb / swift / kt / cs / scala / php / lua…(**不含 Haskell**) |
| knot([utomore/knot-hs](https://github.com/utomore/knot-hs)) | `knot extract .` | `knot extract .`(同一指令,增量) | `codegraph.json` | **只有 Haskell**(cabal 專案;前提是 `cabal build all` 建得起來,且 knot 與專案用**同版 GHC**——`knot --version` 括號裡就是它能掃的版本,不合會以 `VersionMismatch` 整體失敗) |

保留邊方向的選項(graphify 是 `--directed`;knot 恆為有向,沒有這個旗標)**不能省**:無向圖會把 A→B 與 B→A 併成一條,循環依賴直接消失。換或加產生器時只改這張表與下面的「指令對應」,其他檔案不動。

knot 的幾個特性會影響怎麼用它:

- 它從 GHC 的 `.hie` 抽事實(型別檢查後、名稱全部解析完),所以 `confidence` 恆為 `EXTRACTED`、`built_at_commit` 一定有——新鮮度比對直接可靠;但**建圖 = 把專案完整建一次**,第一次可能要幾十秒到一分鐘,之後只重編改過的模組
- 對專案唯讀,唯一副作用是根目錄的 `.knot/` 快取(自帶 `.gitignore`);建不起來就 exit 1、**不寫圖**,沒有「只剩 module 層」的降級版——拿到舊圖時要看的是上面那條新鮮度比對,不是猜它有沒有半成品
- 預設**排除** test-suite / benchmark;要問「哪些測試會壞」時,建圖改跑 `knot extract . --include-tests`(節點多一個選填欄位 `component`;查詢端預設 `--scope product` 仍會把測試節點收掉,rank 不會被測試檔灌水)

## 判定

`scan-graph.mjs` 會自己依序找 `codegraph.json` → `.codegraph/graph.json` → `graphify-out/graph.json` 並印出用了哪個。**找不到就照原流程走**——選配的 skill 整段略過、不主動勸開發者裝工具;必用的 skill(設計類)退回一般搜尋,但要在收尾寫明跑不了的具體原因。

用之前先讓圖跟上(上表的「更新」欄);更新不了就比對圖的 `built_at_commit` 與 `git rev-parse HEAD`,對不上要把「圖描述的是舊程式碼」講給開發者聽。

檔案級的圖靠 `design.md` 的 `code-paths`(規格見 `frontmatter.md`)捲回子系統級;缺這欄只能猜路徑,子系統級結論不可採信,要提醒開發者補。

## 能力對照

| 什麼時候 | 需要的能力 | 接著一定要做什麼 |
|---|---|---|
| 架構檢測(system / subsys) | `node "<arch-audit 目錄>/scripts/scan-graph.mjs" .design [--subsys <slug>]`(**工具無關**) | 腳本印的「⚠ 影響結論可信度」整段原樣轉達;每條要寫進發現的邊都打開它給的 `檔案:行號` 確認 |
| 找既有介面在哪 | 關鍵字查節點 | 打開檔案讀簽名原文,以檔案為準 |
| 算改動影響面 | 反向可達(誰依賴它) | 當**候選清單**給開發者拍板,不是結論(漏得掉動態呼叫、反射、設定檔驅動的相依) |
| 追資料流 / 根因 | 兩點間最短路徑 | 沿路徑逐跳讀原始碼驗證,路徑只是假說 |
| 找上帝物件 | 連通度排名 | 高連通 ≠ 有問題,只是 SRP 檢查的候選 |

**graphify 的指令對應**:關鍵字查節點 `graphify query "<識別字>"`、反向可達 `graphify affected "<符號>" --depth 2`、最短路徑 `graphify path "<起點>" "<終點>"`、連通度排名 `graphify god-nodes --top 15`。它的比對是子字串 + IDF,沒有詞幹還原、沒有同義詞、沒有跨語言對應,所以**查詢詞要用程式碼裡真實存在的識別字**(`TokenStore`、`refresh_token`),不要用中文需求詞或抽象概念。查到 0 筆就換識別字重試一兩次,再沒有就退回一般搜尋,不要在圖上鑽。

**knot 的指令對應**:關鍵字查節點 `knot query find "<識別字>"`(id 或 label 的子字串,不分大小寫)、反向可達 `knot query reachable "<節點 id>" --reverse --depth 2`、最短路徑 `knot query path "<起點 id>" "<終點 id>"`、連通度排名 `knot query rank --top 15`。三條紀律:

- `reachable` / `path` 吃的是**節點 id 不是名字**——module 是裸名(`Demo.Core`),值宣告是 `<module>.<occ>`(`Demo.Core.render`),型別宣告尾綴 `#t`(`Demo.Core.Foo#t`,與同名建構子區分)。先 `find` 拿到 id 再餵給其他子命令,不要手打猜
- 架構層級的問題(誰依賴誰、哪個 module 是 hub)加 `--level module` 只看 module 節點與 `imports` 邊;追呼叫鏈用 `--level decl`(預設 `all` 兩層混在一起,rank 會被 module 節點佔掉)。`--graph` / `--level` / `--scope` 要寫在子命令**之前**:`knot query --level module rank --top 10`
- `--scope` 有三個值:`product`(預設,只留產品程式碼)、`tests`(只留測試節點)、`all`(兩邊一起算)。預設就是要的,只有**刻意**要把測試的依賴算進結論時才換——例如想看「連測試一起算,誰最中心」用 `--scope all`。圖建的時候沒帶 `--include-tests` 就沒有測試節點,`tests` 會查出空的、`all` 等同預設,換值前先確認圖是怎麼建的

它多一項 graphify 沒有的能力:`knot query tests-of "<節點 id>"` 列出直接或間接依賴該符號的**測試節點**(圖要建時帶 `--include-tests`;這個子命令**忽略 `--scope`**,不必也不用另外指定)——`/enhance-design` 與 `/bugfix` 估「改它會壞哪些測試」時可當回歸測試的候選清單;一樣只是候選,測試要不要補、補在哪仍以讀過測試原始碼為準。

產生器只給 `graph.json` 沒給 CLI 時,上述能力就沒有,只用得到上表第一列——那已經涵蓋架構檢測的全部價值。

## 另外兩條

- 不得自行執行會改動專案或環境的工具指令(安裝 git hook、寫入使用者設定檔等),要用先問開發者
- 委派模式下 subagent 可以查圖,但「待確認假設」不得以圖的輸出作為唯一依據
