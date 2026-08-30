# 模板:feature spec(`features/F00x-<slug>.md`)

`/spec-design` **feature 模式**步驟 5 打開這一份逐欄填。enhance 模式不讀本檔。
檔名英文 kebab-case、內文繁體中文,結構固定。

```markdown
---
id: F00x
type: feature
title: <slug>
description: <一句話,40 字內:這個功能做什麼>
status: open
created: <today>
updated: <today>
depends-on: []          # 依賴的文檔 id(引用格式見 conventions);空陣列 = 可平行開發(最後填,由介面表反推)
related-adr: []
related-feature: []
---

# F00x: <功能名稱>

## 目的
(這個 feature 為什麼存在,2-3 句;要解決的問題)

## 對應的 Level 2 契約
(本功能實作 design.md 哪些模組介面 / 對外契約;逐條列出並確認未超出範圍)

## 數據
(新增 / 修改 / 刪除的型別定義,每個型別附「它擁有哪些知識」= 它是哪些事實的唯一真相來源)
| 型別 | 動作 | 定義 | 擁有的知識 |
|---|---|---|---|
| `TokenPair` | 新增 | `{ access: Token, refresh: Token, expiresAt: UTCTime }` | 一組憑證的有效期限 |
| `TokenStatus` | 新增 | `Valid` / `Invalid` 二選一 | 一個 TokenId 當下可不可用 |
| `TokenError` | 新增 | `Expired` / `Revoked` / `NotFound` 三選一 | 換發失敗的原因分類 |

## 介面
(每個函數的完整型別簽名 + 語意描述。語意只寫「做什麼」,**禁止出現實作細節**:
 不寫演算法、不寫資料結構選擇、不寫呼叫順序。「骨架位置」填該簽名在原始碼的 檔案:行號)
| 簽名 | 語意(做什麼) | 骨架位置 |
|---|---|---|
| `rotate :: TokenId -> IO (Either TokenError TokenPair)` | 換發一組新憑證並使舊的失效 | `src/Auth/Token.hs:42` |
| `verify :: TokenId -> IO TokenStatus` | 回報一個 TokenId 當下可不可用 | `src/Auth/Token.hs:58` |

## Laws(行為性質)
(可被 property-based 測試驗證的代數性質,一律寫成「對所有 x,P(x) 成立」的形式。
 **這是 spec 的一部分,不是 QA 的發明**;每個核心函數至少一條。
 編號用 `LAW-` 詞首碼,不寫 `L1`——`L1` 會跟 Level / 專案的 Layer 撞號,見 doc-lifecycle.md 註冊表)
- LAW-1: 對所有 `t`,`rotate t >> rotate t` 與 `rotate t` 造成失效的 TokenId 集合相同(冪等)
- LAW-2: 對所有 `t`,若 `rotate t` 回傳 `Right _`,則之後 `verify t` 必為 `Invalid`
- LAW-3: 對所有 `t`,若 `rotate t` 回傳 `Left _`,則 `verify t` 與呼叫前相同(失敗不改變狀態)
(某個介面確實沒有可陳述的性質時,寫 `無law <介面名>:<具體理由>`——不准留空)

## Examples
(3-5 個具體輸入輸出,覆蓋邊界情況:空值、單一元素、極值、例外路徑。
 編號用 `EX-` 詞首碼,不寫 `E1`——那是 `E001` 的違規簡寫,也常是專案的階段名)
| # | 輸入 | 預期輸出 | 覆蓋的邊界 |
|---|---|---|---|
| EX-1 | `rotate validId` | `Right TokenPair{...}` | 正常路徑(LAW-1、LAW-2) |
| EX-2 | `rotate expiredId` | `Left Expired` | 過期(LAW-3) |

## 依賴
(frontmatter depends-on 的文字說明。介面表每一列的簽名必須是從來源檔案讀出的原文;
 「來源文檔」填定義該介面的文檔 id,無則填 `-`)

### 使用到的既有介面
| 介面(含完整簽名) | 來源檔案 | 來源文檔 | 用途 |
|---|---|---|---|
| <函式/API/模組與簽名> | <路徑> | <文檔 id 或 -> | <為什麼呼叫它> |

### 依賴方向
- 依賴誰:<...>
- 誰會依賴它:<...>
- **新增的依賴邊**:<本次新增的 import 方向,一條都不能漏;無則寫「無」>
- 可否與其他進行中任務平行開發:<結論與依據>

## 不可逆決定
(存檔格式 / 對外 API / FFI 邊界 / 資料 schema 的變更,每條附至少一個**被否決的替代方案與否決理由**;
 重大者升級為 ADR。無則寫「無」——**不准留空**,空著會被編排者當成漏寫退回)

## 骨架
(本次寫進原始碼樹的檔案清單與各自內容範圍;impl 只准替換未實作標記,不得改動這些簽名與型別)
| 檔案 | 內容 |
|---|---|
| `src/Auth/Token.hs` | `TokenPair` / `TokenStatus` / `TokenError` 型別、`rotate` / `verify` 簽名 |

## 待確認假設
(只在委派模式下、且有**契約層級**的不確定判斷時才放這一段;互動模式下不確定就直接問開發者,不留假設。
 實作層級的自裁不進本檔,走回報的「自裁記錄」。完整格式與義務見 delegation-design.md)
- ASM-1: <不確定的點,與契約卡為什麼沒答案>
  - 契約錨點:<要動到的契約條目:design.md 的哪一章 / 哪條介面、DTO、型別名。編排者用它做
              「同一波合併」與「沿用前幾波裁決」兩道對帳,寫泛稱等於沒寫>
  - 層級自答:出現在邊界上?<會/不會>;改錯驚動其他模組?<要/不要>
  - 選項:a) <方案>——當下成本 <...>,三個月後代價 <...> b) <方案>——當下成本 <...>,三個月後代價 <...>
  - 傾向:<a 或 b、為什麼>;可逆性:<可逆 / 有條件可逆 / 難逆>
  - 暫採:<裁決前 spec 與骨架先照哪個寫> → 影響:<若裁決不同,要改哪些地方>

## 實作備註
(開發過程中與設計的偏差記錄於此,撰寫時留空)
```
