---
name: revise
description: lawful 的修訂 — 回答 GAP、開發者要改簽名或 law、解凍 frozen 的 pipeline:一律改原檔,一次修訂一條 REV(依 / 動到 / 保護 / 重委派),簽名變了程式碼同步回 stub,刪 GAP 條目,列出要重派的角色。觸發詞:修訂、回答 GAP、改 law、改簽名、解凍、revise、lawful revise。Use when an existing pipeline's contract must change or a GAP has been answered.
user-invocable: true
---

# lawful:revise — 改原檔,一條 REV

## 讀什麼

`<L>` 解析一次(`rules/tooling.md`「CLI」)。一次讀完:`rules/pipelines.md`「frontmatter 與 status」「修訂(REV)」「提問(GAP)」、`rules/tooling.md`「收尾定錨」。再讀目標 pipeline 檔與 `.design/gaps.md`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一條 GAP 與開發者的回答,或開發者要改的東西 | 原檔改好、REV 一條、GAP 條目刪掉、重委派清單 |

## 步驟

1. **frozen 先解凍**:「決定」節記一條「解凍:<為什麼要改>」,`status` 改 `ready`。
2. **定動到與保護**:動到哪些 stage 與 law;其餘既有 law 全列進保護。要保護的行為還不是 LAW 的,先補成 LAW 再修訂。
3. **改原檔**:簽名、law、層,直接改那一格;`## 修訂記錄` 加一條 REV,依欄帶提問原句或開發者的話;`updated` 改今天。
4. **程式碼跟上**:簽名變了,程式碼那行同步改、本體回 stub;層變了,模組表同步改。
5. **結 GAP**:被回答的條目整條刪掉,`gaps.md` 空了刪檔。
6. **對帳**:`lawful lint laws`、`lawful lint sig`。
7. **重委派清單**:law 變了 qa 重翻那幾條;簽名變了 impl 重填那幾個 stage。交給 `lawful:build`。

## 收尾

回報 REV 編號、動到 / 保護 / 重委派三欄、刪了哪些 GAP;附定錨區塊。下一步:`lawful:build <全名>`。

## 邊界

不寫測試、不寫實作;同層搬模組不走這裡,`lawful sync`;不做的 pipeline 直接刪檔,理由值得留就開 ADR。
