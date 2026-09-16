---
language: typescript
updated: 2026-09-07
---
# shaky:每一種紅都示範一次

## 願景
<一到三句:這個專案做完時世界長什麼樣、替誰改變了什麼。>

## 需求
### R-1:分數算得出來
- Law:<一句可判定的話:這條需求成立時,什麼一定為真>

### R-2:寫了三行卻沒有驗收測試
- Law:任何輸入分數不為負
  - forall raw in Raw
  - |- score(raw) >= 0

### R-3:兩個目標卻沒有蘊含說明
- Law:看得到兩個數字

### R-4:沒有任何目標的需求
- Law:看得到第三個數字

### R-5:Law 引用了進入點與不存在的東西
- Law:進入點回的就是分數
  - forall raw in Raw
  - |- scoreHandler(raw) == mysteryTop(raw)

## 語言與工具
- 建置:`npx tsc --noEmit`
- 測試(整套):`npx jest`
- 測試(子集):`npx jest test/<檔名>`
- IO 模組追加:無
- Laws 詞彙追加:無
- 忽略目錄:無
- 號段:amy@corp.com = 000-099;bob@corp.com = 050-149;carol@corp.com = 1x0-199

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
| 全名 | 類別 |
|---|---|
| F-001-score | feature |
| F-003-missing | feature |
