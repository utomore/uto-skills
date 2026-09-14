# 模組表

## 邊界
- types:<裝什麼,一句>
- effect:<指令 ADT 叫什麼,一句;沒有 effect 層寫「無」>
- core:<純轉換住哪,一句>
- shell:<進入點,一句>

## 模組單元
| 模組 | 層 | 職責 |
|---|---|---|
| `<Prefix.Module>` | types、core | <一句話:這個模組單元負責什麼,範圍到哪> |
| `<Prefix.Module>` | types、effect、core、shell | <一句話> |

## 對外 I/O
| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline |
|---|---|---|---|---|
| <名稱> | in | `<Type>` | `<Module>` | P-00x-<slug> |
