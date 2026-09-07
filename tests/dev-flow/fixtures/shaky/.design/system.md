---
language: typescript
updated: 2026-09-07
---
# shaky:每一種紅都示範一次

## 目的
夾具:讓每一道 lint 的紅與 status 的警訊各出現一次。

## 語言與工具
- 建置:`npx tsc --noEmit`
- 測試(整套):`npx jest`
- 測試(子集):`npx jest test/<檔名>`
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無

## 層
| 層 | 裝什麼 |
|---|---|
| domain | 規則 |
| application | 用例 |
| entry | 路由 |

## 對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 |
|---|---|---|---|---|---|---|
| POST /score | in | `Raw` | `src/entry/api.ts` | F-001-score | untrusted | - |

## Features
| 全名 | 類別 | 階段 |
|---|---|---|
| F-001-score | feature | S1 |
| F-003-missing | feature | S1 |
