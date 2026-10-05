from dataclasses import dataclass

from shop.domains._shared import DomainError


@dataclass
class EmptyOrder(DomainError):
    """送出的訂單沒有任何品項。"""


@dataclass
class OutOfStock(DomainError):
    """品項沒有庫存。cli 的翻譯表漏了它。"""

    item: int
