# 文檔生命週期(建檔、編號、引用、權威來源)

`_shared/conventions.md` 的分片。**要新建 / 改名 / 編號任何 `.design/` 文檔,或要寫跨文檔引用(`depends-on`、`related-*`、內文提到別份文檔)時讀這份**;只改既有文檔的 `status` / `updated` 不用讀。與 `frontmatter.md` 是同一個觸發條件,兩片通常一起讀。

委派模式下 subagent 的編號與檔名**由編排者指定**(`delegation.md` 第 3 條),但引用格式仍然要照本片寫。

## 文檔角色與權威來源

- `build-log.md` 不是任務文檔,不參與 F/E/B 編號,也不列入進度統計;它記的是**編排過程**(配號表、批次澄清的決策、各波次結果、待確認假設與自裁清單、閘門結論)
- `/arch-audit status` 不掃這個檔;它的價值在於「中斷後能接續」與「事後查得到當初為什麼這樣決定」
- `spec-gaps.md` 也不是任務文檔、不參與編號。它是 **qa 與 impl 對 spec 提出的問題清單**(協議見 `spec-roles.md`):有 `open` 的條目,就代表有項目正卡著等 spec 修訂——`/arch-audit status` 會把未結的條目列出來,`/subsys-build` 開跑前會擋。它是**共用檔案**:委派模式下只由編排者單線寫入與配號,subagent 一律只回報(併發各自寫會互相覆蓋)
- `system.md` 的 `subsystems` 是子系統的**唯一權威清單**:`/subsys-design` 建檔或廢棄子系統時必須同步回填;`/arch-audit status` 會雙向比對清單與實際資料夾
- 每份 `design.md` 都必須有 `parent: system`,讓任何讀者能從子系統回溯主架構
- 每份 `design.md` 的「功能規劃」表格是該子系統的 feature 路線圖;`doc` 欄要在 `/feature-design` 建檔後**即時回填**(委派模式下由 `/subsys-build` 統一回填),沒回填的項目會被列為「待展開的 feature」、子系統進度也會偏低
- 每份 `design.md` 的「Feature 契約卡」章節,功能規劃裡的每個 feature 都要有一張(`###` 一張卡,標題 = feature slug)。契約卡是「這個 feature 可以被無訪談委派」的門檻:寫得夠完整才跑得動 `/subsys-build`,缺卡的項目會被 `/arch-audit status` 列進提示

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

**舊版路徑相容**:0.6.0 起設計文檔才改放 `.design/`;專案只有舊版 `docs/arch/architecture.md` 體系時,提醒開發者用 `/system-design` 遷移,遷移前可照舊以舊檔為燈塔運作,但**不得在舊結構下新建文檔**。

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
