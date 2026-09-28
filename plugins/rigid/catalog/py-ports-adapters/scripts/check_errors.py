"""每一個 DomainError 的子類別，在每個入口的翻譯表裡都有一列：<入口>/errors.py 的 TRANSLATIONS。
入口清單在 _layout.ENTRIES。

每個入口各自翻給自己的使用者（ADR-002），措辭可以不同；這裡只檢查有沒有翻，不檢查翻得一不一樣。
漏翻的錯誤到了線上只會變成「未預期的錯誤」，所以在檢測階段就擋下。

用法：uv run python -m scripts.check_errors
"""

import importlib
import pkgutil

from scripts._common import report
from scripts._layout import ENTRIES, PACKAGE


def all_domain_errors() -> set[type]:
    domains = importlib.import_module(f"{PACKAGE}.domains")
    shared = importlib.import_module(f"{PACKAGE}.domains._shared")
    base: type = shared.DomainError

    for info in pkgutil.walk_packages(domains.__path__, prefix=f"{PACKAGE}.domains."):
        if not info.name.rsplit(".", 1)[-1].startswith("test_"):
            importlib.import_module(info.name)

    found: set[type] = set()
    stack: list[type] = [base]
    while stack:
        for sub in stack.pop().__subclasses__():
            # 測試裡為了測翻譯而定義的子類別不算
            if sub.__module__.startswith(f"{PACKAGE}.domains."):
                found.add(sub)
            stack.append(sub)
    return found


def tables() -> dict[str, set[type]]:
    """{翻譯表所在的檔案: 表裡有的錯誤型別}。"""
    return {
        f"{entry}/errors.py": set(importlib.import_module(f"{PACKAGE}.{entry}.errors").TRANSLATIONS)
        for entry in ENTRIES
    }


def check(translated: dict[str, set[type]] | None = None) -> list[str]:
    translated = tables() if translated is None else translated
    errors = sorted(all_domain_errors(), key=lambda e: (e.__module__, e.__qualname__))
    return [
        f"{e.__module__}.{e.__qualname__} 沒有在 {where} 的 TRANSLATIONS 裡"
        for where, table in translated.items()
        for e in errors
        if e not in table
    ]


if __name__ == "__main__":
    raise SystemExit(report("check_errors", check()))
