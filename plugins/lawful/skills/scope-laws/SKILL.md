---
name: scope-laws
description: lawful(有 .lawful/ 的 Haskell 專案)談與調整 Scope Law 的地方。切片做完後根據決策紀錄把約束逐條談成 law,並列出全域 Law 的候選;既有的 law 要修改、放寬、替換、刪除只在這裡,一手做到 verified,含刪 stage、重複的 stage 改成引用、文檔退役。觸發詞:談約束、談 Law、切片做完、寫 pipeline 文檔、改既有的 law、放寬 law、刪 stage、文檔退役。Use when a finished slice needs its laws discussed, an existing law must be changed or removed, or a pipeline is retired.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:scope-laws — 談 Scope Law，調整既有的 law

> **範圍**：**scope law**——住在一條 pipeline 的「Laws」節、只約束那一條的 law——第一次在這裡談出來；之後任何一條**既有的 law 要調整**（修改、放寬、替換、刪除），也只在這裡，而且那一件修訂連帶要改的簽名、型別、模組、層、Examples、新增的 law 與實作方向都由這裡一手做到 `verified`。刪 stage、兩條 pipeline 重複的 stage 留一份而另一條改成引用、文檔退役，都是刪既有的 law，也在這裡。既有的 law 一條都不動（或只新增 law）、只改既有 `verified` pipeline 的簽名、型別、模組、層或實作 → `lawful:scope-revise`。一件修訂從頭到尾只有一個修訂類的 skill 在跑，跑到 `verified` 為止。全域 Law 是從切片裡抽上去的：這一片談出來、整個專案都該守的，在這裡列成給 `lawful:global-laws` 的**候選**，開發者逐條說要不要，落筆是它的事；這裡只直接寫這一片在對外 I/O 表的新列，不修改、不放寬任何一條既有的全域 Law。一條 scope law 不必指得出它滿足哪條需求：pipeline 經由里程碑的綁定欄朝向需求，law 不朝向需求。
>
> **核心**：A Law MUST be falsifiable and MUST be the developer's decision; it never describes what the code happens to do, and an existing Law changes only after the developer has seen its full impact and chosen among options.（每條 law 都講得出怎樣算違反，而且是開發者拍板的承諾；把程式碼現在做的事念一遍不是 law。既有的 law 要改，開發者先看過完整的影響範圍、在選項裡選了，才落筆。）步驟與這一句衝突時，這一句贏：停下，回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-laws --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-laws --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-laws --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-laws --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-laws --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-laws --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段（一份輸出切成幾段，每段一道指令；沒有內容的那幾道是空的）是載入 skill 時跑 `lawful brief scope-laws` 的輸出：規章、分支與工作樹、`Cone.md` 全份、決策紀錄全份。目標是里程碑時另有 `.lawful/` 的樹、這條里程碑所在的需求檔全文（一句話、驗收、里程碑表）、`modules.md`、已經綁上的 pipeline 全文與逐條狀態、types 層每個模組的匯出；目標是一條既有的 pipeline 時另有那條 pipeline 全文、逐條狀態、Stages 上每條簽名與型別的宣告、它引用的 pipeline 的 Stages 表與引用它的那幾列和 law、它朝向哪條里程碑（連同需求檔全文）、`gaps.md`、`lint sig` 與 `lint laws` 裡講到它的、status 報告裡講到它的每一行（影響範圍從這幾塊攤）。開工要讀的規章與專案現況都在這裡，不再另外讀。名詞表不在 brief 裡：它住專案根目錄 `CLAUDE.md` 的「## 名詞」節，`CLAUDE.md` 每一場 session 都已經載入。切片的程式碼照決策紀錄「Touched」列的模組自己讀，一輪讀完。

目標：里程碑全名 `M-n-<slug>`（切片剛做完），或既有的 law 要調整、要刪 stage、要退役的那條 pipeline 的全名。參數裡全名後面還有一段話（`lawful:scope-revise` 放棄時替開發者寫好的那一行，或開發者自己寫的）→ 那一段就是這次修訂的來源與原因：原本要做什麼、哪一條既有的 law 為什麼非調整不可、連帶要改的簽名、型別、模組有哪些；照它開工，不必再問一次。上面寫「目標未指定」就先定出目標，再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief scope-laws <目標> --no-rules`；同一場裡目標 pipeline 或專案現況變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出，自己跑一次（不加 `--no-rules`）。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 情形 | 輸入 | 產出 |
|---|---|---|
| **切片剛做完**（主場景） | 里程碑全名 `M-n-<slug>`（它的 `build/` 工作樹上有一條 `verdict: feasible` 的切片與它的決策紀錄），或這條里程碑底下一條還是 `draft` 的 pipeline 全名 | 一條或幾條 `ready` 的 `pipelines/P-00x-<slug>.md`（`kind: io` 或 `kind: subflow`），綁在這條里程碑上；四項討論的結論（寫成 law、記進「決定」、寫成對外 I/O 表的新列、或列成給 `lawful:global-laws` 的候選）；全域的候選清單；決策紀錄「Verification」的「首跑該紅」；然後有候選先接上 `lawful:global-laws`、它落筆完再接 `lawful:build`，沒有候選直接接上 `lawful:build` |
| **既有 pipeline 的 law 要調整** | 一條已經拍板過的 pipeline 全名（含 `verified`），加上來源：開發者要修改、放寬、替換或刪除一條既有的 law，要刪一個有 law 的 stage，回答一條答案要調整既有 law 的 GAP（含整合仲裁留下的、整合時「重複的 stage 留哪一份」留下的），要調整既有的 law 才做得到的里程碑 `M-n-<slug>`（靠修訂這條 pipeline達成的那一種），或 `lawful:scope-revise` 放棄之後整件轉過來的修訂（連同它原本打算改的簽名、型別、實作，與它攤過的影響範圍） | 改過的原檔、**一條**裝下整件修訂的 REV（調整的 law、連帶的簽名、型別、模組、層、Examples、新增的 law）、連動的 pipeline、同步改過的宣告；然後接上 `lawful:build`，只重做 REV 點名的，收尾時 pipeline 回到 `verified` |
| **文檔退役** | 一條用不到的 pipeline 全名（一次性的存檔搬遷跑完了、功能下架），加上開發者講的為什麼 | 刪掉的 pipeline 文檔、它的測試模組與程式碼；里程碑的綁定欄與 `Cone.md` 的對外 I/O 表拿掉它；別條還在用的 stage 連同 law 先搬到還活著的那一條；決策紀錄記為什麼退役，交給 `lawful:integrate` 寫成 ADR |

## 前置

一句話分流（`pipelines.md`「修訂 (REV)」）：**要調整（修改、放寬、替換、刪除）既有的 law → 這裡；law 不動、或只新增 law，而文檔或實作要變 → `lawful:scope-revise`；全域 Law → `lawful:global-laws`；需求面的條目（需求、驗收、優先、里程碑）→ `lawful:require-design`。** 一件修訂從頭到尾只有一個修訂類的 skill 在跑，跑到 `verified` 為止。

- 目標是一條 `verified` 的 pipeline，而這次**既有的 law 一條都不動**（簽名或型別要改、加 stage、stage 跨層搬家、層的歸屬修正、`=` 列搬到別的模組單元、Brief / 決定 / 描述要改、靠修訂達成的里程碑而既有的 law 不必動、bug、只要新增一條保護用的或新上界的 law、答案不必調整既有 law 的 GAP）→ 走 `lawful:scope-revise`，新增的 law 它自己談。stage 只是在同一層內搬模組 → 不是修訂，`lawful sync`。
- **刪 stage**：刪掉一個有 law 的 stage 等於刪既有的 law，整件在這裡做（情形二）。**兩條 pipeline 重複的 stage**（兩條切片平行開工各寫了一份，整合時選了一份留著）：目標是要改成引用的那一條——刪掉自己的那個 stage 與它的 law，Stages 表那一列改成模組欄註明「見 <留著的那一條的全名>」，law 不搬、不複製（`pipelines.md`「編號與引用」）；照情形二做，REV 的「連動」欄寫留著的那一條。
- **文檔退役**：一條 pipeline 用不到了 → 目標是它的全名，走情形三（`pipelines.md`「修訂 (REV)」）。
- 要加的是一個**可以獨立拿掉的新能力** → 那是新的里程碑與切片，走 `lawful:require-design` 再 `lawful:spike-impl`。
- **切片剛做完**：工作目錄是這條里程碑的工作樹 `../<repo>.worktrees/M-n-<slug>`；決策紀錄在、`verdict: feasible`。沒有切片 → `lawful:spike-impl`。先把主線合進來一次：`git fetch` 後 `git merge origin/<主線>`。約束對著最新的全域 Law 談；合不進來的衝突先解，解不了就停下回報。
- **既有 pipeline 的 law 要調整**：
  - 來源是一條靠修訂這條 pipeline 達成的里程碑 `M-n-<slug>`（`pipelines.md`「願景、需求與里程碑」）：這裡只收要調整既有的 law 才做得到的，整件都在這裡做；既有的 law 一條都不必動的（新的承諾用新增的 law 表達），走 `lawful:scope-revise`。它要是所在需求下一條還沒達成的里程碑、它的綁定欄要有這條 pipeline（`status` 顯示它「待修訂」）；不是就停，回 `lawful:require-design`——綁定欄由它當場填，這裡不碰那一欄。就在它的 `build/M-n-<slug>` 工作樹上做（還沒有就照 `roles.md`「分支」從主線開），REV 的依欄寫里程碑的全名 `M-n-<slug>` 與它那一句：`lawful status` 靠這條 REV 判這條里程碑達成了沒。一條里程碑綁了好幾條既有的 pipeline 時，每一條各一次修訂、各自接上 build。要的是一個可以獨立拿掉的新能力，不是修訂，是做出新 pipeline 的里程碑。
  - 目標 pipeline 還不是 `verified`（切片那一波的 `draft` / `ready`:Law 談到一半、qa 或 refactor 開了 GAP、整合的仲裁退回來）→ 那一波的簽名、型別與 law 都在這裡改，law 動不動都一樣。
  - 一律改原檔。**不開第二份檔**：開了，原檔就停在它被寫下的那一天，三個月後沒有人知道它現在長什麼樣。
  - **在哪做**（`roles.md`「分支」）：這條 pipeline 還在一條沒整合的 `build/` 分支上 → 就在那棵工作樹上做。pipeline 已在主線上 → 在主線、與 origin 同步、工作樹乾淨時 `git worktree add -b build/<全名> ../<repo>.worktrees/<全名> HEAD`，在那棵樹上做。`lawful:scope-revise` 放棄之後轉過來的，就在它開的那棵樹上做：先確認它已經還原（pipeline 是 `verified`、與它開工時的 HEAD 沒有差異），沒有還原乾淨就停下回報。

## 步驟

### 情形一：切片剛做完

**根據切片的決策紀錄談**：每一題的材料都從決策紀錄的六節與跑起來的行為來，不憑讀程式碼想像、不問抽象的性質。這是這條 pipeline 第一次談約束，談得越完整，之後的修訂越少。

1. **把切片跑起來**：決策紀錄「Entry」那道指令，親眼看一次行為；之後問開發者的每個例子都從這裡跑出來（或在 REPL 裡對純的整條求值）。
2. **切文檔**：這一片裡有幾段「input → 純轉換 → output」的資料流，就是幾條 pipeline：兩端碰 shell 的是 `kind: io`，只在純核心裡、被別條當一步用的是 `kind: subflow`；別條也會用到的那一段拆成一條 subflow（`pipelines.md`「pipeline」）。跟開發者確認切法，每一條 `lawful claim <slug> --description <句> --kind <io | subflow> --milestone <M-n-slug>`（綁定寫進這條里程碑所在的需求檔）；slug 是 `<領域名詞>-<動詞>`，領域名詞是 `=` 列住的模組單元，對不到模組表的單元 claim 會停（`pipelines.md`「編號與引用」）。切片可以大，文檔不跟著變大。以下每一條各做一次，被引用的 subflow 先做。
3. **Brief 與對外的兩端**：一句意圖、input、output、流向、它是 io pipeline 還是哪幾條 pipeline 引用的 subflow、它讓這條里程碑那一句話的哪一部分看得到；從哪個對外入口進來、哪個出口出去，照決策紀錄「Touched」寫。對外 I/O 表的列在第 5 步「外部串接方法」那一項寫。
4. **Stages 抄程式碼**：資料流上的每一步一列，簽名逐字抄程式碼裡匯出的那一行（`pipelines.md`「簽名怎麼寫」）；模組欄是實際的模組，層欄是它住的那棵原始碼樹，與模組表上那個單元宣告的層一致。補 `=` 列（純的整條，住 core 或 effect）與 io pipeline 的 `!` 列（進入點，住 shell）。
   - stage 之間傳遞的值要是有名字的型別；切片裡用了無名容器（`Value`、`Dynamic` …）的地方，現在與開發者定型別，把宣告改到位、編得過。
   - 切片沒有把純的部分組成一個值（`=` 列對不到一個函數）→ 現在抽出來並匯出：那是宣告的事，歸這一側；行為不動。
   - **名詞表的「型別」欄**（`pipelines.md`「`.lawful/`」）：這一片讓專案根目錄 `CLAUDE.md`「## 名詞」節上某個名詞第一次有了型別（那一列的「型別」欄還是 `-`，而這一片的程式碼宣告了對應它的型別）→ 與開發者確認是哪一個型別，把型別名填進那一列的「型別」欄。這是這裡唯一可以動 `CLAUDE.md` 的地方：不加列、不改名詞與定義，「## 名詞」節以外的內容一個字都不准動。
   - 用得到別條 pipeline 已經有的 stage（這一片直接呼叫了既有的程式碼）→ 簽名照抄，模組欄註明「見 <那條 pipeline 的全名>」；它的 law 住那一條，這裡不重寫、不複製，那一條屬於哪條需求都一樣（`pipelines.md`「編號與引用」）。
   - stage 與觀察點都要在匯出清單裡；只為 law 觀察而匯出的住 `*.Internal`（`boundary.md`「測試與邊界」）。
5. **四項逐項問到**（`laws.md`「Law 怎麼談」）：每一項先從決策紀錄的「Decisions」「Assumptions & Invariants」「Faked / Unverified」「Touched」找出這一片實際怎麼做的，講給開發者聽，再問他要的是什麼；這一片碰不到的那一項，也要問過才寫「無」。

   | 項 | 逐題問 |
   |---|---|
   | **資料交互** | 這一片與別條 pipeline、別的模組單元之間交換什麼資料？誰是來源、誰只是讀？格式是 types 層哪個有名字的型別？驗證（smart constructor、解析）在哪一個 stage 做，下游可以假設什麼？ |
   | **資料儲存在哪** | 狀態住記憶體裡的值、檔案還是外部服務？哪一個效果描述寫它、哪一個只讀？兩處都存的以誰為準？寫到一半失敗、資料遺失時怎麼辦？純解譯器拿什麼當它的替身？ |
   | **外部串接方法** | 碰哪個外部系統、走什麼協定？它寫成哪個效果 ADT、真解譯器住 shell 的哪個模組？失敗、重試、逾時各怎麼處理？重送會不會做兩次？回來的內容信任誰、在哪個 stage 驗證？ |
   | **軟體架構** | 這一片的 stage 各住哪個模組單元的哪一層、依賴方向對不對？效果的描述集中在哪幾個 stage、`=` 列是不是純的？這一片用到的 stage 有沒有已經住在別條 pipeline 的——有就引用，不重寫。別條也會用到的那一段要不要拆成一條 subflow？四層「裝什麼」那一句還有哪一層空著 → 見下面「四層」那一條。 |

   每一項談出來的結論，當場分到它的去處：
   - 這條 pipeline 要一直守的事、講得出一個讓它變假的實作 → 下一步的候選 law。
   - 只關這條 pipeline 的取捨（為什麼存這裡、為什麼這樣接）→ 這條的「決定」。
   - **這一片跨過 shell 的那幾端**（「外部串接方法」談出來的：入口、出口、碰的外部系統）→ 寫成 `Cone.md`「契約：對外 I/O」表的**新列**（`boundary.md`「對外 I/O」）：名稱、方向、型別或效果 ADT、shell 模組、進入哪條 pipeline；這一端對外面承諾什麼、回來的內容在哪個 stage 驗證，當場與開發者講定，契約欄在第 8 步填守它的 law。這一片的新列由這裡直接寫，不經 `lawful:global-laws`。
   - **四層**（「軟體架構」談出來的）：四層與它們的規則是固定的，不談；`### 架構:四層` 那四行裡「裝什麼」那一句還空著的層 → 對著這一片實際放進那一層的東西（決策紀錄「Decisions」記的放法、「Touched」的模組）與開發者把那一句講定，列成給 `lawful:global-laws` 的**候選**。那四行不在這裡寫。
   - **要改既有的全域 Law**——對外 I/O 表既有的列（某一端的契約要換）、已經寫了的那幾句「裝什麼」、既有的領域不變量 → **不在這裡改**；列成給 `lawful:global-laws` 的候選（哪一條、為什麼、這一片的哪個決定逼出來的），開發者說要才帶過去。
   - 這一片用到、已經住在別條 pipeline 的 stage → 這條的 Stages 表引用它，law 不重寫；要對它多一條承諾，記在回報裡當成那一條的修訂，不寫進這條。
   - 別條也會用到的那一段要拆 → 回第 2 步多 claim 一條 `kind: subflow` 的 pipeline，那幾個 stage 與它們的 law 住那一條，這條引用。
6. **談 Law**（`laws.md`「Law 怎麼談」），一次一條：
   - 候選從四個方向列：第 5 步四項談出來的結論；這條里程碑那一句話要展示得出來、它的需求的驗收要過，往下推；碰得到的全域 Law 在這一條長什麼樣；決策紀錄「Assumptions & Invariants」與「Faked / Unverified」往上撈（來源是「順手」的優先問）。再對每個 stage 過「什麼要有 law」兩問、拿種類表逐種問。來源只是找候選的方向，收不收看開發者要不要這個承諾。
   - 每條照 `laws.md`「Law 怎麼談」的格式問：背景、行為、切片跑出來的具體例子三段，接著三個選項「對，以後都應該要這樣」「不對，應該是 ___」「不在乎」；問的時候不配 law 編號。
   - 對 → 寫成純 ASCII 三行的 law。不對 → 寫成 law（講開發者填的那一句），它的全名記進決策紀錄「Verification」的「首跑該紅」。不在乎 → 不寫、不測。
   - 每條 law 講出一個讓它變假的實作；講不出來就是在描述程式碼，不收。
   - law 的第一句用到的領域名詞，照 `CLAUDE.md`「## 名詞」節上的寫法。談的過程冒出表上沒有的名詞 → 不在 law 或 Brief 裡另外定義它；記在回報裡，列成給 `lawful:require-design` 的下一步（與開發者講定、寫進表）。
   - 三行寫不出來 = 少一個觀察點：補 `o` 列並在程式碼裡匯出它。`=` 列是效果描述時，觀察點是它的純解譯器（`boundary.md`「效果的判定」），law 拿純解譯器的結果寫。`=` 列至少一條端到端的 law。
   - 答「不對」而現有的型別裝不下 → 當場與開發者定型別要多什麼，改宣告、編得過；行為留給 refactor。
7. **全域的候選**（`laws.md`「全域 Law」）：這一片的 law 談完之後多問一輪——把剛談定的 law 逐條念給開發者，問「這幾條裡，哪幾條整個專案都該守」。開發者點到的、與你認為該提的，每一條照准入判準判：
   - 它只講 types 層的型別與匯出嗎？三行改成只用 types 層的匯出與型別名之後還講得通，才算；非提這一條的 Stages 簽名不可的，它就是這一條的 scope law。
   - 別條 pipeline 違反得了它嗎？只有這一條碰得到的，留在這一條。
   - 驗一次就蓋住全部嗎？寫得成一條 `INV-n#LAW` 的 property test，才算。

   三題都過的列成**領域不變量的候選**，每條寫：law 的原句、出處（這條 pipeline 的全名與 law 編號，如 `P-001-save-write#LAW-3`）、三行改成只用 types 層的匯出與型別名之後的樣子。**開發者逐條說要不要，不整批追認**；說不要的就是這一條的 scope law，不再提。第 5 步列的四層的候選、要改既有全域 Law 的候選，收進同一份清單。候選在這裡**不落筆**：那條 law 照樣留在這條 pipeline 的 Laws 節、照樣拍板，`lawful:global-laws` 落筆時才從這裡搬走。一條候選都沒有就寫「無」。
8. **寫成三行，不改那一句話**（`roles.md`「誰能動什麼」的例外）：這條里程碑的需求的驗收還只有一句話，而這一片讓它講得到的簽名出現了 → 與開發者把它寫成三行（識別字是 Stages 的簽名，不含 `!` 列）。那一句話本身不改；寫了三行，build 會派 qa 寫它的驗收測試。只把既有的那一句寫成三行，不新增、不改句子、不放寬。對外 I/O 表的契約欄填守這一端的那條 law。
9. **Examples**：3–5 個具體輸入輸出，從第 1 步跑出來的真實例子挑，覆蓋邊界（空的、單一、極值、失敗路徑），每列指到它覆蓋的 law。開發者答「不對」的，example 寫的是開發者填的那個輸出，不是現在的輸出。**不准出現真的密碼、金鑰或 token。**
10. **決定**：決策紀錄「Decisions」裡只關這一條 pipeline 的、與第 5 步談出來只關這一條的取捨，搬進「決定」（一句結論、否決的替代方案、理由）；跨 pipeline 的留在決策紀錄給整合。第 5、6 步開發者推翻了切片的哪一列，先照 `roles.md`「決策紀錄」改寫那一列再搬或留。
11. `lawful lint sig`、`lawful lint laws`、`lawful lint io`、`lawful lint boundary`：都沒有紅，`lawful status --pipeline <全名>` 每列是「在」。把每條 law 念一遍給開發者，**逐條拍板，不整批追認**；拍板了改 `status: ready`，frontmatter 的 `kind` 還是佔位符就填上。文檔、宣告的改動與決策紀錄各自 commit，訊息帶全名。
12. **接上 global-laws 與 build**：這條里程碑綁的每條 pipeline 都 `ready` 之後，不等開發者另外下指令：
    - **有全域的候選**（第 7 步開發者說了要的）→ 先直接執行 `lawful:global-laws M-n-<slug>`，把候選帶過去：領域不變量的候選每條的原句、出處的 pipeline 全名與 law 編號、改寫後的三行；四層的候選（哪一層、「裝什麼」那一句）；要改的既有全域 Law 與原因。它攤影響範圍、開發者批准、落筆（抽上去的 law 從這條 pipeline 的 Laws 節搬走），落筆完由它接上 `lawful:build M-n-<slug>`。
    - **沒有候選** → 直接執行 `lawful:build M-n-<slug>`。

    build 那一波：qa 照 law 寫測試，refactor 把程式碼調到每條 law 成立。還有一條沒談完就先回報停在哪一條。

### 情形二：既有 pipeline 的 law 要調整

文檔先行：先改條文，再改測試與實作（`pipelines.md`「修訂 (REV)」）。一次修訂一條 REV，**整件修訂一手包辦**：調整 law 的同時，這一件連帶要改的 Stages 簽名、型別、模組、層、Examples、新增的 law 與實作方向，都在同一條 REV 裡處理，然後直接接上 build 做到 `verified`。不把其中一部分留給 `lawful:scope-revise`。

1. **拿到來源的原句**：參數裡全名後面的那一段話就是來源與原因（`lawful:scope-revise` 放棄時寫好的那一行：原本要做什麼、哪一條既有的 law 為什麼非調整不可、連帶要改的簽名、型別、模組），照它開工，不必再問開發者一次；沒有那一段才問。其餘的來源：GAP 的提問原句（整合仲裁留下的 GAP，原句含開發者選了哪個選項）、ADR 全名、里程碑的全名 `M-n-<slug>` 與它那一句、開發者的那一句話。REV 的「依」欄要寫它（來源是里程碑的一定寫它的全名，`lawful status` 靠它判這條里程碑達成了沒），不寫已經刪掉的條目編號。
2. **影響範圍**（`laws.md`「影響範圍與選項」）：先查、先列，不准省略一項，查過而沒有的寫「無」。`lawful status --pipeline <全名>`（引用與被引用）、`lawful status`（建構中的分支、需求達成與否）是查的工具：

   | 項 | 列什麼 |
   |---|---|
   | 直接動到 | 哪幾條既有 law 的哪一行變（或整條放寬、替換、刪除）、要新增哪幾條 law；這一件連帶的：哪幾條簽名或型別變、哪幾個 stage 加、刪、換模組或換層、哪幾個 example 變 |
   | 引用同一處的 law | 同一條 pipeline 裡引用同一個 stage 或觀察點的每一條 law；對外 I/O 表契約欄指到動到的 law 的每一列 |
   | 連動的文檔 | Stages 表引用到動到的 stage 或簽名的每一條 pipeline（模組欄註明「見」這一條的）；刪 stage 時是引用它的每一條 |
   | 測試 | 要重寫的（歸屬全名）、要重跑的、確定不受影響的 |
   | 狀態 | 哪幾條 `verified` 要重開；哪幾條建構中的 build 分支要重驗 |
   | 需求 | 哪幾條需求的驗收引用到動到的 law；改完之後它還達不達成 |

3. **給選項，等開發者選**：至少兩個，其中一個一定是「不改」。每個選項寫：改什麼、影響範圍裡哪幾項因此不同、當下成本、之後的代價、可不可逆；放寬與刪除的選項，代價那一格寫明之後哪些行為沒有 law 擋著；你給傾向與理由。**一次一條 law**，開發者對著那一個選項明確說了要，才往下；沉默、整批同意、「你決定」都不算。來源的 GAP 已經記著開發者選定的選項時，仍把影響範圍攤出來請開發者確認一次：仲裁當下看到的是反例，不是全部的牽連。
4. **`verified` 先重開**：`status` 改回 `ready`，在「決定」記一條「重開：<為什麼>」。
5. **先補保護**：這次不准變的既有行為若還不是 law，**先補成 `LAW-n` 再改**。沒有 law 守著的「行為不變」等於沒有保護。來源是里程碑的，保護一定含需求的驗收引用到的每條 law：修訂不准讓需求退回未達成。
6. **改條文**，整件一次改完：調整的那幾條 law；這一件連帶要改的 Stages 簽名、型別、模組欄與層欄、加或刪的 stage、Examples、Brief 與「決定」。簽名或型別改了名，別條 law 三行裡的識別字跟著換是機械同步，意思不變，REV 註明。新的 law 照 `laws.md`「Law 怎麼談」的判準：講得出一個讓它變假的實作；開發者原本不在乎、現在要承諾的行為，也是在這裡補成 law。新增的 law 碰到資料交互、儲存、外部串接或架構，照情形一第 5 步那一項的題目問過。刪掉的 law 號永久空缺，新增的往下接。效能的承諾把基準線寫進新的 law（「存檔不超過 1 MB，基準線 2026-09-18 量到 3 MB」）。收窄定義域的修訂只動那條 law 的 `forall` / `given`。刪 stage：那一列與掛在它上面的 law 一起刪，引用它的別條 law 照第 2 步列過的逐條處理。重複的 stage 改成引用：那一列留著、簽名照抄、模組欄改成留著的那一條的模組並註明「見 <它的全名>」，掛在它上面的 law 與只覆蓋那幾條 law 的 example 刪掉；REV 的重委派寫 qa（刪掉守那幾條 law 的測試）與 refactor（刪掉自己那一份實作，改呼叫留著的那一份）。
7. **寫 REV**：`## 修訂記錄` 加**一條**，裝下整件修訂，五欄齊全（依 / 動到 / 保護 / 重委派 / 連動）；動到欄列調整的與新增的 law、連帶的簽名、型別、stage、模組與 example；依欄連同選了哪個選項，否決的選項與理由寫進「決定」。law 變了重派 qa，行為、簽名或型別變了重派 refactor。`updated` 改成今天。
8. **連動**：影響範圍「連動的文檔」列到的每一條，逐條同步並寫進「連動」欄；`verified` 的先重開、各記一條 REV。**責任在改的人**：簽名改了編譯器會告訴下游，語意改了什麼都不會抓。
9. **結案 GAP**：寫 REV 的同一個動作把條目**整條刪掉**，不留 resolved。`gaps.md` 空了刪檔。
10. **宣告跟著**（`roles.md`「首跑」）：
    - 簽名或型別變了就同步改程式碼裡的宣告與匯出清單，呼叫端一起改到編得過，行為不動。
    - 修訂新增的 stage 在模組欄指的模組裡宣告並匯出，本體是未實作標記 `error "P-00x#name not implemented"`，**不得回傳假值**。
    - 層變了，檔搬到那一層的原始碼樹；模組單元沒宣告那一層就 `lawful module <單元> --layers <新的層>`（`boundary.md`「模組表」），改到 `lawful lint boundary` 沒有紅。

    跑建置指令，`lawful lint all`（整套的紅只該落在 REV「動到」欄點名的 law 上）。文檔與宣告同一個 commit，訊息帶全名。
11. **接上 build**：直接執行 `lawful:build <全名>`，只重做 REV「重委派」欄點名的：qa 改那幾條測試，首跑時「動到」欄的 law 要紅、「保護」欄的要綠，再派 refactor 照 REV 把實作做到位。**收尾時每條 law 成立、build 把 pipeline 改回 `verified`，這一件修訂才算做完**；停在 GAP 就回報停在哪裡，不把剩下的交給別的修訂類的 skill。

### 情形三：文檔退役

一條 pipeline 用不到了（`pipelines.md`「修訂 (REV)」）。退役刪掉它的每一條 law，所以照調整既有 law 的紀律：先攤影響範圍，開發者確認了才動。

1. **拿到為什麼**：開發者的那一句話（存檔搬遷跑完了、功能下架）。
2. **影響範圍**（`laws.md`「影響範圍與選項」），逐項列，查過而沒有的寫「無」：誰引用它（哪幾條 pipeline 的哪幾個 stage 註明「見」這一條）；哪條里程碑綁它（那條里程碑只綁這一條的，退役之後那一句還成不成立，要不要回 `lawful:require-design` 改）；哪條需求的驗收、哪一列對外 I/O 的契約欄引用它的 law；哪些測試模組與程式碼要一起刪；哪幾條建構中的 build 分支用到它。
3. **給選項，等開發者選**：至少「退役」與「不退役」；還有別條引用它的 stage 時，多一個「搬到哪一條」的選擇——預設是還活著的、用得最多的那一條。開發者對著一個選項明確說了要，才往下；沉默、「你決定」不算。
4. **先搬還有人用的 stage**：別條還引用的那幾個 stage，連同掛在它上面的 law 與 example，搬進選定的那一條（它 `verified` 就先重開；law 與 example 在那一條往下接號，條文一個字不改；記一條 REV，依欄寫「<退役的全名> 退役，接手 <stage 名>」，動到欄列搬進來的 stage、law 與 example，重委派寫 qa：測試的歸屬改成接手那一條的編號）；引用它的各條把「見」改指過去，各記一條 REV。
5. **刪**：刪 pipeline 文檔；從綁它的里程碑的綁定欄與 `Cone.md` 的對外 I/O 表拿掉它（綁定欄空了寫「-」）；它的測試模組與只有它在用的程式碼一起刪，建置設定裡登記它們的那幾行跟著拿掉。模組表不動：單元因此沒有程式碼只是 `lint boundary` 的訊息，要不要拿掉那個單元記在回報裡。編號永久空缺。
6. **驗**：建置、整套測試跑一次、`lawful lint all`：沒有新的紅，沒有幽靈引用。接手 stage 的那一條接上 `lawful:build <它的全名>` 做回 `verified`。
7. **決策紀錄**（`roles.md`「決策紀錄」）：`journal/<退役的全名>.md` 的「Goal / Scope」寫為什麼退役，「Decisions」一列（可逆欄為否、跨文檔欄為是），「Verification」寫第 6 步的結果；commit，訊息帶全名。ADR 由 `lawful:integrate` 寫。

## 收尾

切片剛做完：回報切出幾條 pipeline（各是 `io` 還是 `subflow`）、各幾條 stage、觀察點與 law、四項各談出什麼（哪幾條成了 law、哪幾條進了「決定」、哪一項是「無」）、哪幾條首跑該紅、哪幾件開發者答了不在乎（之後可以自由改的行為）、改了哪些宣告、名詞表哪幾列填了「型別」欄與表上沒有而要交給 `lawful:require-design` 講定的名詞（沒有寫「無」）、這一片在對外 I/O 表寫了哪幾列、**全域的候選**（逐條：領域不變量的候選附原句與出處、四層哪一層的那一句、要改的既有全域 Law 與哪個決定逼出來的；各自開發者要不要；沒有寫「無」）、引用了哪幾條 pipeline 的哪幾個 stage、下一步接的是 `lawful:global-laws M-n-<slug>` 還是 `lawful:build M-n-<slug>`。既有 pipeline 的 law 要調整：回報 REV 第幾條、來源（含參數裡帶進來的那一段原因）、影響範圍六項、開發者選了哪個選項與否決了哪幾個、動到什麼（調整的 law、新增的 law、連帶的簽名、型別、模組、層、example）、保護什麼、要重派誰、連動了哪幾條、對應的里程碑全名（有的話）。文檔退役：回報為什麼退役、影響範圍、開發者選了哪個選項、哪幾個 stage 搬去了哪一條、刪了哪些檔、從哪條里程碑與對外 I/O 表的哪幾列拿掉、整套測試與 `lint all` 的結果。附定錨區塊（`tooling.md`「收尾定錨」）。接上 global-laws 與 build 之後的收尾由它們做；達成後 `lawful:integrate`。

## 邊界

不改本體的行為（要改的由 law 講出來，refactor 去做）；不寫測試；「全域 Law」區只有這一片在對外 I/O 表的新列由這裡寫，其餘不碰：不寫領域不變量、不寫四層那四句、不改對外 I/O 表既有的列，不修改、不放寬任何一條既有的全域 Law——談出來的列成候選，開發者逐條說要不要，`lawful:global-laws` 落筆；不改需求檔的一句話、驗收那一句、優先與里程碑的列（`lawful:require-design`；這裡只把既有的一句話寫成三行、填自己那條里程碑的綁定欄、把退役的 pipeline 從綁定欄拿掉）；專案根目錄的 `CLAUDE.md` 只填「## 名詞」節裡既有列的「型別」欄，不加名詞、不改定義 (`lawful:require-design`)，這一節以外的內容一個字都不准動；一個 stage 已經住在別條 pipeline 就引用，不在這條重寫它的 law；既有的 law 一條都不動的 `verified` pipeline 修訂不在這裡 (`lawful:scope-revise`)；不與它交錯：一件修訂從頭到尾只有一個修訂類的 skill 在跑，收進來的就一手做到 `verified`。`verified` 的檔只經由情形二重開之後才動。一次修訂一條 REV，不順便改別的；沒有影響範圍與選項不落筆；不替開發者決定要不要改、選哪一個——開發者說，你寫。law 不為了讓現在的切片過關而寫鬆：切片是草稿，law 是承諾。
