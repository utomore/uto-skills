# 演講內容產生流程文檔慣例(共用)

所有演講流程 skills(topic-design、section-design、section-impl、page-adjust、review)共用本慣例。

投影片以 **Marp Markdown** 撰寫,由 **marp-cli** 輸出(html / pdf / pptx);SVG 只用來畫**圖形**(架構圖、流程圖等),不再手工繪製整頁投影片。講稿全面簡化為**頁內備註**(Marp presenter notes),重要處提醒即可,不寫逐字稿。

共用詞彙表:`styles.md`(風格基底)、`layouts.md`(版型)、`layers.md`(前景/背景分層)、`diagrams.md`(圖形)。

## 層級與顆粒度(所有 skill 的共同紀律)

流程是三層階梯,**每一層只決定自己顆粒度的事,不往下伸手**:

| 層 | 命令 | 決定什麼 | 顆粒度下限(再往下就越權) |
|---|---|---|---|
| L1 主軸 | `/topic-design` | 核心訊息、聽眾、時長、段落切分、風格基底、**視覺規範的語意**(強調有哪幾種各代表什麼、背景幾套各對應演講的什麼結構) | 寫到「語意與數量」為止。**禁止**寫入任何 CSS 數值(px、色碼、opacity)、class 名或槽位編號 — 那些屬於 theme.css 與 L3 |
| L2 段落 | `/section-design` | 每頁要說服聽眾什麼、內文放什麼、要不要圖、圖回答什麼問題、背景的**語意需求**(這段要不要跟別段區隔) | 寫到「這頁講什麼」為止。**禁止**指定版型類別、`bg-*` 類別、圖形畫法與座標 |
| L3 實作 | `/section-impl`、`/page-adjust` | 版型、視覺動線、文字技法的逐頁選用、SVG 幾何、背景類別、theme.css tokens 的實際數值 | 在 L1 語意規範與 L2 內容規劃之內,**擁有完全的呈現自主權** |

- **唯一真相**:所有視覺數值(字級 px、色碼、`--bg-opacity`、間距)只住在 `talk/src/theme.css`。`docs/` 底下的文件記錄**決定與理由**,不複製數值 —— 兩份數值必然漂移
- **往上回頭,不往下私設**:下層需要上層沒定義的東西(規範外的強調寫法、沒定義過的背景套數、超出主軸的內容),回上層的命令加進規範再回來用,不在本層私設
- **上層不因下層的內部選擇而改動**:L3 換個版型、調個座標、微調 opacity,不需要也不該回頭改 `topic.md`;只有「語意或數量本身要變」才回上層

## 資料夾結構(演講專案內)

```
docs/
├── topic.md                        # 演講燈塔:主軸、聽眾、時長、風格、sections 清單
└── section-01-<slug>.md            # 段落設計文件(兩位數編號,依演講順序)
talk/
├── src/                            # 投影片原始碼與 Marp 設定(唯一手寫處)
│   ├── deck-header.md              # Marp 全域 frontmatter(theme、paginate、footer 角標等)
│   ├── section-01-<slug>.md        # 每 section 一檔投影片原始碼(含 <!-- 備註 -->)
│   ├── theme.css                   # 自訂主題(色票/分層 tokens + Layout 版型類別 + 分層機制)
│   ├── .marprc.yml                 # marp-cli 設定
│   ├── build.mjs                   # 合併 section 檔 → slides.md → marp-cli 輸出
│   └── slides.md                   # build 產物(合併結果),不手改
├── assets/
│   ├── diagram-02-1-<slug>.svg     # 圖形資產(所屬 section 編號 + 段內序號)
│   ├── bg-<slug>.svg               # 背景層資產(全簡報共用,不綁 section;.png/.jpg 亦可)
│   ├── logo.svg                    # 前景固定角標(deck-header 的 footer 指令引用)
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
- `talk/src/` **只能有一份 .css**:build 會把整個目錄當 theme set 載入,留下 `theme.bak.css` 之類的備份會讓 marp-cli 撞到同名 theme 而卡住不結束 — 要備份請放到 `talk/src/` 以外
- 圖形以相對路徑嵌入:`![...](../assets/diagram-02-1-<slug>.svg)` — 從 `src/` 與 `dist/` 解析結果相同(兩者是兄弟目錄)

## 命名規則

- 檔名一律**英文 kebab-case**;內文語言依 `topic.md` 的 `language`(預設繁體中文)
- section 編號**兩位數**遞增(`section-01`),順序 = 演講順序;建新檔前掃描 `docs/` 現有檔名取最大編號 +1
- `docs/section-XX-<slug>.md` 與 `talk/src/section-XX-<slug>.md` **同編號同 slug**,一一對應(純口述段落可無 src 檔)
- 圖形檔名 `diagram-<section編號>-<段內序號>-<slug>.svg`(如 `diagram-02-1-arch-overview.svg`):序號只在該 section 內遞增,段落增刪不需要重編其他段的圖
- 背景資產檔名 `bg-<slug>.<svg|png|jpg>`(如 `bg-blobs.svg`):**不帶 section 編號**(背景屬於全簡報,由 theme.css 的分層 tokens 引用,不屬於任何一段);角標檔固定 `logo.<svg|png>`
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
background: none             # 背景層來源:none | gradient(CSS 漸層)| asset(資產檔)| mixed;
                             # 幾套、各用在哪、強度寫在「投影片分層」章節
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
diagram-type: 架構圖          # 見 _shared/diagrams.md 的圖形類型選型表
status: draft                # draft | done
created: 2026-08-18
updated: 2026-08-18
section: section-02          # 所屬段落 id
-->
```

### background(talk/assets/bg-\<slug\>.svg,XML 註解)

```xml
<!--
id: bg-blobs
type: background
title: <slug>
description: <一句話,40 字內:這張背景長什麼樣>
status: draft                # draft | done
created: 2026-08-19
updated: 2026-08-19
-->
```

背景資產屬於全簡報(不寫 `section`);點陣背景(png/jpg)無法內嵌註解,改在 `topic.md`「投影片分層」記錄來源與用途。**XML 註解內不得出現連續兩個減號**(寫 `--c-primary` 會讓整張 SVG 變成無效 XML、渲染成空白)。

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
- deck / diagram / background:`draft` → `done`

## 通用規則

- 修改任何文件時,同步更新 metadata 的 `updated`
- `docs/topic.md` 是演講燈塔:任何產出與其衝突時,必須回頭檢查並(經使用者同意)更新;`sections` 是段落的**唯一權威清單**,建檔、拒絕段落時必須同步回填
- **對應同步**:每個非 rejected 且有頁面的 section,三處必須一致 — docs section 的 `slides`/`diagrams`、deck 檔的實際張數與 frontmatter `slides`、`talk/assets/` 的圖形檔;deck 檔引用的圖形檔必須存在,沒被任何 deck 引用的圖形是孤兒;theme.css 分層 tokens 與頁內 scoped style 引用的背景/角標檔也必須存在(背景檔不存在時整頁只剩底色,build 不會報錯)
- **時間帳**:所有非 rejected section 的 `est-minutes` 總和必須 ≈ `duration-minutes`(留 5–10% 緩衝給開場與 Q&A 銜接);任何段落增刪或時長調整後重算一次
- **Context 載入紀律**:工作時只讀 `docs/topic.md`、當前目標 section(設計文件 + deck 檔)、與其 `depends-on` 相關的 section;`rejected` 的段落除非必要否則不載入
- **上台前驗收**:`/review` 交叉比對段落覆蓋、對應同步、依賴順序與時間帳,並 build 後逐頁審查版面、視覺引導、文字規範、配色、圖形與備註,產出報告 `review/review-<YYYY-MM-DD>-<序號>.md`;它不修改任何原始碼與文檔(重新 build 產物與 review 報告除外),修正由 `/page-adjust`、`/section-design`、`/section-impl` 執行

## 投影片規格(Marp)

- 頁面 1280×720(theme.css 已設定);**一頁一重點**,超過就拆頁
- **風格基底**:`topic.md` 的 `style-base` 從 `_shared/styles.md` 選定(依場合:技術/主題演講/科普/工作坊/匯報),為版面、配色、文字規範、圖形風格與節奏提供預設方向;偏離基底的決定記錄在「投影片風格」章節,執行與審查都以基底 + 記錄的偏離為準
- **Layout 用 theme.css 的版型類別**,不逐頁手刻 CSS;版型詞彙表與用法見 `_shared/layouts.md`。整頁單一區塊也是合法版型 — 切格只在內容有並列/對比關係時用
- **分層**:每頁分**背景層**(裝飾,不承載資訊)與**前景層**(標題、內文、圖形、頁碼、固定角標);背景在 `topic.md`「投影片分層」與 theme.css 的分層 tokens(`--bg-image` / `--bg-image-2` / `--bg-image-3` / `--bg-opacity`)定案,逐頁用 `bg-none` / `bg-soft` / `bg-strong` / `bg-2` / `bg-3` 切換 —— **每頁背景可以不同,但換背景要有語意**(對齊段落、轉場、頁型,不是對齊頁碼)。詞彙、強度準則與資產規範見 `_shared/layers.md`。**背景沒有也完全合法**(`--bg-image: none`)
- **視覺引導是每頁的必要設計項**:每頁要說得出動線(眼睛從哪進、依什麼順序看、在哪停),動線與內容邏輯順序一致;圖形的連接線方向要順著動線,不得把視線拉回頭
- **文字技法一律出自 `topic.md` 的「文字規範」**:字級(哪個級別用在哪個情境)、強調方式(粗體/底線/強調色各用在哪)、列表符號(各符號的語意)都在 topic 設計時定案。規範定的是**語意**(級別 → 情境),級別的實際大小住在 theme.css,規範不抄一份 px。實作與調整只能**從中選用**,不得自創新的字級、強調或符號用法 — 同一情境全簡報必須同一種寫法,要偏離必須有明確理由(如刻意做出差異對比)並記錄
- 內文形式三選:**條列**(一層為主,每點一行內講完)、**表格**(維度對比才用)、**段落文字**(一頁最多一小段);同一格內不混用
- 圖形一律 SVG 置於 `talk/assets/`,以 `![](../assets/diagram-XX-N-<slug>.svg)` 嵌入指定區塊;類型選單、圖形紀律(轉折 ≤2、單一流向、節點 ≤7、渲染字級 ≥18px)、量測方式與**截圖加註**規範見 `_shared/diagrams.md`。選型與「這張圖回答什麼問題」由設計層定,**怎麼畫由實作層自主決定**
- 禁止外部資源(網路圖片、CDN 字型)— 離線必須可用;點陣圖(截圖)僅在必要時使用
- 配色、字體、背景只改 `theme.css` 的 tokens(CSS variables),不在單頁內寫死色值或背景路徑;全簡報一致(真正一次性的單頁背景才用 `<style scoped>`)。**theme.css 是視覺數值的唯一真相**,`docs/` 的文件只記語意與理由
- **備註**:每頁結尾一個 `<!-- ... -->` 註解作 presenter note,**只寫提醒**(要點、關鍵措辭、時間提醒),1–5 行,禁止逐字稿與情境描述;段落第一頁備註以 `銜接:` 開頭(怎麼接上一段)、最後一頁含 `交棒:`(怎麼帶到下一段)
