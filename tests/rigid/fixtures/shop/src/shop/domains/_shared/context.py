"""每一次呼叫領域函數都會帶進來的 Context。

領域只宣告需要什麼（Protocol），由 platform 組出實作、由入口傳進來。
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


class Logger(Protocol):
    def info(self, event: str, **fields: object) -> None: ...

    def warning(self, event: str, **fields: object) -> None: ...

    def error(self, event: str, **fields: object) -> None: ...


class Clock(Protocol):
    def now(self) -> datetime: ...


@dataclass(frozen=True)
class Actor:
    """發起這一次呼叫的使用者。"""

    user_id: str
    email: str


@dataclass(frozen=True)
class Context:
    actor: Actor
    logger: Logger
    clock: Clock
