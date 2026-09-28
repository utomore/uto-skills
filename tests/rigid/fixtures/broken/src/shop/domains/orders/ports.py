from dataclasses import dataclass
from typing import Protocol

from shop.domains.orders.types import Order


class Orders(Protocol):
    def save(self, order: Order) -> None: ...


@dataclass(frozen=True)
class PlaceOrderDeps:
    orders: Orders
