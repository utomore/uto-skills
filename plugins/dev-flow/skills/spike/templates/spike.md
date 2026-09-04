# `SPK-00x-<slug>.md` 版面模板

路徑 `.design/spikes/SPK-00x-<slug>.md`,程式碼在同名資料夾 `spike/SPK-00x-<slug>/`(`spike/` 是常駐的共用 sandbox;這個資料夾只活在 open 期間,結案時刪掉,每輪的 sha 是撈回程式碼的唯一鑰匙)。frontmatter 規格見 `_shared/doc-lifecycle.md`「spike 文檔」。`scan-ids.mjs --claim SPK` 建檔時只鑄號與骨架,內容照這份填。

**提到文檔一律寫全名**(`auth/F003-session-list`、`G-C001-session#SessionToken`、`ADR-004-storage`);這份紀錄會被單獨貼進閘門呈報、ADR 與 PR,到了那裡沒有「這是哪個 spike」的上下文。

```markdown
---
id: SPK-001
type: spike
title: <slug>
description: <一句話,40 字內:要驗證什麼>
status: open                 # open | concluded | dropped
verdict:                     # concluded 才填:feasible | infeasible | partial
created: <today>
updated: <today>
subsystems: []               # 相關子系統;還沒定子系統時留空
feeds: []                    # 結論餵給哪些文檔(全名),concluded 時必填非空
related-adr: []
code-paths: [spike/SPK-001-<slug>]   # 固定同名資料夾(結案後已刪,配 RND 的 sha 撈);只准指到 spike/ 底下
---

# SPK-001-<slug>

## 問題
- **要回答什麼**:<一句話,可判定的形式:X 在 Y 條件下能不能 Z>
- **為什麼讀原始碼答不出來**:<一句話>
- **判準**:feasible = <可觀察的數字或現象>;infeasible = <…>;partial = <…>
- **下游**:<結論會餵給哪份文檔的哪一格,例:ADR-004-storage 的被否決方案 / auth/F003-session-list 的不可逆決定>

## 輪次
### RND-1(<日期>)
- 這輪要驗:<一句話;單一問題的 spike 就是「問題」那一句>
- 判準:<同上,或這一輪自己的>
- timebox:<時間或嘗試次數>
- 做法:<試了什麼,兩三句>
- 結果:<對每條判準的觀察:數字或現象;timebox 用完沒答案就寫「未達判準,原因:…」>
- sha:<這一輪的 commit;結案後資料夾會刪,這是唯一能撈回程式碼的鑰匙,不得留白>
- 環境:<資料量、外部服務、機器;額外裝了什麼>

## 候選比較
(只有候選比較形態才有;判準對所有候選一致)

| 候選 | 子資料夾 | 判準達成 | 觀察結果 | 代價 |
|---|---|---|---|---|
| <做法 a> | `spike/SPK-001-<slug>/<a>/` | 2/3 | <…> | <三個月後誰會踩到什麼> |

## 結論
- **verdict**:<feasible | infeasible | partial>
- **一句話結論**:<…>
- **學到什麼**:<三個月後有人想再試一次時要先知道的事;這一格最貴>
- **餵給哪裡**:
  - <文檔全名> 的 <章節或欄位>(<日期>):<寫進去的是什麼>
- **沒驗到的**:<判準之外、這次沒碰的;沒有就寫「無」>
```

三條填法:

- **判準寫成可觀察的東西**。「感覺夠快」對不到任何輸出;「10 萬筆 2 秒內回來」才有辦法在「結果」欄填一個數字
- **每一輪都要有自己的三樣東西**(要驗什麼、判準、timebox)。多輪疊代的 spike 常常第二輪起就只寫「繼續」——那一輪就沒有可判定的結束點,模型屋從此無限期長下去
- **「學到什麼」不是結果的複述**。結果是「2 秒內回來了」,學到的是「但索引要先建好,冷啟動要 40 秒」——後者才是三個月後有人再碰這件事時要先知道的
