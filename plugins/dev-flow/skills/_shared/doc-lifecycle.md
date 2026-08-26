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
