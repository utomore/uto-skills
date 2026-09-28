"""領域的錯誤型別翻成終端機上的話。每個 DomainError 子類別都要有一列（check_errors）。"""

from shop.domains.orders.errors import EmptyOrder

TRANSLATIONS: dict[type, str] = {
    EmptyOrder: "訂單裡沒有任何品項，加了品項再送一次",
}
