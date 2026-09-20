---
language: typescript
updated: 2026-09-07
---
# shared-doc:筆記本

## 願景
每一則筆記的標題不管從哪一條路徑寫進來,長得都一樣。

夾具:一份不被里程碑綁定的文檔,兩份 feature 的 Steps 表都引用它;status 與 lint sig 照讀。

## 全域 Law
不得違反:整個專案任何一條切片、任何一份 feature 都要守。三類各住一區,各有一道 lint 自動確認(`devflow lint global` 一次查完);新增、修改、放寬、替換或刪除都要開發者明確批准。

### 領域不變量
無

### 架構:層
由內而外;內層不准 import 外層,最後一列是最外層,也是唯一能做對外 I/O 的層。

| 層 | 裝什麼 |
|---|---|
| domain | 標題的型別與規則 |
| application | 建立與改名兩條用例 |
| entry | HTTP 路由 |

### 契約:對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 | 契約 |
|---|---|---|---|---|---|---|---|
| POST /notes | in | `HttpReq` | `src/entry/http.ts` | F-001-create | untrusted | `normalize` | A-001#LAW-1 |
| 建立結果 | out | `HttpRes` | `src/entry/http.ts` | F-001-create | trusted | - | - |
| POST /notes/rename | in | `HttpReq` | `src/entry/http.ts` | F-002-rename | untrusted | `normalize` | A-001#LAW-1 |
| 改名結果 | out | `HttpRes` | `src/entry/http.ts` | F-002-rename | trusted | - | - |

## Constraint
- 建置:`npx tsc --noEmit`
- 測試(整套):`npx jest`
- 測試(子集):`npx jest test/<檔名>`(以一份文檔選)
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無
- 號段:無
- 優先:1 = 標題一致;2 = 查得到;3 = 呈現;4 = 工具

## Features
| 全名 | 類別 |
|---|---|
| F-001-create | feature |
| F-002-rename | feature |
