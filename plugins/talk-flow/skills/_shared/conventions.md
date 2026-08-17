# 演講內容產生流程文檔慣例(共用)

所有演講流程 skills(topic-design、section-discuss、section-impl、page-adjust、review)共用本慣例。

## 資料夾結構(演講專案內)

```
docs/
├── topic.md                        # 演講燈塔:主軸、聽眾、時長、風格、sections 清單
└── section-01-<slug>.md            # 段落設計文件(兩位數編號,依演講順序)
talk/
├── assets/
│   └── svg-01-<slug>.svg           # 投影片頁面(兩位數全域頁碼)
├── scripts.md                      # 講稿(依 section 分段,含頁碼標記)
└── slide.html                      # 組合 SVG 的網頁簡報(頁面順序的權威)
demo/                               # (可選)示範操作,預設 uv + python + notebook
```

## 命名規則

- 檔名一律**英文 kebab-case**;內文語言依 `topic.md` 的 `language`(預設繁體中文)
- section 編號**兩位數**遞增(`section-01`),順序 = 演講順序;建新檔前掃描 `docs/` 現有檔名取最大編號 +1
- SVG 頁碼**兩位數**遞增(`svg-01`),**全簡報連續**(跨 section 不歸零);頁面播放順序以 `talk/slide.html` 為權威
- 日期一律 `YYYY-MM-DD`

## Metadata 標準

**每份文件都必須有 metadata**,格式依檔案類型:

- Markdown(topic / section / scripts):開頭 YAML frontmatter
- `slide.html`:檔案開頭 HTML 註解 `<!-- ... -->` 內放 YAML
- SVG:檔案開頭 XML 註解 `<!-- ... -->` 內放 YAML(置於 `<svg>` 標籤之前)

### topic(docs/topic.md)

```yaml
---
id: topic
type: topic
title: <talk-slug>
description: <一句話,40 字內:這場演講在講什麼>
status: active
created: 2026-08-17
updated: 2026-08-17
duration-minutes: 40         # 演講總時長(分鐘)
event-type: deep-tech        # deep-tech(深度技術分享)| intro(啟蒙/科普)| workshop(工作坊)|
                             # lightning(閃電秀)| keynote(主題演講)| internal(內部分享)| lecture(教學課程)
audience: <聽眾範圍描述,如:後端工程師為主的技術社群>
audience-level: intermediate # beginner | intermediate | advanced | mixed
speaker-background: <講者先備知識一句話>
language: zh-TW
slide-style: <風格關鍵字,如:深色極簡、單色強調、手繪感>
sections: []                 # 段落 id 的唯一權威清單(含 rejected),依演講順序
demo: none                   # none | planned | done
---
```

### section(docs/section-01-\<slug\>.md)

```yaml
---
id: section-01
type: section
title: <slug>
description: <一句話,40 字內:這個段落要傳達什麼>
status: open                 # open | in-progress | done | rejected
created: 2026-08-17
updated: 2026-08-17
parent-topic: topic          # 回鏈燈塔(固定為 topic)
order: 1                     # 演講順序(= 編號去零)
est-minutes: 8               # 預估時長(分鐘)
pages: []                    # 對應的全域頁碼清單,如 [03, 04];段落可為 0 頁(純口述)
depends-on: []               # 依賴的其他 section id(先備知識鋪陳順序)
---
```

### scripts(talk/scripts.md)

```yaml
---
id: scripts
type: scripts
title: <talk-slug>-scripts
description: <一句話,40 字內>
status: draft                # draft | done
created: 2026-08-17
updated: 2026-08-17
parent-topic: topic
covers-sections: []          # 已寫入講稿的 section id 清單
---
```

### slide(talk/slide.html,HTML 註解)

```html
<!--
id: slide
type: slide
title: <talk-slug>-slide
description: <一句話,40 字內>
status: draft                # draft | done
created: 2026-08-17
updated: 2026-08-17
parent-topic: topic
pages: 12                    # 目前總頁數
-->
```

### svg(talk/assets/svg-03-\<slug\>.svg,XML 註解)

```xml
<!--
id: svg-03
type: svg
page: 03
title: <slug>
description: <一句話,40 字內:這頁在畫什麼>
status: draft                # draft | done
created: 2026-08-17
updated: 2026-08-17
section: section-02          # 所屬段落 id
-->
```

### 清單欄位格式(唯一寫法:行內陣列)

`sections`、`pages`、`depends-on`、`covers-sections` 等清單欄位**一律寫成行內陣列**,空值寫 `[]`:

```yaml
sections: [section-01, section-02, section-03]   # ✅ 唯一合規寫法
pages: []                                        # ✅ 空清單
depends-on: [section-02]                         # ✅ 單一元素也用陣列
```

```yaml
sections:                                        # ❌ 不使用 YAML 區塊列表
  - section-01
  - section-02
```

- 理由:狀態掃描腳本只讀檔頭、只認行內陣列;兩種格式並存會讓清單被讀成空值而誤報「清單不一致」
- 值含冒號 `:`、`#` 或空白時,該元素用雙引號括起來:`pages: ["03", "04"]`
- `/section-discuss status` 偵測到區塊列表會列進「frontmatter 格式不合規」並以 exit code 1 收場,改回行內陣列即可

### `description` 欄位規則(必填)

- **所有類型都要寫**:topic / section / scripts / slide / svg,一個都不能少
- **一句話**描述本文件的**主軸**,繁體中文、40 字以內,不加句號
- 值含冒號 `:` 或 `#` 時整句用雙引號括起來(YAML 規則)
- 段落狀態掃描(`/section-discuss status`)只讀 metadata,description 讓人不開檔就懂內容

## 狀態流轉

- section:`open`(建檔/討論完成)→ `in-progress`(實作中)→ `done`(講稿與 SVG 完成);`rejected` 為終態(使用者拒絕此段落),**保留檔案與拒絕理由**,不從 `sections` 清單移除
- scripts / slide / svg:`draft` → `done`

## 通用規則

- 修改任何文件時,同步更新 metadata 的 `updated`
- `docs/topic.md` 是演講燈塔:任何產出與其衝突時,必須回頭檢查並(經使用者同意)更新;`sections` 是段落的**唯一權威清單**,建檔、拒絕段落時必須同步回填
- **頁碼同步**:頁碼是全域的,插入/刪除頁面必須重新編號後續頁面,並同步五處 — SVG 檔名、SVG metadata 的 `page`、section 文件的 `pages`、`scripts.md` 的頁碼標記、`slide.html` 的頁面清單
- **時間帳**:所有非 rejected section 的 `est-minutes` 總和必須 ≈ `duration-minutes`(留 5–10% 緩衝給開場與 Q&A 銜接);任何段落增刪或時長調整後重算一次
- **Context 載入紀律**:工作時只讀 `docs/topic.md`、當前目標 section、與其 `depends-on` 相關的 section;`rejected` 的段落除非必要否則不載入
- **上台前驗收**:`/review` 唯讀交叉比對上述五處頁碼同步、段落覆蓋、依賴順序與時間帳,並審查主軸貼合度、偏題比例、銜接與難度峰值;它不修改任何檔案,修正由 `/page-adjust`、`/section-discuss`、`/section-impl` 執行

## 投影片規格

- SVG 一律 `viewBox="0 0 1280 720"`(16:9),不寫死 width/height 以便縮放
- 文字最小 24px(備註/來源可 18px);**一頁一重點**,超過就拆頁
- 配色、字體、視覺語彙遵守 `topic.md` 的 `slide-style`,全簡報一致
- 文字一律用 `<text>`(可搜尋、可改),不要把文字轉曲線;中文字體 fallback 寫入 `font-family`
- `slide.html` 以 `<img src="assets/svg-XX-*.svg">` 依頁碼順序嵌入,提供鍵盤翻頁(←/→)與頁碼顯示,離線可用(file:// 直接開)、無外部資源
