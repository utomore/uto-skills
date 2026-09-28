# 開發計畫

需求依實際的開發順序切成可開發單元。做一個單元：讀這份 README 與那個里程碑的檔案就夠了。

## 完成

一個單元完成，是它的每一條驗收都有證據（ADR-006）。做完一條，就在那一行行尾寫「（證據：a、b）」：

| 證據 | 寫法 |
|---|---|
| law | `law:orders/LAW-1` |
| 測試 | `test:src/shop/domains/orders/test_orders.py::test_total_is_the_sum_of_items` |
| 管線的步驟 | `ci:unit` |
| 檢查腳本 | `check:check_errors` |
| 展示 | `展示:dev下單`；看過之後在里程碑檔最後的「## 展示紀錄」記一列 |

## 里程碑

| 里程碑 | 階段 | 名稱 | 單元數 | 出口條件 |
|---|---|---|---|---|
| [M1](M1-orders.md) | P1 | 下單 | 1 | 顧客從網頁與 cli 都送得出訂單並看到總額 |
