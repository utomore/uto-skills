# Skill 撰寫與維護準則

**這份文件給「改 skill 的人」看,不會在執行時被載入。** 這個分界是刻意的:操作程序留在 `SKILL.md` 與 `_shared/`,維護準則、設計理由、事故紀錄留在這裡。少了這個分界,每次事故的檢討都會沉澱進執行路徑,文件慢慢變成事故紀錄而不是操作程序。

## 成本模型

skill 的成本不是檔案長度,是**執行者一次要同時記住多少條規則**。實際的單次成本是:

```
SKILL.md + 該 skill 會讀到的 _shared 分片
```

所以共用層的每一行,都乘上讀它的 skill 數量。量測:

```bash
cd plugins/dev-flow
for f in skills/*/SKILL.md skills/_shared/*.md; do printf "%4d %s\n" "$(wc -l < "$f")" "$f"; done
```

各 skill 的 `description` 是**永遠在 context** 的(約 6.5 KB / 13 個 skill),但那是觸發判斷的必要成本,不是優化對象。

## 三條追加閘門

每次要往 skill 裡加東西之前,依序過這三關:

1. **先問「有沒有哪一段因此可以刪掉」。** 純追加是退化的徵兆。新增的規則若讓某條舊規則變得多餘,就該一起處理;每次都只加不減,累積是必然的。
2. **跨 skill 的規則放 `_shared/`,只有單一 skill 用得到的放 `SKILL.md`。** 同一條規則兩邊各寫一次是最真實的臃腫來源——兩份都會進 context,而且會各自漂移。
3. **理由只有能擋掉一個可預期的錯誤動作時才留。** 例:「模型是工具參數不是 prompt 內容」擋得掉一個會靜默失敗的誤用,值得留;「checkpoint 不是已驗收」擋得掉把 checkpoint 誤當品質保證,值得留。純粹解釋設計動機給人看的段落,搬來這份文件。

補充一條不對稱性:**可選功能不該佔用跟強制流程一樣的注意力預算。** opt-in、預設 no-op 的內容在多數執行裡會被整段跳過,寫太長是純浪費。要瘦身時從這類內容下第一刀。

## `_shared/` 的分片規則

分片邊界是**「什麼時候需要」,不是「什麼主題」**:

| 分片 | 什麼時候讀 |
|---|---|
| `conventions.md` | 每個 skill 都讀 |
| `spec-roles.md` | 走 spec 驅動流程時(Level 3 的設計 / qa / impl 與編排者;`/bugfix` 不適用) |
| `frontmatter.md` | 要新建 `.design/` 文檔,或要確認某個 frontmatter 欄位怎麼寫時 |
| `delegation.md` | prompt 標明 `【委派模式】`,或身為 `/spec-build` / `/subsys-build` 的編排者時 |
| `codegraph.md` | 設計類 skill **必用**、`/spec-qa` **限用**(界線見該片)、其餘 opt-in(判定不過就整片不讀) |
| `anchor.md` | 每個 skill 的收尾與 `/subsys-build` 的階段閘門——每次都讀,但拖到收尾才讀,讓執行中段的規則數量不變 |

新增共用內容時先判斷它屬於哪一片。判斷不出來,通常表示它其實是單一 skill 的規則。

**拆片最大的風險是漏讀**,唯一的防線是:每個 `SKILL.md` 開頭必須**明列讀哪幾片、以及為什麼要讀**,不能只寫「遵守共用慣例」。加分片或改分片條件時,十三個 `SKILL.md` 的開頭都要同步檢查。

## 什麼該搬進 `templates/`

純模板、樣板、只在特定動作發生時才需要逐欄對照的內容(例:`subsys-build/templates/build-log.md`),搬進該 skill 的 `templates/`,`SKILL.md` 只留一行指路。判準:**這段內容是「每次執行都要記住的規則」,還是「做某個動作時才打開來照抄的東西」?** 後者屬於 `templates/`。

腳本同理,放 `scripts/`(例:`arch-audit/scripts/scan-status.mjs`)。

## 不要做的事

- **不要把單一 skill 的主流程拆成多個檔案。** `_shared/` 拆片是因為它被十三個 skill 共用、需求差異大;單一 skill 的流程拆開只會提高漏讀率,省下的也有限。
- **不要為了行數砍掉能擋錯的理由。** 見閘門第 3 條——判準是「擋不擋得掉一個具體的錯誤動作」,不是長度。

## 版本號

版本號一律由使用者指定,不自行計算 semver bump。改完內容後若需要變更版本,先問要用哪個版本號再寫入 `plugins/<plugin>/.claude-plugin/plugin.json`。
