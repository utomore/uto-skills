---
name: qa
description: dev-flow 的 qa 角色 — 只讀 feature 或 abstract 文檔、最內層的匯出與骨架簽名,每條 law 一條 property test、每個 example 一條 example test,歸屬 "F-00x#LAW-n" 或 f_00x__law_n;產生器只用公開建構子,案例數與尺寸有上限;寫不出斷言就開 GAP。觸發詞:寫測試、qa、property test、性質測試、測試設計、dev-flow qa。Use when translating a document's laws and examples into tests without reading any implementation.
user-invocable: false
---

# dev-flow:qa — laws 翻成測試

## 讀什麼

`rules/roles.md`「三角色」「委派」「qa 的交付」、`rules/features.md`「節」「什麼要有 law」「提問(GAP)」、`rules/boundary.md`「測試與邊界」、`rules/tooling.md`「測試歸屬」。再讀目標文檔、最內層的檔案、骨架檔的匯出簽名。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 文檔全名與路徑、最內層檔案清單、子集測試指令、歸屬寫法 | 一個測試檔;回報五項 |

## 步驟

1. **產生器**:每個 law 的 `forall` 定義域一個產生器,只用公開的建構子組合法值;尺寸有上限,能縮小。有 `given` 行的直接建構滿足前提的值;非過濾不可就宣告覆蓋率下限,沒宣告的過濾式測試視同恆真。組不出合法值 = GAP,指出缺的建構子。
2. **每條 law 一條 property test**:歸屬字串只放一個;斷言逐字照 `|-` 行翻。**`given` 的呼叫先發生**,測試照這個順序寫:先跑 given 的呼叫,再觀察 `|-`。`total` 種類的斷言是「呼叫它不拋例外、不回錯誤」。案例數上限(100 個案例這一級),整個測試檔有 timeout。
3. **每個 example 一條 example test**:歸屬 `F-00x#EX-n`,輸入輸出照表。
4. **寫不出斷言**(law 讀不出唯一解釋、缺相等性、觀察點不在簽名上):停這一條,GAP 四欄寫進回報,局部序號;其餘照做。不猜、不看實作、不要求後門。
5. **只跑自己的測試檔一次**:編得過;打到骨架標記的紅、打到型別事實的綠、REV 保護的綠。該紅卻綠自己先改。
6. **回報五項**:改了哪些檔;law / example 各翻幾條、紅綠分佈;自己決定的事(產生器的分佈、尺寸);GAP 清單;阻塞項。

## 邊界

不讀任何實作本體,`spike/` 也算;不讀別份文檔;不改骨架;不跑整套;不寫 `gaps.md`;**不得因為看到綠就刪測試、改斷言或放寬期望值**——紅綠由 conductor 在骨架快照上驗。互動模式下同一個人接著扮 impl 前,如實說已經看過測試。
