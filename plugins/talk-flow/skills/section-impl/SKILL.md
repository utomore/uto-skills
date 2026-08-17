---
name: section-impl
description: 演講段落實作 — 依 docs/topic.md 與 section 文檔撰寫 talk/scripts.md 講稿、產出 SVG 頁面並組進 talk/slide.html,需要時建立 demo/。觸發詞:段落實作、section impl、寫講稿、做投影片、產生 SVG、實作簡報。Use when implementing a talk section's script and SVG slides from its design docs.
user-invocable: true
---

# /section-impl — 演講段落實作

先讀取 `../_shared/conventions.md`,遵守其中所有文檔慣例(metadata、頁碼規則、投影片規格)。

## 前置

1. 讀取 `docs/topic.md`(燈塔;不存在時建議先執行 `/topic-design`)
2. 確認目標段落:使用者指定編號則用之;未指定則建議 `order` 最小、status 為 open 且已完成討論的段落。**目標段落必須已經過 `/section-discuss`**(內文有「內容要點」與「頁面規劃」章節且非空);只有佔位說明時,告知使用者建議先執行 `/section-discuss`,除非使用者明確要求直接實作
3. 讀取目標段落文檔與其 `depends-on` 段落(掌握銜接);讀取 `talk/scripts.md` 與 `talk/slide.html` 現況(不存在則本次建立)
4. 分配頁碼:掃描 `talk/assets/` 現有 `svg-*.svg` 取最大頁碼,新頁面從最大值 +1 接續;若本段落在演講順序上插在既有頁面之間,先列出需要重新編號的頁面清單,經使用者同意後依 conventions 的「頁碼同步」規則五處同步

## 流程

### 1. 開工前確認

向使用者摘要即將實作的內容:段落敘事線、預計產出的頁數與每頁畫面構想、是否含 demo。與 section 文檔的「頁面規劃」有出入(實作時發現要拆頁/併頁)時,先說明理由取得同意。開工時把段落 `status` 改為 `in-progress`。

### 2. 撰寫講稿(talk/scripts.md)

- 檔案不存在時先建立(frontmatter 依 conventions),存在則在正確位置(依 `order`)插入本段
- 每段固定結構:

```markdown
## Section 0x:<段落名稱>(<est-minutes> 分)

> 銜接:<怎麼接上一段/開場>

(→ page 03)
<講稿正文:口語化、可直接照著講;關鍵措辭依 section 文檔的「講稿要點」>

(→ page 04)
<講稿正文…>

> 交棒:<怎麼帶到下一段>
```

- `(→ page XX)` 標記翻頁時機;純口述段落無標記
- 語言依 `topic.md` 的 `language`;時長粗估以講稿字數對時(中文口語約 200–250 字/分鐘),明顯超支或不足時告知使用者並調整
- 完成後更新 frontmatter 的 `covers-sections` 與 `updated`

### 3. 產出 SVG(talk/assets/)

依「頁面規劃」逐頁產出 `svg-<頁碼:01>-<slug>.svg`:

- 遵守 conventions 投影片規格:`viewBox="0 0 1280 720"`、文字最小 24px、一頁一重點、開頭 XML 註解 metadata(`page`、`section`、`status: draft`)
- 視覺風格嚴格遵守 `topic.md` 的「投影片風格」章節;同段落頁面之間版面語彙一致(標題位置、配色、字級階層)
- 產出後自我檢查:文字是否溢出畫面、對比是否足夠、資訊是否超載(超載就拆頁,回到步驟 1 的確認)

### 4. 組進 talk/slide.html

- 不存在時建立:單檔、無外部資源、開頭 HTML 註解 metadata;以 `<img src="assets/svg-XX-*.svg">` 依頁碼順序嵌入,提供 ←/→ 鍵盤翻頁與「目前頁/總頁數」顯示,`file://` 直接可用
- 已存在時把本段頁面插入正確位置,更新 metadata 的 `pages` 總數與 `updated`

### 5. Demo(僅目標段落有 Demo 規劃時)

- 依 section 文檔「Demo」章節建立 `demo/`:預設 `uv init` 的 python 專案 + notebook(依使用者要求可置換)
- demo 步驟寫進講稿該段(操作順序與口播詞);`demo/README.md` 記錄環境建置與執行方式(frontmatter 依 conventions 的 scripts 格式,`type: scripts` 改為不適用時可省——README 至少要有一段說明)

### 6. 驗收與回寫(必做)

1. 逐項核對 section 文檔:「內容要點」每一點都在講稿或頁面出現;「頁面規劃」每一列都有對應 SVG(拆併頁的差異回寫到該表,附理由)
2. 回填 metadata:section 的 `pages`(實際頁碼清單)與 `status: done`;各 SVG `status: done`;`topic.md` 段落規劃表的頁數欄同步(經使用者同意)
3. 用瀏覽器(或請使用者)打開 `talk/slide.html` 檢查本段頁面渲染正常
4. 時間帳重算:講稿對時結果若改變 `est-minutes`,同步 section 與 topic.md

### 7. 收尾

摘要:本段產出的檔案(講稿區段、SVG 頁碼、slide.html 變動、demo)、與設計文檔的偏差及理由、時間帳現況;建議下一個要實作的段落,或全部完成時建議用 `/page-adjust` 微調、`/section-discuss status` 總覽,並在上台前跑 `/review` 做整體審查(主軸貼合度、銜接、講稿與投影片一致性)。
