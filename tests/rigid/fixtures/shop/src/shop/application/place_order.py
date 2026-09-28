from shop.domains import orders
from shop.domains._shared import Context
from shop.domains.orders.ports import Orders, PlaceOrderDeps
from shop.domains.orders.types import Order


def place_order(ctx: Context, store: Orders, items: list[int]) -> Order:
    return orders.place_order(ctx, PlaceOrderDeps(orders=store), items)
