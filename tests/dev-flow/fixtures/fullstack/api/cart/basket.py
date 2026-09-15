from typing import Optional

__all__ = ["Item", "add_item", "total_cents", "Basket"]


class Item:
    def __init__(self, name: str, cents: int) -> None:
        self.name = name
        self.cents = cents


class Basket:
    def __init__(self) -> None:
        self._items: list[Item] = []

    def add(self, item: Item) -> int:
        self._items.append(item)
        return len(self._items)

    def size(self) -> int:
        return len(self._items)


def add_item(items: list[Item], item: Item) -> list[Item]:
    return items + [item]


def total_cents(items: list[Item]) -> int:
    return sum(i.cents for i in items)


def _private(x: int) -> int:
    return x
