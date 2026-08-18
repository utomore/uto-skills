---
name: section-impl
description: 演講段落實作 — 依 docs/topic.md 與 section 設計文件決定每頁 Layout(左右/上下/象限/上三下二等),撰寫 talk/src 的 Marp Markdown 頁面與頁內備註,需要圖形時繪製 SVG(架構圖/流程圖等)嵌入,並以 build.mjs + marp-cli 建置驗收。觸發詞:段落實作、section impl、做投影片、排版面、畫架構圖、實作簡報。Use when implementing a talk section's Marp slides, presenter notes, and diagram SVGs from its design docs.
user-invocable: true
---

# /section-impl — 演講段落實作

先讀取 `../_shared/conventions.md` 與 `../_shared/layouts.md`,遵守所有文檔慣例(metadata、命名、Marp 建置)與版型詞彙。

## 前置

1. 讀取 `docs/topic.md`(燈塔;不存在時建議先執行 `/topic-design`),特別是「投影片風格」、「**文字規範**」(執行期唯一合法的字級/強調/列表符號選單)與 `talk/src/theme.css` 的 tokens
2. 確認目標段落:使用者指定編號則用之;未指定則建議 `order` 最小、status 為 open 且已完成設計的段落。**目標段落必須已經過 `/section-design`**(內文有「內容要點」與「頁面規劃」章節且非空);只有佔位說明時,告知使用者建議先執行 `/section-design`,除非使用者明確要求直接實作
3. 讀取目標段落設計文件與其 `depends-on` 段落(掌握銜接);確認 `talk/src/` 鷹架存在(deck-header.md、theme.css、build.mjs;缺了先回 `/topic-design` 補)
4. 掃描 `talk/src/section-*.md` 與 `talk/assets/` 現況,確認本段的 deck 檔與圖形序號沒有撞名

## 流程

### 1. 逐頁排版方案(開工前確認)

對「頁面規劃」的每一頁,依 `layouts.md` 的判斷順序提出**呈現方案**並向使用者摘要確認:

- **格局**:從版型詞彙表選 — **整頁單一區塊也是合法選項**(內容是一個整體就不要硬切格),其餘有左右對分、上下對分、上中下、三等份、四象限、上三下三、左三右三、上三下二…;相鄰頁盡量沿用同一版型語彙
- **視覺引導(每頁必答)**:這頁的動線是什麼 — 眼睛從哪進、依什麼順序看、在哪停?動線要與內容邏輯一致(左→右 = 先→後、上→下 = 因→果),強調處就是動線的終點;說不出動線就是版型不對或資訊太多,回頭改格局或拆頁
- **內文**:條列、表格或段落文字,放在哪一格
- **文字技法**:字級、強調方式、列表符號**只從 `topic.md`「文字規範」與本段設計文件「文字技法選用」中選**,不自創;同類內容跨頁用同一種寫法(同是要點就同字級同符號),要做出差異必須有明確理由(如刻意對比)並在備註或設計文件記錄
- **圖形**:有圖的頁,圖放哪一格、佔多大(限高/限寬),圖是主角還是輔助;連接線方向順著本頁動線

與設計文件的「頁面規劃」有出入(實作時發現要拆頁/併頁/換圖形類型)時,先說明理由取得同意並回寫該表。開工時把段落 `status` 改為 `in-progress`。

### 2. 繪製圖形 SVG(有圖的頁才做)

依「頁面規劃」的圖形構想逐張產出 `talk/assets/diagram-<section編號>-<序號>-<slug>.svg`:

- 開頭 XML 註解 metadata(`type: diagram`、`diagram-type`、`section`、`status: draft`)
- viewBox 依內容比例自訂(不必 16:9),但要先想好嵌入格的大小,**回推圖內文字的最終渲染大小 ≥ 約 18px**
- 配色只用 theme.css tokens 的色值(手抄具體色碼,並在圖內保持一致);字體與投影片同família
- 圖形紀律:連接線轉折 ≤2 折、交叉為 0(不得已用跨線符號)、同圖單一流向、標籤貼近所指(<20px)、節點 ≤7(超過就分層或拆圖);文字用 `<text>` 不轉曲線
- **截圖加註圖**(使用者提供截圖/參考圖時):原始圖檔存 `talk/assets/img-XX-N-<slug>.<ext>`,加註 SVG 以截圖為底疊加標記 —
  - 截圖以 **base64 data URI 內嵌**進 SVG 的 `<image>`(SVG 經 `<img>` 載入時外部引用不會被讀取,外連路徑會整張空白);viewBox 取截圖原始像素比例
  - 標記用**編號圓徽**(1、2、3…)貼在目標區域旁,必要時加框線圈出區域或短箭頭指向;色值用 tokens 的強調/主色,徽章字體與投影片同 família
  - 標記 ≤5 且**編號順序 = 本頁動線順序**(聽眾照號碼走一遍就看完);超過 5 個就拆頁
  - 說明文字**不寫進圖裡** — 放頁面內文作圖例(慣用格局見 layouts.md:圖佔上方大格,下方 `cols-3` 每格「編號 + 短標 + 一行說明」),文字遵守文字規範,與標記一一對應、缺一即錯
- 一張圖回答一個問題 — 畫完自問這張圖的問題是什麼,答不出來回到設計文件

### 3. 撰寫 Marp 頁面(talk/src/section-XX-\<slug\>.md)

建立與設計文件**同編號同 slug** 的 deck 檔,frontmatter 依 conventions(`type: deck`、`section`、`slides`),內文依排版方案逐頁撰寫:

- 頁與頁之間以 `---` 分隔;整頁類別用 `<!-- _class: title|divider|center -->`,內容區用 layouts.md 的 grid 容器 div(**div 與 Markdown 內容之間留空行**)
- 文字內容依設計文件「內容要點」;一頁一重點,不搬運整段文件
- 字級、強調、列表符號依排版方案定案的文字技法(出自 topic.md「文字規範」);行距等排版值住在 theme.css,不逐頁覆寫
- 圖形以 `![h:400](../assets/diagram-XX-N-<slug>.svg)` 嵌入規劃的格
- **每頁結尾一個 `<!-- ... -->` 備註**:只寫提醒(要點順序、關鍵措辭、數字、時間警戒),1–5 行,禁止逐字稿與情境描述;本段第一頁備註以 `銜接:` 開頭,最後一頁含 `交棒:`(內容依設計文件「備註要點」)
- 段落開頭是否加 `divider` 隔頁,依 topic.md 的演講風格與使用者偏好

### 4. 建置與驗收(必做)

1. 在 `talk/src/` 執行 `node build.mjs`(加上 `topic.md` `outputs` 列的其他格式,如 `node build.mjs html pdf`);build 失敗先修再往下
2. 打開 `talk/dist/slides.html`(可行時用瀏覽器,否則請使用者開)檢查本段每一頁:文字不溢出格子、grid 沒塌陷(格數 = 子 div 數)、圖形清晰且文字讀得到、風格與前後段一致;**每頁重走一次動線**(第一眼落點是不是重點、閱讀順序有沒有被版面或連接線帶偏)、**文字技法對照文字規範**(字級/強調/列表符號都出自選單、同情境同寫法、標題與內文行距讀起來分得開)
3. 逐項核對設計文件:「內容要點」每一點都有落頁或落備註;「頁面規劃」每一列都有對應頁面與圖形(拆併頁差異回寫該表,附理由)
4. 回寫 metadata:deck 檔 `slides` = 實際張數、`status: done`;各 diagram `status: done`;docs section 的 `slides`、`diagrams` 回填實際值、`status: done`;`topic.md` 段落規劃表的頁數欄同步(經使用者同意)
5. 節奏粗檢:本段 `est-minutes` × 60 ÷ 頁數落在 20–180 秒/頁之外時告知使用者,建議調頁數或時間

### 5. Demo(僅目標段落有 Demo 規劃時)

- 依設計文件「Demo」章節建立 `demo/`:預設 `uv init` 的 python 專案 + notebook(依使用者要求可置換)
- demo 操作順序寫進該頁備註(提醒式:步驟與預期結果,不寫口播詞);`demo/README.md` 記錄環境建置與執行方式

### 6. 收尾

摘要:本段產出的檔案(deck 檔、圖形 SVG、dist 輸出)、每頁用的版型、與設計文件的偏差及理由、節奏檢查結果;建議下一個要實作的段落,或全部完成時建議用 `/page-adjust` 微調、`/section-design status` 總覽,並在上台前跑 `/review` 做整體審查。
