# law

law 是**不得違反**的約束;需求是**必須達成**的事,不是 law。這一份講 law 的兩種範圍各住哪裡、誰定、怎麼談、怎麼改:全域 Law 住 `Cone.md` 的「全域 Law」區,scope law 住一條 pipeline 的「Laws」節。law 在文檔裡怎麼寫(三行式、種類、編號)見 pipelines.md「節」「什麼要有 law」。

## Law 與需求

兩個詞不混用:**需求是必須達成,law 是不得違反。**

| 詞 | 意思 | 住哪裡 | 誰判 |
|---|---|---|---|
| 需求(Requirement) | **必須達成**的事。不是 law:做到之前它本來就還沒達成,切片進行中它未達成不算違反 | `Cone.md`「需求」,每條附一句驗收 | 驗收測試 `R-n#ACCEPT`;沒有就由建置路線推(pipelines.md「完成度」) |
| 全域 Law(Global Law) | **不得違反**的約束,整個專案任何一條切片、任何一條 pipeline 都要守,從第一行程式碼起 | `Cone.md`「全域 Law」區,三類各一小區 | 每類一道 lint,`lawful lint global` 一次查完;領域不變量另有 `INV-n#LAW` 測試 |
| Scope Law | **不得違反**的約束,範圍是一條 pipeline:只約束那一條的 Stages。規章裡單寫 law,指的就是它 | 那條 pipeline 的「Laws」節 | 歸屬 `P-00x#LAW-n` 的測試 |

- **law 只住這兩個地方。** 目標、里程碑、決策紀錄、GAP、ADR 裡都沒有 law。決策紀錄的「Assumptions & Invariants」是談 law 的原料,開發者拍板寫進「Laws」節之前不是 law。
- **誰定哪一種**:`lawful:law-design` 只設計 scope law。全域 Law 在立案(`lawful:project`)由開發者定;之後的每一次變更,由開發者提出、或由 `lawful:integrate` 提出建議而開發者批准,一律由 `lawful:revise` 落筆(「全域 Law 的變更」)。
- ADR 不是 law,記的是「為什麼」。ADR 的決定寫得成可執行形式(測試、lint、型別約束)時,約束進全域 Law,ADR 只留理由;寫不成的只留在 ADR(pipelines.md「ADR」)。

## 全域 Law

整個專案任何一條切片、任何一條 pipeline 都**不得違反**的約束。`lawful:spike-impl` 開工就讀它、離場前就要過它。它住 `Cone.md` 的「## 全域 Law」區:約束住在哪裡,打開 `Cone.md` 就看得到。分三類、各一小區,各有一道 lint 自動確認;`lawful lint global` 三道一次查完,`lawful status` 的「全域 Law」表印每一類現在的結果:

| 類別 | 住「全域 Law」區的哪一小區 | 自動確認 |
|---|---|---|
| **領域不變量**:領域裡永遠為真的事(實體 id 不重複、時間不倒退、存出去的東西讀得回來) | `### 領域不變量` | `lawful lint invariants`(編號、種類、三行只引用 types 層、寫了三行就有測試),與歸屬 `INV-n#LAW` 的 property test,長駐在整套測試裡 |
| **架構**:依賴方向與效果的邊界 | `### 架構:四層`,配 `modules.md` 的模組單元表(boundary.md「四層」「模組單元」) | `lawful lint boundary`;四棵原始碼樹各是一個子函式庫,相依方向另由編譯器擋 |
| **契約**:跨過 shell 的資料要守什麼 | `### 契約:對外 I/O` 的契約欄(boundary.md「對外 I/O」) | `lawful lint io`,與契約欄指到的那條 law 的測試 |

```markdown
## 全域 Law
### 領域不變量
- INV-1 [invariant] 任何一個世界裡實體 id 都不重複
  - forall w in World
  - |- nub (map entityId (entities w)) == map entityId (entities w)
```

- 第一行 `INV-n [種類] 一句話`,種類與三行式照 pipelines.md「節」的 Laws;**三行的識別字只准是 types 層的匯出、型別名與標準函式庫名**,`lint invariants` 對帳。提到某一條 pipeline 的 Stages 簽名,它就是那條 pipeline 的 scope law,不是領域不變量。
- 只由測試判:有歸屬 `INV-n#LAW` 的測試就以它綠 / 紅為準;寫了三行卻沒有測試、或還只有一句話,都是「未知」,`lawful status` 列警訊、exit 1。立案時 types 層的型別還沒出現,先只留一句話;型別出現的那條切片,`lawful:law-design` 把它寫成三行(不改那一句話),`lawful:build INV-n` 派 qa 寫測試(roles.md「驗收測試」)。
- 准入四條,守住它不膨脹,新開的切片才不會被綁死:
  1. **只由開發者批准而出生**:立案的對談(`lawful:project`),或整合的仲裁提出建議、開發者批准(`lawful:integrate` 把兩條互斥的 law 提煉成上層的一條)。`lawful:spike-impl` 與 `lawful:law-design` 不新增。配號只走 `lawful invariant add`。
  2. **只引用 types 層共用的東西**(上面那一條)。
  3. **至少兩條 pipeline 違反得了它才收**;只有一條違反得了的,搬回那一條 pipeline 當它的 scope law。
  4. **一定有可執行形式**:寫不成測試、lint 或型別約束的跨 pipeline 決定是 ADR,不是 law。

**變更**:

- **任何全域 Law 的修改、放寬、替換或刪除,都必須經開發者明確批准;`lawful:integrate` 只能提出變更建議,不得自行決定變更。** 新增也一樣。「明確」= 開發者對著那一條、那一個選項說了要;沉默、整批同意、「你決定」都不算。
- **`lawful:integrate` 不直接修改全域 Law;經批准的變更由 `lawful:revise` 完成,完成後重新驗證受影響的工作**(「影響範圍與選項」「全域 Law 的變更」)。
- 變更建議的材料是決策紀錄「Decisions」表的 Constraint 欄:哪個決定是被哪一條全域 Law 逼出來的、逼得有沒有道理。`lawful:integrate` 整合時彙整進 PR;它讓合併過得去最省事的辦法就是把 law 改鬆,所以建議一定附反例、選項與各自的代價,由開發者選。

## Law 怎麼談

scope law 是對著跑得通的切片談出來的:開發者看得到行為,才答得出要什麼、不要什麼。`lawful:law-design` 的對談照這一節;它只設計 scope law,不新增、不改全域 Law。

候選 law 三個來源,兩邊對不上的地方就是要問的題目:

| 來源 | 怎麼找 |
|---|---|
| 從上往下 | 這條里程碑的需求要達成(它的驗收要過),這條 pipeline 的 `=` 列至少得保證什麼;碰得到的全域 Law 在這裡長什麼樣 |
| 從下往上 | 切片現在實際的行為:決策紀錄「Assumptions & Invariants」每一列,來源寫「順手」的優先問;「Faked / Unverified」每一列真的該是什麼 |
| 純函數的常見性質 | 對每個 stage 過一次 pipelines.md「什麼要有 law」的兩問,再拿 pipelines.md「節」的種類表逐種問 |

**一次一條,用切片跑出來的例子問**,不問抽象的性質:

```
現在的行為:同一個世界存兩次,第二個檔比第一個多 8 個位元組(裡面有時間戳)。
這是你要的、你不准的、還是你不在乎的?
```

| 開發者的答案 | 怎麼處理 |
|---|---|
| 要 | 寫成 law;切片現在就滿足它,qa 的測試首跑應該綠 |
| 不准 | 寫成 law,law 講的是不准之後該成立的事;切片現在違反它,qa 的測試首跑應該紅(roles.md「首跑」)。它的全名記進決策紀錄「Verification」的「首跑該紅」,conductor 靠它驗首跑 |
| 不在乎 | 不寫、不測。它不是承諾,實作之後可以自由改,不必開 REV;哪一天要承諾了再走 `lawful:revise` 補一條 |

- **寫得出一個讓這句話變假的實作,才是 law。** 寫不出來,那一句只是在描述程式碼現在做了什麼(「先 `toSave` 再 `encode`」);qa 照它寫出來的測試是同義反覆,程式碼怎麼寫它怎麼過。對談時每條候選都講出那個反例實作,講不出來就不收。
- law 寫的是「以後要一直成立什麼」,不是「現在做了什麼」;識別字與三行式照 pipelines.md「節」的 Laws。
- 三行寫不出來,代表少一個觀察點(投影、存取子、效果描述的純解譯器):補 `o` 列並在程式碼裡匯出它(boundary.md「效果的判定」「測試與邊界」)。
- 答「不准」而現有的型別裝不下(存檔格式沒有地方記版本):當場與開發者定型別要多什麼,`lawful:law-design` 把型別的宣告改到位、編得過;行為留給 refactor。型別與簽名歸設計這一側,本體歸 refactor(roles.md「分支與所有權」)。
- 開發者逐條拍板,不整批追認;一條 pipeline 的 law 多到談不完,就是這條切得太大,拆成兩條。
- 談的過程中冒出來、卻不屬於這條 pipeline 的(別條的行為、整個專案的規則),記在回報裡,不寫進這條;整個專案的規則是給開發者的全域 Law 變更建議,批准了由 `lawful:revise` 落筆(「全域 Law」)。

## 影響範圍與選項

調整任何一條 law(scope law 或全域 Law)之前,`lawful:revise` 先把**影響範圍**攤給開發者,再給**選項**;開發者選了才落筆。沒有影響範圍、沒有選項的 law 調整不准落筆,來源是 GAP、整合的仲裁或開發者自己的話都一樣。

影響範圍逐項列,查過而沒有的寫「無」,不准省略一項:

| 項 | 列什麼 |
|---|---|
| 直接動到 | 哪幾條 law 的哪一行變、哪幾條簽名或型別變 |
| 引用同一處的 law | 同一條 pipeline 裡引用同一個 stage 或觀察點的每一條 law;全域 Law 則是契約欄指到它的每一列對外 I/O、三行裡用到同一個 types 層匯出的每一條領域不變量 |
| 連動的文檔 | 引用這條子流的每一條消費者、Stages 表引用到動到的簽名的每一條 pipeline;全域 Law 則是違反得了它的每一條 pipeline |
| 測試 | 要重寫的(歸屬全名)、要重跑的、確定不受影響的 |
| 狀態 | 哪幾條 `verified` 要重開;哪幾條建構中的 build 分支要重驗(`lawful status` 建構中那幾行) |
| 需求 | 哪幾條需求的驗收引用到動到的 law;改完之後它還達不達成 |

選項至少兩個,其中一個一定是「不改」。每個選項寫:改什麼、影響範圍裡哪幾項因此不同、當下成本、之後的代價、可不可逆。conductor 給傾向與理由,開發者拍板;選了哪個、否決了哪幾個,寫進 REV 的依欄與 pipeline 的「決定」。

## 全域 Law 的變更

全域 Law 不住任何一條 pipeline,它的變更落在 `Cone.md` 的「全域 Law」區,同樣先過「影響範圍與選項」:

- 來源只有兩種:開發者自己提的,或 `lawful:integrate` 的變更建議經開發者明確批准(GAP 記著反例與批准的選項)。沒有批准就不動。
- 與立案的變更走同一條路:`plan/<slug>` 分支,由 `lawful:integrate` 經 PR 合進主線(roles.md「分支與所有權」)。新增走 `lawful invariant add`;修改、放寬、替換、刪除直接改那一條。編號不重用,刪掉的號永久空缺。四層那四句與對外 I/O 表的變更同理,`modules.md` 跟著改到 `lawful lint boundary` 沒有紅。
- **改完重新驗證受影響的工作**:領域不變量的句子或三行變了,它原本的測試作廢,`lawful:build INV-n` 重派 qa;`lawful lint global` 沒有紅;影響範圍裡每一條 `verified` 的 pipeline 重跑它的子集測試,紅的重開、各走一條 REV;建構中的分支合進新的主線之後,從首跑起重跑。
- 這條變更由 `lawful:integrate` 收進 PR,並留一條 ADR 記為什麼(pipelines.md「ADR」)。
