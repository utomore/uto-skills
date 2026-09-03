---
name: spec-redesign
description: 契約與 spec 的修改(redesign 角色)— 由 spec-gaps 或開發者觸發,先用機械判準定層級:改動只落在這一份 feature 檔裡就在 Level 3 就地改;有第二份文檔要跟著改就回 Level 2 改 design.md。改完一律留下可查證的修訂痕跡,並講明哪幾條介面要重新委派 qa / impl。觸發詞:改契約、修 spec、spec 修訂、redesign、改設計、契約錯了、回答 gap、結 gap、改介面、改驗收標準、範圍變了。Use when an existing feature contract or spec must change, deciding whether it is a Level 3 in-place edit or a Level 2 architecture change.
user-invocable: true
---

# /spec-redesign — 契約與 spec 的修改

## 這個 skill 存在的理由

`/subsys-design` 建立契約、`/spec-design` 把它變成規格,兩支都只往前寫。**契約寫錯了、或做到一半發現邊界不對**時,沒有人負責——`spec-gaps.md` 只說「去修 spec」,不說修哪一層、誰修。本 skill 就是那個負責的人。

它是**唯一**可以改既有 `## 契約` 的入口。`/spec-design` 只准往下加節(`doc-lifecycle.md`「狀態與生命週期」)。

## 先讀什麼(**一批送出,不要一個一個開**)

先解析 `<S>`(本 plugin 的 `skills/` 目錄;**整場對話只解析一次**,規則見 `../_shared/conventions.md`「腳本目錄」):

```bash
dirname "$(dirname "$(find ~/.claude/plugins . -maxdepth 9 -type d -path '*dev-flow*/skills/arch-audit/scripts' 2>/dev/null | head -1)")"
```

拿到 `<S>` 後,把下面**必讀**與成立的**條件式**項目放進**同一則訊息**一次讀完。

**必讀**

| 讀什麼 | 為什麼 |
|---|---|
| `../_shared/conventions.md` | 核心慣例:資訊抽象邊界規範、腳本目錄、**跑東西的紀律** |
| `../_shared/spec-roles.md` | 三角色契約與 **spec-gaps 協議**(回填格式) |
| `../_shared/boundary-rules.md` | **層級判斷**——本 skill 的第一個動作就靠它 |
| 目標 feature / enhance 檔全文 + 它的骨架 | 你要改的東西 |
| `.design/subsystems/<slug>/spec-gaps.md` 的 `open` 條目 | 觸發本次修改的問題 |

**條件式**

- 判定是 **Level 2** → 該子系統 `design.md` 全文(含分冊)+ `../_shared/contract-readiness.md`
- 改動涉及既有符號(要改簽名、要查誰在用)→ `../_shared/codegraph.md` + `../_shared/codegraph-tools.md`
- 要查反向依賴、誰引用了這條契約 → `../_shared/design-query.md`
- **收尾時** → `../_shared/anchor.md`

不讀 `doc-lifecycle.md`:本 skill **不配號、不建檔**。

## 1. 定層級(不可跳過,先於一切)

判準只有一條,**不靠判斷力**:

> **這次改動會不會落到第二份文檔上?**
> 只落在這一份 feature 檔裡 → **Level 3 就地改**。
> 有任何第二份文檔要跟著改 → **回 Level 2**。

展開成可查的清單:

| 動到什麼 | 層級 |
|---|---|
| 這份 feature 自己的 Laws / Examples / 內部型別 / 私有簽名 / 驗收措辭精確化 | **Level 3** |
| `design.md` 的對外契約或 DTO 形狀 | Level 2 |
| `design.md` 的模組間公開介面簽名 | Level 2 |
| 資料流管線的段落歸屬(哪個模組負責哪一段) | Level 2 |
| 新增或反轉一條依賴邊(尤其跨子系統) | Level 2 |
| **收回「明確不做」**(把原本排除的東西收進來) | Level 2 |
| 別份 feature 的 `## 契約` | Level 2 |
| 共用契約 `G-C00x` 的任何條目 | Level 2 |

**「收回明確不做」必須單獨列**:它看起來最像「只是多做一點」,實際上是負向邊界被改掉——而那是當初唯一寫下來的排除理由,改掉之後「為什麼原本沒收 X」就永久失傳。

判不出來時用 AskUserQuestion 讓開發者拍板,選項寫成「就地改 vs 回 Level 2」,並各附一句代價。**不准因為就地改比較快而選它**——兩條路的成本差是這個判準存在的原因,不是選擇它的理由。

## 2A. Level 3:就地改

1. **只改被 gap 指到的段落**與骨架對應處。不順手擴張 scope——真要擴張就另開 `E00x` 走 `/spec-design` 的 enhance 模式
2. 改 `## Laws` / `## Examples` / `## 數據` / `## 介面`,**`## 契約` 只准追加修訂行,不准改寫既有欄位**——那一節是 Level 2 的產出
3. 同步骨架:簽名動過的,型別與未實作標記一起改
4. 一致性檢查**只重跑被動到的那幾條**

## 2B. Level 2:回架構層

1. 改 `design.md` 的對應章節(對外契約 / 模組間公開介面 / 資料流管線 / 模組群),**先改架構、再改 feature 檔**——反過來會讓 feature 檔短暫超出契約
2. 逐條跑 `contract-readiness.md` A 段;動到跨子系統的東西再跑 B 段
3. 受影響的**每一份** feature 檔都要同步 `## 契約`,不是只有觸發這次修改的那一份。用這道指令找出來:

   ```
   node "<S>/arch-audit/scripts/scan-status.mjs" .design --doc <文檔全名>
   ```

   它會印反向依賴——那些就是要一起看的文檔
4. 已經 `done` 的 feature 檔契約改了時,**在回報裡點名**:它們的測試可能不再對應現況,是否要開 `E00x` 補做由開發者決定,不要自己動手

## 3. 留痕(不可跳過)

改完的 `## 契約` 底下追加一行:

```markdown
- 修訂 2026-09-03 依 auth/GAP-3:<改了什麼,一句話>(層級:Level 3 就地 / Level 2 連動 design.md「模組間公開介面」)
```

回填 gap 條目的 `狀態:resolved` 與 `修訂` 行(格式見 `../_shared/spec-roles.md`「spec-gaps 協議」)。**`修訂` 行必須指出是哪一份文檔的全名**——`/arch-audit status` 會查「gap 標了 resolved,但修訂行指到的文檔 `updated` 比結案日期早」,指不出來的結案會被列為不一致。

同步該檔的 `updated`;Level 2 的話 `design.md` 也要同步。

## 4. 收尾

**改完的東西 qa 與 impl 都要重跑**。收尾必須講明:

- 哪幾條介面的簽名動過 → 骨架與既有測試一起失效,要重新委派
- 哪幾份文檔的 `status` 該退回 `specced`(實作已經不符現況時)
- Level 2 的話:哪幾份 `done` 的 feature 現在與契約對不上

只說「文檔改好了」是不夠的——那會讓人以為程式碼還是對的。

跑一次驗收並貼結果:

```
node "<S>/arch-audit/scripts/scan-status.mjs" .design --subsys <slug>
```

最後輸出定錨區塊(格式見 `../_shared/anchor.md`)。

## 邊界

- **不配號、不建檔**:本 skill 只改既有文檔。要新的 feature 走 `/subsys-design`,要新的優化走 `/spec-design` enhance 模式
- **不寫測試、不寫實作**:改完交回 `/spec-qa` 與 `/spec-impl`
- **委派模式下不啟動**:契約改動一定要人拍板,`/subsys-build` 遇到需要改契約的 gap 會停下來(見該 skill「閘門」)
