---
id: F001
type: feature
title: login
description: 登入
status: done
rev: 1
created: 2026-08-10
updated: 2026-08-20
stage: 
modules: []
group: Session
part-of: [G-F001]
depends-on: []
related-adr: [ADR-001]
related-feature: []
code-paths: [src/Auth/Login.hs]
---
## 契約

- **核心判準**:少了它,auth 就無法「認證」(system.md 子系統劃分 §auth 職責)
- **階段**:
- **負責模組**:
- **實作的 Level 2 介面**:TODO(v1 沒有契約卡,遷移補不出來)
- **資料流管線段落**:TODO
- **驗收標準**:TODO
- **明確不做**:TODO
- 修訂 2026-08-20 依 auth/GAP-2:密碼雜湊參數寫進介面(層級:Level 3 就地)

## 介面
| 簽名 | 語意 | 骨架位置 |
|---|---|---|
| `login :: A -> B` | 登入 | `src/Auth/Login.hs#login` |
## Laws(行為性質)
- LAW-1: 登入成功後 session 存在
  - 量詞:對所有 u
  - 定義域:u ∈ User
  - 前提:`login u` 成功
  - 觀察點:`login u` 回傳 Right
- LAW-2: 失敗不建 session
  - 量詞:對所有 u
  - 定義域:u ∈ User
  - 前提:`login u` 失敗
  - 觀察點:`login u` 回傳 Left
## Examples
| # | 輸入 | 預期輸出 | 覆蓋的邊界 |
|---|---|---|---|
| EX-1 | a | b | 正常 |
| EX-2 | c | d | 例外 |
## 修訂記錄
- REV-1(2026-08-20,依 auth/GAP-2):密碼雜湊參數寫進介面
  - 動到:LAW-1 措辭、介面 `login` 語意
  - 保護:無
  - 重委派:qa(LAW-1)
  - 連動:無
