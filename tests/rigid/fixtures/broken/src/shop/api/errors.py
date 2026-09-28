from shop.domains.orders.errors import EmptyOrder, OutOfStock

TRANSLATIONS: dict[type, tuple[int, str]] = {
    EmptyOrder: (400, "訂單裡沒有任何品項"),
    OutOfStock: (409, "品項沒有庫存"),
}
