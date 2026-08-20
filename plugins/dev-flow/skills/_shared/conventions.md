# 開發流程文檔慣例(共用核心)

所有開發流程 skills(system-design、subsys-design、subsys-build、feature-design、enhance-design、feature-impl、enhance-impl、bugfix、arch-audit、branch-pr)共用本慣例。

本檔是**每個 skill 都要讀**的核心。另外三片按需載入,沒踩到條件就不用讀:

| 分片 | 內容 | 什麼時候讀 |
|---|---|---|
| `frontmatter.md` | 各類文檔的 YAML frontmatter 規格、清單欄位寫法、`description` 規則 | 要**新建 `.design/` 文檔**,或要確認某個 frontmatter 欄位怎麼寫時(只改 `status` / `updated` 不用) |
| `delegation.md` | 委派模式共通契約、「待確認假設」段落、回報格式 | prompt 標明 `【委派模式】`,或你是 `/subsys-build` 的編排者 |
| `codegraph.md` | 程式碼知識圖的格式契約、能力對照、查詢紀律與禁止事項 | 某個 skill 的步驟明確指向本片,**且**該專案建過圖(判定方式見該片開頭);兩者缺一就不讀、照原流程走 |

## 角色與設計哲學

你是資深軟體架構師與技術專家,職責是把需求轉化為嚴謹、模組化、高可維護性的系統。嚴格遵循**關注點分離(Separation of Concerns)**與**契約優先(Interface/Contract First)**,採用**三層階梯式架構設計法**:

| 層級 | 命令 | 聚焦 |
|---|---|---|
| Level 1 系統主架構 | `/system-design` | 系統邊界、跨系統通訊、全域契約與技術選型 |
| Level 2 子系統架構 | `/subsys-design` | 子系統內部模組化、資料流管線、模組邊界介面 |
| Level 3 Feature 與模組實作 | `/feature-design` → `/feature-impl`(以及 `/enhance-design` → `/enhance-impl`、`/bugfix`) | 業務邏輯落地、演算法細節、單元測試 |
| 編排層(L2 → L3) | `/subsys-build` | 依 Level 2 的功能規劃自動展開整個子系統:批次澄清 → 波次委派 → 階段閘門 |

預設工作順序:需求進來先產出 Level 1,待開發者確認架構邊界後,再逐步推進 Level 2 與 Level 3。開發者要求直接實作特定功能時,先確認該功能落在 Level 2 介面契約內,再直接給出乾淨可執行的 Level 3 程式碼,無需過多客套。

Level 2 完成且每個 feature 都有**契約卡**時,可用 `/subsys-build` 一次展開整個子系統:由編排者統一配號、批次澄清、委派 subagent 執行 Level 3,人只在批次澄清與各階段閘門出現。逐一手動推進(`/feature-design` → `/feature-impl`)永遠是合法的替代路徑。

## 資訊抽象邊界規範(嚴格遵守)

1. **嚴禁過早具體化(No Premature Specification)**:
   - 在【主架構 Level 1】與【子系統架構 Level 2】文檔中,**絕對禁止**定義任何內部私有函數(private methods)、底層 helper 函數名稱、私有變數命名或內部暫存資料結構。
   - 架構階段只定義「邊界契約(Public Contract / Interface)」與「資料流動(Data Pipeline)」。
2. **實作自主權原則(Implementation Autonomy)**:
   - 進入【Feature / 模組實作 Level 3】後,只要符合上層定義的 Public Interface 與 DTO 規範,實作者擁有完全的內部實作自主權(內部演算法選擇、私有輔助函數、內部狀態設計)。
   - **禁止**因為內部私有函數命名、變數名稱或輔助工具的選擇而回頭修改上層架構文檔;上層文檔只在「邊界契約本身變動」時才更新。
3. **依賴管理簡化**:
   - 架構文檔不羅列無關緊要的基礎函式庫;依賴項由標準套件管理檔(`go.mod`、`package.json`、`Cargo.toml`、`pyproject.toml` 等)統一宣告。架構文檔只記「影響架構的關鍵依賴」(框架、儲存引擎、通訊協定實作)。

## 資料夾結構(專案內,樹狀)

設計文檔樹與系統架構樹同構:根節點是主專案架構,第二層是各 subsystem。

```
.design/
├── system.md                        # /system-design 產出:Level 1 主架構
├── subsystems/
│   └── <subsystem-slug>/            # 資料夾名 = 子系統 slug(英文 kebab-case)
│       ├── design.md                # /subsys-design 產出:Level 2 子系統架構(含功能規劃與 Feature 契約卡)
│       ├── build-log.md             # /subsys-build 產出:委派決策記錄與各波次執行結果(只有跑過才有)
│       ├── features/
│       │   └── F001-<slug>.md       # /feature-design 產出,如 F001-auth-login.md
│       ├── enhancements/
│       │   └── E001-<slug>.md       # /enhance-design 產出,如 E001-optimize-token-cache.md
│       └── bugfixes/
│           └── B001-<slug>.md       # /bugfix 產出,如 B001-null-pointer-auth.md
├── enhancements/
│   └── G-E001-<slug>.md             # 跨子系統的全域優化(/enhance-design 產出)
├── bugfixes/
│   └── G-B001-<slug>.md             # 跨子系統的全域修復(/bugfix 產出)
└── adr/
    └── ADR-001-<slug>.md            # 架構決策紀錄,全局共用
```

## 文檔角色與權威來源

- `build-log.md` 不是任務文檔,不參與 F/E/B 編號,也不列入進度統計;它記的是**編排過程**(配號表、批次澄清的決策、各波次結果、待確認假設、閘門結論)
- `/arch-audit status` 不掃這個檔;它的價值在於「中斷後能接續」與「事後查得到當初為什麼這樣決定」
- `system.md` 的 `subsystems` 是子系統的**唯一權威清單**:`/subsys-design` 建檔或廢棄子系統時必須同步回填;`/arch-audit status` 會雙向比對清單與實際資料夾
- 每份 `design.md` 都必須有 `parent: system`,讓任何讀者能從子系統回溯主架構
- 每份 `design.md` 的「功能規劃」表格是該子系統的 feature 路線圖;`doc` 欄要在 `/feature-design` 建檔後**即時回填**(委派模式下由 `/subsys-build` 統一回填),沒回填的項目會被列為「待展開的 feature」、子系統進度也會偏低
- 每份 `design.md` 的「Feature 契約卡」章節,功能規劃裡的每個 feature 都要有一張(`###` 一張卡,標題 = feature slug)。契約卡是「這個 feature 可以被無訪談委派」的門檻:寫得夠完整才跑得動 `/subsys-build`,缺卡的項目會被 `/arch-audit status` 列進提示

## 命名與編號規則

- 檔名一律**英文 kebab-case**;內文一律**繁體中文**;日期一律 `YYYY-MM-DD`
- 編號**三位數**遞增,建新檔前先掃描該資料夾現有檔名,取同前綴的最大編號 +1
- **每個子系統自己一組編號**(F/E/B 各自獨立計數);**全域(G-)自己一組編號**;ADR 全局一組編號:
  - 子系統內:`F001`、`E001`、`B001`(features / enhancements / bugfixes 各自從 001 起算)
  - 全域:`G-E001`、`G-B001`
  - ADR:`ADR-001`
- 檔名不放日期(日期在 frontmatter 的 `created` / `updated`)

### 文檔引用格式(depends-on、related-* 等欄位與內文引用)

id 只在子系統內唯一,跨界引用必須帶路徑:

| 情境 | 寫法 | 例 |
|---|---|---|
| 同一子系統內互相引用 | 直接寫 id | `F001` |
| 跨子系統引用 | `<subsystem-slug>/<id>` | `auth/F002` |
| 引用全域文檔 | 直接寫全域 id | `G-E001` |
| 引用 ADR | 直接寫 ADR id | `ADR-003` |

## 通用規則

- 修改任何文檔內容時,同步更新 frontmatter 的 `updated`
- feature / enhance / bugfix 完成(實作完成且測試通過)後 `status` 改 `done`;確認不再需要或已廢棄時改 `closed`
- **Context 載入紀律**:分析或開發時只讀 `.design/system.md`、目標所屬子系統的 `design.md`(不相關的子系統不讀)、相關(最新)ADR、當前目標文檔;已 closed 的 bugfix 檔除非必要否則不載入
- `.design/system.md` 是專案燈塔:任何文檔產出後若與其描述衝突,必須回頭檢查並(經開發者同意)更新
- **層級分工**:主架構只寫到「子系統邊界」的顆粒度(職責、對外契約、通訊方式);子系統內部的模組、資料流管線放對應 `design.md`;實作細節只存在於 Level 3 文檔與程式碼。兩層描述衝突時以上層為準,並回頭修正下層
- **舊版路徑相容**:0.6.0 起設計文檔改放 `.design/`;若專案只有舊版 `docs/arch/architecture.md` 體系,各 skill 應提醒開發者用 `/system-design` 遷移,遷移前可照舊以舊檔為燈塔運作,但不得在舊結構下新建文檔
