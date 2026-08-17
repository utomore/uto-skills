# 開發流程文檔慣例(共用)

所有開發流程 skills(arch-design、subarch-design、func-spec、code-audit、spec-impl、branch-pr)共用本慣例。

## 資料夾結構(專案內)

```
docs/
├── arch/
│   ├── architecture.md                    # 專案燈塔:整體架構(需求、技術、階段)
│   └── subarch-0001-<slug>.md             # 子系統架構(由整體架構往下展開)
├── adr/
│   └── adr-0001-<slug>.md                 # 架構決策紀錄
├── spec/
│   └── func-0001-<slug>.md                # 功能規格書
├── analysis/
│   └── report-<YYYY-MM-DD>-<slug>.md      # 分析報告
├── bugfix/
│   └── bug-0001-<slug>.md                 # 缺陷紀錄
└── enhance/
    └── enhance-0001-<slug>.md             # 改善規格(/func-spec:enhance 或 /code-audit 產出)
```

## 命名規則

- 檔名一律**英文 kebab-case**;內文一律**繁體中文**
- 編號四位數遞增(`func-0001`、`bug-0001`、`enhance-0001`、`adr-0001`、`subarch-0001`):建立新檔前先掃描該資料夾現有檔名,取最大編號 +1
- 檔名以**編號優先**,不放日期(日期在 frontmatter 的 `created` / `updated`);只有 `analysis/report-*` 以日期命名
- 日期一律 `YYYY-MM-DD`

## Metadata 標準(YAML frontmatter)

spec / bugfix / enhance / adr / report 文件**開頭必須**是 YAML frontmatter,狀態掃描腳本只解析這一段:

```yaml
---
id: func-0003            # func-XXXX | bug-XXXX | enhance-XXXX | adr-XXXX | subarch-XXXX | report-<date>-<slug>
type: spec               # spec | bug | enhance | adr | subarch | report
title: user-authentication
description: 以 JWT 實作使用者註冊、登入與權限驗證   # 一句話主軸,見下方規則
status: open             # open | in-progress | done | closed(ADR 改用 proposed | accepted | superseded)
created: 2026-08-15
updated: 2026-08-15
depends-on: []           # spec / enhance 用:依賴的其他 spec id,判斷任務可否平行開發
related-adr: []          # 相關 ADR id
related-spec: []         # bug/enhance 回鏈到 spec id
---
```

### 架構文檔的互鏈欄位(arch / subarch 專用)

```yaml
subarchs: []             # architecture 用:已建立的子系統架構 id 清單,如 [subarch-0001, subarch-0002]
parent-arch: architecture  # subarch 用:回鏈主架構的 id(固定為 architecture)
```

- 主架構 `docs/arch/architecture.md` 的 `subarchs` 是子系統的**唯一權威清單**:`/subarch-design` 建檔或廢棄子系統時必須同步回填
- 每份 `subarch-*` 都必須有 `parent-arch`,讓任何讀者能從子系統回溯到主架構
- `/code-audit status` 會雙向比對 `subarchs` 與實際 `subarch-*` 檔案,並解析每份 subarch 的「功能規劃」表格算出子系統進度;因此**功能規劃的 `spec` 欄要即時回填**(`/func-spec:feature` 建檔後就填),沒回填的項目會被列為「待展開的 feature」、該子系統進度也會偏低

### 清單欄位格式(唯一寫法:行內陣列)

`depends-on`、`related-adr`、`related-spec`、`subarchs` 等清單欄位**一律寫成行內陣列**,空值寫 `[]`:

```yaml
depends-on: [func-0001, func-0002]   # ✅ 唯一合規寫法
related-adr: []                      # ✅ 空清單
subarchs: [subarch-0001]             # ✅ 單一元素也用陣列
```

```yaml
depends-on:                          # ❌ 不使用 YAML 區塊列表
  - func-0001
  - func-0002
```

- 理由:狀態掃描腳本只讀檔頭、只認行內陣列;兩種格式並存會讓清單被讀成空值,相依關係與權威清單就對不上
- 值含冒號 `:`、`#` 或空白時,該元素用雙引號括起來
- `/code-audit status` 偵測到區塊列表會列進「frontmatter 格式不合規」並以 exit code 1 收場,改回行內陣列即可

### `description` 欄位規則(必填)

- **所有類型都要寫**:architecture / subarch / adr / spec / **bug** / **enhance** / report,一個都不能少
- **一句話**描述本文檔的**主軸/主題**:這份文檔在講什麼、要達成什麼
- **繁體中文、40 字以內**,不加句號;超過就是寫太細,砍掉細節只留主軸
- 只寫主題,不寫實作細節、不列步驟、不寫理由(那些屬於內文)
- 值含冒號 `:` 或 `#` 時整句用雙引號括起來(YAML 規則)
- 建立文檔時就要寫;除非文檔主題本身改變,否則後續修改不動這欄

各類型的寫法:

| 類型 | 描述對象 | 範例 |
|---|---|---|
| architecture | 專案在做什麼 | `本地端 Markdown 筆記管理與全文檢索工具` |
| subarch | 這個子系統負責什麼 | `全文檢索子系統:索引建立、查詢解析與排名` |
| adr | 決定了什麼 | `選用 SQLite FTS5 作為全文檢索引擎` |
| spec | 這個功能做什麼 | `以 JWT 實作使用者註冊、登入與權限驗證` |
| bug | 什麼壞了 | `並發寫入時索引損毀導致搜尋結果缺漏` |
| enhance | 要改善什麼 | `將檔案掃描改為增量更新以縮短啟動時間` |
| report | 分析了什麼 | `全專案穩健性與資安面向的健檢結果` |

## 通用規則

- 修改任何文檔內容時,同步更新 frontmatter 的 `updated`
- 每份文檔都必須有 `description`(一句話、40 字以內),bug / enhance 也不例外;缺少時視同 metadata 不合規,`/code-audit status` 會把它列進「缺少 description / 主軸」清單並以 exit code 1 收場
- spec/bug/enhance 完成(實作完成且測試通過)後 `status` 改 `done`;確認不再需要或已廢棄時改 `closed`
- **Context 載入紀律**:分析或開發時只讀 `docs/arch/architecture.md`、與目標相關的 `subarch-*`(不相關的子系統不讀)、相關(最新)ADR、當前目標文檔;已 Closed 的 bugfix 檔除非必要否則不載入
- `docs/arch/architecture.md` 是專案燈塔:任何文檔產出後若與其描述衝突,必須回頭檢查並(經開發者同意)更新
- **主/子架構分工**:主架構只寫到「子系統邊界」的顆粒度(定位、職責、對外介面);子系統內部的元件、資料流與演算法細節放對應的 `subarch-*`,避免單一檔案過度膨脹。兩者描述衝突時以主架構為準,並回頭修正子架構
- **舊版路徑相容**:0.4.0 起架構檔案集中於 `docs/arch/`;若專案只有舊版 `docs/architecture.md`,各 skill 照常以它為燈塔運作,但應提醒開發者用 `/arch-design` 遷移到 `docs/arch/architecture.md`
