---
name: qa
description: dev-flow(有 .design/ 的專案)的 qa 角色,只由 build 的 conductor 委派(開發者要補測試走 build):只讀文檔與宣告,每條 law 一條 property test、每個 example 一條 example test,或一條需求驗收、領域不變量的測試;不讀實作本體。觸發詞:寫測試、qa、property test、性質測試、驗收測試。Use when translating laws and examples into tests without reading any implementation.
user-invocable: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:qa — laws 翻成測試

> **核心**:Translate the Law, not the code: every test MUST come from the Law text alone and MUST be able to fail.(翻譯的是 law,不是程式碼:每條測試只從 law 的原文來,而且要真的會失敗。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief qa --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief qa --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief qa --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief qa --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段(一份輸出切成幾段,每段一道指令)是載入 skill 時跑 `devflow brief qa <目標> [--root <工作樹>]` 的輸出:規章的節、目標文檔(或那條需求的驗收、領域不變量的三行與它引用到的文檔)、逐條狀態、Steps 上每條簽名與型別的宣告、最內層、這個專案的測試怎麼寫。開工要的全部在這裡,不再另外讀規章、找宣告、翻別的測試檔;宣告那一塊只有簽名與型別,本體不在裡面,也不去開。第一行是指紋,回報的第一項照抄。

看到的若是那道指令的原文而不是它的輸出,自己跑一次(`${CLAUDE_PLUGIN_ROOT}` 是本 skill 基準目錄往上兩層);目標文檔在這一場裡變過,重跑一次並加 `--no-rules`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| Skill 的 args:`<文檔全名 \| R-n \| INV-n> --root <工作樹>`;其餘由開工 context 給 | 一個測試檔;回報六項 |

## 步驟

1. **產生器**:每個 law 的 `forall` 定義域一個產生器,只用公開的建構子組合法值;尺寸有上限,能縮小(反例要讀得懂,整合的仲裁會拿它給開發者看)。有 `given` 行的直接建構滿足前提的值;非過濾不可就宣告覆蓋率下限,沒宣告的過濾式測試視同恆真。組不出合法值 = GAP,指出缺的建構子。
2. **每條 law 一條 property test**:歸屬字串只放一個;斷言逐字照 `|-` 行翻。**`given` 的呼叫先發生**,測試照這個順序寫:先跑 given 的呼叫,再觀察 `|-`。`total` 種類的斷言是「呼叫它不拋例外、不回錯誤」。案例數上限(100 個案例這一級),整個測試檔有 timeout。
3. **每個 example 一條 example test**:歸屬 `F-00x#EX-n`,輸入輸出照表。
4. **寫不出斷言**(law 讀不出唯一解釋、缺相等性、觀察點不在簽名上):停這一條,GAP 四欄寫進回報,局部序號;其餘照做。不猜、不看實作、不要求後門。
   - **驗收測試**(目標是一條需求 `R-n` 的驗收,或一條領域不變量 `INV-n`):只翻那一條,歸屬 `R-n#ACCEPT` / `INV-n#LAW`,一個測試檔以 `R-n` / `INV-n` 命名;識別字對到哪份文檔的 Steps 就讀那份的 Steps 表與最內層匯出,其餘不讀;領域不變量只引用最內層,就只讀最內層。斷言逐字照 `|-` 行;它跨過幾份文檔就呼叫幾份文檔的 `=` 列,不碰進入點。
   - **修訂那一波**(測試檔已經在,conductor 點名要動哪幾條):只寫或改點名的那幾條 law 與 example。conductor 說「既有的 law 不動,簽名或型別變了」→ 只把既有測試裡的呼叫與建構改到對得上新的宣告,斷言與產生器的定義域一個字都不動;改不到對得上就是 GAP,不自己調斷言。
5. **只跑自己的測試檔一次**:確認編得過、跑得完、沒有跑爆。紅綠分佈照實回報,**不因為看到綠或紅而改斷言**:程式碼已經在,紅可能正是這條 law 要抓的東西,綠也可能是斷言恆真——哪幾條該紅由 conductor 在首跑驗,你不必知道。
6. **回報六項**:指紋(開工 context 的第一行,照抄);改了哪些檔;law / example 各翻幾條、紅綠分佈;自己決定的事(產生器的分佈、尺寸);GAP 清單;阻塞項。

## 邊界

不讀任何實作本體(函數的內容、私有 helper、切片的決策紀錄);不讀 Law 沒引用到的別份文檔;不改程式碼;不跑整套;不寫 `gaps.md`;**不得因為看到綠就刪測試、因為看到紅就放寬期望值**。互動模式下同一個人接著扮 refactor 前,如實說已經看過測試。
