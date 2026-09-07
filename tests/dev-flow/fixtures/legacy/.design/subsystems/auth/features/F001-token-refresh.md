---
id: F001
type: feature
title: token-refresh
description: 換發一組新憑證並使舊的失效
status: done
rev: 1
stage: S1
modules: [Token]
created: 2026-08-01
updated: 2026-08-20
depends-on: []
code-paths: [src/auth/token.ts]
---
# F001: 憑證換發

## 契約
- **核心判準**:少了它,auth 就無法「讓使用者以憑證換取工作階段」
- **驗收標準**:舊憑證換發後立刻不可用

## 介面
| 簽名 | 語意 | 骨架位置 |
|---|---|---|
| `rotate(id: TokenId): TokenPair` | 換發一組新憑證 | `src/auth/token.ts#rotate` |
| `verify(id: TokenId): boolean` | 回報可不可用 | `src/auth/token.ts#verify` |

## Laws
- LAW-1: rotate 成功後,舊 TokenId 立刻失效
  - 量詞:對所有 t
  - 定義域:t ∈ TokenId 全域
  - 前提:rotate(t) 回傳成功
  - 觀察點:verify(t) == false
- LAW-2: rotate 不改變別的 token 的可用性
  - 量詞:對所有 u
  - 定義域:u ∈ 呼叫前已存在的 TokenId
  - 前提:無
  - 觀察點:呼叫前後 verify(u) 相同

## Examples
| # | 輸入 | 預期輸出 | 覆蓋的邊界 |
|---|---|---|---|
| EX-1 | `rotate("a")` | `TokenPair` | LAW-1 |

## 修訂記錄
- REV-1(2026-08-20,依 qa 提問):改用伺服器時鐘
