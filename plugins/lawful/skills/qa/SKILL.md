---
name: qa
description: lawful(有 .lawful/ 的 Haskell 專案)的 qa 角色,只由 build 的 conductor 委派(開發者要補測試走 build):只讀 pipeline 文檔、types 層與宣告,每條 law 一條 property test、每個 example 一條 example test,或一條需求驗收、領域不變量的測試;不讀 core 與 shell 的本體。觸發詞:寫測試、qa、property test、性質測試、驗收測試。Use when translating laws and examples into tests without reading any implementation.
user-invocable: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:qa — laws 翻成測試

> **核心**:Translate the Law, not the code: every test MUST come from the Law text alone and MUST be able to fail.(翻譯的是 law,不是程式碼:每條測試只從 law 的原文來,而且要真的會失敗。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief qa` 的輸出:規章、目標 pipeline 全文、逐條狀態、Stages 上每條簽名與型別的宣告(目標是 `R-n` / `INV-n` 時是那條需求的驗收、領域不變量的三行與它引用到的 pipeline 的 Stages 表與宣告)、types 層(行數上限以內的全文,其餘列匯出)、`Cone.md` 的「Constraint」節、這個專案的測試怎麼寫(子集指令、歸屬寫法、現有測試檔的開頭)。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:Skill 的 args:`<pipeline 全名 | R-n | INV-n> --root <工作樹>`。看到的若是那道指令的原文而不是它的輸出,自己跑一次:`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa <目標> --root <工作樹>`(`${CLAUDE_PLUGIN_ROOT}` 是本 skill 基準目錄往上兩層);目標 pipeline 在這一場裡變過,重跑一次並加 `--no-rules`。輸出的第一行是指紋,回報的第一項照抄它。

宣告那一塊只有簽名與型別,本體不在裡面,也不去開。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| Skill 的 args:`<pipeline 全名 \| R-n \| INV-n> --root <工作樹>`;其餘由開工 context 給 | 一個測試模組;回報六項 |

## 步驟

0. **照 Constraint 寫**:開工 context 的「Constraint」那一塊(語言與版本、套件與框架、環境、命名與寫法)有寫的每一項,測試檔照做:測試框架與輔助套件只用它允許的,測試、產生器與 helper 的命名與格式照它寫。它與 law 的斷言衝突(照它寫就翻不出那條 law)→ GAP,不自己放寬。
1. **產生器**:每個 law 的 `forall` 定義域一個產生器,只用 types 層的 smart constructor 組合法值;尺寸有上限(`resize`),能縮小(反例要讀得懂,整合的仲裁會拿它給開發者看)。有 `given` 行的直接建構滿足前提的值;非過濾不可就宣告覆蓋率(`checkCoverage` 加 `cover`),沒宣告的過濾式測試視同恆真。組不出合法值 = GAP,指出缺的建構子。
2. **每條 law 一條 property test**:`describe "P-00x#LAW-n"` 包住,歸屬字串只放一個;斷言逐字照 `|-` 行翻(`total` 種類是求值到正規形不拋例外);案例數上限(`withMaxSuccess 100` 這一級),整個模組有 timeout。`=` 列是效果描述的,拿 `o` 列的純解譯器跑,不碰 IO。
3. **每個 example 一條 example test**:`describe "P-00x#EX-n"`,輸入輸出照表。
4. **寫不出斷言**(law 讀不出唯一解釋、缺 `Eq` 實例、觀察點不在簽名上):停這一條,GAP 四欄寫進回報,局部序號;其餘照做。不猜、不看實作、不要求後門。
   - **驗收測試**(目標是一條需求 `R-n` 的驗收,或一條領域不變量 `INV-n`):只翻那一條,`describe "R-n#ACCEPT"` / `"INV-n#LAW"`,一個測試模組以 `R-n` / `INV-n` 命名;識別字對到哪條 pipeline 的 Stages 就讀那條的 Stages 表與 types 層,其餘不讀;領域不變量只引用 types 層,就只讀 types 層。斷言逐字照 `|-` 行;它跨過幾條 pipeline 就呼叫幾條的純的整條與觀察點,不碰 IO、不碰進入點。
   - **修訂那一波**(測試模組已經在,conductor 點名要動哪幾條):只寫或改點名的那幾條 law 與 example。conductor 說「既有的 law 不動,簽名或型別變了」→ 只把既有測試裡的呼叫與建構改到對得上新的宣告,斷言與產生器的定義域一個字都不動;改不到對得上就是 GAP,不自己調斷言。
5. **只跑自己的測試模組一次**:確認編得過、跑得完、沒有跑爆。紅綠分佈照實回報,**不因為看到綠或紅而改斷言**:程式碼已經在,紅可能正是這條 law 要抓的東西,綠也可能是斷言恆真——哪幾條該紅由 conductor 在首跑驗,你不必知道。
6. **回報六項**:指紋(開工 context 的第一行,照抄);改了哪些檔;law / example 各翻幾條、紅綠分佈;自己決定的事(產生器的分佈、尺寸);GAP 清單;阻塞項。

## 邊界

不讀 effect、core 與 shell 的本體(函數的內容、私有 helper),切片的決策紀錄也不讀;不讀 Law 沒引用到的別條 pipeline;不改程式碼;不跑整套;不寫 `gaps.md`;**不得因為看到綠就刪測試、因為看到紅就放寬期望值**。互動模式下同一個人接著扮 refactor 前,如實說已經看過測試。
