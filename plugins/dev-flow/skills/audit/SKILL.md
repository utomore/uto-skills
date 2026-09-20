---
name: audit
description: dev-flow(有 .design/ 的專案)的稽核:lint 與 status 的紅逐條分類(文檔錯還是程式碼錯)、需求與里程碑是否貼合、穩定度、安全度,產出「哪裡、什麼事、怎麼辦」表,不直接改契約。觸發詞:稽核、audit、健檢、對帳、文檔與程式碼對不上、安全檢查。Use when checking that .design and the code still agree and how healthy the project is.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:audit — 對帳、需求與里程碑、穩定度、安全度

> **核心**:Report, never repair: classify every discrepancy and name the command that fixes it.(只報不修:每一處不一致都分類,並指名修它的那道命令。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief audit --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief audit --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief audit --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief audit --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段(一份輸出切成幾段,每段一道指令)是載入 skill 時跑 `devflow brief audit` 的輸出:規章、`devflow lint all` 的結果、`requirements/` 底下每個需求檔、status 報告、`modules.md`。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:不必給;有最近一次測試輸出就加 `--tests <log>`。專案現況在這一場裡變過、要重看,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief audit --no-rules`。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 步驟

### 1. 對帳(機械)

`devflow lint all` 與 `devflow status --tests <log>`(log 照 `dev-flow:status` 第 1 步拿)。每條紅分類:

| 紅 | 處置 |
|---|---|
| 簽名不一致 | 看兩邊誰對:文檔錯走 `dev-flow:scope-revise`(既有的 law 不動,改簽名;文檔還沒 `verified` 走 `dev-flow:scope-laws`),程式碼錯列給 refactor |
| 同層搬家 | 直接 `devflow sync` |
| 未登記檔案 | `devflow modules --gen` 再請開發者填層 |
| 沒匯出的 step、內層 import 外層、非最外層 import IO 模組 | 結構問題,列給開發者 |
| law 的識別字對不到 | 少一個觀察點 → 補 `o` 列:`verified` 的文檔走 `dev-flow:scope-revise`,還在切片那一波的走 `dev-flow:scope-laws`;真的是專案詞彙 → `system.md`「Laws 詞彙追加」 |
| 幽靈引用 | 測試還在守一條已經不存在的 law,刪測試 |
| 未翻譯 | 那條 law 沒有測試,下一波 build 派 qa |
| 需求的驗收或領域不變量寫了三行卻沒有測試 | `dev-flow:build R-n` / `INV-n`,只派 qa(`roles.md`「驗收測試」) |
| `lint global` 的紅(架構、契約、領域不變量) | 不得違反的約束被踩到:先歸因到哪一份 feature 的程式碼違反了它,改程式碼;覺得該改的是那條全域 Law,列成給開發者的變更建議(`dev-flow:global-laws` 落筆),不自己改 |
| 領域不變量的三行引用了某份 feature 的簽名 | 它不是全專案的規則:搬回那份 feature 當它的 scope law(`dev-flow:global-laws` 刪那一條、`dev-flow:scope-revise` 在那份文檔新增一條;全域 Law 的變更要開發者批准),或改成只引用最內層 |
| 對外 I/O 表的契約欄指不到 law | 那一端的承諾沒有 law 守著:新增一條 law 走 `dev-flow:scope-revise`,或由 `dev-flow:global-laws` 把契約欄改回「-」 |

`sync` 與 `modules --gen` 是你可以直接做的兩個機械動作,其餘一律回報。

### 2. 需求與里程碑(我們做的是需求要的東西嗎)

從 `status` 的需求表、每條需求底下的里程碑、全域 Law 表讀,八題:

1. **每條需求的驗收判得出來嗎**:一句話讀得出達成時什麼為真;寫了三行卻沒有驗收測試的列出來;證據是測試還是里程碑全部達成。**已驗收的那幾條看驗收記錄**:憑據欄寫的是跑了什麼、看到什麼,還是一句空話;證據翻掉了還掛著已驗收的(報告列成待重審)列出來。待審核擺著沒人審的,列進表裡催一次:那是開發者的一關,不是文檔的問題。它的里程碑都達成真的等於需求達成嗎,漏了哪一塊(漏的開里程碑)。里程碑全部達成而驗收沒過的(含靠修訂達成的里程碑做完之後需求退回未達成的),明寫「驗收沒過」。
2. **里程碑是不是使用者看得到的階段**(`features.md`「願景、需求與里程碑」):每條里程碑那一句話展示得出來嗎、說得出用哪道指令或哪個請求看到成果嗎;「資料層做好」這種講不出怎麼展示的列出來。同一條需求有沒有同時開了兩條里程碑(要平行就該拆成兩條需求)。
3. **工作集中在哪個優先**:進行中與最近 REV 的文檔各綁在哪條需求;比最高優先需求的里程碑先做了低優先的,寫明是哪幾份。
4. **誰不朝向任何需求**:沒被任何里程碑綁定的 feature、沒有里程碑的需求、沒有優先的需求、綁到不存在的檔的里程碑(`status` 的警訊)。
5. **達成說的是實話嗎**:每條達成的里程碑,它綁定的 feature 是不是真的涵蓋「做到什麼」那一句;綁得太少的里程碑,達成是假的。
6. **靠修訂達成的里程碑有沒有偷渡新能力**:它那一句是使用者看得到、量得到的嗎;依欄引用它的 REV 有沒有把需求的驗收引用的 law 列進保護;修訂加進來的若是一個可以獨立拿掉的新能力,它該是一條做出新 feature 的里程碑。
7. **law 講的是承諾,還是在描述程式碼**(`laws.md`「Law 怎麼談」):每份文檔抽幾條 law,問「寫得出一個讓它變假的實作嗎」。寫不出來的那一條只是把實作念了一遍,它的測試是同義反覆——列出來走 `dev-flow:scope-laws` 重談(那是調整既有的 law)。反過來,程式碼裡使用者看得到、卻沒有任何 law 守著的行為,列成「目前不是承諾」給開發者過目,不替他決定要不要承諾;要承諾就是新增一條,走 `dev-flow:scope-revise`。需求與 law 有沒有放錯邊:寫成需求卻沒有做完的一天的、寫成 law 卻有做完的一天的,列出來(`laws.md`「Law 與需求」)。
8. **全域 Law 有沒有膨脹**(`laws.md`「全域 Law」):每條領域不變量過一次准入四條——只引用最內層嗎、不只一份 feature 違反得了它嗎、有測試嗎;只有一份 feature 碰得到的,列出來建議搬回那份 feature。反過來看有沒有該抽而沒抽的:同一條 law 在幾份 feature 各寫了一次、講的只是最內層的型別,列成給 `dev-flow:global-laws` 的候選;還沒有任何切片的專案,「全域 Law」三個小區是空的是正常的,不列。三類約束是不是都看得到住在 `system.md` 的「全域 Law」區;有沒有約束散在需求檔、ADR、決策紀錄或某份 feature 的「決定」裡卻沒有可執行形式。這一題只出建議:任何全域 Law 的變更都要開發者明確批准,由 `dev-flow:global-laws` 落筆。

三句話回答「最高優先的需求離達成還差什麼、有沒有東西在往別的方向走、哪條需求還沒達成、哪條全域 Law 被踩到或還立不住」。

### 3. 穩定度(哪裡還沒收斂)

從 `status` 第 6 段與各文檔的 `## 修訂記錄` 讀,四題:

1. **改最多次的是哪幾份**:REV 條數最多的三份。同一份反覆 REV 代表當初的切法不對——問「這三次 REV 動的是不是同一個東西」,是的話那個東西該重切 feature。
2. **改動半徑最大的是哪一份**:被最多文檔引用的那一份。它被引用的 step 每一次 REV 都要連動引用它的每一份,值得問「它是不是承擔了太多不相干的事」。
3. **一個 step 是不是只住一份**(`features.md`「編號與引用」):`lint sig` 報的同名未註明 → 兩份各寫了一次,後做的那一份該改成引用,`dev-flow:scope-laws <它的全名>`;沒有任何里程碑綁、也沒有任何文檔引用的 feature → 問開發者要不要退役。
4. **卡多久了**:open 的 GAP、`status` 列成建構中的 `build/` 分支各走到哪一步、停了多久(分支最後一個 commit 距今多久)。卡著的 GAP 擋著整份文檔達成;切片完成卻一直沒有進 scope-laws 的分支,是一片沒有人認領的程式碼。

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

一張表:哪裡 / 什麼事 / 怎麼辦,怎麼辦欄寫具體命令(`dev-flow:scope-laws F-00x-<slug>`、`dev-flow:scope-revise F-00x-<slug>`、`dev-flow:require-design`、`dev-flow:global-laws`、`devflow sync`)。每列先答 `tooling.md`「收尾定錨」下一步的四題:答得出必要性(不做它哪條需求停在哪條里程碑、哪條功能無法正常運作)的列成「必要」,答不出的列成「提議」,兩段分開;架構級的列要寫出現在的架構解決不了的那個具體問題。前面加四句話的結論:對帳幾條紅、最高優先的需求差什麼、最不穩的是哪裡、安全上最值得動的是哪一條。必要段是空的,結論第一句明寫「目前功能全部正常運作,可以加新功能」。

## 收尾

定錨區塊(`tooling.md`「收尾定錨」)。

## 邊界

只有 `sync` 與 `modules --gen` 可以直接做;文檔的契約(簽名、scope law)照一句話分流:要調整(修改、放寬、替換、刪除)既有的 law 走 `dev-flow:scope-laws`,law 不動、或只新增 law,而文檔或實作要變走 `dev-flow:scope-revise`,重複的 step 改成引用與文檔退役走 `dev-flow:scope-laws`;全域 Law(領域不變量、層、對外 I/O)走 `dev-flow:global-laws`,需求、驗收與里程碑一律走 `dev-flow:require-design`,願景走 `dev-flow:kickoff`;不寫測試、不寫實作、不自己補 law。
