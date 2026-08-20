---
name: subsys-build
description: 依 Level 2 功能規劃自動展開整個子系統 — 解「依賴」欄排波次、批次澄清一次問完、預先配號後委派 subagent 平行寫 feature 設計、階段內序列實作,回填 design.md 與 build-log.md 由編排者單線負責,每個階段結束跑 arch-audit 並停下來給開發者驗收。觸發詞:子系統展開、subsys build、自動展開、批次開發、委派開發、跑完子系統、一次做完子系統。Use when auto-expanding a whole subsystem from its Level 2 feature roadmap via delegated subagents with per-stage gates.
user-invocable: true
---

# /subsys-build — 子系統委派展開(編排層)

先讀取 `../_shared/conventions.md`(核心慣例)與 `../_shared/delegation.md`(**委派模式共通契約**——你是那一節裡的「編排者」);要建或改 `build-log.md` 的 frontmatter 時,另讀 `../_shared/frontmatter.md`。

## 目標

拿一個 Level 2 已設計完成的子系統,依 `design.md` 的「功能規劃」與「Feature 契約卡」,把 Level 3 的設計與實作**委派給 subagent** 一路做完:

```
批次澄清(人在場,一次問完)
    ↓
每個階段:預先配號 → 委派 feature 設計(平行)→ 回填 → 委派實作(序列)
    ↓
階段閘門(arch-audit + 回報,人放行)→ 下一階段
```

## 你自己做什麼、不做什麼

**這是本 skill 最重要的分工,違反就會出現撞號與文件互蓋。**

| 只有你(編排者)能做 | 委派給 subagent 做 |
|---|---|
| 問開發者(批次澄清、階段閘門) | 寫 feature 設計文檔 |
| 配號(F00x)與決定檔名 slug | 相依性查證(讀原始碼確認簽名) |
| 寫入 `design.md`(回填 `doc` 欄)與 `system.md` | 寫程式碼與測試 |
| 寫入 `build-log.md` | 勾 TodoList、回寫任務文檔 `status` |
| 跑 `/arch-audit`、彙整回報 | — |
| git commit(波次 checkpoint、階段收尾) | **不碰 git**:不 add、不 commit、不切分支 |

你**不寫任何 feature 設計內容,也不寫任何程式碼**。你的產出只有:`build-log.md`、`design.md` 的回填、git commit、給開發者的回報。

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

   不過關時:列出缺什麼,告知開發者先走 `/subsys-design` 更新模式補齊(契約卡不完整就委派,等於讓 subagent 腦補契約——這正是本流程要避免的事),然後結束。

5. `build-log.md` 已存在 → **接續模式**:讀它,跳過已完成的波次,從中斷處繼續(配號沿用既有的表,不重配)

6. **工作樹檢查**:`git status` 要乾淨。checkpoint commit 用 `git add -A`,開跑時若有無關的改動會被一起吞進去——不乾淨就請開發者先 stash 或 commit。接續模式下另外對照 `git log`,確認 build-log 記的進度與 git 歷史一致(對不上以 git 為準,build-log 補正)

## 1. 排波次

從「功能規劃」建依賴圖:

1. 節點 = feature;邊 = 「依賴」欄(`#n` 指同/前階段的項次,`<slug>/<id>` 或 `G-*` 指跨子系統文檔)
2. 跨子系統或全域的依賴:確認那份文檔是否已 `done`。未完成的,在批次澄清時問開發者是「等」還是「照介面約定先做」
3. 拓撲排序切波次:同一波 = 所有依賴都已滿足的 features,可平行
4. **階段(`###` 標題)是硬邊界**:波次不跨階段——階段 N 全部驗收通過才進階段 N+1

把「階段 → 波次 → features」的排程呈現給開發者(這是後面一切的骨架,值得先讓人看一眼)。

## 2. 批次澄清(人唯一深度參與的地方)

**這一步的品質決定整個委派的品質。** subagent 問不了人,所以現在要把**所有** feature 的人類決策一次挖乾淨。

先逐張契約卡讀過,自己找出「執行者會卡住或會亂猜」的點,分類:

- **契約類**(介面、DTO、錯誤語意、邊界歸屬):屬 Level 2。開發者答完後,**回寫進 `design.md` 的對應章節或契約卡**——這是契約的補完,本來就該留在 Level 2
- **執行取向類**(套件選擇、資料結構偏好、測試深度、遷移相容性、要不要先做假資料):不屬 Level 2(寫進去會違反抽象邊界)。答完後寫進 `build-log.md` 的「委派決策記錄」
- **排程類**:未完成的跨子系統依賴要等還是照約定先做、這次要跑到第幾階段

用 AskUserQuestion 分組問(每題附你的建議選項與理由);寧可一次多問幾輪也不要留著讓 subagent 猜。**問完後把「還剩哪些不確定」明確講出來**——這些會變成 subagent 的「待確認假設」,開發者要知道自己選了什麼風險。

澄清結束後建立 / 更新 `build-log.md`(格式見下),並把契約類的回寫套進 `design.md`(同步 `updated`)。

## 3. 每個階段的執行迴圈

對當前階段的每一波:

### 3a. 預先配號與模型分配(你做,fan out 之前)

掃 `subsystems/<slug>/features/` 取 `F` 最大編號,**為本波(建議直接為整個階段)每個 feature 預先分配** `F00x` 與檔名 slug,寫進 `build-log.md` 的配號表。

**這一步不能省也不能延後**:`/feature-design` 原本的配號規則是「掃資料夾取最大值 +1」,平行 subagent 同時掃會全部拿到同一個號。號由你發,衝突就不存在。

同時決定每個 feature 的**執行模型**,一併寫進配號表。預設**不指定**(繼承主 session),要壓成本才降級;有疑慮就不要降——設計錯了整條依賴鏈重跑,實作錯了還有 1-to-1 測試接得住:

| 契約卡的樣子 | 建議 |
|---|---|
| 跨多個模組介面、依賴鏈長、後面還有 feature 疊在上面 | 不指定(繼承) |
| 單一入口、依賴 0~1 條、行為在卡上已寫死 | 設計繼承、實作可降 |
| 純樣板(CRUD、DTO 轉換、既有模式的複製) | 兩者都可降 |

模型是**呼叫 Agent 工具時的參數,不是 prompt 內容**——寫進 3b/3c 的 prompt 模板不會報錯,只是靜默沒作用。可用值 `opus` / `sonnet` / `haiku` / `fable`;不帶就是繼承。

### 3b. 委派 feature 設計(平行)

本波每個 feature 各開一個 subagent,**同一則訊息內一次送出**讓它們併發。設計文檔各寫各的檔案,互不衝突,所以平行安全。呼叫時依配號表帶 `model`(該欄是「繼承」就不帶),同一批混用不同模型沒問題。

用 subagent 的真正理由是 **context 隔離**:相依性查證要讀大量原始碼,那些 context 留在 subagent 裡,你只收回結構化回報。這就是 conventions 的「Context 載入紀律」自動化版本。

每個 subagent 的 prompt 必須包含:

```
【委派模式】遵守 <delegation.md 路徑> 的委派模式共通契約:不得提問、
不得寫 design.md/system.md、不得自行配號、機械性查證不可跳過。

執行 dev-flow:feature-design,目標:
- 子系統:<slug>            設計文檔:.design/subsystems/<slug>/design.md
- 指定 id / 檔名:F00x / F00x-<slug>.md     (由編排者配號,不得自行掃描)
- 契約卡:<整張卡原文>
- 委派決策記錄(相關條目):<從 build-log 摘出與本 feature 有關的決策>
- 已完成的前置 feature 與其文檔 id:<...>

完成後依「回報格式」回報,不要寫成給人看的說明文。
```

回報收齊後,由**你**做:

1. 回填 `design.md` 功能規劃的 `doc` 欄(**單線寫,一次寫完所有列**,同步 `updated`)——這是唯一避免平行寫同一檔互蓋的方法
2. 彙整所有「待確認假設」與「建議修改的 Level 2 契約」,**先不要自己改契約**,留到階段閘門讓開發者裁決
3. 有 subagent 回報阻塞 → 不要換個說法重試同一件事;記進 build-log,帶到閘門
4. commit 本波的設計產出(只含 `.design/`,message 例:`docs(<slug>): W2 feature 設計`)——回填完再 commit,一次一波

### 3c. 委派實作(階段內序列)

本階段的設計文檔齊了之後,依依賴順序**一次跑一個** `/feature-impl`,前一個回報完才發下一個。

理由:同一子系統的 features 常改同一批檔案,平行實作會互相蓋掉。序列跑就沒有這個問題;真要平行得用 git worktree 隔離再 merge,成本明顯高一截,不是預設選項。

prompt 同 3b 的格式,skill 換成 `dev-flow:feature-impl`,目標填文檔 id,`model` 依配號表的「實作模型」欄。每個回報收到後:

- 測試失敗或有阻塞 → **立刻停下本階段的後續實作**,不要繼續往下堆(誤差沿依賴鏈複利是本流程最大的風險),直接進閘門
- 順利完成 → 記進 build-log,**立刻 commit(checkpoint)**,再發下一個

checkpoint commit 由**你**做,subagent 不碰 git。一次只有一個實作在跑,所以 `git add -A` 是安全的;message 帶上文檔 id(例:`feat(<slug>): F006 <feature-slug>`),讓 build-log 的進度與 git 歷史對得起來。

checkpoint 的用途不是「這段程式碼已驗收」——驗收在閘門。它是**可回退的已知良好狀態**:上面那條「測試失敗就停下」的規則,要有 checkpoint 才退得回去;閘門裁決某個 feature 要重做時,也才拆得掉單一 feature 的改動。

### 3d. 階段閘門(人放行)

本階段全部實作完成(或提前停下)後:

1. 跑 `node "<arch-audit skill 目錄>/scripts/scan-status.mjs" .design`
2. 跑 `/arch-audit subsys <slug>`——檢查資料流管線一致性、SRP、邊界外洩、模組介面漂移。**這是委派品質的把關點**,不可跳過
3. 更新 `build-log.md` 的本階段結果
4. 向開發者回報,固定四塊:
   - **完成了什麼**:features、Todo 數、測試結果(通過/失敗);有降級模型的 feature 要標出來
   - **待確認假設**:全部條列(來自哪個 feature 的 A1/A2…、採取了什麼判斷、判斷錯要改什麼)——**這是閘門的重點,不能只講「都完成了」**
   - **arch-audit 發現**:依嚴重度排序
   - **建議的上層變更**:哪些 Level 2 契約 subagent 認為該改
5. 用 AskUserQuestion 讓開發者選:**進下一階段** / **先修這些問題**(走 `/bugfix`、`/enhance-design`,或回 `/subsys-design` 改契約後重跑本階段) / **就此停下**
6. 開發者要修契約 → 由**你**更新 `design.md`(不是 subagent),更新後受影響的 feature 要重跑,不能靠既有產出將就
7. 詢問是否為本階段收尾(squash 成一個 commit 或打 tag 皆可;checkpoint 已在過程中留下,這裡只處理歷史整理)。**不主動 push**;整合發 PR 走 `/branch-pr`

## 4. `build-log.md`

路徑 `.design/subsystems/<slug>/build-log.md`。版面照本 skill 目錄下的 `templates/build-log.md`——建檔或更新時打開它照抄,五個章節:排程、委派決策記錄、配號表(含設計/實作模型欄)、待確認假設彙總、階段結果。

全部階段完成後 `status` 改 `done`。

## 5. 收尾

- 摘要:跑了幾個階段、產出幾份 feature 文檔、幾個 Todo、測試總結、契約卡是否在過程中被修訂
- **未裁決的待確認假設**:如果開發者選擇提前停下,明確列出還懸著的假設
- **git 狀態**:已 checkpoint 到哪一個 feature、有沒有未 commit 的殘留
- 剩下的階段與繼續方式(再跑一次 `/subsys-build <slug>` 會走接續模式)
- 建議下一步:`/arch-audit system`(跨子系統一致性)、`/branch-pr`(整合發 PR)

## 邊界

- **不跑跨子系統**:一次只展開一個子系統。多個子系統要一個一個來(先跑被依賴的那個)
- **不改 Level 1**:過程中發現主架構要改,回報給開發者走 `/system-design` 更新模式,不自己動
- **不做 enhancement / bugfix 的委派**:那兩條流程需要先讀程式碼再與人討論 scope,不適合無訪談委派;過程中發現的問題,在閘門建議開發者走 `/enhance-design`、`/bugfix`
- **契約卡不完整時不啟動**:前置第 4 條的門檻是硬性的
