---
name: svg-layout
description: 簡報架構圖 SVG 的排版檢查與調整 — 用腳本把絕對座標還原成關係(scene digest),以真實 font metrics 量測中文/中英混排標籤,並診斷文字溢出、連線端點沒貼齊、線穿過節點、標籤壓線、尺寸間距不一致等問題。觸發詞:架構圖、排版、對齊、調整 SVG、改圖、圖太擠、文字超出、線沒接好、圖看不懂、architecture diagram、svg layout、diagram alignment、text overflow。Use when checking or adjusting the layout of an SVG architecture/flow diagram, especially one embedded in slides.
user-invocable: true
---

# /svg-layout — 架構圖 SVG 排版檢查與調整

適用對象:**簡報中的輔助架構圖**(系統架構圖、資料流程圖、模組依賴圖、時序圖),
由「盒子(node)+ 連線(edge)+ 標籤(label)」組成,嵌入投影片當單一插圖。
標籤大量是中文或中英混排,聽眾只有三十秒看懂它。

在 talk-flow 流程中,這是 `/section-impl` 畫完圖、`/page-adjust` 改圖、`/review`
審查圖形時的量測工具;圖形紀律(轉折 ≤2、單一流向、節點 ≤7)見
`../_shared/conventions.md`,本 skill 負責把那些紀律變成可量測的數字。

## 為什麼要用腳本,不能自己讀 SVG

SVG 用絕對座標表達一切,「置中」「對齊」「間距一致」這些**語意在檔案裡是蒸發的**。
直接讀 XML 猜座標必然出錯,尤其是:巢狀 transform 要累積、文字寬度要靠真實
font metrics(中文全寬、英文半寬,中英混排不能用平均字寬估)。

所以本 skill 的作法是:**把幾何還原成關係,再對關係做推理**。

## 強制流程(不可跳步)

```
1. normalize.py      # 元素缺 id 或 data-role 時必跑;只寫 id 與 data-*,不動幾何
2. inspect_svg.py    # 取得 scene digest:絕對 bbox、標籤實測寬度、edge 拓撲、對齊與間距
3. lint.py           # 找出既有問題與量化偏差
4. 基於 digest 與 diagnostics 推理並修改 SVG
5. lint.py           # 驗證修改結果(必跑,不可假設改對了)
6. 重新 build 投影片或請使用者確認視覺結果
```

腳本用 uv 執行,依賴自動安裝(PEP 723 inline metadata):

```bash
uv run <skill目錄>/scripts/normalize.py   diagram.svg --dry-run
uv run <skill目錄>/scripts/normalize.py   diagram.svg --in-place
uv run <skill目錄>/scripts/inspect_svg.py diagram.svg
uv run <skill目錄>/scripts/lint.py        diagram.svg
```

三支腳本都有 `--help`;終端不支援 `✓ ⚠` 時加 `--ascii`(Windows 主控台會自動降級)。

腳本檔名刻意避開標準庫模組名(`inspect_svg.py` 而非 `inspect.py`)— 腳本目錄會排在
`sys.path` 最前面,同名檔會遮蔽標準庫(`dataclasses` 需要 `inspect`),三支腳本都會
啟動失敗。日後新增腳本時同理。

## 明確禁止

- **不准直接讀原始 SVG 檔案內容去猜座標** — 幾何一律由 inspect_svg.py 提供
- **不准在未跑 inspect_svg.py 的情況下修改任何幾何值**(x/y/width/height/d/points/transform)
- **不准跳過修改後的 lint 驗證** — 改完必跑,不可假設改對了
- 不准自行生成 path-based 識別碼(如 `svg>g:nth-child(3)>rect`)代替 id:
  那種識別碼會在結構變動時漂移,破壞多輪對話的一致性 — 缺 id 就跑 normalize.py

## 各腳本要點

### normalize.py — 地基:穩定的語意化 ID

補齊 id 與 `data-role` / `data-from` / `data-to` / `data-layer`,**絕不改動任何
座標、尺寸、顏色**(驗收時比對過:108 個幾何/視覺屬性全數原樣保留)。

- id 由**內容**推導,不用 `rect-1` 這種無語意編號:「訂單服務」→ `#node-order-service`
  (中文先查內建詞彙表,查不到用拼音:「霛燼」→ `#node-ling-jin`);
  edge 是 `#edge-{from}-to-{to}`,label 是 `{parent-id}-label`
- 詞彙表可用 `--glossary terms.json` 補充(`{"中文詞": "slug"}`)
- **ID 穩定性是硬性要求**:重跑時既有 id 與 data-* 一律保留,只補未標註的元素;
  即使新增/刪除節點,既有 id 也絕不重新分配(已驗證:插入新節點後 19 個既有 id 一字未改)
- `data-role="unknown"` 表示推不出來,**這是要你人工確認的訊號,不是失敗**;
  改對之後 inspect 與 lint 才會把它算進拓撲
- `--force-relabel` 會重建全部 id,**破壞既有引用**,只在使用者明確要求時用

### inspect_svg.py — scene digest

輸出階層樹(container → node → label)、edges 拓撲、layout 三段。讀的時候注意:

- `label "..."  w=216px  ⚠ overflow R by 18px` — 寬度是**實測值**
- 寬度後綴的意思:無後綴 = 宣告字型實測;`(subst. X)` = 本機沒有宣告字型,
  用 X 實測(上台環境可能有差);`(est.)` = 連替代字型都沒有,逐字元分類估算
- `endpoint gap: source 0px ✓  target 3px ⚠` — 連線端點與 node 邊界的實際距離
- `layout` 段的 gap 序列與 uniform 標記,是判斷「對齊是不是真的整齊」的依據
- path 預設只給 bbox 與轉折數,要看 `d` 的內容加 `--expand-paths`

### lint.py — 診斷

規則分三類。每條 diagnostic 都給嚴重度、元素 id、**量化偏差**與**建議修正方向**
(只描述不執行 — 改法由你決定):

| 類別 | 規則 |
|---|---|
| 文字與可讀性 | `text-overflow`、`insufficient-padding`、`presentation-tiny-text`、`low-contrast` |
| 連線品質 | `edge-endpoint-gap`、`edge-crosses-node`、`edge-label-overlap`、`arrow-missing`、`edge-crossing` |
| 版面一致性 | `inconsistent-node-size`、`inconsistent-spacing`、`near-alignment`、`viewbox-overflow`、`margin-violation`、`aspect-ratio` |

- `--disable a,b` / `--only a,b` 開關規則;容差可調(`--min-padding 16`、`--near-align 6` 等)
- `--format json` 給程式讀;exit code:有 error 非 0,只有 warning 為 0
- **`near-alignment` 幾乎都是 bug**:0 < Δ < 4px 不可能是刻意設計,優先修
- `edge-crossing` 是 warning:有時無法避免,判斷後決定要不要動

## 修改時的判斷順序

1. 先修 **error**(文字溢出、端點沒貼齊、線穿過節點、超出 viewBox)— 這些聽眾看得出來
2. 再修 **near-alignment 與尺寸/間距不一致** — 這些讓圖看起來「髒」但說不出哪裡怪
3. 標籤放不下時,優先序是:**放大盒子 > 縮短文字 > 縮小字級**;
   字級是最後手段,`presentation-tiny-text` 的下限(等效 16px)不可越過
4. 連線穿過節點,先想**重排節點**,再想繞線 — 繞線會增加轉折,轉折 >2 折就該重排
5. 動了任一 node 的尺寸或位置後,**連到它的每條 edge 端點都要跟著改**,
   然後重跑 lint 確認沒有製造新的 `edge-endpoint-gap`

## 環境需求

Python 3.10+ 與 uv;依賴(`svgelements`、`fontTools`、`pypinyin`)由 uv 自動安裝。
路徑一律 pathlib、檔案讀寫明確 UTF-8,Windows 可直接跑。
量測用的字型在本機找不到時會回退到系統實際存在的字型並明確標示,
可用 `--font-dir <目錄>` 指定簡報實際使用的字型目錄以取得最準確的量測。

支援的元素:`rect / circle / ellipse / line / polyline / polygon / path / text /
tspan / g / use / marker`;其餘在 digest 中標為 `unsupported`。

## 測試資料

`tests/fixtures/` 有四個案例可用來確認腳本行為正常:
`clean.svg`(乾淨的三層微服務圖,應該零診斷)、`cjk-overflow.svg`(中文與中英混排溢出)、
`broken-edges.svg`(端點沒貼齊、線穿節點、標籤壓線)、`no-ids.svg`(完全沒有 id,
用來驗證 normalize 與 inspect 的警告行為)。

## Future(本階段不實作)

- **Layer 3 — 編輯 DSL**:讓 LLM 輸出操作而非座標,由程式執行。架構圖的操作集合是
  收斂的:`resize-to-fit`、`connect A→B routing=orthogonal`、`grid-align`、
  `equalize-size`、`distribute`。等 Phase 1 累積真實案例後再反推需要哪些操作。
- **Layer 4 — 拓撲 IR**:以 Mermaid / Graphviz 描述拓撲並自動排版,再用本 skill
  做精細微調。混合流程:Mermaid 生初稿 → normalize → inspect → 手調。
