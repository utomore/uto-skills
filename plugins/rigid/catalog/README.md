# 型錄

`rigid:scaffold` 鋪框架時從這裡選一格。每一格是一個做過的框架：目錄、依賴契約、檢查腳本、pre-commit、CI、CODEOWNERS、`CLAUDE.md` 與 ADR 骨架，全部附帶；沒有檢查的架構是願望，不是框架。每一格都抽自一個真專案，沒有來源專案的格不進型錄，skill 不准現場發明一格。

| 格 | 語言與工具鏈 | 入口 | 適用條件 | 代價 |
|---|---|---|---|---|
| [py-ports-adapters](py-ports-adapters/README.md) | Python 3.13、uv、ruff、pyright strict、import-linter、pytest | FastAPI 與 Typer 兩個對等入口 | 多人同時開發、業務規則多、要兩種以上入口、日後要移交 | 每個 use case 多一個薄函數；新增一個入口要動四處 |

一格一個資料夾：`README.md`（名稱、適用條件、代價、來源、附帶什麼）、`templates/`（鋪進專案的檔，佔位符 `__PACKAGE__`、`__PROJECT__`、`__TAGLINE__`、`__OWNER__`）、`scripts/`（原樣複製進專案 `scripts/` 的檢查腳本；專案的形狀由 scaffold 寫成 `scripts/_layout.py`）。
