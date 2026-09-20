---
name: law-design
description: dev-flow 的 Law 設計 — 對著一條跑得通的切片與它的決策紀錄,把它拆成一份講一件使用者做得到的事的 feature(devflow claim 建檔、綁進里程碑),Steps 的簽名抄程式碼裡定下來的那一個,再與開發者一次一條、用切片跑出來的例子談 Law:要的寫成 law、不准的寫成 law 並記成首跑該紅、不在乎的不寫不測;每條 law 都要講得出一個讓它變假的實作。三道 lint 過了、開發者逐條拍板才改 ready,收尾自動接上 dev-flow:build(派 qa、驗首跑、派 refactor)。觸發詞:law-design、談 Law、定 Law、設計 law、補設計文檔、寫功能文檔、feature、寫規格、規格書、寫 spec、這一片要承諾什麼、dev-flow law-design。Use when a working slice exists and its behaviour should be turned into feature documents and laws through a dialogue with the developer.
user-invocable: true
---

# dev-flow:law-design — 對著切片談 Law

> **範圍**:這裡只設計 **scope law**——住在一份 feature 或 abstract 的「Laws」節、只約束那一份的 law。全域 Law 不在這裡新增、修改或放寬:談到整個專案的規則,記成給開發者的變更建議,批准了由 `dev-flow:revise` 落筆。
>
> **核心**:A Law MUST be falsifiable and MUST be the developer's decision; it never describes what the code happens to do.(每條 law 都講得出怎樣算違反,而且是開發者拍板的承諾;把程式碼現在做的事念一遍不是 law。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 讀什麼

`<D>` 是 plugin 根目錄,也就是本 skill 的基準目錄往上兩層;下面的 `rules/…` 都在 `<D>/rules/`。一次讀完:`rules/features.md`「feature 與 abstract」「編號與引用」「簽名怎麼寫」「frontmatter 與 status」「節」「什麼要有 law」、`rules/laws.md`「Law 怎麼談」「Law 與需求」「全域 Law」、`rules/roles.md`「分支與所有權」「首跑」「決策紀錄」、`rules/boundary.md`「模組表」「對外 I/O」、`rules/tooling.md`「CLI」「收尾定錨」。再讀這條里程碑的目標檔與它的需求(含驗收)、`.design/system.md`、`.design/journal/M-n-<slug>.md` 全份,與切片的程式碼。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 里程碑全名 `M-n-<slug>`(它的 `build/` 工作樹上有一條 `verdict: feasible` 的切片),或這條里程碑底下一份還是 `draft` 的 feature 全名 | 一份或幾份 `ready` 的 `features/F-00x-<slug>.md`,綁在這條里程碑上;決策紀錄「Verification」的「首跑該紅」;然後接上 `dev-flow:build` |

## 前置

- 工作目錄是這條里程碑的工作樹 `../<repo>.worktrees/M-n-<slug>`;決策紀錄在、`verdict: feasible`。沒有切片 → `dev-flow:spike-impl`。
- 先把主線合進來一次:`git fetch` 後 `git merge origin/<主線>`。Law 對著最新的全域 Law 談;合不進來的衝突先解,解不了就停下回報。
- 目標是**既有**文檔的改動 → 這裡不是入口,走 `dev-flow:revise`。**兩份以上 feature 的共同部分** → `dev-flow:abstract`。

## 步驟

1. **把切片跑起來**:決策紀錄「Entry」那道指令,親眼看一次行為;之後問開發者的每個例子都從這裡跑出來,不憑讀程式碼想像。
2. **切文檔**:這一片裡有幾件「使用者做得到的事」,就是幾份 feature;一份一條資料流,從對外邊界進、從對外邊界出。跟開發者確認切法,每一份 `devflow claim feature <slug> --description <句> --milestone M-n`。切片可以大,文檔不跟著變大(`features.md`「feature 與 abstract」)。以下每一份各做一次。
3. **Brief 與對外的兩端**:一句意圖、input、output、流向、它讓這條里程碑往前哪一步。決策紀錄「Touched」的新入口與出口補成 `system.md` 對外 I/O 表的列:信任、`untrusted` 入口的驗證 step。
4. **Steps 抄程式碼**:資料流上的每一步一列,簽名是程式碼裡對外匯出的那一個,照正規式寫;模組欄是實際的檔案,層欄與模組表一致。補 `=` 列(整條,住內層)與 `!` 列(進入點,住最外層)。
   - step 之間傳遞的值要是有名字的型別;切片裡用了無名容器(`dict`、`any` …)的地方,現在與開發者定型別,把宣告改到位、編得過。
   - 切片沒有把整條組成一次呼叫(`=` 列對不到一個函數)→ 現在抽出來並匯出:那是宣告的事,歸這一側;行為不動。
   - 用得到別份文檔已經有的 step → 模組欄註明「見 A-00x-<slug>」。
5. **談 Law**(`laws.md`「Law 怎麼談」),一次一條:
   - 候選從三個來源列:這條里程碑的需求要達成(它的驗收要過)往下推、碰得到的全域 Law 在這一份長什麼樣、決策紀錄「Assumptions & Invariants」與「Faked / Unverified」往上撈(來源是「順手」的優先問)、對每個 step 過「什麼要有 law」兩問再拿種類表逐種問。
   - 每條都用切片跑出來的具體例子問:「現在的行為是 …。這是你要的、你不准的、還是你不在乎的?」
   - 要 → 寫成純 ASCII 三行的 law。不准 → 寫成 law(講不准之後該成立的事),它的全名記進決策紀錄「Verification」的「首跑該紅」。不在乎 → 不寫、不測。
   - 每條 law 講出一個讓它變假的實作;講不出來就是在描述程式碼,不收。
   - 三行寫不出來 = 少一個觀察點:補 `o` 列並在程式碼裡匯出它。`=` 列至少一條端到端的 law。
   - 答「不准」而現有的型別裝不下 → 當場與開發者定型別要多什麼,改宣告、編得過;行為留給 refactor。
6. **寫成三行,不改那一句話**(`roles.md`「分支與所有權」的例外):這條里程碑的需求的驗收還只有一句話,而這一片讓它講得到的簽名出現了 → 與開發者把它寫成三行(識別字是 Steps 的簽名,不含 `!` 列);`system.md`「全域 Law」區有一條領域不變量還只有一句話、這一片讓最內層出現了它講得到的型別 → 同樣寫成三行(識別字只用最內層的匯出與型別名)。那一句話本身不改;寫了三行,build 會派 qa 寫它的驗收測試。只把既有的那一句寫成三行,不新增、不改句子、不放寬;談的過程中冒出整個專案的規則,或覺得某條全域 Law 該改,記在回報裡當成給開發者的變更建議,批准了由 `dev-flow:revise` 落筆。對外 I/O 表的契約欄填守這一端的那條 law。
7. **Examples**:3–5 個具體輸入輸出,從第 1 步跑出來的真實例子挑,覆蓋邊界(空的、單一、極值、失敗路徑),每列指到它覆蓋的 law。開發者答「不准」的,example 寫的是該有的輸出,不是現在的輸出。**不准出現真的密碼、金鑰或 token。**
8. **決定**:決策紀錄「Decisions」裡只關這一份文檔的搬進「決定」(一句結論、否決的替代方案、理由);跨文檔的留在決策紀錄給整合。
9. `devflow lint sig`、`devflow lint laws`、`devflow lint io`、`devflow lint boundary`:都沒有紅,`devflow status --doc <全名>` 每列是「在」。把每條 law 念一遍給開發者,**逐條拍板,不整批追認**;拍板了改 `status: ready`。文檔、宣告的改動與決策紀錄各自 commit,訊息帶全名。
10. **接上 build**:這條里程碑綁的每份 feature 都 `ready` 之後,直接執行 `dev-flow:build M-n-<slug>`,不等開發者另外下指令。還有一份沒談完就先回報停在哪一條。

## 收尾

回報切出幾份 feature、各幾條 step 與 law、哪幾條首跑該紅、哪幾件開發者答了不在乎(之後可以自由改的行為)、改了哪些宣告、冒出來卻沒收的全域規則;附定錨區塊。接上 build 之後的收尾由 build 做。

## 邊界

不改本體的行為(要改的由 law 講出來,refactor 去做);不寫測試;不新增領域不變量、不改需求與目標那一句話(只把既有的一句話寫成三行);不改別份已經在主線上的文檔(那是 `dev-flow:revise`);不建 abstract。已經 `verified` 的檔不碰。law 不為了讓現在的切片過關而寫鬆:切片是草稿,law 是承諾。
