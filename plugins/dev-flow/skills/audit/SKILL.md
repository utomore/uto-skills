---
name: audit
description: dev-flow 的稽核 — 四段:對帳(devflow lint all 與 status 的機械紅逐條分類成文檔錯還是程式碼錯)、需求與目標(每條需求的驗收判得出來嗎、工作是不是集中在最高優先目標、有沒有 feature 不朝向任何目標、達成的里程碑是不是真的涵蓋它那句、調整有沒有偷渡新 feature)、穩定度(修訂熱點、改動半徑、收整沒成立的 abstract、卡住多久)、安全度(對外 I/O 的信任與驗證、秘密字面值、沒登記的出入口、內層碰 IO);產出一張「哪裡 / 什麼事 / 怎麼辦」表,不直接改契約。觸發詞:稽核、audit、架構檢測、檢查文檔、對帳、專案健檢、目標貼合、穩定度、安全檢查、文檔與程式碼對不上。Use when checking that .design and the code still agree, that the work still heads toward the vision and objectives, and how stable and how safe the project currently is.
user-invocable: true
---

# dev-flow:audit — 對帳、需求與目標、穩定度、安全度

> **核心**:Report, never repair: classify every discrepancy and name the command that fixes it.(只報不修:每一處不一致都分類,並指名修它的那道命令。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 讀什麼

`<D>` 是 plugin 根目錄,也就是本 skill 的基準目錄往上兩層;下面的 `rules/…` 都在 `<D>/rules/`。一次讀完:`rules/tooling.md`「CLI」「status 報告」、`rules/boundary.md` 全份、`rules/features.md`「願景、需求、目標與路線」「節」「什麼要有 law」「完成度」「收整(abstract)」、`rules/laws.md`「Law 與需求」「全域 Law」「Law 怎麼談」。

## 步驟

### 1. 對帳(機械)

`devflow lint all` 與 `devflow status --tests <log>`(log 照 `dev-flow:status` 第 1 步拿)。每條紅分類:

| 紅 | 處置 |
|---|---|
| 簽名不一致 | 看兩邊誰對:文檔錯走 `dev-flow:revise`,程式碼錯列給 refactor |
| 同層搬家 | 直接 `devflow sync` |
| 未登記檔案 | `devflow modules --gen` 再請開發者填層 |
| 沒匯出的 step、內層 import 外層、非最外層 import IO 模組 | 結構問題,列給開發者 |
| law 的識別字對不到 | 少一個觀察點 → 補 `o` 列走 `revise`;真的是專案詞彙 → `system.md`「Laws 詞彙追加」 |
| 幽靈引用 | 測試還在守一條已經不存在的 law,刪測試 |
| 未翻譯 | 那條 law 沒有測試,下一波 build 派 qa |
| 需求的驗收或領域不變量寫了三行卻沒有測試 | `dev-flow:build R-n` / `INV-n`,只派 qa(`roles.md`「驗收測試」) |
| `lint global` 的紅(架構、契約、領域不變量) | 不得違反的約束被踩到:先歸因到哪一份 feature 的程式碼違反了它,改程式碼;覺得該改的是那條全域 Law,列成給開發者的變更建議(`dev-flow:revise` 落筆),不自己改 |
| 領域不變量的三行引用了某份 feature 的簽名 | 它不是全專案的規則:搬回那份 feature 當它的 scope law(`dev-flow:revise`,全域 Law 的變更要開發者批准),或改成只引用最內層 |
| 對外 I/O 表的契約欄指不到 law | 那一端的承諾沒有 law 守著:補 law 走 `dev-flow:revise`,或把契約欄改回「-」 |

`sync` 與 `modules --gen` 是你可以直接做的兩個機械動作,其餘一律回報。

### 2. 需求與目標(我們做的是需求要的東西嗎)

從 `status` 的需求表、領域不變量表與目標表讀,七題:

1. **每條需求的驗收判得出來嗎**:一句話讀得出達成時什麼為真;寫了三行卻沒有驗收測試的列出來;判定來源是測試還是由建置路線推得。一條需求有多個目標時,那幾個目標都達成真的等於需求達成嗎,漏了哪一塊(漏的開里程碑)。建置路線全部達成而需求未達成、優化後退回未達成的,明寫「驗收沒過」。
2. **工作集中在哪個優先**:進行中與最近 REV 的文檔各綁在哪個目標;比最高優先目標的里程碑先做了低優先的,寫明是哪幾份。
3. **誰不朝向任何目標**:沒被任何里程碑綁定的 feature、沒有目標的需求、沒有里程碑的目標、綁到不存在的檔或 abstract 的里程碑(`status` 的警訊)。
4. **完成度說的是實話嗎**:每條達成的里程碑,它綁定的 feature 是不是真的涵蓋「做到什麼」那一句;綁得太少的里程碑完成度是假的。
5. **調整有沒有偷渡新 feature**:每條調整動到的都是本目標里程碑綁定過的 feature 嗎、它的 REV 有沒有把需求的驗收引用的 law 列進保護。

6. **law 講的是承諾,還是在描述程式碼**(`laws.md`「Law 怎麼談」):每份文檔抽幾條 law,問「寫得出一個讓它變假的實作嗎」。寫不出來的那一條只是把實作念了一遍,它的測試是同義反覆——列出來走 `dev-flow:revise` 重談。反過來,程式碼裡使用者看得到、卻沒有任何 law 守著的行為,列成「目前不是承諾」給開發者過目,不替他決定要不要承諾。
7. **全域 Law 有沒有膨脹**(`laws.md`「全域 Law」):每條領域不變量過一次准入四條——只引用最內層嗎、兩份以上的 feature 違反得了它嗎、有測試嗎;只有一份 feature 碰得到的,列出來建議搬回那份 feature。三類約束是不是都看得到住在 `system.md` 的「全域 Law」區;有沒有約束散在 ADR、決策紀錄或某份 feature 的「決定」裡卻沒有可執行形式。這一題只出建議:任何全域 Law 的變更都要開發者明確批准,由 `dev-flow:revise` 落筆。

三句話回答「最高優先的目標離達成還差什麼、有沒有東西在往別的方向走、哪條需求還沒達成、哪條全域 Law 被踩到或還立不住」。

### 3. 穩定度(哪裡還沒收斂)

從 `status` 第 6 段與各文檔的 `## 修訂記錄` 讀,四題:

1. **改最多次的是哪幾份**:REV 條數最多的三份。同一份反覆 REV 代表當初的切法不對——問「這三次 REV 動的是不是同一個東西」,是的話那個東西該被抽成 abstract 或該重切 feature。
2. **改動半徑最大的是哪一份**:被最多文檔引用的 abstract。它的每一次 REV 都要連動全部消費者,值得問「它是不是承擔了太多不相干的事」。
3. **收整成立了沒**:只有一個消費者的 abstract(`status` 的警訊)→ 搬回去;`lint sig` 報的同名未註明 → 該走 `dev-flow:abstract`。
4. **卡多久了**:open 的 GAP、`status` 列成建構中的 `build/` 分支各走到哪一步、停了多久(分支最後一個 commit 距今多久)。卡著的 GAP 擋著整份文檔達成;切片完成卻一直沒有進 law-design 的分支,是一片沒有人認領的程式碼。

三句話回答「現在最不穩的是哪裡、為什麼、要動什麼」。

### 4. 安全度(這個專案自己的事實,不是通用清單)

`devflow lint io` 已經擋掉三條機械的(untrusted 入口沒有驗證 step、文檔裡的秘密字面值、最外層沒登記的出入口)。剩下四題人判:

1. **每個 `untrusted` 入口的驗證 step 有沒有 law**:沒有 law 的驗證等於沒有驗證——測試不會發現它被拿掉。缺的寫成提議。
2. **`!` 列有沒有繞過 `=` 列**:讀進入點的程式碼,確認它是「解析 → 呼叫 `=` 列 → 序列化」,不是自己又做了一遍業務邏輯。繞過去的那一段沒有 law 守著。
3. **對外 I/O 表有沒有漏列真實的出入口**:拿 `lint io` 的 info(最外層 import 了 IO 模組卻沒登記)逐條開檔確認;確實是出入口就補一列,不是就說明為什麼。
4. **信任欄標對了沒**:內容由系統外面決定的一律 `untrusted`——包含第三方 API 的回應、讀進來的檔案、環境變數,不是只有使用者輸入。標成 `trusted` 的逐條問「這個內容真的是我們自己產生的嗎」。

### 5. 人判 laws

每條 law 先過「什麼要有 law」的兩問,自由度為一的提議刪;再拿種類表逐種對:該有 invariant 的有沒有、roundtrip 有沒有說哪些欄位不算、bound 有沒有數字、會爆的輸入有沒有 total、`given` 的測試有沒有宣告覆蓋率。缺的寫成提議,**不直接加**。

### 6. 報告

一張表:哪裡 / 什麼事 / 怎麼辦,怎麼辦欄寫具體命令(`dev-flow:revise F-00x-<slug>`、`dev-flow:abstract`、`dev-flow:objective`、`dev-flow:project`、`devflow sync`)。每列先答 `tooling.md`「收尾定錨」下一步的四題:答得出必要性(不做它哪條需求的哪個目標停在哪條里程碑、哪條功能無法正常運作)的列成「必要」,答不出的列成「提議」,兩段分開;架構級的列要寫出現在的架構解決不了的那個具體問題。前面加四句話的結論:對帳幾條紅、最高優先的目標差什麼、最不穩的是哪裡、安全上最值得動的是哪一條。必要段是空的,結論第一句明寫「目前功能全部正常運作,可以加新功能」。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」)。

## 邊界

只有 `sync` 與 `modules --gen` 可以直接做;契約(簽名、law、層、對外 I/O)一律走 `dev-flow:revise` 或 `dev-flow:abstract`,願景、需求與領域不變量走 `dev-flow:project`,目標、里程碑與調整一律走 `dev-flow:objective`;不寫測試、不寫實作、不自己補 law。
