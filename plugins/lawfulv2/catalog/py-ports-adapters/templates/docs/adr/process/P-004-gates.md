---
status: accepted
date: <YYYY-MM-DD>
decision-makers: [<帳號>]
---
# P-004 檢查與合併的關卡：每條規則一個守門員，本地與 CI 同一道

## 當前情境

P-003 的架構要靠檢查守著：沒有檢查的規則，寫的人與 LLM 都會在趕工的時候繞過去；規則只寫在文件裡靠 review 守，review 的人會漏，LLM 讀了文件也會違反。
檢查要在 commit 之前就跑得到，而且和 CI 跑的是同一道，本地綠了 CI 才不會紅。<這個專案現在要自動化到哪裡：只在 PR 上跑檢查，還是連建置與部署都自動；部署到哪裡、誰可以放行。>

## 決策

**規則分兩層，每一條規則只有一個守門員；能寫成檢查的就寫成檢查。**

| 層 | 守門員 | 紅了 |
|---|---|---|
| 機器判得了 | ruff、pyright、import-linter、`scripts/check_*` | 擋：pre-commit 與 CI 同一道 |
| 機器判不了 | CODEOWNERS 的 review | 擋：owner 沒核准不能合併 |

**`make check` 是唯一的入口**，pre-commit 與 CI 的檢測階段跑的都是它裡面的那幾道：

| 工具 | 檢查什麼 |
|---|---|
| ruff | 格式與 lint |
| pyright | 型別（`src/` 與 `scripts/` 用 strict）；platform 的實作與領域的 Protocol 是否對得上 |
| import-linter | P-003 的依賴方向，六條契約（設定在 `pyproject.toml`） |
| `scripts/check_laws.py` | 每個領域有 `feature.md`、`laws.md`；每條 law 至少有一個 `@pytest.mark.law("LAW-n")` 的測試；測試檔的命名 |
| `scripts/check_glossary.py` | 領域資料夾都在名詞表的識別名欄 |
| `scripts/check_entries.py` | `feature.md` 入口表列的 use case 是 `application` 匯出的名字、每一個都有 cli 入口；宣告的路由與指令和實際註冊的雙向一致 |
| `scripts/check_errors.py` | 每個 `DomainError` 子類別在兩個入口的錯誤翻譯表都有一列 |

- **pre-commit 不跑 pytest**（太慢），測試交給 `make test` 與 CI。
- **檢查腳本住在專案的 `scripts/`**，是專案的東西：規則改了就改腳本，改動要 owner review。專案的形狀寫在 `scripts/_layout.py`，腳本不各自寫死。腳本不放在專案外面由工具更新：那樣專案改不了自己的規則，工具一更新專案就可能紅。
- **CODEOWNERS 圈住會影響所有人的路徑**：platform、`domains/_shared`、每個領域的 `laws.md`、名詞表、`docs/adr/`、`scripts/`、`pyproject.toml`、pre-commit 與 CI 的設定。領域資料夾不在裡面，由做的人負責。

**CI 在每個 PR 上跑兩步，步驟的 id 固定：**

| id | 跑什麼 |
|---|---|
| `check` | `make check`：和本地 pre-commit 同一道 |
| `unit` | `make test` |

- 兩份設定各寫一次同樣的兩步：`.github/workflows/ci.yml`（GitHub Actions）與 `cloudbuild/ci.yaml`（Cloud Build）。只用其中一個平台就刪掉另一份（D-004）。CI 不另外寫一套檢查指令：和本地的 `make check` 會分岔，本地綠、CI 紅。
- **兩步都綠、CODEOWNERS 核准，才能合進主線。** 這條由原始碼庫的分支保護設定守，不在 CI 設定檔裡。

**CD：**<要不要自動部署、部署到哪些環境、誰放行。現在不做就寫「現在只有 CI」與打算什麼時候再定。>

## 三個月後的影響

- 違反依賴方向、漏了入口、漏了翻譯、law 沒有測試，在 commit 之前就被擋下。
- 改 law、改 platform、改檢查腳本都要 owner 看過；owner 不在時這些改動會卡住。
- 「這段邏輯該不該放在這一層」這種語意上的判斷，機器擋不了，靠 review 的人對 P-003 的分層表看。
- CI 跑的和本地 `make check`、`make test` 相同，本地綠了 CI 才會綠。
- 要連真的資料庫或服務的測試（`make integration`）不在這兩步裡，要另外加步驟與環境。
