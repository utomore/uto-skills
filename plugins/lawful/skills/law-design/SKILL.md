---
name: law-design
description: lawful(有 .lawful/ 的 Haskell 專案)的 Law 設計:對著跑得通的切片 claim 出 pipeline,Stages 抄程式碼,與開發者一條一條談 law(要、不准、不在乎),拍板 ready 後自動接上 build。觸發詞:談 Law、定 Law、law-design、寫 pipeline、pipeline 文檔、寫規格、spec、這一片要承諾什麼。Use when a working slice should be turned into pipeline documents and laws through a dialogue with the developer.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:law-design — 對著切片談 Law

> **範圍**:這裡只設計 **scope law**——住在一條 pipeline 的「Laws」節、只約束那一條的 law。全域 Law 不在這裡新增、修改或放寬:談到整個專案的規則,記成給開發者的變更建議,批准了由 `lawful:revise` 落筆。
>
> **核心**:A Law MUST be falsifiable and MUST be the developer's decision; it never describes what the code happens to do.(每條 law 都講得出怎樣算違反,而且是開發者拍板的承諾;把程式碼現在做的事念一遍不是 law。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief law-design --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief law-design --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief law-design --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief law-design --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief law-design --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief law-design --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief law-design` 的輸出:規章、分支與工作樹、`.lawful/` 的樹、那條里程碑的目標檔與它的需求和驗收、`Cone.md` 全文、`modules.md` 全文、這條里程碑的決策紀錄全文、已經綁的 pipeline 全文與逐條狀態、types 層每個模組的匯出。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:里程碑全名 `M-n-<slug>`。上面寫「目標未指定」就先定出目標,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief law-design <目標> --no-rules`;同一場裡目標文檔或專案現況變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

切片的程式碼照決策紀錄「Touched」列的模組自己讀,一輪讀完。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 里程碑全名 `M-n-<slug>`(它的 `build/` 工作樹上有一條 `verdict: feasible` 的切片);這條里程碑底下還有 `draft` 的 pipeline 就接著談那一條 | 一條或幾條 `ready` 的 `pipelines/P-00x-<slug>.md`,綁在這條里程碑上;決策紀錄「Verification」的「首跑該紅」;然後接上 `lawful:build` |

## 前置

- 工作目錄是這條里程碑的工作樹 `../<repo>.worktrees/M-n-<slug>`;決策紀錄在、`verdict: feasible`。沒有切片 → `lawful:spike-impl`。
- 先把主線合進來一次:`git fetch` 後 `git merge origin/<主線>`。Law 對著最新的全域 Law 談;合不進來的衝突先解,解不了就停下回報。
- 目標是**既有** pipeline 的改動 → 這裡不是入口,走 `lawful:revise`。

## 步驟

1. **把切片跑起來**:決策紀錄「Entry」那道指令,親眼看一次行為;之後問開發者的每個例子都從這裡跑出來(或在 REPL 裡對純的整條求值),不憑讀程式碼想像。
2. **切文檔**:這一片裡有幾段「input → 純轉換 → output」的資料流,就是幾條 pipeline:兩端碰 shell 的是 IO 介面,只在純核心裡、被別條當一步用的是子流。跟開發者確認切法,每一條 `lawful claim <slug> --description <句> --kind <IO 介面 | 子流> --milestone M-n`;slug 是 `<領域名詞>-<動詞>`,領域名詞是 `=` 列住的模組單元(`pipelines.md`「編號與引用」)。切片可以大,文檔不跟著變大(`pipelines.md`「pipeline」)。以下每一條各做一次,被引用的子流先做。
3. **Brief 與對外的兩端**:一句意圖、input、output、流向、它是 IO 介面還是哪條的子流、它讓這條里程碑往前哪一步。決策紀錄「Touched」的新入口與出口補成 `Cone.md`「契約:對外 I/O」表的列(契約欄在第 6 步填)。
4. **Stages 抄程式碼**:資料流上的每一步一列,簽名逐字抄程式碼裡匯出的那一行(`pipelines.md`「簽名怎麼寫」);模組欄是實際的模組,層欄是它住的那棵樹。補 `=` 列(純的整條,住 core 或 effect)與 IO 介面的 `!` 列(進入點,住 shell)。
   - stage 之間傳遞的值要是有名字的型別;切片裡用了無名容器(`Value`、`Dynamic` …)的地方,現在與開發者定型別,把宣告改到位、編得過。
   - 切片沒有把純的部分組成一個值(`=` 列對不到一個函數)→ 現在抽出來並匯出:那是宣告的事,歸這一側;行為不動。
   - 用得到別條 pipeline 已經有的 stage → 簽名照抄,模組欄註明「見 P-00x-<slug>」。
   - stage 與觀察點都要在匯出清單裡;只為 law 觀察而匯出的住 `*.Internal`(`boundary.md`「測試與邊界」)。
5. **談 Law**(`laws.md`「Law 怎麼談」),一次一條:
   - 候選從三個來源列:這條里程碑的需求要達成(它的驗收要過)往下推、碰得到的全域 Law 在這一條長什麼樣;決策紀錄「Assumptions & Invariants」與「Faked / Unverified」往上撈(來源是「順手」的優先問);對每個 stage 過「什麼要有 law」兩問再拿種類表逐種問。
   - 每條都用切片跑出來的具體例子問:「現在的行為是 …。這是你要的、你不准的、還是你不在乎的?」
   - 要 → 寫成純 ASCII 三行的 law。不准 → 寫成 law(講不准之後該成立的事),它的全名記進決策紀錄「Verification」的「首跑該紅」。不在乎 → 不寫、不測。
   - 每條 law 講出一個讓它變假的實作;講不出來就是在描述程式碼,不收。
   - 三行寫不出來 = 少一個觀察點:補 `o` 列並在程式碼裡匯出它。`=` 列是效果描述時,觀察點是它的純解譯器(`boundary.md`「效果的判定」),law 拿純解譯器的結果寫。`=` 列至少一條端到端的 law。
   - 答「不准」而現有的型別裝不下 → 當場與開發者定型別要多什麼,改宣告、編得過;行為留給 refactor。
6. **寫成三行,不改那一句話**(`roles.md`「分支與所有權」的例外):這條里程碑的需求的驗收還只有一句話,而這一片讓它講得到的簽名出現了 → 與開發者把它寫成三行(識別字是 Stages 的簽名,不含 `!` 列);`Cone.md`「全域 Law」區有一條領域不變量還只有一句話、這一片讓 types 層出現了它講得到的型別 → 同樣寫成三行(識別字只用 types 層的匯出與型別名)。那一句話本身不改;寫了三行,build 會派 qa 寫它的驗收測試。只把既有的那一句寫成三行,不新增、不改句子、不放寬;談的過程中冒出整個專案的規則,或覺得某條全域 Law 該改,記在回報裡當成給開發者的變更建議,批准了由 `lawful:revise` 落筆。對外 I/O 表的契約欄填守這一端的那條 law。
7. **Examples**:3–5 個具體輸入輸出,從第 1 步跑出來的真實例子挑,覆蓋邊界(空的、單一、極值、失敗路徑),每列指到它覆蓋的 law。開發者答「不准」的,example 寫的是該有的輸出,不是現在的輸出。
8. **決定**:決策紀錄「Decisions」裡只關這一條 pipeline 的搬進「決定」(一句結論、否決的替代方案、理由);跨 pipeline 的留在決策紀錄給整合。
9. `lawful lint sig`、`lawful lint laws`、`lawful lint io`、`lawful lint boundary`:都沒有紅,`lawful status --pipeline <全名>` 每列是「在」。把每條 law 念一遍給開發者,**逐條拍板,不整批追認**;拍板了改 `status: ready`,frontmatter 的 `kind` 還是佔位符就填上。文檔、宣告的改動與決策紀錄各自 commit,訊息帶全名。
10. **接上 build**:這條里程碑綁的每條 pipeline 都 `ready` 之後,直接執行 `lawful:build M-n-<slug>`,不等開發者另外下指令。還有一條沒談完就先回報停在哪一條。

## 收尾

回報切出幾條 pipeline(各是 IO 介面還是子流)、各幾條 stage、觀察點與 law、哪幾條首跑該紅、哪幾件開發者答了不在乎(之後可以自由改的行為)、改了哪些宣告、冒出來卻沒收的全域規則;附定錨區塊。接上 build 之後的收尾由 build 做。

## 邊界

不改本體的行為(要改的由 law 講出來,refactor 去做);不寫測試;不新增領域不變量、不改需求與目標那一句話(只把既有的一句話寫成三行);不改別條已經在主線上的 pipeline(那是 `lawful:revise`)。已經 `verified` 的檔不碰。law 不為了讓現在的切片過關而寫鬆:切片是草稿,law 是承諾。開發者只說,檔一律由這裡寫。
