# orders：訂單

## 入口

| use case | api | cli | 權限項 |
|---|---|---|---|
| place_order | POST /orders | order place | 登入即可 |
| list_orders | GET /orders | - | orders.view |
| cancel_order | DELETE /orders/{order_id} | order cancel | 登入即可 |
