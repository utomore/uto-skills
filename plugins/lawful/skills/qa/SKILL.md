---
name: qa
description: lawful 的 qa 角色 — 只讀 pipeline 文檔、types 層與骨架簽名,每條 law 一條 property test、每個 example 一條 example test,歸屬字串 "P-00x#LAW-n";產生器只用 smart constructor,案例數與尺寸有上限;寫不出斷言就開 GAP。觸發詞:寫測試、qa、property test、性質測試、lawful qa。Use when translating a pipeline's laws and examples into tests without reading any implementation.
user-invocable: false
---

# lawful:qa — laws 翻成測試

## 讀什麼

`rules/roles.md`「三角色」「委派」「qa 的交付」、`rules/pipelines.md`「節」「什麼要有 law」「提問(GAP)」、`rules/boundary.md`「測試與邊界」。再讀目標 pipeline 檔、types 層模組、骨架模組的匯出簽名。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| pipeline 全名與檔、types 層模組清單、子集測試指令 | 一個測試模組;回報五項 |

## 步驟

1. **產生器**:每個 law 的 `forall` 定義域一個產生器,只用 types 層的 smart constructor 組合法值;尺寸有上限(`resize`),能縮小。有 `given` 行的直接建構滿足前提的值;非過濾不可就宣告覆蓋率(`checkCoverage` 加 `cover`)。組不出合法值 = GAP,指出缺的建構子。
2. **每條 law 一條 property test**:`describe "P-00x#LAW-n"` 包住;斷言逐字照 `|-` 行翻(`total` 種類是求值到正規形不拋例外);案例數上限(`withMaxSuccess 100` 這一級),整個模組有 timeout。`=` 列是效果描述的,拿 `o` 列的純解譯器跑,不碰 IO。
3. **每個 example 一條 example test**:`describe "P-00x#EX-n"`,輸入輸出照表。
4. **寫不出斷言**(law 讀不出唯一解釋、缺 `Eq` 實例、觀察點不在簽名上):停這一條,GAP 四欄寫進回報,局部序號;其餘照做。不猜、不看實作、不要求後門。
5. **只跑自己的測試模組一次**:編得過;打到 stub 的紅、打到型別事實的綠、REV 保護的綠。該紅卻綠自己先改。
6. **回報五項**:改了哪些檔;law / example 各翻幾條、紅綠分佈;自己決定的事(產生器的分佈、尺寸);GAP 清單;阻塞項。

## 邊界

不讀 pure 與 shell 的本體,`spike/` 也算;不讀別條 pipeline;不改骨架;不跑整套;不寫 `gaps.md`。互動模式下同一個人接著扮 impl 前,如實說已經看過測試。
