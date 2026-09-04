---
id: F001
type: feature
status: done
description: 登入
code-paths: [src/Auth/Login.hs]
---

# F001 登入

## Laws(行為性質)

- **LAW-1**(冪等):對所有 `t`,`verify(verify(t)) == verify(t)`
- **LAW-2**(定義域):對所有空字串,`verify` 拋 `EmptyToken`

## Examples

| id | 輸入 | 期望 |
|---|---|---|
| **EX-1** | `"abc"` | `Ok` |
