---
status: accepted
date: <YYYY-MM-DD>
decision-makers: [<帳號>]
---
# D-004 ruff、pyright、import-linter 與專案自己的檢查腳本，CI 跑在 <GitHub Actions 或 Cloud Build>

## 當前情境

<幾個人、已經在用什麼、預算與權限的限制。>型錄的這一格附帶一組檢查工具與兩個平台的 CI 設定。

## 選擇

| CI 平台 | 適合 | 代價 |
|---|---|---|
| GitHub Actions（`.github/workflows/ci.yml`） | 原始碼庫在 GitHub | 綁在 GitHub 上 |
| Cloud Build（`cloudbuild/ci.yaml`） | 部署在 Google Cloud，要和部署共用權限與環境 | 要另外設 GitHub 觸發器 |

## 決策

| 項目 | 用什麼 |
|---|---|
| 專案管理 | <工具> |
| 格式與 lint | ruff |
| 型別檢查 | pyright（`src/` 與 `scripts/` 用 strict） |
| 依賴方向 | import-linter（設定在 `pyproject.toml`） |
| 專案自己的規則 | `scripts/check_*.py`，形狀寫在 `scripts/_layout.py` |
| commit 之前跑檢查 | pre-commit |
| CI | <GitHub Actions 或 Cloud Build；只用一個就刪掉另一份設定> |
| CD | <用什麼部署；現在不做就寫「現在只有 CI」> |

每一道檢查守哪條規則、哪幾步綠了才能合寫在 P-004。

## 三個月後的影響

- 檢查全部是 Python 生態的工具，`make sync` 一道裝齊，本地與 CI 同一套版本。
- 兩份 CI 設定只留一份；換平台要重寫那一份，兩步的內容（`make check`、`make test`）不變。
