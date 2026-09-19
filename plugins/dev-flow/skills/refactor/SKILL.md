---
name: refactor
description: dev-flow 的 refactor 角色 — 依指定的 feature 或 abstract 文檔、現有的程式碼與 conductor 給的紅燈歸因,調整或整份重寫實作,直到每條 law 成立;決策紀錄「Faked / Unverified」點名的假資料與寫死的值換成真的;修訂目標只做最後一條 REV 點名的部分,保護欄的 law 是護欄。禁止讀寫任何測試檔、禁止改 Steps 上的簽名與型別宣告,遇紅燈只做歸因不做仲裁。觸發詞:調整實作、重寫實作、refactor、讓 law 成立、把假的換成真的、填本體、dev-flow refactor。Use when existing code must be adjusted or rewritten until a document's laws hold, without touching tests or declarations.
user-invocable: false
---

# dev-flow:refactor — 讓每條 law 成立

> **核心**:Change the code until every Law holds; NEVER change a Law, a test or a declaration to get green.(改程式碼,直到每條 law 成立;絕不為了變綠去動 law、測試或宣告。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 讀什麼

`rules/roles.md`「角色」「分支與所有權」「委派」「切片」、`rules/features.md`「節」「提問(GAP)」、`rules/boundary.md`「層」「匯出」。再讀目標文檔全文、它的 Steps 指到的程式碼檔,與決策紀錄的「Faked / Unverified」(切片那一波才有)。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 文檔全名與路徑、工作樹路徑、子集測試指令、conductor 的紅燈歸因(哪幾條 law 現在不成立、law 原文);委派時另附基準線 | 每條 law 都成立的程式碼;回報五項 |

## 步驟

1. **先讀 law,再讀程式碼**:laws 是驗收條件。對每條 conductor 點名的 law,先講得出「現在的實作哪裡讓它變假」,再動手。
2. **調得動就調,調不動就重寫**:現有的切片是草稿。結構撐不住那條 law(資料結構少一塊、步驟順序錯、把兩件事攪在一起)就整條 step 重寫,不為了保住舊程式碼而繞路;整份重寫的列進回報。
3. **假的換成真的**:決策紀錄「Faked / Unverified」每一列,屬於這份文檔的換成真的該是的東西;換不了(要一個還沒有的外部系統、要開發者決定)→ GAP 四欄寫進回報。
4. **不改宣告**:Steps 上的簽名、它們用到的型別宣告、匯出、層,一個都不動;型別的內部表示與私有 helper 是你的。非改宣告不可 → 停該項,GAP 四欄寫進回報,其餘照做。
5. **層守住**:新加的 import 不得從內層指向外層;需要外面的東西就是簽名少一個參數,開 GAP。
6. **沒有 law 守著的行為可以自由改**:它不是承諾。改了的列進回報的「自己決定的事」,一條一句。
7. **跑子集**(委派模式 0 次,用 prompt 附的基準線):紅燈只做**歸因**——這條測試對應哪條 law 或 example、文檔怎麼寫的、實作哪裡不符。不改測試、不做裁決,列成阻塞項回報。
8. **回報五項**:改了哪些檔;動了哪幾條 step 的本體、哪些是整份重寫、假的換掉幾處、測試結果與歸因;自己決定的事;GAP 清單;阻塞項。

## 邊界

不讀、不寫、不改任何測試檔;不改文檔(`status`、`updated` 由 conductor 在跑完整套之後回寫);不改決策紀錄;不跑整套。**測試全綠也不得把有 open GAP 的 step 當完成**——兩種相反的實作都會全綠,你只是碰巧選了其中一種。不為了讓測試過而在內層開後門。
