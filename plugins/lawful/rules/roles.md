# 角色

> pipeline 文檔是唯一真相;測試與實作都是它的投影。兩邊對不上,先懷疑文檔。

## 兩個階段

| 階段 | 誰 | 產出 |
|---|---|---|
| **設計** | 開發者與 `lawful:design` / `lawful:pipeline` 對談 | `system.md`、模組表、`draft` 的 pipeline;開發者拍板後 skill 改 `ready` |
| **建構** | `lawful:build` 的 conductor 帶 qa 與 impl | 骨架、測試、實作、REV;里程碑達成後 conductor 改 `frozen` |

`lawful:build` 只收 `ready` 且沒有 open GAP 的 pipeline。一條 pipeline 一波,順序:骨架 → qa → 基線 → impl → 仲裁 → 收尾。

## 三角色

| 角色 | 讀什麼 | 做什麼 | 不准 |
|---|---|---|---|
| **conductor** | pipeline 文檔、模組表、測試結果 | 把 Stages 寫進程式碼(本體是 adapter 的 `stub`)、先派 qa 再派 impl、跑測試、仲裁、寫 GAP、收尾 | 寫測試、寫實作、讀 qa 與 impl 的產出來替他們決定 |
| **qa** | pipeline 文檔、types 層、骨架的簽名 | 每條 law 一條 property test、每個 example 一條 example test,標歸屬;產生器 | 讀 pure 與 shell 的本體(含 `spike/`);讀別條 pipeline;改骨架;要求後門 |
| **impl** | pipeline 文檔、骨架 | 把 `stub` 換成實作、必要的私有 helper | 讀寫測試;改簽名與型別;import `spike/` |

qa 與 impl 互不可見。qa 先、impl 後;開發者明說要平行才平行(平行時 conductor 要在委派前 `git worktree add --detach` 留一份骨架給 qa 的測試跑基線)。互動模式下同一個人依序扮演,隔離靠紀律;看過另一邊就如實說。

## 委派

subagent 問不了人:

1. 不提問、不等回覆。文檔裡讀不出唯一答案就寫 GAP 停該項(pipelines.md「提問(GAP)」);答案不會出現在簽名或 law 上的選擇(私有 helper、資料結構、演算法)自己決定,列進回報。
2. 不寫共用檔(`system.md`、`modules.md`、`gaps.md`、spike 文檔、別人的 pipeline)。GAP 全文放回報,conductor 單線寫入配號。
3. 編號與檔名由 conductor 給;提到 pipeline 寫全名。
4. 機械查證不跳過:骨架與測試要編得過、laws 與 examples 的翻譯要對得上數。
5. 如實回報:測試紅就貼輸出;做不完的標未完成。

回報固定五項:改了哪些檔;完成了什麼(qa:law / example 各翻幾條、紅綠分佈;impl:簽名 n / m、測試結果與**歸因**);自己決定的事;GAP 清單(局部序號);阻塞項。

## 骨架與基線

- 骨架 = Stages 表的每條簽名寫進對應模組,本體是 `stub`。骨架要編得過。
- qa 交付後,conductor 在骨架上跑一次 qa 的測試當基線:打到 `stub` 的要紅、打到型別本身承載的事實(建構子、欄位、instance)的要綠、REV 保護的既有 law 要綠。
- 該紅卻綠退回 qa 重寫(斷言恆真或沒呼叫到受測簽名);該綠卻紅開 GAP。基線過了才派 impl。

## qa 的交付

- 產生器由 qa 寫,只准用 types 層的 smart constructor 組合法值;組不出來就是 GAP,指出缺的建構子。
- 每條 property test 限案例數與尺寸(例:100 個案例、產生器的尺寸參數有上限),整個測試模組有 timeout;不得產生無界的結構或無界的迴圈。跑爆機器的測試視同紅。
- 測試模組編得過,紅綠分佈符合基線預期。

## 收尾

本波全綠或停在 GAP 時,conductor 對開發者回報:

- open 的 GAP 清單,各附「需要回答什麼」;回答走 `lawful:revise`,結案的 stage 下一波重派。
- `lawful status` 顯示里程碑達成 → 直接改 `frozen`。
- qa 與 impl 自己決定的事整份列出供抽查,不逐條問。
- 定錨區塊(tooling.md「收尾定錨」)。

開發者的決定只在兩個地方發生:設計對談(`lawful:pipeline`)與回答 GAP(`lawful:revise`);開發者只說,文檔一律由 skill 寫。build 不替開發者做契約級決定,也不事後追認。

## 仲裁

有紅燈時,歸因先於修改。每條紅燈先答「它對應哪條 law 或 example」:

| 歸因 | 處置 |
|---|---|
| 對得上,測試與原文一致 | impl 錯:附 law 原文重派 impl,不動測試、不附測試碼 |
| 對得上,測試與原文不符 | qa 誤讀:附 law 原文重派 qa,不附實作碼;判定只依原文,不拿實作行為當依據 |
| 對不上,或文檔沒涵蓋 | 文檔 bug:開 GAP 停該 stage,不發委派、不讓 qa 與 impl 協商、conductor 不自己補 law |
| 同一 pipeline 三輪仍紅 | 停止並升級,附結構性原因(簽名切錯、laws 互相矛盾、example 與 law 不一致、子流行為與文檔不符) |

qa 與 impl 只做歸因,裁決由 conductor。

## 測試跑幾次

| 誰 | 範圍 | 次數 |
|---|---|---|
| qa | 自己寫的測試模組 | 1 |
| impl | 本 pipeline 的子集(`system.md` 的子集指令) | 互動 1;委派 0 |
| conductor 收到 qa | 骨架上跑 qa 的測試當基線 | 1 |
| conductor 判定 | 本波子集 | 1 |
| conductor 仲裁每輪 | 上一輪紅的那幾條 + 本波子集 | 每輪 1 |
| conductor 本波全綠後 | 整套,整條迴圈只這一次 | 1 |
| 修訂目標(有 REV) | 委派前先跑整套當基準線 | 1 |

整套回答「有沒有連累別人」,只在自己這一塊全綠之後問一次。

## spike

要跑了才知道的問題(函式庫撐不撐得住、協定延遲、能不能序列化)派 `lawful:spike`,不猜、不拿去問開發者。conductor 定問題、判準、timebox 並配號;subagent 只寫 `spike/SPK-00x-<slug>/` 底下;結案由 conductor 做(pipelines.md「spike」)。「impl 有沒有做到文檔」與「law 該怎麼寫」不派 spike。
