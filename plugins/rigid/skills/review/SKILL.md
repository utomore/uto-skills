---
name: review
description: rigid 的語意審查，架構師在本機審一條分支或一個 PR 有沒有把東西放錯層：機器判得了的（依賴方向、入口、錯誤翻譯、law）由 make check 擋，這裡只審機器判不了的那一段（這段 if 是格式檢查還是業務規則、這段邏輯該不該搬進領域），規則只有 ADR-002 的分層表；每個發現指檔案與行、違反哪一列、該搬去哪，架構師逐條決定搬、改 ADR 或誤報；不改程式碼、不留 PR 評論、不擋任何東西。要接進 CI 也在這裡說明。觸發詞：review、審查、審這條分支、放錯層、業務邏輯跑到 api、分層、AI review、接 CI。Use when the architect wants a branch or PR reviewed against the layer table in ADR-002, or wants that review wired into CI.
user-invocable: true
allowed-tools: Bash(uv run python -m scripts.ai_review:*), Bash(git diff:*), Bash(git fetch:*), Bash(gh pr checkout:*), Bash(gh pr diff:*)
---

# rigid:review — 語意審查

> **核心**：The machine has already rejected everything it can decide; what is left is one question, does each added line sit in the layer ADR-002 assigns it, and the architect, not the reviewer, decides what happens to each finding.（機器能判的都已經擋掉了；剩下的只有一題，每一行新增的程式碼是不是在 ADR-002 指定的那一層，而每個發現怎麼處理由架構師決定，不由審查者決定。）步驟與這一句衝突時，這一句贏：停下，回報。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一條分支（相對於 `main`）或一個 PR 號；`docs/adr/ADR-002-code-design.md` 的分層表；`scripts/ai_review.py` 與 `scripts/ai_review_prompt.md`（`rigid:scaffold` 鋪的） | 一張發現表（檔案、行、哪一層、違反哪一列、為什麼、該搬去哪）與架構師對每一條的裁決（搬、改 ADR、誤報）；沒有任何檔案被改 |

## 分流

- 沒有 `scripts/ai_review.py` → 框架不完整，先走 `rigid:scaffold`（更新模式會把缺的檔補上）。
- 架構師要的是「依賴方向對不對」「入口有沒有註冊」「law 有沒有測試」→ 那是 `make check`，跑它就好，不用審。
- 發現要真的搬程式碼 → 不在這裡；做那個單元的人在自己的分支改，改完 `make check`。
- 一條發現的根源是 ADR-002 那張表寫得不對 → 架構師改 ADR，走一般 PR（`docs/adr/` 在 CODEOWNERS 裡）。

## 步驟

1. **拿到 diff。** 分支：`git fetch origin main` 之後 `uv run python -m scripts.ai_review prompt --base origin/main`；PR：先 `gh pr checkout <號>` 再同一道。輸出就是完整的提示詞：規則表（直接從 ADR-002 讀）、補充說明、每一行標了新檔案行號的 diff。印「src 沒有改動，不審」就結束，回報這句。
2. **自己當模型審。** 照提示詞裡的規則與補充說明審，一字不多：只看 `|+` 開頭的行，只對表格寫了的那幾列，不確定的不報，寧可漏不要誤報。每一個發現寫成一列：檔案、行號（抄那一行前面的數字）、哪一層、違反表格的哪一列、為什麼、該搬去哪一層。不審命名、不審效能、不審測試夠不夠、不審表格沒寫的任何事。
3. **一次一條給架構師裁決**，每條固定三個選項：
   - **搬**：這段確實是業務規則（或接線、或格式檢查）放錯層，記下該搬去哪；由做那個單元的人在自己的分支改。
   - **改 ADR**：這段放在這一層是對的，是表格沒寫清楚；記下表格哪一列要改成什麼，架構師另開 PR 改 ADR-002。
   - **誤報**：表格與程式碼都對，是審查看錯；記一句為什麼，之後同型的不再報。
4. **接進 CI**（架構師要的話才做，只說明不動手）：CI 的檢測階段之後加一步，`uv run python -m scripts.ai_review run --base origin/main --cmd "<模型的指令>" --post <PR 號>`；`--cmd` 是任何從 stdin 讀提示詞、往 stdout 回 JSON 的指令（例如 `claude -p`），`--post` 用 `gh` 在 PR 上留一則 COMMENT 的 review、每個發現一條 inline comment。這一步永遠 exit 0：任何錯誤只印 `AI_REVIEW_FAILED`，決定權在人。模型、金鑰、`gh` 的授權是專案的設定，寫在專案的 CI 檔，不寫在 skill 裡。

## 收尾

回報發現幾條、每一條的裁決（搬去哪 / ADR 哪一列要改 / 為什麼是誤報）、丟掉了幾條不在新增行上的。沒有發現就說沒有發現、審了幾個檔。什麼檔案都沒改，這句要寫出來。

## 邊界

不改任何程式碼、不改 ADR、不改提示詞；不在 PR 上留評論（那是 CI 的 `--post`）；不擋、不 approve、不 request changes；不審 ADR-002 分層表以外的任何事（命名、效能、測試涵蓋、風格）；不替架構師裁決任何一條發現。
