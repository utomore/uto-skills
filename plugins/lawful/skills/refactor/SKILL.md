---
name: refactor
description: lawful(有 .lawful/ 的 Haskell 專案)的 refactor 角色,只由 build 的 conductor 委派(開發者說測試紅了、要調實作,走 build 的仲裁,不直接用這一份):依 pipeline 文檔與紅燈歸因調整或重寫實作,直到每條 law 成立,假的換成真的;不碰測試與宣告。觸發詞:調整實作、重寫實作、refactor、讓 law 成立、把假的換成真的。Use when code must be adjusted or rewritten until a pipeline's laws hold, without touching tests or declarations.
user-invocable: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:refactor — 讓每條 law 成立

> **核心**:Change the code until every Law holds; NEVER change a Law, a test or a declaration to get green.(改程式碼,直到每條 law 成立;絕不為了變綠去動 law、測試或宣告。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief refactor --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief refactor --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief refactor --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief refactor --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief refactor --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief refactor --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief refactor` 的輸出:規章、目標 pipeline 全文、逐條狀態、Stages 上每條簽名與型別的宣告、types 層(行數上限以內的全文,其餘列匯出)、決策紀錄全文(「Faked / Unverified」是待辦)、要開的檔(哪幾個檔、哪幾條本體還是未實作標記、子集指令、不准碰的測試檔清單)、`Cone.md` 的「Constraint」節。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:Skill 的 args:`<pipeline 全名> --root <工作樹>`。看到的若是那道指令的原文而不是它的輸出,自己跑一次:`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief refactor <目標> --root <工作樹>`(`${CLAUDE_PLUGIN_ROOT}` 是本 skill 基準目錄往上兩層);目標 pipeline 在這一場裡變過,重跑一次並加 `--no-rules`。輸出的第一行是指紋,回報的第一項照抄它。

決策紀錄的「Faked / Unverified」由 conductor 在 prompt 裡給(切片那一波才有)。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| Skill 的 args:`<pipeline 全名> --root <工作樹>`;conductor 的 prompt:紅燈歸因(哪幾條 law 現在不成立、law 原文)、「Faked / Unverified」的列、基準線;其餘由開工 context 給(要開的檔、未實作的簽名、子集測試指令) | 每條 law 都成立的程式碼;回報六項 |

## 步驟

1. **先讀 law,再讀程式碼**:laws 是驗收條件。對每條 conductor 點名的 law,先講得出「現在的實作哪裡讓它變假」,再動手。實作要讓每條 law 成立,不只讓 example 過。
   - **修訂那一波**:conductor 另給最後一條 REV 那一句與「動到」欄(要接到新的簽名與型別、要搬的模組、來源的里程碑那一句要做到的品質)。只做它點名的;「保護」欄的每條 law 與 example 是護欄,改完仍要全綠。既有的一條 law 擋著這次要的品質 → 不繞過、不把行為改到違反它,停該項,GAP 四欄寫進回報(那是要不要調整那條 law 的決定)。
2. **調得動就調,調不動就重寫**:現有的切片是草稿。結構撐不住那條 law(資料結構少一塊、步驟順序錯、把兩件事攪在一起)就整個 stage 重寫,不為了保住舊程式碼而繞路;整份重寫的列進回報。調整與重寫出來的每一行都照開工 context 的「Constraint」那一塊(語言與版本、套件與框架、環境、命名與寫法):不加它禁用的套件、效果照它指定的寫法、新的名字照它的命名寫;非違反它不可 → GAP 四欄寫進回報。本體還是未實作標記的 stage(修訂新增的)填上實作。
3. **假的換成真的**:決策紀錄「Faked / Unverified」每一列,屬於這條 pipeline 的換成真的該是的東西;換不了(要一個還沒有的外部系統、要開發者決定)→ GAP 四欄寫進回報。
4. **不改宣告**:Stages 上的簽名、它們用到的型別宣告(建構子、欄位)、匯出清單、層,一個都不動;型別的內部表示與私有 helper 是你的,helper 寫在同一模組、不匯出。非改宣告不可(簽名不夠用、缺一個型別建構子)→ 停該項,GAP 四欄寫進回報,其餘照做。
5. **層守住**(`boundary.md`「四層」):types / effect / core 不 import shell 與 IO 模組、簽名不出現效果型別;import 的方向 types ← effect ← core ← shell。需要外面的東西就是簽名少一個參數或少一個效果描述,開 GAP。
6. **沒有 law 守著的行為可以自由改**:它不是承諾。改了的列進回報的「自己決定的事」,一條一句。
7. **跑子集**(互動模式一次;委派模式 0 次,用 prompt 附的基準線):紅燈只做**歸因**——這條測試對應哪條 law 或 example、文檔怎麼寫的、實作哪裡不符。不改測試、不做裁決,列成阻塞項回報。
8. **回報六項**:指紋(開工 context 的第一行,照抄);改了哪些檔;動了哪幾條 stage 的本體、哪些是整份重寫、假的換掉幾處、測試結果與歸因;自己決定的事(資料結構、演算法、私有 helper);GAP 清單;阻塞項。

## 邊界

不讀、不寫、不改任何測試檔;不改文檔(`status`、`updated` 由 conductor 在跑完整套之後回寫);不改決策紀錄;不跑整套。**測試全綠也不得把有 open GAP 的 stage 當完成**——兩種相反的實作都會全綠,你只是碰巧選了其中一種。不為了讓測試過而在核心層開後門(test-only export、setter、繞過 smart constructor 的建構子)。
