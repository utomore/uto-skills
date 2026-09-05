# 模板:enhancement spec(`enhancements/E00x-<slug>.md`)

**E 與 F 同構,用 `feature-spec.md` 逐欄填,本檔只列三處差異。** enhancement 不是「優化既有功能」——那是 `/spec-redesign` 的修訂,不建檔;E 是一個**新的、拿掉它子系統照樣運作**的擴充功能(判準見 `doc-lifecycle.md`「六種分類與分流判準」)。

| 差異 | F | E |
|---|---|---|
| frontmatter | `type: feature`、有 `stage` / `modules` / `part-of` | `type: enhance`、**沒有 `stage`**(E 不擋開發階段,不掛在階段路線圖上)、沒有 `part-of`;`modules` 照填 |
| `## 契約` 的判準行 | `- **核心判準**:少了它,<子系統> 就無法「<system.md 職責原句>」` | `- **非核心判準**:少了它,<子系統> 照樣 <做什麼>;它加的是 <什麼>`;「階段」欄寫「不掛階段」 |
| 依賴方向 | 可以被別的 F 依賴 | **不准被任何 F 依賴**——F 依賴 E 就代表 E 其實是核心,停下來回 `/subsys-design` 重分類;E 可以依賴 F 與別的 E |

其餘一切(目的 / 未超出範圍 / 數據 / 介面 / Laws 四格 / Examples / 依賴 / 不可逆決定 / 骨架 / 待確認假設 / 實作備註)與 `feature-spec.md` 完全相同,包含「`## 契約` 一個字都不准改」與「`## 修訂記錄` 撰寫時不建」兩條。

