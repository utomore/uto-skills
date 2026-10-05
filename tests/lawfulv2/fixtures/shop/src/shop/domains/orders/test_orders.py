from datetime import datetime

import pytest

from shop.domains._shared import Actor, Context
from shop.domains.orders import place_order
from shop.domains.orders.errors import EmptyOrder
from shop.domains.orders.ports import PlaceOrderDeps
from shop.domains.orders.types import Order


class FakeOrders:
    def __init__(self) -> None:
        self.saved: list[Order] = []

    def save(self, order: Order) -> None:
        self.saved.append(order)


class FakeLogger:
    def info(self, event: str, **fields: object) -> None: ...

    def warning(self, event: str, **fields: object) -> None: ...

    def error(self, event: str, **fields: object) -> None: ...


class FakeClock:
    def now(self) -> datetime:
        return datetime(2026, 9, 28)


def ctx() -> Context:
    return Context(actor=Actor("u1", "u1@example.com"), logger=FakeLogger(), clock=FakeClock())


@pytest.mark.law("LAW-1")
def test_total_is_the_sum_of_items() -> None:
    orders = FakeOrders()
    order = place_order(ctx(), PlaceOrderDeps(orders=orders), [3, 4, 5])
    assert order.total == 12
    assert orders.saved == [order]


@pytest.mark.law("LAW-2")
def test_an_empty_order_is_rejected_and_nothing_is_saved() -> None:
    orders = FakeOrders()
    with pytest.raises(EmptyOrder):
        place_order(ctx(), PlaceOrderDeps(orders=orders), [])
    assert orders.saved == []
