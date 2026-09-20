# law

law 是**不得違反**的約束;需求是**必須達成**的事,不是 law。這一份講 law 的兩種範圍各住哪裡、誰定、怎麼談、怎麼改:全域 Law 住 `system.md` 的「全域 Law」區,scope law 住一份 feature 或 abstract 的「Laws」節。law 在文檔裡怎麼寫(三行式、種類、編號)見 features.md「節」「什麼要有 law」。

## Law 與需求

兩棵樹,各管各的:**需求面是必須達成,約束面是不得違反。** 判準只有一題:**這件事有沒有做完的一天?有 = 需求,沒有 = law。**

| | 需求面(必須達成) | 約束面(不得違反) |
|---|---|---|
| 層 | 願景 → 需求 `R-n` → 里程碑 `M-n-<slug>`(features.md「願景、需求與里程碑」) | 全域 Law → scope law |
| 判準 | 有做完的一天 | 沒有做完的一天,永遠要守 |
| 誰談 | `dev-flow:require-design` | 全域 Law:`dev-flow:glaws-revise`;scope law:`dev-flow:law-design` |
| 怎麼驗 | 需求的驗收(`R-n#ACCEPT` 測試);沒有測試時由里程碑全部達成推得(features.md「完成度」) | 每條 law 一條會失敗而現在通過的測試;架構與契約另有 lint |

約束只有兩種範圍:

| 詞 | 意思 | 住哪裡 | 誰判 |
|---|---|---|---|
| 全域 Law(Global Law) | **不得違反**的約束,整個專案每一行程式碼都要守,從 `dev-flow:spike-impl` 的第一行起 | `system.md`「全域 Law」區,三類各一小區 | 每類一道 lint,`devflow lint global` 一次查完;領域不變量另有 `INV-n#LAW` 測試 |
| Scope Law | **不得違反**的約束,範圍是一份文檔:只約束那一份的 Steps。規章裡單寫 law,指的就是它 | 那份 feature 或 abstract 的「Laws」節 | 歸屬 `F-00x#LAW-n` / `A-00x#LAW-n` 的測試 |

- **任何程式碼都受全域 Law 加上它自己那份文檔的 scope law 約束。** 沒有第三種約束,也沒有哪一段程式碼不受全域 Law 管。
- **law 只住這兩個地方。** 需求、里程碑、決策紀錄、GAP、ADR 裡都沒有 law;**里程碑不管理約束**:它沒有 law、沒有測試標記。決策紀錄的「Assumptions & Invariants」是談 law 的原料,開發者拍板寫進「Laws」節之前不是 law。
- **law 不必朝向需求。** 文檔經由里程碑的綁定欄朝向需求;一條 scope law 不必指得出它滿足哪條需求。
- **誰定哪一種**:`dev-flow:law-design` 是 scope law 的唯一入口,由它對著 `dev-flow:spike-impl` 做出來的切片與開發者談出來,`dev-flow:build` 帶 qa 與 refactor 讓它成立;既有文檔的 law 要改也回到它。全域 Law 的每一條由開發者定,第一次定義三區與之後的每一次變更,由開發者提出、或由 `dev-flow:integrate` 提出建議而開發者批准,一律由 `dev-flow:glaws-revise` 落筆(「全域 Law 的變更」)。
- ADR 不是 law,記的是「為什麼」。ADR 的決定寫得成可執行形式(測試、lint、型別約束)時,約束進全域 Law,ADR 只留理由;寫不成的只留在 ADR(features.md「ADR」)。

## 全域 Law

整個專案任何一條切片、任何一份 feature 都**不得違反**的約束。`dev-flow:spike-impl` 開工就讀它、離場前就要過它。它住 `system.md` 的「## 全域 Law」區:約束住在哪裡,打開 `system.md` 就看得到。分三類、各一小區,各有一道 lint 自動確認;`devflow lint global` 三道一次查完,`devflow status` 的「全域 Law」表印每一類現在的結果:

| 類別 | 住「全域 Law」區的哪一小區 | 自動確認 |
|---|---|---|
| **領域不變量**:領域裡永遠為真的事(錢不憑空產生、庫存不為負、狀態不倒退) | `### 領域不變量` | `devflow lint invariants`(編號、種類、三行只引用最內層、寫了三行就有測試),與歸屬 `INV-n#LAW` 的 property test,長駐在整套測試裡 |
| **架構**:依賴方向與副作用的邊界 | `### 架構:層`,配 `modules.md`(boundary.md「層」的兩條規則) | `devflow lint boundary` |
| **契約**:跨過對外邊界的資料要守什麼 | `### 契約:對外 I/O` 的信任、驗證與契約欄(boundary.md「對外 I/O」) | `devflow lint io`,與契約欄指到的那條 law 的測試 |

```markdown
## 全域 Law
### 領域不變量
- INV-1 [bound] 任何一條路徑結算出來的金額都不為負
  - forall ls in MoneyList, d in Money
  - given settled(settle(ls, d))
  - |- cents(settle(ls, d)) >= 0
```

- 第一行 `INV-n [種類] 一句話`,種類與三行式照features.md「節」的 Laws;**三行的識別字只准是最內層的匯出、型別名與標準函式庫名**,`lint invariants` 對帳。提到某一份 feature 的 Steps 簽名,它就是那份 feature 的 scope law,不是領域不變量。
- 只由測試判:有歸屬 `INV-n#LAW` 的測試就以它綠 / 紅為準;寫了三行卻沒有測試、或還只有一句話,都是「未知」,`devflow status` 列警訊、exit 1。第一次定義時最內層的型別還沒出現,先只留一句話;型別出現的那條切片,`dev-flow:law-design` 把它寫成三行(不改那一句話),`dev-flow:build INV-n` 派 qa 寫測試(roles.md「驗收測試」)。
- 准入四條,守住它不膨脹,新開的切片才不會被綁死:
  1. **只由開發者批准而出生**:`dev-flow:glaws-revise` 的對談(立案後第一次定義三區,或之後開發者自己提的),或整合的仲裁提出建議、開發者批准(`dev-flow:integrate` 把兩條互斥的 law 提煉成上層的一條),同樣由 `dev-flow:glaws-revise` 落筆。`dev-flow:spike-impl` 與 `dev-flow:law-design` 不新增。配號只走 `devflow invariant add`。
  2. **只引用最內層共用的東西**(上面那一條)。
  3. **至少兩份 feature 違反得了它才收**;只有一份違反得了的,搬回那一份 feature 當它的 scope law。
  4. **一定有可執行形式**:寫不成測試、lint 或型別約束的跨文檔決定是 ADR,不是 law。

**變更**:

- **任何全域 Law 的修改、放寬、替換或刪除,都必須經開發者明確批准;`dev-flow:integrate` 只能提出變更建議,不得自行決定變更。** 新增也一樣。「明確」= 開發者對著那一條、那一個選項說了要;沉默、整批同意、「你決定」都不算。
- **`dev-flow:integrate` 不直接修改全域 Law;經批准的變更由 `dev-flow:glaws-revise` 完成,完成後重新驗證受影響的工作**(「影響範圍與選項」「全域 Law 的變更」)。
- 變更建議的材料是決策紀錄「Decisions」表的 Constraint 欄:哪個決定是被哪一條全域 Law 逼出來的、逼得有沒有道理。`dev-flow:integrate` 整合時彙整進 PR;它讓合併過得去最省事的辦法就是把 law 改鬆,所以建議一定附反例、選項與各自的代價,由開發者選。

## Law 怎麼談

scope law 是對著跑得通的切片談出來的:開發者看得到行為,才答得出要什麼、不要什麼。`dev-flow:law-design` 的對談照這一節;它只設計 scope law,不新增、不改全域 Law。

候選 law 三個來源,兩邊對不上的地方就是要問的題目:

| 來源 | 怎麼找 |
|---|---|
| 從上往下 | 這條里程碑那一句話要展示得出來、它的需求的驗收要過,這份 feature 的 `=` 列至少得保證什麼;碰得到的全域 Law 在這裡長什麼樣 |
| 從下往上 | 切片現在實際的行為:決策紀錄「Assumptions & Invariants」每一列,來源寫「順手」的優先問;「Faked / Unverified」每一列真的該是什麼 |
| 軟體工程的常見性質 | 對每個 step 過一次 features.md「什麼要有 law」的兩問,再拿 features.md「節」的種類表逐種問 |

來源只是找候選的方向;收不收一條 law 看開發者要不要這個承諾,不看它對不對得到某條需求。

**一次一條,用切片跑出來的例子問**,不問抽象的性質:

```
現在的行為:SAVE10 套兩次,100 變 90 再變 81。
這是你要的、你不准的、還是你不在乎的?
```

| 開發者的答案 | 怎麼處理 |
|---|---|
| 要 | 寫成 law;切片現在就滿足它,qa 的測試首跑應該綠 |
| 不准 | 寫成 law,law 講的是不准之後該成立的事;切片現在違反它,qa 的測試首跑應該紅(roles.md「首跑」)。它的全名記進決策紀錄「Verification」的「首跑該紅」,conductor 靠它驗首跑 |
| 不在乎 | 不寫、不測。它不是承諾,實作之後可以自由改,不必開 REV;哪一天要承諾了再走 `dev-flow:law-design` 補一條(既有文檔要改的那一種情形) |

- **寫得出一個讓這句話變假的實作,才是 law。** 寫不出來,那一句只是在描述程式碼現在做了什麼(「呼叫 repo 查折扣碼再乘上折數」);qa 照它寫出來的測試是同義反覆,程式碼怎麼寫它怎麼過。對談時每條候選都講出那個反例實作,講不出來就不收。
- law 寫的是「以後要一直成立什麼」,不是「現在做了什麼」;識別字與三行式照features.md「節」的 Laws。
- 答「不准」而現有的型別裝不下(購物車沒有地方記套過哪些碼):當場與開發者定型別要多什麼,`dev-flow:law-design` 把型別的宣告改到位、編得過;行為留給 refactor。型別與簽名歸設計這一側,本體歸 refactor(roles.md「分支與所有權」)。
- 開發者逐條拍板,不整批追認;一份文檔的 law 多到談不完,就是這份切得太大,拆成兩份。
- 談的過程中冒出來、卻不屬於這份 feature 的(別份的行為、整個專案的規則),記在回報裡,不寫進這份;整個專案的規則是給開發者的全域 Law 變更建議,批准了由 `dev-flow:glaws-revise` 落筆(「全域 Law」)。

## 影響範圍與選項

調整任何一條 law 之前,先把**影響範圍**攤給開發者,再給**選項**;開發者選了才落筆。scope law 由 `dev-flow:law-design` 攤,全域 Law 由 `dev-flow:glaws-revise` 攤。沒有影響範圍、沒有選項的 law 調整不准落筆,來源是 GAP、整合的仲裁或開發者自己的話都一樣。

影響範圍逐項列,查過而沒有的寫「無」,不准省略一項:

| 項 | 列什麼 |
|---|---|
| 直接動到 | 哪幾條 law 的哪一行變、哪幾條簽名或型別變 |
| 引用同一處的 law | 同一份文檔裡引用同一個 step 或觀察點的每一條 law;全域 Law 則是契約欄指到它的每一列對外 I/O、三行裡用到同一個最內層匯出的每一條領域不變量 |
| 連動的文檔 | 引用這份 abstract 的每一份消費者、Steps 表引用到動到的簽名的每一份文檔;全域 Law 則是違反得了它的每一份 feature |
| 測試 | 要重寫的(歸屬全名)、要重跑的、確定不受影響的 |
| 狀態 | 哪幾份 `verified` 要重開;哪幾條建構中的 build 分支要重驗(`devflow status` 建構中那幾行) |
| 需求 | 哪幾條需求的驗收引用到動到的 law;改完之後它還達不達成 |

選項至少兩個,其中一個一定是「不改」。每個選項寫:改什麼、影響範圍裡哪幾項因此不同、當下成本、之後的代價、可不可逆。conductor 給傾向與理由,開發者拍板;選了哪個、否決了哪幾個,寫進 REV 的依欄與文檔的「決定」。

## 全域 Law 的變更

全域 Law 不住任何一份 feature,它的每一次落筆都在 `system.md` 的「全域 Law」區,都由 `dev-flow:glaws-revise` 做,同樣先過「影響範圍與選項」:

- **第一次定義**:立案之後三區還是模板,`dev-flow:glaws-revise` 逐區與開發者談(領域不變量、架構的層、契約的對外 I/O);領域不變量走 `devflow invariant add`,每條過准入四條(「全域 Law」)。此時沒有既有文檔,影響範圍各項寫「無」;選項照樣給,一定含「不立這一條」。
- **之後的變更**(新增、修改、放寬、替換、刪除),來源只有兩種:開發者自己提的,或 `dev-flow:integrate` 的變更建議經開發者明確批准(GAP 記著反例與批准的選項)。沒有批准就不動。
- 與立案、需求的變更走同一條路:`plan/<slug>` 分支,由 `dev-flow:integrate` 經 PR 合進主線(roles.md「分支與所有權」)。新增走 `devflow invariant add`;修改、放寬、替換、刪除直接改那一條。編號不重用,刪掉的號永久空缺。
- **改完重新驗證受影響的工作**:領域不變量的句子或三行變了,它原本的測試作廢,`dev-flow:build INV-n` 重派 qa;`devflow lint global` 沒有紅;影響範圍裡每一份 `verified` 文檔重跑它的子集測試,紅的重開、各走一條 REV(`dev-flow:law-design`);建構中的分支合進新的主線之後,從首跑起重跑。
- 這條變更由 `dev-flow:integrate` 收進 PR,並留一條 ADR 記為什麼(features.md「ADR」)。
