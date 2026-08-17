---
name: topic-design
description: 演講主軸設計 — 深度訪談時長、聽眾、會議類型後,提供 3 組主題方案供選擇,產出 docs/topic.md 燈塔文件、資料夾結構與各 section 佔位文檔。觸發詞:演講主軸、演講設計、topic design、新演講、簡報企劃、talk planning。Use when starting a new talk or presentation and defining its core topic and structure.
user-invocable: true
---

# /topic-design — 演講主軸設計

先讀取 `../_shared/conventions.md`,遵守其中所有文檔慣例(資料夾結構、命名、metadata)。

## 目標

與使用者討論出演講的**真正主軸**,產出燈塔文件 `docs/topic.md`、資料夾結構(`docs/`、`talk/assets/`)與各段落佔位文檔。**在主軸與段落切分明確之前,禁止產出任何文件。**

## 模式判斷

- `docs/topic.md` 不存在 → **初始模式**:完整訪談後從零產出
- `docs/topic.md` 已存在 → **更新模式**:先讀取現有內容與各 section 狀態,針對要調整的部分訪談;主軸變動會牽動所有 section,必須列出受影響段落並取得使用者同意後才動手

## 流程

### 1. 訪談階段(核心,不可跳過)

分多輪詢問使用者,直到主軸完全明確。**不確定就再問,禁止自行腦補。** 選擇題用 AskUserQuestion,開放式問題直接問。必須涵蓋:

1. **時長**:整場演講幾分鐘?含不含 Q&A?
2. **領域與題材**:講什麼領域?使用者手上有什麼素材(專案經驗、研究、工具)?
3. **聽眾範圍**:誰會來聽?人數規模?聽眾的技術能力(beginner / intermediate / advanced / mixed)與先備知識?
4. **會議類型**:deep-tech(深度技術分享)、intro(啟蒙/科普)、workshop(工作坊)、lightning(閃電秀)、keynote(主題演講)、internal(內部分享)、lecture(教學課程)— 類型決定深度與節奏
5. **講者先備知識**:使用者對題材的熟悉度、想避開或想突顯的部分
6. **風格偏好**:投影片視覺風格(深色/淺色、極簡/資訊密集、手繪/幾何)、演講風格(敘事型、示範型、論證型)
7. **Demo 需求**:是否需要現場示範?(需要時建議 uv + python + notebook,依使用者要求可置換;demo 屬於某個 section,細節留給 `/section-discuss`)

每輪訪談後摘要目前已確認的內容,列出仍不明確的點繼續問。

### 2. 提出 3 組主題方案(必做)

依訪談結果提出 **3 組可選方案**,每組含:**主題、副標題、大綱(3–6 條)**,並各附一句「為什麼適合這批聽眾」。用 AskUserQuestion 讓使用者選擇或混搭;使用者也可要求重出。選定後與使用者確認最終的主題與副標題措辭。

### 3. 段落切分方案

依選定主軸與時長提出 section 切分(含每段預估分鐘數),與使用者逐段確認名稱、目的與順序:

- 時間帳:各段 `est-minutes` 總和 ≈ 總時長,留 5–10% 緩衝
- 段落數參考:lightning(5–10 分)2–3 段;30–40 分 4–6 段;60 分以上 6–8 段
- 段落 ≠ 投影片張數:一段可以 0 頁(純口述)到多頁
- 需要 demo 時,demo 自成一段或明確掛在某段之下

### 4. 產出

全部明確並經使用者最終確認後:

1. 建立資料夾:`docs/`、`talk/assets/`(`demo/` 只在確定需要時建立)
2. 產出 `docs/topic.md`,frontmatter 依 conventions,內文固定章節:

```markdown
# <演講題目> 主軸設計

## 主軸說明
(選定的主題、副標題、一段話的核心訊息 — 聽眾走出場要記得的一件事)

## 候選方案記錄
(訪談時提出的 3 組方案與選擇理由,留檔備查)

## 聽眾輪廓
(範圍、規模、技術能力、先備知識;聽眾「已知/未知」清單)

## 講者先備知識
(講者熟悉度、需要事前補強的部分)

## 大綱與段落規劃
(選定大綱;每段一列:id、名稱、目的、預估分鐘、預估頁數範圍)
| Section | 名稱 | 目的 | 分鐘 | 頁數(預估) |
|---|---|---|---|---|

## 投影片風格
(視覺風格、配色方向、版面原則 — 之後所有 SVG 遵守此節)

## 演講風格
(敘事/示範/論證、語氣、互動方式)

## Demo 規劃
(不需要則寫「無」;需要則寫目的、形式(預設 uv + python + notebook)與掛在哪個段落)
```

3. 為每個段落產出佔位文檔 `docs/section-<編號:01>-<slug>.md`:**只放 frontmatter(status: open)與一段「段落說明」**(目的與預計內容方向,2–3 句),其餘留給 `/section-discuss`
4. `topic.md` 的 `sections` 回填全部段落 id,一律行內陣列 `sections: [section-01, section-02]`(清單欄位不用 YAML 區塊列表)

### 5. 收尾

- 摘要:產出了哪些檔案、選定的主軸、段落切分與時間分配
- 說明 `docs/topic.md` 是演講燈塔,之後 `/section-discuss` 逐段深談、`/section-impl` 實作講稿與 SVG、`/page-adjust` 微調單頁
- 建議使用者從 `order: 1` 的段落開始執行 `/section-discuss`
