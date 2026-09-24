---
name: scope-revise
description: lawful(有 .lawful/ 的 Haskell 專案)的 pipeline 修訂,既有的 law 一條都不動。改 verified pipeline 的簽名、型別、模組與層,或做一條靠修訂這條 pipeline 達成的里程碑(效能、大小這類實作品質,或新的承諾);可以新增 law,改完仍是 verified;非調整既有的 law 不可就放棄,整件交給 scope-laws。觸發詞:改簽名、改介面、改型別、搬模組、換層、效能調整、靠修訂達成的里程碑、補保護用的 law。Use when a verified pipeline's signatures, types, modules or code must change while every existing law stays unchanged.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:scope-revise — 既有的 law 不動的修訂

> **範圍**：目標是一條已經 `verified` 的 pipeline，這次要變的是它的簽名、型別、模組、層的歸屬、描述或實作品質。**既有的 law 一條都不修改、不放寬、不替換、不刪除**；可以**新增** law（保護用的、效能或大小的新上界、修訂新增的 stage 的）與新的 example。要調整既有的 law → 整件走 `lawful:scope-laws`；全域 Law → `lawful:global-laws`；需求面的條目 → `lawful:require-design`。一件修訂從頭到尾只有一個修訂類的 skill 在跑，跑到 `verified` 為止。
>
> **核心**：Verified in, verified out — existing Laws never change here; Laws may only be added. If an existing Law must change, abandon this revision, restore what was touched, and hand the whole revision to scope-laws.（進來是 verified，出去也是 verified：既有的 law 在這裡永遠不變，只准新增。非調整既有的 law 不可，就放棄這一次修訂、把動過的還原，整件交給 `lawful:scope-laws`。）步驟與這一句衝突時，這一句贏：停下，回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-revise --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-revise --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-revise --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-revise --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-revise --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-revise --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段（一份輸出切成幾段，每段一道指令；沒有內容的那幾道是空的）是載入 skill 時跑 `lawful brief scope-revise <pipeline 全名>` 的輸出：規章、分支與工作樹、目標 pipeline 全文、逐條狀態、Stages 上每條簽名與型別的宣告、它引用的 pipeline 的 Stages 表與引用它的那幾列和 law、它朝向哪條里程碑（連同需求檔全文）、`modules.md`、`gaps.md`、`lint sig` 與 `lint laws` 裡講到它的、status 報告裡講到它的每一行（影響範圍從這幾塊攤）。開工要讀的規章（含新增 law 時要照的 `laws.md`「Law 怎麼談」與 `pipelines.md`「什麼要有 law」）與專案現況都在這裡，不再另外讀。要動的本體照 Stages 表模組欄列的模組自己讀，一輪讀完。

目標：要修訂的那條 pipeline 的全名 (`P-00x-<slug>`)；不收里程碑。上面寫「目標未指定」就先定出目標，再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-revise <目標> --no-rules`；同一場裡目標 pipeline 或專案現況變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出，自己跑一次（不加 `--no-rules`）。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一條 `verified` 的 pipeline 全名，加上來源：開發者要改簽名、型別、模組或層的歸屬，要加一個 stage，`=` 列要搬到別的模組單元；Brief、決定或「做什麼」欄的描述要改；一條靠修訂這條 pipeline達成的里程碑 `M-n-<slug>`（效能、大小、訊息、演算法這類實作品質，或替既有的功能多一個承諾；新的承諾用新增的 law 表達）；bug（law 在而實作不符，或行為沒有 law 守著）；開發者原本不在乎、現在要承諾的行為；答案不必調整既有 law 的 GAP；`lint sig` 報簽名不一致或跨層搬家而對的是程式碼那一邊 | 改過的原檔（原有的每條 law 意思一個字都沒變、原有 example 的輸入輸出沒變；新增的 law 與 example 往下接號）、一條 REV、連動的 pipeline、同步改過的宣告；然後接上 `lawful:build`，收尾時原有的與新增的每條 law 都綠、pipeline 回到 `verified` |

## 前置

一句話分流（`pipelines.md`「修訂 (REV)」）：**要調整（修改、放寬、替換、刪除）既有的 law → `lawful:scope-laws`；law 不動、或只新增 law，而文檔或實作要變 → 這裡；全域 Law → `lawful:global-laws`；需求面的條目（需求、驗收、優先、里程碑）→ `lawful:require-design`。**

- 目標 pipeline **不是 `verified`**（切片那一波的 `draft` / `ready`）→ 不是這裡的事：約束還在談回 `lawful:scope-laws`，已經 `ready` 回 `lawful:build`。
- 一開始就知道這件事**要調整既有的 law**（改一條 law 的意思、放寬、換掉、刪掉；刪 stage 連帶刪它的 law；既有 example 的輸入輸出要變）→ 整件走 `lawful:scope-laws`，不在這裡開頭。
- stage 只是在同一層內搬模組 → 不是修訂：`lawful sync` 機械更新模組欄，不寫 REV、不重開。
- 要刪一個 stage、把重複的 stage 改成引用、或整條 pipeline 退役 → 都是刪既有的 law，`lawful:scope-laws`。要的是一個**可以獨立拿掉的新能力** → 新的里程碑，`lawful:require-design` 再 `lawful:spike-impl`。
- 修訂要一個還沒有的模組單元 → 先 `lawful:module` 劃出來，再回來。
- 來源是一條靠修訂這條 pipeline 達成的里程碑 `M-n-<slug>`（`pipelines.md`「願景、需求與里程碑」）：它要是所在需求下一條還沒達成的里程碑、它的綁定欄要有這條 pipeline（`status` 顯示它「待修訂」）；不是就停，回 `lawful:require-design`——綁定欄由它當場填，這裡不碰需求檔。就在它的 `build/M-n-<slug>` 工作樹上做（還沒有就照「在哪做」的做法從主線開 `build/M-n-<slug>`），REV 的依欄寫里程碑的全名 `M-n-<slug>` 與它那一句：`lawful status` 靠這條 REV 判這條里程碑達成了沒。里程碑那一句要的新承諾（例如「不超過 1 MB」的上界）用新增的 law 表達；非調整既有的 law 不可就走第 13 步。一條里程碑綁了好幾條既有的 pipeline 時，每一條各一次修訂、各自接上 build。
  - 例（存檔格式換版）：里程碑「拿上一版存的檔在這一版讀出同一個世界」靠修訂 `P-002-save-load` 達成，`lawful:require-design` 切出它的當場就把 `P-002-save-load` 填進綁定欄；「帶著上一版版本號的存檔解得回同一個投影」是這次新增的一條 law，原有的往返 law 不動。對外 I/O 表上存檔那一端的契約要多一句，是給 `lawful:global-laws` 的變更提議，不在這裡寫。
- 一律改原檔，**不開第二份檔**。
- **在哪做**（`roles.md`「分支」）：pipeline 在主線上 → 在主線、與 origin 同步、工作樹乾淨時 `git worktree add -b build/<全名> ../<repo>.worktrees/<全名> HEAD`，在那棵樹上做。一條切片非動到這條 pipeline 的簽名不可而轉過來的 → 就在那條切片的工作樹上做，REV 的連動欄寫明。**開工時工作樹要乾淨，記下 `git rev-parse HEAD`**：放棄時靠它還原。

## 步驟

文檔先行：先改條文，再改宣告，測試與實作交給 build（`pipelines.md`「修訂 (REV)」）。一次修訂一條 REV。

1. **拿到來源的原句**：開發者的那一句話、里程碑的全名 `M-n-<slug>` 與它那一句、GAP 的提問原句與開發者的回答、`lint sig` 的那一行。REV 的「依」欄要寫它（來源是里程碑的一定寫它的全名，`lawful status` 靠它判這條里程碑達成了沒）。
2. **先判既有的 law 動不動**，把這條 pipeline 原有的每一條 law 與 example 過一遍：
   - 改完之後，有沒有哪一條既有 law 的三行除了識別字跟著改名之外還要改？有沒有哪個既有 example 的輸入或輸出要變？有沒有哪一條要放寬、換掉或刪掉才做得到這次要的東西？→ 任何一個「有」= 要調整既有的 law，走第 13 步（此時還沒動任何東西，直接轉交）。
   - 有沒有一段行為這次「不准變」，卻沒有任何一條 law 守著？（沒有 law 守著的行為不是承諾，refactor 可以自由改；開發者要它不變，就得有一條保護用的 law。）→ 有 = 這次要**新增**一條保護用的 law。
   - 這次要做到的品質，開發者要不要它以後一直成立？（「存檔以後一直不超過 1 MB」是一條新的 `bound` law；只是這一次做小一點、量過記下來，不是。）→ 要 = 這次要**新增**一條 law。
   - 這次加的 stage 有沒有自由度（`pipelines.md`「什麼要有 law」兩問）?→ 有 = 這次要**新增**它的 law。
3. **影響範圍**（`laws.md`「影響範圍與選項」的六項），先查、先列，不准省略一項，查過而沒有的寫「無」。`lawful status --pipeline <全名>`（引用與被引用）、`lawful status`（建構中的分支、需求達成與否）是查的工具：

   | 項 | 列什麼 |
   |---|---|
   | 直接動到 | 哪幾條簽名或型別變、加哪個 stage、哪幾個 stage 換模組或換層、`=` 列換不換模組單元（全名照舊）、哪幾個 stage 的實作要調、要**新增**哪幾條 law 與 example；**不得列任何一條既有的 law**——列得出來就走第 13 步 |
   | 引用同一處的 law | 引用到動到的簽名或型別的每一條既有 law 與 example：它們的識別字要機械同步，意思不變；新增的 law 與哪幾條既有 law 講同一個 stage，兩者有沒有矛盾（矛盾 = 要調整既有的 law，走第 13 步） |
   | 連動的文檔 | Stages 表引用到動到的 stage 或簽名的每一條 pipeline（模組欄註明「見」這一條的） |
   | 測試 | 簽名或型別變了而要改呼叫與建構的（歸屬全名，斷言不動）、新增的 law 與 example 要新寫的、要重跑的、確定不受影響的 |
   | 狀態 | 哪幾條 `verified` 要重開（這一條，與簽名跟著變、引用它的 pipeline）；哪幾條建構中的 build 分支要重驗 |
   | 需求 | 這條 pipeline 朝向哪條需求；它的驗收引用到的 law 都在保護欄裡，改完仍要達成 |

4. **開發者確認**：把六項念給開發者，講清楚這次改什麼、不改什麼、要新增哪幾條 law、當下成本與可不可逆（簽名改了，下游都要跟；新增的 law 以後一直要守）；「不改」永遠是一個選項。開發者對著這張表明確說了要，才往下；沉默、「你決定」都不算。
5. **`verified` 重開**：`status` 改回 `ready`，在「決定」記一條「重開：<為什麼>」（來源是里程碑就寫 `M-n-<slug>` 與它那一句）。簽名跟著變、引用這一條的 `verified` pipeline 同樣先重開。
6. **量基準線**（這次要的是效能、大小這類看得到數字的品質）：改之前量一次現況，指令與數字寫進 REV 那一句（「存檔壓縮後不超過 1 MB；基準線 2026-09-18 量到 3 MB」）；要寫成新的上界 law 的，基準線也寫進那條 law 的第一行（「存檔不超過 1 MB，基準線 2026-09-18 量到 3 MB」）。
7. **新增 law**（這次要新增才做；`laws.md`「Law 怎麼談」），與開發者一次一條談定，自己寫進 Laws 節：
   - 保護用的 law：拿現在跑出來的具體例子問「這是你要一直成立的嗎」；要 → 寫成純 ASCII 三行，它現在就成立，**首跑該綠**。先補保護，再改別的。
   - 新的上界、新 stage 的 law：講的是改完之後該成立的事，現在不成立或打到未實作標記，**首跑該紅**。
   - 每條都講得出一個讓它變假的實作，講不出來就不收；三行寫不出來 = 少一個觀察點，補 `o` 列並在程式碼裡匯出它（效果描述的觀察點是它的純解譯器）。
   - 編號往下接，不重用空缺的號；新的 example 指到它覆蓋的 law，**不准出現真的密碼、金鑰或 token**。
   - 開發者逐條拍板，不整批追認。談的過程中冒出全域的事，記成給 `lawful:global-laws` 的變更提議，不在這裡寫。
   - 談到一半發現新增的這一條與某條既有的 law 矛盾、或開發者其實要的是改既有的那一條 → 走第 13 步。
8. **改條文**：
   - 准改：Stages 的簽名欄、模組欄、層欄、「做什麼」欄，加新的 stage 列與 `o` 列；Brief；「決定」（新的取捨、否決的替代方案、理由）；frontmatter 的 `description`；Laws 與 Examples 的**新增**列。
   - **原有的每條 law 意思一個字都不變；原有 example 的輸入輸出不變。** 簽名或型別改了名，law 三行與 Examples 裡的識別字跟著換，是機械同步：只換名字，`forall` 的定義域、`given` 的前提、`|-` 的結論都不動。換完把改前改後逐條對一次，除了名字沒有別的差異。改名的型別若在名詞表（`.lawful/vocabulary.md`）的「型別」欄上，那一欄的名字跟著換（只換這一格，定義不動）。
   - 層的歸屬修正：層欄寫模組實際住的那棵原始碼樹，改到 `lawful lint boundary` 沒有紅（第 11 步搬檔、補層）；四層那四句（`Cone.md`「架構：四層」）是全域 Law，不在這裡動。
9. **寫 REV**：`## 修訂記錄` 加一條，五欄齊全：
   - 依：第 1 步的原句。
   - 動到：**只准是簽名、型別、模組、層、實作，與新增的 `LAW-n`、`EX-n`**；新增的 law 各註明「保護用，首跑該綠」或「首跑該紅」；有機械同步就註明「LAW-n 的識別字隨 `<原名>` → `<新名>` 機械同步，意思不變」。
   - 保護：**這條 pipeline 原有的每一條 law 與每一個 example**，逐條列出還在檔上的編號。
   - 重委派：新增了 law 或 example → qa（寫新的那幾條）；簽名或型別變了 → qa（只把既有測試裡的呼叫與建構改到對得上新的宣告，斷言不動）與 refactor；只有實作要調 → refactor；只改了描述 → 無。
   - 連動：第 10 步同步的每一條。

   `updated` 改成今天。
10. **連動**：影響範圍「連動的文檔」列到的每一條，逐條同步 Stages 表與識別字，各記一條 REV（同樣動到欄沒有既有的 law、保護欄是它原有的每一條），寫進這一條的「連動」欄。**責任在改的人**：簽名改了編譯器會告訴下游，描述改了什麼都不會抓。
11. **結案 GAP 與宣告跟著**：來源是 GAP 的，寫 REV 的同一個動作把條目**整條刪掉**，不留 resolved，`gaps.md` 空了刪檔。宣告（`roles.md`「首跑」）：
    - 簽名或型別變了就同步改程式碼裡的宣告與匯出清單，呼叫端一起改到編得過。
    - 新增的 stage 在模組欄指的模組裡宣告並匯出，本體是未實作標記 `error "P-00x#name not implemented"`，**不得回傳假值**。
    - stage 換模組就把宣告搬到新模組、匯出清單跟著；層變了，檔搬到那一層的原始碼樹，模組單元沒宣告那一層就 `lawful module <單元> --layers <新的層>`（`boundary.md`「模組表」）。
    - **行為不動**，本體的調整留給 refactor。

    跑建置指令、`lawful lint all`：不該有新的紅；`lint laws` 紅 = 機械同步漏了一處，或新增的 law 引用了對不到的識別字。文檔與宣告同一個 commit，訊息帶全名。
12. **接上 build**：直接執行 `lawful:build <全名>`，不等開發者另外下指令，只重做 REV「重委派」欄點名的。這一波的首跑：**原有的每條 law 與 example 都該綠**（來源是「law 在而實作不符」的，只有那一條紅），新增的 law 照「動到」欄註明的綠或紅；原有的別條紅 = 宣告同步時動到了行為，或這次修訂其實動到了既有的 law，停下歸因。refactor 照 REV 那一句調實作，保護欄是護欄。**收尾時原有的與新增的每條 law 都綠，build 把 pipeline 改回 `verified`**；連動而重開的 pipeline 各自接上 build。量過基準線的，收尾時再量一次，數字寫進決策紀錄的「Verification」。
13. **非調整既有的 law 不可 → 放棄，整件轉交**（攤影響範圍時、談新增的 law 時，或 build 做到一半 refactor 回報「這條既有的 law 擋著這次要的品質」、qa 回報「簽名一改這條 law 讀不出唯一解釋」、開發者看了結果要放寬一條）：
    - **停下**，不補救、不把既有的 law 改鬆、不把意思的改變當成機械同步帶過去。
    - **還原這一場改過的東西**，文檔與宣告回到開工時的樣子，不留半套：還沒 commit 的改動 `git restore`（`lawful module` 開的空資料夾一起刪）；已經 commit 的（文檔、宣告、REV、刪掉的 GAP、`lawful module` 改過的檔、qa 與 refactor 在這一波的 commit）逐個 `git revert`，到與開工時記下的那個 HEAD 沒有差異（`git diff <開工時的 HEAD> --stat` 是空的）。pipeline 回到 `verified`。
    - **替開發者把下一道指令寫好，讓他直接貼上**。先用一兩句話講：已經還原了什麼（哪幾個檔、哪幾個 commit、pipeline 回到 `verified`）、為什麼放棄（哪一條既有的 law 非調整不可）。接著單獨一個程式碼區塊，裡面只有這一行：

      ```
      /lawful:scope-laws <全名> <原因>
      ```

      `<原因>` 由你寫完整，不留給開發者填，寫成**一段連續的話、單行**（貼上時整串就是那個 skill 的參數：它的 brief 從這一串裡認出全名當目標，其餘的字就是它開工要看的來源與原因）。全名放最前面；整串會被放進一道 shell 指令的引號裡，所以不寫半形的單引號、雙引號、反引號與 `--` 開頭的字，引用一律用「」。三件事都要在裡面：這次修訂原本要做什麼（來源的原句：里程碑的全名 `M-n-<slug>` 與它那一句、GAP 的提問與回答、或開發者的話）；哪一條既有的 law（`P-00x#LAW-n`，附它現在那一句）為什麼非調整不可——擋在哪裡、要往哪個方向改（修改 / 放寬 / 替換 / 刪除）；這次原本連帶要改的簽名、型別、模組、層有哪些，與談定而還沒落筆的新 law，讓它一手做完。
    - **然後結束**。不是「那一條 law 交過去、做完再回來」：`lawful:scope-laws` 在同一棵工作樹上一手做到 `verified`，這裡不接回來。

## 收尾

回報 REV 第幾條、來源、影響範圍六項、開發者確認的那一句、動到什麼（簽名、型別、模組、層、實作各幾處，機械同步了哪幾條 law 的識別字，全名有沒有換）、新增了哪幾條 law 與 example（各是保護用還是首跑該紅、開發者怎麼拍板的）、保護的 law 與 example 各幾條、要重派誰、連動了哪幾條、對應的里程碑全名（有的話）與基準線的數字、給 `lawful:global-laws` 的變更提議（有的話）。放棄的那一種：回報卡在哪一條既有的 law、還原到哪個 HEAD、`git diff` 是空的，最後是那個只有一行 `/lawful:scope-laws <全名> <原因>` 的程式碼區塊（第 13 步），開發者貼上就接得下去。附定錨區塊（`tooling.md`「收尾定錨」）。接上 build 之後的收尾由 build 做；回到 `verified` 後 `lawful:integrate`。

## 邊界

**不修改、不放寬、不替換、不刪除任何一條既有的 law**，不改既有 example 的輸入輸出，不刪 stage（`lawful:scope-laws`，整件轉交）；新增的 law 不准與既有的矛盾。不動全域 Law 區，四層那四句與對外 I/O 表的契約也不動 (`lawful:global-laws`)；不劃新的模組單元（`lawful:module`；這裡只替既有的單元補修訂要的那一層）；不改需求檔，里程碑的條目與綁定欄都不在這裡寫 (`lawful:require-design`)；不把重複的 stage 改成引用、不退役 pipeline(`lawful:scope-laws`)；不收還沒 `verified` 的 pipeline；同層搬模組不走這裡 (`lawful sync`)。不改本體的行為（refactor 去做）；不寫測試。一次修訂一條 REV，不順便改別的；沒有影響範圍與開發者的確認不落筆；不替開發者決定要不要改、要不要多一條承諾——開發者說，你寫。不與 `lawful:scope-laws` 交錯：一件修訂從頭到尾只有一個修訂類的 skill 在跑。
