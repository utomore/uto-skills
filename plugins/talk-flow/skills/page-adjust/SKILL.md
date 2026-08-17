---
name: page-adjust
description: 投影片單頁調整 — 針對指定頁碼的 SVG 深談風格、描述、圖畫或 Layout 調整,修改 SVG 並同步 section 文檔、講稿與 slide.html。觸發詞:頁面調整、page adjust、改投影片、調整某頁、修改 SVG、換版面。Use when adjusting a single slide page (SVG) and syncing its related docs.
user-invocable: true
---

# /page-adjust — 投影片單頁調整

先讀取 `../_shared/conventions.md`,遵守其中所有文檔慣例(metadata、頁碼同步、投影片規格)。

## 前置

1. 確認目標頁:使用者給頁碼則找 `talk/assets/svg-<頁碼>-*.svg`;給的是內容描述則列出候選頁面讓使用者確認。找不到檔案時列出現有頁碼清單請使用者指認
2. 讀取目標 SVG 與其 metadata,依 `section` 欄位讀取所屬 section 文檔;讀取 `docs/topic.md` 的「投影片風格」章節與 `talk/scripts.md` 中該頁前後的講稿
3. 可行時先在瀏覽器打開該 SVG(或 slide.html 跳到該頁)看現況,再開始討論

## 流程

### 1. 討論調整內容(不可跳過)

與使用者確認要調整的面向與期望結果,**不確定就問,禁止腦補**:

- **風格**:配色、字體、視覺語彙 — 注意:偏離 `topic.md` 投影片風格的改動要先問清楚是「只有這頁特例」還是「整份簡報都要改」
- **描述**:文字內容、標題、措辭 — 是否連動講稿的說法
- **圖畫**:圖解、示意圖的畫法與元素增減
- **Layout**:版面配置、資訊層級、留白 — 一頁一重點,資訊超載時建議拆頁

拆頁/刪頁會動到全域頁碼:先列出受影響的頁面與需同步的五處(SVG 檔名、SVG metadata、section `pages`、scripts.md 頁碼標記、slide.html),取得使用者同意後才執行。

### 2. 執行修改

1. 修改目標 SVG(維持 `viewBox="0 0 1280 720"`、文字最小 24px),更新其 metadata 的 `updated`(內容方向改變時連同 `description`)
2. 同步 section 文檔:「頁面規劃」表對應列改成調整後的畫面構想,`updated` 更新;調整動到內容要點時一併回寫
3. 講稿連動:該頁的說法、翻頁時機有變時,同步 `talk/scripts.md` 對應段落
4. slide.html:頁面增刪或改檔名時更新頁面清單與 metadata 的 `pages`;僅改頁內內容則不動
5. 涉及**整份簡報的風格改動**時:先更新 `topic.md` 的「投影片風格」章節(經使用者同意),再列出其他受影響頁面,問使用者是否本次一併調整或之後逐頁處理

### 3. 驗收

- 在瀏覽器打開 slide.html 跳到該頁(或請使用者開)確認渲染:文字不溢出、對比足夠、與前後頁風格銜接自然
- 使用者不滿意就回到步驟 1 繼續調,直到確認為止

### 4. 收尾

摘要:改了哪一頁、調整了什麼面向、同步更新了哪些檔案(section / scripts / slide.html / topic.md)、是否留下待逐頁處理的風格一致化清單。
