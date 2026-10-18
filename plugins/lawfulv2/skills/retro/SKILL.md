---
name: retro
description: lawfulv2 的回顧，診斷者：讀一段期間（預設過去七天）的 git 歷史、已合併的 PR 與審查留言、CI 的失敗、這個專案的對話紀錄（含 subagent），對照現行的規範與檢查，找出 LLM 重複犯的錯。同一種錯出現兩次就提案，寫得出判定式的提機械化檢測（hook、pre-commit、CI、測試），寫不出才提規範；只出現一次的只記錄。每一種錯在專案管理工具裡一張標題以「retro:」開頭的 issue，再犯就加一則留言附證據，次數從那裡數。只提案、不改任何檔、不寫任何檢查，落地由使用者拍板後回 kickoff 或走一般 PR。觸發詞：回顧、retro、retrospective、週回顧、檢討、重複犯錯、同樣的錯、機械化檢測、該加什麼檢查、該加什麼規則。Use when reviewing the past week's PRs, CI runs and agent transcripts to find mistakes that happened twice and propose a mechanical check or a rule for each.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/retro.mjs":*), Bash(git log:*), Bash(git show:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh run list:*), Bash(gh run view:*), Bash(gh issue list:*), Bash(gh issue view:*)
---

# lawfulv2:retro — 回顧

> **核心**：Find the mistakes that happened twice and propose the cheapest fence for each — a mechanical check when one can be written, a rule only when it cannot; change nothing yourself.（找出犯了兩次的錯，替每一種提最便宜的護欄：寫得出機械化檢測就提檢測，寫不出才提規範；自己什麼都不改。）步驟與這一句衝突時，這一句贏：停下，回報。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一段期間（預設過去七天）；這個 repo 的 git 歷史、已合併的 PR、審查留言、CI 的失敗；這個專案的對話紀錄（`~/.claude/projects/` 底下對應這個目錄的那一個資料夾，含 subagent）；現行的規範與檢查；專案管理工具裡標題以 `retro:` 開頭的 issue | 對話裡的一份回顧報告；使用者同意的每一種錯，在專案管理工具裡新開一張 issue 或在既有的那一張加一則留言；repo 裡沒有任何檔案被改 |

## 前置

- **專案管理工具**：從 `CLAUDE.md` 或 `docs/adr/design/` 的 D-004 讀出用哪一個，用這個 session 連得到它的方式做一次只讀的查詢。連不上就回報並停下：次數存在那裡，讀不到就數不出「兩次」。

## 分流

- 使用者要直接改規範或加檢查 → 不在這裡。規範回 `lawfulv2:kickoff`；檢查、hook 照一般流程開分支發 PR。
- 要設 GitHub repo 的標籤 → `lawfulv2:labels`。

## 步驟

1. **定期間。** 使用者沒講就是過去七天；把起始日念給他。
2. **抽訊號。**

   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/retro.mjs" --since <YYYY-MM-DD>
   ```

   印出每個 session 的使用者訊息（連同前一則 assistant 的摘要）、打斷、工具失敗、拒絕、subagent 的工具失敗與拒絕，以及主線上的合併與直接進主線的 commit（合併之後改到同一批檔的，標出是那次合併之後第幾個）。標題以 `(#號)` 結尾的 commit 算一次合併，squash 合併的專案也讀得出補修。開頭的「略過 N 行」不是 0 時，寫進報告：對話紀錄有讀不懂的行。
3. **補 PR 與 CI。** 原始碼庫是 GitHub：
   - `gh pr list --state merged --search "merged:>=<起始日>"` 列出期間內合併的 PR。
   - 每一張 `gh pr view <號> --comments` 讀留言與審查的總評；行內的審查留言（AI review 多半留在這裡）用 `gh api repos/<OWNER>/<REPO>/pulls/<號>/comments` 讀，這道不在預先允許的指令裡，會先問使用者。
   - `gh run list --status failure --created ">=<起始日>"` 列出 CI 的失敗，要看原因再 `gh run view <號> --log-failed`。

   不是 GitHub：用這個 session 連得到它的方式讀同樣三樣；讀不到的那一樣寫進報告。
4. **讀現行的規範與檢查。** `CLAUDE.md`、`docs/adr/process/`、`.claude/settings.json` 的 hook、`.pre-commit-config.yaml`、CI 設定、`Makefile` 與檢查腳本。每一種錯都要對到「有沒有已經管它的東西」。
5. **歸類。** 把訊號歸成「一種錯」：同一種錯是同一個行為違反同一個期待，不看它發生在哪個檔。
   - 每一種寫一句話，例如「用 shell 內嵌腳本改檔，跳脫字元被吃掉」。
   - 每一種列出證據：session 前八碼與時間，或 PR、commit、CI run 的號。
   - 不是錯的訊號丟掉，例如搜尋沒有結果的 exit 1、使用者單純改需求；丟掉幾條寫進報告。
6. **數次數。** `gh issue list --state all --limit 500 --search "retro in:title"`（或專案管理工具的同等查詢）。搜尋只比對字詞，結果裡只認標題以 `retro:` 開頭的那幾張；把每一種錯對到其中一張。
   - 次數是那張 issue 上的證據加這次新的證據。
   - 同一筆證據只算一次：這次的某一筆（session 前八碼加時間，或 PR、commit、CI run 的號）已經寫在那張 issue 的本文或留言裡，就不是新的，不加次數、不再寫進留言。期間跟上一次回顧重疊時就會碰到。
7. **判落點。** 見下面的「落點」。
8. **跟使用者過，一次一種。** 次數多的先。每一種照下面的「提案的格式」念給他，他決定開、加留言或不要；沒講的不動。
9. **寫進專案管理工具。** 只寫使用者同意的：
   - 沒有既有 issue → 新開一張，標題 `retro: <那一句話>`。
   - 有既有 issue → 加一則留言，寫這次的證據與累計次數；落點變了（例如從只記錄升成提案）就在留言裡寫新的提案，並照下面補標籤。
   - 既有 issue 已經關了卻又犯 → 加留言並問使用者要不要重開：關掉代表護欄落地了，又犯代表它有漏洞。
   - 標籤（GitHub）：每張 `種類:開發工具`；提機械化加 `chore`，提規範加 `docs`，只記錄的不加改動類型。
10. **反向檢查。** 規範管的事已經有機械化檢測擋住的，提案刪掉那條規範；跟使用者過的方式同步驟 8，同意就開一張 `retro: 刪掉規範 <那一條>`，標 `docs` 與 `種類:開發工具`。

## 落點

照順序判斷，對到一條就停：

| 順序 | 情況 | 落點 |
|---|---|---|
| 1 | 這一種錯累計只有一次 | 只記錄：開 issue 寫證據，不提案 |
| 2 | 已經有檢查卻又犯 | 檢查有漏洞：提補那道檢查，寫明漏在哪 |
| 3 | 已經有規範卻又犯 | 規範沒用：寫得出判定式就提機械化，寫不出就提改寫那條規範 |
| 4 | 寫得出判定式（對檔案、diff、指令、commit 訊息），誤判可以接受 | 機械化；越早擋越好：hook（擋工具呼叫）> pre-commit（擋提交）> CI（擋合併）；也可以是一道測試 |
| 5 | 要懂語意才判斷得出來 | 規範；寫明加在 `CLAUDE.md` 的哪一節或哪一份 ADR |

## 提案的格式

```
錯：<一句話>
- 次數：這次 <n> 次，累計 <n> 次（issue #<號>，沒有就寫「新的」）
- 證據：
  - session <前八碼>，<YYYY-MM-DD HH:MM>：<一句摘要>
  - PR #<號> / commit <短 sha> / CI run <號>：<一句摘要>
- 現行規範：<哪一條規範或檢查管它；沒有就寫「沒有」>
- 落點：機械化 / 規範 / 只記錄
- 理由：<判定式怎麼寫、誤判能不能接受；或為什麼寫不出判定式>
- 怎麼擋：<哪一層、命中時說什麼；規範就寫加在哪一節、寫什麼>
- 可逆：<拿掉要做什麼>
```

**證據不貼原文**：issue 可能是公開的，對話紀錄裡可能有密鑰、帳號或別的專案的名字。證據只寫 session 前八碼、時間與一句自己寫的摘要；使用者的原話不引用。

## 收尾

回報：
- 期間；讀了幾個 session、幾個 subagent、幾張 PR、幾次 CI 失敗；腳本略過幾行；讀不到的來源。
- 歸出幾種錯，每一種的累計次數與落點。
- 開了哪幾張 issue、在哪幾張加了留言、使用者不要的有哪幾種。
- 丟掉幾條不是錯的訊號。
- 反向檢查提了哪幾條規範要刪。

repo 裡什麼檔案都沒改，這句要寫出來。落地由使用者決定：規範回 `lawfulv2:kickoff`，檢查與 hook 照一般流程開分支發 PR。

## 邊界

不改 repo 裡的任何檔：不改 `CLAUDE.md`、ADR、hook、pre-commit、CI、檢查腳本；不替使用者決定開不開 issue、落點是什麼；沒有使用者同意不在專案管理工具裡開、改、關任何東西，不關 issue、不動不是 `retro:` 開頭的 issue；只讀這個專案的對話紀錄，不讀別的專案的；證據不貼原文；同一種錯只出現一次不提案。
