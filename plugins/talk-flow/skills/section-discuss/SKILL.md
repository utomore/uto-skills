---
name: section-discuss
description: 演講段落討論 — 以 docs/topic.md 為依據逐段深談呈現方式、先備知識與頁面規劃,產出完整的 docs/section-0x-<slug>.md;子命令 status 掃描各段落狀態。觸發詞:段落討論、section discuss、段落設計、段落狀態、section status。Use when designing one section of a talk in depth, or checking section status.
user-invocable: true
---

# /section-discuss — 演講段落討論

先讀取 `../_shared/conventions.md`,遵守其中所有文檔慣例。

## 子命令 status

參數是 `status` 時不進入討論流程,直接執行:

```
node <本 skill 目錄>/scripts/scan-status.mjs [docs目錄]
```

腳本掃描 `docs/topic.md` 與 `docs/section-*.md` 的 metadata,輸出各段落的主軸、狀態(open / in-progress / done / rejected)、時長與頁碼,並比對 `topic.md` 的 `sections` 清單找出缺漏。把表格轉述給使用者,不合規項目(缺 metadata、清單不一致、frontmatter 格式)逐條說明。

出現「frontmatter 格式不合規」時,先把該欄位改回行內陣列(`sections: [section-01, section-02]`)再重跑,不要憑印象解讀清單不一致 —— 清單欄位寫成 YAML 區塊列表時腳本讀不到內容,後面的比對結果不可信。

## 前置

1. 讀取 `docs/topic.md`(燈塔)。**不存在時**:告知使用者建議先執行 `/topic-design`,除非使用者明確要求直接寫段落
2. 確認目標段落:使用者指定編號則用之;未指定則列出目前狀態,建議 `order` 最小的 open 段落
3. 讀取目標段落文檔(佔位或既有內容),以及其 `depends-on` 指到的段落文檔;不相關的段落不讀
4. 使用者要新增一個 topic.md 沒有的段落時:先確認它與主軸的關係與時間來源(哪一段讓出時間),取最大編號 +1 建檔,並同步 `topic.md` 的 `sections` 與時間帳

## 流程

### 1. 深度討論(不可跳過)

與使用者反覆討論直到段落完全明確,**不確定就問,禁止腦補**:

- **存在理由**:為什麼需要這個段落?拿掉會怎樣?它替主軸(topic.md 的核心訊息)貢獻什麼?
- **內容要點**:要講哪些點?哪些加入、哪些調整、哪些刪除或置換?每個點對這批聽眾是新知還是複習?
- **先備知識**:聽這段需要什麼前提?由哪個段落鋪陳(`depends-on`)還是這段自己補?講者自己需要先補什麼?
- **呈現方式**:口述、圖解、程式碼、對比表、demo?段落 ≠ 投影片張數 — 這段需要 0 頁還是多頁?每頁的畫面構想是什麼?
- **時間**:est-minutes 是否要調整?調整會擠壓誰?

討論中使用者若決定**不要這個段落** → `status: rejected`,在文檔記錄拒絕理由,同步 `topic.md`(清單保留、時間帳重算,多出的時間問使用者分給誰),流程結束。

### 2. 產出 `docs/section-<編號:01>-<slug>.md`

frontmatter 依 conventions(`parent-topic: topic`、`order`、`est-minutes`、`pages`(尚未實作則留空)、`depends-on`),內文固定章節:

```markdown
# Section 0x:<段落名稱>

## 段落定位
(存在理由;與 topic.md 主軸的掛勾 — 引用核心訊息說明這段貢獻什麼)

## 內容要點
(逐點列出;標註新知/複習;討論中被刪除或置換的點記錄於此並附理由)

## 先備知識
- 聽眾:(需要什麼前提;由哪個段落鋪陳或本段自行補充)
- 講者:(需要事前準備或查證什麼)

## 頁面規劃
(0 頁則寫「純口述」與理由;有頁面則每頁一列 — 頁碼於 /section-impl 實作時分配回填)
| 頁 | 畫面構想 | 呈現方式 |
|---|---|---|
| 待分配 | <這頁畫什麼、一句話重點> | <圖解/程式碼/對比表/...> |

## 講稿要點
(這段的敘事線:開頭怎麼接上一段、結尾怎麼交棒給下一段、關鍵措辭)

## Demo
(無則寫「無」;有則寫目的、操作流程概要、環境需求 — 預設 uv + python + notebook)
```

### 3. 一致性檢查(必做)

1. `depends-on` 指到的段落必須存在,且 `order` 都在本段之前;先備知識段落若是 rejected,回頭與使用者解決(改由本段自補或救回該段)
2. 重算時間帳:所有非 rejected 段落 `est-minutes` 總和 ≈ `duration-minutes`;超支就列出來讓使用者裁決
3. 比對 `topic.md` 的「大綱與段落規劃」表:名稱、目的、分鐘數、頁數預估有出入時,經使用者同意後更新 `topic.md`(同步 `updated`)

### 4. 收尾

摘要:段落檔案路徑、狀態、時間帳結論、topic.md 是否有更新;建議下一個要討論的段落,或(全段落討論完成時)建議開始 `/section-impl`。
