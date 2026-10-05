# orders 的 Laws

寫法見 docs/adr/ADR-003-software-architecture.md 的「law 與測試」。

## Laws

- LAW-1 訂單的總額等於每個品項金額的總和
- LAW-2 沒有品項的訂單被拒，什麼都不存

## 候選

還沒實作的性質。實作時補上測試，再搬進 `## Laws` 編號；用不上的直接刪掉。

- 同一張訂單送兩次只存一張
