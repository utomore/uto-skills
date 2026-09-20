---
name: scope-revise
description: dev-flow(有 .design/ 的專案)的文檔修訂,既有的 law 一條都不動。改 verified 文檔的簽名、型別、模組與層,或落地調整 RF-n 的實作品質;可以新增 law,改完原有的每條 law 仍然綠、文檔仍是 verified;非調整既有的 law 不可就放棄,整件交給 scope-laws。觸發詞:改簽名、改介面、改型別、搬模組、效能調整、RF-n、重構已驗證的文檔、補保護用的 law。Use when a verified document's signatures, types, modules or implementation must change while every existing law stays unchanged.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:scope-revise — 既有的 law 不動的修訂

> **範圍**:目標是一份已經 `verified` 的 feature,這次要變的是它的簽名、型別、模組、層的歸屬、描述或實作品質。**既有的 law 一條都不修改、不放寬、不替換、不刪除**;可以**新增** law(保護用的、效能調整要的新上界、修訂新增的 step 的)與新的 example。要調整既有的 law → 整件走 `dev-flow:scope-laws`;全域 Law → `dev-flow:global-laws`;需求面的條目 → `dev-flow:require-design`。一件修訂從頭到尾只有一個修訂類的 skill 在跑,跑到 `verified` 為止。
>
> **核心**:Verified in, verified out — existing Laws never change here; Laws may only be added. If an existing Law must change, abandon this revision, restore what was touched, and hand the whole revision to scope-laws.(進來是 verified,出去也是 verified:既有的 law 在這裡永遠不變,只准新增。非調整既有的 law 不可,就放棄這一次修訂、把動過的還原,整件交給 `dev-flow:scope-laws`。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief scope-revise --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief scope-revise --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief scope-revise --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief scope-revise --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段(一份輸出切成幾段,每段一道指令)是載入 skill 時跑 `devflow brief scope-revise <文檔全名>` 的輸出:規章、分支與工作樹、目標文檔全文、逐條狀態、Steps 上每條簽名與型別的宣告、它引用的與引用它的文檔全文、它朝向哪條里程碑與哪條調整(連同需求檔全文)、`modules.md`、`gaps.md`、`lint sig` 與 `lint laws` 的結果、status 報告(影響範圍從這幾塊攤)。開工要讀的規章(含新增 law 時要照的 `laws.md`「Law 怎麼談」與 `features.md`「什麼要有 law」)與專案現況都在這裡,不再另外讀。要動的本體照 Steps 表模組欄列的檔自己讀,一輪讀完。

目標:要修訂的那份文檔的全名(`F-00x-<slug>`);不收里程碑。上面寫「目標未指定」就先定出目標,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief scope-revise <目標> --no-rules`;同一場裡目標文檔變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一份 `verified` 的 feature 全名,加上來源:開發者要改簽名、型別、模組或層的歸屬,要加一個 step;Brief、決定或「做什麼」欄的描述要改;一條調整 `RF-n`(效能、大小、訊息、演算法);一條靠修訂這份既有的 feature 達成的里程碑 `M-n-<slug>`(新的承諾用新增的 law 表達);bug(law 在而實作不符,或行為沒有 law 守著);開發者原本不在乎、現在要承諾的行為;答案不必調整既有 law 的 GAP;`lint sig` 報簽名不一致或跨層搬家而對的是程式碼那一邊 | 改過的原檔(原有的每條 law 意思一個字都沒變、原有 example 的輸入輸出沒變;新增的 law 與 example 往下接號)、一條 REV、連動的文檔、同步改過的宣告;然後接上 `dev-flow:build`,收尾時原有的與新增的每條 law 都綠、文檔回到 `verified` |

## 前置

一句話分流(`features.md`「修訂(REV)」):**要調整(修改、放寬、替換、刪除)既有的 law → `dev-flow:scope-laws`;law 不動、或只新增 law,而文檔或實作要變 → 這裡;全域 Law → `dev-flow:global-laws`;需求面的條目 → `dev-flow:require-design`。**

- 目標文檔**不是 `verified`**(切片那一波的 `draft` / `ready`)→ 不是這裡的事:約束還在談回 `dev-flow:scope-laws`,已經 `ready` 回 `dev-flow:build`。
- 一開始就知道這件事**要調整既有的 law**(改一條 law 的意思、放寬、換掉、刪掉;刪 step 連帶刪它的 law;既有 example 的輸入輸出要變)→ 整件走 `dev-flow:scope-laws`,不在這裡開頭。
- step 只是在同一層內搬檔案 → 不是修訂:`devflow sync` 機械更新模組欄,不寫 REV、不重開。
- 要刪一個 step、把重複的 step 改成引用、或整份文檔退役 → 都是刪既有的 law,`dev-flow:scope-laws`。要的是一個**可以獨立拿掉的新能力** → 新的里程碑,`dev-flow:require-design` 再 `dev-flow:spike-impl`。
- 來源是一條靠修訂這份既有的 feature 達成的里程碑 `M-n-<slug>`(`features.md`「願景、需求與里程碑」):它要是所在需求下一條還沒達成的里程碑;就在它的 `build/M-n-<slug>` 工作樹上做(還沒有就照「在哪做」的做法從主線開 `build/M-n-<slug>`),REV 的依欄寫 `M-n-<slug>` 與它那一句,第 5 步重開文檔的同一個動作把這份文檔的全名填進那條里程碑的綁定欄。里程碑那一句要的新承諾用新增的 law 表達;非調整既有的 law 不可就走第 13 步。
- 來源是調整 `RF-n`:那條 `RF-n` 要在某個需求檔的調整表上、動到的 feature 要是它列的、該需求的里程碑要已經全部達成;不是就停,回 `dev-flow:require-design`。調整動到多份 feature 時,每一份各一次修訂。
- 一律改原檔,**不開第二份檔**。
- **在哪做**(`roles.md`「分支與所有權」):文檔在主線上 → 在主線、與 origin 同步、工作樹乾淨時 `git worktree add -b build/<全名> ../<repo>.worktrees/<全名> HEAD`,在那棵樹上做。一條切片非動到這份文檔的簽名不可而轉過來的 → 就在那條切片的工作樹上做,REV 的連動欄寫明。**開工時工作樹要乾淨,記下 `git rev-parse HEAD`**:放棄時靠它還原。

## 步驟

文檔先行:先改條文,再改宣告,測試與實作交給 build(`features.md`「修訂(REV)」)。一次修訂一條 REV。

1. **拿到來源的原句**:開發者的那一句話、`RF-n` 與它那一句、里程碑 `M-n-<slug>` 與它那一句、GAP 的提問原句與開發者的回答、`lint sig` 的那一行。REV 的「依」欄要寫它(調整一定寫 `RF-n`,`devflow status` 靠它算調整的進度)。
2. **先判既有的 law 動不動**,把這份文檔原有的每一條 law 與 example 過一遍:
   - 改完之後,有沒有哪一條既有 law 的三行除了識別字跟著改名之外還要改?有沒有哪個既有 example 的輸入或輸出要變?有沒有哪一條要放寬、換掉或刪掉才做得到這次要的東西?→ 任何一個「有」= 要調整既有的 law,走第 13 步(此時還沒動任何東西,直接轉交)。
   - 有沒有一段行為這次「不准變」,卻沒有任何一條 law 守著?(沒有 law 守著的行為不是承諾,refactor 可以自由改;開發者要它不變,就得有一條保護用的 law。)→ 有 = 這次要**新增**一條保護用的 law。
   - 這次要做到的品質,開發者要不要它以後一直成立?(「以後一直 p95 <= 100」是一條新的 `bound` law;只是這一次做快一點、量過記下來,不是。)→ 要 = 這次要**新增**一條 law。
   - 這次加的 step 有沒有自由度(`features.md`「什麼要有 law」兩問)?→ 有 = 這次要**新增**它的 law。
3. **影響範圍**(`laws.md`「影響範圍與選項」的六項),先查、先列,不准省略一項,查過而沒有的寫「無」。`devflow status --doc <全名>`(引用與被引用)、`devflow status`(建構中的分支、需求達成與否)是查的工具:

   | 項 | 列什麼 |
   |---|---|
   | 直接動到 | 哪幾條簽名或型別變、加哪個 step、哪幾個 step 換模組或換層、哪幾個 step 的實作要調、要**新增**哪幾條 law 與 example;**不得列任何一條既有的 law**——列得出來就走第 13 步 |
   | 引用同一處的 law | 引用到動到的簽名或型別的每一條既有 law 與 example:它們的識別字要機械同步,意思不變;新增的 law 與哪幾條既有 law 講同一個 step,兩者有沒有矛盾(矛盾 = 要調整既有的 law,走第 13 步) |
   | 連動的文檔 | Steps 表引用到動到的 step 或簽名的每一份(模組欄註明「見」這一份的) |
   | 測試 | 簽名或型別變了而要改呼叫與建構的(歸屬全名,斷言不動)、新增的 law 與 example 要新寫的、要重跑的、確定不受影響的 |
   | 狀態 | 哪幾份 `verified` 要重開(這一份,與簽名跟著變、引用它的文檔);哪幾條建構中的 build 分支要重驗 |
   | 需求 | 這份文檔朝向哪條需求;它的驗收引用到的 law 都在保護欄裡,改完仍要達成 |

4. **開發者確認**:把六項念給開發者,講清楚這次改什麼、不改什麼、要新增哪幾條 law、當下成本與可不可逆(簽名改了,下游都要跟;新增的 law 以後一直要守);「不改」永遠是一個選項。開發者對著這張表明確說了要,才往下;沉默、「你決定」都不算。
5. **`verified` 重開**:`status` 改回 `ready`,在「決定」記一條為什麼。簽名跟著變、引用這一份的 `verified` 文檔同樣先重開。來源是里程碑 `M-n-<slug>` 的,同一個動作把這份文檔的全名填進那條里程碑的綁定欄。
6. **量基準線**(來源是效能、大小這類看得到數字的調整):改之前量一次現況,指令與數字寫進 REV 那一句(「結帳一次走完不重算;基準線 2026-09-18 量到 3 次重算」);要寫成新的上界 law 的,基準線也寫進那條 law 的第一行(「p95 <= 100,基準線 2026-09-18 量到 400」)。
7. **新增 law**(這次要新增才做;`laws.md`「Law 怎麼談」),與開發者一次一條談定,自己寫進 Laws 節:
   - 保護用的 law:拿現在跑出來的具體例子問「這是你要一直成立的嗎」;要 → 寫成純 ASCII 三行,它現在就成立,**首跑該綠**。先補保護,再改別的。
   - 新的上界、新 step 的 law:講的是改完之後該成立的事,現在不成立或打到未實作標記,**首跑該紅**。
   - 每條都講得出一個讓它變假的實作,講不出來就不收;三行寫不出來 = 少一個觀察點,補 `o` 列並在程式碼裡匯出它。
   - 編號往下接,不重用空缺的號;新的 example 指到它覆蓋的 law,**不准出現真的密碼、金鑰或 token**。
   - 開發者逐條拍板,不整批追認。談的過程中冒出全域的事,記成給 `dev-flow:global-laws` 的變更提議,不在這裡寫。
   - 談到一半發現新增的這一條與某條既有的 law 矛盾、或開發者其實要的是改既有的那一條 → 走第 13 步。
8. **改條文**:
   - 准改:Steps 的簽名欄、模組欄、層欄、「做什麼」欄,加新的 step 列與 `o` 列;Brief;「決定」(新的取捨、否決的替代方案、理由);frontmatter 的 `description`;Laws 與 Examples 的**新增**列。
   - **原有的每條 law 意思一個字都不變;原有 example 的輸入輸出不變。** 簽名或型別改了名,law 三行與 Examples 裡的識別字跟著換,是機械同步:只換名字,`forall` 的定義域、`given` 的前提、`|-` 的結論都不動。換完把改前改後逐條對一次,除了名字沒有別的差異。
   - 層的歸屬修正:層欄與 `modules.md` 一起改到 `devflow lint boundary` 沒有紅;層表本身(`system.md`「架構:層」)是全域 Law,不在這裡動。
9. **寫 REV**:`## 修訂記錄` 加一條,五欄齊全:
   - 依:第 1 步的原句。
   - 動到:**只准是簽名、型別、模組、層、實作,與新增的 `LAW-n`、`EX-n`**;新增的 law 各註明「保護用,首跑該綠」或「首跑該紅」;有機械同步就註明「LAW-n 的識別字隨 `<原名>` → `<新名>` 機械同步,意思不變」。
   - 保護:**這份文檔原有的每一條 law 與每一個 example**,逐條列出還在檔上的編號。
   - 重委派:新增了 law 或 example → qa(寫新的那幾條);簽名或型別變了 → qa(只把既有測試裡的呼叫與建構改到對得上新的宣告,斷言不動)與 refactor;只有實作要調 → refactor;只改了描述 → 無。
   - 連動:第 10 步同步的每一份。

   `updated` 改成今天。
10. **連動**:影響範圍「連動的文檔」列到的每一份,逐份同步 Steps 表與識別字,各記一條 REV(同樣動到欄沒有既有的 law、保護欄是它原有的每一條),寫進這一條的「連動」欄。**責任在改的人**:簽名改了編譯器會告訴下游,描述改了什麼都不會抓。
11. **結案 GAP 與宣告跟著**:來源是 GAP 的,寫 REV 的同一個動作把條目**整條刪掉**,不留 resolved,`gaps.md` 空了刪檔。簽名或型別變了就同步改程式碼裡的宣告,呼叫端一起改到編得過;step 換模組就把宣告搬到新檔、登記 `modules.md`;新增的 step 在模組欄指的檔案裡宣告並匯出,本體是未實作標記,訊息帶 `F-00x#name`,**不得回傳假值**(`roles.md`「首跑」);**行為不動**,本體的調整留給 refactor。跑建置指令、`devflow lint all`:不該有新的紅;`lint laws` 紅 = 機械同步漏了一處,或新增的 law 引用了對不到的識別字。文檔與宣告同一個 commit,訊息帶全名。
12. **接上 build**:直接執行 `dev-flow:build <全名>`,不等開發者另外下指令,只重做 REV「重委派」欄點名的。這一波的首跑:**原有的每條 law 與 example 都該綠**(來源是「law 在而實作不符」的,只有那一條紅),新增的 law 照「動到」欄註明的綠或紅;原有的別條紅 = 宣告同步時動到了行為,或這次修訂其實動到了既有的 law,停下歸因。refactor 照 REV 那一句調實作,保護欄是護欄。**收尾時原有的與新增的每條 law 都綠,build 把文檔改回 `verified`**;連動而重開的文檔各自接上 build。效能、大小的調整,收尾時再量一次,數字寫進決策紀錄的「Verification」。
13. **非調整既有的 law 不可 → 放棄,整件轉交**(攤影響範圍時、談新增的 law 時,或 build 做到一半 refactor 回報「這條既有的 law 擋著這次要的品質」、qa 回報「簽名一改這條 law 讀不出唯一解釋」、開發者看了結果要放寬一條):
    - **停下**,不補救、不把既有的 law 改鬆、不把意思的改變當成機械同步帶過去。
    - **還原這一場改過的東西**,文檔與宣告回到開工時的樣子,不留半套:還沒 commit 的改動 `git restore`;已經 commit 的(文檔、宣告、REV、刪掉的 GAP、qa 與 refactor 在這一波的 commit)逐個 `git revert`,到與開工時記下的那個 HEAD 沒有差異(`git diff <開工時的 HEAD> --stat` 是空的)。文檔回到 `verified`。
    - **替開發者把下一道指令寫好,讓他直接貼上**。先用一兩句話講:已經還原了什麼(哪幾個檔、哪幾個 commit、文檔回到 `verified`)、為什麼放棄(哪一條既有的 law 非調整不可)。接著單獨一個程式碼區塊,裡面只有這一行:

      ```
      /dev-flow:scope-laws <全名> <原因>
      ```

      `<原因>` 由你寫完整,不留給開發者填,寫成**一段連續的話、單行**(貼上時整串就是那個 skill 的參數:它的 brief 從這一串裡認出全名當目標,其餘的字就是它開工要看的來源與原因)。全名放最前面;整串會被放進一道 shell 指令的引號裡,所以不寫半形的單引號、雙引號、反引號與 `--` 開頭的字,引用一律用「」。三件事都要在裡面:這次修訂原本要做什麼(來源的原句:`RF-n` 與它那一句、GAP 的提問與回答、或開發者的話);哪一條既有的 law(`F-00x#LAW-n`,附它現在那一句)為什麼非調整不可——擋在哪裡、要往哪個方向改(修改 / 放寬 / 替換 / 刪除);這次原本連帶要改的簽名、型別、模組有哪些,與談定而還沒落筆的新 law,讓它一手做完。
    - **然後結束**。不是「那一條 law 交過去、做完再回來」:`dev-flow:scope-laws` 在同一棵工作樹上一手做到 `verified`,這裡不接回來。

## 收尾

回報 REV 第幾條、來源、影響範圍六項、開發者確認的那一句、動到什麼(簽名、型別、模組、層、實作各幾處,機械同步了哪幾條 law 的識別字)、新增了哪幾條 law 與 example(各是保護用還是首跑該紅、開發者怎麼拍板的)、保護的 law 與 example 各幾條、要重派誰、連動了哪幾份、對應的調整(有的話)與基準線的數字、給 `dev-flow:global-laws` 的變更提議(有的話)。放棄的那一種:回報卡在哪一條既有的 law、還原到哪個 HEAD、`git diff` 是空的,最後是那個只有一行 `/dev-flow:scope-laws <全名> <原因>` 的程式碼區塊(第 13 步),開發者貼上就接得下去。附定錨區塊(`tooling.md`「收尾定錨」)。接上 build 之後的收尾由 build 做;回到 `verified` 後 `dev-flow:integrate`。

## 邊界

**不修改、不放寬、不替換、不刪除任何一條既有的 law**,不改既有 example 的輸入輸出,不刪 step(`dev-flow:scope-laws`,整件轉交);新增的 law 不准與既有的矛盾。不動全域 Law 區,層表也不動(`dev-flow:global-laws`);不改需求檔,調整 `RF-n` 的條目也不在這裡加(`dev-flow:require-design`;這裡只在來源是里程碑 `M-n-<slug>` 時填它的綁定欄);不把重複的 step 改成引用、不退役文檔(`dev-flow:scope-laws`);不收還沒 `verified` 的文檔。不改本體的行為(refactor 去做);不寫測試。一次修訂一條 REV,不順便改別的;沒有影響範圍與開發者的確認不落筆;不替開發者決定要不要改、要不要多一條承諾——開發者說,你寫。不與 `dev-flow:scope-laws` 交錯:一件修訂從頭到尾只有一個修訂類的 skill 在跑。
