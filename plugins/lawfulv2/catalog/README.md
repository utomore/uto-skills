# 型錄

`lawfulv2:kickoff` 談到軟體架構（ADR-003）時從這裡給選項。每一格是一個做過的架構：目錄、依賴契約、檢查腳本、pre-commit、CI、CODEOWNERS，以及寫好決策的 ADR-003、ADR-004、ADR-005，全部附帶；沒有檢查的架構是願望，不是框架。每一格都抽自一個真專案，沒有來源專案的格不進型錄，skill 不准現場發明一格。使用者要的架構不在型錄裡，kickoff 只把他的決定寫成 ADR，不附檢查。

| 格 | 語言與工具鏈 | 入口 | 適用條件 | 代價 |
|---|---|---|---|---|
| [py-ports-adapters](py-ports-adapters/README.md) | Python 3.13、uv、ruff、pyright strict、import-linter、pytest | FastAPI 與 Typer 兩個對等入口 | 多人同時開發、業務規則多、要兩種以上入口、日後要移交 | 每個 use case 多一個薄函數；新增一個入口要動四處 |

一格一個資料夾：`README.md`（名稱、適用條件、代價、來源、附帶什麼）、`templates/`（鋪進專案的檔，佔位符 `__PACKAGE__`、`__PROJECT__`、`__TAGLINE__`、`__OWNER__`）、`scripts/`（原樣複製進專案 `scripts/` 的檢查腳本；專案的形狀由 `bin/scaffold.mjs` 寫成 `scripts/_layout.py`）。同一個路徑在一格的 `templates/` 與 plugin 的 `templates/`（文件層）都有時，用這一格的。
