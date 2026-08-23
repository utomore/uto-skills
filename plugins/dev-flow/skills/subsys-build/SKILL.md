---
name: subsys-build
description: 依 Level 2 功能規劃自動展開整個子系統(orchestrator 角色)— 解「依賴」欄排波次、批次澄清一次問完、預先配號與指派骨架路徑後委派 subagent 平行寫 spec 與骨架,**停下來等使用者批准 spec**,再讓 qa 與 impl 互相不可見地平行執行,由編排者跑測試與仲裁(同一 feature 上限 3 輪),每階段跑 arch-audit 後停下來給開發者驗收。觸發詞:子系統展開、subsys build、自動展開、批次開發、委派開發、跑完子系統、一次做完子系統。Use when auto-expanding a whole subsystem from its Level 2 feature roadmap via delegated spec/qa/impl subagents with per-wave spec approval and per-stage gates.
user-invocable: true
---

# /subsys-build — 子系統委派展開(orchestrator 角色)

先讀取 `../_shared/conventions.md`(核心慣例)、`../_shared/spec-roles.md`(**三角色契約**——你是那一片裡的「編排者」,仲裁協議是你的職責)與 `../_shared/delegation.md`(**委派模式共通契約**);批次澄清要分類問題層級時,另讀 `../_shared/boundary-rules.md`;要建或改 `build-log.md` / `spec-gaps.md` 的 frontmatter 時,另讀 `../_shared/frontmatter.md`;要在既有程式碼上展開、且專案有程式碼知識圖時,另讀 `../_shared/codegraph.md`(排波次的依賴對帳用);階段閘門與收尾時另讀 `../_shared/anchor.md`(定錨區塊格式)。

## 目標

拿一個 Level 2 已設計完成的子系統,依 `design.md` 的「功能規劃」與「Feature 契約卡」,把 Level 3 的 spec、測試與實作**委派給 subagent** 一路做完:

```
批次澄清(人在場,一次問完)
    ↓
每個階段的每一波:
    配號 + 指派骨架路徑 → 委派 spec(平行)→ 【spec 批准閘門:人放行】
        → 委派 qa ∥ impl(互相不可見)→ 你跑測試 → 仲裁(≤3 輪)
    ↓
階段閘門(arch-audit + 回報,人放行)→ 下一階段
```

## 你自己做什麼、不做什麼

**這是本 skill 最重要的分工,違反就會出現撞號與文件互蓋。**

| 只有你(編排者)能做 | 委派給 subagent 做 |
|---|---|
| 問開發者(批次澄清、spec 批准閘門、階段閘門) | 寫 spec 文檔與骨架 |
| 配號(F00x)、決定檔名 slug、**指派骨架檔案路徑** | 相依性查證(讀原始碼確認簽名) |
| 寫入 `design.md`(回填 `doc` 欄)與 `system.md` | 寫測試(qa)、寫實作(impl) |
| 寫入 `build-log.md` | — |
| **跑測試、做仲裁**(`spec-roles.md`「仲裁協議」) | — |
| 跑 `/arch-audit`、彙整回報 | — |
| git commit(波次 checkpoint、階段收尾) | **不碰 git**:不 add、不 commit、不切分支 |

你**不寫任何 spec、不寫任何測試、不寫任何實作**。你的產出只有:`build-log.md`、`design.md` 的回填、git commit、仲裁裁決、給開發者的回報。

## 前置(不可跳過)

1. 確定目標子系統:引數有給就用;沒給就讀 `.design/system.md` 的 `subsystems`,用 AskUserQuestion 讓開發者選
2. 讀 `.design/system.md` + 該 `subsystems/<slug>/design.md` 全文 + frontmatter `related-adr` 列的 ADR。**不相關的子系統不讀**
3. 跑一次狀態掃描,取得現有 feature 文檔與不一致清單:

   ```
   node "<arch-audit skill 目錄>/scripts/scan-status.mjs" .design
   ```

4. **委派門檻檢查**(任一項不過就停下來,不要硬跑):
   - 有「功能規劃」表格,且「依賴」欄構成的圖無環
   - 功能規劃每一列都有對應的「Feature 契約卡」;卡片的五個欄位都填了實質內容
   - 每張卡「實作的 Level 2 介面」引用的條目,在 `design.md` 的契約章節找得到
   - 掃描沒有「架構 / 子系統不一致」
   - `spec-gaps.md` 沒有 `open` 的條目(有的話代表上一輪還有 spec 沒修完,先處理)

   不過關時:列出缺什麼,告知開發者先走 `/subsys-design` 更新模式補齊(契約卡不完整就委派,等於讓 subagent 腦補契約——這正是本流程要避免的事),然後結束。

5. `build-log.md` 已存在 → **接續模式**:讀它,跳過已完成的波次,從中斷處繼續(配號沿用既有的表,不重配)

6. **工作樹檢查**:`git status` 要乾淨。checkpoint commit 用 `git add -A`,開跑時若有無關的改動會被一起吞進去——不乾淨就請開發者先 stash 或 commit。接續模式下另外對照 `git log`,確認 build-log 記的進度與 git 歷史一致(對不上以 git 為準,build-log 補正)

## 1. 排波次

從「功能規劃」建依賴圖:

1. 節點 = feature;邊 = 「依賴」欄(`#n` 指同/前階段的項次,`<slug>/<id>` 或 `G-*` 指跨子系統文檔)
2. 跨子系統或全域的依賴:確認那份文檔是否已 `done`。未完成的,在批次澄清時問開發者是「等」還是「照介面約定先做」
3. 拓撲排序切波次:同一波 = 所有依賴都已滿足的 features,可平行
4. **階段(`###` 標題)是硬邊界**:波次不跨階段——階段 N 全部驗收通過才進階段 N+1
5. **骨架檔案不得在同一波內重疊**:依契約卡的「負責模組」預估每個 feature 的骨架會落在哪些檔案;兩個 feature 指向同一個檔案時,把後者拆到下一波。**這是 3a 指派骨架路徑的前提**——平行的 spec subagent 會同時寫骨架,撞到同一個檔案就會互蓋
6. 本子系統已有程式碼(接續模式,或在既有程式碼上加功能)且專案有程式碼知識圖時,跑一次 `node "<arch-audit skill 目錄>/scripts/scan-graph.mjs" .design --subsys <slug>` 對帳:程式碼實際的跨子系統依賴,與契約卡宣告的依賴對不對得起來?**對不上的差異不要自己吸收**,帶進步驟 2 的批次澄清問開發者

把「階段 → 波次 → features」的排程呈現給開發者(這是後面一切的骨架,值得先讓人看一眼)。

## 2. 批次澄清(人唯一深度參與的地方)

**這一步的品質決定整個委派的品質。** subagent 問不了人,所以現在要把**所有** feature 的人類決策一次挖乾淨。

先逐張契約卡讀過,自己找出「執行者會卡住或會亂猜」的點,依 `../_shared/boundary-rules.md`「層級判斷」分類(影響半徑只在模組內 → 執行者自己決定,不必問;會動到邊界、依賴或未來修改代價 → 要問):

- **契約類**(介面、DTO、錯誤語意、邊界歸屬):屬 Level 2。開發者答完後,**回寫進 `design.md` 的對應章節或契約卡**——這是契約的補完,本來就該留在 Level 2
- **執行取向類**(套件選擇、資料結構偏好、測試深度、遷移相容性、要不要先做假資料):不屬 Level 2(寫進去會違反抽象邊界)。答完後寫進 `build-log.md` 的「委派決策記錄」
- **測試框架類**:專案還沒有 property-based 測試框架時,現在就問要不要引入、用哪一個——**qa 在委派模式下不得自行引入依賴**,不先問就只能退化成參數化測試
- **排程類**:未完成的跨子系統依賴要等還是照約定先做、這次要跑到第幾階段

用 AskUserQuestion 分組問(每題附你的建議選項與理由);寧可一次多問幾輪也不要留著讓 subagent 猜。**問完後把「還剩哪些不確定」明確講出來**——這些會變成 subagent 的「待確認假設」,開發者要知道自己選了什麼風險。

澄清結束後建立 / 更新 `build-log.md`(格式見下),並把契約類的回寫套進 `design.md`(同步 `updated`)。

## 3. 每個階段的執行迴圈

對當前階段的每一波,依序跑 3a → 3f。

### 3a. 預先配號、指派骨架路徑與模型(你做,fan out 之前)

掃 `subsystems/<slug>/features/` 取 `F` 最大編號,**為本波(建議直接為整個階段)每個 feature 預先分配**三樣東西,寫進 `build-log.md` 的配號表:

1. `F00x` 編號與檔名 slug
2. **骨架檔案路徑**(依步驟 1 第 5 點的預估;同一波內不得重疊)
3. 執行模型(見下表)

**這一步不能省也不能延後**:`/feature-design` 原本的配號規則是「掃資料夾取最大值 +1」,平行 subagent 同時掃會全部拿到同一個號;骨架路徑同理,不由你指派就會兩個 subagent 同時建同一個檔案。號與路徑都由你發,衝突就不存在。

**模型分派(每次呼叫 Agent 工具都必須明確帶上 `model`,不得省略讓它繼承主 session):**

| 角色 | 委派的 skill | 模型 |
|---|---|---|
| spec | `dev-flow:feature-design` | **`opus`** |
| qa | `dev-flow:spec-qa` | **`sonnet`** |
| impl | `dev-flow:feature-impl` | **`sonnet`** |
| 編排者(你) | — | 不指定,跟隨開發者當下的 session 模型 |

理由:只有 spec 那一層在做**契約判斷**——寫錯會沿著 qa 與 impl 兩條投影一起錯,而且錯誤要到仲裁才浮出來,值得用最強的模型;qa 與 impl 拿到的是已經鎖死的 spec 與骨架,做的是翻譯與填空,判斷空間有限。把分派固定下來,子代的成本與行為就不隨主 session 當下用哪個模型漂移,閘門看到品質問題時也能直接歸因到 spec 寫得夠不夠,而不是模型差異。

模型是**呼叫 Agent 工具時的參數,不是 prompt 內容**——寫進 prompt 模板不會報錯,只是靜默沒作用。

### 3b. 委派 spec(平行,opus)

本波每個 feature 各開一個 subagent,**同一則訊息內一次送出**讓它們併發。spec 文檔各寫各的檔案、骨架路徑由你指派過不重疊,所以平行安全。每一個呼叫都要帶 `model: "opus"`。

用 subagent 的真正理由是 **context 隔離**:相依性查證要讀大量原始碼,那些 context 留在 subagent 裡,你只收回結構化回報。這就是 conventions 的「Context 載入紀律」自動化版本。

每個 subagent 的 prompt 必須包含:

```
【委派模式】遵守 <delegation.md 路徑> 的委派模式共通契約:不得提問、
不得寫 design.md/system.md、不得自行配號、機械性查證不可跳過。
你是 spec 角色,遵守 <spec-roles.md 路徑>:不寫實作邏輯、不寫測試,
骨架的函數本體一律未實作標記且必須通過編譯。

執行 dev-flow:feature-design,目標:
- 子系統:<slug>            設計文檔:.design/subsystems/<slug>/design.md
- 指定 id / 檔名:F00x / F00x-<slug>.md     (由編排者配號,不得自行掃描)
- 指定骨架檔案路徑:<路徑清單>              (不得寫到清單外的檔案)
- 契約卡:<整張卡原文>
- 委派決策記錄(相關條目):<從 build-log 摘出與本 feature 有關的決策>
- 已完成的前置 feature 與其文檔 id:<...>

完成後依「回報格式」回報,不要寫成給人看的說明文。
```

回報收齊後,由**你**做:

1. 回填 `design.md` 功能規劃的 `doc` 欄(**單線寫,一次寫完所有列**,同步 `updated`)——這是唯一避免平行寫同一檔互蓋的方法
2. 跑一次編譯 / 型別檢查,確認整波的骨架**合起來**也編得過(各自編得過不代表放在一起沒衝突)
3. 彙整所有「待確認假設」與「建議修改的 Level 2 契約」,**先不要自己改契約**,留到閘門讓開發者裁決
4. 有 subagent 回報阻塞 → 不要換個說法重試同一件事;記進 build-log,帶到閘門
5. commit 本波的 spec 與骨架(message 例:`docs(<slug>): W2 spec + 骨架`)

### 3c. spec 批准閘門(人放行,不可跳過)

**qa 與 impl 都只讀 spec,spec 錯了就是兩邊一起錯。** 所以 fan out 之前先讓開發者看一眼。本波的 spec 全部寫完後一次呈報(不是一個 feature 打斷一次):

1. 每份 spec 的**目的、介面表、Laws、Examples** 摘要——重點是 Laws 與 Examples,那是驗收標準的可執行形式
2. 骨架檔案清單與編譯結果
3. 本波的「待確認假設」全部條列
4. 你自己讀過之後的疑慮:哪條 law 讀起來有兩種解釋、哪個介面沒有被任何 law 或 example 覆蓋

用 AskUserQuestion 讓開發者選:**批准,繼續** / **要改哪幾份 spec**(改完重跑 3b 的該幾個 feature)/ **停下來**。

批准之前**不得**發出任何 qa 或 impl 的委派。

### 3d. 委派 qa 與 impl(互相不可見)

批准後,對本波:

- **qa 全部平行發出**(每個 feature 一個 subagent,`model: "sonnet"`)——測試檔各寫各的,互不衝突
- **impl 依依賴順序序列跑**(`model: "sonnet"`),前一個回報完才發下一個——同一子系統的 features 常改同一批實作檔案,平行會互相蓋掉。真要平行得用 git worktree 隔離再 merge,成本明顯高一截,不是預設選項
- **qa 與 impl 之間不設先後**:它們的檔案集不相交(測試檔 vs 實作檔),誰先完成都不影響對方

prompt 格式同 3b,skill 換成 `dev-flow:spec-qa` 或 `dev-flow:feature-impl`,目標填文檔 id,並明確寫上角色禁區:

```
你是 qa 角色,遵守 <spec-roles.md 路徑>:只讀 spec 的數據/介面/Laws/Examples 與骨架,
禁止閱讀任何實作程式碼;程式碼知識圖只准用來定位測試檔與型別結構,
不得用它推論受測函數的行為。禁止修改骨架、禁止要求測試後門。
交付前確認測試「編譯通過 + 紅綠符合預期」。
```

```
你是 impl 角色,遵守 <spec-roles.md 路徑>:禁止讀寫任何測試檔、
禁止改動骨架的簽名與型別定義。紅燈只做歸因不做仲裁,列為阻塞項回報。
```

每個 impl 回報收到後:

- 有阻塞或新增 spec-gaps → **立刻停下本波的後續 impl**,不要繼續往下堆(誤差沿依賴鏈複利是本流程最大的風險),直接進 3e
- 順利完成 → 記進 build-log,**立刻 commit(checkpoint)**,再發下一個

checkpoint commit 由**你**做,subagent 不碰 git。一次只有一個 impl 在跑,但 qa 可能同時在寫測試檔——`git add -A` 會把半成品的測試一起吞進去,所以 checkpoint 要等本波的 qa 也全部回報完才做。message 帶上文檔 id(例:`feat(<slug>): F006 <feature-slug>`),讓 build-log 的進度與 git 歷史對得起來。

checkpoint 的用途不是「這段程式碼已驗收」——驗收在閘門。它是**可回退的已知良好狀態**:上面那條「有阻塞就停下」的規則,要有 checkpoint 才退得回去。

### 3e. 跑測試與仲裁(你做,上限 3 輪)

本波的 qa 與 impl 都回報完後,**由你**執行完整測試套件。**不要相信 subagent 回報的測試結果就跳過這一步**——它們各自只看得到自己那一半。

全綠 → 進 3f。

有紅 → 照 `../_shared/spec-roles.md`「仲裁協議」逐條處理,**禁止直接叫 impl 重寫**:

1. 先歸因:這條失敗對應 spec 的**哪一條 law 或 example**?
2. 對應得上、測試與原文一致 → **impl 錯**:把該條 spec 原文附給 impl 要求修正(新開一個 `dev-flow:feature-impl` 委派,`model: "sonnet"`,prompt 只給失敗清單與對應條文,**不得附上測試原始碼**)
3. 對應得上、測試與原文不符 → **qa 誤讀**:附條文原文要求 qa 改測試(`dev-flow:spec-qa`,`model: "sonnet"`,**不得附上實作原始碼**)
4. 對應不上、或 spec 沒涵蓋 → **spec bug**:**停下來向開發者回報,等 spec 修訂**。禁止讓 qa 與 impl 自行協商,也禁止你自己補一條 law 就繼續跑
5. **同一個 feature 上限 3 輪**:三輪仍有紅就停止並升級給開發者,附失敗摘要與你判斷的**結構性原因**(介面切錯、law 互相矛盾、example 與 law 不一致、前置 feature 行為與 spec 不符),**禁止繼續嘗試**

每一輪的裁決都記進 `build-log.md` 的「仲裁紀錄」:第幾輪、哪條測試、歸因結論、依據的 spec 條文。這張表是事後判斷「spec 哪裡寫不清楚」的唯一資料。

### 3f. 階段閘門(人放行)

本階段全部波次完成(或提前停下)後:

1. 跑 `node "<arch-audit skill 目錄>/scripts/scan-status.mjs" .design`
2. 專案有程式碼知識圖時,先照 `../_shared/codegraph.md` 把圖更新到最新再進下一步——本階段剛寫進去的程式碼不在舊圖裡,不更新的話閘門的架構檢測看到的是上一階段的世界
3. 跑 `/arch-audit subsys <slug>`——檢查資料流管線一致性、SRP、邊界外洩、模組介面漂移。**這是委派品質的把關點**,不可跳過
4. 更新 `build-log.md` 的本階段結果
5. 向開發者回報,固定五塊:
   - **完成了什麼**:features、介面實作數(n/m)、測試結果(law 幾條、example 幾條、通過/失敗)
   - **未結的 spec-gaps**:每一條的內容、卡住哪個項目、需要 spec 回答什麼——**這是閘門的重點,不能只講「都完成了」**
   - **待確認假設**:全部條列(來自哪個 feature、採取了什麼判斷、判斷錯要改什麼)
   - **仲裁紀錄摘要**:幾輪、歸因分佈(impl 錯 / qa 誤讀 / spec bug),spec bug 的每一條都要點名
   - **arch-audit 發現** 與 **建議的上層變更**:依嚴重度排序
   - **定錨區塊**(`../_shared/anchor.md`):位置樹以本階段的 features 為「目前」、逐條列介面與型別的狀態;未結的 spec-gaps 與與契約牴觸的假設一律進偏離清單;下一步 = 下一點的三個選項
6. 用 AskUserQuestion 讓開發者選:**進下一階段** / **先修這些問題**(修 spec 後重跑該波的 qa+impl,或走 `/bugfix`、`/enhance-design`,或回 `/subsys-design` 改契約後重跑本階段) / **就此停下**
7. 開發者要修契約 → 由**你**更新 `design.md`(不是 subagent),更新後受影響的 feature 要重跑,不能靠既有產出將就
8. 詢問是否為本階段收尾(squash 成一個 commit 或打 tag 皆可;checkpoint 已在過程中留下,這裡只處理歷史整理)。**不主動 push**;整合發 PR 走 `/branch-pr`

## 4. `build-log.md`

路徑 `.design/subsystems/<slug>/build-log.md`。版面照本 skill 目錄下的 `templates/build-log.md`——建檔或更新時打開它照抄,六個章節:排程、委派決策記錄、配號表(含骨架路徑與模型欄)、待確認假設彙總、仲裁紀錄、階段結果。

全部階段完成後 `status` 改 `done`。

## 5. 收尾

- 摘要:跑了幾個階段、產出幾份 spec、幾條介面、測試總結、仲裁輪數與歸因分佈、契約卡是否在過程中被修訂
- **未結的 spec-gaps 與未裁決的待確認假設**:如果開發者選擇提前停下,明確列出還懸著的每一條
- **git 狀態**:已 checkpoint 到哪一個 feature、有沒有未 commit 的殘留
- 剩下的階段與繼續方式(再跑一次 `/subsys-build <slug>` 會走接續模式)
- 最後輸出**定錨區塊**(`../_shared/anchor.md`):位置樹展開本子系統全部 features 的最終狀態;未結的 spec-gaps 進偏離清單;下一步從樹上推(全部階段完成 → `/arch-audit system`、`/branch-pr`;提前停下 → 再跑 `/subsys-build <slug>` 接續)

## 邊界

- **不跑跨子系統**:一次只展開一個子系統。多個子系統要一個一個來(先跑被依賴的那個)
- **不改 Level 1**:過程中發現主架構要改,回報給開發者走 `/system-design` 更新模式,不自己動
- **不做 enhancement / bugfix 的委派**:`/enhance-design` 需要先讀程式碼再與人討論 scope、`/bugfix` 需要人確認重現條件,兩者都不適合無訪談委派。過程中發現的問題,在閘門建議開發者走 `/enhance-design`、`/bugfix`;enhance 的 scope 談完、spec 寫好之後,**後半段(qa ∥ impl → 測試 → 仲裁)走 `/spec-build <id>`**——那條迴圈與 feature 完全相同
- **單份 spec 不必動用本 skill**:只要跑一份已寫好的 spec(F00x 或 E00x),用 `/spec-build <id>` 就夠了;本 skill 多出來的是排波次、配號、階段閘門與 `design.md` 回填
- **契約卡不完整時不啟動**:前置第 4 條的門檻是硬性的
