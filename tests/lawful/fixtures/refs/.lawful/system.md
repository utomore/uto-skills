---
updated: 2026-09-06
---
# refs:引用方向的夾具,沒有 language,只看 .lawful

## 願景
輸入檔解析、正規化後跑完整條。

## 目的
三條 pipeline:里程碑 P-001 引用 P-002 的 = 列(有註明見);P-002 與 P-003 都把 shared 列成步驟而沒註明見。

## 語言與工具
- 建置:無
- 測試(整套):無
- 測試(子集):無
- IO 模組追加:無
- 效果型別追加:無
- 忽略目錄:無

## 邊界
- types:`Types`
- effects:無
- pure:`Core.*`
- shell:`Host.*`

## 對外 I/O
| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline |
|---|---|---|---|---|
| 輸入檔 | in | `Text` | `Host.Main` | P-001-run |

## Pipelines
| 全名 | 類別 |
|---|---|
| P-001-run | IO 介面 |
| P-002-parse | 子流 |
| P-003-normalize | 子流 |
