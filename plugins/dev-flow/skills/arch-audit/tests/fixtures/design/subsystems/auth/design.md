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
## 功能總覽

<!-- BEGIN FEATURE INDEX:由 scan-status.mjs --write-index 產生,不要手改 -->
| id | feature | 階段 | 模組群 | 模組 | 狀態 |
|---|---|---|---|---|---|
| F001 | login |  | Session |  | done |
| F002 | token-refresh |  | Session |  | specced |
| F003 | logout |  | Session |  | planned |
<!-- END FEATURE INDEX -->
