# 演講內容產生流程文檔慣例(共用)

所有演講流程 skills(topic-design、section-design、section-impl、page-adjust、review)共用本慣例。

投影片以 **Marp Markdown** 撰寫,由 **marp-cli** 輸出(html / pdf / pptx);SVG 只用來畫**圖形**(架構圖、流程圖等),不再手工繪製整頁投影片。講稿全面簡化為**頁內備註**(Marp presenter notes),重要處提醒即可,不寫逐字稿。

## 資料夾結構(演講專案內)

```
docs/
├── topic.md                        # 演講燈塔:主軸、聽眾、時長、風格、sections 清單
└── section-01-<slug>.md            # 段落設計文件(兩位數編號,依演講順序)
talk/
├── src/                            # 投影片原始碼與 Marp 設定(唯一手寫處)
│   ├── deck-header.md              # Marp 全域 frontmatter(theme、paginate 等)
│   ├── section-01-<slug>.md        # 每 section 一檔投影片原始碼(含 <!-- 備註 -->)
│   ├── theme.css                   # 自訂主題(色票 tokens + Layout 版型類別)
│   ├── .marprc.yml                 # marp-cli 設定
│   ├── build.mjs                   # 合併 section 檔 → slides.md → marp-cli 輸出
│   └── slides.md                   # build 產物(合併結果),不手改
├── assets/
│   ├── diagram-02-1-<slug>.svg     # 圖形資產(所屬 section 編號 + 段內序號)
│   └── img-02-1-<slug>.png         # 截圖加註的原始圖(base64 內嵌進對應 SVG 後保留備改)
└── dist/                           # marp-cli 輸出(slides.html / slides.pdf / ...),不手改
review/
└── review-2026-08-18-1.md          # /review 審查報告(日期 + 當日序號)
demo/                               # (可選)示範操作,預設 uv + python + notebook
```

## 建置與輸出

- 在 `talk/src/` 執行 `node build.mjs [html|pdf|pptx ...]`(預設 html):依檔名順序合併 `deck-header.md` + 各 `section-*.md`(剝除各檔 frontmatter,以 `---` 接合)→ `slides.md` → 呼叫 marp-cli 輸出到 `talk/dist/`
- **不強制任何單一呈現格式**:html 適合鍵盤翻頁與逐頁審查,pdf 適合上台備援與分發,pptx 適合主辦方需求;要哪些由使用者決定(記錄在 `topic.md` 的 `outputs`)
- `slides.md` 與 `talk/dist/` 是**產物**:任何修改回到 `talk/src/` 的 section 檔或 theme.css,改完重 build
- 圖形以相對路徑嵌入:`![...](../assets/diagram-02-1-<slug>.svg)` — 從 `src/` 與 `dist/` 解析結果相同(兩者是兄弟目錄)

## 命名規則

- 檔名一律**英文 kebab-case**;內文語言依 `topic.md` 的 `language`(預設繁體中文)
- section 編號**兩位數**遞增(`section-01`),順序 = 演講順序;建新檔前掃描 `docs/` 現有檔名取最大編號 +1
- `docs/section-XX-<slug>.md` 與 `talk/src/section-XX-<slug>.md` **同編號同 slug**,一一對應(純口述段落可無 src 檔)
- 圖形檔名 `diagram-<section編號>-<段內序號>-<slug>.svg`(如 `diagram-02-1-arch-overview.svg`):序號只在該 section 內遞增,段落增刪不需要重編其他段的圖
- 全域頁碼是**推導值**(依 section 檔案順序累加各檔頁數),不寫進任何檔名;引用頁面時以「section + 段內第幾頁」或 build 後的頁碼溝通
- 日期一律 `YYYY-MM-DD`

## Metadata 標準

**每份手寫文件都必須有 metadata**(產物 `slides.md`、`talk/dist/*` 除外),格式依檔案類型:

- Markdown(topic / docs section / deck section):開頭 YAML frontmatter(deck section 的 frontmatter 由 build.mjs 剝除,不會進投影片)
- SVG:檔案開頭 XML 註解 `<!-- ... -->` 內放 YAML(置於 `<svg>` 標籤之前)

### topic(docs/topic.md)

```yaml
---
id: topic
type: topic
title: <talk-slug>
description: <一句話,40 字內:這場演講在講什麼>
status: active
created: 2026-08-18
updated: 2026-08-18
duration-minutes: 40         # 演講總時長(分鐘)
event-type: deep-tech        # deep-tech(深度技術分享)| intro(啟蒙/科普)| workshop(工作坊)|
                             # lightning(閃電秀)| keynote(主題演講)| internal(內部分享)| lecture(教學課程)
audience: <聽眾範圍描述,如:後端工程師為主的技術社群>
audience-level: intermediate # beginner | intermediate | advanced | mixed
speaker-background: <講者先備知識一句話>
language: zh-TW
style-base: tech-deep        # 風格基底,見 _shared/styles.md:tech-deep | keynote-impact |
                             # intro-friendly | workshop-guide | exec-brief | custom
slide-style: <風格關鍵字,如:深色極簡、單色強調>
outputs: [html, pdf]         # marp-cli 輸出格式(html | pdf | pptx),依使用者需求
sections: []                 # 段落 id 的唯一權威清單(含 rejected),依演講順序
demo: none                   # none | planned | done
---
```

### section 設計文件(docs/section-01-\<slug\>.md)

```yaml
---
id: section-01
type: section
title: <slug>
description: <一句話,40 字內:這個段落要傳達什麼>
status: open                 # open | in-progress | done | rejected
created: 2026-08-18
updated: 2026-08-18
parent-topic: topic          # 回鏈燈塔(固定為 topic)
order: 1                     # 演講順序(= 編號去零)
est-minutes: 8               # 預估時長(分鐘)
slides: 0                    # 本段實際頁數(實作後回填;0 = 純口述或尚未實作)
diagrams: []                 # 本段圖形 id 清單,如 [diagram-02-1];無圖形留 []
depends-on: []               # 依賴的其他 section id(先備知識鋪陳順序)
---
```

### deck section(talk/src/section-01-\<slug\>.md)

```yaml
---
id: deck-01
type: deck
title: <slug>
description: <一句話,40 字內>
status: draft                # draft | done
created: 2026-08-18
updated: 2026-08-18
section: section-01          # 對應的設計文件 id
slides: 3                    # 本檔頁數(= 內文以 --- 分隔出的張數)
---
```

### diagram(talk/assets/diagram-02-1-\<slug\>.svg,XML 註解)

```xml
<!--
id: diagram-02-1
type: diagram
title: <slug>
description: <一句話,40 字內:這張圖在畫什麼>
diagram-type: 架構圖          # 見 section-design 的圖形類型清單
status: draft                # draft | done
created: 2026-08-18
updated: 2026-08-18
section: section-02          # 所屬段落 id
-->
```

### 清單欄位格式(唯一寫法:行內陣列)

`sections`、`diagrams`、`depends-on`、`outputs` 等清單欄位**一律寫成行內陣列**,空值寫 `[]`:

```yaml
sections: [section-01, section-02, section-03]   # ✅ 唯一合規寫法
diagrams: []                                     # ✅ 空清單
depends-on: [section-02]                         # ✅ 單一元素也用陣列
```

```yaml
sections:                                        # ❌ 不使用 YAML 區塊列表
  - section-01
  - section-02
```

- 理由:狀態掃描腳本只讀檔頭、只認行內陣列;兩種格式並存會讓清單被讀成空值而誤報「清單不一致」
- 值含冒號 `:`、`#` 或空白時,該元素用雙引號括起來
- `/section-design status` 偵測到區塊列表會列進「frontmatter 格式不合規」並以 exit code 1 收場,改回行內陣列即可

### `description` 欄位規則(必填)

- **所有類型都要寫**:topic / section / deck / diagram,一個都不能少
- **一句話**描述本文件的**主軸**,繁體中文、40 字以內,不加句號
- 值含冒號 `:` 或 `#` 時整句用雙引號括起來(YAML 規則)
- 狀態掃描只讀 metadata,description 讓人不開檔就懂內容

## 狀態流轉

- section:`open`(建檔/設計完成)→ `in-progress`(實作中)→ `done`(投影片與備註完成);`rejected` 為終態(使用者拒絕此段落),**保留檔案與拒絕理由**,不從 `sections` 清單移除,且不建立對應 deck 檔
- deck / diagram:`draft` → `done`

## 通用規則

- 修改任何文件時,同步更新 metadata 的 `updated`
- `docs/topic.md` 是演講燈塔:任何產出與其衝突時,必須回頭檢查並(經使用者同意)更新;`sections` 是段落的**唯一權威清單**,建檔、拒絕段落時必須同步回填
- **對應同步**:每個非 rejected 且有頁面的 section,三處必須一致 — docs section 的 `slides`/`diagrams`、deck 檔的實際張數與 frontmatter `slides`、`talk/assets/` 的圖形檔;deck 檔引用的圖形檔必須存在,沒被任何 deck 引用的圖形是孤兒
- **時間帳**:所有非 rejected section 的 `est-minutes` 總和必須 ≈ `duration-minutes`(留 5–10% 緩衝給開場與 Q&A 銜接);任何段落增刪或時長調整後重算一次
- **Context 載入紀律**:工作時只讀 `docs/topic.md`、當前目標 section(設計文件 + deck 檔)、與其 `depends-on` 相關的 section;`rejected` 的段落除非必要否則不載入
- **上台前驗收**:`/review` 交叉比對段落覆蓋、對應同步、依賴順序與時間帳,並 build 後逐頁審查版面、視覺引導、文字規範、配色、圖形與備註,產出報告 `review/review-<YYYY-MM-DD>-<序號>.md`;它不修改任何原始碼與文檔(重新 build 產物與 review 報告除外),修正由 `/page-adjust`、`/section-design`、`/section-impl` 執行

## 投影片規格(Marp)

- 頁面 1280×720(theme.css 已設定);**一頁一重點**,超過就拆頁
- **風格基底**:`topic.md` 的 `style-base` 從 `_shared/styles.md` 選定(依場合:技術/主題演講/科普/工作坊/匯報),為版面、配色、文字規範、圖形風格與節奏提供預設方向;偏離基底的決定記錄在「投影片風格」章節,執行與審查都以基底 + 記錄的偏離為準
- **Layout 用 theme.css 的版型類別**,不逐頁手刻 CSS;版型詞彙表與用法見 `_shared/layouts.md`。整頁單一區塊也是合法版型 — 切格只在內容有並列/對比關係時用
- **視覺引導是每頁的必要設計項**:每頁要說得出動線(眼睛從哪進、依什麼順序看、在哪停),動線與內容邏輯順序一致;圖形的連接線方向要順著動線,不得把視線拉回頭
- **文字技法一律出自 `topic.md` 的「文字規範」**:字級(哪個級別用在哪個情境)、強調方式(粗體/底線/強調色各用在哪)、列表符號(各符號的語意)都在 topic 設計時定案;實作與調整只能**從中選用**,不得自創新的字級、強調或符號用法 — 同一情境全簡報必須同一種寫法,要偏離必須有明確理由(如刻意做出差異對比)並記錄
- 內文形式三選:**條列**(一層為主,每點一行內講完)、**表格**(維度對比才用)、**段落文字**(一頁最多一小段);同一格內不混用
- 圖形一律 SVG 置於 `talk/assets/`,以 `![](../assets/diagram-XX-N-<slug>.svg)` 嵌入指定區塊;圖內文字在**版面上的最終渲染大小**不得小於約 18px(嵌入區塊會縮放,畫圖時要回推)
- 禁止外部資源(網路圖片、CDN 字型)— 離線必須可用;點陣圖(截圖)僅在必要時使用
- **截圖加註**:使用者提供截圖或參考圖時,可直接以該圖為底、用 SVG 疊加**編號標記**呈現(不必重畫成圖形)— 原始圖檔存 `talk/assets/img-<section編號>-<段內序號>-<slug>.<ext>`,加註 SVG 照 diagram 命名與 metadata;截圖必須以 **base64 data URI 內嵌**進 SVG(SVG 經 `<img>` 載入時讀不到外部檔案,外連會整張空白);說明文字不寫進圖裡,放頁面內文作圖例(編號 + 短標 + 一行說明,遵守文字規範),與標記一一對應
- 配色、字體只改 `theme.css` 的 tokens(CSS variables),不在單頁內寫死色值;全簡報一致
- **備註**:每頁結尾一個 `<!-- ... -->` 註解作 presenter note,**只寫提醒**(要點、關鍵措辭、時間提醒),1–5 行,禁止逐字稿與情境描述;段落第一頁備註以 `銜接:` 開頭(怎麼接上一段)、最後一頁含 `交棒:`(怎麼帶到下一段)
