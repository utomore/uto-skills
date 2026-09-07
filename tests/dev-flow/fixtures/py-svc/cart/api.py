import json
from cart.basket import Item, add_item, total_cents

__all__ = ["handle"]


def handle(body: str) -> str:
    raw = json.loads(body)
    items: list[Item] = []
    for r in raw:
        items = add_item(items, Item(r["name"], int(r["cents"])))
    return str(total_cents(items))
