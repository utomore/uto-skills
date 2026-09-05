---
id: G-F001
type: feature
title: ui-loop
status: planned
---

# G-F001: ui-loop

## 介面

| 簽名 | 語意 |
|---|---|
| `routeEvent :: UiEvent -> World -> World` | 把 UI 事件送回世界 |

## Laws(行為性質)

- LAW-1: 未知事件是恆等
  - 量詞:對所有 `w`
  - 定義域:`w :: World`
  - 前提:無
  - 觀察點:`routeEvent Unknown w` 等於 `w`
