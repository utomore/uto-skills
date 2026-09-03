---
name: system-design
description: Level 1 系統主架構設計 — 深度訪談後產出 .design/system.md 與 ADR,定義系統邊界、對外 I/O 契約、子系統劃分與通訊拓撲;只到子系統邊界顆粒度,禁止過早具體化。觸發詞:系統設計、主架構、system design、架構設計、專案初始化、技術選型、開新專案。Use when starting a new project or designing the Level 1 system master architecture.
user-invocable: true
---

# /system-design — Level 1 系統主架構設計

## 先讀什麼(**一批送出,不要一個一個開**)

`<S>` = 本 plugin 的 `skills/` 目錄,**整場對話只解析一次**(規則見 `../_shared/conventions.md`「腳本目錄」):
`dirname "$(dirname "$(find ~/.claude/plugins . -maxdepth 9 -type d -path '*dev-flow*/skills/arch-audit/scripts' 2>/dev/null | head -1)")"`

拿到 `<S>` 後,把下面**必讀**與成立的**條件式**項目放進**同一則訊息**一次讀完(多個 Read / Bash 併發)。**禁止讀一個、想一下、再讀下一個**——這一段是純載入,拆成幾趟只是把幾次 prefill 疊起來。

**必讀**

| 讀什麼 | 為什麼 |
|---|---|
| `../_shared/conventions.md` | 核心慣例:**資訊抽象邊界規範**、腳本目錄、**跑東西的紀律** |
| `../_shared/boundary-rules.md` | **邊界判斷規則** + 設計階段規則 |
| `node "<S>/arch-audit/scripts/doc-section.mjs" ../_shared/doc-lifecycle.md 文檔角色與權威來源 資料夾結構 架構文檔 ADR 清單欄位格式 description` | 本 skill 要新建 `system.md` 與 ADR。**不要整份讀** |

**條件式**:**收尾時** → `../_shared/anchor.md`(定錨區塊格式)

## 目標

產出專案的燈塔文件 `.design/system.md` 與對應的 `.design/adr/ADR-00x-<slug>.md`,確立整體專案方向。**在需求與架構明確之前,禁止產出任何文件。**

本文件是三層階梯的 **Level 1**:聚焦系統邊界、跨系統通訊、全域契約與技術選型,寫到「子系統邊界」的顆粒度即可。**絕對禁止**在本文件定義任何內部私有函數、helper 名稱、私有變數或內部暫存資料結構——那些分別屬於 Level 2(`/subsys-design`)與 Level 3(實作自主權)。

## 模式判斷

- `.design/system.md` 不存在、舊版 `docs/arch/architecture.md` 也不存在 → **初始模式**:完整訪談後從零產出
- 只有舊版 `docs/arch/architecture.md`(或更舊的 `docs/architecture.md`)→ **遷移 + 更新模式**:徵得開發者同意後,把內容重組進 `.design/system.md`(依本檔章節結構改寫,frontmatter 補 `subsystems: []`;既有 `subarch-*` 提醒之後用 `/subsys-design` 逐一遷移為 `subsystems/<slug>/design.md`),再依更新模式進行
- `.design/system.md` 已存在 → **更新模式**:先讀取現有內容,針對要調整的部分訪談,更新文件並視情況新增 ADR

## 流程

### 1. 訪談階段(核心,不可跳過)

分多輪「瘋狂詢問」開發者,直到需求與架構完全明確。**不確定就再問,禁止自行腦補需求。** 選擇題用 AskUserQuestion,開放式問題直接問。必須涵蓋:

1. **需求釐清**:這個專案要解決什麼問題?核心功能有哪些?誰會使用?功能清單與優先順序?
2. **系統邊界**:系統的最外層邊界在哪?哪些屬於系統、哪些是外部依賴(第三方服務、既有系統)?
3. **對外 I/O 契約**:系統最外層接收什麼 Input、產出什麼 Output?用什麼形式描述(OpenAPI / Protobuf / CLI 介面 / 頂層 DTO Schema)?
4. **子系統劃分**:依單一職責切出哪些子系統(Bounded Contexts)?和開發者確認每個子系統的名稱(英文 kebab-case slug)、職責與邊界——**這裡只定邊界,內部細節之後由 `/subsys-design` 展開**。**要切的是「完成這個產品需要哪些子系統」,不是「這一版要先做哪些」**;先後順序屬「開發階段」,不影響名冊。第 3 步的需求清單裡每一項都要指得到歸屬
4b. **子系統內的領域**:哪些子系統裡面裝的是**多個平行領域**(彼此沒有天然先後、共用同一個部署 / 編譯單位),而不是一條資料流管線上的幾個模組?有的話先記下領域清單——`/subsys-design` 會把它們寫成該子系統的「模組群」表,讓還沒開工的領域也進得了分母
5. **通訊拓撲**:子系統之間怎麼通訊(REST / gRPC / Event Bus / Direct In-Memory Call)?全域錯誤處理策略是什麼?
6. **技術棧與環境**:語言、編譯器/運行環境版本、核心架構模式(Clean Architecture / EDA / Microservices…)——每個選擇都要問偏好並給出建議與理由(給建議時遵守 `boundary-rules.md`「每個『建議』的義務」:當下成本 + 三個月後的代價 + 是否觸碰 invariant)
7. **專案體量評估**:預期規模(原型/工具/長期產品)、資料量、使用者量、效能要求
8. **開發階段切分**:整個專案分幾個階段?每階段的里程碑?

每輪訪談後摘要目前已確認的內容,列出仍不明確的點繼續問。全部明確後,向開發者做最終確認再產出。

### 2. 產出 `.design/system.md`

內文繁體中文,固定章節:

```markdown
---
id: system
type: system
title: <project-slug>
description: <一句話,40 字內:這個專案在做什麼>
status: active
created: <today>
updated: <today>
subsystems: []          # 完整名冊:下面「子系統劃分」列到的每一個 slug,含還沒建 design.md 的
---

# <專案名稱> 系統主架構

## 需求說明

## 技術棧與環境
(程式語言、運行環境版本、核心架構模式;只列影響架構的關鍵依賴,
 基礎函式庫交給套件管理檔,不在此羅列)

## 系統對外介面(External I/O Contract)
(系統最外層的 Input / Output 規格:OpenAPI / Protobuf / CLI 介面 / 頂層 DTO Schema)

## 子系統劃分(Subsystems & Bounded Contexts)
(每個子系統一小節,標題的第一個 token 就是 slug;內容:單一職責、邊界(明確不做什麼)、
 對外契約摘要;已建 design.md 的註明路徑,未建的寫「design.md:未建」。
 **這裡列到的每一個 slug 都要出現在 frontmatter 的 `subsystems` 名冊裡**,包含這一版還不會動工的。
 未拆子系統的小專案此節寫「不拆分」與理由)

### <subsystem-slug>
- **design.md**:`subsystems/<slug>/design.md`(未建時寫「未建」)
- **職責**:<一句話。這一行的格式固定,盤點腳本會撈它當未建檔子系統的主軸>
- **邊界(不做)**:<明確不做什麼>
- **對外契約摘要**:<誰會用它、用什麼>

## 通訊拓撲與原則(Communication Topology)
(子系統之間的通訊方式與方向、全域錯誤處理策略)

## 架構圖
(ASCII 繪製:各子系統為節點、通訊為邊,標出對外 I/O 出入口;
 只畫到子系統顆粒度,不畫子系統內部)

## 開發階段
(**全專案唯一的產品級分母**,格式固定:下面這張表的欄位名與狀態詞彙都會被
 `/arch-audit status` 解析,不要改欄名、不要換說法)

| 階段 | 內容 | 涵蓋子系統 | 里程碑 | 狀態 |
|---|---|---|---|---|
| S0 <名稱> | <這一階段要做什麼> | <slug、slug> | <可觀察的驗收> | 未開始 |

- 「階段」欄的第一個 token 是階段 id,**固定用工具鏈保留的 `S0`、`S1`…**(S = Stage);之後在任何回報或文檔裡提到某一階,一律連名稱一起寫(`S1(帳務上線)`)——單獨一個 `S1` 開發者要回頭翻表才知道是哪一階。不要自創 `E0`、`P1`、`M1` 之類——`E` 是 enhancement 文檔與 example 的首碼,單字母都各有主人,完整註冊表見 `doc-lifecycle.md`「編號與縮寫註冊表」
- 「涵蓋子系統」欄只寫 slug,而且**必須是 `subsystems` 名冊裡有的**(名冊含未建檔者,所以未來階段的子系統照樣寫得出來)
- 「狀態」欄只有三個值:**未開始 / 進行中 / 已達成**。要補說明就寫在後面括號裡,關鍵詞放最前面
- 每階段的里程碑寫成「有人實際看得到的東西」,不是「測試全綠」
```

**產出前自我檢查**:

1. **資訊抽象邊界**:全文不得出現私有函數名、helper 名稱、私有變數命名、內部暫存資料結構;發現就刪掉或上移為邊界契約描述
2. **知識歸屬**:每個子系統小節說得出它是哪些事實的唯一真相來源;同一個事實有兩個子系統宣稱擁有 = 邊界沒切乾淨,回去重切
3. **不可逆決定**:對外 I/O 契約、通訊協定、儲存格式都屬不可逆,各要有一份 ADR 寫出被否決的替代方案與否決理由
4. **完成定義**:開發者能用兩句話向第三者說明「這個系統做什麼、為什麼這樣切」;做不到就是文件寫成了細節清單,回頭改
5. **需求覆蓋**:「需求說明」列的**每一個**核心功能 / 支柱,在「子系統劃分」都指得到一個擁有它的子系統;指不到 = 有一塊需求沒有人負責,補子系統或說明為什麼不做
6. **名冊完整**:frontmatter 的 `subsystems` 與「子系統劃分」的小節、「開發階段」的涵蓋子系統欄,**三邊 slug 完全一致**。名冊只列已建檔的子系統是這個流程最嚴重的失真來源——未列入的東西不在任何分母裡,報表會宣稱一個只做了一半的專案「全部完成」
7. **階段可讀**:「開發階段」表存在,階段 id 是 `S<n>`,狀態欄用的是三個標準詞。少了這張表,`/arch-audit status` 答不出「這一階段還差什麼」,只答得出「已經寫好的文檔都寫完了」
8. **縮寫不撞號**:全文自訂的縮寫與代號(層的名字、里程碑代號、模組代號…)逐一對 `doc-lifecycle.md`「編號與縮寫註冊表」查一遍,**不得與表內任何首碼同形**。專案的縮寫會被之後每一份文檔沿用,撞了號(如拿 `E0` 當階段、`L1` 當層)之後每一次對話都要靠上下文猜它指誰——這種混淆不會報錯,只會讓盤點與審查悄悄對錯東西

### 3. 產出 ADR

每個**重大技術選擇**(語言/框架、核心架構模式、通訊協定、儲存方案)各產出一份 `.design/adr/ADR-00x-<slug>.md`,編號三位數遞增(掃描 `.design/adr/` 取最大 +1),標準 ADR 格式:

```markdown
---
id: ADR-001
type: adr
title: <decision-slug>
description: <一句話,40 字內:這份 ADR 決定了什麼>
status: accepted        # proposed | accepted | superseded
created: <today>
updated: <today>
---

# ADR-001: <決策標題>

## 狀態(Status)
## 背景(Context)
## 決策(Decision)
## 考慮過的替代方案(Alternatives Considered)
## 影響(Consequences)
```

### 4. 收尾

- 向開發者摘要:產出了哪些檔案、架構重點、子系統劃分結論、通訊拓撲、各階段規劃
- 說明 `.design/system.md` 是專案燈塔,之後 `/subsys-design`、`/spec-design` 都以它為依據;`.design/adr/` 有新決策會持續擴充
- 最後輸出**定錨區塊**(`../_shared/anchor.md`):位置樹畫 `system.md` 加「子系統劃分」的每個子系統一行(已建 / 未建);下一步通常是對下一個未建的子系統跑 `/subsys-design`(建檔後 `subsystems` 會回填)
