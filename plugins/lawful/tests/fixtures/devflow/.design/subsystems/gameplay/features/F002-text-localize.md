---
id: F002
type: feature
title: text-localize
status: planned
rev: 1
stage: S1
group: Interaction
---

# F002: text-localize

## 介面

| 簽名 | 語意(做什麼) | 骨架位置 |
|---|---|---|
| `LocaleId`(`newtype LocaleId = LocaleId Text`) | 語系標籤 | `src/Demo/Gameplay/Text.hs#LocaleId` |
| `localesOf :: I18nTables -> [LocaleId]` | 已載入的語系,字典序 | `src/Demo/Gameplay/Text.hs#localesOf` |
| `hasLocale :: I18nTables -> LocaleId -> Bool` | 有沒有載入 | `src/Demo/Gameplay/Text.hs#hasLocale` |
| `localize :: I18nTables -> LocaleId -> TextKey -> [(Text, Text)] -> Text` | 查 key 代參數 | `src/Demo/Gameplay/Text.hs#localize` |

## Laws(行為性質)

- LAW-1: 已載入語系嚴格遞增
  - 量詞:對所有 `t`
  - 定義域:`t :: I18nTables` 全域
  - 前提:無
  - 觀察點:`localesOf t` 相鄰兩項嚴格遞增
- LAW-2: 查不到回醒目標記
  - 量詞:對所有 `t`、`l`、`k`
  - 定義域:`t :: I18nTables`;`l :: LocaleId` 未載入
  - 前提:`not (hasLocale t l)`
  - 觀察點:`localize t l k []` 等於 `"!!missing!!"`
- LAW-3: 舊寫法 —— 對所有 t,localize 不會 throw

## Examples

| # | 輸入 | 預期輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | 空表 | `[]` | LAW-1 |
