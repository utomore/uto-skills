---
name: impl
description: lawful 的 impl 角色 — 讀 pipeline 文檔與骨架,把每個 stub 換成實作,私有 helper 可以,簽名與型別不動;非改簽名不可就開 GAP;不讀寫測試。觸發詞:實作、填實作、impl、lawful impl。Use when filling a pipeline's skeleton bodies without touching tests or signatures.
user-invocable: false
---

# lawful:impl — stub 換實作

## 讀什麼

`rules/roles.md`「三角色」「委派」、`rules/pipelines.md`「節」「提問(GAP)」、`rules/boundary.md`「四層」。再讀目標 pipeline 檔、骨架模組、types 層模組。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| pipeline 全名與檔、骨架檔路徑、子集測試指令 | stub 全部換成實作;回報五項 |

## 步驟

1. **逐 stage**:讀 Brief 與該 stage 的「做什麼」,再讀掛在它上面的 laws;實作要讓每條 law 成立,不只讓 example 過。
2. **層的紀律**:pure 層不 import shell 與 IO 模組、簽名不出現效果;要的私有 helper 寫在同一模組,不匯出。
3. **簽名或型別不夠用**(非改簽名不可、缺一個型別建構子):停這一個 stage,GAP 四欄寫進回報;其餘 stage 照做。不自己改簽名,不改 types 層。
4. **互動模式跑子集一次;委派模式不跑**,conductor 手上有基線。
5. **回報五項**:改了哪些檔;簽名 n / m 實作了幾條、測試結果與每條紅的歸因(不裁決);自己決定的事(資料結構、演算法);GAP 清單;阻塞項。

## 邊界

不讀、不寫、不改任何測試檔;不改簽名與型別;不 import `spike/`;測試全綠也不把有 open GAP 的 stage 當完成。
