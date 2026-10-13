---
status: accepted
date: <YYYY-MM-DD>
decision-makers: [<帳號>]
---
# D-003 採用 py-ports-adapters：Python、ports and adapters、api 與 cli 兩個對等入口

## 當前情境

<這個系統由幾個人開發、有沒有要移交、有幾種入口。結構要做到三件事：新加入的人從 README 與 `docs/` 就看得懂；多人同時開發不互相踩到；用語從需求到程式碼只有一套。>

多人同時開發時，最常出事的地方是：業務規則和資料庫、HTTP 纏在一起，測試要起整套環境；
一份共用的介面檔每個人都在改，一直衝突；依賴組裝寫錯，到執行期才發現；錯誤訊息散在各處，用語不一致；
一個 use case 要用到好幾個領域時，接線散在各個入口，api 與 cli 各接一套。

## 選擇

| 選項 | 適合 | 代價 |
|---|---|---|
| py-ports-adapters：業務領域當核心，application 是唯一的接線處，api 與 cli 對等 | 有兩種以上入口、業務規則多、多人同時開發 | 每個 use case 多一個薄函數；新增一個入口要動四處 |
| 一支 API 一個 feature 資料夾 | 端點少、幾乎沒有共用的業務概念 | 資料夾數量跟著端點數量長，同一個業務概念散在十幾個資料夾裡 |
| 分層的領域（領域之間單向 import） | 領域之間的依賴很少而且穩定 | 上層領域的 law 要連下層一起跑或 mock 下層的函數，law 不再只測自己；依賴藏在 import 裡，要讀程式碼才看得出哪個領域用了哪個 |

## 決策

採用型錄的 `py-ports-adapters`：Python、ports and adapters、`api` 與 `cli` 兩個對等入口。怎麼切、依賴方向與 law 住哪寫在 P-003。

## 三個月後的影響

- 新加入的人從 README 與 `docs/` 就能看懂結構；領域資料夾之間互不 import，多人同時開發很少互相踩到。
- 領域的測試不需要資料庫與網路，跑得快；law 只測自己的領域，不會因為別的領域改了而壞。
- 換掉資料庫或對外服務只動 platform；一個 use case 多用一個領域，只動 application 的那一個函數。
- 每個 use case 多一個薄函數；只碰一個領域時它看起來多餘，但 api 與 cli 因此共用同一份接線。
- cli 和 api 對等：每個 use case 都要有 cli 指令（`check_entries` 要求入口表的 cli 欄不能是 `-`；api 入口可以沒有，例如初始化），任何領域的服務都能從 cli 直接驗證，不必起 api 伺服器。
