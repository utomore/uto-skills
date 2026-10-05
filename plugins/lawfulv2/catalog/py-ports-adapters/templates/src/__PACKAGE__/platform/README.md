# platform

領域宣告的 Protocol 的實作、`Context` 的建立、logger、設定。只提供工具，沒有入口、不放業務規則、不做領域之間的接線（ADR-003）。

## 領域怎麼用

1. 領域在自己的 `ports.py` 宣告需要什麼（Protocol），把它們收成一個 `<UseCase>Deps` 的 frozen dataclass。
2. platform 寫實作：一個類別滿足一個 Protocol，建構子拿連線或 client。pyright 在檢測階段比對實作與 Protocol 對不對得上。
3. application 的 use case 拿 platform 的物件組出 deps，呼叫領域函數。

```python
# domains/orders/ports.py
class Orders(Protocol):
    def save(self, order: Order) -> None: ...


@dataclass(frozen=True)
class PlaceOrderDeps:
    orders: Orders


# platform/repositories/orders.py
class OrdersTable:
    def __init__(self, tx: Connection) -> None: ...
    def save(self, order: Order) -> None: ...


# application/place_order.py
def place_order(ctx: Context, platform: Platform, items: list[Item]) -> Order:
    with platform.transaction() as tx:
        return orders.place_order(ctx, PlaceOrderDeps(orders=OrdersTable(tx)), items)
```

## 物件的生命週期

platform 的物件由程序進入點建一次，活到程序結束；建立時只建連線池不連線。api 放進 `app.state`，cli 放進 `ctx.obj`。`create_app()` 與 cli 的 app 建立時不做任何 I/O。
