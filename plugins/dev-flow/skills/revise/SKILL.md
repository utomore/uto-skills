---
name: revise
description: dev-flow 的修訂 — 任何對既有 feature 或 abstract 的行為、簽名、層或效能承諾的改動都改原檔:回答 GAP、寫一條 REV(依 / 動到 / 保護 / 重委派 / 連動)、必要時把 frozen 解凍,並講明哪幾條 law 與簽名要重新委派;law 號永久空缺。觸發詞:改契約、修 spec、改設計、回答 gap、結 gap、改介面、改行為、範圍變了、修訂、解凍、效能優化、dev-flow revise。Use when an existing document must change, or when answering a GAP raised by qa or impl.
user-invocable: true
---

# dev-flow:revise — 改原檔,留 REV

## 讀什麼

`<D>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/features.md`「frontmatter 與 status」「修訂(REV)」「提問(GAP)」、`rules/tooling.md`「收尾定錨」。再讀目標文檔與 `.design/gaps.md`。

## 前置

- 改的是**兩份以上文檔的共同部分** → 走 `dev-flow:refactor`,它會替每一份寫 REV。
- 要加的是一個**可以獨立拿掉的新能力** → 那是新 feature,走 `dev-flow:feature`。
- 其餘一律在這裡改原檔。**不開第二份檔**:開了,原檔就停在它被寫下的那一天,三個月後沒有人知道它現在長什麼樣。

## 步驟

1. **拿到來源的原句**:GAP 的提問原句、spike 的 verdict、開發者的那一句話。REV 的「依」欄要寫它,不寫已經刪掉的條目編號。
2. **`frozen` 先解凍**:`status` 改回 `ready`,在「決定」記一條為什麼。
3. **先補保護**:這次不准變的既有行為若還不是 law,**先補成 `LAW-n` 再改**。沒有 law 守著的「行為不變」等於沒有保護。
4. **改條文**:Steps 的簽名、Laws、Examples、層。刪掉的 law 號永久空缺,新增的往下接。效能修訂把基準線寫進新的 law(「p95 <= 100,基準線 2026-09-18 量到 400」)。
5. **寫 REV**:`## 修訂記錄` 加一條,五欄齊全(依 / 動到 / 保護 / 重委派 / 連動)。`updated` 改成今天。
6. **連動**:`devflow status --doc <全名>` 看「被引用」;引用了本檔簽名的每一份,逐份同步並寫進「連動」欄。**責任在改的人**:簽名改了編譯器會告訴下游,語意改了什麼都不會抓。
7. **結案 GAP**:寫 REV 的同一個動作把條目**整條刪掉**,不留 resolved。`gaps.md` 空了刪檔。
8. **程式碼跟著**:簽名變了就同步改簽名行、本體回骨架標記。`devflow lint all`。

## 收尾

回報 REV 第幾條、動到什麼、保護什麼、要重派誰、連動了哪幾份;附定錨區塊。下一步一律是 `dev-flow:build <全名>`(只重做 REV 點名的)。

## 邊界

一次修訂一條 REV;不順便改別的;不寫實作、不寫測試;不替開發者決定要不要改——開發者說,你寫。
