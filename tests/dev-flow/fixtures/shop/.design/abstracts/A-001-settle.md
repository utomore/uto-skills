---
id: A-001
description: 一組品項金額扣掉折扣之後的應付金額
status: frozen
updated: 2026-09-07
---
# A-001-settle:一組品項金額扣掉折扣之後的應付金額

## Brief
把一串同幣別的金額加起來,再扣掉一筆折扣,得到應付金額或一個錯誤。
input 是品項清單與折扣,output 是 Settlement。流向:加總 → 扣折扣。
F-001-checkout 的第 2 步與 F-002-refund 的第 2 步都引用它。

## Steps
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `sumLines(MoneyList): Settlement` | 同幣別的品項相加,幣別不同就是錯誤 | `src/domain/money.ts` | domain |
| 2 | `subtract(Settlement, Money): Settlement` | 扣掉一筆金額,扣成負的就是錯誤 | `src/domain/money.ts` | domain |
| o | `cents(Settlement): number` | 觀察:結算出來是多少分,沒結算成回 -1 | `src/domain/money.ts` | domain |
| o | `settled(Settlement): boolean` | 觀察:這次結算成功了沒 | `src/domain/money.ts` | domain |
| = | `settle(MoneyList, Money): Settlement` | 整條:加總再扣折扣 | `src/domain/money.ts` | domain |

## Laws
- LAW-1 [invariant] 結算成功時金額不為負
  - forall ls in MoneyList, d in Money
  - given settled(settle(ls, d))
  - |- cents(settle(ls, d)) >= 0
- LAW-2 [identity] 折扣是零時,結算金額等於各品項相加
  - forall ls in MoneyList
  - given settled(sumLines(ls))
  - |- cents(settle(ls, money(0, "TWD"))) == cents(sumLines(ls))
- LAW-3 [total] 任何品項清單與任何折扣都得到一個 Settlement,不拋例外
  - forall ls in MoneyList, d in Money
  - |- total(settle(ls, d))

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `settle([money(100,"TWD"),money(50,"TWD")], money(20,"TWD"))` | `cents 是 130` | LAW-1、LAW-2 |
| EX-2 | `settle([money(100,"TWD")], money(300,"TWD"))` | `cents 是 -1,error 是 negative-total` | LAW-1、LAW-3 |

## 決定
- **金額只在同一個幣別內計算,跨幣別是錯誤不是換算。** 否決:內建匯率換算。匯率是會過期的外部事實,放進純的結算會讓它需要一個時鐘與一個來源。
- **解凍一次**(2026-09-07):建檔即被 REV-1 記錄,收整做完由 build 重新 frozen。

## 修訂記錄
- REV-1(2026-09-07,依 dev-flow:refactor 收整):把 F-001-checkout 與 F-002-refund 各自寫的金額計算收整進本檔
  - 動到:sumLines、subtract、settle 三條簽名搬進 `src/domain/money.ts`
  - 保護:兩份 feature 的 = 列行為不變
  - 重委派:qa(LAW-1、LAW-2、LAW-3)
  - 連動:F-001-checkout、F-002-refund 的第 2 步改成引用本檔
