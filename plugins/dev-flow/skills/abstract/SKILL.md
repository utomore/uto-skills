---
name: abstract
description: dev-flow 的收整 — 把兩份以上 feature 之間同一段能力抽成一份 abstract(A-00x,有自己的 = 列與 laws):開 build/<全名> 分支與工作樹、把那一段程式碼搬到一處、原檔那幾列改成「見 A-00x-<slug>」、abstract 的 laws 對著現有的行為與開發者逐條談、每一份被動到的 feature 各記一條 REV,收尾自動接上 dev-flow:build;只有一個消費者的 abstract 搬回去。切片各切各的,同一段能力寫了兩次是常態,整合之後由這裡收。觸發詞:收整、abstract、抽象、抽出共用、合併重複、兩邊寫一樣的、共用邏輯、重構成共用、dev-flow abstract。Use when two or more features grew the same capability and it should be lifted into one shared abstract document.
user-invocable: true
---

# dev-flow:abstract — 收整成 abstract

> **核心**:Lift only what two or more features verifiably share; lifting MUST NOT change any behaviour a Law guards.(只抽兩份以上 feature 真的共用的那一段;收整不得改變任何一條 law 守著的行為。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/features.md`「收整(abstract)」「feature 與 abstract」「修訂(REV)」「節」、`rules/laws.md`「Law 怎麼談」、`rules/roles.md`「分支與所有權」、`rules/boundary.md`「層」「模組表」、`rules/tooling.md`「CLI」「收尾定錨」。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 兩份以上已在主線上的 feature 長出同一段能力 | `build/<A-全名>` 分支上:一份 `ready` 的 `abstracts/A-00x-<slug>.md`、搬到一處的程式碼、每一份被動到的 feature 改成引用並各記一條 REV;然後接上 `dev-flow:build` |

## 前置

`devflow lint sig` 與 `devflow status`。收整的證據有三種,至少要有一種:

| 證據 | 從哪來 |
|---|---|
| 同名簽名出現在兩份文檔、兩邊都沒註明「見」 | `lint sig` 已經在報這一條 |
| 兩份 feature 各自宣告了做同一件事的簽名或型別,只是名字不同 | 整合時決策紀錄「Touched」與「合併時要看」列過同一個檔,或讀兩份的 Steps 表 |
| 讀程式碼發現同一段邏輯寫了兩次 | 開發者提出或你在別的工作裡撞到 |

**只有一份 feature 用的不抽。** `status` 的警訊列出只有一個消費者的既有 abstract,那是反過來要搬回去的訊號,也走本 skill。

消費者都已達成並合進主線才收整:還在 `build/` 分支上的切片先整合。在主線、與 origin 同步、工作樹乾淨時開工作樹:`git worktree add -b build/abstract-<slug> ../<repo>.worktrees/abstract-<slug> HEAD`;第 3 步 claim 拿到全名之後 `git branch -m build/<全名>`(搬回去的用被搬回的那份 feature 的全名)。之後每一步都在這棵樹上(`roles.md`「分支與所有權」)。

## 步驟

1. **界定那一段**:攤開兩邊的 Steps,逐列問「這一列的輸入輸出在兩邊是不是同一件事」。是同一件事但簽名不同 → 先跟開發者敲定統一後的簽名。只是名字像 → 不抽,收工。
2. **判它是不是一條資料流**:abstract 要有自己的 `=` 列(把步驟組成一次呼叫)與端到端的 laws。抽不出 `=` 列的只是共用 helper,住程式碼就好,**不建檔**——多一份文檔要多一份維護,而 helper 沒有可陳述的端到端性質。
3. **建檔**:`devflow claim abstract <slug> --description <句>`,分支改名成 `build/<全名>`。照 `templates/abstract.md` 寫 Brief(講明哪幾份 feature 從哪一步引用它)、Steps(沒有 `!` 列)、Examples、決定(為什麼值得抽、否決「留在原地各寫一份」的理由)。
4. **程式碼先搬**:實際把那一段搬到 abstract 的檔案並匯出(層不得比它的消費者更外面,新檔登記進模組表),原本兩邊的呼叫改成呼叫它;兩邊行為本來就不同的地方,先照其中一邊,差異記下來給第 5 步問。編得過。
5. **談 Law**(`laws.md`「Law 怎麼談」):abstract 的 laws 是這段能力自己的性質,不是原本那幾條的聯集。原檔搬得過來的 law 搬;兩邊行為不同的地方一條一條拿例子問開發者「要哪一邊、還是都不在乎」;答案與現在的程式碼不符的,記成首跑該紅(這一波的決策紀錄從「Verification」寫起,`key` 是 abstract 全名)。搬不過來的 law 留在原檔。
6. **改原檔**,一份一份做,每一份都做完四件事:
   - 那幾列的簽名照抄統一後的寫法,模組欄改成「見 A-00x-<slug>」
   - 搬走的 law 從原檔刪掉,**號永久空缺**;搬走的測試跟著搬,歸屬字串改成 `A-00x#LAW-n`
   - `## 修訂記錄` 加一條 REV:依欄寫「收整進 A-00x-<slug>」,動到欄列出改成引用的那幾列與搬走的 law,保護欄列這次不准變的既有 law,重委派欄寫要重跑的測試
   - `verified` 的先重開(`status` 改 `ready`,在「決定」記一條為什麼)
7. `devflow lint all`:`lint sig` 不該再報同名未註明;`lint trace` 不該有幽靈引用。開發者逐條拍板 abstract 的 laws,改 `status: ready`。文檔、REV 與程式碼各自 commit,訊息帶全名。
8. **接上 build**:直接執行 `dev-flow:build <A-全名>`(abstract 先,再每一份被 REV 的 feature 只重跑 REV 點名的)。

## 收尾

回報抽了哪一段、影響哪幾份 feature(各一條 REV)、程式碼搬了哪些檔、兩邊行為不同的地方開發者各選了什麼;附定錨區塊。接上 build 之後的收尾由 build 做;達成後 `dev-flow:integrate`。

## 邊界

不新增能力:收整只搬東西;兩邊行為不同的地方由開發者選一邊,選了之後要改的行為由 law 講出來、refactor 去做。不抽只有一個消費者的東西。不改 `system.md` 的對外 I/O(abstract 不碰對外邊界)。不寫 abstract 的測試。
