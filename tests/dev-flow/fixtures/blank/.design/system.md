---
language: <typescript | javascript | python | go | rust>
updated: <YYYY-MM-DD>
---
# <專案名>:<一句話>

## 目的
<三到五句:替誰做什麼、不做什麼。期望三個月後這個專案長什麼樣。>

## 語言與工具
- 建置:`<指令>`
- 測試(整套):`<指令>`
- 測試(子集):`<指令,以一份文檔選>`
- IO 模組追加:<這個專案自己的 IO 模組或客戶端,無則「無」>
- Laws 詞彙追加:<law 會用到、但不是 Steps 簽名也不是型別名的字,無則「無」>
- 忽略目錄:<不掃的原始碼目錄,無則「無」>

## 層
由內而外;內層不准 import 外層,最後一列是最外層,也是唯一能做對外 I/O 的層。

| 層 | 裝什麼 |
|---|---|
| <domain> | <純值型別與規則,一句> |
| <application> | <用例的組裝,一句> |
| <adapter> | <外部系統的實作,一句> |
| <entry> | <程序進入點與路由,一句> |

## 對外 I/O
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 |
|---|---|---|---|---|---|---|
| <名稱> | in | `<Type>` | `<src/entry/x.ts>` | F-00x-<slug> | untrusted | `<驗證的 step 名>` |
| <名稱> | out | `<Type>` | `<src/entry/x.ts>` | F-00x-<slug> | trusted | - |

## Features
| 全名 | 類別 | 階段 |
|---|---|---|
| F-001-<slug> | feature | <階段> |
| A-001-<slug> | abstract | - |
