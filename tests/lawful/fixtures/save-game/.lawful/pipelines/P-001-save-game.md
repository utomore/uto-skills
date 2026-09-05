---
id: P-001
description: 把當前 World 投影成可存檔的狀態,編碼後寫到磁碟
status: ready
updated: 2026-09-05
---
# P-001-save-game:把當前 World 投影成可存檔的狀態,編碼後寫到磁碟

## Brief
玩家按存檔時,把當前不可變的 World 寫成一個檔案;讀檔把檔案還原成同一個可存檔狀態。World 含渲染快取,不直接存;先投影成 SaveState,只留遊戲邏輯需要的欄位。
流向:World → 投影 → SaveState → 編碼 → ByteString → 寫檔。它是里程碑,兩端碰到 shell。

## Stages
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `toSave :: World -> SaveState` | 去掉快取,留可存欄位 | `Save.Project` | pure |
| 2 | `encode :: SaveState -> ByteString` | 編成 CBOR | `Save.Codec` | pure |
| 3 | `decode :: ByteString -> Either DecodeError SaveState` | 解回狀態,壞檔回錯誤 | `Save.Codec` | pure |
| 4 | `writeSave :: FilePath -> ByteString -> IO ()` | 原子寫檔 | `Host.FS` | shell |
| = | `saveGame :: FilePath -> World -> IO ()` | 整條 | `Host.Save` | shell |

## Laws
- LAW-1 [roundtrip] 存了再讀回到同一個狀態
  - forall s in SaveState
  - |- decode (encode s) == Right s
- LAW-2 [invariant] 投影不丟實體
  - forall w in World
  - |- length (savedEntities (toSave w)) == entityCount w
- LAW-3 [bound] 檔案大小跟實體數線性
  - forall s in SaveState
  - |- length (encode s) <= 64 + 128 * length (savedEntities s)

## Examples
| # | 輸入 | 輸出 | 覆蓋 |
|---|---|---|---|
| EX-1 | `decode ""` | `Left EmptyInput` | LAW-1 |
| EX-2 | `toSave emptyWorld` | `emptySave` | LAW-2 |

## 決定
- **存 SaveState 不存 World。** 否決:直接編碼 World。渲染快取是衍生資料,存進去會讓 roundtrip 對不上。
- **格式用 CBOR。** 否決:JSON。證據:ADR-001-save-format

## 修訂記錄
無
