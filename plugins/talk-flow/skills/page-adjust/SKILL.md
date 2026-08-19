---
name: page-adjust
description: 投影片單頁調整 — 針對指定頁面的 Marp 原始碼深談 Layout、內文、圖形 SVG 或備註的調整,修改 talk/src 與 talk/assets 後重 build 並同步 section 設計文件。觸發詞:頁面調整、page adjust、改投影片、調整某頁、換版面、改圖、修架構圖。Use when adjusting a single slide page (Marp source, layout, diagram SVG, or note) and syncing its related docs.
user-invocable: true
---

# /page-adjust — 投影片單頁調整

先讀取 `../_shared/conventions.md`、`../_shared/layouts.md`、`../_shared/layers.md` 與 `../_shared/diagrams.md`,遵守所有文檔慣例、版型詞彙、分層詞彙與圖形詞彙。

## 層級(本命令的職權)

本命令與 `/section-impl` 同屬 **Level 3**:在 `topic.md` 的語意規範內,**版型、動線、圖形幾何、背景類別與 theme.css 的數值都是你的職權**,調完不必回寫 `topic.md`。

只有兩種情況要往上走:**語意要變**(需要規範外的強調寫法、要新增一套背景 → `/topic-design`)、**內容要變**(拆頁併頁、換圖形類型、改內容要點 → 回寫該段設計文件)。

## 前置

1. 定位目標頁:全域頁碼是推導值,先依 `talk/src/section-*.md` 檔名順序累加各檔張數算出「頁碼 → section 檔 + 段內第幾頁」的對照(或由使用者給的內容描述列出候選頁確認)。找不到就把對照表印給使用者指認
2. 讀取該 deck 檔、該頁引用的圖形 SVG 與 metadata、對應的 `docs/section-XX-*.md`(「頁面規劃」該列與「視覺備註」)、`docs/topic.md` 的 `style-base`、「投影片風格」、「投影片分層」與「文字規範」、`talk/src/theme.css`;調整方向以風格基底為準(`_shared/styles.md`)
3. 可行時先 build(`node build.mjs`)並在瀏覽器開 `talk/dist/slides.html` 跳到該頁看現況,再開始討論

## 流程

### 1. 討論調整內容(不可跳過)

與使用者確認要調整的面向與期望結果,**不確定就問,禁止腦補**:

- **Layout**:換版型(從 layouts.md 詞彙表選;整頁單一區塊也是選項)、格內配置、圖文比例 — 一頁一重點,資訊超載時建議拆頁;調整後重走動線(眼睛從哪進、依什麼順序看、在哪停)
- **內文**:文字內容、措辭、內文形式(條列/表格/段落)互換;字級、強調、列表符號仍只從 `topic.md`「文字規範」選用 — 使用者要的效果不在規範內時,先確認是「改規範」(回 `/topic-design`,全簡報生效)還是換一種規範內的作法
- **圖形**:SVG 圖的畫法、元素增減、換圖形類型(換類型要回寫設計文件);紀律與截圖加註規則見 `diagrams.md`。動到架構圖的幾何時用 `/svg-layout`(normalize → inspect → 改 → lint),不要憑目視猜座標
- **備註**:該頁提醒的增刪 — 維持提醒式,不寫成逐字稿
- **背景(分層)**:這頁背景太搶/太空/干擾判讀時,依 `layers.md` 三段處理 —— ①換強度或關掉(`bg-soft` / `bg-none` / `bg-strong`,只動這頁的 `_class`);②換成 topic.md 定義過的另一套(`bg-2` / `bg-3`);③這頁真的是一次性的特例才用 `<style scoped>` 覆寫。先確認使用者要的是「這頁例外」還是「整份都太濃」——後者是改 theme.css 的 `--bg-opacity`(見下條)。**要新增一套背景則是語意變動,回 `/topic-design`**
- **風格**:配色、字級、背景強度 — 色值、字體與背景 tokens 只住在 `theme.css`,改 tokens 是**全簡報**的改動;先問清楚是「只有這頁特例」(頁內以 class 或 scoped style 處理)還是「整份都要改」(改 tokens 並確認其他頁不被打壞)。**tokens 的數值調整不需要更新 `topic.md`**(那裡只記語意);只有色票的**語意**改變(如 accent 從「關鍵數字」改綁「風險」)才回寫「投影片風格」

拆頁/刪頁會改變後續全域頁碼(推導值,無需改檔名),但要同步 deck 檔 `slides`、docs section 的 `slides` 與「頁面規劃」表;先列出影響取得同意後執行。

### 2. 執行修改

1. 修改該 deck 檔的目標頁(版型類別、內容、備註),更新 frontmatter 的 `slides`(張數有變時)與 `updated`
2. 圖形調整:修改對應的 `talk/assets/diagram-*.svg`,更新其 metadata(`updated`;構想改變時連同 `description` 與 `diagram-type`);新增圖形取該段內最大序號 +1 命名,並回填 docs section 的 `diagrams`
3. 同步 docs section:「頁面規劃」表對應列改成調整後的構想,`updated` 更新;調整動到內容要點時一併回寫
4. 涉及**整份簡報的風格改動**時:調 `theme.css` tokens(經使用者同意),重 build 後檢查其他頁是否被波及,列出需要跟進的頁面問使用者是否本次一併調整;**改的是語意**(色票綁的意思、背景套數與用途、新的強調寫法)才一併更新 `topic.md` 對應章節,純數值調整不動它

### 3. 驗收

- `node build.mjs`(含 `outputs` 的其他格式)重新建置,在瀏覽器開 `talk/dist/slides.html` 跳到該頁(或請使用者開)確認:文字不溢出、grid 沒塌陷、圖形清晰、背景沒搶走第一眼且正文讀得清、與前後頁風格銜接自然
- 動到 theme.css 分層 tokens 時,額外抽看全簡報最文字密的一頁與各套背景各一頁
- 使用者不滿意就回到步驟 1 繼續調,直到確認為止

### 4. 收尾

摘要:改了哪一頁(section + 段內頁 + 全域頁碼)、調整了什麼面向(含背景類別的變動)、同步更新了哪些檔案(deck / SVG / 背景資產 / docs section / theme.css / topic.md)、是否留下待跟進的風格一致化清單。
