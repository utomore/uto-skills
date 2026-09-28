# orders：訂單

## 邊界

- 涵蓋：顧客送出品項成為一張訂單，總額由品項算出。
- 不涵蓋：付款、出貨。

## 入口

一列一個 use case。函數名稱是 `application` 匯出的名字（ADR-002）；沒有該入口填 `-`。

| use case | api | cli |
|---|---|---|
| place_order | POST /orders | order place |
