# feature 文檔

文檔只寫程式碼裝不下的東西:測試存在之前的 laws、為什麼這樣決定、跨過對外邊界的資料流。型別、簽名、匯出住程式碼;文檔引用,工具對帳。

## `.design/`

```
.design/
├── system.md          願景、目的、語言與工具、層、對外 I/O、Features 清單
├── objectives.md      目標與里程碑(「願景、目標與里程碑」)
├── modules.md         模組表(boundary.md「模組表」)
├── features/F-00x-<slug>.md
├── abstracts/A-00x-<slug>.md
├── gaps.md            只裝 open 的 GAP;空了刪檔
├── adr/ADR-00x-<slug>.md
├── spikes/SPK-00x-<slug>.md   程式碼在專案根目錄 spike/SPK-00x-<slug>/,結案即刪
└── journal/<全名>.md          開發日誌,只存在於 build 分支;整合寫進 PR 後刪(roles.md「開發日誌」)
```

## system.md

frontmatter:`language`(選 adapter)、`updated`。六節:

| 節 | 裝什麼 |
|---|---|
| `## 願景` | 一到三句:這個專案做完時世界長什麼樣、替誰改變了什麼。立案時訂,不隨里程碑變;`devflow status` 把它印在第一行,還是模板就列警訊 |
| `## 目的` | 三到五句:替誰做什麼、明確不做什麼 |
| `## 語言與工具` | 三道指令:建置、整套測試、**子集測試**;每道指令是該列第一個反引號區段,反引號外的文字是給人看的說明;指令在專案根目錄執行,要換目錄就寫進指令。IO 模組追加、Laws 詞彙追加(law 會用到但不是簽名也不是型別名的字)、忽略目錄 |
| `## 層` | 表,由內而外(boundary.md「層」) |
| `## 對外 I/O` | 表:名稱、方向(in / out)、型別、模組、進入哪份 feature、信任(trusted / untrusted)、驗證(boundary.md「對外 I/O」) |
| `## Features` | 表:全名、類別(feature / abstract)。`devflow status` 的分母;交付順序不寫在這裡,由目標的優先與里程碑的順序推 |

description 住各文檔的 frontmatter,清單不重複。

## 願景、目標與里程碑

三層,每一層都回答「為什麼做這份 feature」:

| 層 | 住哪 | 是什麼 |
|---|---|---|
| 願景 | `system.md`「願景」 | 專案的終極目標,做完時世界長什麼樣;只有一個,立案時訂 |
| 目標 | `objectives.md` 的 `## O-n:<一句話>` | 通往願景的一步:使用者做得到什麼、或世界變成什麼樣;至少一個,可以多個。每個目標一個**優先**(1 到 4,1 最高)與一句**可觀察的判準**(達成時看得到什麼) |
| 里程碑 | 目標底下的表 `里程碑 \| 做到什麼 \| 綁定` | 為了達成目標而切出來的階段,`M-n` 全檔唯一,表的順序就是先後;**綁定**欄是 feature 全名,「、」分隔,至少一份 |

```markdown
## O-1:每一筆結帳與退款的金額都算對
- 優先:1
- 判準:任一筆訂單的應付金額與可退金額都等於明細加總減折扣,四捨五入到分

| 里程碑 | 做到什麼 | 綁定 |
|---|---|---|
| M-1 | 結帳走通 | F-001-checkout |
| M-2 | 退款走通 | F-002-refund |
```

- 里程碑綁的是 feature;abstract 跟著引用它的 feature 達成,不綁。綁定是里程碑對到文檔的唯一寫法。
- 每份 feature 至少被一條里程碑綁定;沒被綁的 feature 不朝向任何目標,`devflow status` 列警訊。要它就綁進一條里程碑,不要它就刪檔。
- 每個目標要能說出它服務願景的哪一句;說不出來的目標是分歧,`dev-flow:objective` 對談時問,`dev-flow:audit` 人判。
- 進度不是欄位:里程碑達成 = 綁定的每份 feature 都達成;目標完成度 = 達成的里程碑 / 里程碑數;都由 `devflow status` 算。
- 配號只走 `devflow objective add` 與 `devflow objective milestone`;`devflow claim feature --milestone <M-n>` 把新 feature 綁進里程碑。刪掉的號永久空缺。
- 建議路線與能開的線照目標優先、目標順序、里程碑順序排;沒被綁的排最後。

## feature 與 abstract

一份 **feature** 是一條 **input → 轉換 → output** 的資料流,從對外邊界進、從對外邊界出,由 **step** 組成;每個 step 是一條住在程式碼裡的簽名。

- 可以橫跨任意檔案與層。檔案是 step 的屬性,不是文檔的歸屬。**沒有子系統這一層**:feature 直接掛在 `system.md` 底下。
- 值得端到端規格的才建檔。單一小函數的性質直接寫測試;它以 step 的身分出現在用到它的 feature 裡。
- step 順序是資料流的拓撲序。`=` 列(**整條**)是權威:它把各步驟組合成一次呼叫,住內層,不住最外層;整條的 law 掛在它上面。
- **進入點**:feature 另有恰好一列 `!` 列,住最外層,把 `=` 列接到對外 I/O(HTTP handler、CLI 指令、UI 事件、排程)。它是程式碼裡的簽名,`lint sig` 照對帳、進簽名 m / n;不掛 law,它做的事由對外 I/O 表承接。
- **觀察點**:law 要引用、但不是資料流步驟的簽名(存取子、投影、判定),在 Steps 表列成 `#` 欄寫 `o` 的列。`lint sig` 照對帳;它不是 step:不掛 law、不進簽名 m / n。最內層匯出的函數 law 本來就能引用,不必列成觀察點。

一份 **abstract** 是 `dev-flow:refactor` 從**兩份以上 feature** 收整出來的共用能力,沒有 `!` 列,不碰對外邊界。**它的存在條件是被兩份以上文檔引用**:

| 消費者 | 判定 |
|---|---|
| 0 份 | `lint sig` 紅:死的抽象,刪掉 |
| 1 份 | `devflow status` 警訊:收整沒有成立,搬回那一份 feature |
| 2 份以上 | 成立 |

feature 之間**不互相引用**:兩份 feature 需要同一段東西,那一段就是一份 abstract。`lint sig` 對帳。

依賴不手寫:F 的 Steps 表某列的模組欄註明「見 A-00x-<slug>」,F 就依賴 A;A 不因為被引用而依賴 F。同名簽名出現在兩份文檔而沒有一邊註明「見」,`lint sig` 紅——那正是該走 refactor 的訊號。

## 編號與引用

| 東西 | 編號 | 引用寫法 |
|---|---|---|
| feature | `F-001`,檔 `features/F-001-<slug>.md` | 全名 `F-001-<slug>` |
| abstract | `A-001`,檔 `abstracts/A-001-<slug>.md` | 全名 `A-001-<slug>` |
| step | 函數名 | `F-002#refresh` |
| law / example / 修訂 | `LAW-1` / `EX-1` / `REV-1` | `F-002#LAW-1` |
| 提問 | `GAP-1`(`gaps.md` 內遞增) | `GAP-1` |
| ADR / spike | `ADR-001` / `SPK-001` | 全名 |

- 配號只走 `devflow claim`;刪掉的號永久空缺。
- feature、abstract、ADR、spike 一律寫全名。
- slug 是 kebab-case 英文,講資料流做什麼。

## 簽名怎麼寫

文檔一律寫**正規式**,adapter 負責把各語言的宣告正規化成它,兩邊才是同一把尺:

```
name(型別, 型別): 回傳型別
```

- **參數名不寫**:改參數名是實作自由,不是契約變動。
- 方法與關聯函數寫 `型別.方法`(`TokenStore.rotate(TokenId): TokenPair`);接收者 / `self` / `cls` 不算參數。
- 回傳型別可以省略(`name(T): ` 寫成 `name(T)`);程式碼那一側也沒有註記時,`lint sig` 只比名字與參數個數,並列 info 說明只對到這兩樣。
- 泛型與命名空間照抄程式碼的寫法,空白正規化後逐字比。

## frontmatter 與 status

`id`、`description`、`status`、`updated`。`status` 只放**人才知道的決定**,進度不是欄位:

| status | 意思 |
|---|---|
| `draft` | 還在討論;`dev-flow:build` 拒收 |
| `ready` | 開發者口頭拍板,skill 改欄位;可以委派 |
| `frozen` | `devflow status` 顯示達成,conductor 在 build 收尾直接改,不問;不准修訂。解凍 = `dev-flow:revise` 在「決定」記一條為什麼,改回 `ready` |

開發者不親自改任何 `.design/` 檔;開發者說,skill 寫。`frozen` 而測試紅、或有 REV 卻沒有解凍紀錄,是不一致。不做的 feature 直接刪檔;值得記住為什麼,開 ADR。

## 節

六節,順序固定。`## Brief`、`## Steps`、`## Laws`、`## Examples` 不得省;`## 決定`、`## 修訂記錄` 無內容寫「無」。節裡只有事實,沒有填寫指引。

**Brief**:三到五句給第一次打開的人:意圖、input → output、流向(用 `→` 串 step 的中文名)、哪個對外入口進來。abstract 的 Brief 另寫哪幾份 feature 從哪一步引用它。

**Steps**:

```markdown
| # | 簽名 | 做什麼 | 模組 | 層 |
|---|---|---|---|---|
| 1 | `parseRefresh(RawBody): Result<RefreshReq, ParseError>` | 解析請求 | `src/app/refresh.ts` | application |
| 2 | `lookup(TokenId, TokenStore): Option<Token>` | 取出 token | `src/domain/token.ts`(見 A-001-token-store) | domain |
| o | `isValid(Token, Instant): boolean` | 觀察:這個 token 當下可不可用 | `src/domain/token.ts` | domain |
| = | `refresh(RefreshReq, TokenStore, Instant): Result<TokenPair, AuthError>` | 整條 | `src/app/refresh.ts` | application |
| ! | `refreshHandler(HttpReq): Promise<HttpRes>` | 進入點:接到 POST /auth/refresh | `src/entry/routes.ts` | entry |
```

- 簽名欄照上面「簽名怎麼寫」,而且是該檔案對外匯出的名字。`devflow lint sig` 對帳。
- 模組欄是**相對專案根目錄的檔案路徑**;層欄與模組表一致。引用 abstract 的 step:簽名照抄,模組欄註明「見 A-00x-<slug>」。
- `#` 欄:數字是步驟,`=` 是整條,`o` 是觀察點,`!` 是進入點。`=` 列恰好一列,不在最外層;`o` 列幾列都可以,不在最外層,放在 `=` 列之前;`!` 列 feature 恰好一列、abstract 沒有,在最外層,放在最後。列號只在本檔內有意義,引用用函數名。

**Laws**:純 ASCII 三行,呼叫式語法。

```markdown
- LAW-1 [state] 換發成功之後,舊的 TokenId 立刻失效
  - forall t in TokenId, s in TokenStore, now in Instant
  - given isOk(refresh(mkReq(t), s, now))
  - |- isValid(lookup(t, s), now) == false
- LAW-2 [invariant] 換發失敗不改變任何 token 的可用性
  - forall t in TokenId, u in TokenId, s in TokenStore, now in Instant
  - given isErr(refresh(mkReq(t), s, now))
  - |- isValid(lookup(u, s), now) == isValid(lookup(u, s), now)
```

- `forall` 行:變數與定義域。一個 step 的回傳值要拆開用,寫成綁定(`p in refresh(r, s, now)`),`in` 對單一值就是綁定。
- `given` 行也是純 ASCII 表達式。**`given` 行的呼叫先發生,`|-` 行在其後求值**——命令式語言的時序靠這一句表達,不必另立語法。前提寫不成表達式,代表少一個觀察點:補 `o` 列,或開 GAP;不寫散文。
- `|-` 行:結論。每個識別字必須是 Steps 表的簽名(步驟、整條或觀察點)、最內層匯出的函數、程式碼裡的型別或列舉名,或 adapter 認得的標準函式庫名;真的少一個字就加進 `system.md`「Laws 詞彙追加」。`lint laws` 對帳,對不到不准 `ready`。運算子 `==`、`!=`、`<`、`<=`、`>`、`>=`、`in`、`=>`、`and`、`or`、`not`。字串與數字字面值直接寫,不為它造常數。law 不定義型別,型別與函數一律住程式碼。`!` 列不准出現在 law 裡。
- 種類與對談時的問法:

| 種類 | 性質 | 問開發者什麼 |
|---|---|---|
| `invariant` | 某個量轉換前後不變 | 做完之後什麼一定不會變? |
| `identity` | 恆等、冪等、單位元 | 什麼輸入等於沒做?做兩次跟做一次一樣嗎? |
| `roundtrip` | 編了解回原值 | 存出去的東西要能一模一樣讀回來嗎?哪些欄位不算? |
| `relation` | 兩個 step 輸出之間的關係 | 這一步的輸出跟上一步的輸出有什麼對應? |
| `bound` | 上下界、單調 | 哪個數字有上限?輸入變大輸出一定變大嗎? |
| `equiv` | 兩種算法等價 | 有沒有一個慢但一定對的寫法可以拿來對照? |
| `total` | 定義域內每個輸入都有值:不拋例外、不回錯誤 | 哪些輸入看起來合法卻會爆?空的、最大的、負的呢? |
| `commute` | 順序無關 | 先做 A 再做 B,跟先 B 再 A 一樣嗎? |

- 每條 law 至少一條 property test,測試宣告歸屬 `F-002#LAW-1`(寫法見 tooling.md「測試歸屬」),歸屬字串只放這一個。`devflow lint trace` 對帳。
- `=` 列至少被一條 law 引用:整條的端到端性質,不是各 step law 的加總。`lint laws` 對帳。
- 觀察點必須是這份文檔自己的簽名;要觀察別份的內部,law 屬於那一份。
- bug = 某條 law 在現況下不成立:law 已存在就修碼;沒寫到就補 law(走修訂)。**沒有 bug 文檔。**

## 什麼要有 law

law 只掛在 step 上,所以先問一個函數是不是 step,再問它有沒有性質。兩題都答是,才立 law;每份文檔的 `=` 列至少一條。

| 問 | 答否 | 答是 |
|---|---|---|
| 1. 有沒有任何文檔把它寫進 Steps 表當步驟?(數字列或 `=` 列) | 不是 step,不寫 law。law 要拿它當觀察點就列成 `o` 列;只給自己檔案用的支架歸內部單元測試,不標歸屬、不進分母 | 往下 |
| 2. 型別留下多少自由度?(有幾個型別正確、行為不同的實作) | 一個,不寫 law:回常數的存取子、只包一層的建構子、只是轉個名字的委派。這些由編譯器或初始狀態驗收 | 有限幾個,每個自由度一條 law;無限多(演算法決定),law 寫不變量與邊界,寫不出 `\|-` 行的部分靠 example |

介面 / trait / 抽象類別照同一套:給全專案實作或呼叫的抽象是 step,它的性質寫成 law,**一條 law、每個實作一條測試**,歸屬都標同一個 `F-00x#LAW-n`;個別實作不另寫 law。只在一個檔案裡用的不是 step。

不寫 law 的:常數與設定值、`!` 列、最外層的 I/O 函數(它們在對外 I/O 表)、只有型別層知識的東西。law 的條數不是進度,是自由度的數量。

**Examples**:表 `# | 輸入 | 輸出 | 覆蓋`,每列指到它覆蓋的 law;指不到就先補 law。每個 example 一條 example test,歸屬 `F-002#EX-1`。輸入輸出裡**不准出現真的密碼、金鑰或 token**(`lint io` 擋)。

**決定**:每條一句粗體結論、否決的替代方案、理由一句;有證據引用 SPK / ADR 全名。只裝只關這份文檔的決定;跨文檔的開 ADR。解凍紀錄也寫這裡。

## 修訂(REV)

改既有文檔的簽名、laws 或層,一律改原檔,一次修訂一條 REV。**任何對既有功能的改動都修訂原檔,不另開檔。** step 在同一層內搬檔案不是修訂:`lint sig` 報「搬家」,`devflow sync` 機械更新模組欄,不寫 REV。

```markdown
- REV-1(2026-09-12,依 qa 提問「過期判定用哪個時鐘」):過期判定改用伺服器時鐘
  - 動到:LAW-2、`refresh` 多一個 Instant 參數
  - 保護:LAW-1、LAW-3
  - 重委派:qa(LAW-2)、impl(`refresh`)
  - 連動:F-003-invoice 的 Steps 表引用了 `refresh`,同步改
```

- 依:來源與那一句話(GAP 的提問原句、SPK / ADR 全名、開發者的話、`dev-flow:refactor` 抽出了哪份 abstract)。
- 保護:這次不准變的既有 law;要保護的行為還不是 LAW 的,先補成 LAW 再修訂。**沒有 law 守著的「行為不變」等於沒有保護。**
- 重委派:law 變了重派 qa,簽名變了重派 impl。簽名變了,程式碼簽名同步改、本體回骨架;測試只重跑 REV 點名的。
- 動到與保護只寫還在檔上的條目;`updated` 改成修訂日期。
- law 編號單調遞增,**刪掉的號永久空缺**:`lint trace` 的幽靈引用靠這條才抓得到「測試還在守一條已經不存在的 law」。
- 引用的 abstract 簽名變了,每一份消費者跟著 REV;`frozen` 的消費者先解凍。

## 收整(refactor)

兩份以上 feature 長出同一段能力時,`dev-flow:refactor` 把它抽成一份 abstract。這是唯一會一次動好幾份文檔的動作,所以紀律固定:

1. **先有證據**:兩份以上文檔的 Steps 表出現同名簽名(`lint sig` 已經在報),或讀程式碼發現同一段邏輯寫了兩次。只有一份的不抽。
2. **抽出來的是資料流,不是工具函數**:abstract 有自己的 `=` 列與 laws;抽不出 `=` 列的,那只是共用 helper,住程式碼就好,不建檔。
3. **原檔改引用**:每一份 feature 把那幾列的模組欄改成「見 A-00x-<slug>」,簽名照抄。
4. **每一份被動到的 feature 各記一條 REV**,依欄寫「收整進 A-00x-<slug>」,動到欄列出改成引用的那幾列與搬走的 law,重委派欄寫要重跑的測試。laws 搬去 abstract 的,原檔的號永久空缺。
5. **abstract 的 laws 是它自己的性質**,不是原本那幾條的聯集;搬不過去的留在原檔。

`frozen` 的 feature 要先解凍才收整。

## 提問(GAP)

任何角色在文檔裡讀不出唯一答案(qa 寫不出斷言、impl 非改簽名不可、conductor 建骨架時模組表沒有那個檔):停下該項,不腦補、不與另一邊協商,其餘照做。委派期間人類決定只有這一條出口。寫在 `.design/gaps.md`:

```markdown
## GAP-1(F-002-token-refresh#LAW-2 / qa)
- 模糊點:「換發失敗不改變可用性」沒說「失敗」含不含 token 不存在
- 卡住的項目:F-002#LAW-2 的 property test 寫不出斷言
- 需要回答什麼:`refresh` 對不存在的 TokenId 回 Err 還是拋例外?
- 狀態:open
```

- 委派模式下 subagent 不寫檔:四欄寫進回報,局部序號 `本次-1`,conductor 單線寫入配號;在 build 分支上從主線的最大號往上配,整合時撞號的由整合者把後合進來的往上移(roles.md「整合」)。
- 結案 = 開發者口頭回答,`dev-flow:revise` 寫 REV 並刪條目,依欄帶模糊點原句。檔空了刪檔。**不留 resolved**:定案後的問題不需要被找回。
- open 的 GAP 擋:那份文檔不算達成、`dev-flow:build` 前置不放行、`devflow status` exit 1。
- impl 測試全綠也不得把有 open GAP 的 step 當完成。

## 願望 step

需要底層還沒有的能力,在 Steps 表直接寫理想簽名,模組欄註明「願望」(已經有目標 abstract 就寫「願望,見 A-00x-<slug>」)。程式碼找不到這列,`devflow status` 列成待實作,`lint sig` 不算紅。

底層的維護者三選一:

| 判準 | 落點 |
|---|---|
| 兩份以上 feature 要 | 走 `dev-flow:refactor` 抽成 abstract,laws 寫在 abstract,原願望列改成引用 |
| 只有這份要,且用既有匯出寫得出來 | 留本地:step 住這份 feature 自己的檔案 |
| 會破壞既有的不變量 | 不做;改需求,記進「決定」 |

## 完成度

`devflow status` 算,每份文檔四個數字:

| 數字 | 怎麼算 |
|---|---|
| 簽名 m / n | Steps 的步驟(數字列、`=` 列與 `!` 列)n 條;程式碼找得到且簽名對得上 m 條。`o` 列另計「觀察點 j / k」。整格還是 `<…>` 佔位符的列是模板,不算 step,警訊列「還是模板」;law 與 example 同理 |
| 骨架 s | m 條裡本體還是骨架標記的 s 條;`devflow status` 列成待實作 |
| laws g / k | 寫了 k 條;測試宣告歸屬 j 條;綠 g 條 |
| 達成 | m = n、s = 0、觀察點全在、g = k、examples 全綠、沒有 open GAP。feature 達成 = 它與它引用的每份 abstract 都達成 |
| 里程碑達成 | 綁定的每份 feature 都達成 |
| 目標完成度 | 達成的里程碑 / 里程碑數,印成百分比;沒有里程碑的目標印「-」並列警訊 |

## ADR

`adr/ADR-00x-<slug>.md`,四節:情境、決定、否決的替代方案、後果。裝跨文檔的決定:層怎麼切、選了什麼外部系統、刪一份 feature 的理由、語言與 adapter。

## spike

讀了也答不出來、要跑了才知道的問題,才開 spike:替決定生產證據,自己不做決定。

- frontmatter:`id`、`description`、`status`(`open | concluded`)、`verdict`(`feasible | infeasible | partial`)、`updated`、`feeds`(餵給哪份文檔的決定或 ADR 全名;concluded 時非空)。
- 三節:`## 問題`(要回答什麼、為什麼讀不出來、判準、timebox)、`## 輪次`(`RND-n`:這輪要驗、判準、timebox、做法、結果、sha、環境)、`## 結論`(verdict、一句話、學到什麼、餵給哪裡、沒驗到的)。
- 判準寫成可觀察的數字或現象;每輪先寫三樣(要驗什麼、判準、timebox)再寫程式碼。
- 程式碼只在 `spike/SPK-00x-<slug>/`;open 期間產品程式碼與測試禁止 import。
- 結案:填齊 verdict / feeds / 每輪 sha,`devflow spike close SPK-00x` 刪資料夾。verdict 不是裁決,契約怎麼改仍走 `dev-flow:revise`。
- 不會有結論的 spike 刪檔與資料夾。
