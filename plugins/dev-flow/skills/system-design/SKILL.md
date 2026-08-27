---
name: system-design
description: Level 1 系統主架構設計 — 深度訪談後產出 .design/system.md 與 ADR,定義系統邊界、對外 I/O 契約、子系統劃分與通訊拓撲;只到子系統邊界顆粒度,禁止過早具體化。觸發詞:系統設計、主架構、system design、架構設計、專案初始化、技術選型、開新專案。Use when starting a new project or designing the Level 1 system master architecture.
user-invocable: true
---

# /system-design — Level 1 系統主架構設計

先讀取 `../_shared/conventions.md`(核心慣例:**資訊抽象邊界規範**)與 `../_shared/boundary-rules.md`(**邊界判斷規則** + 設計階段規則);本 skill 要新建 `system.md` 與 ADR,另讀 `../_shared/doc-lifecycle.md`(資料夾樹、編號、引用格式、權威來源)與 `../_shared/frontmatter.md`;收尾時另讀 `../_shared/anchor.md`(定錨區塊格式)。

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
4. **子系統劃分**:依單一職責切出哪些子系統(Bounded Contexts)?和開發者確認每個子系統的名稱(英文 kebab-case slug)、職責與邊界——**這裡只定邊界,內部細節之後由 `/subsys-design` 展開**
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
subsystems: []          # 子系統 slug 權威清單,由 /subsys-design 建檔時回填
---

# <專案名稱> 系統主架構

## 需求說明

## 技術棧與環境
(程式語言、運行環境版本、核心架構模式;只列影響架構的關鍵依賴,
 基礎函式庫交給套件管理檔,不在此羅列)

## 系統對外介面(External I/O Contract)
(系統最外層的 Input / Output 規格:OpenAPI / Protobuf / CLI 介面 / 頂層 DTO Schema)

## 子系統劃分(Subsystems & Bounded Contexts)
(每個子系統一小節:slug、單一職責、邊界(明確不做什麼)、對外契約摘要;
 已建 design.md 的註明路徑。未拆子系統的小專案此節寫「不拆分」與理由)

## 通訊拓撲與原則(Communication Topology)
(子系統之間的通訊方式與方向、全域錯誤處理策略)

## 架構圖
(ASCII 繪製:各子系統為節點、通訊為邊,標出對外 I/O 出入口;
 只畫到子系統顆粒度,不畫子系統內部)

## 開發階段
(分幾個階段、各階段里程碑與涵蓋的子系統)
```

**產出前自我檢查**:

1. **資訊抽象邊界**:全文不得出現私有函數名、helper 名稱、私有變數命名、內部暫存資料結構;發現就刪掉或上移為邊界契約描述
2. **知識歸屬**:每個子系統小節說得出它是哪些事實的唯一真相來源;同一個事實有兩個子系統宣稱擁有 = 邊界沒切乾淨,回去重切
3. **不可逆決定**:對外 I/O 契約、通訊協定、儲存格式都屬不可逆,各要有一份 ADR 寫出被否決的替代方案與否決理由
4. **完成定義**:開發者能用兩句話向第三者說明「這個系統做什麼、為什麼這樣切」;做不到就是文件寫成了細節清單,回頭改

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
- 說明 `.design/system.md` 是專案燈塔,之後 `/subsys-design`、`/feature-design`、`/enhance-design` 都以它為依據;`.design/adr/` 有新決策會持續擴充
- 最後輸出**定錨區塊**(`../_shared/anchor.md`):位置樹畫 `system.md` 加「子系統劃分」的每個子系統一行(已建 / 未建);下一步通常是對下一個未建的子系統跑 `/subsys-design`(建檔後 `subsystems` 會回填)
