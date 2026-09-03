---
id: auth
type: subsystem
title: auth
description: 認證子系統
status: active
created: 2026-08-01
updated: 2026-08-01
parent: system
related-adr: []
code-paths: [src/Auth]
---
# auth
## 模組群(Module Groups)
| 模組群 | 狀態 | 職責 |
|---|---|---|
| Session | active | 工作階段 |
| MFA | planned | 二階段驗證 |
## 功能規劃
| # | feature | 模組群 | 目標 | 依賴 | doc |
|---|---|---|---|---|---|
| 1 | login | Session | 登入 | - | auth/F001-login |
| 2 | token-refresh | Session | 換發 | #1 | auth/F002-token-refresh |
| 3 | logout | Session | 登出 | - | - |
## Feature 契約卡
### login
### token-refresh
### logout
