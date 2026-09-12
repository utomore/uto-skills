---
name: audit
description: lawful 的稽核 — lawful lint all 與 status 的機械紅逐條分類(文檔錯還是程式碼錯),同層搬家跑 sync,人判目標貼合度(每個目標服務願景的哪一句、工作是不是集中在最高優先目標、有沒有 pipeline 不朝向任何目標),再人判每條 pipeline 的 laws 有沒有講到該講的性質、邊界有沒有被繞過;產出一張「哪裡 / 什麼事 / 怎麼辦」表,不直接改契約。觸發詞:稽核、audit、檢查文檔、對帳、目標貼合、lawful audit、文檔與程式碼對不上。Use when checking that .lawful and the code still agree, that the work still heads toward the vision and objectives, and that laws cover what matters.
user-invocable: true
---

# lawful:audit — 對帳與判斷

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/tooling.md`「CLI」「status 報告」、`rules/boundary.md` 全份、`rules/pipelines.md`「願景、目標與里程碑」「節」「什麼要有 law」「完成度」。

## 步驟

1. **機械**:`lawful lint all`、`lawful status --tests <log>`(log 照 `lawful:status` 第 1 步拿)。
2. **分類每條紅**:簽名不一致看兩邊誰對,文檔錯走 `lawful:revise`、程式碼錯列給 impl;同層搬家直接 `lawful sync`;未登記模組 `lawful modules --gen` 再請開發者填職責;沒匯出的 stage、沒有匯出清單的模組列給 impl;跨層 import、core 碰效果型別、production import `*.Internal`、`=` 列在 shell、對外 I/O 對不上 IO 介面,列為結構問題。
3. **人判目標貼合度**(從 `status` 開頭的願景行與目標表讀):每個目標服務願景的哪一句,寫不出來的是分歧,列成提議「改目標或改願景,由開發者決定」;進行中與最近 REV 的 pipeline 各綁在哪個目標,比最高優先目標的里程碑先做了低優先的寫明是哪幾條;沒被任何里程碑綁定的 pipeline、沒有里程碑的目標、綁到不存在的 pipeline 的里程碑(`status` 的警訊);每條達成的里程碑,它綁定的 pipeline 是不是真的涵蓋「做到什麼」那一句。三句話回答「最高優先的目標離達成還差什麼、有沒有東西在往別的方向走、願景與目標有沒有分歧」。
4. **人判 laws**:每條 law 先過「什麼要有 law」的兩問,自由度為一的提議刪;再拿種類問法表(`pipelines.md`「節」的 Laws 表)逐種對:該有 invariant 的有沒有、roundtrip 有沒有說哪些欄位不算、bound 有沒有數字、會爆的輸入有沒有 total、手寫的 instance 有沒有 class 法則、`given` 的測試有沒有宣告覆蓋率。缺的寫成提議,不直接加。
5. **人判邊界**:對外 I/O 表有沒有漏列真實的入口與出口;每個效果描述有沒有純解譯器,IO 介面 `=` 列的 law 是不是拿它寫的;有沒有 test-only export。
6. **報告一張表**:哪裡 / 什麼事 / 怎麼辦,怎麼辦欄寫具體命令(`lawful:revise P-00x-<slug>`、`lawful:objective`、`lawful sync`)。每列先答 `tooling.md`「收尾定錨」下一步的四題:答得出必要性(不做它哪個目標的哪條里程碑、哪條功能無法正常運作)的列成「必要」,答不出的列成「提議」,兩段分開;架構級的列要寫出現在的架構解決不了的那個具體問題。前面加三句話的結論:對帳幾條紅、最高優先的目標差什麼、laws 與邊界最值得動的是哪一條。必要段是空的,結論第一句明寫「目前功能全部正常運作,可以加新功能」。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」)。

## 邊界

只有 `sync` 與 `modules --gen` 這兩個機械動作可以直接做;契約(簽名、law、層)一律走 `lawful:revise`,願景、目標與里程碑一律走 `lawful:objective`;不寫測試、不寫實作。
