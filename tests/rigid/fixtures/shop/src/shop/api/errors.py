"""領域的錯誤型別翻成 HTTP 狀態與畫面上的話。每個 DomainError 子類別都要有一列（check_errors）。"""

from shop.domains.orders.errors import EmptyOrder

TRANSLATIONS: dict[type, tuple[int, str]] = {
    EmptyOrder: (400, "訂單裡沒有任何品項"),
}
