"""這個專案的形狀。scaffold 寫、架構師改；每支檢查腳本都從這裡讀，不各自寫死。

- PACKAGE：原始碼套件，住 src/<PACKAGE>/，底下有 domains/、application/、platform/ 與每個入口的資料夾。
- ENTRIES：入口的資料夾名。每個入口都有 errors.py 的 TRANSLATIONS（check_errors），
  feature.md 入口表有它的一欄（check_entries）。
- REQUIRED_ENTRY：每個 use case 都要有這個入口（任何領域的服務都能從它直接驗證，ADR-003）；沒有這種要求填 None。
- OPS_ROUTE_PREFIX、OPS_COMMAND：維運的技術入口，不呼叫 use case、不必在入口表宣告（ADR-003）。
"""

PACKAGE = "myapp"
ENTRIES = ("api", "cli")
REQUIRED_ENTRY: str | None = "cli"
OPS_ROUTE_PREFIX = "/_ops/"
OPS_COMMAND = "ops"
