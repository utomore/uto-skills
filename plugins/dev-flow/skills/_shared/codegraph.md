# 程式碼知識圖整合

`_shared/conventions.md` 的分片。**opt-in**:只有某個 skill 的步驟指向本片、且專案裡真的有圖時才適用。

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

保留邊方向的選項(graphify 是 `--directed`)**不能省**:無向圖會把 A→B 與 B→A 併成一條,循環依賴直接消失。換或加產生器時只改這張表與下面的「指令對應」,其他檔案不動。

## 判定

`scan-graph.mjs` 會自己依序找 `codegraph.json` → `.codegraph/graph.json` → `graphify-out/graph.json` 並印出用了哪個。**找不到就整片略過、照原流程走**,不主動勸開發者裝工具。

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

**graphify 的指令對應**:關鍵字查節點 `graphify query "<識別字>"`、反向可達 `graphify affected "<符號>" --depth 2`、最短路徑 `graphify path "<起點>" "<終點>"`、連通度排名 `graphify god-nodes --top 15`。它的比對是子字串 + IDF,沒有詞幹還原、沒有同義詞、沒有跨語言對應,所以**查詢詞要用程式碼裡真實存在的識別字**(`TokenStore`、`refresh_token`),不要用中文需求詞或抽象概念。查到 0 筆就換識別字重試一兩次,再沒有就退回一般搜尋,不要在圖上鑽。產生器只給 `graph.json` 沒給 CLI 時,這四項能力就沒有,只用得到上表第一列——那已經涵蓋架構檢測的全部價值。

## 另外兩條

- 不得自行執行會改動專案或環境的工具指令(安裝 git hook、寫入使用者設定檔等),要用先問開發者
- 委派模式下 subagent 可以查圖,但「待確認假設」不得以圖的輸出作為唯一依據
