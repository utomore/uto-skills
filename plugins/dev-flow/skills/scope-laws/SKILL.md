---
name: scope-laws
description: dev-flow(有 .design/ 的專案)談與調整 Scope Law 的地方。切片做完後根據決策紀錄與開發者把文檔寫出來、把約束逐條談成 law(資料交互、儲存、外部串接、架構都問到);既有的 law 要修改、放寬、替換、刪除只在這裡,連帶的簽名與實作一手做到 verified。觸發詞:談約束、談 Law、談承諾、切片做完、寫功能文檔、改既有的 law、放寬 law、刪 law。Use when a finished slice needs its laws discussed, or an existing law must be changed, relaxed, replaced or removed.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:scope-laws — 談 Scope Law,調整既有的 law

> **範圍**:**scope law**——住在一份 feature 或 abstract 的「Laws」節、只約束那一份的 law——第一次在這裡談出來;之後任何一條**既有的 law 要調整**(修改、放寬、替換、刪除),也只在這裡,而且那一件修訂連帶要改的簽名、型別、模組、Examples、新增的 law 與實作方向都由這裡一手做到 `verified`。既有的 law 一條都不動(或只新增 law)、只改既有 `verified` 文檔的簽名、型別、模組或實作 → `dev-flow:scope-revise`。一件修訂從頭到尾只有一個修訂類的 skill 在跑,跑到 `verified` 為止。全域 Law 不在這裡新增、修改或放寬:談到全域的事,列成給 `dev-flow:global-laws` 的變更提議,由開發者決定要不要走。一條 scope law 不必指得出它滿足哪條需求:文檔經由里程碑的綁定欄朝向需求,law 不朝向需求。
>
> **核心**:A Law MUST be falsifiable and MUST be the developer's decision; it never describes what the code happens to do, and an existing Law changes only after the developer has seen its full impact and chosen among options.(每條 law 都講得出怎樣算違反,而且是開發者拍板的承諾;把程式碼現在做的事念一遍不是 law。既有的 law 要改,開發者先看過完整的影響範圍、在選項裡選了,才落筆。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief scope-laws --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief scope-laws --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief scope-laws --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief scope-laws --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段(一份輸出切成幾段,每段一道指令)是載入 skill 時跑 `devflow brief scope-laws` 的輸出:規章、分支與工作樹、`.design/` 的樹、`system.md` 全份、`modules.md`、`gaps.md`。目標是里程碑時另有這條里程碑所在的需求檔全文(一句話、驗收、里程碑表)、決策紀錄全份、已經綁上的文檔;目標是一份既有文檔時另有那份文檔全文、逐條狀態、Steps 上每條簽名與型別的宣告、它引用的與引用它的文檔全文、它朝向哪條里程碑與哪條調整(連同需求檔的一句話與驗收)、`lint global` 的結果與 status 報告(影響範圍從這幾塊攤)。開工要讀的規章與專案現況都在這裡,不再另外讀。切片的程式碼照決策紀錄「Touched」列的檔自己讀,一輪讀完。

目標:里程碑全名 `M-n-<slug>`(切片剛做完),或既有的 law 要調整的那份文檔的全名。參數裡全名後面還有一段話(`dev-flow:scope-revise` 放棄時替開發者寫好的那一行,或開發者自己寫的)→ 那一段就是這次修訂的來源與原因:原本要做什麼、哪一條既有的 law 為什麼非調整不可、連帶要改的簽名、型別、模組有哪些;照它開工,不必再問一次。上面寫「目標未指定」就先定出目標,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief scope-laws <目標> --no-rules`;同一場裡目標文檔變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 情形 | 輸入 | 產出 |
|---|---|---|
| **切片剛做完**(主場景) | 里程碑全名 `M-n-<slug>`(它的 `build/` 工作樹上有一條 `verdict: feasible` 的切片與它的決策紀錄),或這條里程碑底下一份還是 `draft` 的 feature 全名 | 一份或幾份 `ready` 的 `features/F-00x-<slug>.md`,綁在這條里程碑上;四項討論的結論(寫成 law、記進「決定」、或列成給 `dev-flow:global-laws` 的變更提議);決策紀錄「Verification」的「首跑該紅」;然後接上 `dev-flow:build` |
| **既有文檔的 law 要調整** | 一份已經拍板過的 feature 或 abstract 全名(含 `verified`),加上來源:開發者要修改、放寬、替換或刪除一條既有的 law,回答一條答案要調整既有 law 的 GAP(含整合仲裁留下的),要調整既有的 law 才做得到的調整 `RF-n`,或 `dev-flow:scope-revise` 放棄之後整件轉過來的修訂(連同它原本打算改的簽名、型別、實作,與它攤過的影響範圍) | 改過的原檔、**一條**裝下整件修訂的 REV(調整的 law、連帶的簽名、型別、模組、Examples、新增的 law)、連動的文檔、同步改過的宣告;然後接上 `dev-flow:build`,只重做 REV 點名的,收尾時文檔回到 `verified` |

## 前置

一句話分流(`features.md`「修訂(REV)」):**要調整(修改、放寬、替換、刪除)既有的 law → 這裡;law 不動、或只新增 law,而文檔或實作要變 → `dev-flow:scope-revise`;全域 Law → `dev-flow:global-laws`;需求面的條目 → `dev-flow:require-design`。** 一件修訂從頭到尾只有一個修訂類的 skill 在跑,跑到 `verified` 為止。

- 目標是一份 `verified` 的文檔,而這次**既有的 law 一條都不動**(簽名或型別要改、加 step、step 跨層搬家、層的歸屬修正、Brief / 決定 / 描述要改、調整 `RF-n` 的實作品質、bug、只要新增一條保護用的或新上界的 law、答案不必調整既有 law 的 GAP)→ 走 `dev-flow:scope-revise`,新增的 law 它自己談。
- 改的是**兩份以上文檔的共同部分** → 走 `dev-flow:abstract`,它會替每一份寫 REV。
- 要加的是一個**可以獨立拿掉的新能力** → 那是新的里程碑與切片,走 `dev-flow:require-design` 再 `dev-flow:spike-impl`。
- **切片剛做完**:工作目錄是這條里程碑的工作樹 `../<repo>.worktrees/M-n-<slug>`;決策紀錄在、`verdict: feasible`。沒有切片 → `dev-flow:spike-impl`。先把主線合進來一次:`git fetch` 後 `git merge origin/<主線>`。約束對著最新的全域 Law 談;合不進來的衝突先解,解不了就停下回報。
- **既有文檔的 law 要調整**:
  - 來源是調整 `RF-n`:調整預設走 `dev-flow:scope-revise`(需要新的 law 它自己新增);這裡只收要調整既有的 law 才做得到的調整,而且整件都在這裡做。那條 `RF-n` 要在某個需求檔的調整表上、動到的 feature 要是它列的、該需求的里程碑要已經全部達成;不是就停,回 `dev-flow:require-design`。要改簽名或加 step 讓它做到新能力的,不是調整,是新里程碑。
  - 目標文檔還不是 `verified`(切片那一波的 `draft` / `ready`:Law 談到一半、qa 或 refactor 開了 GAP、整合的仲裁退回來)→ 那一波的簽名、型別與 law 都在這裡改,law 動不動都一樣。
  - 一律改原檔。**不開第二份檔**:開了,原檔就停在它被寫下的那一天,三個月後沒有人知道它現在長什麼樣。
  - **在哪做**(`roles.md`「分支與所有權」):這份文檔還在一條沒整合的 `build/` 分支上 → 就在那棵工作樹上做。文檔已在主線上 → 在主線、與 origin 同步、工作樹乾淨時 `git worktree add -b build/<全名> ../<repo>.worktrees/<全名> HEAD`,在那棵樹上做。`dev-flow:scope-revise` 放棄之後轉過來的,就在它開的那棵樹上做:先確認它已經還原(文檔是 `verified`、與它開工時的 HEAD 沒有差異),沒有還原乾淨就停下回報。

## 步驟

### 情形一:切片剛做完

**根據切片的決策紀錄談**:每一題的材料都從決策紀錄的六節與跑起來的行為來,不憑讀程式碼想像、不問抽象的性質。這是這份文檔第一次談約束,談得越完整,之後的修訂越少。

1. **把切片跑起來**:決策紀錄「Entry」那道指令,親眼看一次行為;之後問開發者的每個例子都從這裡跑出來。
2. **切文檔**:這一片裡有幾件「使用者做得到的事」,就是幾份 feature;一份一條資料流,從對外邊界進、從對外邊界出。跟開發者確認切法,每一份 `devflow claim feature <slug> --description <句> --milestone M-n`(綁定寫進這條里程碑所在的需求檔)。切片可以大,文檔不跟著變大(`features.md`「feature 與 abstract」)。以下每一份各做一次。
3. **Brief 與對外的兩端**:一句意圖、input、output、流向、它讓這條里程碑那一句話的哪一部分看得到。決策紀錄「Touched」的入口與出口,邊界與信任在「全域 Law」區已經講定的,補成 `system.md` 對外 I/O 表的列:信任、`untrusted` 入口的驗證 step(`boundary.md`「對外 I/O」)。
4. **Steps 抄程式碼**:資料流上的每一步一列,簽名是程式碼裡對外匯出的那一個,照正規式寫;模組欄是實際的檔案,層欄與模組表一致。補 `=` 列(整條,住內層)與 `!` 列(進入點,住最外層)。
   - step 之間傳遞的值要是有名字的型別;切片裡用了無名容器(`dict`、`any` …)的地方,現在與開發者定型別,把宣告改到位、編得過。
   - 切片沒有把整條組成一次呼叫(`=` 列對不到一個函數)→ 現在抽出來並匯出:那是宣告的事,歸這一側;行為不動。
   - 用得到別份文檔已經有的 step → 模組欄註明「見 A-00x-<slug>」。
5. **四項逐項問到**(`laws.md`「Law 怎麼談」):每一項先從決策紀錄的「Decisions」「Assumptions & Invariants」「Faked / Unverified」「Touched」找出這一片實際怎麼做的,講給開發者聽,再問他要的是什麼;這一片碰不到的那一項,也要問過才寫「無」。

   | 項 | 逐題問 |
   |---|---|
   | **資料交互** | 這一片與別的 feature、abstract、模組之間交換什麼資料?誰是來源、誰只是讀?格式是哪個有名字的型別?驗證在哪一步做,下游可以假設什麼? |
   | **資料儲存在哪** | 狀態住記憶體、檔案、資料庫還是外部服務?誰能寫、誰只能讀?兩處都存的以誰為準?寫到一半失敗、資料遺失時怎麼辦? |
   | **外部串接方法** | 呼叫哪個外部系統、走什麼協定?失敗、重試、逾時各怎麼處理?重送會不會做兩次?回來的內容信任誰、在哪裡驗證? |
   | **軟體架構** | 這一片的 step 各住哪一層、依賴方向對不對?副作用集中在哪幾個 step?有沒有別份文檔也寫了同一段、該抽成 abstract 的共用部分? |

   每一項談出來的結論,當場分到它的去處:
   - 這份文檔要一直守的事、講得出一個讓它變假的實作 → 下一步的候選 law。
   - 只關這份文檔的取捨(為什麼存這裡、為什麼這樣接)→ 這份的「決定」。
   - **碰到全域的**——「全域 Law」區還沒講定的對外邊界(這一片接了一個沒講過的外部系統)或某一端的信任要變、層要變、整個專案都要守的規則 → **不在這裡寫**,也不動「全域 Law」區;記成給 `dev-flow:global-laws` 的變更提議(哪一條、為什麼、這一片的哪個決定逼出來的),收尾時交給開發者決定要不要走。
   - 兩份以上文檔共用的那一段 → 記在回報裡,整合之後走 `dev-flow:abstract`。
6. **談 Law**(`laws.md`「Law 怎麼談」),一次一條:
   - 候選從四個方向列:第 5 步四項談出來的結論;這條里程碑那一句話要展示得出來、它的需求的驗收要過,往下推;碰得到的全域 Law 在這一份長什麼樣;決策紀錄「Assumptions & Invariants」與「Faked / Unverified」往上撈(來源是「順手」的優先問)。再對每個 step 過「什麼要有 law」兩問、拿種類表逐種問。來源只是找候選的方向,收不收看開發者要不要這個承諾。
   - 每條都用切片跑出來的具體例子問:「現在的行為是 …。這是你要的、你不准的、還是你不在乎的?」
   - 要 → 寫成純 ASCII 三行的 law。不准 → 寫成 law(講不准之後該成立的事),它的全名記進決策紀錄「Verification」的「首跑該紅」。不在乎 → 不寫、不測。
   - 每條 law 講出一個讓它變假的實作;講不出來就是在描述程式碼,不收。
   - 三行寫不出來 = 少一個觀察點:補 `o` 列並在程式碼裡匯出它。`=` 列至少一條端到端的 law。
   - 答「不准」而現有的型別裝不下 → 當場與開發者定型別要多什麼,改宣告、編得過;行為留給 refactor。
7. **寫成三行,不改那一句話**(`roles.md`「分支與所有權」的例外):這條里程碑的需求的驗收還只有一句話,而這一片讓它講得到的簽名出現了 → 與開發者把它寫成三行(識別字是 Steps 的簽名,不含 `!` 列);`system.md`「全域 Law」區有一條領域不變量還只有一句話、這一片讓最內層出現了它講得到的型別 → 同樣寫成三行(識別字只用最內層的匯出與型別名)。那一句話本身不改;寫了三行,build 會派 qa 寫它的驗收測試。只把既有的那一句寫成三行,不新增、不改句子、不放寬。對外 I/O 表的契約欄填守這一端的那條 law。
8. **Examples**:3–5 個具體輸入輸出,從第 1 步跑出來的真實例子挑,覆蓋邊界(空的、單一、極值、失敗路徑),每列指到它覆蓋的 law。開發者答「不准」的,example 寫的是該有的輸出,不是現在的輸出。**不准出現真的密碼、金鑰或 token。**
9. **決定**:決策紀錄「Decisions」裡只關這一份文檔的、與第 5 步談出來只關這一份的取捨,搬進「決定」(一句結論、否決的替代方案、理由);跨文檔的留在決策紀錄給整合。
10. `devflow lint sig`、`devflow lint laws`、`devflow lint io`、`devflow lint boundary`:都沒有紅,`devflow status --doc <全名>` 每列是「在」。把每條 law 念一遍給開發者,**逐條拍板,不整批追認**;拍板了改 `status: ready`。文檔、宣告的改動與決策紀錄各自 commit,訊息帶全名。
11. **接上 build**:這條里程碑綁的每份 feature 都 `ready` 之後,直接執行 `dev-flow:build M-n-<slug>`,不等開發者另外下指令:qa 照 law 寫測試,refactor 把程式碼調到每條 law 成立。還有一份沒談完就先回報停在哪一條。

### 情形二:既有文檔的 law 要調整

文檔先行:先改條文,再改測試與實作(`features.md`「修訂(REV)」)。一次修訂一條 REV,**整件修訂一手包辦**:調整 law 的同時,這一件連帶要改的 Steps 簽名、型別、模組、Examples、新增的 law 與實作方向,都在同一條 REV 裡處理,然後直接接上 build 做到 `verified`。不把其中一部分留給 `dev-flow:scope-revise`。

1. **拿到來源的原句**:參數裡全名後面的那一段話就是來源與原因(`dev-flow:scope-revise` 放棄時寫好的那一行:原本要做什麼、哪一條既有的 law 為什麼非調整不可、連帶要改的簽名、型別、模組),照它開工,不必再問開發者一次;沒有那一段才問。其餘的來源:GAP 的提問原句(整合仲裁留下的 GAP,原句含開發者選了哪個選項)、ADR 全名、`RF-n` 與它那一句、開發者的那一句話。REV 的「依」欄要寫它(調整一定寫 `RF-n`,`devflow status` 靠它算調整的進度),不寫已經刪掉的條目編號。
2. **影響範圍**(`laws.md`「影響範圍與選項」):先查、先列,不准省略一項,查過而沒有的寫「無」。`devflow status --doc <全名>`(引用與被引用)、`devflow status`(建構中的分支、需求達成與否)是查的工具:

   | 項 | 列什麼 |
   |---|---|
   | 直接動到 | 哪幾條既有 law 的哪一行變(或整條放寬、替換、刪除)、要新增哪幾條 law;這一件連帶的:哪幾條簽名或型別變、哪幾個 step 加、刪、換模組或換層、哪幾個 example 變 |
   | 引用同一處的 law | 同一份文檔裡引用同一個 step 或觀察點的每一條 law;對外 I/O 表契約欄指到動到的 law 的每一列 |
   | 連動的文檔 | 引用這份 abstract 的每一份消費者、Steps 表引用到動到的簽名的每一份 |
   | 測試 | 要重寫的(歸屬全名)、要重跑的、確定不受影響的 |
   | 狀態 | 哪幾份 `verified` 要重開;哪幾條建構中的 build 分支要重驗 |
   | 需求 | 哪幾條需求的驗收引用到動到的 law;改完之後它還達不達成 |

3. **給選項,等開發者選**:至少兩個,其中一個一定是「不改」。每個選項寫:改什麼、影響範圍裡哪幾項因此不同、當下成本、之後的代價、可不可逆;放寬與刪除的選項,代價那一格寫明之後哪些行為沒有 law 擋著;你給傾向與理由。**一次一條 law**,開發者對著那一個選項明確說了要,才往下;沉默、整批同意、「你決定」都不算。來源的 GAP 已經記著開發者選定的選項時,仍把影響範圍攤出來請開發者確認一次:仲裁當下看到的是反例,不是全部的牽連。
4. **`verified` 先重開**:`status` 改回 `ready`,在「決定」記一條為什麼。
5. **先補保護**:這次不准變的既有行為若還不是 law,**先補成 `LAW-n` 再改**。沒有 law 守著的「行為不變」等於沒有保護。來源是調整的,保護一定含需求的驗收引用到的每條 law:調整不准讓需求退回未達成。
6. **改條文**,整件一次改完:調整的那幾條 law;這一件連帶要改的 Steps 簽名、型別、模組欄與層欄、加或刪的 step、Examples、Brief 與「決定」。簽名或型別改了名,別條 law 三行裡的識別字跟著換是機械同步,意思不變,REV 註明。新的 law 照 `laws.md`「Law 怎麼談」的判準:講得出一個讓它變假的實作;開發者原本不在乎、現在要承諾的行為,也是在這裡補成 law。新增的 law 碰到資料交互、儲存、外部串接或架構,照情形一第 5 步那一項的題目問過。刪掉的 law 號永久空缺,新增的往下接。效能的承諾把基準線寫進新的 law(「p95 <= 100,基準線 2026-09-18 量到 400」)。收窄定義域的修訂只動那條 law 的 `forall` / `given`。
7. **寫 REV**:`## 修訂記錄` 加**一條**,裝下整件修訂,五欄齊全(依 / 動到 / 保護 / 重委派 / 連動);動到欄列調整的與新增的 law、連帶的簽名、型別、step、模組與 example;依欄連同選了哪個選項,否決的選項與理由寫進「決定」。law 變了重派 qa,行為、簽名或型別變了重派 refactor。`updated` 改成今天。
8. **連動**:影響範圍「連動的文檔」列到的每一份,逐份同步並寫進「連動」欄。**責任在改的人**:簽名改了編譯器會告訴下游,語意改了什麼都不會抓。
9. **結案 GAP**:寫 REV 的同一個動作把條目**整條刪掉**,不留 resolved。`gaps.md` 空了刪檔。
10. **宣告跟著**(`roles.md`「首跑」):簽名或型別變了就同步改程式碼裡的宣告,呼叫端一起改到編得過,行為不動;修訂新增的 step 在模組欄指的檔案裡宣告並匯出,本體是未實作標記,訊息帶 `F-00x#name`,**不得回傳假值**。跑建置指令,`devflow lint all`(整套的紅只該落在 REV「動到」欄點名的 law 上)。文檔與宣告同一個 commit,訊息帶全名。
11. **接上 build**:直接執行 `dev-flow:build <全名>`,只重做 REV「重委派」欄點名的:qa 改那幾條測試,首跑時「動到」欄的 law 要紅、「保護」欄的要綠,再派 refactor 照 REV 把實作做到位。**收尾時每條 law 成立、build 把文檔改回 `verified`,這一件修訂才算做完**;停在 GAP 就回報停在哪裡,不把剩下的交給別的修訂類的 skill。

## 收尾

切片剛做完:回報切出幾份 feature、各幾條 step 與 law、四項各談出什麼(哪幾條成了 law、哪幾條進了「決定」、哪一項是「無」)、哪幾條首跑該紅、哪幾件開發者答了不在乎(之後可以自由改的行為)、改了哪些宣告、**給 `dev-flow:global-laws` 的變更提議**(逐條:哪一條全域 Law、為什麼、哪個決定逼出來的;沒有寫「無」)、該收整成 abstract 的共用部分。既有文檔的 law 要調整:回報 REV 第幾條、來源(含參數裡帶進來的那一段原因)、影響範圍六項、開發者選了哪個選項與否決了哪幾個、動到什麼(調整的 law、新增的 law、連帶的簽名、型別、模組、example)、保護什麼、要重派誰、連動了哪幾份、對應的調整(有的話)。附定錨區塊(`tooling.md`「收尾定錨」)。接上 build 之後的收尾由 build 做;達成後 `dev-flow:integrate`。

## 邊界

不改本體的行為(要改的由 law 講出來,refactor 去做);不寫測試;不新增、不修改、不放寬全域 Law,也不替開發者決定要不要走那條變更提議(`dev-flow:global-laws`);不改需求檔的一句話、驗收那一句、優先與里程碑的列(`dev-flow:require-design`;這裡只把既有的一句話寫成三行、填自己那條里程碑的綁定欄);不建 abstract(`dev-flow:abstract`);既有的 law 一條都不動的 `verified` 文檔修訂不在這裡(`dev-flow:scope-revise`);不與它交錯:一件修訂從頭到尾只有一個修訂類的 skill 在跑,收進來的就一手做到 `verified`。`verified` 的檔只經由情形二重開之後才動。一次修訂一條 REV,不順便改別的;沒有影響範圍與選項不落筆;不替開發者決定要不要改、選哪一個——開發者說,你寫。law 不為了讓現在的切片過關而寫鬆:切片是草稿,law 是承諾。
