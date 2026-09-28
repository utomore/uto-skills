"""每個 use case 宣告它要什麼。宣告記在函數的 guard 屬性上，check_entries 比對入口表的「權限項」欄。"""

from collections.abc import Callable
from typing import TypeVar

F = TypeVar("F", bound=Callable[..., object])
GUARD = "guard"
LOGGED_IN = "登入即可"


def requires(permission: str) -> Callable[[F], F]:
    def decorate(fn: F) -> F:
        setattr(fn, GUARD, permission)
        return fn

    return decorate


def logged_in(fn: F) -> F:
    setattr(fn, GUARD, LOGGED_IN)
    return fn


def guard_of(fn: object) -> str | None:
    return getattr(fn, GUARD, None)
