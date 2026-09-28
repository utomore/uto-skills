# M1 下單

- 階段：P1
- 目標：顧客送得出第一張訂單。
- 出口條件：顧客從網頁與 cli 都送得出訂單並看到總額。

| id | 單元 | domains | 依賴 |
|---|---|---|---|
| REQ-001 | 顧客送出訂單，看到總額 | orders | - |

## REQ-001

領域怎麼用：入口把品項的金額清單交給 `application.place_order`，它接上 platform 的 `Orders` 實作，呼叫領域的 `place_order`。

- 顧客送出至少一個品項，拿到訂單與總額，總額等於品項金額的和。（證據：law:orders/LAW-1、test:src/shop/domains/orders/test_orders.py::test_total_is_the_sum_of_items）
- 沒有品項的訂單被拒，網頁與 cli 都說出原因。（證據：law:orders/LAW-2、check:check_errors、展示:dev下單）
- 從 cli 也能下單，數字和網頁一樣。（證據：ci:unit）
- 下單之後顧客收到一封信。

## 展示紀錄

| 日期 | 展示 | 依據 |
|---|---|---|
| 2026-09-28 | REQ-001/dev下單 | build 12，https://dev.example/orders |
