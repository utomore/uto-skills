# 文檔 frontmatter 規格

`_shared/conventions.md` 的分片。**要新建 `.design/` 文檔,或修改既有文檔的 frontmatter 欄位時才需要讀這份**;只是讀文檔或改內文的話不用。

各文檔扮演什麼角色、誰是權威清單,見 `conventions.md` 的「文檔角色與權威來源」。

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
subsystems: []           # 子系統 slug 的唯一權威清單,/subsys-design 建檔時回填
---
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
