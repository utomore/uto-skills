"""每個領域 feature.md「入口」表宣告的入口，和實際註冊的雙向一致。入口清單在 _layout.ENTRIES。

- 宣告了、沒註冊：功能沒接上入口。
- 註冊了、沒宣告：沒有文件的孤兒入口。維運的技術入口（_layout.OPS_ROUTE_PREFIX 底下的路由與
  _layout.OPS_COMMAND 群組的指令）除外（ADR-002）。
- 表裡的 use case 必須是 <PACKAGE>.application 匯出的名字；_layout.REQUIRED_ENTRY 指定的入口一定要有，
  其他入口可以是 `-`。
- 有 <PACKAGE>.application.guards 的專案：application 匯出的每一個函數都用它的裝飾器宣告了要什麼，
  表上的「權限項」欄和宣告一樣。沒有 guards 模組就不查。

實際的路由從 <PACKAGE>.api.app 的 create_app() 讀、指令從 <PACKAGE>.cli.main 的 Typer app 讀，
所以兩者建立時都不能連資料庫。別種入口框架在 READERS 加一個讀法。

用法：uv run python -m scripts.check_entries
"""

import importlib
from collections.abc import Callable
from pathlib import Path
from typing import cast

from scripts._common import DOMAINS_DIR, domain_names, report, section, table_rows
from scripts._layout import ENTRIES, OPS_COMMAND, OPS_ROUTE_PREFIX, PACKAGE, REQUIRED_ENTRY

IGNORED_METHODS = {"HEAD", "OPTIONS"}


def _fastapi_routes() -> set[str]:
    """從 OpenAPI 讀實際註冊的路由：include_router 進來的路由在 app.routes 裡是延後展開的，
    OpenAPI 才是展開後的全部。"""
    create_app = importlib.import_module(f"{PACKAGE}.api.app").create_app
    found: set[str] = set()
    paths = cast(dict[str, dict[str, object]], create_app().openapi().get("paths", {}))
    for path, operations in paths.items():
        if path.startswith(OPS_ROUTE_PREFIX):
            continue
        for method in operations:
            if method.upper() not in IGNORED_METHODS:
                found.add(f"{method.upper()} {path}")
    return found


def _typer_commands() -> set[str]:
    import typer.main

    app = importlib.import_module(f"{PACKAGE}.cli.main").app
    found: set[str] = set()

    # typer 內附自己的 click，不用 isinstance 判斷 Group，看有沒有子指令就好
    def walk(cmd: object, prefix: str) -> None:
        subs = getattr(cmd, "commands", None)
        if isinstance(subs, dict):
            for name, sub in cast(dict[str, object], subs).items():
                walk(sub, f"{prefix} {name}".strip())
        elif prefix and prefix.split()[0] != OPS_COMMAND:
            found.add(prefix)

    walk(typer.main.get_command(app), "")
    return found


READERS: dict[str, Callable[[], set[str]]] = {"api": _fastapi_routes, "cli": _typer_commands}


def _guard_of() -> Callable[[object], str | None] | None:
    try:
        return importlib.import_module(f"{PACKAGE}.application.guards").guard_of
    except ModuleNotFoundError:
        return None


def declared(domains_dir: Path = DOMAINS_DIR) -> tuple[dict[str, set[str]], list[str]]:
    """回傳（{入口: 宣告的那一欄的值}、問題）。"""
    declared_by_entry: dict[str, set[str]] = {e: set() for e in ENTRIES}
    problems: list[str] = []
    guard_of = _guard_of()
    for d in domain_names(domains_dir):
        feature = domains_dir / d / "feature.md"
        if not feature.exists():
            continue
        for row in table_rows(section(feature.read_text(encoding="utf-8"), "入口")):
            # application 套件在第一個 use case 出現時才建立，有列才載入
            module = importlib.import_module(f"{PACKAGE}.application")
            fn = row.get("use case", "")
            if not hasattr(module, fn):
                problems.append(
                    f"{d}：feature.md 的 use case {fn} 不是 {PACKAGE}.application 匯出的名字"
                )
            if guard_of is not None and hasattr(module, fn):
                guard = guard_of(getattr(module, fn))
                written = row.get("權限項", "").strip().strip("`")
                if guard != written:
                    problems.append(
                        f"{d}：{fn} 的權限項表上寫「{written or '（沒寫）'}」，"
                        f"use case 宣告的是「{guard or '（沒宣告）'}」"
                    )
            for entry in ENTRIES:
                value = " ".join(row.get(entry, "-").split())
                if value == "-":
                    if entry == REQUIRED_ENTRY:
                        problems.append(
                            f"{d}：{fn} 沒有 {entry} 入口；每個 use case 都要能從 {entry} 執行（ADR-002）"
                        )
                else:
                    declared_by_entry[entry].add(value)
    return declared_by_entry, problems


def undeclared_guards() -> list[str]:
    """application 匯出的函數，包括不在入口表上的，都要有宣告。"""
    guard_of = _guard_of()
    if guard_of is None:
        return []
    module = importlib.import_module(f"{PACKAGE}.application")
    return [
        f"application.{name} 沒有宣告權限項：用 guards.py 的裝飾器宣告它要什麼"
        for name in module.__all__
        if guard_of(getattr(module, name)) is None
    ]


def check() -> list[str]:
    declared_by_entry, problems = declared()
    problems += undeclared_guards()
    for entry in ENTRIES:
        if entry not in READERS:
            problems.append(f"入口 {entry} 沒有讀法：在 scripts/check_entries.py 的 READERS 加一個")
            continue
        wanted, actual = declared_by_entry[entry], READERS[entry]()
        problems += [
            f"feature.md 宣告了 {entry}「{r}」，但沒有註冊" for r in sorted(wanted - actual)
        ]
        problems += [
            f"{entry}「{r}」有註冊，但沒有任何 feature.md 宣告" for r in sorted(actual - wanted)
        ]
    return problems


if __name__ == "__main__":
    raise SystemExit(report("check_entries", check()))
