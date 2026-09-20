# 實作先行:spike-impl → law-design → qa → refactor → integrate

日期:2026-09-19
狀態:方向拍板,規章未動
範圍:dev-flow 與 lawful 兩個 plugin 的設計與建構流程

---

## 0. 一句話

需求 Law 先講好,其餘都等程式碼跑通了再講。先用實作貫通一條垂直切片,再對著跑得動的東西與開發者逐條談 Law,qa 只讀文檔寫測試,測試涵蓋到哪裡,這份功能的承諾就到哪裡。

## 1. 為什麼改

- 文檔前置的前提是「寫文檔比寫程式碼便宜」。實作成本被壓到接近文檔之後,前提不成立。
- 一直被重寫的是簽名、步驟拆法、層,也就是做了才知道的東西;需求 Law 幾乎不動。流程逼人先猜做了才知道的東西。
- 「impl 發現做不到 → 改 Law → 重寫 qa → 重寫 impl」這條鏈,在可行性先被驗過之後整條消失。
- 開發者看到跑得動的行為,才答得出要什麼、不准什麼。

## 2. 流程

| 步驟 | 角色 | 輸入 | 產出 | 離場條件 |
|---|---|---|---|---|
| 1 | spike-impl | 一個目標的一條里程碑(R-x-O-y 的 M-n)、需求 Law、全域 Law(§4) | 跑通的程式碼、決策檔(§5);從這一步開 worktree | 跑得通、`lint boundary` 綠、領域不變量那套測試綠、決策檔填完 |
| 2 | law-design | 切片、決策檔、需求 Law | 一份或多份 feature / pipeline 文檔(一份講一件使用者做得到的事),Steps 的簽名抄程式碼裡定下來的那一個 | 每條 law 都過「寫得出讓它變假的實作」這一問,開發者逐條拍板,三道 lint 綠 |
| 3 | qa | 只讀文檔、最內層匯出、簽名;不讀實作 | 每條 law 一條 property test、每個 example 一條 example test | 測試編得過;開發者答「不准」的那幾條第一次跑是紅的 |
| 4 | refactor | 文檔、紅燈歸因;不讀寫測試 | 調整或重寫實作直到全綠 | 子集全綠、整套跑一次全綠 = 這條需求正式達成,可以被整合 |
| 5 | integrate | 多條達成的 worktree | 整合分支、ADR、PR | §6 |

- 步驟 3、4 由 build(conductor)指揮:law-design 收尾時自動接上,開發者不用另外下指令。
- 步驟 1 到 4 在同一條 worktree、同一條分支上,分支名 `build/M-n-<slug>`(§9)。`design/<全名>` 分支與設計 PR 退場(推翻 2026-09-16 的那條決定,2026-09-19 開發者確認)。
- 進 law-design 之前先把 main 合進 worktree 一次,Law 對著最新的全域 Law 談。
- 第一版切片是草稿。qa 之後整份重做是正常結果,不是失敗。
- 切片可以貫通到底、跨多個模組;文檔不跟著變大。一份文檔四十條 law 會變成打包追認,一條 REV 會解凍整個系統,併成一份就沒有平行可言。
- 探索失敗:worktree 丟掉,只把決策檔帶回 main。獨立的 spike skill 退場。

### law-design 怎麼談

候選 law 三個來源:從需求 Law 往下推;從切片的實際行為往上撈(決策檔「順手的」假設優先);軟體工程的常見性質(上下界、冪等、錯誤等價、來回一致、順序無關、單調)。兩邊對不上的地方就是題目。

一次一條,用切片跑出來的例子問:

```
現在的行為:SAVE10 套兩次,100 變 90 再變 81。
這是你要的、你不准的、還是你不在乎的?
```

- 要 → law。
- 不准 → law,而且目前的實作違反它(qa 的測試首跑應紅,取代骨架基線)。
- 不在乎 → 不寫、不測,之後可以自由改,不用開 REV。

判別敘述與 law:寫得出一個讓這句話變假的實作嗎。寫不出來就是在描述程式碼,不收。

## 3. 保留不動的

- 需求(R-n)與 Requirement Law、目標、里程碑、調整(RF-n):做之前就寫,流程不變。
- 修訂 frozen 的文檔:形狀已知,先改文檔再改碼,REV 流程不變。
- status、看板、audit、study:報告與 HTML 不變;狀態改由檔案推導(§7)。
- qa 不讀實作、refactor 不讀寫測試、開發者不手改任何文檔。

## 4. 全域 Law

不另立登記處,三類各住原本的地方:

| 類別 | 住哪裡 | 執行形式 | 現況 |
|---|---|---|---|
| 架構與純度(依賴單向、IO 只在最外層、顯式錯誤型別) | `system.md`「層」表、`modules.md`;lawful 是四層 | `lint boundary`、型別檢查 | 已有,補「顯式錯誤型別」 |
| 契約(冪等鍵、結構向後相容) | `system.md`「對外 I/O」表 | schema 驗證、contract test | 表已有,補契約欄 |
| 領域不變量(借貸相等、庫存非負、狀態機單向) | `system.md` 新的一節 | 長駐的 property test 套件 | 新的 |

准入四條(規矩,不是機制):

1. 只在兩個地方出生:立案,與 integrate 的仲裁。spike-impl 與 law-design 不准新增。
2. 只引用最內層的共用型別。提到某份 feature 的簽名就是 feature law。
3. 至少兩份 feature 違反得了它才收;只有一份違反得了就搬回那份 feature。
4. 一定有可執行形式。沒有就是 ADR,不是 Law。

瘦身的證據來源是決策檔的「Global Laws hit」欄:哪一條擋到了實作、擋得有沒有道理。

## 5. 決策檔

一條 worktree 一份,接替 `journal/<全名>.md`。全部是固定欄位的表,CLI 讀得快。integrate 吸收後刪檔(權衡升 ADR 或寫進 feature 的「決定」;假設已經變成 law),`.design` / `.lawful` 裡只留當下事實。

| 欄位 | 內容 | 誰讀 |
|---|---|---|
| Goal / Scope | 目標與里程碑編號、做了什麼、明確沒做什麼 | law-design |
| Entry | 怎麼把它跑起來看到行為,一道指令 | law-design 產生例子 |
| Trade-offs | 選了什麼、否決什麼、理由、可不可逆、跨不跨文檔 | integrate 判斷升不升 ADR |
| Assumptions & Invariants | 每條標「刻意的」或「順手的」 | law-design 的題目清單 |
| Faked / Unverified | 假資料、寫死的值、沒驗過的路徑 | refactor 的待辦;防止假的被當成達成 |
| Touched | 動到的模組、共用型別、新的對外 I/O | integrate 的衝突預報 |
| Global Laws hit | 哪幾條相關、哪一條擋到了實作 | 全域 Law 瘦身 |

## 6. integrate

- 條件:每條 worktree 自己宣稱達成;合併後整套跑一次,每一條 law(feature 的、需求的、全域的)仍然成立。
- 不改本體。合併後紅只歸因。
- ADR 在這一步寫:決策檔的權衡同時「跨文檔」且「不可逆」就升 ADR,其餘併進該 feature 的「決定」。
- 衝突的呈現用反例,不用文字比對:哪一個(縮小後的)輸入讓哪一條 law 測試變紅、A 的 law 說應該是什麼、B 的程式碼算出什麼、兩邊各依哪一條 invariant。
- 仲裁三個選項,一次一條問開發者:
  - 以 A 為主:B 的 worktree 退回 law-design → qa → refactor。
  - 收窄定義域:兩條 invariant 各自的 forall 排除對方的情境(例:金額不為負,排除退款單),兩邊都不用重做。
  - 提煉上層 Law:寫全域 Law 與 ADR,兩條 worktree 都退回 qa → refactor。integrate 不現場合併邏輯。

## 7. 狀態由檔案推導

| 看到什麼 | 代表 |
|---|---|
| 只有決策檔 | 切片完成 |
| 文檔有 law、沒有對應的測試 | Law 已定 |
| 有測試、有紅 | 調整中 |
| 全綠 | 達成,可整合 |

## 8. 對 skill 的影響

| 現在 | 之後 |
|---|---|
| dev-flow:spike、dev-flow:impl / lawful:spike、lawful:impl | `spike-impl` |
| dev-flow:feature / lawful:pipeline(簽名先行 + 骨架) | `law-design`(對著切片訪談 Law);骨架這個概念退場 |
| dev-flow:refactor(抽 abstract 的收整) | 收整改名 `abstract`;`refactor` 改指「依 law 測試調整或重寫實作」的角色 |
| build(conductor) | 後半段的 conductor:law-design 收尾時自動接上,派 qa、跑首跑基線、派 refactor、跑子集、仲裁四分流、全綠後跑整套一次、確認每條 law 成立才算達成;不再開分支(worktree 由 spike-impl 開)、不再對帳骨架 |
| integrate | 加仲裁與 ADR;仍是唯一發 PR 的出口;設計分支那條路退場 |
| project / design | ADR 不在立案時寫;多一節領域不變量;對外 I/O 表補契約欄 |
| qa、revise、objective、status、audit、study | 角色不變;引用到骨架、設計分支、spike 的句子跟著改 |
| CLI:`lint sig`、`claim`、`status`、`migrate`、`objective milestone` | `lint sig` 照舊對帳(程式碼先在,更容易過);status 加 §7 的推導與決策檔解析;spike 子命令退場;`objective milestone` 多收一個英文 slug;`claim` 配號時把其他 worktree 的文檔也算進最大號 |
| 模板:`spike.md`、`journal.md` | 退場,換成決策檔模板 |
| tests/ 夾具與 golden | 隨規章重產,PR 說明為什麼變 |

## 9. 開工前的七項(2026-09-19 開發者逐項拍板)

1. **後半段由 build 指揮。** law-design 是與開發者的對談;收尾時自動接上 build,build 派 qa、派 refactor、仲裁、確認每條 law 成立。兩種性質不塞進同一份 skill。
2. **分支以里程碑為鍵,帶英文名。** 里程碑現在只有 `M-n` 與一句中文,沒有英文名;里程碑表多一欄 slug,全名 `M-n-<slug>`(`M-n` 本來就全資料夾唯一,不必再帶 R-x-O-y),分支 `build/M-n-<slug>`。slug 由 `devflow objective milestone` / `lawful objective milestone` 收。
3. **決策檔沿用 journal。** `journal/M-n-<slug>.md`,整合後吸收並刪檔;探索失敗只帶這一份回 main。
4. **收整改名 `abstract`。** `refactor` 這個名字給「依 law 測試調整或重寫實作」的角色。
5. **文檔編號撞號在 claim 時就避開。** 查過現況:integrate 只處理 GAP 撞號(後合的往上移);文檔同號是 `lint ids` 紅,沒有自動改號。文檔改號要連檔名、測試歸屬字串、綁定欄一起改,代價高,所以不在 integrate 補救,改成 `claim` 配號時把 `git worktree list` 每一棵樹的文檔都算進最大號。號段行(多人)照舊優先。
6. **lawful:module 保留。** 成為 spike-impl 途中可以呼叫的一步:切片要一個還沒有的模組單元時先跑它。
7. **既有專案的樹怎麼變合規**(開發者未特別回應,照傾向):只寫在 `migrate` 與叫人去跑它的那一句。

## 10. dev-flow 落地紀錄(2026-09-19,分支 feat/dev-flow-impl-first,未 commit)

開發者開工後追加的四項(同日拍板):

- **決策紀錄的定義**:`journal/<鍵>.md` 是「為了達成這條里程碑的 Goal / Scope 而產生的實作決策紀錄」,不是執行中的流水帳;運行單位是里程碑,所以節名是 Goal / Scope,frontmatter 沒有 objective 欄。「Decisions」表一列一個決定:Decision / Reason / Constraint(加否決、可逆、跨文檔)。原本獨立的「Global Laws hit」併進 Constraint 欄;「建構」改名「Verification」。
- **達成後的狀態叫 `verified`**:qa 與 refactor 做完、每條 law 都有會失敗而現在通過的測試守著,conductor 改 `verified`;要改先「重開」回 `ready`。CLI 讀到 `frozen` 當成 `verified`(靜默容忍,規章不提)。
- **integrate 的核心**:Integration MUST NOT reduce Law satisfaction。
- **每個階段一句核心**:roles.md「五個階段」表多一欄,每份 SKILL.md 的標題底下一句;步驟與核心衝突時核心贏。

落地時我自己定的(實作級,回報過):

- 立案與目標的變更走 `plan/<slug>` 分支發 PR:設計分支退場後,`system.md` / `objectives/` 的變更仍要經 PR 進主線,切片才開得了。
- 骨架這個概念退場,但 adapter 的標記留下來,改叫「未實作標記」,只用在 `dev-flow:revise` 新增的 step(首跑要看得出紅燈打到哪個 step)。
- 每個目標一次只開它下一條還沒達成的里程碑;平行來自不同目標。
- 全域 Law 的架構類只有層的兩條規則(`lint boundary`);「顯式錯誤型別」沒有做成 lint,由各 feature 的 `total` law 承接。
- 契約欄寫的是守這一端的 law(`F-00x#LAW-n` 或 `INV-n`),不是一句話。
- 領域不變量、需求與目標的 Law 立案時只有一句話;簽名出現的那條切片,law-design 把它寫成三行(不改那一句話),build 派 qa 寫驗收測試。
- 看板模板與 lawful 共用、逐位元組相同,這次沒動:看板上未實作的 step 仍顯示「骨架 n」,等 lawful 一起改。
- `migrate objectives` 順手替只有編號的里程碑補英文名(從第一份綁定的 feature 推)。

還沒做:lawful 的同一套改動;`docs/skill-authoring.md` 是歷史紀錄,沒動。

## 11. Law 只剩「不得違反」(2026-09-20 開發者拍板,同一條分支,未 commit)

開發者的定義:**Requirement 是必須達成,Law 是不得違反。** 照這一句把詞與機制收斂:

| 決定 | 落地 |
|---|---|
| Requirement Law 不是 Law,換名 | 需求附一句「驗收」(`- 驗收:…`),驗收測試歸屬 `R-n#ACCEPT`(識別字 `r_n__accept`);status 講「達成 / 未達成 / 未知」。CLI 靜默把 `- Law:` 與 `R-n#LAW` 讀成同一件事 |
| Objective Law 拿掉 | 目標只答 What / Which;目標達成 = 里程碑全部達成;需求沒有驗收測試時由「每個目標都達成」推得。蘊含說明、`O-n#LAW`、`build O-n`、`objective add --law` 全部退場 |
| Global Law 只有三類,而且在 system.md 看得出約束住在哪一區 | `system.md` 新增「## 全域 Law」區,底下三個小區:`### 領域不變量`、`### 架構:層`、`### 契約:對外 I/O`;節序改成 願景 / 需求 / 全域 Law / 語言與工具 / Features |
| 以約束 Law 為單位管理與 lint 自動確認 | 每類一道 lint:`lint invariants`(新,從 lint laws / trace 拆出來)、`lint boundary`、`lint io`;`lint global` 三道一次查完;status 報告有「全域 Law」表(三類各自的結果、契約欄指到的 law 幾條成立),三類的紅各成一條警訊 |
| Feature / Abstract 的 law 叫 scope law | features.md 新增「Law 與需求」一節:需求、全域 Law、scope law 三個詞各住哪、誰判;law 只住兩個地方;ADR 不是 law |
| law-design 只設計 scope law | 它只能把既有的一句話(需求的驗收、領域不變量)寫成三行,不新增、不改、不放寬全域 Law |
| 全域 Law 的變更 | 「任何 Global Law 的修改、放寬、替換或刪除,都必須經 Developer 明確批准;integrate 只能提出變更建議,不得自行決定變更。」「integrate 不直接修改 Global Law;經批准的 Global Law change 由 revise 完成,完成後重新驗證受影響的工作。」兩句原文進了 features.md「全域 Law」、roles.md「整合」、integrate 與 revise 的 SKILL.md、README 與兩份 description。仲裁的「提煉上層 Law」也改成 integrate 提建議、revise 落筆 |
| revise 必須攤影響範圍、強制給選項 | features.md「影響範圍與選項」:六項(直接動到、引用同一處的 law、連動的文檔、測試、狀態、需求),至少兩個選項且一定含「不改」,開發者明確選了才落筆;revise 的核心句改成這一條 |
| 既有的樹怎麼換 | `devflow migrate laws [--write]`:三節收進「全域 Law」區、需求的 `- Law:` 改 `- 驗收:`、蘊含與目標檔的 `- Law:` 刪掉;status 對沒有「全域 Law」區的樹列警訊指到它。夾具就是用它轉的 |

我自己定、已回報的:驗收這個詞與 `R-n#ACCEPT` 標記;全域 Law 的變更走 `plan/<slug>` 分支(與立案的變更同一條路),ADR 仍由 integrate 在收那條分支時寫;看板模板改成優先用 JSON 給的 `note`(兩個 plugin 的模板同步改、逐位元組相同),dev-flow 的看板因此不再出現「Law 成立」;CI 契約腳本多跑 `lint invariants`,「寫了三行卻沒有測試」只印不擋。

lawful 還沒做:它仍是 Requirement Law / Objective Law 的體系,改的時候照這一節。
