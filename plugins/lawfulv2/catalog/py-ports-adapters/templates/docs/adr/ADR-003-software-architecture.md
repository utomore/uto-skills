# ADR-003：軟體架構

- 狀態：採用
- 日期：<YYYY-MM-DD>

## 背景

<這個系統由幾個人開發、有沒有要移交、有幾種入口。結構要做到三件事：新加入的人從 README 與 `docs/` 就看得懂；多人同時開發不互相踩到；用語從需求到程式碼只有一套。>

多人同時開發時，最常出事的地方是：業務規則和資料庫、HTTP 纏在一起，測試要起整套環境；
一份共用的介面檔每個人都在改，一直衝突；依賴組裝寫錯，到執行期才發現；錯誤訊息散在各處，用語不一致；
一個 use case 要用到好幾個領域時，接線散在各個入口，api 與 cli 各接一套。

## 決策

採用型錄的 `py-ports-adapters`：Python、ports and adapters、`api` 與 `cli` 兩個對等入口。

**頂層結構採標準形式：**

```
src/__PACKAGE__/  後端（Python，uv 專案，src layout）
  domains/        業務規則，一個資料夾一個業務領域
  application/    use case，唯一的接線處
  api/            入口一：FastAPI
  cli/            入口二：Typer
  platform/       Context 的建立、logger、設定、資料庫連線、對外 client
scripts/          pre-commit 與 CI 用的檢查（ADR-004）
tests/            腳本的測試、整合測試
docs/             adr/、glossary.md、guide/、backlog.md
cloudbuild/       ci.yaml（ADR-005）
.github/          workflows/ci.yml（ADR-005）
CODEOWNERS        會影響所有人的路徑，改動要 owner review（GitHub 從根目錄讀）
```

後端放在 `src/__PACKAGE__/` 底下，不放在根目錄：根目錄的 `platform/` 會蓋掉 Python 標準函式庫的 `platform` 模組。

**對外用使用者語言，對內用領域的語言。**
需求、畫面、回給使用者的訊息用使用者的話；`domains/` 裡的命名只用 `docs/glossary.md` 登記過的識別名。api 與 cli 是兩種語言之間的翻譯層。

**領域以業務領域切，不以 API 切。**
資料夾名稱是名詞，裡面的函數以動詞_名詞命名。
領域不預先建立、不預先命名，由實作的人先在名詞表登記識別名再建立。

**law 住在領域裡。** 一個領域一份 `laws.md`，寫這個領域必須成立的性質；寫法與測試見下面「law 與測試」。

**四層，依賴只有一個方向。**

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

- 領域是核心：只依賴傳進來的 `Context` 與自己宣告的 Protocol，不 import `api`、`cli`、`platform`、`application`，也不 import 任何對外套件。
- **領域之間互不 import。** 一個領域需要別的領域的東西，一樣在自己的 `ports.py` 宣告 Protocol，由 application 把另一個領域的函數接上去。
- **每個入口都呼叫一個 use case**，不直接呼叫領域函數；唯一的例外是維運的技術入口：api 的 `/_ops/` 端點與 cli 的 `ops` 群組（健康檢查這類 platform 自己的事），它們不屬於任何領域，直接用 platform。只碰一個領域的 use case，application 的函數就是幾行：拿依賴、呼叫、回傳。
- application 是唯一的接線處：platform 的實作、別的領域的函數，都在這裡接到 use case 需要的 port 上。api 與 cli 共用同一份接線。
- 這些方向由 import-linter 檢查（`pyproject.toml`）：domains 不碰其他三層與對外套件；領域之間獨立；platform 不 import application 與入口；application 不 import 入口；api 與 cli 互不 import，也不呼叫領域函數，從領域只能拿型別（`types.py`）、錯誤型別（`errors.py`）與 `_shared`。

**port 跟著領域走，不放共用。**
`domains/_shared/context.py` 只放所有領域都用的東西（使用者、logger、clock），寫好之後幾乎不再變動。
某個領域才需要的依賴，寫在那個領域的 `ports.py`。

```python
# domains/<領域>/<動詞_名詞>.py
def place_order(ctx: Context, deps: PlaceOrderDeps, ...) -> Order: ...

# application/place_order.py
def place_order(ctx: Context, platform: Platform, ...) -> Order:
    with platform.transaction() as tx:
        deps = PlaceOrderDeps(orders=Orders(tx))
        return orders.place_order(ctx, deps, ...)
```

好幾個領域都要用同一種外部服務時，各自在 `ports.py` 宣告只含自己用到的方法；platform 寫一個實作就能同時滿足。Protocol 看結構、不看繼承，所以不需要共用的介面檔。

**用 pyright 在檢測階段抓組裝錯誤。**
`src/` 與 `scripts/` 用 strict 模式。application 接線的地方都有型別標註：platform 的工廠函數標上回傳型別，傳進領域函數時參數型別是 Protocol。實作少一個方法、方法名稱拼錯，pyright 就報錯，不必等到執行期。

**錯誤是型別，訊息在入口。**
領域丟出 `DomainError` 的子類別（dataclass，帶欄位，名稱用領域語言），不寫給人看的訊息。錯誤的 dataclass 不 frozen：例外被丟出時要寫入 `__traceback__`，frozen 會失敗。
錯誤的翻譯是入口的職責，兩個入口各有一張 `TRANSLATIONS`：`api/errors.py` 把每個錯誤型別翻成 HTTP 狀態與畫面上的話，`cli/errors.py` 翻成終端機上的話（以 1 結束）。兩邊的使用者不同，措辭可以不同。`check_errors` 檢查每個錯誤型別兩張表都有，不檢查翻得一不一樣。

**入口的格式由 api 負責。**
請求的形狀（欄位、型別、多出來的鍵）由 api 的 pydantic 模型檢查，設定 `extra="forbid"`，不寫成 law。
「名稱的規則」「大小上限」這類業務規則屬於領域，寫成領域的 law。

**入口表列 use case。**
每個領域 `feature.md` 的入口表，一列一個 use case：application 的函數名、api 路由、cli 指令。跨領域的 use case 寫在它服務的那個領域的 `feature.md`。`check_entries` 檢查表裡的函數是 `application` 匯出的名字、路由與指令雙向一致。

**platform 物件建一次，活到程序結束；建立 app 時不做 I/O。**
`create_app()` 與 cli 的 Typer app 建立時不連資料庫、不讀設定，這讓 `check_entries` 能在沒有資料庫的環境載入 app 比對路由，測試也容易寫。platform 的物件由程序進入點建一次，api 放進 `app.state`、cli 放進 `ctx.obj`。

**law 與測試。**
- 領域的 `laws.md` 分兩節：`## Laws` 每條一行、以 `- LAW-<n>` 開頭，每條至少有一個測試以 `@pytest.mark.law("LAW-<n>")` 標記（`check_laws` 檢查）；`## 候選` 放還沒實作的性質，實作時連同測試搬進 `## Laws`。
- 領域的單元測試用替身，放在領域資料夾，檔名 `test_<領域>.py` 或 `test_<領域>_<主題>.py`。
- application 沒有 law；它的測試是把替身接上、確認順序與交易對。
- platform 的性質寫成一般測試（要連真的資料庫的放 `tests/integration/`）；`platform/laws.md` 只列候選，轉成測試後刪掉那一行。

## 後果

- 新加入的人從 README 與 `docs/` 就能看懂結構；領域資料夾之間互不 import，多人同時開發很少互相踩到。
- 會影響所有人的地方（platform、`domains/_shared`、`laws.md`、名詞表、檢查腳本、CI）列在 CODEOWNERS，改動要經過 review。
- 新名詞要先登記才能用，多一道手續，但換來整個程式碼只有一套用語。
- 領域的測試不需要資料庫與網路，跑得快；law 只測自己的領域，不會因為別的領域改了而壞。
- 換掉資料庫或對外服務只動 platform；一個 use case 多用一個領域，只動 application 的那一個函數。
- 每個 use case 多一個薄函數；只碰一個領域時它看起來多餘，但 api 與 cli 因此共用同一份接線。
- 新增一個入口要動四處：領域函數、application 的 use case、api 與 cli 註冊、`feature.md` 的入口表；漏一處 `check_entries` 或 pyright 就會擋下。
- cli 和 api 對等：每個 use case 都要有 cli 指令（`check_entries` 要求入口表的 cli 欄不能是 `-`；api 入口可以沒有，例如初始化），任何領域的服務都能從 cli 直接驗證，不必起 api 伺服器。

## 否決的做法

- **一支 API 一個 feature 資料夾**：資料夾數量跟著端點數量長，同一個業務概念散在十幾個資料夾裡。
- **事先替所有需求命名領域**：還沒有程式碼驗證的邊界，等於替實作的人先做了決定；名字一旦進了名詞表、資料夾、CODEOWNERS，改起來要跨好幾處。
- **兩個入口共用一張翻譯表（放在 application）**：application 只放 use case，翻譯是入口的職責；表裡的 HTTP 狀態只有 api 用得到，放進 application 是滲漏；共用一句話也逼得瀏覽器與終端機講同一句。
- **領域之間單向 import（分層的領域）**：上層領域的 law 要連下層一起跑或 mock 下層的函數，law 不再只測自己；依賴藏在 import 裡，要讀程式碼才看得出哪個領域用了哪個。
- **領域宣告 port，由 platform 呼叫另一個領域來實作**：platform 裝進業務的接線，領域之間的依賴藏在 platform 裡。
- **所有 port 放在一個共用的 `ports.py`**：每個領域都要改同一個檔案，多人開發一直衝突，也看不出哪個領域依賴什麼。
- **Context 裝下所有依賴**：會變成什麼都往裡放的大物件，領域看不出自己到底依賴什麼，替身也難寫。
- **領域直接丟帶訊息的例外**：訊息散在各領域，用語不一致，也把使用者語言帶進了領域。
- **錯誤用 `E011` 這類代碼**：代碼要另外查表才看得懂，也帶不了欄位，pyright 也查不到。
