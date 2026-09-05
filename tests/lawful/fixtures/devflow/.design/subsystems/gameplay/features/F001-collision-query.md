---
id: F001
type: feature
title: collision-query
status: done
rev: 0
stage: S0
group: WorldSim
---

# F001: collision-query

## 功能概述
AABB 分軸滑壁。

## 新增的介面

模組 `Demo.Gameplay.Collision`:

| 介面 | 說明 |
|---|---|
| `data Collider = Collider { colBox :: Rect, colSolid :: Bool }` | component |
| `newtype SolidLayer = SolidLayer Text` | 哪個圖層算實心 |
| `resolveMove :: MapStatic -> SolidLayer -> [(EntityId, Rect)] -> EntityId -> Rect -> Vec2 -> Vec2` | 純查詢 |

### 模組 `Demo.Gameplay.Collision`(子節寫法)

```haskell
-- Demo.Gameplay.Collision
scanFast :: MapStatic -> [Coord]
```

## Laws(行為性質)

- LAW-1: 不穿牆
  - 量詞:對所有起點 `p`、對所有位移 `d`
  - 定義域:`p :: Rect` 非實心格內;`d :: Vec2` 含大位移
  - 前提:起點本身不與任何實心 tile 重疊
  - 觀察點:`resolveMove` 回傳位移後的 AABB,不與任何實心 tile 重疊
- LAW-2: 零位移回零
  - 量詞:對所有 `p`
  - 定義域:`p :: Rect` 全域
  - 前提:無
  - 觀察點:`resolveMove ms layer [] me p (Vec2 0 0)` 等於 `Vec2 0 0`

## Examples

| # | 輸入 | 預期輸出 | 覆蓋的邊界 |
|---|---|---|---|
| EX-1 | 貼牆斜走 | 沿牆滑 | LAW-1 |
| EX-2 | 零位移 | `Vec2 0 0` | LAW-2 |

## 待確認假設

- ASM-1:`SolidLayer` 建構子要不要外露
