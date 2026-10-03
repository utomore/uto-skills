---
name: labels
description: rigid 的標籤表，把一個 GitHub repo 的標籤設成固定的九個（feature、bug、refactor、docs、test、chore 分類一個改動，decision 只用在待決題的 issue，duplicate、wontfix 關 issue 時用）：一道指令先印計畫（會建、會改名、會改顏色或說明、會刪），架構師確認之後才動 GitHub；GitHub 替每個新 repo 建的 enhancement、documentation 改名成 feature、docs，標籤表以外的標籤由架構師逐一決定刪或留。不替 issue 與 PR 貼標籤、不加第十個。觸發詞：標籤、label、labels、初始化標籤、設標籤、issue 標籤、PR 標籤、gh label。Use when initializing or re-aligning the GitHub labels of a repo to the fixed rigid label table.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/labels.mjs":*)
---

# rigid:labels — 標籤表

> **核心**：A repo carries one fixed label table; the script aligns GitHub to it, and a label outside the table is touched only when the architect names it.（一個 repo 只有一張固定的標籤表；腳本把 GitHub 對齊到它，表以外的標籤只有架構師點名才動。）步驟與這一句衝突時，這一句贏：停下，回報。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一個 GitHub repo（目前目錄的，或 `OWNER/REPO`）、登入過而且對它有寫入權限的 `gh` | repo 上有標籤表的九個標籤，名稱、顏色、說明都一致；表以外的標籤每一個都有架構師的決定（刪或留）；repo 裡沒有任何檔案被改 |

## 標籤表

| 標籤 | 用在 |
|---|---|
| `feature` | 新增的能力或 API |
| `bug` | 修正壞掉的行為 |
| `refactor` | 不改行為的重構、搬家、改名 |
| `docs` | 只動文件、ADR、計畫或設計稿 |
| `test` | 只動測試或驗證 |
| `chore` | 建置、CI、腳本、依賴、工具設定 |
| `decision` | 待決題（只用在 issue） |
| `duplicate` | 關 issue 時用：重複 |
| `wontfix` | 關 issue 時用：不處理 |

「用在」寫進 GitHub 標籤的說明欄，貼標籤的人在選單上就看得到。

## 分流

- 目前目錄不是 GitHub repo、架構師也沒講是哪一個 → 問他 `OWNER/REPO`，之後每一道指令都帶 `--repo`。
- 指令印「讀 repo 失敗」「讀標籤失敗」或某一步失敗 → `gh` 沒登入或對這個 repo 沒有寫入權限。把 `gh` 的那一段錯誤回報給架構師並停下，授權由他處理；修好之後重跑，做完的不會重做。
- 架構師要表以外的標籤（優先度、元件、客戶）→ 不在這裡；他自己在 GitHub 上建，這道指令不動它。
- 要鋪框架 → `rigid:scaffold`；要談需求與單元 → `rigid:plan`。

## 步驟

1. **印計畫。** 不加 `--apply` 只讀不寫：

   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/labels.mjs" [--repo <OWNER/REPO>]
   ```

   第一行是 repo 的全名，先念給架構師確認是這一個。
2. **把計畫講給架構師聽**：會建哪幾個、哪幾個會改名（`enhancement` → `feature`、`documentation` → `docs`，issue 與 PR 上貼著的跟著改名）、哪幾個會改顏色或說明、哪幾個已經一致。
3. **「不在標籤表、沒動」的每一個，一次一個問：刪或留。** 刪掉的標籤會從所有 issue 與 PR 上消失；架構師要保住那些 issue 與 PR 的分類，就由他先把它們改貼表裡的一個，再回來刪。決定刪的每一個記成一個 `--delete <標籤>`；沒有講的一律留。
4. **帶著 `--delete` 再印一次計畫**，「會刪」那一段與架構師的決定一條一條對上，他確認之後才加 `--apply`：

   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/labels.mjs" [--repo <OWNER/REPO>] [--delete <標籤>]... --apply
   ```

5. **驗。** 不加 `--apply`、不帶 `--delete` 再跑一次：會建、會改名、會改顏色或說明、會刪都是 0，九個都在「已經一致、沒動」。

## 收尾

回報 repo 的全名、建了哪幾個、改名了哪幾個、改了顏色或說明的哪幾個、刪了哪幾個、留下了哪幾個表以外的標籤、最後一次驗的結果。repo 裡什麼檔案都沒改，這句要寫出來。

## 邊界

不替任何 issue 或 PR 貼、換、拿掉標籤；不刪架構師沒有點名的標籤、不替他決定刪或留；不改標籤表的名稱、顏色與說明，不加第十個；不動 repo 的其他設定（分支保護、協作者、CODEOWNERS）；沒有印過計畫、沒有架構師確認，不加 `--apply`。
