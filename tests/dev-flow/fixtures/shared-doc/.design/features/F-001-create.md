---
id: F-001
description: 使用者寫下一則有標題的筆記
status: ready
updated: 2026-09-07
---
# F-001-create:使用者寫下一則有標題的筆記

## Brief
把一段標題文字正規化,連同內文存成一則筆記。
input 是 POST /notes 的 HttpReq,output 是 HttpRes。
流向:正規化標題 → 組成筆記。從對外 I/O 表的「POST /notes」進來,從「建立結果」出去。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `normalize(string): Title` | 把標題文字正規化 | `src/domain/title.ts`(見 A-001-title) | domain |
| o | `noteTitle(Note): string` | 觀察:這則筆記的標題文字 | `src/app/create.ts` | application |
| = | `createNote(string, string): Note` | 整條:正規化標題 → 組成筆記 | `src/app/create.ts` | application |
| ! | `createHandler(HttpReq): HttpRes` | 進入點:接到 POST /notes | `src/entry/http.ts` | entry |

## Laws
- LAW-1 [relation] 筆記的標題就是那段文字正規化之後的標題
  - forall raw in string, body in string
  - |- noteTitle(createNote(raw, body)) == titleText(normalize(raw))

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `createNote(" 買  牛奶", "兩瓶")` | `noteTitle 是 "買 牛奶"` | LAW-1 |

## 決定
無

## 修訂記錄
無
