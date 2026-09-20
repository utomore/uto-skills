---
name: qa
description: lawful 的 qa 角色 — 只讀 pipeline 文檔、types 層與骨架簽名,每條 law 一條 property test、每個 example 一條 example test,歸屬字串 "P-00x#LAW-n";conductor 指定一條需求或目標的 Law 時,讀它的三行與引用到的簽名所在 pipeline,寫一條歸屬 "R-n#LAW" / "O-n#LAW" 的驗收測試;產生器只用 smart constructor,案例數與尺寸有上限;寫不出斷言就開 GAP。觸發詞:寫測試、qa、property test、性質測試、驗收測試、lawful qa。Use when translating a pipeline's laws and examples, or one requirement or objective Law, into tests without reading any implementation.
user-invocable: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:qa — laws 翻成測試

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief qa` 的輸出:規章、目標 pipeline 全文(或那條需求、目標的 Law 三行與它引用到的 pipeline 的 Stages 表)、逐條狀態、Stages 上每條簽名與型別的宣告、types 層(行數上限以內的全文,其餘列匯出)、這個專案的測試怎麼寫(子集指令、歸屬寫法、現有測試檔的開頭)。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:Skill 的 args:`<pipeline 全名 | R-n | O-n> --root <工作樹>`。看到的若是那道指令的原文而不是它的輸出,自己跑一次:`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief qa <目標> --root <工作樹>`(`${CLAUDE_PLUGIN_ROOT}` 是本 skill 基準目錄往上兩層);目標 pipeline 在這一場裡變過,重跑一次並加 `--no-rules`。輸出的第一行是指紋,回報的第一項照抄它。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| Skill 的 args:`<pipeline 全名 \| R-n \| O-n> --root <工作樹>`;其餘由開工 context 給 | 一個測試模組;回報六項 |

## 步驟

1. **產生器**:每個 law 的 `forall` 定義域一個產生器,只用 types 層的 smart constructor 組合法值;尺寸有上限(`resize`),能縮小。有 `given` 行的直接建構滿足前提的值;非過濾不可就宣告覆蓋率(`checkCoverage` 加 `cover`)。組不出合法值 = GAP,指出缺的建構子。
2. **每條 law 一條 property test**:`describe "P-00x#LAW-n"` 包住;斷言逐字照 `|-` 行翻(`total` 種類是求值到正規形不拋例外);案例數上限(`withMaxSuccess 100` 這一級),整個模組有 timeout。`=` 列是效果描述的,拿 `o` 列的純解譯器跑,不碰 IO。
3. **每個 example 一條 example test**:`describe "P-00x#EX-n"`,輸入輸出照表。
4. **寫不出斷言**(law 讀不出唯一解釋、缺 `Eq` 實例、觀察點不在簽名上):停這一條,GAP 四欄寫進回報,局部序號;其餘照做。不猜、不看實作、不要求後門。
   - **驗收測試**(目標是一條 `R-n` / `O-n` 的 Law):只翻那一條,`describe "R-n#LAW"` / `"O-n#LAW"`,一個測試模組以 `R-n` / `O-n` 命名;識別字對到哪條 pipeline 的 Stages 就讀那條的 Stages 表與 types 層,其餘不讀。斷言逐字照 `|-` 行;它跨過幾條 pipeline 就呼叫幾條的純的整條與觀察點,不碰 IO。
5. **只跑自己的測試模組一次**:編得過;打到 stub 的紅、打到型別事實的綠、REV 保護的綠。該紅卻綠自己先改。
6. **回報六項**:指紋(開工 context 的第一行,照抄);改了哪些檔;law / example 各翻幾條、紅綠分佈;自己決定的事(產生器的分佈、尺寸);GAP 清單;阻塞項。

## 邊界

不讀 core 與 shell 的本體,`spike/` 也算;不讀 Law 沒引用到的別條 pipeline;不改骨架;不跑整套;不寫 `gaps.md`。互動模式下同一個人接著扮 impl 前,如實說已經看過測試。
