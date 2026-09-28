"""這個專案的形狀。scaffold 寫、架構師改；每支檢查腳本都從這裡讀，不各自寫死。"""

PACKAGE = "shop"
ENTRIES = ("api", "cli")
REQUIRED_ENTRY: str | None = "cli"
NON_DOMAIN_OWNERS = frozenset({"platform", "app", "infra"})
PIPELINES = {"ci": ".github/workflows/ci.yml"}
OPS_ROUTE_PREFIX = "/_ops/"
OPS_COMMAND = "ops"
