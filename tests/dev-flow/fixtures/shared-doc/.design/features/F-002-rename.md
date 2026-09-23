---
id: F-002
description: 使用者替一則筆記換標題
status: ready
updated: 2026-09-07
---
# F-002-rename：使用者替一則筆記換標題

## Brief
把一段新的標題文字正規化，換掉一則筆記的標題，內文不動。
input 是 POST /notes/rename 的 HttpReq，output 是 HttpRes。
流向：正規化標題 → 換掉標題。從對外 I/O 表的「POST /notes/rename」進來，從「改名結果」出去。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `normalize(string): Title` | 把新的標題文字正規化 | `src/domain/title.ts`（見 A-001-title） | domain |
| 2 | `noteTitle(Note): string` | 讀出筆記的標題文字 | `src/app/create.ts`（見 F-001-create） | application |
| = | `renameNote(Note, string): Note` | 整條：正規化標題 → 換掉標題 | `src/app/rename.ts` | application |
| ! | `renameHandler(HttpReq): HttpRes` | 進入點：接到 POST /notes/rename | `src/entry/http.ts` | entry |

## Laws
- LAW-1 [relation] 改名之後的標題就是那段文字正規化之後的標題
  - forall n in Note, raw in string
  - |- noteTitle(renameNote(n, raw)) == titleText(normalize(raw))

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `renameNote(createNote("a", "b"), " 買  牛奶")` | `noteTitle 是 "買 牛奶"` | LAW-1 |

## 決定
無

## 修訂記錄
無
