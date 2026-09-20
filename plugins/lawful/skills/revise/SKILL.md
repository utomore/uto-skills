---
name: revise
description: lawful 的修訂 — 回答 GAP、開發者要改簽名或 law、解凍 frozen 的 pipeline、把優化路線的調整(RF-n)落到它動到的 pipeline:一律改原檔,一次修訂一條 REV(依 / 動到 / 保護 / 重委派;調整的 REV 依欄引用 RF-n),簽名變了程式碼同步回 stub,刪 GAP 條目,列出要重派的角色。觸發詞:修訂、回答 GAP、改 law、改簽名、解凍、改名、搬模組、改模組職責、加一層、收整、調整、優化、revise、lawful revise。Use when an existing pipeline's contract must change, a GAP has been answered, or a refinement must be applied to the pipelines it touches.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:revise — 改原檔,一條 REV

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief revise` 的輸出:規章、分支與工作樹、目標 pipeline 全文與逐條狀態、Stages 上每條簽名與型別的宣告、它引用的 pipeline 的 Stages 表與引用它的那幾列和 law、它朝向哪條里程碑與調整、`gaps.md`、`lint sig` 與 `lint laws` 裡講到它的、`lawful status` 裡講到它的每一行;目標是 `RF-n` 時是那個目標檔、需求的 Law 與它動到的每條 pipeline 全文;沒給目標時是 `gaps.md` 與 `lawful status` 的需求表、目標表、等決定、警訊與建議路線。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:pipeline 全名,或一條調整 `RF-n`;從一條 GAP 開始而還不知道動哪一條就不給。上面寫「目標未指定」就先定出目標,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief revise <目標> --no-rules`;同一場裡目標文檔或專案現況變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一條 GAP 與開發者的回答、開發者要改的東西、或一條待修訂的調整 `RF-n` | 原檔改好、REV 一條(調整的依欄引用 `RF-n`)、GAP 條目刪掉、重委派清單 |

## 前置

- 做的是調整:那條 `RF-n` 要在某個目標檔的調整表上、動到的 pipeline 要是它列的、該目標的建置路線要已經達成;不是就停,回 `lawful:objective`。調整只改實作或行為品質,要改簽名或加 stage 讓它做到新能力的,不是調整,是新里程碑。
- 從與 origin 同步、工作樹乾淨的主線開 `design/<全名>`,修訂在這條分支上做(`roles.md`「分支與所有權」)。

## 步驟

1. **frozen 先解凍**:「決定」節記一條「解凍:<為什麼要改>」(調整就寫 `RF-n` 那一句),`status` 改 `ready`。
2. **定動到與保護**:動到哪些 stage 與 law;其餘既有 law 全列進保護。要保護的行為還不是 LAW 的,先補成 LAW 再修訂。調整的保護一定含需求 Law 引用到的每條 law:優化不准破壞需求 Law。
3. **改原檔**:簽名、law、層,直接改那一格;`## 修訂記錄` 加一條 REV,依欄帶提問原句、開發者的話、或 `RF-n` 與它那一句(`status` 靠這個算調整的進度);`updated` 改今天。
4. **程式碼跟上**(`roles.md`「骨架與基線」):簽名變了,程式碼那行同步改、本體回 stub;新的 stage 與型別寫成骨架,編得過;層變了,模組表同步改。pipeline 檔與骨架同一個 commit,在 `design/<全名>` 上。模組單元的名字、職責或層要變也是修訂:改 `.lawful/modules.md` 那一列,補層走 `lawful module <單元> --layers <新的層>`,再把住在裡面的 stage 模組欄跟著改。
5. **結 GAP**:被回答的條目整條刪掉,`gaps.md` 空了刪檔。
6. **對帳**:`lawful lint laws`、`lawful lint sig`。
7. **重委派清單**:law 變了 qa 重翻那幾條;簽名變了 impl 重填那幾個 stage。交給 `lawful:build`。

## 收尾

回報 REV 編號、動到 / 保護 / 重委派三欄、刪了哪些 GAP、對應的調整(有的話);附定錨區塊。下一步:`lawful:integrate`(發設計 PR),合進主線後 `lawful:build <全名>`;調整動到多條 pipeline 時,每一條各一次修訂再各自 build。

## 邊界

不寫測試、不寫實作;同層搬模組不走這裡,`lawful sync`;`=` 列搬到別的模組單元,REV 之外還要 `lawful rename <P-00x> <單元>-<動詞>` 讓 slug 的領域名詞跟上;不做的 pipeline 直接刪檔,理由值得留就開 ADR。
