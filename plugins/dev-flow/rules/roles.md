# 角色

> feature 文檔是唯一真相;測試與實作都是它的投影。兩邊對不上,先懷疑文檔。

## 兩個階段

| 階段 | 誰 | 產出 |
|---|---|---|
| **設計** | 開發者與 `dev-flow:project` / `dev-flow:feature` / `dev-flow:refactor` 對談 | `system.md`、模組表、`draft` 的 feature 與 abstract;開發者拍板後 skill 改 `ready` |
| **建構** | `dev-flow:build` 的 conductor 帶 qa 與 impl | 骨架、測試、實作、REV;達成後 conductor 改 `frozen` |

`dev-flow:build` 只收 `ready` 且沒有 open GAP 的文檔。一份文檔一波,順序:骨架 → qa → 基線 → impl → 仲裁 → 收尾。

## 三角色

| 角色 | 讀什麼 | 做什麼 | 不准 |
|---|---|---|---|
| **conductor** | 目標文檔、模組表、測試結果 | 把 Steps 寫進程式碼(本體是 adapter 的骨架標記)、先派 qa 再派 impl、跑測試、仲裁、寫 GAP、收尾 | 寫測試、寫實作、讀 qa 與 impl 的產出來替他們決定 |
| **qa** | 目標文檔、最內層的匯出、骨架的簽名 | 每條 law 一條 property test、每個 example 一條 example test,標歸屬;產生器 | 讀任何實作本體(含 `spike/`);讀別份文檔;改骨架;要求後門 |
| **impl** | 目標文檔、骨架 | 把骨架標記換成實作、必要的私有 helper | 讀寫測試;改簽名與型別;import `spike/` |

qa 與 impl 互不可見。qa 先、impl 後;開發者明說要平行才平行(平行時 conductor 要在委派前 `git worktree add --detach` 留一份骨架給 qa 的測試跑基線)。互動模式下同一個人依序扮演,隔離靠紀律;看過另一邊就如實說。

## 委派

subagent 問不了人:

1. 不提問、不等回覆。文檔裡讀不出唯一答案就寫 GAP 停該項(features.md「提問(GAP)」);答案不會出現在簽名或 law 上的選擇(私有 helper、資料結構、演算法)自己決定,列進回報。
2. 不寫共用檔(`system.md`、`modules.md`、`gaps.md`、spike 文檔、別人的 feature)。GAP 全文放回報,conductor 單線寫入配號。
3. 編號與檔名由 conductor 給;提到文檔寫全名。
4. 機械查證不跳過:骨架與測試要編得過、laws 與 examples 的翻譯要對得上數。
5. 如實回報:測試紅就貼輸出;做不完的標未完成。

回報固定五項:改了哪些檔;完成了什麼(qa:law / example 各翻幾條、紅綠分佈;impl:簽名 n / m、測試結果與**歸因**);自己決定的事;GAP 清單(局部序號,四欄);阻塞項。

## 骨架與基線

- 骨架 = Steps 表的每條簽名(步驟、`=` 列、`!` 列與 `o` 列的觀察點)寫進對應檔案並匯出,本體是 adapter 的骨架標記,訊息帶 `F-00x#name`,基線的紅燈才看得出打到哪個 step;程式碼已經有的照舊。
- 骨架要編得過,`devflow status` 把還是骨架標記的列成骨架。**骨架不得回傳假值**(回 `0`、`[]`、`null` 會讓測試假綠,比沒寫還糟)。

| 語言 | 骨架標記 |
|---|---|
| TypeScript / JavaScript | `throw new Error("F-001#name not implemented")` |
| Python | `raise NotImplementedError("F-001#name")` |
| Go | `panic("F-001#name not implemented")` |
| Rust | `todo!("F-001#name")` |

- qa 交付後,conductor 在骨架上跑一次 qa 的測試當基線:打到骨架的要紅、打到型別本身承載的事實(建構子、欄位、列舉成員)的要綠、REV 保護的既有 law 要綠。
- 該紅卻綠退回 qa 重寫(斷言恆真或沒呼叫到受測簽名);該綠卻紅開 GAP。基線過了才派 impl。
- **委派模式下基線由 conductor 驗,不由 qa 保證**:impl 一旦填完本體,假綠與真綠在測試輸出裡同形,判準不是被違反,是被靜默停用。發委派之前記下 `HEAD` 的 sha 並 `git worktree add --detach <路徑> <sha>` 建好快照工作樹,收到測試檔就複製進去跑。環境帶不過去、驗不成 → 在回報明寫「本波 qa 紅綠未驗證」,不得默認通過。

## qa 的交付

- 產生器由 qa 寫,只用公開的建構子組合法值;組不出來就是 GAP,指出缺的建構子。產生器要能縮小(shrink),反例才讀得懂。
- 有 `given` 行的 law:產生器直接建構滿足前提的值;做不到才用條件過濾,並宣告覆蓋率下限,沒宣告覆蓋率的過濾式測試視同恆真。**`given` 的呼叫先發生**,測試照這個順序寫。
- `total` 種類的斷言是「呼叫它不拋例外、不回錯誤」。
- 每條 property test 限案例數與尺寸(例:100 個案例、產生器的尺寸有上限),整個測試檔有 timeout;不得產生無界的結構或無界的迴圈。跑爆機器的測試視同紅。
- 測試檔編得過,紅綠分佈符合基線預期。
- 內部支架(不是 step 的區域函數)的測試不標歸屬、不進 law 分母;要測就另開測試檔,`lint trace` 把它列成內部測試。

## 收尾

本波全綠或停在 GAP 時,conductor 對開發者回報:

- open 的 GAP 清單,各附「需要回答什麼」;回答走 `dev-flow:revise`,結案的 step 下一波重派。
- `devflow status` 顯示達成 → 直接改 `frozen`。
- qa 與 impl 自己決定的事整份列出供抽查,不逐條問。
- 定錨區塊(tooling.md「收尾定錨」)。

開發者的決定只在三個地方發生:設計對談(`dev-flow:project` / `feature` / `refactor`)、回答 GAP(`dev-flow:revise`)、驗收。開發者只說,文檔一律由 skill 寫。build 不替開發者做契約級決定,也不事後追認。

## 仲裁

有紅燈時,歸因先於修改。每條紅燈先答「它對應哪條 law 或 example」:

| 歸因 | 處置 |
|---|---|
| 對得上,測試與原文一致 | impl 錯:附 law 原文重派 impl,不動測試、不附測試碼 |
| 對得上,測試與原文不符 | qa 誤讀:附 law 原文重派 qa,不附實作碼;判定只依原文,不拿實作行為當依據 |
| 對不上,或文檔沒涵蓋 | 文檔 bug:開 GAP 停該 step,不發委派、不讓 qa 與 impl 協商、conductor 不自己補 law |
| 同一份文檔三輪仍紅 | 停止並升級,附結構性原因(簽名切錯、laws 互相矛盾、example 與 law 不一致、引用的 abstract 行為與文檔不符) |

qa 與 impl 只做歸因,裁決由 conductor。

## 測試跑幾次

| 誰 | 範圍 | 次數 |
|---|---|---|
| qa | 自己寫的測試檔 | 1 |
| impl | 本份文檔的子集(`system.md` 的子集指令) | 互動 1;委派 0 |
| conductor 收到 qa | 骨架快照上跑 qa 的測試當基線 | 1 |
| conductor 判定 | 本波子集 | 1 |
| conductor 仲裁每輪 | 上一輪紅的那幾條 + 本波子集 | 每輪 1 |
| conductor 本波全綠後 | 整套,整條迴圈只這一次 | 1 |
| 修訂目標(有 REV) | 委派前先跑整套當基準線 | 1 |

整套回答「有沒有連累別人」,只在自己這一塊全綠之後問一次。

## spike

要跑了才知道的問題(函式庫撐不撐得住、協定延遲、能不能序列化)派 `dev-flow:spike`,不猜、不拿去問開發者。conductor 定問題、判準、timebox 並配號;subagent 只寫 `spike/SPK-00x-<slug>/` 底下;結案由 conductor 做(features.md「spike」)。「impl 有沒有做到文檔」與「law 該怎麼寫」不派 spike。

## 委派模型

呼叫 Agent 工具時明確帶 `model`,不省略讓它繼承主 session:

| 角色 | skill | 模型 |
|---|---|---|
| qa | `dev-flow:qa` | `sonnet` |
| impl | `dev-flow:impl` | `sonnet` |
| spike | `dev-flow:spike` | `sonnet` |
| conductor(你) | — | 不指定 |

qa 與 impl 拿到的是已經鎖死的文檔與骨架,做的是翻譯與填空;契約判斷在設計那一層,那一層由開發者與你在對談裡做。
