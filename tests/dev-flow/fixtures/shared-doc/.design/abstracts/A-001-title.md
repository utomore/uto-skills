---
id: A-001
description: 一段文字正規化成一個標題
status: ready
updated: 2026-09-07
---
# A-001-title:一段文字正規化成一個標題

## Brief
把一段文字去掉頭尾空白、把連續的空白收成一個,得到一個標題。
input 是 string,output 是 Title。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| o | `titleText(Title): string` | 觀察:標題的文字 | `src/domain/title.ts` | domain |
| = | `normalize(string): Title` | 整條:去頭尾空白、收連續空白 | `src/domain/title.ts` | domain |

## Laws
- LAW-1 [identity] 正規化過的標題再正規化一次不變
  - forall s in string
  - |- titleText(normalize(titleText(normalize(s)))) == titleText(normalize(s))

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `normalize("  買  牛奶 ")` | `titleText 是 "買 牛奶"` | LAW-1 |

## 決定
- **標題只收空白,不改大小寫。** 否決:一律轉小寫。大小寫是使用者寫的內容,不是格式。

## 修訂記錄
無
