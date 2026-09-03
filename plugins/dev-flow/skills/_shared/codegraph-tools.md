# 程式碼知識圖:能力與指令對應

`codegraph.md` 的分片,**要下查詢時才讀**;紀律、格式契約與圖的判定仍以 `codegraph.md` 為準。

| 什麼時候 | 需要的能力 | 接著一定要做什麼 |
|---|---|---|
| 架構檢測(system / subsys) | `node "<S>/arch-audit/scripts/scan-graph.mjs" .design [--subsys <slug>]`(**工具無關**) | 腳本印的「⚠ 影響結論可信度」整段原樣轉達;每條要寫進發現的邊都打開它給的 `檔案:行號` 確認 |
| 找既有介面在哪 | 關鍵字查節點 | 打開檔案讀簽名原文,以檔案為準 |
| 算改動影響面 | 反向可達(誰依賴它) | 當**候選清單**給開發者拍板,不是結論(漏得掉動態呼叫、反射、設定檔驅動的相依) |
| 追資料流 / 根因 | 兩點間最短路徑 | 沿路徑逐跳讀原始碼驗證,路徑只是假說 |
| 找上帝物件 | 連通度排名 | 高連通 ≠ 有問題,只是 SRP 檢查的候選 |

**graphify 的指令對應**:關鍵字查節點 `graphify query "<識別字>"`、反向可達 `graphify affected "<符號>" --depth 2`、最短路徑 `graphify path "<起點>" "<終點>"`、連通度排名 `graphify god-nodes --top 15`。它的比對是子字串 + IDF,沒有詞幹還原、沒有同義詞、沒有跨語言對應,所以**查詢詞要用程式碼裡真實存在的識別字**(`TokenStore`、`refresh_token`),不要用中文需求詞或抽象概念。查到 0 筆就換識別字重試一兩次,再沒有就退回一般搜尋,不要在圖上鑽。

**knot 的指令對應**:關鍵字查節點 `knot query find "<識別字>"`(id 或 label 的子字串,不分大小寫)、反向可達 `knot query reachable "<節點 id>" --reverse --depth 2`、最短路徑 `knot query path "<起點 id>" "<終點 id>"`、連通度排名 `knot query rank --top 15`。三條紀律:

- `reachable` / `path` 吃的是**節點 id 不是名字**——module 是裸名(`Demo.Core`),值宣告是 `<module>.<occ>`(`Demo.Core.render`),型別宣告尾綴 `#t`(`Demo.Core.Foo#t`,與同名建構子區分)。先 `find` 拿到 id 再餵給其他子命令,不要手打猜
- 架構層級的問題(誰依賴誰、哪個 module 是 hub)加 `--level module` 只看 module 節點與 `imports` 邊;追呼叫鏈用 `--level decl`(預設 `all` 兩層混在一起,rank 會被 module 節點佔掉)。`--graph` / `--level` / `--scope` 要寫在子命令**之前**:`knot query --level module rank --top 10`
- `--scope` 有三個值:`product`(預設,只留產品程式碼)、`tests`(只留測試節點)、`all`(兩邊一起算)。預設就是要的,只有**刻意**要把測試的依賴算進結論時才換——例如想看「連測試一起算,誰最中心」用 `--scope all`。圖建的時候沒帶 `--include-tests` 就沒有測試節點,`tests` 會查出空的、`all` 等同預設,換值前先確認圖是怎麼建的

它多一項 graphify 沒有的能力:`knot query tests-of "<節點 id>"` 列出直接或間接依賴該符號的**測試節點**(圖要建時帶 `--include-tests`;這個子命令**忽略 `--scope`**,不必也不用另外指定)——`/spec-design` 與 `/bugfix` 估「改它會壞哪些測試」時可當回歸測試的候選清單;一樣只是候選,測試要不要補、補在哪仍以讀過測試原始碼為準。

產生器只給 `graph.json` 沒給 CLI 時,上述能力就沒有,只用得到上表第一列——那已經涵蓋架構檢測的全部價值。
