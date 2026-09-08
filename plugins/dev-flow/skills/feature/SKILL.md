---
name: feature
description: dev-flow 的功能文檔 — 一份 F-00x 就是一條使用者能做到的事的唯一真相:對談後寫出 Brief、Steps(正規式簽名、= 整條、o 觀察點、! 進入點)、Laws(純 ASCII 三行)、Examples、決定,並把 status 改成 ready;新功能用 devflow claim 建檔。所有改動變化都寫在這一份檔裡,不另開第二份。觸發詞:寫功能、加功能、新功能、feature、寫規格、規格書、寫 spec、功能設計、dev-flow feature。Use when writing or planning one end-to-end feature document.
user-invocable: true
---

# dev-flow:feature — 一份功能文檔

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/features.md`「feature 與 abstract」「編號與引用」「簽名怎麼寫」「frontmatter 與 status」「節」「什麼要有 law」「願望 step」、`rules/boundary.md`「模組表」「對外 I/O」、`rules/tooling.md`「收尾定錨」。再讀 `.design/system.md` 與 `.design/modules.md`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 開發者要的能力、`system.md` 的層與對外 I/O、既有程式碼 | 一份 `ready` 的 `features/F-00x-<slug>.md` |

## 前置

- 沒有 `.design/system.md`、願景還是模板、或 `objectives.md` 一個目標都沒有 → 停,先跑 `dev-flow:project` 或 `dev-flow:objective`。
- 這份 feature 沒有被任何里程碑綁定 → 先問開發者它服務哪個目標的哪條里程碑,`dev-flow:objective` 綁進去;答不出來就是不該做的功能,停。
- 目標是**既有**功能的改動 → 這裡不是入口,走 `dev-flow:revise`(它會寫 REV)。
- 目標是**兩份以上 feature 的共同部分** → 走 `dev-flow:refactor`。
- 檔還不存在 → `devflow claim feature <slug> --description <句> --milestone <M-n>`。

## 步驟

1. **Brief 先寫**:一句意圖、input 是什麼、output 是什麼、流向,以及它讓哪條里程碑往前一步。寫不出流向就代表還沒想清楚要做什麼,回去問開發者。
2. **對外的兩端**:這條資料流從 `system.md` 對外 I/O 表的哪一列進來、從哪一列出去。表上沒有就現在補一列,`untrusted` 的入口一起想好誰做驗證。
3. **Steps**:把資料流拆成步驟,每一列一條正規式簽名 `name(T1, T2): R`、做什麼一句、住哪個檔案、哪一層。
   - 需要底層還沒有的能力 → 願望 step(模組欄註明「願望」)。
   - 用得到別份文檔已經有的 step → 模組欄註明「見 A-00x-<slug>」。**引用不到 feature**:兩份 feature 要同一段,走 `dev-flow:refactor`。
   - 最後補 `=` 列(整條,住內層)與 `!` 列(進入點,住最外層,接到第 2 步那一列 I/O)。
   - law 要看、但不是步驟的量,列成 `o` 列。
4. **Laws**:對每個 step 過一次「什麼要有 law」的兩問,再拿種類表逐種問開發者(做完之後什麼一定不會變?什麼輸入等於沒做?哪個數字有上限?哪些輸入看起來合法卻會爆?)。每條寫成純 ASCII 三行,識別字只用 Steps 的簽名、最內層的匯出、型別名。`=` 列至少一條端到端的 law。
   - `given` 的呼叫先發生、`|-` 在其後求值——有時序的性質靠這個寫。
   - 三行寫不出來 = 少一個觀察點:補 `o` 列。補了還寫不出來,就是簽名設計缺陷,回頭改 Steps。
5. **Examples**:3–5 個具體輸入輸出,覆蓋邊界(空的、單一、極值、失敗路徑),每列指到它覆蓋的 law。**不准出現真的密碼、金鑰或 token。**
6. **決定**:這份檔自己的取捨,一句結論 + 否決的替代方案 + 理由。跨文檔的開 ADR。要跑了才知道的,派 `dev-flow:spike`,結論回來再寫。
7. `devflow lint sig`、`devflow lint laws`、`devflow lint io`:三道過了,跟開發者確認一次,改 `status: ready`。

## 收尾

回報 step 幾條、law 幾條、願望 step 幾個、哪幾列還對不到程式碼;附定錨區塊。下一步一律是 `dev-flow:build <全名>`。

## 邊界

不寫實作、不寫測試;不改別份文檔(要動就是 `dev-flow:revise` 或 `dev-flow:refactor`);不改 `system.md` 的層與模組表(那是 `dev-flow:project`);不建 abstract。已經 `frozen` 的檔不碰。
