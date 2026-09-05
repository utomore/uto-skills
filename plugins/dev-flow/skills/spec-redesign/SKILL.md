---
name: spec-redesign
description: 既有功能的修訂(redesign 角色)— 任何對既有 F / E / G-F 的行為、介面、邊界或效能承諾的改動都修訂原檔,不另開檔。由 spec-gaps、spike 結論或開發者觸發,先用機械判準定層級:改動只落在這一份檔裡就在 Level 3 就地改;有第二份文檔要跟著改就回 Level 2 改 design.md。改完留 REV 修訂記錄、rev +1、done 退回 specced,並講明哪幾條 law / 介面要重新委派 qa / impl;效能與重構修訂另有先讀程式碼、回歸 law 與基準線的紀律。觸發詞:改契約、修 spec、spec 修訂、redesign、改設計、契約錯了、回答 gap、結 gap、改介面、改驗收標準、範圍變了、修訂 feature、改既有功能、效能優化、重構規劃、優化設計、enhance design。Use when an existing feature, enhancement, or cross-subsystem feature must change (including performance work and refactors), revising the original document in place.
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
| `node "<S>/arch-audit/scripts/doc-section.mjs" ../_shared/conventions.md 腳本目錄 角色與設計哲學 資訊抽象邊界規範 通用規則` | 核心慣例:腳本目錄、資訊抽象邊界規範、通用規則。**不讀「跑東西的紀律」**——本 skill 只跑盤點腳本,不跑測試 |
| `../_shared/spec-roles.md` | 三角色契約與 **spec-gaps 協議**(結案 = 寫 REV 並刪條目) |
| `../_shared/boundary-rules.md` | **層級判斷**——本 skill 的第一個動作就靠它 |
| 目標 feature / enhance 檔全文 + 它的骨架 | 你要改的東西 |
| `.design/subsystems/<slug>/spec-gaps.md` 的 `open` 條目 | 觸發本次修改的問題 |

**條件式**

- 判定是 **Level 2** → 該子系統 `design.md` 全文(含分冊)+ `../_shared/contract-readiness.md`
- 改動涉及既有符號(要改簽名、要查誰在用)→ `../_shared/codegraph.md` + `../_shared/codegraph-tools.md`
- 要查反向依賴、誰引用了這條契約 → `../_shared/design-query.md`
- 觸發本次修改的是一份 spike 的結論 → 那份 `.design/spikes/SPK-00x-<slug>.md` 全文(結論與「沒驗到的」都要看:後者是這次修訂的邊界)
- **收尾時** → `../_shared/anchor.md`

`doc-lifecycle.md` 只讀兩節(本 skill **不配號、不建檔**,其餘用不到):

```
node "<S>/arch-audit/scripts/doc-section.mjs" ../_shared/doc-lifecycle.md 六種分類與分流判準 "修訂(rev 與 REV)"
```

第一節是**分流判準**(這次要做的事到底是修訂還是新功能),第二節是修訂的留痕與狀態機。

## 0. 先分流:這是修訂,還是新功能?

進來之前先答 `doc-lifecycle.md`「六種分類與分流判準」那一句:**這個改動能不能被描述成「拿掉它,原功能還在、行為不變」?**

- **不能**(改了既有功能的行為、介面、邊界、效能承諾)→ 是修訂,留在本 skill。效能優化、重構、換演算法、改簽名、收回「明確不做」、放寬定義域都是這一種
- **能**(一個新的、可獨立拿掉的能力)→ 不是修訂,是新功能。停下來,回 `/subsys-design` 分類(核心 → F、非核心 → E)並鑄號建檔;本 skill 不建檔

**不准為了「改既有功能」開 E。** 那會讓 F 檔停在初版、真相散在一堆 E 裡;唯一的真相是原檔。

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

1. **只改這次修訂點名的段落**與骨架對應處。擴張 scope 一樣在這份檔裡做(契約追加修訂行、Laws 加條、REV 寫清楚),**不另開檔**;只有「能獨立拿掉的新能力」才是新功能,而那不叫擴張,回步驟 0
2. 改 `## Laws` / `## Examples` / `## 數據` / `## 介面`,**`## 契約` 只准追加修訂行,不准改寫既有欄位**——那一節是 Level 2 的產出
3. 同步骨架,分三種情況:

   | 情況 | 骨架怎麼寫 | qa 重跑的測試在骨架上應該 |
   |---|---|---|
   | **新增**介面 | 新簽名 + 未實作標記 | 紅 |
   | **簽名變動** | 新簽名 + 未實作標記,並把呼叫端做**機械性對齊**(只改呼叫形式,不改邏輯);對齊改不動就是層級判錯了,回步驟 1 | 紅 |
   | **行為不變、只換內部做法**(效能、重構,簽名一個字都不動) | **不動任何程式碼**,骨架就是現狀 | **綠**(「保護」欄點名的 law 測試捕捉現況,之後 impl 改內部必須維持綠) |

   右欄是 qa 階段的預期,寫在這裡是給你判斷「哪幾條要重委派」用的——不是要你現在跑測試
4. 一致性檢查**只重跑被動到的那幾條**

## 2B. Level 2:回架構層

1. 改 `design.md` 的對應章節(對外契約 / 模組間公開介面 / 資料流管線 / 模組群),**先改架構、再改 feature 檔**——反過來會讓 feature 檔短暫超出契約
2. 逐條跑 `contract-readiness.md` A 段;動到跨子系統的東西再跑 B 段
3. 受影響的**每一份** feature 檔都要同步 `## 契約`,不是只有觸發這次修改的那一份。用這道指令找出來:

   ```
   node "<S>/arch-audit/scripts/scan-status.mjs" .design --doc <文檔全名>
   ```

   它會印反向依賴——那些就是要一起看的文檔
4. 已經 `done` 的 feature 檔契約改了時,**那份檔一樣走第 3 段的留痕**:`rev` +1、REV 一條、`status` 退回 `specced`。沒有「補做它的 E」這個第二份檔——它的實作落後於它自己的新版本,重做被 REV 點名的那幾條就是了

## 2C. 修訂的紀律(效能、重構、換做法時追加)

修訂既有功能的「行為不變、只換做法」那一類(效能優化、重構、換演算法),多三條紀律:

1. **先讀程式碼、再談修訂**:沒有打開原始碼讀過現況,就沒有資格提出或評估任何做法。用程式碼知識圖的「反向可達」查誰依賴這個標的,當作影響面的候選清單(圖會漏動態呼叫、反射、設定檔驅動的相依,每個要納入的位置一樣要開原始碼讀過)
2. **現有行為也是契約**:哪些行為改完必須一模一樣,每一條都要是這份檔的 LAW——還不是的,先補成 `LAW-n`(下一個沒用過的號)再修訂,REV「保護」欄逐條點名;不能靠實作者自己記得。沒有 law 守著的「行為不變」等於沒有保護
3. **量化目標寫進 law,基準線寫在 law 裡**:「LAW-6:p95 ≤ 100ms(基準線 2026-09-18 量測 400ms)」。怎樣算完成由這條 law 決定,不由實作者的感覺決定

## 3. 留痕(不可跳過)

三件事,**同一次動作**做完:

1. 改完的 `## 契約` 底下追加一行修訂行:

   ```markdown
   - 修訂 2026-09-03 依 qa 提問「<模糊點原句>」:<改了什麼,一句話>(層級:Level 3 就地 / Level 2 連動 design.md「模組間公開介面」)
   ```

2. `## 修訂記錄` 追加一條 `REV-n`(沒有這一節就建;格式與規則見 `doc-lifecycle.md`「修訂(rev 與 REV)」),frontmatter `rev` +1——**兩者是同一個動作**,`rev` 只是 REV 條數的快取,腳本會查對不對得上:

   ```markdown
   - REV-2(2026-09-03,依 qa 提問「<模糊點原句>」):<一句話:改了什麼、為什麼>
     - 動到:LAW-2 改寫、LAW-5 新增、介面 `refresh(req)` 多一個 `now` 參數
     - 保護:LAW-1(既有 session 在修訂前後都還能 refresh)
     - 重委派:qa(LAW-2、LAW-5)、impl(`refresh`)
     - 連動:billing/F004-invoice-session 的 `## 契約` 同步(Level 2)
   ```

   **「連動」欄列的是你在 2B.3 真的同步過的每一份下游**。腳本用它接漏網之魚:下游 X 依賴本檔、本檔這條 REV 晚於 X 的 `updated`、而「連動」沒點名 X,才會提示「沒點名 X,X 也沒對過帳」;你有列到就不報。**law 編號單調遞增**:刪掉的 LAW-3 永久空缺,新增的是下一個沒用過的號
3. `status` 是 `done` 的,退回 `specced`(文檔已是新版本,實作落後於它);`planned` / `specced` 不動

觸發來源是 spike 時「依」後面寫 spike 全名(`依 SPK-003-storage-engine`),並把這份文檔的全名補進那份 spike 的 `feeds` 欄——那是 spike 唯一被允許的跨文檔回寫,由你做,不由 spike 做。開發者直接提出、沒有 gap 的修訂,「依」寫 `開發者:<一句話>`。

觸發本次修訂的 GAP,**在同一個動作裡整條刪掉**(格式與理由見 `../_shared/spec-roles.md`「spec-gaps 協議」):它的模糊點原句已經抄進 REV 的「依」欄,定案後的問題不需要被找回;`spec-gaps.md` 只裝 open 的,空了就刪檔。閘門裁決的 ASM 同理:結論寫進契約修訂行 / 不可逆決定,REV 依欄寫 `閘門 WAVE-n「<一句話>」`,刪掉條目。

同步該檔的 `updated`;Level 2 的話 `design.md` 也要同步。修訂的討論過程(否決了什麼、為什麼)不留在原檔,搬 `archive/<F00x-slug>-rev<n>-process.md`。

## 4. 收尾

**改完的東西 qa 與 impl 都要重跑**。收尾必須講明:

- 哪幾條介面的簽名動過 → 骨架與既有測試一起失效,要重新委派(就是 REV 的「重委派」欄,照抄)
- 哪幾份文檔退回了 `specced`、現在是 rev 幾(`auth/F002-token-refresh(rev 2)`)
- Level 2 的話:「連動」欄列的每一份下游各自改了什麼

只說「文檔改好了」是不夠的——那會讓人以為程式碼還是對的。

跑一次驗收並貼結果:

```
node "<S>/arch-audit/scripts/scan-status.mjs" .design --subsys <slug>
```

最後輸出定錨區塊(格式見 `../_shared/anchor.md`)。

## 邊界

- **不配號、不建檔**:本 skill 只改既有文檔。新功能(核心 F 或擴充 E)一律回 `/subsys-design` 分類建檔;**「優化既有功能」不是建檔的理由**,那就是本 skill 的修訂
- **不寫測試、不寫實作**:改完交回 `/spec-qa` 與 `/spec-impl`
- **委派模式下不啟動**:契約改動一定要人拍板,`/subsys-build` 遇到需要改契約的 gap 會停下來(見該 skill「閘門」)
