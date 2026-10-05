from shop.domains._shared import Context
from shop.domains.orders.errors import EmptyOrder
from shop.domains.orders.ports import PlaceOrderDeps
from shop.domains.orders.types import Order


def place_order(ctx: Context, deps: PlaceOrderDeps, items: list[int]) -> Order:
    if not items:
        raise EmptyOrder()
    order = Order(order_id=ctx.clock.now().isoformat(), total=sum(items))
    deps.orders.save(order)
    return order
