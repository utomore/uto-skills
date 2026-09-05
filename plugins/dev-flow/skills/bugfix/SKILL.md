---
name: bugfix
description: 缺陷修復 — 重現缺陷、分析根因後,在對應子系統建立 .design/subsystems/<slug>/bugfixes/B00x-<slug>.md(跨子系統為 .design/bugfixes/G-B00x-<slug>.md),先寫重現測試再修復、保留為回歸測試並回寫狀態。觸發詞:修 bug、bugfix、bug fix、缺陷修復、修復缺陷、debug。Use when recording and fixing a bug with a reproducing test.
user-invocable: true
---

# /bugfix — 缺陷修復

## 先讀什麼(**一批送出,不要一個一個開**)

`<S>` = 本 plugin 的 `skills/` 目錄,**整場對話只解析一次**(規則見 `../_shared/conventions.md`「腳本目錄」):
`dirname "$(dirname "$(find ~/.claude/plugins . -maxdepth 9 -type d -path '*dev-flow*/skills/arch-audit/scripts' 2>/dev/null | head -1)")"`

拿到 `<S>` 後,把下面**必讀**與成立的**條件式**項目放進**同一則訊息**一次讀完(多個 Read / Bash 併發)。**禁止讀一個、想一下、再讀下一個**——這一段是純載入,拆成幾趟只是把幾次 prefill 疊起來。

**必讀**

| 讀什麼 | 為什麼 |
|---|---|
| `node "<S>/arch-audit/scripts/doc-section.mjs" ../_shared/conventions.md 腳本目錄 跑東西的紀律 角色與設計哲學 資訊抽象邊界規範 通用規則` | 核心慣例:腳本目錄、角色與設計哲學、資訊抽象邊界規範、通用規則、**跑東西的紀律**。**不要整份讀**——開頭那張分片對照表是給維護者的 |
| `../_shared/boundary-rules.md` | **邊界判斷規則** + 實作階段規則 |
| `../_shared/testing-policy.md` | 本 skill 自己寫重現測試 |
| `node "<S>/arch-audit/scripts/doc-section.mjs" ../_shared/doc-lifecycle.md 命名與編號規則 任務文檔 文檔引用格式 description` | 本 skill 要新建 bugfix 文檔。**不要整份讀**——腳本末尾會附上你沒讀到的章節目錄 |

**條件式**(先判斷條件,成立的**併進上面同一批**)

- 專案有程式碼知識圖 → `../_shared/codegraph.md` + `../_shared/codegraph-tools.md`(用來定位,不取代重現與根因驗證)
- **收尾時** → `../_shared/anchor.md`(定錨區塊格式)

本 skill 一條龍完成:**記錄缺陷 → 重現 → 根因分析 → 修復 → 回歸測試 → 回寫狀態**。缺陷文檔是修復的過程紀錄與回歸依據,不是待辦——建檔與修復在同一次執行內完成(開發者明確只要「先記錄、之後修」時例外,建檔後停在 `open`)。

## 1. 理解與重現(不可跳過)

1. 向開發者釐清:症狀是什麼?怎麼觸發?預期行為 vs 實際行為?**能重現才有資格談根因**——先找到穩定重現步驟;無法重現時如實告知,和開發者一起縮小條件,不得憑猜測開修
2. 定位缺陷落點:讀相關原始碼,確認問題在哪個子系統、哪個模組;找出對應的 feature 文檔(回鏈 `related-feature`)。**有程式碼知識圖時**(判定與指令見 `../_shared/codegraph.md`):用「兩點間最短路徑」的能力(症狀入口 → 可疑模組)列出呼叫鏈當**假說**,用「反向可達」查出錯的符號還有誰會踩到同一個雷(判斷影響範圍與要不要拉成全域 G-B)。路徑上每一跳都要讀原始碼驗證——**能重現才有資格談根因這條不變**,圖不能當根因的證據
3. 判斷 scope:缺陷與修法只落在單一子系統 → 子系統 `bugfixes/`;根因或修法橫跨多個子系統 → 全域 `.design/bugfixes/`(frontmatter 加 `subsystems: []`)。有疑義時與開發者確認

## 2. 建立缺陷文檔

**配號並建檔是同一道指令**(不准自己數資料夾——只掃當前工作區看不到別的分支與 worktree 已經鑄走的號):

```
node "<S>/arch-audit/scripts/scan-ids.mjs" .design --claim <組> --slug <kebab-slug>
```

組寫 `<子系統>/B`(缺陷落在單一子系統)或 `G-B`(跨子系統)。腳本配號、把檔案建在慣例位置、寫好下面這段 frontmatter 骨架,印出 `<id>`、路徑與**全名**(`auth/B001-login-timeout`,之後每次提到這份文檔都用全名)。你接著把 `description` 與內文填上——slug 英文 kebab-case、內文繁體中文:

```markdown
---
id: B00x                # 全域時為 G-B00x
type: bugfix
title: <slug>
description: <一句話,40 字內:什麼壞了>
status: specced          # bugfix 沒有 planned 這一格:缺陷是看著既有程式碼提出來的
created: <today>
updated: <today>
depends-on: []
related-adr: []
related-feature: []     # 回鏈到出問題的 feature(一律帶子系統前綴,如 [auth/F002];E 也可以是 [auth/E001];G-B 指 G-F,如 [G-F001])
code-paths: []          # 建檔時留空;步驟 5 與 status: done 一起回寫實際修到的程式碼路徑
# 全域 G-B 文檔才有下一行:
# subsystems: [subsys-a, subsys-b]
---

# B00x: <缺陷標題>

## 症狀
(觸發方式、預期行為 vs 實際行為、影響範圍)

## 重現步驟
(穩定重現的最小步驟或最小重現碼)

## 根因分析
(問題出在哪個檔案哪段邏輯、為什麼會發生;附具體程式碼位置)

## 修復方向
(怎麼修、為什麼這樣修、有無替代方案;動到公開介面時特別標明)

## TodoList
- [ ] STEP-1: 撰寫重現缺陷的測試(修復前應失敗)  `dep: -`
- [ ] STEP-2: <修復步驟>  `dep: STEP-1`
- [ ] STEP-3: <修復步驟>  `dep: STEP-2`

## 驗證方式
(重現測試轉綠 + 相關回歸測試全綠;必要時附驗證指令)

## 修復紀錄
(實際修法摘要、與「修復方向」的偏差;修完填寫)
```

## 3. 修復(測試先行)

1. 開工前:`updated` 換今天(`status` 維持 `specced`——值域沒有 `in-progress`,「正在做」看的是骨架裡還有沒有未實作標記,見 `../_shared/doc-lifecycle.md`「狀態與生命週期」)
2. **先寫一條能重現缺陷的測試**,執行確認**修復前失敗**——這條測試就是缺陷的存在證明,之後保留為回歸測試。測試從公開介面寫,非看內部不可時走 `*.Internal`;**不得為測試在核心層開後門**(`testing-policy.md`)
3. 依 TodoList 逐項修復並勾選;修法以「修復方向」為準,發現行不通時先與開發者確認,把偏差寫進「修復紀錄」
4. **最小修復原則**:只修根因,不順手重構;修復過程發現既有功能該改的記下來,建議開發者另走 `/spec-redesign`(修訂原檔,不另開檔);發現缺一個新能力的走 `/subsys-design`(分類建檔)。修法若動到 Level 2 公開契約,先與開發者確認並回頭更新對應 `design.md`
5. **依賴檢查(提交前自查)**:修法有沒有新增 import 方向?設計文檔裡沒有這條邊 = 架構變更,按 `boundary-rules.md`「發問協議」停下來問;核心層冒出表現層 / 前端 / 測試的概念 → 移除

## 4. 驗證

- 重現測試轉綠;**先跑修到的那幾個模組的測試**,那一批全綠之後再跑**一次**完整套件確認沒有修壞別的地方(整條流程就這一次;判準見 `../_shared/conventions.md`「跑東西的紀律」)
- **如實回報結果**:失敗就貼出輸出並繼續修,不得宣稱通過

## 5. 收尾

- 修復完成且測試全綠 → 填寫「修復紀錄」、`status` 改 `done`、更新 `updated`、**回寫 `code-paths`**(本次修到的產品程式碼路徑,以檔案為主,不含重現測試;欄位規格見 `../_shared/doc-lifecycle.md`)
- 摘要給開發者:文檔路徑與**全名**(`auth/B002-login-timeout`,全域寫 `G-B001-<slug>`)、根因一句話、修法一句話、測試結果、有無另建議的修訂或新功能項目
- 最後輸出**定錨區塊**(`../_shared/anchor.md`):位置樹把本文檔標為「目前」,其下列被修到的介面/資料結構與狀態;修法若動到契約沒寫的東西,上偏離清單;下一步從樹上推(常見:`/branch-pr`,或另建議的 `/spec-design`)
