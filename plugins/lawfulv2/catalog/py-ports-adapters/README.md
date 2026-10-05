# py-ports-adapters：Python、ports and adapters、兩個對等入口

| 欄 | 內容 |
|---|---|
| 語言與工具鏈 | Python 3.13、uv、ruff、pyright strict、import-linter、pytest、pre-commit |
| 入口 | `api`（FastAPI）與 `cli`（Typer）對等；每個 use case 都要有 cli 指令，任何領域的服務都能從 cli 直接驗證 |
| 適用條件 | 多人同時開發、業務規則多、要兩種以上入口、日後要移交給別人接手 |
| 代價 | 每個 use case 多一個薄函數；新增一個入口要動四處（領域函數、use case、兩個入口的註冊、`feature.md` 入口表），漏一處 `check_entries` 或 pyright 擋下 |
| 來源專案 | data-graph-malloy（2026-09-28 抽出） |

## 四層

```
api ─┐
     ├─► application ─► domains ◄── platform（實作 domains 宣告的 Protocol）
cli ─┘        │
              └─► platform（拿實作來接線）
```

| 層 | 放什麼 | 不放什麼 |
|---|---|---|
| `domains/<領域>/` | 業務規則、型別（frozen dataclass）、錯誤型別、這個領域需要外面提供什麼（`ports.py` 的 Protocol） | 任何 I/O、任何對外套件、別的領域 |
| `application/` | use case：一個函數一個 use case，拿 `Context`、組好依賴、依序呼叫領域函數、一個交易包住全部 | 業務規則、law |
| `platform/` | 領域宣告的 Protocol 的實作：資料庫、對外服務、logger、設定、身份 | 入口、業務規則、領域之間的接線 |
| `api/`、`cli/` | 把外面的請求轉成呼叫一個 use case；請求的格式、錯誤的翻譯 | 任何接線、任何規則 |

## 附帶什麼

| 東西 | 在哪 |
|---|---|
| 目錄與 `_shared`（`Context`、`DomainError`）、兩個入口的骨架、`platform/` 的說明 | `templates/src/__PACKAGE__/` |
| 一份測試：兩個入口建得起來、維運的技術入口在，`make test` 在空框架上就是綠的 | `templates/tests/test_ops.py` |
| 六條依賴契約（import-linter）、ruff、pyright strict、pytest 的 `law` 標記 | `templates/pyproject.toml` |
| 檢查腳本：`check_laws`、`check_glossary`、`check_errors`、`check_entries` | `scripts/`（原樣複製）；專案的形狀在 `scripts/_layout.py`（`bin/scaffold.mjs` 寫） |
| `make check`（與 CI 的檢測階段同一道）、`make test`、pre-commit | `templates/Makefile`、`templates/.pre-commit-config.yaml` |
| CI：GitHub Actions 與 Cloud Build 各一份，兩步的 id 固定（`check`、`unit`） | `templates/.github/workflows/ci.yml`、`templates/cloudbuild/ci.yaml` |
| CODEOWNERS：會影響所有人的路徑 | `templates/CODEOWNERS` |
| `CLAUDE.md`（這一格的協作規則）、`README.md`（結構、依賴方向、檢查表、指令表） | `templates/` |
| 寫好決策的 ADR-003 軟體架構（含分層表、law 住在領域的 `laws.md`）、ADR-004 本地檢查、ADR-005 CI 與 CD；背景與 CD 由 `lawfulv2:kickoff` 照使用者講的填 | `templates/docs/adr/` |
| 名詞表（空表，`check_glossary` 讀它的識別名欄） | `templates/docs/glossary.md` |

ADR-001 目標與技術基礎、ADR-002 專案管理、`docs/guide/`、`docs/backlog.md` 與 ADR 索引不屬於這一格，來自 plugin 的文件層 `templates/`。

## 鋪的順序

`bin/scaffold.mjs --catalog py-ports-adapters` 一次做完：渲染這一格的 `templates/`（佔位符換成專案的值，`src/__PACKAGE__` 改名）、複製 `scripts/`、寫 `scripts/_layout.py`，再補上文件層裡這一格沒有的檔。已經存在的檔一律不覆蓋、逐一列出，由 `lawfulv2:kickoff` 跟使用者一個一個對。
