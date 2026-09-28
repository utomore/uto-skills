---
name: scaffold
description: rigid 的鋪框架，專案的第一個命令（還沒有 scripts/_layout.py 的專案從這裡開始）：架構師從型錄選一格（每一格來自一個真專案，附帶目錄、依賴契約、檢查腳本、pre-commit、CI、CODEOWNERS、CLAUDE.md 與 ADR 骨架），skill 談定專案名、套件名、一句話與 owner，一道指令把整個框架鋪好，make check 與 make test 在空框架上就是綠的；之後要加一層、加檢查、換 CI 也回這裡。不談需求、不建領域、不寫業務程式碼。觸發詞：鋪框架、scaffold、開新專案、立案、選架構、型錄、ports and adapters、四層、加一道檢查、換 CI。Use when starting a rigid project by laying down its whole framework from a catalog cell, or when the framework itself must change.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/scaffold.mjs":*), Bash(make sync), Bash(make check), Bash(make test)
---

# rigid:scaffold — 鋪框架

> **核心**：The architect picks a proven frame from the catalog and lays it down whole, checks included; nothing about the business is decided here.（架構師從型錄挑一個做過的框架，連檢查一起整個鋪下去；這裡不決定任何業務上的事。）步驟與這一句衝突時，這一句贏：停下，回報。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 架構師的意圖、既有程式碼（有的話）、型錄 `${CLAUDE_PLUGIN_ROOT}/catalog/README.md` | 整個框架落地：`CLAUDE.md`、`README.md`、`docs/adr/`（ADR-001、002、006 與索引）、`docs/glossary.md`（空表）、`docs/plan/README.md`、`src/<套件>/` 四層與 `_shared`、`scripts/`（六支檢查、`_layout.py`、AI review 的 `ai_review.py` 與提示詞）、`pyproject.toml`（六條依賴契約、ruff、pyright strict、pytest 的 `law` 標記）、`Makefile`、`.pre-commit-config.yaml`、`CODEOWNERS`、CI（GitHub Actions 與 Cloud Build）、`tests/test_ops.py`；`make check` 與 `make test` 綠；然後接上 `rigid:plan` |

## 分流

- 已經有 `scripts/_layout.py` → 更新模式：只動架構師點名的那一部分（加一道檢查、加一層、換 CI、改 CODEOWNERS），其餘不動；`bin/scaffold.mjs` 不覆蓋任何既有檔，要換的檔先由架構師決定再手動改。
- 要談的是需求、里程碑、驗收 → 不在這裡，走 `rigid:plan`。
- 要審一條分支有沒有把業務規則放錯層 → 不在這裡，走 `rigid:review`。

## 步驟

1. **看現況。** 目標目錄是空的、還是已經有程式碼（`pyproject.toml`、`src/`、`CLAUDE.md`、CI 設定）。已經有的東西每一件都要在步驟 4 之後逐一對。
2. **選型錄的一格。** 讀 `${CLAUDE_PLUGIN_ROOT}/catalog/README.md` 的總表，把每一格的「適用條件」與「代價」講給架構師聽，由他選；只有一格就確認那一格的條件他都接受。**不准現場發明一格**：型錄裡沒有的架構（別的語言、別的分層），回報「型錄沒有這一格，要先從一個真專案抽出來」然後停下。選定後讀那一格的 `README.md`，把「四層」表與「代價」再念一次。
3. **談四個值，一題一題問**：
   - **專案名**（`--project`）：pyproject 的 name 與 cli 指令名，小寫字母、數字、連字號。
   - **套件名**（`--package`）：`src/<套件名>/`，小寫字母、數字、底線；通常是專案名把連字號換成底線。
   - **一句話**（`--tagline`）：這個系統替誰做什麼，README 第一段。只寫架構師說的，不替他寫。
   - **owner**（`--owner`）：CODEOWNERS 的 GitHub 帳號，會影響所有人的路徑（platform、`_shared`、每個領域的 `laws.md`、名詞表、ADR、檢查腳本、CI）改動都要他 review；團隊帳號也可以。
4. **鋪。** 先 `--dry-run` 看會建哪些、跳過哪些，跟架構師確認，再正式跑：

   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/scaffold.mjs" --target <目錄> --package <套件名> --project <專案名> --tagline "<一句話>" --owner <帳號>
   ```

   「已存在、沒動」的每一個檔逐一處理：`CLAUDE.md` 已存在 → 把模板的「## 協作規則」整節補在檔尾，其餘一個字不動；`pyproject.toml` 已存在 → 把模板的 `[tool.ruff]`、`[tool.pyright]`、`[tool.pytest.ini_options]`、`[tool.importlinter]` 各節併進去，`[project]` 與依賴由架構師決定；`README.md`、CI 設定、`Makefile` 已存在 → 列出模板裡有而它沒有的段落，架構師決定併不併。
5. **填 ADR 的背景。** ADR-001、002、006 的日期已經填了，「背景」是佔位符：問架構師這個系統替誰做什麼、幾個人開發、要不要移交，寫成一到三句。決策與否決的做法是型錄那一格的內容，架構師要改哪一條就改哪一條，改了要說得出理由。`docs/adr/README.md` 的「待決定」列他現在講得出、還沒定的事（資料庫、部署、設定）。
6. **驗。** `make sync`，然後 `make check` 與 `make test` 都要綠。紅的一律是鋪的問題（既有檔沒併好、環境缺工具），修到綠；不准為了綠去改檢查腳本或契約。
7. **接上 plan**：直接執行 `rigid:plan`，與架構師談第一批需求並切成單元，不等他另外下指令。

## 收尾

回報選了哪一格與架構師接受的代價、四個值、建了幾個檔與跳過了哪幾個（每個怎麼處理了）、ADR 背景寫了什麼、`make check` 與 `make test` 的結果。建議以 `plan/scaffold` 分支發 PR 合進主線。接上 plan 之後的收尾由它做。

## 邊界

不談需求、驗收、里程碑（`rigid:plan`）；不建任何領域、不在名詞表登記任何名詞、不寫任何業務程式碼（領域由做第一個單元的人先登記名詞再建）；不替架構師選型錄的格、不替他寫一句話與 ADR 的背景；不發明型錄裡沒有的架構；不為了讓檢查變綠改檢查腳本或依賴契約；不覆蓋任何既有的檔。
