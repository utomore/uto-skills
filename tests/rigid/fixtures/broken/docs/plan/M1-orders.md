# M1 下單

- 階段：P1
- 目標：顧客送得出第一張訂單。
- 出口條件：顧客從網頁與 cli 都送得出訂單並看到總額。

| id | 單元 | domains | 依賴 |
|---|---|---|---|
| REQ-001 | 顧客送出訂單，看到總額 | orders, payments | - |
| REQ-001 | 同一個號再寫一次 | orders | - |
| REQ-1 | 號的格式不對 | - | - |
| REQ-002 | 連線池建立時不連線 | platform | - |

## REQ-001

- 顧客送出至少一個品項，拿到訂單與總額。（證據：law:orders/LAW-1、test:src/shop/domains/orders/test_orders.py::test_total_is_the_sum_of_items）
- 沒有品項的訂單被拒。（證據：law:orders/LAW-8、law:shipping/LAW-1、展示:dev下單）
- 從 cli 也能下單。（證據：ci:deploy、check:check_nothing、check:report_progress、展示:dev下單）
- 測試指錯。（證據：test:src/shop/domains/orders/test_nothing.py::test_x、test:src/shop/domains/orders/test_orders.py::test_missing、demo:xyz）

## REQ-002

- 連線池建立時不連線。（證據：law:orders/LAW-2）

## 展示紀錄

| 日期 | 展示 | 依據 |
|---|---|---|
| 2026-09-28 | REQ-001/dev下單 | build 12，https://dev.example/orders |
| 2026-09-28 | REQ-001/dev退款 | 對不到任何一條驗收 |
