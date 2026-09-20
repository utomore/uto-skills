# 角色

> 需求(必須達成)先講好,其餘都等跑得通了再講:不得違反的約束——scope law 與全域 Law——都是對著做出來的切片談出來的。程式碼先到,文檔是對著它談出來的承諾,測試是承諾的投影;兩邊對不上,先懷疑文檔。

## 五個階段

| 階段 | 核心(這個階段的每一個判斷都服從它) | 誰 | 在哪 | 產出 |
|---|---|---|---|---|
| **立案** | Only what can be judged true before any code exists gets written: the vision and Requirements with their acceptance.(只寫做之前就判得出真假的東西:願景、需求與它的驗收) | 開發者依序與 `dev-flow:kickoff`(開樹、願景)、`dev-flow:require-design`(需求與里程碑)對談 | `plan/<slug>` 分支,經 PR 合進主線 | `system.md`(願景、語言與工具;「全域 Law」三個小區是空的,等切片長出來)、`requirements/`(需求與它的驗收、優先、里程碑 `M-n-<slug>`)、模組表 |
| **切片** | The slice MUST make the milestone's Goal observably true end to end, MUST NOT violate a global Law, and MUST record every decision and every fake.(讓里程碑那一句話看得到地成真;不違反全域 Law——區裡有什麼就守什麼;每個決定與每一處假都留下紀錄) | `dev-flow:spike-impl`,主 session 自己做 | 這條里程碑自己的分支 `build/M-n-<slug>` 與工作樹,從這一步開 | 從對外入口貫通到出口、跑得通的程式碼,與決策紀錄(「切片」「決策紀錄」) |
| **Law** | scope-laws designs scope Laws only. A Law MUST be falsifiable and MUST be the developer's decision; it never describes what the code happens to do.(law 必須講得出怎樣算違反,而且是開發者拍板的承諾,不是把程式碼念一遍) | 開發者與 `dev-flow:scope-laws` 對談,根據切片的決策紀錄;談出全域的候選時接著與 `dev-flow:global-laws` | 同一棵工作樹 | 從切片 claim 出來的 feature:Steps 抄程式碼、約束逐條談出來(資料交互、資料儲存在哪、外部串接方法、軟體架構四項都問到,laws.md「Law 怎麼談」)、laws 逐條拍板,`ready`;這一片在對外 I/O 表的新列;整個專案都該守的列成候選,開發者批准後由 `dev-flow:global-laws` 抽進 `system.md`「全域 Law」區(laws.md「全域 Law」) |
| **建構** | A document is Verified only when every Law is guarded by a test that can fail and now passes; nobody bends a Law, a test or a declaration to get green.(每條 law 都有一條會失敗、現在通過的測試守著,才叫 verified;不為了變綠去動 law、測試或宣告) | `dev-flow:build` 的 conductor 帶 qa 與 refactor;scope-laws 與 scope-revise 收尾時自動接上 | 同一棵工作樹 | 測試(含剛抽上去的領域不變量的 `INV-n#LAW`)、調整過的實作(含剛立的層表留下的 `lint boundary` 紅)、REV、決策紀錄的「Verification」;每條 law 成立才算達成,conductor 改 `verified` |
| **整合** | Integration MUST NOT reduce Law satisfaction, and MUST NOT change a Law: it proposes, the developer approves, scope-laws or global-laws writes.(合併之前成立的每一條 law,合併之後都要仍然成立;整合不改任何一條 law,只提建議,開發者批准,scope law 由 scope-laws、全域 Law 由 global-laws 落筆) | `dev-flow:integrate` | 整合分支 | 幾條達成的分支合成一條、整套綠、仲裁、ADR、PR |

每個 skill 的 SKILL.md 開頭也有自己那一句核心;步驟與核心衝突時,核心贏,停下回報。

一條里程碑從切片到達成都在同一條分支、同一棵工作樹上,順序是**切片 → 談約束 → 抽全域 → build**:`dev-flow:spike-impl` 先做出一片,`dev-flow:scope-laws` 對著它把約束談成 scope law 並列出全域的候選,有候選就由 `dev-flow:global-laws` 經開發者批准抽進「全域 Law」區(沒有候選跳過這一站),`dev-flow:build` 再讓程式碼滿足 scope law 與全域 Law。它綁的每份文檔都 `verified`,才是可以被整合的狀態。一條需求一次只開它下一條還沒達成的里程碑;互不依賴的需求,里程碑可以同時各開一條,有依賴的被它依賴的那一條擋住(features.md「願景、需求與里程碑」)。主線指 origin 的主線,只透過整合 PR 前進,本地主線不領先它。

既有文檔的改動是另一條路,文檔先行(features.md「修訂(REV)」):要調整(修改、放寬、替換、刪除)既有的 law 走 `dev-flow:scope-laws`(既有文檔的 law 要調整的那一種情形,整件修訂一手包辦);law 不動、或只新增 law,而 `verified` 文檔的簽名、型別、模組或實作要變走 `dev-flow:scope-revise`(原有的每條 law 修訂前後都成立,文檔從 `verified` 回到 `verified`);刪 step、兩份重複的 step 留一份另一份改成引用、文檔退役,都是刪既有的 law,走 `dev-flow:scope-laws`。兩者各自開 `build/<全名>`(靠修訂達成的里程碑,就在它的 `build/M-n-<slug>` 上做),改完條文同樣自動接上 build;一件修訂從頭到尾只有一個修訂類的 skill 在跑,跑到 `verified` 為止。全域 Law 的變更走 `dev-flow:global-laws`(laws.md「全域 Law 的變更」);需求、驗收與里程碑的條目走 `dev-flow:require-design`。

`dev-flow:build` 只收 `ready` 且沒有 open GAP 的文檔。一份文檔一波,順序:對帳 → qa → 首跑 → refactor → 仲裁 → 驗收測試 → 收尾;一條里程碑綁了好幾份就一份接一份,被引用的那一份在前。

## 分支與所有權

| 分支 | 誰開 | 鍵 |
|---|---|---|
| `plan/<slug>` | `dev-flow:integrate` 把主線上立案、需求與全域 Law 的變更帶走時 | 講這次改了什麼的 kebab-case 英文 |
| `build/M-n-<slug>` | `dev-flow:spike-impl`;靠修訂達成、沒有新的一段要貫通的里程碑(`status` 顯示「待修訂」),由做修訂的那個 skill(`dev-flow:scope-revise` 或 `dev-flow:scope-laws`)開 | 里程碑全名 |
| `build/<文檔全名>` | `dev-flow:scope-laws`(既有文檔的 law 要調整、文檔已在主線上;含刪 step 與文檔退役)、`dev-flow:scope-revise` | 被修訂或退役的文檔 |
| `build/R-n`、`build/INV-n` | `dev-flow:build`(只寫一條測試的那一波) | 那條需求的驗收,或那條領域不變量 |

- `build/` 分支一律從與 origin 同步的主線 HEAD 開(`git fetch` 後 `git status -sb` 沒有 ahead / behind、工作樹乾淨),工作樹住 repo 的兄弟目錄 `../<repo>.worktrees/<鍵>`;之後每個角色都在這棵樹上做,指令的工作目錄也是它。分支存在、而且還沒合進主線,就代表這條線有人在做,`devflow status` 把它列成建構中,並從那棵工作樹讀它走到哪一步;已經合進主線卻還在的分支是沒人收的殘留,`status` 列成警訊,由整合清掉。
- 開 `build/M-n-<slug>` 的前提:那條里程碑(含英文名)與它的需求檔(含驗收)都已在主線上;它是該需求下一條還沒達成的里程碑。
- **專案的第一條切片單獨走完**:主線的「全域 Law」三個小區都還是空的時候,一次只開一條切片;它做完、它的全域 Law 抽出來、合進主線之後,才開第二條。兩片同時長,會各長各的層與邊界。第二片起,從第一行程式碼就守全域 Law。`devflow status` 在三個小區都是空的、而且已經有一條切片的分支在建構中時,「今天能開幾條線」不列別的切片,改印「專案的第一條切片單獨走完」那一句。
- **宣告歸設計這一側,本體歸實作這一側**:Steps 上的簽名與它們用到的型別,切片定案後只有 `dev-flow:scope-laws` 與 `dev-flow:scope-revise` 能改;refactor 只動本體、私有 helper 與型別的內部表示。qa 與 refactor 非動宣告不可就是 GAP。
- 分支上准動的東西只有自己的:這條里程碑範圍內的程式碼、從它 claim 出來的文檔、以文檔全名命名的測試檔、本波要寫的驗收測試(以 `R-n` / `INV-n` 命名的測試檔)、共用檔裡自己那幾列(`modules.md` 登記新檔、`system.md` 對外 I/O 表與 Features 表的新列、需求檔裡自己那條里程碑的綁定欄、建置設定登記自己那幾行)、`gaps.md` 追加、`journal/<鍵>.md`;以及從這一片抽上去的全域 Law——開發者批准之後由 `dev-flow:global-laws` 在這條分支上落筆的領域不變量、層表與 `modules.md` 的層欄(laws.md「全域 Law」)。
- 不動:需求檔的其餘部分(一句話、驗收那一句、優先、里程碑的列)、全域 Law 區既有的條目(領域不變量、層表、對外 I/O 表既有的列;要改只經 `dev-flow:global-laws`,開發者批准才動);別份已經在主線上的文檔與它的 step 本體、別人的測試檔。唯一的例外:需求的驗收或一條領域不變量還只有一句話、而這條切片剛好讓它引用得到的簽名出現了,`dev-flow:scope-laws` 與開發者把那一句話寫成三行;那一句話本身不改。切片非動到別份文檔的簽名不可,那是那份文檔的修訂:在同一棵工作樹上照 features.md「修訂(REV)」分流(它既有的 law 不動走 `dev-flow:scope-revise`,要調整既有的 law 走 `dev-flow:scope-laws`),REV 的連動欄寫明。靠修訂達成的里程碑(features.md「願景、需求與里程碑」)照同一條:既有文檔的條文由那個修訂的 skill 在 `build/M-n-<slug>` 上改、REV 的依欄寫里程碑的全名 `M-n-<slug>`,既有 step 的本體由它接上的 build 帶 refactor 調;需求檔不動,綁定欄在 `dev-flow:require-design` 切出這條里程碑的當場就填好了。這條里程碑另外要一段新的貫通(新的出入口、最外層的客戶端)時,`dev-flow:spike-impl` 在同一條分支上只貫通新的那一段。
- 進 `dev-flow:scope-laws` 之前先把主線合進工作樹一次(`git merge origin/<主線>`):Law 對著最新的全域 Law 與別人剛合進去的文檔談,衝突提早浮現。
- `gaps.md` 在分支上從主線最大號往上配。
- 分支上的 commit 訊息帶鍵;切片、文檔、測試、調整過的實作、決策紀錄各自成 commit,整合時才對得出誰動了什麼。

## 角色

| 角色 | 讀什麼 | 做什麼 | 不准 |
|---|---|---|---|
| **spike-impl**(主 session) | 那條里程碑與它的需求檔(一句話、驗收)、全域 Law(laws.md「全域 Law」)、`system.md` 的層與對外 I/O、`modules.md`、既有程式碼 | 貫通一條垂直切片、登記模組表、寫決策紀錄 | 寫 feature 文檔與 law;寫帶歸屬的測試;新增全域 Law;為了跑得通而違反層的兩條規則 |
| **conductor** | 目標文檔、模組表、決策紀錄、測試結果 | 對帳、先派 qa、驗首跑、再派 refactor、跑測試、仲裁、寫 GAP、收尾 | 寫測試、寫實作、補 law、替 qa 與 refactor 做他們的決定 |
| **qa** | 目標文檔、最內層的匯出、Steps 上那幾條簽名的宣告;寫驗收測試時是那條驗收或領域不變量,與它引用到的簽名所在的每份文檔 | 每條 law 一條 property test、每個 example 一條 example test,標歸屬;產生器;需求的驗收或領域不變量一條測試(「驗收測試」) | 讀任何實作本體;讀那一條沒引用到的別份文檔;改程式碼;要求後門 |
| **refactor** | 目標文檔、現有程式碼、決策紀錄的「Faked / Unverified」、conductor 給的紅燈歸因 | 調整或重寫實作,直到每條 law 成立;假的換成真的;必要的私有 helper | 讀寫測試;改 Steps 上的簽名與型別宣告;改文檔 |

qa 與 refactor 互不可見。qa 先、refactor 後,不平行:首跑要在 refactor 動手之前的程式碼上驗。互動模式下同一個人依序扮演,隔離靠紀律;看過另一邊就如實說。

## 委派

spike-impl、scope-laws 與 scope-revise 不委派:貫通切片要看得到整個專案,Law 要當面談,修訂的影響範圍要當面確認。qa 與 refactor 由 conductor 委派,subagent 問不了人:

1. 不提問、不等回覆。文檔裡讀不出唯一答案就寫 GAP 停該項(features.md「提問(GAP)」);答案不會出現在簽名或 law 上的選擇(私有 helper、資料結構、演算法)自己決定,列進回報。
2. 不寫共用檔(`system.md`、`modules.md`、`gaps.md`、決策紀錄、別人的 feature)。GAP 全文放回報,conductor 單線寫入配號。
3. 編號與檔名由 conductor 給;提到文檔寫全名。
4. 機械查證不跳過:程式碼與測試要編得過、laws 與 examples 的翻譯要對得上數。
5. 如實回報:測試紅就貼輸出;做不完的標未完成。

**開工 context 由 `devflow brief` 給**:被委派的角色第一個動作是用 Skill 工具載入自己的 skill,args 照抄 conductor 給的那一行(`<目標> --root <工作樹>`)。載入的那一刻 `devflow brief <角色> <目標>` 就跑完了:規章的節、目標文檔、逐條狀態、Steps 上每條簽名與型別的宣告、最內層、這個專案的測試怎麼寫,都在載入結果裡,不再另外讀規章、找宣告。conductor 的 prompt 只給任務(哪個角色、哪個目標、哪棵工作樹)與只有它知道的事(首跑紅的 law 與歸因、決策紀錄裡要換成真的的列)。

載入結果的第一行是**指紋**(`brief <角色> <目標> @doc:<雜湊> rules:<雜湊>`)。conductor 收回報時跑 `devflow brief <角色> <目標> --root <工作樹> --fingerprint` 對:對不上 = 這一場不是從 brief 開工的,或目標文檔在這一波中途變過,回報作廢、重派。

回報固定六項:指紋(照抄);改了哪些檔;完成了什麼(qa:law / example 各翻幾條、紅綠分佈;refactor:動了哪幾條 step 的本體、哪些是整份重寫、測試結果與**歸因**);自己決定的事;GAP 清單(局部序號,四欄);阻塞項。

## 切片

`dev-flow:spike-impl` 的任務是讓一條里程碑那一句話成真:從對外入口貫通到出口,能跑、看得到行為。它同時是可行性驗證——做不做得到、做得到的話長什麼樣,跑過才知道,不猜、不拿去問開發者。

- 輸入:那條里程碑與它的需求檔(一句話與驗收:里程碑全部走完要讓它達成)、全域 Law、`system.md` 的層與對外 I/O 的信任邊界。簽名、步驟怎麼拆、放哪個檔案,都是這一步邊做邊定的事。
- **全域 Law 區有什麼就守什麼,從第一行程式碼起**,不留到整合:新檔案登記進模組表、內層不 import 外層、對外 I/O 只在最外層、`untrusted` 的入口第一個碰到資料的是驗證。純度與依賴方向事後補等於重寫。專案的第一片就是用來長出全域 Law 的(「分支與所有權」:第一條切片單獨走完):層表還沒有列時,新檔案照樣登記、層欄留白,檔案怎麼分在決策紀錄「Decisions」記一列;對外 I/O 表還沒有列時,跨過邊界的每一端記進「Touched」。`dev-flow:scope-laws` 拿這兩處與開發者把層與邊界講定。
- 可以假:假資料、寫死的值、沒接上的外部系統。**每一處都記進決策紀錄「Faked / Unverified」**;沒記的假比沒做還糟,它會被當成達成。
- 自己的煙霧測試可以寫,不標歸屬,算內部測試(`lint trace` 照列);law 的測試是 qa 的事。
- 離場條件四項,缺一不離場:
  1. 決策紀錄「Entry」那道指令跑得起來,看得到這條里程碑那一句話的行為:里程碑是使用者看得到、展示得出來的階段,Entry 就是展示它的方法;
  2. 建置過,`devflow lint boundary` 沒有紅;
  3. 整套測試跑一次:既有的 law、需求的驗收與領域不變量的測試沒有因為這一片變紅;`devflow lint global` 沒有紅;
  4. 決策紀錄的切片六節填完(「決策紀錄」),連同程式碼 commit。
- **走不通也是答案**:timebox 到了、或確定這個做法達不到那一句話,決策紀錄 frontmatter 寫 `verdict: infeasible`,「Goal / Scope」寫試了什麼、卡在哪、下次之前要先知道什麼,commit 後交給 `dev-flow:integrate`:分支不合,決策紀錄升成一條 ADR。里程碑要不要換做法、重切或刪掉,回 `dev-flow:require-design`。
- **這一版是草稿**:它的用處是讓 Law 談得下去。qa 之後 refactor 把它整份重寫是正常結果,不是失敗;誰都不為了保住它而放寬 law。

## 首跑

qa 交付後、派 refactor 之前,conductor 在現有的程式碼上跑一次 qa 的測試。它回答的是「這些測試真的會失敗嗎」:refactor 一旦動手,假綠與真綠在測試輸出裡同形。

| 這條測試 | 首跑該是 |
|---|---|
| 決策紀錄「首跑該紅」列的 law(開發者答「不准」的) | 紅 |
| 修訂那一波:REV「動到」欄點名的 law;打到未實作標記的 | 紅 |
| 其餘的 law 與 example(開發者答「要」的、REV 保護的) | 綠 |
| 既有的 law 不動的修訂那一波(`dev-flow:scope-revise` 的 REV:「動到」欄沒有既有的 law,「保護」欄是原有的每一條) | 原有的每條 law 與 example 都綠(來源是「law 在而實作不符」的,只有那一條紅);新增的 law 照 REV「動到」欄註明的:保護用的綠,新的上界、新 step 的紅。原有的別條紅 = 宣告同步時動到了行為,或這次修訂其實動到了既有的 law:停下,照「仲裁」歸因。首跑該綠的新 law 紅綠證明不了它會失敗,conductor 拿 `\|-` 行對測試的斷言 |

- 該紅卻綠:退回 qa 重寫(斷言恆真、沒呼叫到受測簽名、或產生器生不出違反的輸入)。
- 該綠卻紅:不是基線壞了,是切片的行為不像談的時候以為的那樣——照「仲裁」歸因,多半就是 refactor 要調的地方。
- 首跑一條紅都沒有(開發者每一條都答「要」):紅綠證明不了測試會失敗,conductor 逐條拿 `|-` 行對測試的斷言,確認逐字翻了、真的呼叫到受測簽名,才派 refactor。
- 首跑的結果寫進決策紀錄「Verification」的「首跑」。環境跑不起來、驗不成 → 在回報明寫「本波 qa 紅綠未驗證」,不得默認通過。
- **未實作標記**:修訂新增的 step,做修訂的那個 skill(`dev-flow:scope-revise`,或一手包辦的 `dev-flow:scope-laws`)先在程式碼裡宣告它,本體是 adapter 的標記,訊息帶 `F-00x#name`,首跑的紅燈才看得出打到哪個 step。**不得回傳假值**(回 `0`、`[]`、`null` 會讓測試假綠)。

| 語言 | 未實作標記 |
|---|---|
| TypeScript / JavaScript | `throw new Error("F-001#name not implemented")` |
| Python | `raise NotImplementedError("F-001#name")` |
| Go | `panic("F-001#name not implemented")` |
| Rust | `todo!("F-001#name")` |

## 驗收測試

需求的驗收或一條領域不變量寫了三行,就承諾了一條測試:需求的歸屬 `R-n#ACCEPT`,領域不變量的歸屬 `INV-n#LAW`(features.md「願景、需求與里程碑」、laws.md「全域 Law」);沒有測試時它是未知,`devflow status` 列警訊。它由 qa 寫、由 conductor 派,時機只有兩個:

| 時機 | 誰派、在哪 |
|---|---|
| 一份文檔的 build 本波全綠後,`devflow status` 顯示它讓某條需求的里程碑全部達成,而那條需求的驗收有三行式卻沒有測試;或這條分支上多了一條有三行式而沒有測試的領域不變量(`dev-flow:global-laws` 從這一片抽上去的,或 `dev-flow:scope-laws` 把先立的那一句寫成了三行) | 同一條 build 分支上再派一次 qa,目標是那一條;綠了才收尾。抽上去的那條 law 在出處的文檔已經有測試的,這一波的 qa 把它搬進以 `INV-n` 命名的測試檔、歸屬改成 `INV-n#LAW` |
| 里程碑早就全部達成、驗收還沒有測試;領域不變量有三行卻沒有測試(`status` 的警訊與建議路線列 `dev-flow:build R-n` / `INV-n`) | `dev-flow:build` 的目標直接是那一條:開 `build/R-n` 或 `build/INV-n` 分支,不派 refactor,只派 qa 寫那一條,跑整套一次,寫決策紀錄,交給 `dev-flow:integrate` |

- qa 讀的是那一條的三行、它引用到的每個簽名所在文檔的 Steps 表與最內層的匯出;領域不變量只引用最內層,就只讀最內層。產生器與斷言照「qa 的交付」,`|-` 行逐字翻。測試檔以 `R-n` / `INV-n` 命名,歸屬字串只放一個。
- 這種測試紅的歸因不是某個 step 的實作:里程碑全部達成而驗收測試沒過,代表里程碑切漏了、或驗收寫錯;領域不變量紅,代表某一條切片違反了它。conductor 開 GAP(角色 conductor,目標寫 `R-n#ACCEPT` 或 `INV-n#LAW`)停下,需求的回 `dev-flow:require-design`,領域不變量的照仲裁歸因到違反它的那份文檔、或回 `dev-flow:global-laws`;不讓 qa 放寬斷言。
- 只有一句話的驗收(沒有三行)沒有驗收測試,由里程碑全部達成推得;不派 qa。

## qa 的交付

- 產生器由 qa 寫,只用公開的建構子組合法值;組不出來就是 GAP,指出缺的建構子。產生器要能縮小(shrink),反例才讀得懂——整合的仲裁拿縮小後的反例給開發者看。
- 有 `given` 行的 law:產生器直接建構滿足前提的值;做不到才用條件過濾,並宣告覆蓋率下限,沒宣告覆蓋率的過濾式測試視同恆真。**`given` 的呼叫先發生**,測試照這個順序寫。
- `total` 種類的斷言是「呼叫它不拋例外、不回錯誤」。
- 每條 property test 限案例數與尺寸(例:100 個案例、產生器的尺寸有上限),整個測試檔有 timeout;不得產生無界的結構或無界的迴圈。跑爆機器的測試視同紅。
- 測試檔編得過。**不因為看到綠或紅而改斷言**:首跑由 conductor 驗。
- 內部支架(不是 step 的區域函數)的測試不標歸屬、不進 law 分母;要測就另開測試檔,`lint trace` 把它列成內部測試。

## 收尾

本波全綠或停在 GAP 時,conductor 對開發者回報:

- open 的 GAP 清單,各附「需要回答什麼」;回答照 features.md「修訂(REV)」那一句分流(答案要調整既有的 law、或文檔還沒 `verified`,走 `dev-flow:scope-laws`;`verified` 的文檔而答案不動既有的 law 或只新增一條,走 `dev-flow:scope-revise`;問的是全域 Law 走 `dev-flow:global-laws`,問的是驗收走 `dev-flow:require-design`),結案的 step 下一波重派。
- `devflow status` 顯示達成 → 直接改 `verified`。這條里程碑綁的每份文檔都達成,這條里程碑就正式達成,分支可以整合。
- 決策紀錄「Faked / Unverified」每一列要嘛換成真的了、要嘛有一條 open GAP 講它為什麼還假;兩者都不是的,不算達成。
- qa 與 refactor 自己決定的事整份列出供抽查,不逐條問。
- 寫決策紀錄的「Verification」與「合併時要看」(「決策紀錄」),連同所有改動 commit 在分支上;不合併、不發 PR,那是 `dev-flow:integrate` 的事。
- 定錨區塊(tooling.md「收尾定錨」)。

開發者的決定只在四個地方發生:立案與需求的對談(`dev-flow:kickoff` / `require-design`)、Law 對談(`dev-flow:scope-laws`,含全域的候選逐條說要不要;抽上去的批准在 `dev-flow:global-laws`)、回答 GAP、選定 law 的調整與確認修訂(scope law 在 `dev-flow:scope-laws`、全域 Law 在 `dev-flow:global-laws`,先看影響範圍再選選項;既有的 law 不動的修訂與它新增的 law 在 `dev-flow:scope-revise`,先看影響範圍再確認、新增的逐條拍板)、整合的仲裁(`dev-flow:integrate`)。開發者只說,文檔一律由 skill 寫。build 不替開發者做契約級決定,也不事後追認。

## 仲裁

有紅燈時,歸因先於修改。每條紅燈先答「它對應哪條 law 或 example」:

| 歸因 | 處置 |
|---|---|
| 對得上,測試與原文一致 | 實作不符:附 law 原文派 refactor,不動測試、不附測試碼 |
| 對得上,測試與原文不符 | qa 誤讀:附 law 原文重派 qa,不附實作碼;判定只依原文,不拿實作行為當依據 |
| 對不上,或文檔沒涵蓋 | 文檔 bug:開 GAP 停該 step,不發委派、不讓 qa 與 refactor 協商、conductor 不自己補 law |
| 同一份文檔三輪仍紅 | 停止並升級,附結構性原因(簽名切錯、laws 互相矛盾、example 與 law 不一致、引用的 step 行為與它住的那份文檔不符、型別裝不下這條 law) |

qa 與 refactor 只做歸因,裁決由 conductor。

## 測試跑幾次

| 誰 | 範圍 | 次數 |
|---|---|---|
| spike-impl | 離場前整套 | 1 |
| qa | 自己寫的測試檔 | 1 |
| refactor | 本份文檔的子集(`system.md` 的子集指令) | 互動 1;委派 0 |
| conductor 收到 qa | 首跑:qa 的測試在現有的程式碼上 | 1 |
| conductor 判定 | 本波子集 | 1 |
| conductor 仲裁每輪 | 上一輪紅的那幾條 + 本波子集 | 每輪 1 |
| conductor 本波全綠後 | 整套,整條迴圈只這一次 | 1 |
| conductor 派驗收測試 | 那條 `R-n#ACCEPT` / `INV-n#LAW` 加整套 | 1 |
| 修訂目標(有 REV) | 委派前先跑整套當基準線 | 1 |

整套回答「有沒有連累別人」,只在自己這一塊全綠之後問一次;在自己的分支上,「別人」是主線合進來時的狀態。

## 決策紀錄

`.design/journal/<鍵>.md`,照 `templates/journal.md`,一條 build 分支一份。**它是為了達成這條里程碑的 Goal / Scope 而產生的實作決策紀錄**:每一列回答「為了達成這條里程碑,決定了什麼、為什麼、受什麼約束」。它不是過程的流水帳——試了幾次、先做了哪個檔、花了多久都不寫;寫下來的每一項,都是之後有人(scope-laws、refactor、整合者)要拿來做下一個決定的東西。欄位固定、多半是表,讀它的人與 `devflow status` 都靠欄位找東西,不靠通讀。它只活在 build 分支:整合把內容寫進 PR 內文、把該留下的升成 ADR 後刪檔,主線沒有決策紀錄。

切片六節由 `dev-flow:spike-impl` 離場前寫:

| 節 | 裝什麼 | 誰讀 |
|---|---|---|
| frontmatter | `key`、`branch`、`base`(開分支時主線的 sha)、`verdict`(`feasible` / `infeasible`)、`updated` | 整合 |
| Goal / Scope | 這份紀錄服務的需求與里程碑那一句、這一片做到了什麼、屬於這條里程碑卻明確沒做的 | scope-laws |
| Entry | 怎麼把它跑起來看到行為,一道指令 | scope-laws 拿它產生例子問開發者 |
| Decisions | 表,一列一個決定:`Decision`(為了達成這條里程碑決定了什麼)、`Reason`(為什麼,一句)、`Constraint`(這個決定受什麼約束:全域 Law 的哪一條(領域不變量、層的規則、對外 I/O 的契約)、需求的驗收或外部系統;沒有寫「-」)、否決的做法、可逆、跨文檔 | scope-laws 把只關一份文檔的搬進那份的「決定」;整合把不可逆又跨文檔的升 ADR,把 Constraint 指到全域 Law 的彙整成瘦身的證據 |
| Assumptions & Invariants | 表:這一片當成成立的前提(一句可判定的話)、來源(刻意 / 順手)、在哪 | law 的直接來源:scope-laws 的題目清單,「順手」的就是開發者還沒被問過的 |
| Faked / Unverified | 表:什麼是假的、在哪、真的該是什麼 | refactor 的待辦;收尾時逐列對 |
| Touched | 動到的模組與層、共用型別、新的對外 I/O、建置設定 | scope-laws 補對外 I/O 表;整合的衝突預報 |

後兩節由 conductor 收尾時寫,達成或停在 GAP 都寫;修訂與驗收測試那幾波沒有切片,決策紀錄從這裡寫起(文檔退役那一波由 `dev-flow:scope-laws` 寫:「Goal / Scope」寫為什麼退役,「Decisions」一列可逆欄為否、跨文檔欄為是,整合靠它升 ADR):

| 節 | 裝什麼 |
|---|---|
| Verification | 每份文檔的簽名 m / n、觀察點 j / k、laws g / k,與它是不是 `verified`;首跑該紅(scope-laws 寫)與首跑結果;qa 與 refactor 自己決定的事,一條一句;本分支開的 GAP 與「需要回答什麼」;整套在本分支跑的指令、log 路徑、綠紅分佈。契約級決定不在這裡,它們在文檔的「決定」與 REV |
| 合併時要看 | 與哪些文檔的 step 住同一個檔案、哪些檔別份也可能動、合併後預期什麼會變 |

## 整合

`dev-flow:integrate` 把達成的分支合成一條整合分支 `integrate/<YYYY-MM-DD>-<slug>`,整套綠了才發 PR。它是唯一發 PR 的出口,主線只透過它前進。整合者是 conductor 的身分:不寫實作、不寫測試、不補 law、不改任何本體,也不改任何一條 law——scope law 與全域 Law 都一樣,它只提出變更建議。

- **候選**:沒合進主線的分支,開發者指定就只合那些。`build/*` 要有 `journal/<鍵>.md`、而且 `devflow status` 在那條分支上顯示它的文檔都達成才收,沒有代表還沒收尾;文檔退役的分支,文檔已經刪了,`devflow lint all` 沒有新的紅、整套綠就收;決策紀錄 `verdict: infeasible` 的分支不合,只收它的決策紀錄(見下面「走不通的切片」);`plan/<slug>` 只動 `.design/`,`devflow lint all` 沒有新的紅就收;其餘分支(手動改的、專案沒有 `.design/`)照分支名或 commit 訊息對到文檔全名,對不到就寫分支名。當前分支是主線而且有未提交的變更或領先的 commit,先開一條分支把它帶走,不從主線發 PR。
- **順序**:`plan/` 最先;有決策紀錄的照需求的優先 → 里程碑順序 → 分支名,被引用的文檔在引用它的之前;其餘照開發者指定的順序。
- **衝突三類**:清單型(建置設定的檔案清單、匯出清單、`gaps.md`、模組表、對外 I/O 表、Features 表)兩邊都留;相鄰行的加法兩邊都留;同一個簽名或本體兩邊都改 = 兩條線對同一段程式碼假設不同,停下,走下面的仲裁。GAP 撞號,後合進來的往上移;GAP 的號只住 `gaps.md`,移號不牽動別處。
- **重複的 step**:兩條分支各寫了一份同樣的 step(合完 `lint sig` 報同名簽名兩邊都沒註明「見」)→ 一個 step 與它的 law 只住一份文檔(features.md「編號與引用」)。問開發者留哪一份,預設留先合進主線的那一份;另一份不進這次整合,寫成 GAP 退回,它的工作樹合入主線後由 `dev-flow:scope-laws <全名>` 刪掉自己的那個 step 與它的 law、改成引用,再 build。整合者不自己改條文。
- **判準**:**Integration MUST NOT reduce Law satisfaction.** 合完跑建置與整套一次,`devflow status --tests <log>`、`devflow lint all`(含 `lint global` 的三道)。合併之前在各自分支或主線上成立的每一條 law,合併之後都要仍然成立:每份決策紀錄宣稱達成的文檔合併後仍達成、全域 Law 三類沒有新的紅、領域不變量全綠;原本達成的需求沒有退回未達成;決策紀錄「合併時要看」預期的變化如期發生;沒有新的紅、沒有新的警訊。
- **合併後紅**:先歸因,不改碼。那條 law 屬於哪份文檔、在它自己的分支上綠不綠(看決策紀錄的「Verification」)、哪幾條分支與它共用檔案(看決策紀錄的「Touched」與「合併時要看」);候選超過一條才逐條重合找出第一條讓它紅的分支。分支綠、合併紅 = 兩條線的 law 或假設互斥,走仲裁。
- **仲裁**,一次一條,問開發者:
  - 呈現的是反例,不是兩段條文:測試縮小後的那個輸入、那條 law 說結果該是什麼、合併後的程式碼算出什麼、兩邊各依哪一條 law 或決策紀錄「Assumptions & Invariants」的哪一列。
  - 三個選項,各附當下成本、之後的代價、可不可逆。它們是給開發者的**變更建議**:整合者不准自己選,也不准因為哪一個讓合併最快過就推它:

    | 選項 | 之後怎麼走 |
    |---|---|
    | 以 A 為主 | B 不進這次整合。A 合進主線後,B 的工作樹合入主線,`dev-flow:scope-laws` 改 B 那條 law,再 build |
    | 收窄定義域 | 兩條 law 各自的 `forall` / `given` 排除對方的情境(金額不為負,排除退款單)。兩份文檔各一次 `dev-flow:scope-laws` 的修訂,只重派 qa 改那條測試;實作多半不必動 |
    | 提煉上層 Law | 建議立一條領域不變量(要過准入四條);開發者明確批准後,由 `dev-flow:global-laws` 走「全域 Law 的變更」落筆(`devflow invariant add`),不是整合者。兩條分支都退回,各自 `dev-flow:scope-laws` 讓自己的 law 服從它,再 build |
  - 開發者選了什麼,寫成 GAP(角色 conductor,目標那條 law,「需要回答什麼」寫選項與開發者的原話)放進被退回的那條分支的 `gaps.md` 並 commit;`dev-flow:scope-laws` 的 REV 依欄引用它。整合者自己不改 law、不現場合併兩邊的邏輯。
- **全域 Law 的變更建議**:合併後紅的是全域 Law(`lint global` 的紅、領域不變量的測試紅),或決策紀錄的 Constraint 欄顯示某一條全域 Law 逼出了沒道理的決定,整合者照同一個格式提建議:反例、選項(一定含「不改,退回違反它的那條分支」)、各自的代價。**任何全域 Law 的修改、放寬、替換或刪除,都必須經開發者明確批准;整合者只能提出變更建議,不得自行決定變更,也不直接修改全域 Law。** 批准的那個選項寫成 GAP(角色 conductor,目標寫那條全域 Law),由 `dev-flow:global-laws` 完成,完成後重新驗證受影響的工作(laws.md「全域 Law 的變更」);這次整合只合不受它影響的分支。
- **ADR**:每份決策紀錄「Decisions」表裡可逆欄為否、而且跨文檔欄為是的那幾列,各問開發者一次要不要升 ADR(`devflow claim adr <slug>`,四節從那一列與決策紀錄的「Goal / Scope」寫);收進這次 PR 的每一條全域 Law 變更、每一份退役的文檔一定各有一條,記為什麼。其餘的權衡留在 PR 內文。
- **走不通的切片**:`git show <分支>:.design/journal/<鍵>.md` 讀決策紀錄,升成一條 ADR(情境 = 那條里程碑要做到什麼,決定 = 這個做法不走,否決的替代方案 = 試過的做法與卡住的地方,後果 = 下次之前要先知道的事),分支與工作樹刪掉,不合它的程式碼。
- **PR**:決策紀錄內容進 PR 內文後刪決策紀錄檔;各決策紀錄「Decisions」表裡 Constraint 欄指到全域 Law 的列彙整成一節,供開發者判斷哪條全域 Law 該瘦身(要不要變更仍由開發者提出或批准);標題英文、內文繁體中文,章節固定(`skills/integrate/SKILL.md`)。
- **清理**:整合開頭先刪已合進主線的 `build/*` 與 `plan/*` 分支,連同它們的工作樹。

## 委派模型

呼叫 Agent 工具時明確帶 `model`,不省略讓它繼承主 session:

| 角色 | skill | 模型 |
|---|---|---|
| qa | `dev-flow:qa` | `sonnet` |
| refactor | `dev-flow:refactor` | `sonnet` |
| spike-impl、scope-laws、scope-revise、conductor(你) | — | 不委派,不指定 |

qa 拿到的是已經拍板的 law,做的是翻譯;refactor 拿到的是 law 原文與紅燈歸因,做的是讓它成立。契約判斷在 Law 對談那一層,那一層由開發者與你當面做;切片要看得到整個專案,也由你自己做。
