---
name: audit
description: lawful 的稽核 — lawful lint all 與 status 的機械紅逐條分類(文檔錯還是程式碼錯),同層搬家跑 sync,然後人判每條 pipeline 的 laws 有沒有講到該講的性質、邊界有沒有被繞過;產出一張「哪裡 / 什麼事 / 怎麼辦」表,不直接改契約。觸發詞:稽核、audit、檢查文檔、對帳、lawful audit、文檔與程式碼對不上。Use when checking that .lawful and the code still agree and that laws cover what matters.
user-invocable: true
---

# lawful:audit — 對帳與判斷

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/tooling.md`「CLI」、`rules/boundary.md` 全份、`rules/pipelines.md`「節」「什麼要有 law」「完成度」。

## 步驟

1. **機械**:`lawful lint all`、`lawful status --tests <log>`(log 照 `lawful:status` 第 1 步拿)。
2. **分類每條紅**:簽名不一致看兩邊誰對,文檔錯走 `lawful:revise`、程式碼錯列給 impl;同層搬家直接 `lawful sync`;未登記模組 `lawful modules --gen` 再請開發者填層;跨層 import 與 pure 碰 IO 列為結構問題。
3. **人判 laws**:每條 law 先過「什麼要有 law」的兩問,自由度為一的提議刪;再拿種類問法表(`pipelines.md`「節」的 Laws 表)逐種對:該有 invariant 的有沒有、roundtrip 有沒有說哪些欄位不算、bound 有沒有數字。缺的寫成提議,不直接加。
4. **人判邊界**:對外 I/O 表每一列有沒有對到里程碑的兩端;`*.Internal` 有沒有被 production import;有沒有 test-only export。
5. **報告一張表**:哪裡 / 什麼事 / 怎麼辦,怎麼辦欄寫具體命令(`lawful:revise P-00x-<slug>`、`lawful sync`)。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」)。

## 邊界

只有 `sync` 與 `modules --gen` 這兩個機械動作可以直接做;契約(簽名、law、層)一律走 `lawful:revise`;不寫測試、不寫實作。
