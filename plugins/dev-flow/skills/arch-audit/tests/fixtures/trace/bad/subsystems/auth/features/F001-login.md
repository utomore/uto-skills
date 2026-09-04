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
- **LAW-3**(純函式):對所有 `t`,兩次呼叫結果相等
- **LAW-4**(有界):對所有 `t`,`len(verify(t)) <= 64`

## Examples

| id | 輸入 | 期望 |
|---|---|---|
| **EX-1** | `"abc"` | `Ok` |
