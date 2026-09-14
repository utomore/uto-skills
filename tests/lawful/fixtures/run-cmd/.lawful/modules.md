# 模組表

## 邊界
- types:`App.Token`
- effect:無
- core:`App.Count`、`App.Report`
- shell:`App.Report.Main`

## 模組單元
| 模組 | 層 | 職責 |
|---|---|---|
| `App.Token` | types | 一個字 |
| `App.Count` | core | 數一段文字裡的字數 |
| `App.Report` | core、shell | 報表與命令列進入點 |

## 對外 I/O
| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline |
|---|---|---|---|---|
| 輸入文字 | in | `Text` | `App.Report.Main` | P-001-report-render |
