# 文檔生命週期(建檔、編號、引用、frontmatter 規格)

`_shared/conventions.md` 的分片。**要新建 / 改名 / 編號任何 `.design/` 文檔、要寫跨文檔引用(`depends-on`、`related-*`、內文提到別份文檔),或要確認某個 frontmatter 欄位怎麼寫時讀這份**;只改既有文檔的 `status` / `updated` 不用讀。

委派模式下 subagent 的編號與檔名**由編排者指定**(`delegation.md` 第 3 條),但引用格式仍然要照本片寫。

## 文檔角色與權威來源

- `build-log.md` 不是任務文檔,不參與 F/E/B 編號,也不列入進度統計;它記的是**編排過程**(配號表、批次澄清的決策、各波次結果、待確認假設與自裁清單、閘門結論)
- `/arch-audit status` 不掃這個檔;它的價值在於「中斷後能接續」與「事後查得到當初為什麼這樣決定」
- `spec-gaps.md` 也不是任務文檔、不參與編號。它是 **qa 與 impl 對 spec 提出的問題清單**(協議見 `spec-roles.md`):有 `open` 的條目,就代表有項目正卡著等 spec 修訂——`/arch-audit status` 會把未結的條目列出來,`/subsys-build` 開跑前會擋。它是**共用檔案**:委派模式下只由編排者單線寫入與配號,subagent 一律只回報(理由見 `delegation.md` 第 4 條)
- `contracts/G-C00x-<slug>.md` 是**多方共用契約的唯一權威來源**:兩個以上子系統都要用、又不屬於任何一方的契約住這裡。判準是 `boundary-rules.md`「知識歸屬」——它是哪些子系統的共同事實,就不能住在其中任何一個的 `design.md` 裡。`/subsys-design` 建檔與修改,`/arch-audit` 對帳,消費端只引用不重新定義
- `system.md` 的 `subsystems` 是子系統的**完整名冊**,不是「已建檔清單」:`/system-design` 在「子系統劃分」定案的當下就把**每一個**子系統的 slug 寫進去,含**規劃中、還沒有 `design.md`** 的。`/subsys-design` 建檔時不動名冊(它建的是名冊上早就有的那一項),只有**新增或廢棄子系統**才改名冊,而那是 `/system-design` 的事
  - 名冊列了、`subsystems/<slug>/` 不存在 = **已規劃未建檔**,是待辦,`/arch-audit status` 會列進「已規劃、未建 design.md 的子系統」並讓 exit code 為 1;**不是**不一致
  - 有資料夾、名冊沒列 = 名冊漏回填,**這一向才是不一致**
  - **理由(這是本流程被修過的最嚴重的一個洞)**:名冊若只收已建檔的,它就跟資料夾清單同義,雙向比對永遠成立,而「還沒開工的那一大半」在任何進度數字裡都不存在。分母必須來自規劃,不能來自產出——否則報表只會愈做愈接近 100%,而且做得愈少、看起來愈完整
- `system.md` 的「開發階段」表是**全專案唯一的產品級分母**:`/arch-audit status` 會解析它,狀態欄只認「未開始 / 進行中 / 已達成」三個詞。任何一階不是「已達成」,盤點就不得宣告專案完成
- 每份 `design.md` 的「模組群」表是**子系統內部的領域劃分**:子系統裡有多個平行領域(而不是一條資料流管線上的幾個模組)時必填,狀態只有 `active` / `planned`。`planned` 的那一群代表契約章節與功能規劃都還沒寫,它**不在該子系統的進度分母裡**,`/arch-audit status` 會單獨列出來。只有一個領域的子系統可以整張表省略
- 每份 `design.md` 都必須有 `parent: system`,讓任何讀者能從子系統回溯主架構
- 每份 `design.md` 的「功能規劃」表格是該子系統的 feature 路線圖;`doc` 欄要在 `/spec-design` 建檔後**即時回填**(委派模式下由 `/subsys-build` 統一回填),沒回填的項目會被列為「待展開的 feature」、子系統進度也會偏低
- 每份 `design.md` 的「Feature 契約卡」章節,功能規劃裡的每個 feature 都要有一張(`###` 一張卡,標題 = feature slug)。契約卡是「這個 feature 可以被無訪談委派」的門檻:寫得夠完整才跑得動 `/subsys-build`,缺卡的項目會被 `/arch-audit status` 列進提示
- **契約卡的生命週期**:卡片的用途在流程裡寫死了是「讓沒訪談過的執行者能開始寫 feature 設計文檔」。**F 文檔一建立,那個用途就結束**——`F00x` 嚴格更豐富(驗收標準已翻成 Laws 與 Examples),權威隨即轉移過去。所以 `/spec-design` 回填 `doc` 欄的同時,把該張卡**瘦成存根**:留 `###` 標題 + 一行指向 `F00x` 與存檔,完整原文搬進 `archive/cards-done.md`
  - **是搬家,不是刪除。** 卡片的「明確不做」在 `F00x` 沒有對應欄位(feature spec 模板沒有這一節),它是這個 feature 負向邊界的唯一紀錄;直接刪掉,三個月後「當初為什麼沒把 X 收進來」就只能從 Laws 的沉默去猜,而**沉默不可區分於遺漏**
  - 存根不算「卡片沒填」:`contract-readiness.md` 的 A2 / A3 / A5 只對**未展開**的 feature(`doc` 欄仍是 `-`)跑,`/arch-audit` 要對帳已完成 feature 的卡片時讀 `archive/cards-done.md`
  - `scan-status.mjs` 只解析卡片的 `###` 標題,存根照樣算進「契約卡 n/總數」,覆蓋率不受影響
  - **為什麼要做**:卡片是逐 feature 累積的,而每次委派只用得到其中一張。實測一個五群、22 個 feature 的子系統,已展開的 14 張卡佔 `design.md` 的 12%,每個 subagent 都要載入卻一張都用不到

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
│       ├── archive/
│       │   └── cards-done.md        # 已展開 feature 的完整契約卡原文(design.md 裡只留存根;有展開過才有)
│       ├── features/
│       │   └── F001-<slug>.md       # /spec-design 產出,如 F001-auth-login.md
│       ├── enhancements/
│       │   └── E001-<slug>.md       # /spec-design 產出,如 E001-optimize-token-cache.md
│       └── bugfixes/
│           └── B001-<slug>.md       # /bugfix 產出,如 B001-null-pointer-auth.md
├── contracts/
│   └── G-C001-<slug>.md             # 跨子系統共用契約(/subsys-design 產出;不屬於任何單一子系統)
├── enhancements/
│   └── G-E001-<slug>.md             # 跨子系統的全域優化(/spec-design 產出)
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
  - 全域:`G-C001`、`G-E001`、`G-B001`(契約 / 優化 / 修復各自從 001 起算)
  - ADR:`ADR-001`
- 檔名不放日期(日期在 frontmatter 的 `created` / `updated`)

## 編號與縮寫註冊表(唯一鑄號機關)

整套流程裡**所有**會被編號、被縮寫的東西都登記在這張表。三條鐵律:

1. **「單字母+數字」只保留給兩種東西**:任務 / 契約文檔 id(三位數)與開發階段 id(`S0`、`S1`…)。檔案**內**的條目(law、example、假設、gap、決策、波次…)一律用**詞首碼-數字**(`LAW-1`、`GAP-2`)——詞首碼自帶語意,不必靠上下文猜,也不會跟文檔 id 或專案自訂的名字撞號
2. **文檔 id 永不簡寫、位數永遠固定**:`E001` 就是 `E001`,任何場合都不准寫成 `E1`;`G-C001` 不准寫成 `GC1` 或 `C1`。一旦簡寫,三位數與單位數條目的區隔就消失,`E1` 到底是 Enhancement 001、Example 1 還是專案的階段 `E1` 沒有人分得出來
3. **新增任何編號系統之前先查這張表**;首碼撞了就換詞首碼,不准共用。skill 自己的修訂也一樣——本表是修一次真實撞號修出來的:`L1` 曾同時是 Law 1 / Level 1 / 專案的 Layer 1,`E1` 曾同時是 Example 1 / `E001` 的簡寫 / 專案的階段 `E1`,`A1` 曾同時是待確認假設 1 / 檢查表 A1

| 首碼 / 寫法 | 格式 | 意思 | 作用域(在哪裡唯一) | 誰配號 |
|---|---|---|---|---|
| `F001` | 三位數 | feature 文檔 | 子系統內一組 | 建檔時掃描 |
| `E001` | 三位數 | enhancement 文檔 | 子系統內一組 | 建檔時掃描 |
| `B001` | 三位數 | bugfix 文檔 | 子系統內一組 | 建檔時掃描 |
| `G-C001` / `G-E001` / `G-B001` | 三位數 | 全域契約 / 優化 / 修復 | 全域各一組 | 建檔時掃描 |
| `ADR-001` | 三位數 | 架構決策紀錄 | 全局一組 | 建檔時掃描 |
| `S0`、`S1`… | 一~二位數 | **開發階段**(`system.md`「開發階段」表的階段 id) | 全專案固定 | `/system-design` |
| `A1`–`A10`、`B1`–`B4` | 固定清單 | `contract-readiness.md` 的檢查條(A 段 / B 段) | 那一份檢查表 | 固定,不配號 |
| `LAW-1` | 詞首碼 | spec 的 law(行為性質) | 單一 spec 檔內 | spec 角色 |
| `REG-1` | 詞首碼 | enhance spec 的**回歸** law | 單一 spec 檔內 | spec 角色 |
| `EX-1` | 詞首碼 | spec 的 example | 單一 spec 檔內 | spec 角色 |
| `ASM-1` | 詞首碼 | 待確認假設 | 單一 spec 檔內 | spec 角色(委派模式) |
| `GAP-1` | 詞首碼 | spec-gaps 條目 | 單一 `spec-gaps.md` 內 | 編排者(委派)/ 本人(互動) |
| `DEC-1` | 詞首碼 | 委派決策(批次澄清的裁決) | 單一 `build-log.md` 內 | 編排者 |
| `SELF-1` | 詞首碼 | 自裁記錄(實作層級的自答) | 單一回報 / 自裁清單內 | spec subagent |
| `WAVE-1` | 詞首碼 | 委派展開的波次 | 單一子系統的展開內 | 編排者 |
| `STEP-1` | 詞首碼 | bugfix 的 TodoList 步驟(`dep:` 欄互相引用) | 單一 bugfix 文檔內 | `/bugfix` |
| `#1` | 井號+項次 | 功能規劃表內的依賴引用 | 同一份 `design.md` 內 | 表格項次 |
| `Level 1 / 2 / 3` | **全名** | 設計三層階梯(主架構 / 子系統 / spec) | 全流程 | 固定 |

- **`Level` 一律寫全名**,任何 skill 文檔與產出裡都不准縮寫成 `L1` / `L2` / `L3`——`L` 誰都不給,免得跟專案的 `Layer` 與舊寫法的 law 混在一起。專案自己的 `Layer 0–3` 之類是專案詞彙,不歸本表管,但**專案自訂縮寫不得與本表衝突**(`/system-design` 產出前檢查):想給階段取 `E0`–`E6` 就是撞了 `E001` 與 `EX-`,一律改用工具鏈保留的 `S0`–`Sn`
- **兩支腳本在守這張表**(都在 `arch-audit/scripts/`):`lint-ids.mjs` 掃 markdown,揪出裸寫的「單字母+數字」——被禁的形式只准出現在反引號裡(那是「在講這個寫法」),裸寫就是真的拿它當識別碼在用;`id-map.mjs` 把本表畫成樹狀圖,不帶參數看慣例、給 `.design` 路徑看某個專案實際鑄過哪些號
- 舊專案文檔裡的 `L1`(law)、`E1`(example)、`G1`(gap)、`A1`(假設)照舊可讀,不強制回頭改;**新寫的一律用本表**。盤點腳本對 gap 條目同時認 `GAP-n` 與舊制 `G<n>`

### 文檔引用格式(depends-on、related-* 等欄位與內文引用)

id 只在子系統內唯一,跨界引用必須帶路徑:

| 情境 | 寫法 | 例 |
|---|---|---|
| 同一子系統內互相引用 | 直接寫 id | `F001` |
| 跨子系統引用 | `<subsystem-slug>/<id>` | `auth/F002` |
| 引用全域文檔 | 直接寫全域 id | `G-E001`、`G-C001` |
| 引用全域契約的**單一條目** | `<全域契約 id>#<條目名稱>` | `G-C001#SessionToken` |
| 引用 ADR | 直接寫 ADR id | `ADR-003` |

引用全域契約時**優先寫到條目**(`G-C001#SessionToken`)而不只是文檔 id:一份全域契約通常裝好幾個條目,只寫 `G-C001` 的話,`--doc` 查詢與 `/arch-audit` 的對帳都只知道「這裡用了那份文檔」,答不出「用了哪一條」——而契約改動幾乎都是**條目級**的。

## Metadata 標準(YAML frontmatter)

所有 `.design/` 文檔**開頭必須**是 YAML frontmatter,狀態掃描腳本只解析這一段。

### 任務文檔(feature / enhance / bugfix,含全域 G-)

```yaml
---
id: F001                 # 檔名編號前綴:F001 | E001 | B001 | G-E001 | G-B001
type: feature            # feature | enhance | bugfix
title: auth-login        # 檔名 slug
description: 以 JWT 實作使用者註冊、登入與權限驗證   # 一句話主軸,見下方規則
status: open             # open | in-progress | done | closed
created: 2026-08-19
updated: 2026-08-19
depends-on: []           # 依賴的其他任務文檔(引用格式見上);空陣列 = 可平行開發
related-adr: []          # 相關 ADR id
related-feature: []      # enhance / bugfix 回鏈到被優化 / 出問題的 feature id
---
```

- `id` 必須與檔名的編號前綴一致(`F001-auth-login.md` → `id: F001`);`type` 必須與所在資料夾一致(features/ → feature、enhancements/ → enhance、bugfixes/ → bugfix)
- 文檔屬於哪個子系統由**檔案路徑**決定,不另設欄位;**全域 G- 文檔**須額外加 `subsystems: [subsys-a, subsys-b]` 列出受影響的子系統

### 架構文檔(system / subsystem)

`system.md`:

```yaml
---
id: system
type: system
title: <project-slug>
description: <一句話,40 字內:這個專案在做什麼>
status: active
created: 2026-08-19
updated: 2026-08-19
subsystems: []           # 完整名冊:「子系統劃分」列到的每一個 slug,含還沒建 design.md 的
---
```

`subsystems` 是**名冊**不是**成果清單**(理由見上方「文檔角色與權威來源」)。`/system-design` 在子系統劃分定案時一次寫齊;之後只有新增或廢棄子系統才動它。

```yaml
subsystems: [kernel, gameplay, frontend, shell, farm, magic, npc-life]   # ✅ 含未建檔的 farm / magic / npc-life
subsystems: [kernel, gameplay, frontend, shell]                          # ❌ 只列已建檔的 → 未開工的部分永遠不進分母
```

`subsystems/<slug>/design.md`:

```yaml
---
id: <subsystem-slug>     # 與資料夾名一致
type: subsystem
title: <subsystem-slug>
description: <一句話,40 字內:這個子系統負責什麼>
status: active
created: 2026-08-19
updated: 2026-08-19
parent: system           # 回鏈主架構(固定值)
related-adr: []
code-paths: []           # 選填:本子系統的程式碼落在哪些路徑(見下)
---
```

- `code-paths`(**選填**):本子系統的程式碼路徑前綴,相對於專案根目錄,如 `code-paths: [src/auth, src/middleware/auth]`。它是把檔案級的工具產出(程式碼知識圖、覆蓋率報告等)捲回子系統級的唯一依據——沒填的話只能靠「路徑片段 = slug」猜測,檔案歸屬可能整批錯。用得到 `_shared/codegraph.md` 的專案建議補上;不用那些工具的專案留空或整欄省略都可以,不影響任何既有流程

`subsystems/<slug>/build-log.md`(只有跑過 `/subsys-build` 才存在):

```yaml
---
id: <subsystem-slug>-build
type: build-log
title: <subsystem-slug>-build
description: <一句話,40 字內:這次委派展開了什麼>
status: in-progress     # in-progress | done
created: 2026-08-19
updated: 2026-08-19
parent: <subsystem-slug> # 回鏈所屬子系統的 design.md
---
```

`subsystems/<slug>/spec-gaps.md`(qa / impl 發現 spec 模糊時才存在;全域文檔的 gap 放 `.design/spec-gaps.md`,`id` 用 `global-gaps`、省略 `parent`):

```yaml
---
id: <subsystem-slug>-gaps
type: spec-gaps
title: <subsystem-slug>-gaps
description: <一句話,40 字內:這個子系統有哪些 spec 待釐清>
status: open            # open(還有未結條目)| done(全部 resolved)
created: 2026-08-19
updated: 2026-08-19
parent: <subsystem-slug> # 回鏈所屬子系統的 design.md
---
```

內文格式(只追加、不改既有條目,修訂後回填狀態)見 `spec-roles.md`「spec-gaps 協議」。條目編號 `GAP-1`、`GAP-2`… 在該檔內遞增,不跨檔共用(舊制 `G1` 照舊可讀,新寫的用 `GAP-`,見「編號與縮寫註冊表」)。**委派模式下這個檔只由編排者寫**(建檔、配號、追加都是),subagent 一律只回報(理由見 `delegation.md` 第 4 條)。

### 全域契約文檔(G-C)

`contracts/G-C001-<slug>.md`——**多方共用、不屬於任何單一子系統**的契約(共用 DTO、跨子系統事件 schema、共同遵守的錯誤語意):

```yaml
---
id: G-C001
type: contract
title: <contract-slug>          # 檔名 slug
description: <一句話,40 字內:這份契約定義了什麼>
status: active                  # active | superseded | closed
created: 2026-08-19
updated: 2026-08-19
subsystems: [subsys-a, subsys-b] # 使用這份契約的子系統(至少兩個,否則它不該是全域的)
related-adr: []
---
```

固定章節:**定位與範圍** → **契約條目**(每個條目一個 `###`,標題 = 條目名稱,內含欄位表:名稱 / 型別 / **單位或值域** / 語意,規格同 `contract-readiness.md` A4)→ **使用者與方向**(哪個子系統產生、哪些消費)→ **變更紀律**。

三條規則:

1. **`subsystems` 少於兩個就不該建這份檔**。只有一個使用者的契約屬於那個子系統,住它的 `design.md`;建成全域等於憑空多一層間接
2. **不准塞進某一個子系統的 `design.md` 再讓別人引用**——那份 `design.md` 從此擁有一個不屬於它的事實,違反 `boundary-rules.md`「知識歸屬」(對帳條目見 `contract-readiness.md` B4)
3. 條目是**不可逆決定**:每次改動要在「變更紀律」段記下改了哪個條目、為什麼、影響哪些子系統;重大者開 ADR 並填進 `related-adr`

引用時**寫到條目**(`G-C001#SessionToken`),理由見上方引用格式表。

### ADR

```yaml
---
id: ADR-001
type: adr
title: <decision-slug>
description: <一句話,40 字內:這份 ADR 決定了什麼>
status: accepted         # proposed | accepted | superseded
created: 2026-08-19
updated: 2026-08-19
---
```

### 清單欄位格式(唯一寫法:行內陣列)

`depends-on`、`related-adr`、`related-feature`、`subsystems` 等清單欄位**一律寫成行內陣列**,空值寫 `[]`:

```yaml
depends-on: [F001, auth/F002]        # ✅ 唯一合規寫法
related-adr: []                      # ✅ 空清單
subsystems: [auth]                   # ✅ 單一元素也用陣列
```

```yaml
depends-on:                          # ❌ 不使用 YAML 區塊列表
  - F001
```

- 理由:狀態掃描腳本只讀檔頭、只認行內陣列;兩種格式並存會讓清單被讀成空值,相依關係與權威清單就對不上
- 值含冒號 `:`、`#` 或空白時,該元素用雙引號括起來
- `/arch-audit status` 偵測到區塊列表會列進「frontmatter 格式不合規」並以 exit code 1 收場

### `description` 欄位規則(必填)

- **所有類型都要寫**:system / subsystem / adr / feature / enhance / bugfix,一個都不能少
- **一句話**描述本文檔的**主軸**:繁體中文、40 字以內,不加句號;超過就是寫太細,砍掉細節只留主軸
- 只寫主題,不寫實作細節、不列步驟、不寫理由(那些屬於內文)
- 值含冒號 `:` 或 `#` 時整句用雙引號括起來(YAML 規則)
- 建立文檔時就要寫;除非文檔主題本身改變,否則後續修改不動這欄

| 類型 | 描述對象 | 範例 |
|---|---|---|
| system | 專案在做什麼 | `本地端 Markdown 筆記管理與全文檢索工具` |
| subsystem | 這個子系統負責什麼 | `全文檢索子系統:索引建立、查詢解析與排名` |
| adr | 決定了什麼 | `選用 SQLite FTS5 作為全文檢索引擎` |
| feature | 這個功能做什麼 | `以 JWT 實作使用者註冊、登入與權限驗證` |
| enhance | 要改善什麼 | `將檔案掃描改為增量更新以縮短啟動時間` |
| bugfix | 什麼壞了 | `並發寫入時索引損毀導致搜尋結果缺漏` |
