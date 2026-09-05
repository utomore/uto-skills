---
id: ADR-001
description: 存檔格式用 CBOR
updated: 2026-09-05
---
# ADR-001-save-format:存檔格式用 CBOR

## 情境
P-001-save-game 要把 SaveState 寫成檔案。實體數上千時檔案大小與寫入時間會被玩家感覺到;格式一旦出貨就要永久讀得回來。

## 決定
用 CBOR(`cborg`),schema 由 SaveState 的型別直接推導。

## 否決的替代方案
- JSON:可讀,但每個實體多兩到三倍位元組,LAW-3 的線性係數守不住。
- 自訂二進位:最小,但要自己維護版本欄與對齊,三個月後沒人記得格式。

## 後果
- `Save.Codec` 依賴 `cborg`,住 pure 層,不碰 IO。
- 之後加版本欄要在 P-001-save-game 走 REV,動到 `decode` 的簽名。
