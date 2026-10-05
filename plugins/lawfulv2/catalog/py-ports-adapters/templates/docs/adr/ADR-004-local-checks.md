# ADR-004：本地檢查

- 狀態：採用
- 日期：<YYYY-MM-DD>

## 背景

ADR-003 的架構要靠檢查守著：沒有檢查的規則，寫的人與 LLM 都會在趕工的時候繞過去。
檢查要在 commit 之前就跑得到，而且和 CI 跑的是同一道，本地綠了 CI 才不會紅。

## 決策

**規則分兩層，每一條規則只有一個守門員。**

| 層 | 守門員 | 紅了 |
|---|---|---|
| 機器判得了 | ruff、pyright、import-linter、`scripts/check_*` | 擋：pre-commit 與 CI 同一道 |
| 機器判不了 | CODEOWNERS 的 review | 擋：owner 沒核准不能合併 |

**`make check` 是唯一的入口**，pre-commit 與 CI 的檢測階段跑的都是它裡面的那幾道：

| 工具 | 檢查什麼 |
|---|---|
| ruff | 格式與 lint |
| pyright | 型別（`src/` 與 `scripts/` 用 strict）；platform 的實作與領域的 Protocol 是否對得上 |
| import-linter | ADR-003 的依賴方向，六條契約（設定在 `pyproject.toml`） |
| `scripts/check_laws.py` | 每個領域有 `feature.md`、`laws.md`；每條 law 至少有一個 `@pytest.mark.law("LAW-n")` 的測試；測試檔的命名 |
| `scripts/check_glossary.py` | 領域資料夾都在名詞表的識別名欄 |
| `scripts/check_entries.py` | `feature.md` 入口表列的 use case 是 `application` 匯出的名字、每一個都有 cli 入口；宣告的路由與指令和實際註冊的雙向一致 |
| `scripts/check_errors.py` | 每個 `DomainError` 子類別在兩個入口的錯誤翻譯表都有一列 |

- **pre-commit 不跑 pytest**（太慢），測試交給 `make test` 與 CI。
- **檢查腳本住在專案的 `scripts/`**，是專案的東西：規則改了就改腳本，改動要 owner review。專案的形狀寫在 `scripts/_layout.py`，腳本不各自寫死。
- **CODEOWNERS 圈住會影響所有人的路徑**：platform、`domains/_shared`、每個領域的 `laws.md`、名詞表、`docs/adr/`、`scripts/`、`pyproject.toml`、pre-commit 與 CI 的設定。領域資料夾不在裡面，由做的人負責。

## 後果

- 違反依賴方向、漏了入口、漏了翻譯、law 沒有測試，在 commit 之前就被擋下。
- 改 law、改 platform、改檢查腳本都要 owner 看過；owner 不在時這些改動會卡住。
- 「這段邏輯該不該放在這一層」這種語意上的判斷，機器擋不了，靠 review 的人對 ADR-003 的分層表看。

## 否決的做法

- **規則只寫在文件裡，靠 review 守**：review 的人會漏，LLM 讀了文件也會違反；能寫成檢查的就寫成檢查。
- **檢查腳本放在專案外面、由工具更新**：專案改不了自己的規則，工具一更新專案就可能紅。
