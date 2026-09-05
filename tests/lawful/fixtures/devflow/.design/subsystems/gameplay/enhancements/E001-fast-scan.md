---
id: E001
type: enhancement
title: fast-scan
status: done
---

# E001: fast-scan

## 介面

| 簽名 | 語意 |
|---|---|
| `scanFast :: MapStatic -> [Coord]` | 快掃 |

## Laws(行為性質)

- LAW-1: 與慢掃一致
  - 量詞:對所有 `ms`
  - 定義域:`ms :: MapStatic`
  - 前提:無
  - 觀察點:`scanFast ms == scanSlow ms`
