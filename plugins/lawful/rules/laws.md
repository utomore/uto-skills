# law

law 是**不得違反**的約束;需求是**必須達成**的事,不是 law。這一份講 law 的兩種範圍各住哪裡、誰定、怎麼談、怎麼改:全域 Law 住 `Cone.md` 的「全域 Law」區,scope law 住一條 pipeline 的「Laws」節。law 在文檔裡怎麼寫(三行式、種類、編號)見 pipelines.md「節」「什麼要有 law」。

## Law 與需求

兩棵樹,各管各的:**需求面是必須達成,約束面是不得違反。** 判準只有一題:**這件事有沒有做完的一天?有 = 需求,沒有 = law。**

| | 需求面(必須達成) | 約束面(不得違反) |
|---|---|---|
| 層 | 願景 → 需求 `R-n` → 里程碑 `M-n-<slug>`(pipelines.md「願景、需求與里程碑」) | 全域 Law → scope law |
| 判準 | 有做完的一天 | 沒有做完的一天,永遠要守 |
| 誰談 | `lawful:require-design` | 全域 Law:`lawful:global-laws`;scope law:`lawful:scope-laws`(第一次談,與既有 law 的調整)、`lawful:scope-revise`(修訂時只新增) |
| 怎麼驗 | 需求的驗收(`R-n#ACCEPT` 測試);沒有測試時由里程碑全部達成推得(pipelines.md「完成度」) | 每條 law 一條會失敗而現在通過的測試;架構與契約另有 lint |

約束只有兩種範圍:

| 詞 | 意思 | 住哪裡 | 誰判 |
|---|---|---|---|
| 全域 Law(Global Law) | **不得違反**的約束,整個專案每一行程式碼都要守,從 `lawful:spike-impl` 的第一行起 | `Cone.md`「全域 Law」區,三類各一小區 | 每類一道 lint,`lawful lint global` 一次查完;領域不變量另有 `INV-n#LAW` 測試 |
| Scope Law | **不得違反**的約束,範圍是一條 pipeline:只約束那一條的 Stages。規章裡單寫 law,指的就是它 | 那條 pipeline 的「Laws」節;一個 stage 的 law 只住它住的那一條,引用它的 pipeline 不重寫(pipelines.md「編號與引用」) | 歸屬 `P-00x#LAW-n` 的測試 |

- **任何程式碼都受全域 Law 加上它自己那條 pipeline 的 scope law 約束。** 沒有第三種約束,也沒有哪一段程式碼不受全域 Law 管。
- **law 只住這兩個地方。** 需求、里程碑、決策紀錄、GAP、ADR 裡都沒有 law;**里程碑不管理約束**:它沒有 law、沒有測試標記。決策紀錄的「Assumptions & Invariants」是談 law 的原料,開發者拍板寫進「Laws」節之前不是 law。
- **law 不必朝向需求。** pipeline 經由里程碑的綁定欄朝向需求;一條 scope law 不必指得出它滿足哪條需求。
- **誰定哪一種**:一條 pipeline 的 scope law 第一次由 `lawful:scope-laws` 對著 `lawful:spike-impl` 做出來的切片、根據切片的決策紀錄與開發者談出來,`lawful:build` 帶 qa 與 refactor 讓它成立。既有 pipeline(含 `verified`)的任何一條**既有的 law 要調整**(修改、放寬、替換、刪除),只在 `lawful:scope-laws`,整件修訂由它一手做到 `verified`。既有的 law 一條都不動、`verified` 的 pipeline 的簽名、型別、模組、層或實作要變,走 `lawful:scope-revise`:它可以**新增** law(保護用的、效能的新上界、新 stage 的),不得修改、放寬、替換、刪除任何既有的 law(pipelines.md「修訂(REV)」)。全域 Law 的每一條由開發者定,第一次定義三區與之後的每一次變更,由開發者提出、或由 `lawful:integrate` 提出建議而開發者批准,一律由 `lawful:global-laws` 落筆(「全域 Law 的變更」)。
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
- 只由測試判:有歸屬 `INV-n#LAW` 的測試就以它綠 / 紅為準;寫了三行卻沒有測試、或還只有一句話,都是「未知」,`lawful status` 列警訊、exit 1。第一次定義時 types 層的型別還沒出現,先只留一句話;型別出現的那條切片,`lawful:scope-laws` 把它寫成三行(不改那一句話),`lawful:build INV-n` 派 qa 寫測試(roles.md「驗收測試」)。
- 准入四條,守住它不膨脹,新開的切片才不會被綁死:
  1. **只由開發者批准而出生**:`lawful:global-laws` 的對談(立案後第一次定義三區,或之後開發者自己提的),或整合的仲裁提出建議、開發者批准(`lawful:integrate` 把兩條互斥的 law 提煉成上層的一條),同樣由 `lawful:global-laws` 落筆。`lawful:spike-impl`、`lawful:scope-laws` 與 `lawful:scope-revise` 不新增。配號只走 `lawful invariant add`。
  2. **只引用 types 層共用的東西**(上面那一條)。
  3. **至少兩條 pipeline 違反得了它才收**;只有一條違反得了的,搬回那一條 pipeline 當它的 scope law。
  4. **一定有可執行形式**:寫不成測試、lint 或型別約束的跨 pipeline 決定是 ADR,不是 law。

**變更**:

- **任何全域 Law 的修改、放寬、替換或刪除,都必須經開發者明確批准;`lawful:integrate` 只能提出變更建議,不得自行決定變更。** 新增也一樣。「明確」= 開發者對著那一條、那一個選項說了要;沉默、整批同意、「你決定」都不算。
- **`lawful:integrate` 不直接修改全域 Law;經批准的變更由 `lawful:global-laws` 完成,完成後重新驗證受影響的工作**(「影響範圍與選項」「全域 Law 的變更」)。
- 變更建議的材料是決策紀錄「Decisions」表的 Constraint 欄:哪個決定是被哪一條全域 Law 逼出來的、逼得有沒有道理。`lawful:integrate` 整合時彙整進 PR;它讓合併過得去最省事的辦法就是把 law 改鬆,所以建議一定附反例、選項與各自的代價,由開發者選。

## Law 怎麼談

scope law 是對著跑得通的切片談出來的:開發者看得到行為,才答得出要什麼、不要什麼。`lawful:scope-laws` 的對談照這一節,`lawful:scope-revise` 在修訂裡新增的 law 也照這一節一次一條談定;兩者都只寫 scope law,不新增、不改全域 Law。

候選 law 三個來源,兩邊對不上的地方就是要問的題目:

| 來源 | 怎麼找 |
|---|---|
| 從上往下 | 這條里程碑那一句話要展示得出來、它的需求的驗收要過,這條 pipeline 的 `=` 列至少得保證什麼;碰得到的全域 Law 在這裡長什麼樣 |
| 從下往上 | 切片現在實際的行為:決策紀錄「Assumptions & Invariants」每一列,來源寫「順手」的優先問;「Faked / Unverified」每一列真的該是什麼 |
| 純函數的常見性質 | 對每個 stage 過一次 pipelines.md「什麼要有 law」的兩問,再拿 pipelines.md「節」的種類表逐種問 |

來源只是找候選的方向;收不收一條 law 看開發者要不要這個承諾,不看它對不對得到某條需求。

**第一次談一條 pipeline 的約束,四件事逐項問到**,每一項都從決策紀錄的「Decisions」「Assumptions & Invariants」「Faked / Unverified」「Touched」找這一片實際怎麼做的,拿它問開發者;哪一項這一片碰不到,也要問過才寫「無」:

| 項 | 問什麼 |
|---|---|
| 資料交互 | 這一片與別條 pipeline、別的模組單元之間交換什麼資料;誰是來源、誰只是讀;格式是 types 層哪個有名字的型別;驗證(smart constructor、解析)在哪一個 stage 做、下游可以假設什麼 |
| 資料儲存在哪 | 狀態住記憶體裡的值、檔案還是外部服務;哪一個效果描述寫它、哪一個只讀;兩處都存的以誰為準;寫到一半失敗、資料遺失時怎麼辦;純解譯器拿什麼當它的替身 |
| 外部串接方法 | 碰哪個外部系統、走什麼協定;它寫成哪個效果 ADT、真解譯器住 shell 的哪個模組;失敗、重試、逾時各怎麼處理;重送會不會做兩次;回來的內容信任誰、在哪個 stage 驗證 |
| 軟體架構 | 這一片的 stage 各住哪個模組單元的哪一層、依賴方向對不對;效果的描述集中在哪幾個 stage、`=` 列是不是純的;這一片用到的 stage 有沒有已經住在別條 pipeline 的——有就引用,不重寫;別條也會用到的那一段要不要拆成一條 subflow |

四項談出來的結論各有去處:

| 結論 | 去哪裡 |
|---|---|
| 這條 pipeline 要一直守的事,講得出一個讓它變假的實作 | 寫成這條的 scope law |
| 只關這條 pipeline 的取捨(為什麼存這裡、為什麼這樣接) | 這條的「決定」 |
| 碰到全域的:「全域 Law」區還沒講定的對外邊界(這一片接了一個沒講過的外部系統)或某一端的契約要變、四層那四句要變、整個專案都要守的規則 | 不寫進這條,也不動「全域 Law」區;列成給 `lawful:global-laws` 的變更提議(哪一條、為什麼、這一片的哪個決定逼出來的),由開發者決定要不要走。邊界已經講定的那幾端,這一片的入口與出口照 boundary.md「對外 I/O」補成表上的列,不算變更 |
| 這一片用到、已經住在別條 pipeline 的 stage | 這條的 Stages 表引用它(模組欄註明「見 <那條 pipeline 的全名>」),它的 law 不重寫;要對它多一條承諾,列成那一條的修訂(pipelines.md「修訂(REV)」),不寫進這條 |
**一次一條,用切片跑出來的例子問**,不問抽象的性質:

```
現在的行為:同一個世界存兩次,第二個檔比第一個多 8 個位元組(裡面有時間戳)。
這是你要的、你不准的、還是你不在乎的?
```

| 開發者的答案 | 怎麼處理 |
|---|---|
| 要 | 寫成 law;切片現在就滿足它,qa 的測試首跑應該綠 |
| 不准 | 寫成 law,law 講的是不准之後該成立的事;切片現在違反它,qa 的測試首跑應該紅(roles.md「首跑」)。它的全名記進決策紀錄「Verification」的「首跑該紅」,conductor 靠它驗首跑 |
| 不在乎 | 不寫、不測。它不是承諾,實作之後可以自由改,不必開 REV;哪一天要承諾了再補一條:pipeline 已經 `verified` 走 `lawful:scope-revise`(只新增 law),還在切片那一波走 `lawful:scope-laws` |

- **寫得出一個讓這句話變假的實作,才是 law。** 寫不出來,那一句只是在描述程式碼現在做了什麼(「先 `toSave` 再 `encode`」);qa 照它寫出來的測試是同義反覆,程式碼怎麼寫它怎麼過。對談時每條候選都講出那個反例實作,講不出來就不收。
- law 寫的是「以後要一直成立什麼」,不是「現在做了什麼」;識別字與三行式照 pipelines.md「節」的 Laws。
- 三行寫不出來,代表少一個觀察點(投影、存取子、效果描述的純解譯器):補 `o` 列並在程式碼裡匯出它(boundary.md「效果的判定」「測試與邊界」)。
- 答「不准」而現有的型別裝不下(存檔格式沒有地方記版本):當場與開發者定型別要多什麼,`lawful:scope-laws` 把型別的宣告改到位、編得過;行為留給 refactor。型別與簽名歸設計這一側,本體歸 refactor(roles.md「分支與所有權」)。
- 開發者逐條拍板,不整批追認;一條 pipeline 的 law 多到談不完,就是這條切得太大,拆成兩條。
- 談的過程中冒出來、卻不屬於這條 pipeline 的(別條的行為、整個專案的規則),記在回報裡,不寫進這條;整個專案的規則是給開發者的全域 Law 變更建議,批准了由 `lawful:global-laws` 落筆(「全域 Law」)。

## 影響範圍與選項

**要改的東西走哪裡,一句話分流:要調整(修改、放寬、替換、刪除)既有的 law → `lawful:scope-laws`;law 不動、或只新增 law,而文檔或實作要變 → `lawful:scope-revise`;全域 Law → `lawful:global-laws`;需求面的條目(需求、驗收、優先、里程碑)→ `lawful:require-design`。** GAP 的結案與靠修訂達成的里程碑(pipelines.md「願景、需求與里程碑」)也照這一句:既有的 law 不動、新的承諾用新增的 law 表達,走 `lawful:scope-revise`;要調整既有的 law 才做得到,整件走 `lawful:scope-laws`。**一件修訂從頭到尾只有一個修訂類的 skill 在跑,跑到 `verified` 為止**,不交錯、不接力。

調整任何一條 law 之前,先把**影響範圍**攤給開發者,再給**選項**;開發者選了才落筆。scope law 由 `lawful:scope-laws` 攤,全域 Law 由 `lawful:global-laws` 攤。沒有影響範圍、沒有選項的 law 調整不准落筆,來源是 GAP、整合的仲裁或開發者自己的話都一樣。

既有的 law 不動的修訂(`lawful:scope-revise`)攤同一張六項的表,請開發者確認之後才落筆:「直接動到」只准列簽名、型別、模組、層、實作與**新增的** law,**不得列任何一條既有的 law**;「測試」列簽名或型別變了而要改呼叫與建構的、新增的 law 要新寫的,既有 law 的意思不變。新增的 law 照「Law 怎麼談」與開發者逐條談定。攤的時候或做到一半發現非調整既有的 law 不可:`lawful:scope-revise` 停下並放棄這一次修訂,文檔與宣告還原到開工時的樣子,整件(連同原本打算改的簽名、型別、實作)交給 `lawful:scope-laws`。

影響範圍逐項列,查過而沒有的寫「無」,不准省略一項:

| 項 | 列什麼 |
|---|---|
| 直接動到 | 哪幾條 law 的哪一行變、哪幾條簽名或型別變 |
| 引用同一處的 law | 同一條 pipeline 裡引用同一個 stage 或觀察點的每一條 law;全域 Law 則是契約欄指到它的每一列對外 I/O、三行裡用到同一個 types 層匯出的每一條領域不變量 |
| 連動的文檔 | Stages 表引用到動到的 stage 或簽名的每一條 pipeline(模組欄註明「見」這一條的);全域 Law 則是違反得了它的每一條 pipeline |
| 測試 | 要重寫的(歸屬全名)、要重跑的、確定不受影響的 |
| 狀態 | 哪幾條 `verified` 要重開;哪幾條建構中的 build 分支要重驗(`lawful status` 建構中那幾行) |
| 需求 | 哪幾條需求的驗收引用到動到的 law;改完之後它還達不達成 |

選項至少兩個,其中一個一定是「不改」。每個選項寫:改什麼、影響範圍裡哪幾項因此不同、當下成本、之後的代價、可不可逆。conductor 給傾向與理由,開發者拍板;選了哪個、否決了哪幾個,寫進 REV 的依欄與 pipeline 的「決定」。

刪 stage 與文檔退役(pipelines.md「修訂(REV)」)也是調整既有的 law,攤同一張表:「直接動到」列刪掉的每個 stage 與每條 law;「連動的文檔」列引用它的每一條;「測試」列要一起刪的;「需求」另列哪條里程碑綁著它。

## 全域 Law 的變更

全域 Law 不住任何一條 pipeline,它的每一次落筆都在 `Cone.md` 的「全域 Law」區,都由 `lawful:global-laws` 做,同樣先過「影響範圍與選項」:

- **第一次定義**:立案之後三區還是模板,`lawful:global-laws` 逐區與開發者談(領域不變量、架構的四層各裝什麼、契約的對外 I/O);領域不變量走 `lawful invariant add`,每條過准入四條(「全域 Law」)。此時沒有既有的 pipeline,影響範圍各項寫「無」;選項照樣給,一定含「不立這一條」。
- **之後的變更**(新增、修改、放寬、替換、刪除),來源只有兩種:開發者自己提的,或 `lawful:integrate` 的變更建議經開發者明確批准(GAP 記著反例與批准的選項)。沒有批准就不動。
- 與立案、需求的變更走同一條路:`plan/<slug>` 分支,由 `lawful:integrate` 經 PR 合進主線(roles.md「分支與所有權」)。新增走 `lawful invariant add`;修改、放寬、替換、刪除直接改那一條。編號不重用,刪掉的號永久空缺。四層那四句與對外 I/O 表的變更同理,`modules.md` 跟著改到 `lawful lint boundary` 沒有紅。
- **改完重新驗證受影響的工作**:領域不變量的句子或三行變了,它原本的測試作廢,`lawful:build INV-n` 重派 qa;`lawful lint global` 沒有紅;影響範圍裡每一條 `verified` 的 pipeline 重跑它的子集測試,紅的重開、各走一條 REV(它既有的 law 要跟著調整走 `lawful:scope-laws`,既有的 law 不動、只有實作要服從新的全域 Law 走 `lawful:scope-revise`);建構中的分支合進新的主線之後,從首跑起重跑。
- 這條變更由 `lawful:integrate` 收進 PR,並留一條 ADR 記為什麼(pipelines.md「ADR」)。
