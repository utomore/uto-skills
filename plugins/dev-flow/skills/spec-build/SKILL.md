---
name: spec-build
description: 單份 spec 的委派執行迴圈(orchestrator 角色)— 拿一份已寫好的 spec(F00x / E00x / G-E00x)與骨架,做 spec 批准閘門 → 委派 qa 與 impl 平行執行(互相不可見)→ 由編排者跑測試與仲裁(上限 3 輪)→ 回寫狀態與回報。觸發詞:跑 spec、spec build、執行規格、展開 spec、跑 enhance、優化編排、qa 加實作、單份委派。Use when orchestrating the qa and impl roles for one already-written spec document (feature or enhancement).
user-invocable: true
---

# /spec-build — 單份 spec 的委派執行迴圈(orchestrator 角色)

先讀取 `../_shared/conventions.md`(核心慣例)、`../_shared/spec-roles.md`(**三角色契約**——你是那一片裡的「編排者」,仲裁協議是你的職責)與 `../_shared/delegation.md`(**委派模式共通契約**);要建或改 `spec-gaps.md` 的 frontmatter 時,另讀 `../_shared/frontmatter.md`;收尾時另讀 `../_shared/anchor.md`(定錨區塊格式)。

## 目標

spec 已經寫好了(`/feature-design` 或 `/enhance-design` 產出的文檔 + 骨架),把剩下的 qa 與 impl 委派出去跑完:

```
門檻檢查 → 【spec 批准閘門:人放行】
    → 委派 qa ∥ impl(互相不可見)→ 你跑測試 → 仲裁(≤3 輪)→ 回報
```

**適用一份 spec**:`F001`、`auth/F002`、`E001`、`G-E001` 都可以。要一次跑完整個子系統的多個 features(排波次、配號、階段閘門),走 `/subsys-build`;`/bugfix` 不適用(單角色流程)。

`/enhance-design` 需要人討論 scope、不能無訪談委派——但 scope 談完、spec 寫好之後,後半段和 feature 完全一樣,這就是本 skill 存在的理由。

## 你自己做什麼、不做什麼

| 只有你(編排者)能做 | 委派給 subagent 做 |
|---|---|
| 問開發者(spec 批准閘門、仲裁升級) | 寫測試(qa) |
| **跑測試、做仲裁**(`spec-roles.md`「仲裁協議」) | 寫實作(impl) |
| 回寫目標文檔的 `status` | — |
| git commit(checkpoint) | **不碰 git** |

你**不寫 spec、不寫測試、不寫實作**。發現 spec 要改 → 停下來交給開發者走對應的 design skill,**不自己改、也不委派 design**(feature 的 spec 修訂要重新查證,enhance 的更要重談 scope,兩者都需要人)。

## 1. 確定目標 spec

- 開發者有指定(`F001` / `auth/F001` / `E001` / `G-E001`,或檔名、路徑)→ 找到對應檔案;只給編號而多個子系統都有時,列出候選讓開發者確認
- 沒指定 → 執行 `node "<arch-audit skill 目錄>/scripts/scan-status.mjs" .design` 列出未完成項目,用 AskUserQuestion 讓開發者選

讀:目標 spec 全文 + 骨架檔案 + `.design/system.md` + 所屬子系統的 `design.md` + `related-adr`。**不相關的子系統不讀。**

## 2. 門檻檢查(任一項不過就停下來,不要硬跑)

1. spec 有「Laws」與「Examples」兩段,且不是空的——**沒有 law 就沒有東西可以翻譯成測試**,qa 只能腦補
2. spec 有「骨架」段,列出的檔案都存在
3. **骨架編譯 / 型別檢查通過**:自己跑一次。編不過的骨架,qa 拿不到能 import 的東西
4. spec「介面」表(enhance 是「數據與介面變動」表)每一條的簽名,在骨架檔案裡找得到**逐字相同**的原文
5. `spec-gaps.md` 沒有指向本文檔的 `open` 條目——有的話代表上一輪還有 spec 沒修完,先處理

不過關時:列出缺什麼,告知開發者走 `/feature-design` 或 `/enhance-design` 的更新模式補齊,然後結束。

## 3. spec 批准閘門(人放行,不可跳過)

**qa 與 impl 都只讀 spec,spec 錯了就是兩邊一起錯。** fan out 之前先讓開發者看一眼:

1. spec 的**目的、介面表、Laws、Examples** 摘要——重點是 Laws 與 Examples,那是驗收標準的可執行形式
2. 骨架檔案清單與編譯結果
3. 你自己讀過之後的疑慮:哪條 law 讀起來有兩種解釋、哪個介面沒有被任何 law 或 example 覆蓋、哪個邊界情況三段都沒提到
4. enhance 目標時另外確認:「行為不變」的每一條都有對應的**回歸 law** 嗎?沒有回歸 law 的「行為不變」等於沒有保護

用 AskUserQuestion 讓開發者選:**批准,繼續** / **要改 spec**(結束本次,請開發者走 design skill 的更新模式)/ **停下來**。

開發者在本次對話裡剛剛才明確批准過同一份 spec(例如 `/feature-design` 收尾後直接接著跑本 skill)時,不重複問,但第 3 點的疑慮照樣要講出來。批准之前**不得**發出任何委派。

## 4. 基準線(enhance 目標必做)

委派之前,**先跑一次完整測試套件並記下結果**(哪些綠、哪些紅、哪些不存在)。

理由:優化是在既有程式碼上動手,測試套件本來就可能有紅的。沒有基準線,仲裁時分不出「本來就紅」與「這次改壞的」——而後者是回歸,前者不是,兩者的處置完全相反。

feature 目標(全新程式碼)可跳過:骨架必然全紅,基準線沒有資訊。

## 5. 委派 qa 與 impl(互相不可見)

**同一則訊息內一次送出**兩個 subagent 讓它們併發——測試檔與實作檔的檔案集不相交,平行安全。每次呼叫 Agent 工具都必須明確帶上 `model`:

| 角色 | 委派的 skill | 模型 |
|---|---|---|
| qa | `dev-flow:spec-qa` | **`sonnet`** |
| impl | `dev-flow:feature-impl`(feature)/ `dev-flow:enhance-impl`(enhance) | **`sonnet`** |
| 編排者(你) | — | 不指定,跟隨開發者當下的 session 模型 |

spec 已經鎖死,qa 與 impl 做的是翻譯與填空,判斷空間有限。模型是**呼叫 Agent 工具時的參數,不是 prompt 內容**——寫進 prompt 模板不會報錯,只是靜默沒作用。

prompt 必須包含委派契約與角色禁區:

```
【委派模式】遵守 <delegation.md 路徑> 的委派模式共通契約:不得提問、
不得寫 design.md/system.md、機械性查證不可跳過。
你是 qa 角色,遵守 <spec-roles.md 路徑>:只讀 spec 的數據/介面/Laws/Examples 與骨架,
禁止閱讀任何實作程式碼;程式碼知識圖只准用來定位測試檔與型別結構,
不得用它推論受測函數的行為。禁止修改骨架、禁止要求測試後門。
交付前確認測試「編譯通過 + 紅綠符合預期」。

執行 dev-flow:spec-qa,目標:<文檔 id>
```

```
【委派模式】…(同上)
你是 impl 角色,遵守 <spec-roles.md 路徑>:禁止讀寫任何測試檔、
禁止改動骨架的簽名與型別定義。紅燈只做歸因不做仲裁,列為阻塞項回報。

執行 dev-flow:feature-impl,目標:<文檔 id>
```

兩邊都回報後才進下一步。有一邊回報阻塞或新增 spec-gaps → 照樣進第 6 步跑測試(另一半的產出還是要驗),但在回報裡明確標出哪一半沒做完。

## 6. 跑測試與仲裁(你做,上限 3 輪)

**由你**執行完整測試套件。**不要相信 subagent 回報的測試結果就跳過這一步**——qa 與 impl 各自只看得到自己那一半,只有你兩邊都看得到,所以仲裁只能發生在這一層。

全綠(enhance:且基準線上綠的測試沒有一條轉紅)→ 進第 7 步。

有紅 → 照 `../_shared/spec-roles.md`「仲裁協議」逐條處理,**禁止直接叫 impl 重寫**:

1. 先歸因:這條失敗對應 spec 的**哪一條 law 或 example**?
2. 對應得上、測試與原文一致 → **impl 錯**:重派 impl,prompt 只給失敗清單與對應的 spec 條文原文,**不得附上測試原始碼**
3. 對應得上、測試與原文不符 → **qa 誤讀**:重派 qa,附條文原文,**不得附上實作原始碼**
4. 對應不上、或 spec 沒涵蓋 → **spec bug**:**停下來向開發者回報,等 spec 修訂**。禁止讓 qa 與 impl 自行協商,也禁止你自己補一條 law 就繼續跑
5. **enhance 專屬**:基準線上綠、現在轉紅的測試 → 這是**回歸**,不論它對應哪條 law,一律要求 impl 修好或回退,不得以「新行為比較合理」放過
6. **上限 3 輪**:三輪仍有紅就停止並升級給開發者,附失敗摘要與你判斷的**結構性原因**(介面切錯、law 互相矛盾、example 與 law 不一致、依賴的前置文檔行為與 spec 不符),**禁止繼續嘗試**

每一輪的裁決都要記下來(第幾輪、哪條測試、歸因結論、依據的 spec 條文);目標子系統有 `build-log.md` 時寫進它的「仲裁紀錄」,沒有的話寫進回報。

## 7. 收尾

- **回寫 `status`**:骨架已無未實作標記、測試全綠、**且沒有指向本文檔的未結 spec-gaps** → 改 `done`、更新 `updated`;任一條不成立就留 `in-progress`。**全綠不等於完成**——有 `open` 的 gap 代表那段行為沒被 spec 規範,兩種相反的實作都會全綠
- **commit**:`git add -A` 前確認 qa 與 impl 都已回報完(半成品的測試檔會被一起吞進去);message 帶文檔 id
- 專案有程式碼知識圖時,把圖更新到最新(指令見 `../_shared/codegraph.md`);跑不動就略過並在摘要提一句
- 回報固定五塊:
  - **完成了什麼**:介面實作數(n/m)、測試結果(law 幾條、example 幾條、通過/失敗);enhance 另附**量化結果**與基準線對照
  - **未結的 spec-gaps**:每一條的內容、卡住哪個項目、需要 spec 回答什麼
  - **仲裁紀錄**:幾輪、歸因分佈(impl 錯 / qa 誤讀 / spec bug),spec bug 的每一條都要點名
  - **建議的上層變更**:哪些 Level 2 契約 subagent 認為該改(**你不改**,交給開發者)
  - **定錨區塊**(`../_shared/anchor.md`):位置樹把目標文檔標為「目前」,逐條列介面與型別的狀態;未結的 spec-gaps 與改動過的骨架簽名一律進偏離清單;下一步從樹上推(常見:`/arch-audit feature <id>`、同子系統的下一份 spec、或 `/branch-pr`)

## 邊界

- **一次一份 spec**。多份要跑 → 一份一份來,或用 `/subsys-build` 跑整個子系統
- **不寫 spec / 測試 / 實作**,不改 `design.md` 與 `system.md`
- **不修 spec bug**:歸因為 spec bug 就停下來,由開發者走對應的 design skill
- **`/bugfix` 不適用**:那條流程是單角色,重現測試必須看實作才寫得出來
