---
name: qa
description: dev-flow 的 qa 角色 — 只讀 feature 或 abstract 文檔、最內層的匯出與 Steps 上那幾條簽名的宣告,每條 law 一條 property test、每個 example 一條 example test,歸屬 "F-00x#LAW-n" 或 f_00x__law_n;conductor 指定一條需求的驗收或一條領域不變量時,讀它的三行與引用到的簽名所在文檔,寫一條歸屬 "R-n#ACCEPT"(需求的驗收)或 "INV-n#LAW"(領域不變量)的測試(識別字形式 r_n__accept / inv_n__law);產生器只用公開建構子、能縮小,案例數與尺寸有上限;不讀任何實作本體,不因為看到紅綠而改斷言;寫不出斷言就開 GAP。觸發詞:寫測試、qa、property test、性質測試、測試設計、驗收測試、dev-flow qa。Use when translating a document's laws and examples, or one requirement, objective or invariant Law, into tests without reading any implementation.
user-invocable: false
---

# dev-flow:qa — laws 翻成測試

> **核心**:Translate the Law, not the code: every test MUST come from the Law text alone and MUST be able to fail.(翻譯的是 law,不是程式碼:每條測試只從 law 的原文來,而且要真的會失敗。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 讀什麼

`rules/roles.md`「角色」「委派」「驗收測試」「qa 的交付」、`rules/features.md`「節」「什麼要有 law」「提問(GAP)」、`rules/boundary.md`「測試與邊界」、`rules/tooling.md`「測試歸屬」。再讀目標文檔、最內層的檔案、Steps 上那幾條簽名在程式碼裡的宣告(簽名行與型別,不往下讀本體)。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 文檔全名與路徑、最內層檔案清單、子集測試指令、歸屬寫法;或一條需求 / 目標 / 領域不變量的 Law 三行與它引用到的簽名所在文檔 | 一個測試檔;回報五項 |

## 步驟

1. **產生器**:每個 law 的 `forall` 定義域一個產生器,只用公開的建構子組合法值;尺寸有上限,能縮小(反例要讀得懂,整合的仲裁會拿它給開發者看)。有 `given` 行的直接建構滿足前提的值;非過濾不可就宣告覆蓋率下限,沒宣告的過濾式測試視同恆真。組不出合法值 = GAP,指出缺的建構子。
2. **每條 law 一條 property test**:歸屬字串只放一個;斷言逐字照 `|-` 行翻。**`given` 的呼叫先發生**,測試照這個順序寫:先跑 given 的呼叫,再觀察 `|-`。`total` 種類的斷言是「呼叫它不拋例外、不回錯誤」。案例數上限(100 個案例這一級),整個測試檔有 timeout。
3. **每個 example 一條 example test**:歸屬 `F-00x#EX-n`,輸入輸出照表。
4. **寫不出斷言**(law 讀不出唯一解釋、缺相等性、觀察點不在簽名上):停這一條,GAP 四欄寫進回報,局部序號;其餘照做。不猜、不看實作、不要求後門。
   - **驗收測試**(目標是一條需求 `R-n` 的驗收,或一條領域不變量 `INV-n`):只翻那一條,歸屬 `R-n#ACCEPT` / `INV-n#LAW`,一個測試檔以 `R-n` / `INV-n` 命名;識別字對到哪份文檔的 Steps 就讀那份的 Steps 表與最內層匯出,其餘不讀;領域不變量只引用最內層,就只讀最內層。斷言逐字照 `|-` 行;它跨過幾份文檔就呼叫幾份文檔的 `=` 列,不碰進入點。
5. **只跑自己的測試檔一次**:確認編得過、跑得完、沒有跑爆。紅綠分佈照實回報,**不因為看到綠或紅而改斷言**:程式碼已經在,紅可能正是這條 law 要抓的東西,綠也可能是斷言恆真——哪幾條該紅由 conductor 在首跑驗,你不必知道。
6. **回報五項**:改了哪些檔;law / example 各翻幾條、紅綠分佈;自己決定的事(產生器的分佈、尺寸);GAP 清單;阻塞項。

## 邊界

不讀任何實作本體(函數的內容、私有 helper、切片的決策紀錄);不讀 Law 沒引用到的別份文檔;不改程式碼;不跑整套;不寫 `gaps.md`;**不得因為看到綠就刪測試、因為看到紅就放寬期望值**。互動模式下同一個人接著扮 refactor 前,如實說已經看過測試。
