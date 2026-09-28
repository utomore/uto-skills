"""這個專案的形狀。scaffold 寫、架構師改；每支檢查腳本都從這裡讀，不各自寫死。

- PACKAGE：原始碼套件，住 src/<PACKAGE>/，底下有 domains/、application/、platform/ 與每個入口的資料夾。
- ENTRIES：入口的資料夾名。每個入口都有 errors.py 的 TRANSLATIONS（check_errors），
  feature.md 入口表有它的一欄（check_entries）。
- NON_DOMAIN_OWNERS：不是領域、但可以在 docs/plan 的 domains 欄負責一個單元的地方；它們沒有 feature.md，
  只有 platform 可以有 laws.md（只列候選）。
- PIPELINES：證據 `<前綴>:<步驟>` 對到哪份管線檔（check_evidence）；步驟以 `id: <步驟>` 出現在那份檔裡。
- REQUIRED_ENTRY：每個 use case 都要有這個入口（任何領域的服務都能從它直接驗證，ADR-002）；沒有這種要求填 None。
- OPS_ROUTE_PREFIX、OPS_COMMAND：維運的技術入口，不呼叫 use case、不必在入口表宣告（ADR-002）。
"""

PACKAGE = "myapp"
ENTRIES = ("api", "cli")
REQUIRED_ENTRY: str | None = "cli"
NON_DOMAIN_OWNERS = frozenset({"platform", "app", "infra"})
PIPELINES = {"ci": ".github/workflows/ci.yml"}
OPS_ROUTE_PREFIX = "/_ops/"
OPS_COMMAND = "ops"
