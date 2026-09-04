# 模板:跨子系統功能 spec(`.design/features/G-F00x-<slug>.md` / `.design/enhancements/G-E00x-<slug>.md`)

`/spec-design` **global 模式**步驟 5 打開這一份逐欄填。feature 模式不讀本檔。

**這份檔已經存在**:`/subsys-design` 在規劃當下就鑄號建好了,frontmatter 齊、`## 契約`(含**分工表**)也寫好了。
你要做的是**往下加節**並把 `status` 從 `planned` 改成 `specced`。標 ⬛ 的是既有的、你**不准改**的部分。
和 `feature-spec.md` 相同的節(Laws 四格怎麼填、Examples、不可逆決定、待確認假設、修訂記錄)規則完全一樣,本檔只寫**不同**的地方。

```markdown
---
id: G-F00x              # G-E 時為 G-E00x
type: feature           # G-E 時為 enhance
title: <slug>
description: <一句話,40 字內:這個跨子系統功能做什麼>
status: specced         # ⬛ 建檔時是 planned,本步驟改成 specced
rev: 0                  # ⬛ 初版 0
stage: S2               # ⬛ G-F 必填:它是這個階段的達成條件;G-E 沒有這一欄
subsystems: [cart, billing, notify]   # ⬛ 參與的子系統 = 分工表的每一列
created: <today>
updated: <today>
depends-on: []          # 依賴的文檔(帶前綴);**不要把分工 F 填進來**——它們由分工表管,方向相反
related-adr: []
code-paths: []          # 端到端組裝層的路徑;impl 收尾回寫。分工 F 各自的路徑在各自檔上
---

# G-F00x: <功能名稱>

## 目的
(這個跨子系統功能為什麼存在;為什麼它不能被拆成幾份互不相干的子系統 F)

## 契約
⬛ **`/subsys-design` 的產出,一個字都不准改。** 內容:
- **核心判準**:少了它,S2(<階段名稱>)無法達成——<一句話為什麼>      (G-E 寫**非核心判準**:少了它,階段照樣達成;它加的是 <什麼>)
- **分工**:
  | 子系統 | 負責的段 | 承接的 feature |
  |---|---|---|
  | cart | 鎖定購物車、產生訂單草稿 | cart/F004-order-draft |
  | billing | 收款、開立發票 | billing/F002-charge |
  | notify | 付款結果通知 | notify/F001-payment-mail |
  (每一列指到的 F 要用 `part-of: [G-F00x]` 回鏈;**分工表是權威,`part-of` 是索引**,腳本雙向對帳)
- **端到端介面**:引用各子系統對外契約的條目、與共用契約 `G-C00x-<slug>#<條目>`
- **驗收標準**:端到端(從入口子系統的介面到出口子系統的介面)可觀察的行為
- **明確不做**:端到端最容易蔓延的是「順便管某個子系統內部的事」——那是分工 F 的事

## 分工對帳
(步驟 1 的結論:每一段的輸出型別接得上下一段的輸入型別嗎?接不起來的縫是誰補的——
 本檔的端到端介面,或某份分工 F 回 `/spec-redesign` 補契約。逐列寫)
| 段 | 輸出 → 下一段輸入 | 接得上? | 縫由誰補 |
|---|---|---|---|

## 數據
(**只寫跨界傳遞的型別**。只被本檔(含分工 F)用的住這裡;已有第二份 G-F / G-E 要用的,升格 `G-C00x`,
 這裡改為引用。每個型別附「它擁有哪些知識」)
| 型別 | 動作 | 定義 | 擁有的知識 |
|---|---|---|---|

## 介面
(**端到端那一層的介面**:組裝 / 編排的入口、各段的抽象介面。「骨架位置」填 `檔案#符號`,不寫行號。
 分工 F 自己的介面不列這裡)
| 簽名 | 語意(做什麼) | 骨架位置 |
|---|---|---|
| `checkout :: Cart -> IO (Either CheckoutError OrderId)` | 端到端:鎖車 → 收款 → 通知 | `src/Checkout/Flow.hs#checkout` |
| `notify.pending :: OrderId -> IO Bool` | 通知端看不看得到這張訂單 | `src/Notify/Api.hs#pending` |

## Laws(行為性質)
(四格照 `feature-spec.md`。**追加一條硬規則:每條 law 的觀察點必須跨過至少一條子系統邊界**——
 寫成「在子系統 A 的介面 X 做了什麼之後,子系統 B 的介面 Y 看到什麼」。只在單一子系統內就觀察得到的
 law 不屬於本檔,搬去那個子系統的分工 F。**部分失敗**那一條不准漏:某一段失敗時,已完成的段怎麼收)
- LAW-1: 付款成功的訂單,通知端一定看得到同一個 OrderId
  - 量詞:對所有 c
  - 定義域:c ∈ 已鎖定的購物車(含空車、單品、多品)
  - 前提:`checkout c` 回傳 `Right orderId`
  - 觀察點:`checkout c` 回傳後,`notify.pending orderId` 回傳 True(跨 cart → billing → notify 三條邊界)

## Examples
| # | 輸入 | 預期輸出 | 覆蓋的邊界 |
|---|---|---|---|

## 依賴
### 使用到的既有介面
| 介面(含完整簽名) | 來源檔案 | 來源文檔 | 用途 |
|---|---|---|---|

### 依賴方向
- 跨過的子系統邊界:<A → B、B → C;每一條都要對得到 system.md「通訊拓撲」的一條邊>
- **新增的依賴邊**:<無則寫「無」>

## 不可逆決定
(同 `feature-spec.md`;跨界的型別與事件 schema 幾乎都是不可逆的,每條附被否決的替代方案)

## 骨架
(只有端到端組裝層;不碰分工 F 的骨架)
| 檔案 | 內容 |
|---|---|

## 待確認假設
(同 `feature-spec.md`;互動模式下不留假設)

## 實作備註

## 修訂記錄
(撰寫時不建;第一次 `/spec-redesign` 時由它建,之後常駐)
```

**`done` 的判準比 F 多一條**:分工表列的每一份 F 都 `done`,**且**端到端測試綠。分工 F 有未 done 而本檔標 done,`scan-status.mjs` 列為不一致;派工報告會把未 done 的分工 F 列成本檔「卡它的」。
