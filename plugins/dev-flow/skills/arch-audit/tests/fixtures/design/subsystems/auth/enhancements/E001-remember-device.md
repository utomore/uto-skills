---
id: E001
type: enhance
title: remember-device
description: 記住裝置,30 天內免二次驗證
status: planned
rev: 0
modules: []
group: Session
created: 2026-09-01
updated: 2026-09-01
depends-on: [auth/F001]
related-adr: []
related-feature: []
code-paths: []
---

# E001: remember-device

## 契約

- **非核心判準**:少了它,auth 照樣完成登入;它加的是「記住裝置,30 天內免二次驗證」
- **階段**:不掛階段
- **負責模組**:Session
- **實作的 Level 2 介面**:對外契約 §1 login(多一個 remember 旗標)
- **資料流管線段落**:輸入 → 驗證 → 儲存
- **驗收標準**:同一裝置 30 天內第二次登入不觸發二次驗證 — 觀察點:對外契約 §1 login
- **明確不做**:跨裝置同步
