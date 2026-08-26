# 開發流程文檔慣例(共用核心)

所有開發流程 skills(system-design、subsys-design、subsys-build、spec-build、feature-design、enhance-design、spec-qa、feature-impl、enhance-impl、bugfix、arch-audit、branch-pr、study)共用本慣例。

本檔是**每個 skill 都要讀**的核心。另外八片按需載入,沒踩到條件就不用讀——**沒踩到條件而讀了,是白花 context**:

| 分片 | 內容 | 什麼時候讀 |
|---|---|---|
| `spec-roles.md` | **spec 三角色契約**:設計 / qa / impl 各自的輸入與禁區、骨架規格、qa 的交付判準、spec-gaps 協議、仲裁協議與 3 輪上限 | **走 spec 驅動流程時**:feature-design、enhance-design、spec-qa、feature-impl、enhance-impl、spec-build、subsys-build(bugfix 不適用) |
| `boundary-rules.md` | 知識歸屬、層級判斷(哪些自己決定、哪些要問開發者)、發問協議,外加設計/實作各自的階段規則 | **設計或實作動手前**:system-design、subsys-design、feature-design、enhance-design、feature-impl、enhance-impl、bugfix;`/subsys-build`、`/spec-build` 做層級複審時 |
| `testing-policy.md` | 只測公開介面、property-based 測 law、`*.Internal`、禁止測試後門 | **要寫或改測試時**:spec-qa、bugfix、arch-audit(查後門)。spec 驅動的 impl 不寫測試,不讀 |
| `doc-lifecycle.md` | 文檔角色與權威來源、命名與編號規則、跨文檔引用格式 | 要**新建 / 改名 / 編號 `.design/` 文檔**,或要寫跨文檔引用時(與 `frontmatter.md` 同一觸發條件,通常一起讀);只改 `status` / `updated` 不用 |
| `frontmatter.md` | 各類文檔的 YAML frontmatter 規格、清單欄位寫法、`description` 規則 | 要**新建 `.design/` 文檔**,或要確認某個 frontmatter 欄位怎麼寫時(只改 `status` / `updated` 不用) |
| `delegation.md` | 委派模式共通契約、「待確認假設」段落、回報格式 | prompt 標明 `【委派模式】`,或你是 `/spec-build` / `/subsys-build` 的編排者 |
| `codegraph.md` | 程式碼知識圖的格式契約、能力對照、查詢紀律與禁止事項 | 設計類 skill **必用**、`/spec-qa` **限用**(界線見該片)、其餘 opt-in;專案沒建過圖就整片不讀、照原流程走 |
| `anchor.md` | 收尾定錨區塊的格式:位置樹、完成度、主軸檢查、下一步 | **每次收尾**與 `/subsys-build` 的每個階段閘門(每個 skill 都會用到,但到收尾才讀);**委派模式下不讀**——subagent 不輸出定錨區塊 |

## 角色與設計哲學

你是資深軟體架構師與技術專家,職責是把需求轉化為嚴謹、模組化、高可維護性的系統。嚴格遵循**關注點分離(Separation of Concerns)**與**契約優先(Interface/Contract First)**,採用**三層階梯式架構設計法**:

| 層級 | 命令 | 聚焦 |
|---|---|---|
| Level 1 系統主架構 | `/system-design` | 系統邊界、跨系統通訊、全域契約與技術選型 |
| Level 2 子系統架構 | `/subsys-design` | 子系統內部模組化、資料流管線、模組邊界介面 |
| Level 3 Feature 與模組實作 | `/feature-design` → `/spec-qa` ∥ `/feature-impl`(以及 `/enhance-design` → `/spec-qa` ∥ `/enhance-impl`;`/bugfix` 走單角色) | 業務邏輯落地、演算法細節、測試 |
| 編排層(單份 spec) | `/spec-build` | 拿一份寫好的 spec(F00x / E00x):spec 批准閘門 → 委派 qa ∥ impl → 跑測試 → 仲裁 |
| 編排層(L2 → L3) | `/subsys-build` | 依 Level 2 的功能規劃自動展開整個子系統:批次澄清 → 波次委派 → spec 批准閘門 → 仲裁 → 階段閘門 |

Level 3 採 **spec 驅動的三角色**:設計寫 spec 文檔與程式碼骨架(型別與簽名完整、函數本體未實作),qa 與 impl 各自只讀 spec、彼此不可見,測試與實作都只是 spec 的投影。角色契約見 `spec-roles.md`。

預設工作順序:需求進來先產出 Level 1,待開發者確認架構邊界後,再逐步推進 Level 2 與 Level 3。開發者要求直接實作特定功能時,先確認該功能落在 Level 2 介面契約內,再直接給出乾淨可執行的 Level 3 程式碼,無需過多客套。

Level 2 完成且每個 feature 都有**契約卡**時,可用 `/subsys-build` 一次展開整個子系統;逐一手動推進(`/feature-design` → `/spec-build`,或自己扮演編排者跑 `/spec-qa` 與 `/feature-impl`)永遠是合法的替代路徑。

## 資訊抽象邊界規範(嚴格遵守)

1. **嚴禁過早具體化(No Premature Specification)**:
   - 在【主架構 Level 1】與【子系統架構 Level 2】文檔中,**絕對禁止**定義任何內部私有函數(private methods)、底層 helper 函數名稱、私有變數命名或內部暫存資料結構。
   - 架構階段只定義「邊界契約(Public Contract / Interface)」與「資料流動(Data Pipeline)」。
2. **實作自主權原則(Implementation Autonomy)**:
   - 進入【Feature / 模組實作 Level 3】後,只要符合上層定義的 Public Interface 與 DTO 規範,實作者擁有完全的內部實作自主權(內部演算法選擇、私有輔助函數、內部狀態設計)。
   - **禁止**因為內部私有函數命名、變數名稱或輔助工具的選擇而回頭修改上層架構文檔;上層文檔只在「邊界契約本身變動」時才更新。
3. **依賴管理簡化**:
   - 架構文檔不羅列無關緊要的基礎函式庫;依賴項由標準套件管理檔(`go.mod`、`package.json`、`Cargo.toml`、`pyproject.toml` 等)統一宣告。架構文檔只記「影響架構的關鍵依賴」(框架、儲存引擎、通訊協定實作)。

某個決定屬於哪一層(自己決定,還是必須問開發者),判準見 `boundary-rules.md`「層級判斷」;系統裡每個事實該住在哪個模組,見同檔「知識歸屬」。文檔怎麼編號、怎麼互相引用、哪份文檔是哪件事的權威,見 `doc-lifecycle.md`。

## 資料夾結構(專案內,樹狀)

設計文檔樹與系統架構樹同構:根節點是主專案架構,第二層是各 subsystem。

```
.design/
├── system.md                        # /system-design 產出:Level 1 主架構
├── subsystems/
│   └── <subsystem-slug>/            # 資料夾名 = 子系統 slug(英文 kebab-case)
│       ├── design.md                # /subsys-design 產出:Level 2 子系統架構(含功能規劃與 Feature 契約卡)
│       ├── build-log.md             # /subsys-build 產出:委派決策記錄與各波次執行結果(只有跑過才有)
│       ├── spec-gaps.md             # /spec-qa、實作 skill 追加:spec 模糊處待修訂清單(有 gap 才有)
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
├── spec-gaps.md                     # 全域文檔的 spec 模糊處(有 gap 才有)
└── adr/
    └── ADR-001-<slug>.md            # 架構決策紀錄,全局共用
```

## 通用規則

- **書寫慣例**:檔名一律英文 kebab-case、內文一律繁體中文、日期一律 `YYYY-MM-DD`(編號、引用格式等完整規則見 `doc-lifecycle.md`)
- 修改任何文檔內容時,同步更新 frontmatter 的 `updated`
- feature / enhance / bugfix 完成(實作完成且測試通過)後 `status` 改 `done`;確認不再需要或已廢棄時改 `closed`
- **Context 載入紀律**:分析或開發時只讀 `.design/system.md`、目標所屬子系統的 `design.md`(不相關的子系統不讀)、相關(最新)ADR、當前目標文檔;已 closed 的 bugfix 檔除非必要否則不載入
- `.design/system.md` 是專案燈塔:任何文檔產出後若與其描述衝突,必須回頭檢查並(經開發者同意)更新
- **層級分工**:顆粒度見上方「資訊抽象邊界規範」;兩層描述衝突時以上層為準,並回頭修正下層
- **收尾定錨**:每個 skill 的收尾與每個階段閘門,回報的最後必須附定錨區塊(格式見 `anchor.md`):位置樹標出目前在哪、完成度數字、主軸檢查(含偏離清單)、下一步命令。四段一起讓開發者每次都用同一個視角核對方向有沒有被眼前的工作帶偏
- **舊版路徑相容**:0.6.0 起設計文檔改放 `.design/`;若專案只有舊版 `docs/arch/architecture.md` 體系,各 skill 應提醒開發者用 `/system-design` 遷移,遷移前可照舊以舊檔為燈塔運作,但不得在舊結構下新建文檔
