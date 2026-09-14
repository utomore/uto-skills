# 模組表

## 邊界
- types:`App.Doc`
- effect:無
- core:`App.Syntax`、`App.Canon`、`App.Cli`
- shell:`App.Cli.Main`

## 模組單元
| 模組 | 層 | 職責 |
|---|---|---|
| `App.Doc` | types | 文件與解析錯誤的型別 |
| `App.Syntax` | core | 把文字解析成文件 |
| `App.Canon` | core | 文件的正規化 |
| `App.Cli` | core、shell | 整條與命令列進入點 |

## 對外 I/O
| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline |
|---|---|---|---|---|
| 輸入檔 | in | `Text` | `App.Cli.Main` | P-001-cli-run |
