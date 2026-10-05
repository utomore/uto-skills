from dataclasses import dataclass

from shop.domains._shared import DomainError


@dataclass
class EmptyOrder(DomainError):
    """送出的訂單沒有任何品項。"""
