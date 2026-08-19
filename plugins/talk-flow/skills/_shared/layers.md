# 分層詞彙表(共用)

投影片分成兩層:**背景層**(裝飾,不承載資訊)與**前景層**(標題、內文、表格、圖形、頁碼、固定角標 — 所有要讀的東西)。分層在 `/topic-design` 訪談時定案(寫進 `topic.md`「投影片分層」章節與 `talk/src/theme.css` 的分層 tokens),`/section-impl` 逐頁選背景類別,`/page-adjust` 調單頁,`/review` 檢查前景可讀性。本表是四個 skill 談「背景怎麼放」的共同語言。

**背景是選配不是必備**:`--bg-image: none` 是完全合法的定案(tech-deep / exec-brief 常態如此)。有背景時,它的職責只有一個 —— 讓畫面不空,不是讓畫面熱鬧。

## 兩層的分工

| 層 | 放什麼 | 紀律 |
|---|---|---|
| **背景層** | 色塊、漸層、紋理、品牌圖樣、全頁底圖 | 不放任何要讀的資訊(讀不到就等於沒有);讓出中央的主要內容區;不參與動線 |
| **前景層** | 標題、內文、表格、圖形 SVG、頁碼、固定角標(logo) | 全部文字與圖形都在這層;對背景的對比必須足夠;強調處是動線終點 |

三條不可違反的規則:

1. **第一眼必須落在前景**。背景搶走第一眼(對比過強、圖案跑進中央、動態感過重)就是失敗,調淡或改走邊角。
2. **背景不承載資訊**。要聽眾看的東西(圖表、截圖、任何有字的元素)一律進前景層,不能靠背景圖傳達。
3. **每頁背景可以不同,但換背景要有語意**。背景可以逐頁換(機制見下方「逐頁背景」),但換的理由要說得出來 —— 封面/轉場加強、章節換一套、圖表頁關閉、demo 頁換深色;沒有語意的隨頁亂換 = 視覺語彙失控,review 會扣分。

## 背景來源三選(訪談時選定其一)

| 來源 | 怎麼定 | 適用 |
|---|---|---|
| `none` | `--bg-image: none` | 純色底;資訊密度高、印表機友善、正式匯報 |
| **CSS 漸層** | `--bg-image` 直接寫 `radial-gradient(...)` 等,色值抄自 tokens | 使用者沒有素材、想跟 LLM 討論風格 — 免資產、改色即改風格,**預設走這條** |
| **背景資產檔** | `--bg-image: url("../assets/bg-<slug>.svg")`(或 `.png`/`.jpg`) | 使用者提供了品牌背景圖/照片,或風格需要漸層做不到的形狀(弧線、格線、有機色塊) |

三者可混:全場走漸層、封面用一張資產圖(逐頁覆寫,見下)。

`/topic-design` 的 `assets/backgrounds/` 附三張**起手範本**,可直接複製到 `talk/assets/` 再改色,或當作跟使用者討論風格時的具體選項:

| 範本 | 長相 | 常配的基底 |
|---|---|---|
| `bg-blobs.svg` | 對角柔和有機色塊,中央留白 | intro-friendly、keynote-impact |
| `bg-arc.svg` | 右下同心弧線 + 一小塊強調色 | tech-deep、keynote-impact |
| `bg-grid.svg` | 細格線由上往下漸顯 + 底部色帶 | tech-deep、workshop-guide |

## theme.css 的分層 tokens

分層只住在 `theme.css` 的 tokens 區,**不逐頁寫死背景色值或路徑**:

| token | 意義 | 常用值 |
|---|---|---|
| `--bg-image` | **全場預設**背景:`none` / CSS 漸層 / `url("../assets/bg-<slug>.svg")` | 依來源三選 |
| `--bg-image-2` / `--bg-image-3` | 第二、第三套背景(頁面用 class `bg-2` / `bg-3` 切換) | 不需要就留 `none` |
| `--bg-opacity` | 背景層透明度 0–1 — **調整前景可讀性的主旋鈕** | 0.35–0.6(淺底);深底 0.25–0.45 |
| `--bg-size` | `cover`(滿版裁切)/ `contain` / `100% auto` | `cover` |
| `--bg-position` | 背景定位 | `center` |
| `--fg-plate` | 前景襯底色(半透明),照片背景時墊在文字下 | `rgba(255,255,255,0.82)` |
| `--fg-mark-left` / `--fg-mark-right` | 固定角標(logo)的水平位置;一邊給值另一邊給 `auto` | 左下 `72px` / `auto` |

實作機制(theme.css 已內建,勿改):背景層畫在 `section::before`(`top/left/width/height` 撐滿、`z-index: 0`、`pointer-events: none`),前景層是 `section > *`、`header`/`footer` 與頁碼 `section::after`(`z-index: 1`)。**頁面內容不需要也不應該自己處理 z-index。**

兩個踩過的坑,改 theme 時別踩回去:

- `section::before` **不能用 `inset: 0`** —— marp 的渲染環境下 inset 不生效,背景會整層不見;要寫 `top/left/width/height: 100%`
- `section` 必須明寫 `display: flex; flex-direction: column`,否則 marp 預設會把內容垂直置中,`justify-content` 與版型類別的 `flex: 1` 都失效

## 逐頁背景(每頁都可以不一樣)

背景類別寫在該頁的 `<!-- _class: ... -->`,可與整頁類別、可互相並用(空白分隔):

| 類別 | 效果 | 用在哪 |
|---|---|---|
| (不寫) | `--bg-image` + `--bg-opacity` 原值 | 一般內容頁 |
| `bg-none` | 關閉背景層 | 圖表頁、截圖頁、資訊密度高的表格頁 — 背景會干擾判讀時 |
| `bg-soft` | 透明度 ×0.45 | 條列多、文字密的頁 |
| `bg-strong` | 透明度 ×1.8(上限 1) | 封面、divider 轉場、一句話結論的 `center` 頁 |
| `bg-2` | 換成 `--bg-image-2` | 第二套背景的頁面(語意由 topic.md 定) |
| `bg-3` | 換成 `--bg-image-3` | 第三套背景的頁面 |

```markdown
<!-- _class: divider bg-2 bg-strong -->   換第二套背景、加強、當轉場頁
<!-- _class: center bg-none -->           結論頁不要背景
```

**三個層級,由上往下用**:

1. **全場一套**(`--bg-image`)— 預設,視覺最收斂
2. **背景槽 `bg-2` / `bg-3`** — 需要「一組頁面換一套」時(封面與 divider 一套、demo 段落一套、案例段落一套);圖與色值仍住在 theme.css tokens,語意寫進 `topic.md`「投影片分層」,全場照表使用
3. **單頁 scoped style** — 真正一次性的一頁(某張照片只出現一次):

```html
<style scoped>section { --bg-image: url("../assets/bg-01-cover.jpg"); --bg-opacity: 0.3; }</style>
```

超過三套背景就要回頭問:這是設計還是失控?**背景的變化要對齊演講的結構**(段落、轉場、頁型),不是對齊頁碼。

## 背景強度準則(定 `--bg-opacity` 的依據)

- **對比優先**:正文疊在背景最深處仍要清楚可讀;拿不準就往淡的調 —— 背景過淡沒人抱怨,過濃每頁都在扣分
- **走邊角、留中央**:圖案集中在對角(左上/右下或右上/左下),中央約 60% 區域保持乾淨,標題與內文才有地方站
- **照片類背景**必須壓制:`--bg-opacity` 降到 0.2–0.35,或把文字區包一層 `class="plate"`(用 `--fg-plate` 襯底)
- **深色底**:背景圖要是亮色系(反過來會糊成一片),`--bg-opacity` 再降一級
- **不要動態感**:漸層方向、圖案走向不該把視線往頁面外拉

## CSS 漸層預設(免資產,色值換成 tokens 的實際色碼)

```css
/* A. 對角柔光 — 溫和、通用,最接近「留白但不空」*/
--bg-image:
  radial-gradient(circle at 88% 6%, #f7c9a3 0%, rgba(247,201,163,0) 42%),
  radial-gradient(circle at 96% 22%, #b9d4f2 0%, rgba(185,212,242,0) 38%),
  radial-gradient(circle at 4% 96%, #f9d9bd 0%, rgba(249,217,189,0) 40%);

/* B. 單側色帶 — 收斂,標題側留白最多(tech-deep 可用)*/
--bg-image: linear-gradient(105deg, rgba(36,86,164,0.14) 0%, rgba(36,86,164,0) 46%);

/* C. 底部漸隱 — 給有頁尾角標的版面壓一條重心 */
--bg-image: linear-gradient(180deg, rgba(36,86,164,0) 62%, rgba(36,86,164,0.16) 100%);
```

漸層用 tokens 的色碼手抄一份(CSS 變數可以互相引用:`rgba()` 內不能直接放 `var(--c-primary)`,所以漸層裡的色碼是抄的);**改色票時要一併重抄漸層**,這條寫進 topic.md「投影片分層」提醒自己。

## 背景資產檔規範

- 檔名 `bg-<slug>.svg`(或使用者提供的 `bg-<slug>.png` / `.jpg`),放 `talk/assets/`,**不佔 diagram 的編號空間**
- SVG 背景檔開頭一樣要 XML 註解 metadata(`type: background`,見 conventions);**XML 註解裡不能出現連續兩個減號**(`--c-primary` 這種寫法會讓整張 SVG 變成無效 XML、渲染成空白),要提 token 就寫「tokens 的主色」
- 柔邊用 `radialGradient` 收到 `stop-opacity="0"`,**不要用 `feGaussianBlur`** — 低透明度下 blur 的邊緣會出現可見接縫;多個形狀共用一個 `linearGradient` 時加 `gradientUnits="userSpaceOnUse"`,否則重疊處會有色差線
- `viewBox="0 0 1280 720"`,與投影片同比例;`--bg-size: cover` 會裁切,重要圖案不要貼邊
- 色值抄自 `theme.css` tokens;背景 SVG 裡**不放文字**
- 只用內嵌內容:禁止外部字型、網路圖片(離線必須可用);點陣背景圖先壓到 500KB 以內
- 使用者提供的照片:存原檔備改,套用時務必配合 `--bg-opacity` 或 `plate` 壓制
- 背景 SVG 不套 `/svg-layout`(那是量測架構圖幾何用的),背景只看渲染結果

## 固定角標(前景層的常駐元素)

logo、活動名、講者 handle 這類每頁都在的小元素走 Marp 的 `footer` 指令,不逐頁手寫:

```yaml
# talk/src/deck-header.md
footer: '![h:26](../assets/logo.svg)'
```

- 角標在**前景層**(`z-index: 1`),不會被背景蓋掉
- 預設左下(頁碼在右下,不打架);要換到右下就把 `--fg-mark-left: auto; --fg-mark-right: 72px;` 並在 deck-header 設 `paginate: false`
- 單頁不要角標:該頁寫 `<!-- _footer: "" -->`
- 角標高度 ≤ 32px,不與內容爭注意力;它是識別不是資訊
- **深色頁(`divider`、深色底)要檢查角標對比**:彩色 logo 疊在同色系底上會消失,該頁改用 `<!-- _footer: "" -->` 或備一份反白版 logo

## 判斷順序(訪談與實作時照這個問)

1. **這場需要背景嗎?** 資訊密度高、印表機友善、正式匯報 → `none` 就是答案,不要為了豐富而豐富
2. **素材從哪來?** 使用者有品牌背景圖/照片 → 資產檔;沒有 → 跟使用者討論風格關鍵字(柔和有機 / 幾何弧線 / 格線科技 / 單側色帶),用漸層或現畫 SVG
3. **要幾套?** 先問全場一套夠不夠;要多套就寫明「哪一組頁面用哪一套、為什麼」,填進 `--bg-image-2` / `--bg-image-3` 並記進 topic.md
4. **強度多少?** 從偏淡開始(0.35–0.5),build 後在最文字密的那頁看,再往上加
5. **哪些頁要關?** 圖表頁、截圖頁、密集表格頁一律 `bg-none`;封面與 divider 通常 `bg-strong`
6. **驗收**:build 後看最密的一頁(文字讀得清?)與最空的一頁(畫面不空?)、再把用到的每一套背景各看一頁 —— 全過才算定案
