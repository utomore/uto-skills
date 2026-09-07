---
name: refactor
description: dev-flow 的收整 — 把兩份以上 feature 之間可以抽象統一的部分抽成一份 abstract(A-00x,有自己的 = 列與 laws),原檔那幾列改成「見 A-00x-<slug>」,每一份被動到的 feature 各記一條 REV;只有一個消費者的 abstract 搬回去。觸發詞:重構、refactor、抽象、抽出共用、收整、合併重複、兩邊寫一樣的、共用邏輯、dev-flow refactor。Use when two or more features grew the same capability and it should be lifted into one shared abstract document.
user-invocable: true
---

# dev-flow:refactor — 收整成 abstract

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/features.md`「收整(refactor)」「feature 與 abstract」「修訂(REV)」「節」、`rules/boundary.md`「層」「模組表」、`rules/tooling.md`「CLI」「收尾定錨」。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 兩份以上 feature 長出同一段能力 | 一份 `ready` 的 `abstracts/A-00x-<slug>.md`;每一份被動到的 feature 改成引用並各記一條 REV |

## 前置

`devflow lint sig` 與 `devflow status`。收整的證據有三種,至少要有一種:

| 證據 | 從哪來 |
|---|---|
| 同名簽名出現在兩份文檔、兩邊都沒註明「見」 | `lint sig` 已經在報這一條 |
| 兩份 feature 的願望 step 想要同一個能力 | `status` 的「待實作」 |
| 讀程式碼發現同一段邏輯寫了兩次 | 開發者提出或你在別的工作裡撞到 |

**只有一份 feature 用的不抽。** `status` 的警訊列出只有一個消費者的既有 abstract,那是反過來要搬回去的訊號,也走本 skill。

## 步驟

1. **界定那一段**:攤開兩邊的 Steps,逐列問「這一列的輸入輸出在兩邊是不是同一件事」。是同一件事但簽名不同 → 先跟開發者敲定統一後的簽名。只是名字像 → 不抽,收工。
2. **判它是不是一條資料流**:abstract 要有自己的 `=` 列(把步驟組成一次呼叫)與端到端的 laws。抽不出 `=` 列的只是共用 helper,住程式碼就好,**不建檔**——多一份文檔要多一份維護,而 helper 沒有可陳述的端到端性質。
3. **建檔**:`devflow claim abstract <slug> --description <句>`。照 `templates/abstract.md` 寫 Brief(講明哪幾份 feature 從哪一步引用它)、Steps(沒有 `!` 列)、Laws、Examples、決定(為什麼值得抽、否決「留在原地各寫一份」的理由)。
   - **laws 是這段能力自己的性質**,不是原本那幾條的聯集。搬得過來的搬,搬不過來的留在原檔。
   - 層:abstract 住的層不得比它的消費者更外面。
4. **改原檔**,一份一份做,每一份都做完四件事:
   - 那幾列的簽名照抄統一後的寫法,模組欄改成「見 A-00x-<slug>」
   - 搬走的 law 從原檔刪掉,**號永久空缺**
   - `## 修訂記錄` 加一條 REV:依欄寫「收整進 A-00x-<slug>」,動到欄列出改成引用的那幾列與搬走的 law,保護欄列這次不准變的既有 law,重委派欄寫要重跑的測試
   - `frozen` 的先解凍(`status` 改 `ready`,在「決定」記一條為什麼)
5. **程式碼**:實際把那一段搬到 abstract 的檔案並匯出,原本兩邊的呼叫改成呼叫它。搬走的測試跟著搬,歸屬字串改成 `A-00x#LAW-n`。
6. `devflow lint all`:`lint sig` 不該再報同名未註明;`lint trace` 不該有幽靈引用。跑一次整套測試,輸出留檔。

## 收尾

回報抽了哪一段、影響哪幾份 feature(各一條 REV)、程式碼搬了哪些檔、整套測試紅綠;附定錨區塊。下一步一律是 `dev-flow:build <第一份被 REV 的 feature 全名>`(只重做 REV 點名的)。

## 邊界

不新增能力:收整只搬東西,不順便改行為;真的要改行為,那是另一次 `dev-flow:revise`。不抽只有一個消費者的東西。不改 `system.md` 的對外 I/O(abstract 不碰對外邊界)。
