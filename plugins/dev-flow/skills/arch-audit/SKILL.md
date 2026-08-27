---
name: arch-audit
description: 架構檢測與分析 — 四種 scope:「system」檢查子系統循環依賴與對外 I/O 契約一致性;「subsys」檢查子系統資料流管線、SRP、邊界外洩與契約卡對帳;「feature」審查實作是否符合 Level 2 介面、edge cases、型別安全與委派留下的待確認假設;「status」用腳本盤點各 feature 完成度、契約卡就緒度、spec 階段項目與待優化模組。觸發詞:架構檢測、arch audit、架構分析、循環依賴、邊界檢查、status、進度確認、專案健檢。Use for architecture auditing at system/subsystem/feature scope, or scanning overall progress and health.
user-invocable: true
---

# /arch-audit — 架構檢測與分析

先讀取 `../_shared/conventions.md`(核心慣例:資訊抽象邊界規範)、`../_shared/doc-lifecycle.md`(資料夾樹、引用格式與權威來源,對帳用)、`../_shared/boundary-rules.md`(檢查知識歸屬與依賴邊的判準)與 `../_shared/testing-policy.md`(檢查測試後門的判準);scope 是 subsys 或 feature 時,另讀 `../_shared/spec-roles.md`(檢查骨架、Laws/Examples 覆蓋與 spec-gaps 的判準);要檢查 frontmatter 合規或建 B/E/ADR 文檔時,另讀 `../_shared/frontmatter.md`;scope 是 system 或 subsys **且**專案有程式碼知識圖時,另讀 `../_shared/codegraph.md`;收尾時另讀 `../_shared/anchor.md`(定錨區塊格式)。

## Scope 判斷

分析範圍採樹狀結構:根節點是主架構,第二層是各 subsystem,第三層是 feature 實作。

- 引數含 `status` / 「狀態」 / 「進度」 → **status**:整體進度與健康度(只跑腳本,不產文檔)
- 引數含 `system` / 「全域」 / 「主架構」 → **system**:全域架構檢測
- 引數含 `subsys` / 子系統名稱 → **subsys**:子系統一致性檢測(需指定哪個子系統,沒指定就用 AskUserQuestion 問)
- 引數含 `feature` / 文檔 id(如 `F001`、`auth/F001`)→ **feature**:功能實作審查(需指定哪個 feature)
- 無法判斷 → 用 AskUserQuestion 讓開發者選 scope

---

## Scope: status — 整體進度與健康度

執行本 skill 目錄下的腳本(解析 `.design/` 全樹的 frontmatter 與各 `design.md` 的功能規劃):

```
node "<本 SKILL.md 所在目錄>/scripts/scan-status.mjs" [design目錄,預設 ./.design]
```

腳本輸出兩張表加數個清單,**全部**整理後呈現給開發者:

- **任務文檔表**(`主軸 | id | 子系統 | type | status | created | depends-on | file`):轉成 markdown 表格時**維持欄位順序**,「主軸」是第一眼看到的欄位;`子系統` 欄為 `global` 代表全域 G- 文檔
- **子系統狀態表**(`主軸 | id | status | 階段 | features | 契約卡 | 已建文檔 | 已完成 | 未結E/B | 進度`):回答「哪些 feature 已完成、哪些還在規劃/設計階段、哪些模組有未結的優化與缺陷」;欄位顯示 `-` 代表該 `design.md` 沒有「功能規劃」表格,建議用 `/subsys-design` 更新模式補上
- **契約卡欄**(`n/總數`):功能規劃有幾項備妥「Feature 契約卡」= 委派展開的就緒度。滿格才跑得動 `/subsys-build`;顯示 `-` 表示整份 `design.md` 沒有契約卡章節(舊版文檔屬正常,只是不能委派)。缺卡與孤兒卡片會出現在「提示」清單,**不列為不一致**(不影響 exit code)
- **待展開的 feature**:功能規劃有列、doc 欄仍是 `-` 的項目 = 下一步的待辦清單(逐一走 `/spec-design`,或契約卡滿格時用 `/subsys-build` 委派展開)
- **未結的 spec-gaps**:qa / impl 提出、尚未被 spec 修訂的問題。**每一條都代表有項目正卡著**,要逐條轉達並建議走對應的 design skill 更新模式修 spec;有未結條目時 `/subsys-build` 會擋著不啟動
- **架構 / 子系統不一致**必須逐條轉達:`subsystems` 權威清單與實際資料夾對不上(雙向)、功能規劃指向不存在的文檔、id 與檔名不一致、depends-on 無法解析、全域文檔缺 `subsystems` 欄、design.md 缺 `parent` 等
- 有「frontmatter 格式不合規」時,把清單欄位改回行內陣列再重跑;寫成 YAML 區塊列表時腳本讀不到內容,相依關係與歸屬都不可信
- 有 `missing-metadata` / 缺 description 警示時,提醒開發者補上

**禁止**為了補充資訊而去讀取各文檔全文——此 scope 的重點就是省 context(功能規劃已由腳本解析成進度數字,不必自己開檔)。

---

## 分析型 scope 共通規則(system / subsys / feature)

1. **先跑一次 status 腳本**,把不一致清單帶進本次分析(文檔樹本身有問題時,對照分析的結論不可信,先讓開發者修)
2. **有程式碼知識圖就先跑圖掃描**(system / subsys scope):照 `../_shared/codegraph.md` 判定可用性,通過就執行

   ```
   node "<本 SKILL.md 所在目錄>/scripts/scan-graph.mjs" .design [--subsys <slug>]
   ```

   它給的是**線索**:子系統依賴矩陣、循環依賴(附每條邊的 `檔案:行號` 證據)、跨界引用清單、架構 hub。腳本印出的「⚠ 影響結論可信度」整段要**原樣轉達給開發者**——圖是無向建置、過期、或對映覆蓋率過低時,任何基於它的結論都不能採信,先修再談。沒有圖(或判定沒過)就照下面各 scope 的原方法做,不提也不擋
3. **Context 載入紀律**:只讀 scope 對應層級的文檔(見各 scope);已 closed 的 bugfix 除非必要否則不載入
4. 發現一律**依嚴重度排序**在對話中回報:每條附具體檔案與程式碼位置、違反了哪條契約/原則、建議動作
5. **視情況產生後續文檔(先詢問開發者)**:確定的缺陷 → 建議走 `/bugfix`;改善機會 → 建議走 `/spec-design`(enhance 模式,需要完整 scope 討論與介面表,不在本 skill 內草率建檔)。開發者只要「先記下來」時,才由本 skill 直接建立對應的 B/E 文檔(遵守 conventions 的編號規則與 `frontmatter.md` 的規格,`status: open`,內文附本次發現的分析依據)
6. 本 skill **不修改程式碼**,也不改架構文檔(發現文檔該改時,列出差異建議開發者走對應 design skill)

### Scope: system — 全域架構檢測

讀 `.design/system.md` + 各子系統 `design.md` 的「對外契約」章節,對照整個程式碼庫檢查:

1. **子系統循環依賴(Circular Dependency)**:從程式碼的 import/引用關係建出子系統間的依賴圖,檢查有無環;有環就指出環上的每一邊(哪個檔案引用了哪個檔案)與建議的切法(introduce interface / 事件反轉 / 搬移職責)。跑過 `scan-graph.mjs` 時,依賴矩陣與環已經算好了——但**每一條要寫進發現的邊都要打開它給的 `檔案:行號` 確認引用真的存在**(圖會過期);沒有圖就自己從 import 關係建圖
2. **對外 I/O 契約完整性**:system.md 定義的最外層 Input/Output 規格,程式碼是否完整實作?有無程式碼暴露了契約沒寫的對外介面(未登記的 endpoint / CLI 參數 / 匯出符號)?
3. **通訊協定一致性**:子系統間實際的通訊方式是否與「通訊拓撲」一致(該走 Event Bus 的有沒有偷偷直接 call)?全域錯誤處理策略是否被各子系統遵守?
4. **抽象邊界檢查**:system.md 是否越界寫了 Level 2/3 的細節(私有函數、內部資料結構)?有就列出建議下放

### Scope: subsys — 子系統一致性檢測

讀 `.design/system.md` 的對應小節 + 該子系統 `design.md` 全文,對照該子系統的程式碼檢查:

1. **資料流管線一致性**:程式碼實際的資料流(輸入 → 驗證 → 業務處理 → 儲存/外部呼叫 → 輸出)是否符合 `design.md` 的 Pipeline 與上層主架構?有無跳段、繞道?
2. **單一職責(SRP)**:各模組是否只做 `design.md` 寫的那件事?有無模組偷偷長出第二職責?`scan-graph.mjs` 的「架構 hub」是本項的**候選清單**(連通度高 ≠ 有問題,只是值得先看),仍要讀原始碼判斷它多出來的連結是不是第二職責
3. **邊界外洩**:其他子系統是否繞過本子系統的對外契約直接存取內部模組?本子系統是否直接摸了別人的內部?內部型別/資料結構有無洩漏到公開介面?跑 `scan-graph.mjs --subsys <slug>` 可以拿到「別人進來 / 本子系統出去」的完整跨界引用清單當**待判清單**——腳本不知道什麼是契約,逐條對照 `design.md` 的對外契約章節判斷是不是外洩的人是你
4. **模組介面一致性**:程式碼的模組間呼叫是否走 `design.md` 定義的抽象 Interface?簽名是否漂移?
5. **抽象邊界檢查**:`design.md` 是否越界寫了私有實作細節?有就列出建議刪除(實作自主權)
6. **契約卡對帳**(有「Feature 契約卡」章節時):卡片寫的負責模組、Level 2 介面、資料流段落,與該 feature 實際落地的位置是否相符?卡片引用的介面條目在契約章節都找得到嗎?**這是 `/subsys-build` 委派品質的上游**——卡片與現實脫節,下一次委派就會照著錯的契約做
7. **知識歸屬**:同一個事實(設定值、狀態、換算規則、格式定義)有沒有兩個模組各存一份?有 → 指出應該由誰唯一持有,其他人怎麼改走介面拿(`boundary-rules.md`「知識歸屬」)
8. **未結的 spec-gaps**(存在 `spec-gaps.md` 時):每一條 `open` 的條目都代表有項目卡著沒做、或有人在等 spec 修訂。逐條檢查:那個項目在程式碼裡是真的空著,還是有人繞過協議自己補了實作或測試?後者一律列為發現(spec 沒改就先做,等於用實作定義了契約)

**本子系統跑過 `/subsys-build` 時**(存在 `build-log.md`):讀它的「待確認假設彙總」,逐條檢查那些假設在程式碼裡實際被怎麼落實、有沒有與契約牴觸;閘門裁決為「要改」但尚未處理的,列進發現。另讀「仲裁紀錄」:歸因為 **spec bug** 的每一條,確認 spec 後來真的被修過(文檔 `updated` 有動、對應條文有變),沒修就繼續往下跑的,是本流程最嚴重的違規。再從「自裁清單」抽 2-3 條「抽查」欄還留白的(不足就全看):讀對應程式碼,判斷當初「這是實作層級」的自答成不成立——答案其實出現在邊界上的,列為發現、在該列「抽查」欄填「裁錯層級」,並建議收緊委派的層級門檻

### Scope: feature — 功能實作審查

讀該 feature 文檔全文 + 所屬 `design.md` 的相關介面定義,對照該 feature 的實作程式碼檢查:

1. **Level 2 介面符合度**:實作的公開介面是否逐一符合 `design.md` 定義的 Interface 與 DTO(簽名、型別、錯誤語意)?文檔「新增的介面」與程式碼是否一致?
2. **Edge cases**:邊界條件有無遺漏(空值、零長度、極大值、並發、時序)?逐條列出「輸入/狀態 → 現在會發生什麼 → 應該發生什麼」
3. **例外處理**:錯誤路徑是否完整(捕捉、傳播、資源釋放)?是否符合全域錯誤處理策略?
4. **型別安全**:有無 any/interface{}/未檢查的轉型、隱式轉換、nullable 未處理?
5. **Laws / Examples 與測試對照**:spec 的每一條 law 是否都有對應的 property test、每個 example 是否都有對應的 example test(對照表在測試檔頂端)?有沒有 spec 沒定義、卻被測試斷言的行為(qa 腦補)?反過來,有沒有 law 寫了卻沒人測?
5b. **骨架符合度**:程式碼的簽名與型別定義,與 spec「介面」/「數據」表的原文是否逐字相同?impl 改過骨架簽名 = 偷改契約,列為最高嚴重度
6. **待確認假設**(文檔有這一段時,代表本 feature 由 `/subsys-build` 委派產出):逐條檢查每個假設在程式碼裡實際採取了什麼、是否與 Level 2 契約牴觸、是否需要升級成正式的契約決定。**委派產出的文檔要優先看這一段**——它就是「沒有人在旁邊時 AI 自己做的判斷」清單
7. **邊界與依賴**:本 feature 新增的 import 方向,文檔的「相依性」/介面表有沒有登記?沒登記 = 未申報的架構變更。核心層有沒有混進表現層 / 前端 / 測試的概念?有沒有為測試開的後門(test-only export、setter、繞過正常流程的建構子)?後門一律列為介面設計缺陷
8. **內部實作不評分**:私有函數命名、內部結構選擇屬實作自主權,不列為發現(除非違反上述任一項)

---

## 收尾

- status scope:摘要整體進度(done/總數、各子系統進度、契約卡就緒度、待展開 feature 數、不一致數),建議下一步命令(契約卡滿格的子系統可提 `/subsys-build` 委派展開)
- 分析型 scope:摘要發現數量(依嚴重度)、最關鍵的前幾條、建議的後續文檔(走 `/bugfix` 或 `/spec-design` 的清單)
- 兩種 scope 最後都輸出**定錨區塊**(`../_shared/anchor.md`):status scope 的數字直接取自剛跑的腳本,位置樹以開發者指定(沒指定就取進度最落後)的子系統為「所在」;分析型 scope 以被檢測的子系統/feature 為「目前」,本次發現裡屬於契約與程式碼不符的,照樣寫進偏離清單
