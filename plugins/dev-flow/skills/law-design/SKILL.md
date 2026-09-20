---
name: law-design
description: dev-flow(有 .design/ 的專案)的 Law 設計,scope law 的唯一入口:對著跑得通的切片 claim 出 feature、與開發者逐條談 law;既有文檔的行為、簽名或 law 要改(回答 GAP、落地調整 RF-n)就先攤影響範圍與選項、改原檔、寫 REV;都自動接上 build。觸發詞:談 Law、law-design、寫功能文檔、feature、spec、修訂、改契約、改行為、回答 gap、改 law。Use when a working slice should become feature documents and laws, or an existing document or law must change.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:law-design — 談 Law,改 Law

> **範圍**:這裡是 **scope law** 的唯一入口——住在一份 feature 或 abstract 的「Laws」節、只約束那一份的 law;新談與修訂都在這裡。全域 Law 不在這裡新增、修改或放寬:談到整個專案的規則,記成給開發者的變更建議,批准了由 `dev-flow:glaws-revise` 落筆。一條 scope law 不必指得出它滿足哪條需求:文檔經由里程碑的綁定欄朝向需求,law 不朝向需求。
>
> **核心**:A Law MUST be falsifiable and MUST be the developer's decision; it never describes what the code happens to do, and an existing Law changes only after the developer has seen its full impact and chosen among options.(每條 law 都講得出怎樣算違反,而且是開發者拍板的承諾;把程式碼現在做的事念一遍不是 law。既有的 law 要改,開發者先看過完整的影響範圍、在選項裡選了,才落筆。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief law-design --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief law-design --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief law-design --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief law-design --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段(一份輸出切成幾段,每段一道指令)是載入 skill 時跑 `devflow brief law-design` 的輸出:規章、分支與工作樹、`.design/` 的樹、`system.md` 全份、`modules.md`、`gaps.md`。目標是里程碑時另有這條里程碑所在的需求檔全文(一句話、驗收、里程碑表)、決策紀錄全份、已經綁上的文檔;目標是一份既有文檔時另有那份文檔全文、逐條狀態、Steps 上每條簽名與型別的宣告、它引用的與引用它的文檔全文、它朝向哪條里程碑與哪條調整(連同需求檔的一句話與驗收)、`lint global` 的結果與 status 報告(影響範圍從這幾塊攤)。開工要讀的規章與專案現況都在這裡,不再另外讀。切片的程式碼照決策紀錄「Touched」列的檔自己讀,一輪讀完。

目標:里程碑全名 `M-n-<slug>`(切片剛做完),或要改的那份文檔的全名(既有文檔要改)。上面寫「目標未指定」就先定出目標,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief law-design <目標> --no-rules`;同一場裡目標文檔變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 情形 | 輸入 | 產出 |
|---|---|---|
| **切片剛做完** | 里程碑全名 `M-n-<slug>`(它的 `build/` 工作樹上有一條 `verdict: feasible` 的切片),或這條里程碑底下一份還是 `draft` 的 feature 全名 | 一份或幾份 `ready` 的 `features/F-00x-<slug>.md`,綁在這條里程碑上;決策紀錄「Verification」的「首跑該紅」;然後接上 `dev-flow:build` |
| **既有文檔要改** | 一份已經拍板過的 feature 或 abstract 全名,加上來源:開發者要改行為、簽名或 law,回答一條 GAP(含整合仲裁留下的),或落地一條調整 `RF-n` | 改過的原檔、一條 REV、連動的文檔、同步改過的宣告;然後接上 `dev-flow:build`,只重做 REV 點名的 |

## 前置

- 改的是**兩份以上文檔的共同部分** → 走 `dev-flow:abstract`,它會替每一份寫 REV。
- 要加的是一個**可以獨立拿掉的新能力** → 那是新的里程碑與切片,走 `dev-flow:require-design` 再 `dev-flow:spike-impl`。
- 改的是**全域 Law**(`system.md`「全域 Law」區的任何一條)→ 走 `dev-flow:glaws-revise`。改的是需求的一句話、驗收那一句、優先或里程碑 → 走 `dev-flow:require-design`。
- **切片剛做完**:工作目錄是這條里程碑的工作樹 `../<repo>.worktrees/M-n-<slug>`;決策紀錄在、`verdict: feasible`。沒有切片 → `dev-flow:spike-impl`。先把主線合進來一次:`git fetch` 後 `git merge origin/<主線>`。Law 對著最新的全域 Law 談;合不進來的衝突先解,解不了就停下回報。
- **既有文檔要改**:
  - 做的是調整:那條 `RF-n` 要在某個需求檔的調整表上、動到的 feature 要是它列的、該需求的里程碑要已經全部達成;不是就停,回 `dev-flow:require-design`。調整只改實作或行為品質,要改簽名或加 step 讓它做到新能力的,不是調整,是新里程碑。
  - 一律改原檔。**不開第二份檔**:開了,原檔就停在它被寫下的那一天,三個月後沒有人知道它現在長什麼樣。
  - **在哪做**(`roles.md`「分支與所有權」):這份文檔還在一條沒整合的 `build/` 分支上(切片談到一半、qa 開了 GAP、整合的仲裁退回來)→ 就在那棵工作樹上做。文檔已在主線上 → 在主線、與 origin 同步、工作樹乾淨時 `git worktree add -b build/<全名> ../<repo>.worktrees/<全名> HEAD`,在那棵樹上做。

## 步驟

### 情形一:切片剛做完

1. **把切片跑起來**:決策紀錄「Entry」那道指令,親眼看一次行為;之後問開發者的每個例子都從這裡跑出來,不憑讀程式碼想像。
2. **切文檔**:這一片裡有幾件「使用者做得到的事」,就是幾份 feature;一份一條資料流,從對外邊界進、從對外邊界出。跟開發者確認切法,每一份 `devflow claim feature <slug> --description <句> --milestone M-n`(綁定寫進這條里程碑所在的需求檔)。切片可以大,文檔不跟著變大(`features.md`「feature 與 abstract」)。以下每一份各做一次。
3. **Brief 與對外的兩端**:一句意圖、input、output、流向、它讓這條里程碑那一句話的哪一部分看得到。決策紀錄「Touched」的新入口與出口補成 `system.md` 對外 I/O 表的列:信任、`untrusted` 入口的驗證 step。
4. **Steps 抄程式碼**:資料流上的每一步一列,簽名是程式碼裡對外匯出的那一個,照正規式寫;模組欄是實際的檔案,層欄與模組表一致。補 `=` 列(整條,住內層)與 `!` 列(進入點,住最外層)。
   - step 之間傳遞的值要是有名字的型別;切片裡用了無名容器(`dict`、`any` …)的地方,現在與開發者定型別,把宣告改到位、編得過。
   - 切片沒有把整條組成一次呼叫(`=` 列對不到一個函數)→ 現在抽出來並匯出:那是宣告的事,歸這一側;行為不動。
   - 用得到別份文檔已經有的 step → 模組欄註明「見 A-00x-<slug>」。
5. **談 Law**(`laws.md`「Law 怎麼談」),一次一條:
   - 候選從三個來源列:這條里程碑那一句話要展示得出來、它的需求的驗收要過,往下推;碰得到的全域 Law 在這一份長什麼樣;決策紀錄「Assumptions & Invariants」與「Faked / Unverified」往上撈(來源是「順手」的優先問);對每個 step 過「什麼要有 law」兩問再拿種類表逐種問。來源只是找候選的方向,收不收看開發者要不要這個承諾。
   - 每條都用切片跑出來的具體例子問:「現在的行為是 …。這是你要的、你不准的、還是你不在乎的?」
   - 要 → 寫成純 ASCII 三行的 law。不准 → 寫成 law(講不准之後該成立的事),它的全名記進決策紀錄「Verification」的「首跑該紅」。不在乎 → 不寫、不測。
   - 每條 law 講出一個讓它變假的實作;講不出來就是在描述程式碼,不收。
   - 三行寫不出來 = 少一個觀察點:補 `o` 列並在程式碼裡匯出它。`=` 列至少一條端到端的 law。
   - 答「不准」而現有的型別裝不下 → 當場與開發者定型別要多什麼,改宣告、編得過;行為留給 refactor。
6. **寫成三行,不改那一句話**(`roles.md`「分支與所有權」的例外):這條里程碑的需求的驗收還只有一句話,而這一片讓它講得到的簽名出現了 → 與開發者把它寫成三行(識別字是 Steps 的簽名,不含 `!` 列);`system.md`「全域 Law」區有一條領域不變量還只有一句話、這一片讓最內層出現了它講得到的型別 → 同樣寫成三行(識別字只用最內層的匯出與型別名)。那一句話本身不改;寫了三行,build 會派 qa 寫它的驗收測試。只把既有的那一句寫成三行,不新增、不改句子、不放寬;談的過程中冒出整個專案的規則,或覺得某條全域 Law 該改,記在回報裡當成給開發者的變更建議,批准了由 `dev-flow:glaws-revise` 落筆。對外 I/O 表的契約欄填守這一端的那條 law。
7. **Examples**:3–5 個具體輸入輸出,從第 1 步跑出來的真實例子挑,覆蓋邊界(空的、單一、極值、失敗路徑),每列指到它覆蓋的 law。開發者答「不准」的,example 寫的是該有的輸出,不是現在的輸出。**不准出現真的密碼、金鑰或 token。**
8. **決定**:決策紀錄「Decisions」裡只關這一份文檔的搬進「決定」(一句結論、否決的替代方案、理由);跨文檔的留在決策紀錄給整合。
9. `devflow lint sig`、`devflow lint laws`、`devflow lint io`、`devflow lint boundary`:都沒有紅,`devflow status --doc <全名>` 每列是「在」。把每條 law 念一遍給開發者,**逐條拍板,不整批追認**;拍板了改 `status: ready`。文檔、宣告的改動與決策紀錄各自 commit,訊息帶全名。
10. **接上 build**:這條里程碑綁的每份 feature 都 `ready` 之後,直接執行 `dev-flow:build M-n-<slug>`,不等開發者另外下指令。還有一份沒談完就先回報停在哪一條。

### 情形二:既有文檔要改

文檔先行:先改條文,再改測試與實作(`features.md`「修訂(REV)」)。一次修訂一條 REV。

1. **拿到來源的原句**:GAP 的提問原句(整合仲裁留下的 GAP,原句含開發者選了哪個選項)、ADR 全名、`RF-n` 與它那一句、開發者的那一句話。REV 的「依」欄要寫它(調整一定寫 `RF-n`,`devflow status` 靠它算調整的進度),不寫已經刪掉的條目編號。
2. **影響範圍**(`laws.md`「影響範圍與選項」):只要這次會動到任何一條 law,先查、先列,不准省略一項,查過而沒有的寫「無」。`devflow status --doc <全名>`(引用與被引用)、`devflow status`(建構中的分支、需求達成與否)是查的工具:

   | 項 | 列什麼 |
   |---|---|
   | 直接動到 | 哪幾條 law 的哪一行變、哪幾條簽名或型別變 |
   | 引用同一處的 law | 同一份文檔裡引用同一個 step 或觀察點的每一條 law;對外 I/O 表契約欄指到動到的 law 的每一列 |
   | 連動的文檔 | 引用這份 abstract 的每一份消費者、Steps 表引用到動到的簽名的每一份 |
   | 測試 | 要重寫的(歸屬全名)、要重跑的、確定不受影響的 |
   | 狀態 | 哪幾份 `verified` 要重開;哪幾條建構中的 build 分支要重驗 |
   | 需求 | 哪幾條需求的驗收引用到動到的 law;改完之後它還達不達成 |

3. **給選項,等開發者選**:至少兩個,其中一個一定是「不改」。每個選項寫:改什麼、影響範圍裡哪幾項因此不同、當下成本、之後的代價、可不可逆;你給傾向與理由。**一次一條 law**,開發者對著那一個選項明確說了要,才往下;沉默、整批同意、「你決定」都不算。來源的 GAP 已經記著開發者選定的選項時,仍把影響範圍攤出來請開發者確認一次:仲裁當下看到的是反例,不是全部的牽連。
4. **`verified` 先重開**:`status` 改回 `ready`,在「決定」記一條為什麼。
5. **先補保護**:這次不准變的既有行為若還不是 law,**先補成 `LAW-n` 再改**。沒有 law 守著的「行為不變」等於沒有保護。調整的保護一定含需求的驗收引用到的每條 law:調整不准讓需求退回未達成。
6. **改條文**:Steps 的簽名、Laws、Examples、層。新的 law 照 `laws.md`「Law 怎麼談」的判準:講得出一個讓它變假的實作;開發者原本不在乎、現在要承諾的行為,也是在這裡補成 law。刪掉的 law 號永久空缺,新增的往下接。效能修訂把基準線寫進新的 law(「p95 <= 100,基準線 2026-09-18 量到 400」)。收窄定義域的修訂只動那條 law 的 `forall` / `given`。
7. **寫 REV**:`## 修訂記錄` 加一條,五欄齊全(依 / 動到 / 保護 / 重委派 / 連動);依欄連同選了哪個選項,否決的選項與理由寫進「決定」。law 變了重派 qa,行為、簽名或型別變了重派 refactor。`updated` 改成今天。
8. **連動**:影響範圍「連動的文檔」列到的每一份,逐份同步並寫進「連動」欄。**責任在改的人**:簽名改了編譯器會告訴下游,語意改了什麼都不會抓。
9. **結案 GAP**:寫 REV 的同一個動作把條目**整條刪掉**,不留 resolved。`gaps.md` 空了刪檔。
10. **宣告跟著**(`roles.md`「首跑」):簽名或型別變了就同步改程式碼裡的宣告,呼叫端一起改到編得過,行為不動;修訂新增的 step 在模組欄指的檔案裡宣告並匯出,本體是未實作標記,訊息帶 `F-00x#name`,**不得回傳假值**。跑建置指令,`devflow lint all`(整套的紅只該落在 REV「動到」欄點名的 law 上)。文檔與宣告同一個 commit,訊息帶全名。
11. **接上 build**:直接執行 `dev-flow:build <全名>`,只重做 REV「重委派」欄點名的:qa 改那幾條測試,首跑時「動到」欄的 law 要紅、「保護」欄的要綠,再派 refactor。調整動到多份 feature 時,每一份各一次修訂、各自接上 build。

## 收尾

切片剛做完:回報切出幾份 feature、各幾條 step 與 law、哪幾條首跑該紅、哪幾件開發者答了不在乎(之後可以自由改的行為)、改了哪些宣告、冒出來卻沒收的全域規則。既有文檔要改:回報 REV 第幾條、影響範圍六項、開發者選了哪個選項與否決了哪幾個、動到什麼、保護什麼、要重派誰、連動了哪幾份、對應的調整(有的話)。附定錨區塊(`tooling.md`「收尾定錨」)。接上 build 之後的收尾由 build 做;達成後 `dev-flow:integrate`。

## 邊界

不改本體的行為(要改的由 law 講出來,refactor 去做);不寫測試;不新增、不修改、不放寬全域 Law(`dev-flow:glaws-revise`);不改需求檔的一句話、驗收那一句、優先與里程碑的列(`dev-flow:require-design`;這裡只把既有的一句話寫成三行、填自己那條里程碑的綁定欄);不建 abstract(`dev-flow:abstract`)。`verified` 的檔只經由情形二重開之後才動。一次修訂一條 REV,不順便改別的;沒有影響範圍與選項不落筆;不替開發者決定要不要改、選哪一個——開發者說,你寫。law 不為了讓現在的切片過關而寫鬆:切片是草稿,law 是承諾。
