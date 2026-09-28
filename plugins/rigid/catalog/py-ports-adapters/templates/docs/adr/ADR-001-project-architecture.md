# ADR-001：專案架構

- 狀態：採用
- 日期：<YYYY-MM-DD>

## 背景

<這個系統替誰做什麼、由幾個人開發、有沒有要移交。結構要做到三件事：新加入的人從 README 與 `docs/` 就看得懂；多人同時開發不互相踩到；用語從需求到程式碼只有一套。>

## 決策

**頂層結構採標準形式：**

```
src/__PACKAGE__/  後端（Python，uv 專案，src layout）
  domains/        業務規則，一個資料夾一個業務領域
  application/    use case，唯一的接線處（ADR-002）
  api/            入口一：FastAPI
  cli/            入口二：Typer
  platform/       Context 的建立、logger、設定、資料庫連線、對外 client
scripts/          CI 與 pre-commit 用的檢查
tests/            腳本的測試、整合測試
docs/             plan/、glossary.md、adr/
cloudbuild/       ci.yaml
.github/          workflows/ci.yml、CODEOWNERS
```

後端放在 `src/__PACKAGE__/` 底下，不放在根目錄：根目錄的 `platform/` 會蓋掉 Python 標準函式庫的 `platform` 模組。

**對外用使用者語言，對內用領域的語言。**
需求、畫面、回給使用者的訊息用使用者的話；`domains/` 裡的命名只用 `docs/glossary.md` 登記過的識別名。api 與 cli 是兩種語言之間的翻譯層。

**領域以業務領域切，不以 API 切。**
資料夾名稱是名詞，裡面的函數以動詞_名詞命名。
領域不預先建立、不預先命名，由實作的人先在名詞表登記識別名再建立。

**規則寫成檢查，放進 pre-commit 與 CI 的檢測階段：**
ruff、pyright、import-linter，以及 `scripts/` 的 `check_laws`、`check_evidence`、`check_glossary`、`check_entries`、`check_errors`。內容見 README。

**文件各有一個家：** 開發計畫與進度在 `docs/plan/`（ADR-006），名詞在 `docs/glossary.md`，決策在 `docs/adr/`，law 在各領域的 `laws.md`。

## 後果

- 新加入的人從 README 與 `docs/` 就能看懂結構；領域資料夾之間互不 import，多人同時開發很少互相踩到。
- 會影響所有人的地方（platform、`domains/_shared`、`laws.md`、名詞表、檢查腳本、CI）列在 CODEOWNERS，改動要經過 review。
- 新名詞要先登記才能用，多一道手續，但換來整個程式碼只有一套用語。

## 否決的做法

- **一支 API 一個 feature 資料夾**：資料夾數量跟著端點數量長，同一個業務概念散在十幾個資料夾裡。
- **事先替所有需求命名領域**：還沒有程式碼驗證的邊界，等於替實作的人先做了決定；名字一旦進了名詞表、資料夾、CODEOWNERS，改起來要跨好幾處。
