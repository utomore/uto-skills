# 角色

> pipeline 文檔是唯一真相;測試與實作都是它的投影。兩邊對不上,先懷疑文檔。

## 兩個階段

| 階段 | 誰 | 產出 |
|---|---|---|
| **設計** | 開發者與 `lawful:design` / `lawful:pipeline` 對談 | `system.md`、模組表、`draft` 的 pipeline;拍板改 `ready` |
| **建構** | `lawful:build` 的 conductor 帶 qa 與 impl | 骨架、測試、實作、REV;里程碑達成後開發者改 `frozen` |

`lawful:build` 只收 `ready` 且沒有 open GAP 的 pipeline。一條 pipeline 一波。

## 三角色

| 角色 | 讀什麼 | 做什麼 | 不准 |
|---|---|---|---|
| **conductor** | pipeline 文檔、模組表、測試結果 | 把 Stages 寫進程式碼(本體是 adapter 的 `stub`)、記骨架快照、分派 qa 與 impl、跑測試、仲裁、回寫 REV、刪 ASM 與 GAP、收尾 | 寫測試、寫實作、讀 qa 與 impl 的產出來替他們決定 |
| **qa** | pipeline 文檔 | 每條 law 一條 property test、每個 example 一條 example test,標歸屬 | 讀實作(含 `spike/`);讀別條 pipeline;改骨架;要求後門 |
| **impl** | pipeline 文檔、骨架 | 把 `stub` 換成實作、必要的私有 helper | 讀寫測試;改簽名與型別;import `spike/` |

qa 與 impl 互不可見。互動模式下同一個人依序扮演,隔離靠紀律;看過另一邊就如實說,不假裝隔離成立。

## 委派

subagent 問不了人:

1. 不提問、不等回覆。不確定的地方分兩種:**契約級**寫 ASM 繼續推進(pipelines.md「假設」),**qa / impl 讀不出唯一解釋**寫 GAP 停該項(pipelines.md「提問」)。
2. 不寫共用檔(`system.md`、`modules.md`、`gaps.md`、spike 文檔、別人的 pipeline)。ASM 與 GAP 全文放回報,conductor 單線寫入配號。
3. 編號與檔名由 conductor 給;提到 pipeline 寫全名。
4. 機械查證不跳過:骨架與測試要編得過、laws 與 examples 的翻譯要對得上數。
5. 如實回報:測試紅就貼輸出;做不完的標未完成。

回報固定五項:改了哪些檔;完成了什麼(qa:law / example 各翻幾條、紅綠分佈;impl:簽名 n / m、測試結果與**歸因**);ASM 清單;GAP 清單(局部序號);阻塞項。

## 層級自答

碰到沒寫到的判斷,兩問:答案會不會出現在簽名或 law 上?改錯要不要驚動別條 pipeline 或別個模組?

- 兩問皆否 → 實作級,自己裁,記進回報的自裁清單供抽查。
- 任一為是 → 契約級,寫 ASM,四欄備齊。

## 骨架與快照

- 骨架 = Stages 表的每條簽名寫進對應模組,本體是 `stub`。骨架要編得過。
- 發出委派前記下 `HEAD` sha 為骨架快照,並 `git worktree add --detach` 建好快照工作樹。qa 交付的測試在快照工作樹上跑一次:打到 `stub` 的要紅、打到型別本身承載的事實(建構子、欄位、instance)的要綠、REV 保護的既有 law 要綠。
- 該紅卻綠退回重寫(斷言恆真或沒呼叫到受測簽名);該綠卻紅開 GAP。
- 快照驗不成(依賴帶不過 worktree)→ 回報明寫「本波 qa 紅綠未驗證」,不默認通過。

## 閘門

每波收尾一個閘門,由 conductor 對開發者呈報:

- ASM 一次一條,附現況原文、選項與代價、傾向、可逆性;開發者裁一條,結論落地(決定或 REV)刪一條。不打包追認。
- 自裁清單整份列出供抽查,不逐條問。
- open 的 GAP 列出,各附「需要回答什麼」;回答走 `lawful:revise`。
- 附定錨區塊(tooling.md「收尾定錨」)。

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
| conductor 收齊回報 | 快照工作樹跑本波 qa 的測試 | 1 |
| conductor 判定 | 本波子集 | 1 |
| conductor 仲裁每輪 | 上一輪紅的那幾條 + 本波子集 | 每輪 1 |
| conductor 本波全綠後 | 整套,整條迴圈只這一次 | 1 |
| 修訂目標(有 REV) | 委派前先跑整套當基準線 | 1 |

整套回答「有沒有連累別人」,只在自己這一塊全綠之後問一次。

## spike

要跑了才知道的問題(函式庫撐不撐得住、協定延遲、能不能序列化)派 `lawful:spike`,不猜、不拿去問開發者。conductor 定問題、判準、timebox 並配號;subagent 只寫 `spike/SPK-00x-<slug>/` 底下;結案由 conductor 做(pipelines.md「spike」)。「impl 有沒有做到文檔」與「law 該怎麼寫」不派 spike。
