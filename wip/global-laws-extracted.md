# 全域 Law 是抽上去的，不是立案時憑空定的

2026-09-20 使用者拍板，dev-flow 與 lawful 一起做，分支 `feat/global-laws-extracted`。這份是紀錄，不是規章。

## 為什麼
Scope Law 已經是「先做出一片，再對著它談約束」。全域 Law 三類同樣有真正的程式碼約束——領域不變量的三行要引用最內層的型別、對外 I/O 表的每一格要對到模組與型別與 step 與 law、層表被 `lint boundary` 拿去查每個檔的 import——還沒有程式碼時只能猜，status 還得長期掛著「還沒有三行式，成立與否未知（此時是正常的）」。使用者的決定：領域不變量一定用抽的（它有真正的程式碼約束）；另外兩類也用抽的。

## 順序
`kickoff` → `require-design` → `spike-impl`（第一片）→ `scope-laws` →（有全域的候選）`global-laws` → `build`。
`kickoff` 沒有「定義全域 Law 三區」那一站；`require-design` 收尾不再接 `global-laws`，直接推下一步（第一條里程碑的切片）。模板的「全域 Law」三區一開始寫「無」（lawful 的四層照舊由 `kickoff` 建好：四層是 plugin 固定的，不是專案的決定）。

統一的樣子：先做出一片 → `scope-laws` 對著它談（四項：資料交互、資料儲存在哪、外部串接方法、軟體架構）→ 約束定下來 → build 讓程式碼滿足它。

| 類別 | 誰談出來 | 誰落筆 |
|---|---|---|
| 領域不變量 | `scope-laws` 談完這一片的 law 之後多問一輪「這幾條裡哪幾條整個專案都該守」，照 `laws.md`「全域 Law」的准入判準（只講最內層的型別、任何一份文檔都違反得了、驗一次蓋住全部）列成候選 | `global-laws`：攤影響範圍、開發者批准才寫；抽上去的那條 law 從原本的文檔搬走（文檔此時還沒 `verified`，不是修訂），三行照搬、識別字只准是最內層的匯出 |
| 架構：層 (dev-flow) | `scope-laws` 的「軟體架構」那一項，對著這一片實際長出來的程式碼定層表（第一片）或提出要多一層（之後的片） | `global-laws`：層表與 `modules.md` 的層欄；談出來的層與這一片的長相不同 → `lint boundary` 紅，接下來的 build 把程式碼調到成立 |
| 架構：四層 (lawful) | 四層是固定的，`kickoff` 建好；每一層「裝什麼」那一句在第一片做完之後由 `global-laws` 寫 | `global-laws` |
| 契約：對外 I/O | `scope-laws` 的「外部串接方法」那一項：這一片跨過邊界的那幾端，信任與驗證當場與開發者講定 | 這一片的新列由 `scope-laws` 直接寫（現行規矩）；改既有的列（放寬信任、換驗證、換契約）走 `global-laws` |

`scope-laws` 把文檔談到 `ready` 之後：有全域的候選 → 先自動接 `global-laws <候選>` 落筆，它寫完再自動接 `build`；沒有候選 → 直接接 `build`。build 照現有規矩替新的領域不變量派 qa 寫 `INV-n#LAW` 測試（候選從 Scope Law 抽上去時，原本守它的測試歸屬要改，這件事由 build 那一波的 qa 做）。

## 保留的
- **不強迫、但允許先立**：開發者事先就知道的硬規矩（「金額一律用整數的分」），隨時可以叫 `global-laws` 先立一句；`kickoff` 不主動問。先立的領域不變量在最內層的型別出現之前只有一句話，status 照舊顯示「還沒有三行式」。
- **第一條切片單獨走完**：專案的第一條切片做完、它的全域 Law 抽出來並合進主線之前，不開第二條切片（否則兩片各長各的結構）。第二片起，從第一行程式碼就要守全域 Law。只寫規矩，不加機制；`status` 在「全域 Law 三區都還是『無』而且已經有切片在建構中」時，「今天能開幾條線」不再列別的切片（這一條若要動 CLI，做最小的）。
- 全域 Law 的變更（修改、放寬、替換、刪除）照舊：開發者明確批准、`global-laws` 落筆、`integrate` 只提建議。

## 連帶
- `global-laws` skill：主場景從「第一次定義三區」換成「抽上去」（來源：`scope-laws` 列的候選、開發者自己提的、`integrate` 的變更建議）；「第一次定義」那一節拿掉。
- `scope-laws` skill：談完 law 之後多一步「全域的候選」；收尾的自動接續改成上面那樣。
- `kickoff`、`require-design`：收尾的接續與前置裡提到「先定全域 Law 三區」的句子。
- 規章：`laws.md`「全域 Law」（准入判準照舊，加「怎麼來的」）、`roles.md`「五個階段」、`features.md` / `pipelines.md` 的 `system.md` / `Cone.md` 一節、`tooling.md` 的 status 說明與建議路線、`rules/README.md` 的流程段；根 `README.md` 的流程圖與說明。
- 模板：`system.md` / `Cone.md` 的「全域 Law」三區一開始寫「無」（dev-flow 的層表：沒有列；lawful 的四層表照舊）。
- CLI:status 對「三區是『無』」不出警訊（空的全域 Law 在第一片抽出來之前是正常的，不需要特別說明）；「還沒有三行式」的警訊只對已經立了的領域不變量。`blank` / `templated` 夾具跟著模板；其餘夾具不變。
