# __PROJECT__

__TAGLINE__

## 開始

```bash
make sync                  # 安裝套件（uv sync），裝上 commit 前的檢查（pre-commit）
make check && make test    # 改完都跑這兩個
uv run __PROJECT__ --help  # cli：和 api 對等的入口
```

## 指令

每一個都寫在 `Makefile`。

| 用途 | 指令 | 做什麼 |
|---|---|---|
| 環境 | `make sync` | 安裝套件、裝上 pre-commit；拉了新的依賴之後也跑一次 |
| 改完 | `make check` | 和 CI 的檢測階段相同：ruff、pyright、import-linter 與 `scripts/check_*`（見下面「檢查」） |
| | `make test` | 單元測試 |
| | `make fmt` | 自動修 lint 與排版 |
| 開發計畫 | `make progress` | 每個里程碑幾個單元完成；`M=M3` 列出 M3 的每個單元有幾條驗收有證據（ADR-006） |

## 結構

```
src/__PACKAGE__/
  domains/            業務規則，一個資料夾一個業務領域
    _shared/          所有領域共用的 Context 與 DomainError
    <領域>/
      feature.md      邊界與入口表
      laws.md         這個領域必須成立的性質
      ports.py        這個領域需要外面提供的東西（Protocol）
      types.py        這個領域的型別（frozen dataclass）
      errors.py       這個領域丟出的錯誤型別（dataclass，不 frozen）
      *.py            函數以動詞_名詞命名
      test_<領域>.py  以替身為主的單元測試
  application/        use case：一個函數一個 use case，把 platform 的實作與別的領域的函數接到領域的 port 上
  api/                入口一：FastAPI 路由、中介層、錯誤翻譯表（帶 HTTP 狀態）
  cli/                入口二：Typer 指令，和 api 對等、直接呼叫同一個 use case；errors.py 是自己的錯誤翻譯表
  platform/           領域宣告的 Protocol 的實作、Context 的建立、logger、設定；README.md 是領域怎麼用
scripts/              CI 與 pre-commit 用的檢查、開發計畫的進度（make progress）；_layout.py 是這個專案的形狀
tests/                腳本的測試、整合測試
docs/                 plan/（開發計畫：里程碑與可開發單元）、glossary.md（名詞表）、adr/（架構決策）
cloudbuild/           ci.yaml（PR 檢查）
.github/workflows/    ci.yml（PR 檢查）
```

## 規則

完整的理由見 `docs/adr/`：ADR-001 專案架構、ADR-002 程式碼設計框架。

**對外用使用者語言，對內用領域的語言。**
需求、畫面、回給使用者的訊息用使用者的話；`domains/` 裡的資料夾、型別、函數用 `docs/glossary.md` 登記過的識別名。
api 與 cli 是翻譯層：領域丟出錯誤型別，兩個入口各有一張翻譯表把它換成自己的使用者看得懂的話：`api/errors.py`（帶 HTTP 狀態）與 `cli/errors.py`。

**依賴方向（ports and adapters）。**

```
api ─┐
     ├─► application ─► domains ◄── platform（實作 domains 宣告的 Protocol）
cli ─┘        │
              └─► platform（拿實作來接線）
```

- `domains` 不 import `api`、`cli`、`application`、`platform`，也不 import 任何對外套件。它只用傳進來的 `Context` 與自己 `ports.py` 宣告的 Protocol。
- 領域之間互不 import；共用的只有 `domains/_shared`。一個領域需要別的領域的東西，在 `ports.py` 宣告，由 use case 接上。
- `application` 是唯一的接線處；每個入口都呼叫一個 use case（維運的技術入口除外：api 的 `/_ops/` 與 cli 的 `ops`）。每個 use case 都要有 cli 指令，任何領域的服務都能從 cli 直接驗證。
- `api` 與 `cli` 互不 import，不呼叫領域函數；從領域只拿 `types.py`、`errors.py` 與 `_shared`。`platform` 不 import `application` 與入口。
- `create_app()` 與 cli 的 app 建立時不連資料庫、不讀設定；platform 的物件由程序進入點建一次，活到程序結束。

**新增一個領域。**

1. 在 `docs/glossary.md` 登記名詞與識別名（CODEOWNERS 會要求 review）。
2. 建資料夾與 `feature.md`、`laws.md`。
3. 在 `docs/plan/` 用到它的單元，domains 欄填上它。

## 檢查

| 工具 | 檢查什麼 |
|---|---|
| ruff | 格式與 lint |
| pyright | 型別；platform 的實作與領域的 Protocol 是否對得上 |
| import-linter | 上面的依賴方向（設定在 `pyproject.toml`） |
| `scripts/check_laws.py` | 單元列的領域都存在、id 不重複；law 引用的 REQ 存在且列了這個領域；每個領域有 `feature.md`、`laws.md`；每條 law 至少有一個 `@pytest.mark.law("LAW-n")` 的測試 |
| `scripts/check_evidence.py` | `docs/plan` 驗收行尾寫的證據都找得到：law、測試、CI 的步驟、`make check` 的腳本、展示紀錄（ADR-006） |
| `scripts/check_glossary.py` | 領域資料夾都在名詞表的識別名欄 |
| `scripts/check_entries.py` | `feature.md` 入口表列的 use case 是 `application` 匯出的名字、每一個都有 cli 入口；宣告的路由與指令和實際註冊的雙向一致（api 的 `/_ops/` 與 cli 的 `ops` 除外） |
| `scripts/check_errors.py` | 每個 `DomainError` 子類別在兩個入口的錯誤翻譯表（`api/errors.py`、`cli/errors.py`）都有一列 |
| pytest | 全部通過（CI） |
