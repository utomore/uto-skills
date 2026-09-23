# 模組表

## 邊界
- types:`Game.World`（遊戲世界的不可變值，含渲染快取）、`Game.Save.State`（可存檔的投影）
- effect：無
- core:`Game.Save.Core.*`（投影與編解碼）
- shell:`Game.Save.Host`（存檔進入點）、`Game.FS`（檔案系統）

## 模組單元
| 模組 | 層 | 職責 |
|---|---|---|
| `Game.World` | types | 遊戲世界的不可變值與它的實體 |
| `Game.Save` | types、core、shell | 可存檔的投影、編解碼與存檔的進入點 |
| `Game.FS` | shell | 檔案系統：原子寫檔 |

## 對外 I/O
| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline |
|---|---|---|---|---|
| 存檔檔案 | out | `ByteString` | `Game.FS` | P-001-save-write |
