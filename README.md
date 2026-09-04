# uto-skills

utomore 的 Claude Code plugin marketplace。目前收錄兩個 plugins:

## dev-flow

三層階梯式(Level 1 主架構 → Level 2 子系統 → Level 3 Feature 實作)文檔驅動開發流程的 Claude Code plugin,遵循關注點分離與契約優先:架構階段只定義邊界契約與資料流(嚴禁過早具體化),實作階段在契約內擁有完全自主權。Level 3 再切成 **spec 驅動的三角色**(設計 / qa / impl,見下方專節)。包含十三個 skills:

| 指令 | 層級 | 職責 |
|---|---|---|
| `/system-design` | Level 1 | 系統主架構 — 深度訪談後產出 `.design/system.md` + `.design/adr/ADR-00x-*.md`:技術棧、對外 I/O 契約、子系統劃分(Bounded Contexts)、通訊拓撲、**子系統完整名冊**與**開發階段表**(產品級分母);只到子系統邊界顆粒度 |
| `/subsys-design` | Level 2 | 子系統架構 — 產出 `.design/subsystems/<slug>/design.md`:公開介面與 DTO、**模組群**(子系統內的平行領域,含還沒開工的 `planned` 群)、內部模組劃分、資料流管線、模組間抽象介面,以及 **feature 路線圖:規劃當下就整批鑄號、建出 `status: planned` 的 `features/F00x-*.md`,每份帶一節 `## 契約`**(六欄,委派展開的門檻),並與主架構的職責逐條對帳(A10) |
| `/subsys-build` | Level 2→3 | 子系統委派展開(orchestrator)— 把 `status: planned` 的 feature 檔依 `depends-on` 排波次,**批次澄清一次問完** → 指派骨架路徑 → 委派 spec(平行,opus)→ **spec 批准閘門** → qa ∥ impl(sonnet,互相不可見)→ **編排者跑測試與仲裁(同一 feature 上限 3 輪)** → 每階段跑 `arch-audit` 後**停下來給人驗收**;`status` 回寫、索引重生成、`build-log.md`、git commit 由編排者單線負責 |
| `/spec-design` | Level 3 · spec | spec 設計 — 深度討論後產出 spec 文檔與**程式碼骨架**(型別與簽名完整、本體 `undefined`);相依性**必用**程式碼知識圖定位再開原始碼查證。**兩種模式**:**feature**(把一份 `planned` 的 `features/F00x-*.md` 往下寫成 `specced` —— 加上目的 / 數據 / 介面 / **Laws** / **Examples** / 依賴 / 不可逆決定,介面必須落在該檔 `## 契約` 與 Level 2 契約內;**不改 `## 契約`**)、**enhance**(既有程式碼的優化 → `enhancements/E00x-*.md`,跨子系統為 `G-E00x`;追加「檢視現況」與「**與開發者確認 scope**」兩個前置步驟,Laws 分「回歸 law(改完必須一模一樣的現有行為)」與「新 law」兩類)。文檔模板放在 `templates/`,執行時只讀模式對應的那一份 |
| `/spec-build` | 編排 | 單份 spec 的委派迴圈(orchestrator)— 拿一份寫好的 spec(F00x / E00x):門檻檢查(骨架編得過、介面對得上、無未結 gap)→ **spec 批准閘門** → 委派 qa ∥ impl(sonnet,互相不可見)→ **編排者跑測試與仲裁(上限 3 輪)** → 回寫 status。enhance 的 scope 談完之後就走這條 |
| `dev-flow:spec-qa` | Level 3 · qa | **委派角色,不在斜線選單**(user-invocable: false;編排者委派,或用自然語言觸發)。從 spec 寫測試 — 只讀 spec 的數據 / 介面 / Laws / Examples 與骨架,每條 law 翻成 property test、每個 example 翻成 example test;**禁止讀任何實作程式碼與程式碼知識圖**,交付前確認測試「編譯通過 + 紅綠符合預期」 |
| `dev-flow:spec-impl` | Level 3 · impl | **委派角色,不在斜線選單**(user-invocable: false;編排者委派,或用自然語言觸發)。spec 實作 — 以骨架為工作清單,把 `undefined` 換成實作;**禁止讀寫任何測試檔、禁止改動骨架簽名**;紅燈只做歸因走仲裁協議,不自行猜 spec。模式由 id 前綴判定,`E00x` / `G-E00x` 追加三條:動工前先跑回歸測試留基準線、scope 標明不動的範圍絕對不碰、收尾記錄量化結果 |
| `/spec-redesign` | 修改 | 契約與 spec 的修改 — 既有 `## 契約` 或既有 spec 要改時的**唯一入口**。先用機械判準定層級:**改動只落在這一份 feature 檔裡就 Level 3 就地改,有第二份文檔要跟著改就回 Level 2**(收回「明確不做」一律算 Level 2)。改完在 `## 契約` 底下追加可查證的修訂行、回填 gap,並講明哪幾條介面要重跑 qa / impl |
| `/bugfix` | Level 3 | 缺陷修復(單角色)— 重現 → 建 `bugfixes/B00x-*.md`(跨子系統為 `G-B00x`)→ 先寫重現測試再修 → 保留回歸測試 |
| `/spike` | 驗證 | 可行性驗證 — 讀原始碼答不出來、**要跑了才知道**的問題:先寫問題、判準、timebox,再在專案根目錄 `spike/SPK-00x-<slug>/` 寫拋棄式程式碼驗證,結論記進 `.design/spikes/SPK-00x-<slug>.md`,`feeds` 欄指明餵給哪份 ADR / 契約 / feature 檔。可多輪疊代(`RND-n`,模型屋式的 demo 範本)、可候選比較(各候選一個子資料夾)、可由任何編排者委派(`orchestration.md`「派 spike 驗證」)。`spike/` 是常駐的共用 sandbox 環境,該 spike 的資料夾**結案即刪**、每輪 sha 留在文檔裡用 git 撈,open 期間**產品程式碼禁止 import**(`lint-spikes.mjs` 查);結論落地一律走 `/spec-redesign` 或對應的 design skill,spike 只是證據 |
| `/arch-audit` | 全 | 架構檢測 — `system`(子系統循環依賴、對外 I/O 契約一致性)/ `subsys`(資料流管線、SRP、邊界外洩、**模組群與職責對帳**、各 feature `## 契約` 對帳、未結 spec-gaps、仲裁紀錄、spike 對帳)/ `feature`(Level 2 介面符合度、**Laws/Examples 與測試對照**、**骨架符合度**、edge cases、型別安全)/ `status`(腳本盤點**開發階段**、名冊上未建檔的子系統、未開工的模組群、完成度漏斗(僅規劃 / 已寫spec / 已實作)、契約就緒度與未結 spec-gaps) |
| `/branch-pr` | — | 整合多條 branch 發 PR(先確認當前分支,在 main 上就先開新分支;標題英文 conventional commit、內文繁中、labels 英文) |
| `/study` | — | 專案導讀(唯讀)— **六層縮放**由上而下帶開發者理解既有專案,範圍逐層收窄、深度逐層加深:全景(入口、技術棧、目錄職責;課末選定**主線情境**貫穿全程)→ 架構(子系統邊界、依賴方向、通訊方式)→ 設計理念(理由逐條標來源:`[文檔]`/`[註解]`/`[commit]`/`[推測]`)→ 核心資料結構(定義、生產者/消費者、邊界轉換、不變量;主線攜帶的型別優先)→ **逐跳 trace code**(沿主線從入口到輸出,附呼叫鏈摘要表,課末圈出要拆開看的跳)→ **細讀**(鑽進一兩個關鍵函式逐行講,含桌上執行表與逐分支邊界);每課固定「銜接 → 結論 → 理由 → `檔案:行號` 原文片段證據 → 檢查點(難度遞進:複述→預測→修改)→ 課程地圖」,一次一課等開發者消化;有 `.design/` 就以它為地圖並對照程式碼驗證,沒有就從入口與目錄樹建工作假說 |

共用文檔慣例放在 `plugins/dev-flow/skills/_shared/`,依**載入時機**分十二片,核心 `conventions.md` 每個 skill 都讀,其餘按需:`spec-roles.md`(spec 三角色契約)、`boundary-rules.md`(邊界判斷與發問協議)、`doc-lifecycle.md`(建檔、編號、引用與 frontmatter 規格)、`delegation.md` / `delegation-design.md`(委派模式)、`orchestration.md`(編排者專用:模型分派、委派 prompt、骨架快照、仲裁處置、派 spike 驗證)、`codegraph.md` / `codegraph-tools.md`(程式碼知識圖)、`testing-policy.md`、`anchor.md`(收尾定錨)。**分片對照表的唯一權威是 `conventions.md` 開頭那張表**;每個 skill 開頭明列自己要讀哪幾片。

改 skill 前請先看 [docs/skill-authoring.md](docs/skill-authoring.md)——撰寫與維護準則(追加閘門、分片規則、成本量測)。

### spec 驅動的三角色(Level 3)

Level 3 的一句話:**spec 是唯一真相,測試與實作都只是 spec 的投影。**

```
     設計 ──> spec 文檔 + 骨架(型別完整、簽名完整、本體 undefined)
                          │
              ┌───────────┴───────────┐
        qa 讀 │                       │ impl 讀
        寫測試 │                       │ 填本體
              └───────> 編排者 <───────┘
                    跑測試 → 仲裁
```

| 角色 | 唯一輸入 | 產出 | 絕對禁區 |
|---|---|---|---|
| **設計**(`/spec-design`) | 該 feature 檔的 `## 契約` + 既有程式碼(必用程式碼知識圖定位) | spec 文檔 + 骨架 | 不寫任何實作邏輯、不寫測試 |
| **qa**(`/spec-qa`) | spec 的數據 / 介面 / Laws / Examples + 骨架 | 測試檔 | 不讀實作;程式碼知識圖只能導航(型別、測試檔位置、既有測試候選),不得推論行為;不改骨架、不要後門 |
| **impl**(`/spec-impl`) | spec 全文 + 骨架 | 把 `undefined` 換成本體 | 不讀不改任何測試檔、不動骨架簽名與型別 |
| **編排者**(`/spec-build` 單份、`/subsys-build` 整個子系統,或開發者本人) | 全部 | 跑測試、仲裁、閘門 | 不寫 spec、不寫測試、不寫實作 |

四個設計要點:

- **骨架讓隔離變得可執行**。設計階段直接把檔案框架寫進原始碼樹——型別定義與函數簽名完整,函數本體一律 `undefined`(各語言的等價標記見 `spec-roles.md`)。qa 因此有東西可以 import,impl 的紀律變成機械的(只准替換未實作標記,`git diff` 一眼看得出有沒有偷改簽名),進度也變成客觀的(骨架裡還剩幾個 `undefined`)。骨架有兩條硬規則:**必須通過編譯**、**未實作處必須在執行期明確失敗**(回傳 `0` 或 `[]` 會讓測試假綠,比沒寫還糟)
- **Laws 是 spec 的一部分,不是 QA 的發明**。每個核心函數至少一條可被 property-based 測試驗證的代數性質,寫成「對所有 x,P(x) 成立」;再配 3-5 個覆蓋邊界的 Examples。qa 的工作是**翻譯**這些條文,不是設計性質。連帶把「1-to-1 測試對照」的錨點從 TodoList 換成 Laws/Examples——`/spec-design` 的 TodoList 與「實作方式」段因此整段刪除,完成的定義變成「骨架無未實作標記 + Laws 與 Examples 全綠」
- **qa 的交付判準可機械驗證**:測試必須「編譯通過 + 紅綠符合預期」——feature 與 enhance 新增/簽名變動的介面對應的測試應**全紅**(骨架還沒實作),enhance 的**回歸 law** 對應的測試應**全綠**(捕捉現況)。該紅卻綠 = 那條測試沒真的測到東西,退回重寫
- **紅燈先歸因,誰都不准先改碼**。失敗的測試對得上某條 law/example 且與原文一致 → impl 錯;與原文不符 → qa 誤讀(判定只看 spec 原文,**不得拿實作行為當依據**);對不上或 spec 沒涵蓋 → **spec bug**,停下來等 spec 修訂,禁止 qa 與 impl 私下協商。**同一 feature 上限 3 輪**,三輪不綠就升級給人並附結構性原因——三輪收斂不了,問題幾乎不在這一輪的程式碼

qa 或 impl 發現 spec 模糊時,**停下該項**、追加一條到 `.design/subsystems/<slug>/spec-gaps.md`,其餘照做完。這與委派模式的「待確認假設」是兩種不可互換的機制:待確認假設是**設計者**自己做判斷後繼續推進,spec-gaps 是 **qa/impl 停下來等 spec**。未結的 gap 會被 `/arch-audit status` 列出來(並讓它以 exit 1 收場),也會擋住 `/subsys-build` 啟動。

**feature 與 enhance 是同一個角色的兩種模式,不是兩個角色。** 三個角色各只有一條命令:設計是 `/spec-design`、實作是 `/spec-impl`。判準只有一條——**有沒有必須被保護的現有行為**,有就是 enhance 模式。差異全部集中成可列舉的追加項:設計端追加「檢視現況」與「Scope 討論」兩個前置步驟、Laws 多一類回歸 law、骨架多一張三種情況表;實作端追加基準線、scope 紀律與量化結果。除此之外(相依性查證、骨架三條硬規則、一致性檢查、仲裁協議、收尾定錨)兩種模式一字不差。

拆成四條命令時,這些共通條文要寫四遍、改四遍,而編排層(`/spec-build`)本來就已經把兩者當同一件事處理——那份判斷才是對的,設計層跟著收斂。代價是每次執行會讀到另一個模式的追加段落(約十餘行),換掉的是四份會各自漂移的規則。spec 文檔的兩份模板差異夠大,所以拆進 `spec-design/templates/`,執行時只讀模式對應的那一份。

**兩個編排者,差別只在規模。** 後半段(spec 批准 → qa ∥ impl → 跑測試 → 仲裁)在 feature 與 enhance 上完全相同,所以拆成兩層:

| | 何時用 | 多做了什麼 |
|---|---|---|
| `/spec-build <id>` | 手上有**一份**寫好的 spec(F00x 或 E00x) | — (最小迴圈;enhance 另加「委派前先跑一次測試留基準線」,才分得出「本來就紅」與「這次改壞」) |
| `/subsys-build <slug>` | 一次跑完**整個子系統**的多個 features | 批次澄清、排波次、配號與指派骨架路徑、`design.md` 回填、`build-log.md`、階段閘門 |

`/spec-design` 的 **enhance 模式**需要人讀程式碼、談 scope,所以不能被無訪談委派(`/subsys-build` 委派出去的一律是 feature 模式)——但 scope 談完、spec 寫好之後就交給 `/spec-build`,這就是 enhance 的編排路徑。

`/bugfix` 不套三角色:它的輸入是既有程式碼而不是 spec,沒有可投影的唯一真相,而且「先寫重現測試」本來就需要看實作才寫得出來。

### 收尾定錨

每個 skill 的收尾與 `/subsys-build` 的每個階段閘門,回報的最後都固定附一個**定錨區塊**(格式在 `_shared/anchor.md`),四段順序固定:

1. **位置樹**:從 `.design/system.md` 畫到目前工作的文檔的 ASCII 樹,只畫最近的(所在子系統展開、其他子系統各一行),目前文檔之下列出它的介面與資料結構,狀態只用五個詞——契約 / 設計 / 實作中 / 完成 / 偏離——每條介面都註明對應 `design.md` 的哪一章,找不到就是偏離
2. **完成度**:整體 → 所在子系統 → 目前文檔的 done 數、**介面 n/m 已實作**、**測試 n/m 綠**(分母是 Laws + Examples 總條數),只能來自 `scan-status.mjs`、文檔與實際跑過的測試輸出,不准估百分比
3. **主軸檢查**:本次動作對應到 `system.md` / `design.md` / 契約卡的哪一條,以及**偏離清單**(做了但上層沒寫的事,每條附位置與建議;沒有也要寫「無」)
4. **下一步**:一條具體命令,必須從樹上的「目前」推得出來,不得建議樹上沒有的工作

四段的目的只有一個:一次執行只看得到自己那一小塊,連做幾次方向就會被眼前的工作帶走;把「在哪、多遠、偏了沒、接著做什麼」釘在每次收尾的最後,開發者每次都用同一個視角核對,LLM 就帶不歪。

### 選配:程式碼知識圖

專案裡有程式碼知識圖時,dev-flow 會把它當成**導航層**:`/arch-audit` 的 system / subsys scope 用 `scan-graph.mjs` 直接算出子系統依賴矩陣、循環依賴(附每條邊的 `檔案:行號` 證據)、跨界引用清單與架構 hub;`/bugfix` 追呼叫鏈;實作類 skill 收尾時把圖更新到最新。

適用範圍分三級:**`/spec-design` 必用**(feature 模式定位既有介面並用反向可達查出誰會被新介面影響,enhance 模式估改動的影響面——設計階段的相依結論會直接變成 qa 與 impl 的前提,不能靠印象);**`/spec-qa` 限用**(可以查型別建構子、既有測試放在哪、`tests-of` 抓回歸候選,**不准順著受測函數追內部呼叫鏈、不准拿圖上看到的東西當斷言依據**——圖決定「測試放哪、輸入怎麼建」,不決定「預期輸出是什麼」);其餘選配。必用不等於有保證:跑不了圖(沒建過、產生器不支援這個語言、`extract` 失敗)時退回一般搜尋,但要在收尾寫明具體原因。

**契約是 `graph.json` 的格式,不是產生它的工具。** 下游只認「節點帶 `source_file`、邊帶 `relation`」這個形狀(完整規格見 `_shared/codegraph.md`),換產生器只要吐同格式,`scan-graph.mjs` 與各 skill 的接點一行都不用改;只給 `graph.json`、沒有查詢 CLI 的產生器也可用,架構檢測那一整塊由腳本自己算。目前登記的產生器有兩個:graphify(多語言啟發式抽取,不含 Haskell)與 [knot](https://github.com/utomore/knot-hs)(只服務 Haskell,從 GHC `.hie` 抽型別檢查後的事實,圖直接落在專案根的 `codegraph.json`);支援語言、建圖 / 更新指令與各自的查詢對應見該片的「目前的產生器」表。

界線只有一條:**圖是導航,不是查證**——它只說「去哪裡看」,寫進 `.design/` 的每個簽名、相依、契約違反都必須回原始碼讀到原文再確認。圖會過期、會漏抽、`INFERRED` 的邊是推測的,所以它不能取代 `/spec-design` 那條「必須打開原始碼讀到實際定義」的防線。

檔案級的圖要捲回子系統級,靠 `design.md` frontmatter 的選填欄位 `code-paths: [src/auth]`;沒填就只能猜路徑,腳本會把可信度警告印出來。**沒有圖的專案完全不受影響**:各 skill 判定不到圖就整段略過,照原流程走。

### 委派展開(`/subsys-build`)的設計要點

Level 2 把契約鎖死之後,Level 3 就變成**可委派**的:相依性查證、骨架、把 law 翻成 property test、把 `undefined` 換成實作,都是機械性工作,不需要人。真正需要人的只有「功能邊界的取捨」,而那些可以**批次前置**到一次問完。整個流程建立在四個約束上:

- **subagent 問不了人** → 所有人類決策移到 fan out 之前的「批次澄清」;之後設計端的不確定寫成「待確認假設」繼續推進,qa/impl 端的不確定寫成 `spec-gaps` 停下該項,兩者都由編排者在閘門呈報
- **spec 錯了就是兩邊一起錯** → spec 寫完後設 **spec 批准閘門**(每一波批一次),人放行才 fan out qa 與 impl。停不停由批次澄清時選定的**閘門密度**(嚴格 / 標準 / 快速)與該波的議程共同決定:三道機械過濾跑完後**議程為空**(沒有不可逆決定、沒有未宣告的依賴邊、沒有契約層級假設)時,標準檔降級為**非阻塞呈報**——那一問問的是「你同意這份沒有爭議點的 spec 嗎」,蓋章慣了,有爭議點的那一波也會被順手蓋過去。**降級的是問不問,不是呈不呈報**
- **誤差沿依賴鏈複利** → 閘門設在**波次**(spec)與**階段**(驗收)邊界,不是全自動跑完;有阻塞或 spec bug 就立刻停下後續實作。仲裁**同一 feature 上限 3 輪**
- **平行會撞** → 配號(`F00x`)、**骨架檔案路徑**、`design.md` 回填、`build-log.md`、git commit 一律由編排者**單線**負責;spec 平行(各寫各的文檔與骨架,路徑由編排者指派不重疊)、qa 平行(測試檔互不衝突)、impl 也平行——靠的是同一條「骨架路徑波內不重疊」加上委派 prompt 裡的**寫入白名單**(要動清單外的既有共用檔就停下該項回報,不自己動手)。白名單寫在 prompt 裡只是要求,互蓋當下不會有任何錯誤訊息,所以收齊回報後由編排者拿**骨架快照 sha 對一次工作樹**(`git diff --name-only` 加 `git ls-files --others`,後者才看得到偷偷新增的檔案),每條變更路徑都要落在某份白名單、本波測試檔或編排者自己寫的檔案之內,結果記進 build-log。checkpoint 因此從每個 feature 一次改成**每波一次**,而對帳要排在 checkpoint 之前——`git add -A` 一吞,退回的粒度就從檔案變成整波

紅綠基線的**快照 worktree 在 fan out 之前就建好**(`git worktree add --detach`),不等發現骨架被填掉才補——qa 與 impl 平行跑,誰先落地不受編排者控制,「工作樹還乾淨就直接跑」那條捷徑會隨排程順序時靈時不靈。

**測試由編排者跑,不是由 subagent 自己宣稱**——qa 與 impl 各自只看得到自己那一半,只有編排者兩邊都看得到,所以仲裁只能發生在這一層。委派模型固定:spec 用 **opus**(唯一在做契約判斷的一層,錯誤要到仲裁才浮出來),qa 與 impl 用 **sonnet**(拿到的是已鎖死的 spec 與骨架),編排者不指定、跟隨開發者當下的 session。固定下來,閘門看到品質問題時就歸因得回 spec 寫得夠不夠,不會混進模型差異。

用 subagent 的主要理由是 **context 隔離**:相依性查證要讀大量原始碼,那些 context 留在 subagent 裡,編排者只收結構化回報——即 conventions 裡「Context 載入紀律」的自動化版本。`build-log.md` 記配號表(含骨架路徑與模型欄)、委派決策、待確認假設彙總、**仲裁紀錄**與各階段結果,讓中斷後能接續、事後查得到當初為什麼這樣決定;仲裁紀錄那張表是事後判斷「spec 哪裡寫不清楚」的唯一資料。

## talk-flow

演講內容產生流程的 Claude Code plugin,投影片以 **Marp Markdown** 撰寫、**marp-cli** 建置輸出(html / pdf / pptx),SVG 只用來畫圖形(架構圖、流程圖等),講稿簡化為頁內備註(presenter notes,提醒式、不寫逐字稿)。**投影片上的文案一律直述句** —— 對比翻轉句(「分不出差別,不等於一樣好」)與人稱代名詞(「我們」「大家」)是全流程的硬性禁區,**每頁標題一句話寫出這頁的重點主軸**(非必要不用逗號、不寫「介紹/說明什麼」的描述),產文時不得違反、`/review` 逐條扣分,規範見 `_shared/wording.md`。包含六個 skills:

流程是三層階梯,**每層只決定自己顆粒度的事**:Level 1 定語意(核心訊息、段落切分、視覺規範的語意)、Level 2 定內容(每頁講什麼、要不要圖)、Level 3 定呈現(版型、動線、SVG 幾何、theme 數值)。**視覺數值的唯一真相是 `talk/src/theme.css`**,`docs/` 的文件只記決定與理由,不複製一份 px 或色碼;下層需要上層沒定義的東西就回上層加,不在本層私設。

| 指令 | 職責 |
|---|---|
| `/topic-design` | **Level 1** 演講主軸設計 — 深度訪談時長/聽眾/會議類型/輸出格式,依場合選定**風格基底**(tech-deep/keynote-impact/intro-friendly/workshop-guide/exec-brief,見 `_shared/styles.md`,為版面/配色/分層/文字/圖形/節奏定預設方向),討論**前景/背景分層**的語意(要不要背景、素材從哪來、幾套各對應演講的什麼結構,見 `_shared/layers.md`),提供 3 組主題方案供選擇,產出燈塔文件 `docs/topic.md`(含**文字規範**:級別↔情境、強調方式用途、列表符號語意,執行期只能從中選用;與**投影片分層**:背景套數↔語意、角標 —— 兩節都只記語意不記數值)、Marp 鷹架(`talk/src/`:theme.css 填起始值、deck-header.md、build.mjs、.marprc.yml)與各 section 佔位文檔 |
| `/section-design` | **Level 2** 段落設計 — 逐段規劃討論方向、內文內容與形式(條列/表格/段落)、是否需要圖形輔助與圖形類型(見 `_shared/diagrams.md` 的選型表)、每頁的一句話重點與背景的語意需求;不指定版型、背景類別與圖形畫法。產出完整 `docs/section-0x-*.md`;子命令 `status` 用腳本掃描各段落狀態並比對 `topic.md` 的 `sections` 清單 |
| `/section-impl` | **Level 3** 段落實作(在上層規範內有完全的呈現自主權)— 逐頁決定 Layout(整頁單一區塊/左右/上下/上中下/三等份/四象限/上三下二…,版型詞彙見 `_shared/layouts.md`)與**背景類別**(`bg-none`/`bg-soft`/`bg-strong`/`bg-2`/`bg-3`),並對每頁說得出**視覺動線**,文字技法只從文字規範選用,撰寫 `talk/src/section-0x-*.md` 的 Marp 頁面與 `<!-- 備註 -->`,繪製圖形 SVG(規範見 `_shared/diagrams.md`,含**截圖加註**:原圖 base64 內嵌 SVG 疊編號標記 + 圖下對應圖例),`node build.mjs` 建置驗收;第一段完成後做**分層強度定案**(調 theme.css 的 `--bg-opacity`,不回寫 topic.md);需要時建立 `demo/` |
| `/page-adjust` | **Level 3** 單頁調整 — 針對指定頁面深談 Layout/內文/圖形/背景/備註調整(文字技法仍受 topic.md 文字規範約束、背景仍受投影片分層的語意約束;theme.css 數值調整屬本層職權,不回寫 topic.md),修改 Marp 原始碼與 SVG 後重 build,同步 section 設計文件 |
| `/svg-layout` | 架構圖 SVG 排版量測(唯讀三腳本)— `normalize.py` 補齊語意化 id 與 `data-role/from/to`(只寫標註不動幾何,id 穩定不漂移);`inspect_svg.py` 輸出 scene digest(累積巢狀 transform 的絕對 bbox、以 fontTools 實測中英混排標籤寬度、edge 拓撲、對齊與間距序列);`lint.py` 診斷 15 條規則(文字溢出/內距/投影字級/對比、連線端點間隙/穿越節點/標籤壓線/缺箭頭/交叉、尺寸間距不一致/幾乎對齊/超出畫布),每條給量化偏差與修正方向 |
| `/review` | 整體審查 — 腳本交叉比對段落覆蓋、deck↔docs 頁數同步、圖形引用完整性、**分層資產與背景槽位**、依賴順序、時間帳與產物新鮮度,再 **build 後逐頁目視** Layout、視覺引導動線、文字規範遵循(字級/強調/列表符號/行距)、版型與配色收斂、**前景/背景分層**(背景有沒有搶第一眼、正文讀不讀得清、換背景對不對得上語意)、圖形連接線轉折(>2 折扣分)、備註品質、用語概念一致、**文案語感**(對比翻轉句「A,不等於 B」「不是 A,而是 B」、人稱代名詞「我們/你/大家」、空泛詞,以及**標題寫法**「逗號串兩件事/描述式標題/標題帶前提」 —— 腳本先給命中清單,確認後逐條扣分,標題/副標出現翻轉句或人稱是阻斷項)與 AI 感,並判斷主軸貼合度、偏題比例、銜接與難度峰值,產出十四項指標的審查報告 `review/review-<日期>-<序號>.md`;不修改任何原始碼 |

演講專案的資料夾結構:`docs/`(topic.md 與 section 設計文件)、`talk/src/`(Marp 原始碼與設定:deck-header.md、每 section 一檔 `section-0x-*.md`、theme.css、build.mjs、.marprc.yml)、`talk/assets/`(圖形 SVG `diagram-<section>-<序號>-<slug>.svg`、背景 `bg-<slug>.svg`、角標 `logo.svg`)、`talk/dist/`(marp-cli 輸出產物,不手改)、`review/`(審查報告)、`demo/`(可選)。每份手寫文件(含圖形與背景 SVG)都有 metadata;共用慣例與**層級顆粒度表**在 `plugins/talk-flow/skills/_shared/conventions.md`,版型詞彙在 `_shared/layouts.md`,風格基底在 `_shared/styles.md`,分層(前景/背景)詞彙在 `_shared/layers.md`,圖形(選型表、繪圖紀律、截圖加註)在 `_shared/diagrams.md`,**文案語感**(禁用句型、人稱指稱與正面寫法)在 `_shared/wording.md`。

投影片分**背景層**(裝飾,`section::before` 畫,不承載資訊)與**前景層**(標題、內文、圖形、頁碼、固定角標)。背景可以是 CSS 漸層、使用者提供的圖片,或 LLM 依討論出的風格現畫的 SVG(`topic-design/assets/backgrounds/` 附三張起手範本);全場最多三套背景槽(`--bg-image` / `--bg-image-2` / `--bg-image-3`),**每頁背景都可以不同** —— 頁面用 `<!-- _class: bg-2 bg-strong -->` 這類類別切換,強度由 `--bg-opacity` 控制,圖表/截圖頁用 `bg-none` 關掉。`/topic-design` 定「幾套、各代表什麼」,`/section-impl` 決定逐頁用哪一個並在有真實頁面後定案強度。

## 安裝(新環境一鍵導入)

在 Claude Code 內執行:

```
/plugin marketplace add utomore/uto-skills
/plugin install dev-flow@uto-skills
/plugin install talk-flow@uto-skills
```

或在終端機執行:

```
claude plugin marketplace add utomore/uto-skills
claude plugin install dev-flow@uto-skills
claude plugin install talk-flow@uto-skills
```

## 更新

repo 有新版本後:

```
/plugin marketplace update uto-skills
```

## 文檔慣例摘要(dev-flow)

設計文檔樹與系統架構樹同構:根節點是主架構、第二層是各 subsystem。所有文檔放在專案 `.design/`,檔名英文 kebab-case、內文繁體中文:

```
.design/
├── system.md                        # /system-design:Level 1 主架構(`subsystems` 為完整名冊 + 開發階段表)
├── subsystems/
│   └── <subsystem-slug>/
│       ├── design.md                # /subsys-design:Level 2 子系統架構(模組群 + 功能規劃 + Feature 契約卡;`parent: system` 回鏈)
│       ├── build-log.md             # /subsys-build:配號表、委派決策、待確認假設彙總、仲裁紀錄、階段結果(跑過才有)
│       ├── spec-gaps.md             # /spec-qa 與實作 skill 追加:spec 模糊處待修訂清單(有 gap 才有)
│       ├── features/F001-<slug>.md          # /spec-design(spec 文檔;骨架寫在專案原始碼樹)
│       ├── enhancements/E001-<slug>.md      # /spec-design
│       └── bugfixes/B001-<slug>.md          # /bugfix
├── enhancements/G-E001-<slug>.md    # 跨子系統的全域優化
├── bugfixes/G-B001-<slug>.md        # 跨子系統的全域修復
├── spikes/SPK-001-<slug>.md        # /spike:可行性驗證紀錄(非任務文檔;程式碼在專案根目錄的 sandbox spike/SPK-001-<slug>/,結案即刪、sha 留在文檔)
└── adr/ADR-001-<slug>.md            # 架構決策紀錄,全局共用
```

編號**三位數**遞增、不放日期(日期在 frontmatter 的 `created` / `updated`);**每個子系統自己一組編號**(F/E/B 各自計數)、全域 G- 自己一組、ADR 全局一組。跨子系統引用寫 `<subsystem>/<id>`(如 `auth/F002`),同子系統直寫 id,全域直寫 `G-E001` / `ADR-003`。

任務文檔開頭必須有 YAML frontmatter(`id` / `type` / `title` / `description` / `status` / `created` / `updated` / `depends-on` / `related-adr` / `related-feature` / `code-paths`;全域文檔另加 `subsystems`),`status` 取值 `open | in-progress | done | closed`,狀態掃描腳本(`plugins/dev-flow/skills/arch-audit/scripts/scan-status.mjs`)只解析這一段,清單欄位一律行內陣列 `[a, b]`。子系統 `design.md` 另有選填的 `code-paths`(程式碼路徑**前綴**),供 `scan-graph.mjs` 把檔案級的圖捲回子系統級。

### spec 文檔 ↔ 實作:兩條線都要指得回去

「這份 spec 做成什麼了」與「這個檔案是哪份 spec 做的」是**兩個方向**,各由一個機制答:

| 方向 | 機制 | 誰維護 |
|---|---|---|
| spec → 程式碼(逐條介面) | spec「介面」表的**骨架位置**欄,寫 `檔案#符號`。**不准寫行號**——行號在 impl 把未實作標記換成本體的那一刻就往下移,而沒有任何角色負責回頭修它;`lint-laws.mjs` 會擋 | `/spec-design`,一致性檢查時對帳 |
| 程式碼 → spec(逐個檔案) | 任務文檔 frontmatter 的 **`code-paths`**,`scan-status.mjs --file <path>` 現掃現算(不另存索引),答「這條路徑歸哪個子系統、被哪些 F/E/B 動過、各是什麼狀態」 | `/spec-impl`、`/bugfix` 在收尾**與 `status: done` 同一個動作**回寫;委派模式下 impl 回報路徑、編排者填 |

`code-paths` 綁在 `status` 上是刻意的:單獨拉出來的「記得更新索引」這種步驟,漏了不會有任何東西抱怨(程式碼真的寫好了,只有帳沒回),一定會爛掉。`status` 是 `done` 卻留著空 `code-paths` 時,`/arch-audit status` 會列進提示。

### 進度與阻塞是兩個維度

`status` 是**累加**的(`open → in-progress → done`),spec-gap 則是從**任何一格**都會發射的**中斷**——qa 寫不出斷言時撞到、impl 發現非改簽名不可時撞到。所以 gap 不佔 `status` 的任何一個值,而是標回那份文檔的狀態欄:

```
login 功能          F001  feature  in-progress                 ← 正在做
token-refresh 功能  F002  feature  in-progress ⚠卡GAP-1,GAP-2  ← 卡死,等 spec 修訂
```

兩者的下一步完全相反(繼續做 vs 回頭修 spec),而在這之前它們在報表上長得一模一樣。歸屬靠 gap 條目標題裡的文檔 id(`## GAP-1(F002 / qa)`)認,零新欄位。

### 分母紀律:名冊、開發階段、模組群

進度的分母**必須來自規劃,不能來自產出**。這條慣例是修一個真實失真修出來的:名冊若只收「已經建了 `design.md` 的子系統」,它就跟資料夾清單同義,雙向比對永遠成立,而還沒開工的那一大半在任何數字裡都不存在——報表於是宣稱一個只做了引擎層的遊戲專案「48/49 完成」。

因此有三層分母,各有唯一權威:

| 分母 | 住在哪 | 誰維護 | 答什麼問題 |
|---|---|---|---|
| **開發階段**(產品級) | `system.md` 的「開發階段」表,狀態只有 `未開始 / 進行中 / 已達成` | `/system-design` | 產品做到哪、還差什麼 |
| **子系統名冊** | `system.md` frontmatter 的 `subsystems`,**含還沒建 `design.md` 的** | `/system-design`(新增或廢棄子系統時) | 一共要做幾個子系統、幾個還沒開工 |
| **模組群** | 各 `design.md` 的「模組群」表,狀態只有 `active / planned` | `/subsys-design` | 這個子系統裡幾個平行領域寫了契約、幾個還沒 |

`/arch-audit status` 會分別列出「已規劃、未建 design.md 的子系統」與「已規劃、契約未寫的模組群」,任一非空或任一階段未達成時 exit code 為 1。子系統狀態表的百分比**只涵蓋已展開的部分**,不是產品完成度;回報一律**先講還沒做的,再講已完成的百分比**。

### 編號與縮寫:一張註冊表,兩支腳本在守

所有會被編號的東西登記在 `_shared/doc-lifecycle.md`「編號與縮寫註冊表」。三條鐵律:**「單字母+數字」只留給文檔 id(三位數、永不簡寫)與開發階段(`S0`…`Sn`)**;檔案內的條目一律**詞首碼**(`LAW-` / `REG-` / `EX-` / `GAP-` / `ASM-` / `SELF-` / `DEC-` / `WAVE-` / `STEP-`);`Level` 一律寫全名(`L` 誰都不給)。

這張表是修一次真實撞號修出來的 —— `E1` 曾同時是 Example 1、`E001` 的簡寫與專案的階段名,`L1` 曾同時是 Law 1、Level 1 與專案的 Layer 1。註冊表本身是文檔,靠自覺會漏,所以配兩支腳本(`plugins/dev-flow/skills/arch-audit/scripts/`):

| 腳本 | 回答什麼 |
|---|---|
| `id-map.mjs` | 給 `.design` 路徑 → 一張 **system → 子系統 → 模組群**的階層表(F/E/B 份數、LAW/EX 測試分母、ASM/GAP、委派批次、哪些子系統還沒建檔、哪些 spec 還是舊版模板)。`/arch-audit status` 會**先跑它並原樣貼在回報最前面**當定位;不帶參數 → 把註冊表畫成流程形狀的樹 |
| `lint-ids.mjs` | 揪出**裸寫**的「單字母+數字」。被禁的形式只准出現在反引號裡(那是在講這個寫法),裸寫就是真的拿它當識別碼在用。`--allow` 讓專案帶自己的前綴進來,exit 1 = 有違規 |

腳本共七支(`plugins/dev-flow/skills/arch-audit/scripts/`),**每一支都吃 `--help`**,而 `--help` 印的就是該檔檔頭那段「用法 + Exit code」——同一份文字,不可能分岔。所以 skill 文檔裡不抄旗標與 exit code 數值,只留「一行常用指令」與「誰能用、用到什麼程度」(後者腳本產不出來,它不知道是誰在呼叫它)。

改過 `scripts/` 之後跑 `bash plugins/dev-flow/skills/arch-audit/tests/run.sh`:fixture 回歸(14 項輸出與 exit code 逐字比對)、對 plugin 自己文檔的四道檢查(`lint-ids` / `lint-laws` / 章節名 / 指令旗標)、七支腳本的 `--help`。**這套測試是修真實事故修出來的**——抽共用解析器時它抓到三處同名不同答案的解析器,以及一個「程式碼圍欄裡的假標題會把章節提前切斷」的靜默錯誤,四個都不會拋例外。

格式解析集中在四支 `_` 開頭的模組(`_gap-status` / `_sections` / `_frontmatter` / `_tables`),CLI 只管自己的輸出與 exit code。**一種格式只准有一個解析器**——這條是修真實事故修出來的:`section()` 曾經有兩份(一份含標題行、一份不含)、`frontmatter()` 曾經有兩份(一份剝引號、一份不剝,而且對 YAML 區塊列表靜默讀成空值)、`tableCells()` 曾經同名不同約(一份回 `null`、一份回陣列)。三處都不會報錯,只會讓兩支腳本對同一份檔案給出不同答案。

`description` 為**一句話、繁體中文、40 字以內**的文檔主軸,**所有類型都要寫**(feature 寫「這功能做什麼」、bugfix 寫「什麼壞了」、enhance 寫「要改善什麼」、adr 寫「決定了什麼」),讓 `/arch-audit status` 不必開檔就能看出每份文檔在講什麼;缺這欄會被腳本列為不合規並以 exit code 1 收場。

## Repo 結構

本 repo 同時是 marketplace 與 plugin 本體,但兩者分層:

```
.claude-plugin/marketplace.json     # marketplace「uto-skills」定義
plugins/
├── dev-flow/                       # ← 安裝時只有被裝的 plugin 目錄被複製
│   ├── .claude-plugin/plugin.json  # plugin「dev-flow」(skill 前綴 dev-flow:)
│   └── skills/                     # 各 skill 的 SKILL.md 與腳本
└── talk-flow/
    ├── .claude-plugin/plugin.json  # plugin「talk-flow」(skill 前綴 talk-flow:)
    └── skills/
wip/                                # 未上架的 plugin 草稿,只在 repo,不進 payload
README.md                           # 只在 repo,不進 payload
```

`marketplace.json` 的 `plugins[].source` 指向各 plugin 目錄(如 `./plugins/dev-flow`),安裝時**只有該子目錄**會被複製進使用者的 `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`。repo 根目錄的 `README.md`、`docs/` 等開發用檔案不會進到 payload — 使用者每裝一個版本就多一份快照,payload 保持精簡是有意義的。

日後新增 plugin:在 `plugins/` 下開新目錄,到 `marketplace.json` 的 `plugins[]` 加一筆即可。marketplace 名稱、plugin 名稱與 GitHub repo 名稱彼此獨立。

`wip/` 放**還沒上架**的 plugin 草稿:目錄結構與 `plugins/` 下的一樣,但不在 `marketplace.json` 裡,Claude Code 也不會把它當成 skill(發現路徑是 `plugins/<plugin>/skills/<name>/SKILL.md`)。目前有一個:

- [`wip/game-flow/`](wip/game-flow/) —— 遊戲資源設計流程(八個 skill),包裝 [story-flow](https://github.com/utomore/story-flow)(設定片段圖譜與場景樹)與 [assetdb](https://github.com/utomore/assetdb)(素材庫索引與專案配置)。**兩個 CLI 都還在開發中,等它們穩定後一次整合再上架**;內容、上架前的確認事項與上架步驟見該目錄的 `README.md`
