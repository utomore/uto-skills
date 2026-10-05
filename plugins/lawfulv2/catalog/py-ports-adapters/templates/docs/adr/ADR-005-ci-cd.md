# ADR-005：CI 與 CD

- 狀態：採用
- 日期：<YYYY-MM-DD>

## 背景

<這個專案現在要自動化到哪裡：只在 PR 上跑檢查，還是連建置與部署都自動；部署到哪裡、誰可以放行。>

## 決策

**CI 在每個 PR 上跑兩步，步驟的 id 固定：**

| id | 跑什麼 |
|---|---|
| `check` | `make check`：和本地 pre-commit 同一道（ADR-004） |
| `unit` | `make test` |

- 兩份設定各寫一次同樣的兩步：`.github/workflows/ci.yml`（GitHub Actions）與 `cloudbuild/ci.yaml`（Cloud Build）。只用其中一個平台就刪掉另一份。
- **兩步都綠、CODEOWNERS 核准，才能合進主線。** 這條由原始碼庫的分支保護設定守，不在 CI 設定檔裡。

**CD：**<要不要自動部署、用什麼、部署到哪些環境、誰放行。現在不做就寫「現在只有 CI」與打算什麼時候再定。>

## 後果

- CI 跑的和本地 `make check`、`make test` 相同，本地綠了 CI 才會綠。
- 要連真的資料庫或服務的測試（`make integration`）不在這兩步裡，要另外加步驟與環境。

## 否決的做法

- **CI 另外寫一套檢查指令**：和本地的 `make check` 會分岔，本地綠、CI 紅。
