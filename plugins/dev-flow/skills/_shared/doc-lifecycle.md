# 文檔生命週期(建檔、編號、引用、frontmatter 規格)

`_shared/conventions.md` 的分片。**要新建 / 改名 / 編號任何 `.design/` 文檔、要寫跨文檔引用(`depends-on`、`related-*`、內文提到別份文檔),或要確認某個 frontmatter 欄位怎麼寫時讀這份**;只改既有文檔的 `status` / `updated` 不用讀。

委派模式下 subagent 的編號與檔名**由編排者指定**(`delegation.md` 第 3 條),但引用格式仍然要照本片寫。

**這份很長,不要整份讀。** 用 `arch-audit/scripts/doc-section.mjs` 取需要的節,它會在末尾附上**你沒讀到的章節目錄**(只有標題)——那一段是保險:章節式讀取最危險的失敗模式是「讀到空的,於是以為那條規則不存在」,或「下面這張表過期了,新加的節沒有人讀得到」,兩者都不會報錯。看到目錄裡有可疑的節,再跑一次把它讀進來。

```
node "<S>/arch-audit/scripts/doc-section.mjs" <本檔> <節名>...
node "<S>/arch-audit/scripts/doc-section.mjs" <本檔> --list     # 只看目錄
```

| 你要做什麼 | 節名(照抄進上面的指令) |
|---|---|
| 建 / 改 **feature、enhance、bugfix** 文檔 | `命名與編號規則 任務文檔 文檔引用格式 description`;`/spec-design` 再加 `狀態與生命週期` |
| **判斷一件事該是 F 還是 E、該開新檔還是修訂舊檔** | `六種分類與分流判準` |
| **修訂既有 F / E**(`/spec-redesign`) | `狀態與生命週期 "修訂(rev 與 REV)"` |
| 建 / 改 **`system.md`、`design.md`** 或它的分冊 | `文檔角色與權威來源 資料夾結構 架構文檔 清單欄位格式 description` |
| 建 / 改 **`G-C00x` 共用契約** | `全域契約文檔 命名與編號規則 文檔引用格式` |
| 建 / 改 **`spec-gaps.md`** 或 **`build-log.md`** | `架構文檔`(兩者的 frontmatter 規格都在這一節) |
| 建 **ADR** | `ADR 命名與編號規則` |
| 建 / 改 **spike** 文檔 | `命名與編號規則 文檔引用格式 description "spike 文檔"` |
| **給任何東西編號或取縮寫** | `編號與縮寫註冊表` |
| 只寫**跨文檔引用** | `文檔引用格式` |
| **對帳 / 審查**(`/arch-audit`) | 全份讀,不用切 |

## 文檔角色與權威來源

### 六種分類與分流判準

**feature 與 enhancement 都是「功能」,差別只在重要度;兩者都不是「動作」。** 判準各一句話,答得出來才建檔:

| type | 意思 | 判準(可查的一句話) | 位置 | 生命週期 |
|---|---|---|---|---|
| **F** | 子系統的核心功能 | 拿掉它,這個子系統就**無法履行 `system.md` 給它的職責** | `subsystems/<slug>/features/F00x` | planned → specced → done |
| **E** | 子系統的擴充功能 | 拿掉它,子系統**照樣履行職責**,只是少了某個好處 | `subsystems/<slug>/enhancements/E00x` | planned → specced → done |
| **B** | 子系統的缺陷 | 某條 law 或 example 在現況下不成立 | `subsystems/<slug>/bugfixes/B00x` | open → closed |
| **G-F** | 跨子系統核心功能 | 要兩個以上子系統各做一段才成立,而且**任一段缺,某個開發階段就達不成** | `.design/features/G-F00x` | planned → specced → done |
| **G-E** | 跨子系統擴充功能 | 要兩個以上子系統配合,但拿掉它階段照樣達成 | `.design/enhancements/G-E00x` | planned → specced → done |
| **G-B** | 跨子系統核心功能的障礙 | 某份 G-F 的 law 在現況下不成立 | `.design/bugfixes/G-B00x` | open → closed |

**判準要寫進檔**:F 與 E 的 `## 契約` 各多一行,腳本查有沒有填(缺了進「提示」,和契約六欄同級):

```markdown
- **核心判準**:少了它,auth 就無法「讓使用者以憑證換取工作階段」(system.md 子系統劃分 §auth 職責第 1 句)   ← F
- **非核心判準**:少了它,auth 照樣完成登入;它加的是「記住裝置,30 天內免二次驗證」            ← E
```

F 的那一行必須**指到 `system.md` 職責的哪一句**;指不到職責的 F 就是分類錯了。這是 `contract-readiness.md` A10 的反向:A10 查「職責有沒有落點」,這一行查「落點有沒有職責」。G-F 的核心判準指到**開發階段**(「少了它,S2 無法達成」)。

**分類在 `/subsys-design` 規劃當下做**,和鑄號建檔同一個動作;E 也在那時鑄號建檔(它和 F 一樣是規劃出來的功能)。**分類錯了(F 其實是 E,或反過來)是唯一允許「刪檔重建」的情況**:type 改、資料夾搬、重新 `--claim` 配號,舊號永久空缺,在 `design.md` 的決策段留一行「F003 重分類為 E002,理由:___」。

**重要度絕對 = 分母**:子系統「可運作」只看 F(F 全 done 且無 planned 模組群);E 另計「擴充度」,**不進可運作、不擋開發階段達成**。開發階段達成 = 涵蓋子系統全部可運作,且該階段的 G-F 全 done。

**要動既有功能時,只問一句:這個改動能不能被描述成「拿掉它,原功能還在、行為不變」?**

| 答案 | 意思 | 去處 |
|---|---|---|
| 能 | 這是一個**新的、可獨立拿掉的能力** | 新檔。核心判準答「不能運作」→ F;答「照樣運作」→ E |
| 不能 | 它**改變了既有功能**的行為、介面、邊界或效能承諾 | **修訂原檔**(`/spec-redesign`,規則見「修訂(rev 與 REV)」),不開新檔 |

效能優化、重構、換演算法、改簽名、收回「明確不做」、放寬定義域——全部是「不能」,全部修訂原檔。**不准為了「改既有功能」開 E**:那會讓 F 檔停在初版,三個月後沒有人知道它現在長什麼樣。

**不是任務文檔的四種**(不參與 F/E/B 編號、不列入進度統計):

- `build-log.md` —— 編排過程(配號表、批次澄清的決策、各波次結果、待確認假設與自裁清單、閘門結論)。`/arch-audit status` 不掃它;它的價值在「中斷後能接續」與「事後查得到當初為什麼這樣決定」
- `spec-gaps.md` —— **qa 與 impl 對 spec 提出的問題清單**(協議見 `spec-roles.md`)。**只裝 open 的條目**——結案 = 寫 REV 並刪條目,檔案空了就刪檔;標 `resolved` 留著的是墓碑,腳本列提示。有條目就代表有項目正卡著等 spec 修訂:`/arch-audit status` 會列出這些條目,並在**被那條 gap 卡住的那份文檔**那一列標 `⚠卡auth/GAP-n`(靠條目標題 `## GAP-1(auth/F002-token-refresh / qa)` 裡的文檔全名認親,標題不寫文檔全名的 gap 標不到任何人),`/subsys-build` 開跑前會擋。**委派模式下只由編排者單線寫入與配號**,subagent 一律只回報(理由見 `delegation.md` 第 4 條)
- `design.md` 的**分冊**(`subsystems/<slug>/` 根層、`design.md` 以外的 `.md`)—— 契約章節大到一份裝不下時拆出去,但**拆出去的仍然是 `design.md` 的一部分**。兩種 `type`:`contract-part`(某個模組群的對外契約與 DTO)、`decisions`(訪談定案與否決理由)。不編號,用 `parent: <子系統 slug>` 認親;`design.md` 要指明哪一群的契約在哪一份。**凡是讀「該子系統 `design.md` 全文」的地方,一律連分冊一起讀**——契約條目可能整段住在分冊裡,只開 `design.md` 會誤判「契約缺漏」(`contract-readiness.md` A3 已放寬為跨檔比對)。拆分冊有成本(對帳從開一份檔變成開好幾份),沒大到讀不動就不要拆
- `spikes/SPK-00x-<slug>.md` —— **可行性驗證的紀錄**(`/spike` 產出)。替某個決定生產證據,自己不是任務:問題、判準、幾輪 `RND-n`、verdict、以及結論餵給哪幾份文檔(`feeds`)。程式碼只在 `open` 期間活在 sandbox `spike/SPK-00x-<slug>/`,結案刪、每輪 sha 留在文檔。`open` 的算待辦(計入 exit code、不進百分比);`concluded` 而 `feeds` 空的或指不到文檔是不一致。規格與規則見下方「spike 文檔」。**委派模式下只由編排者寫**,subagent 只寫自己的程式碼子資料夾(理由同 `delegation.md` 第 4 條)

**權威來源**(這一格是誰的事實,就只能由誰改):

- `contracts/G-C00x-<slug>.md` —— 多方共用契約的**唯一**權威:兩個以上子系統都要用、又不屬於任何一方的契約住這裡(判準見 `boundary-rules.md`「知識歸屬」)。`/subsys-design` 建檔與修改,`/arch-audit` 對帳,消費端只引用不重新定義
- `system.md` 的 `subsystems` —— 子系統的**完整名冊**,含規劃中、還沒有 `design.md` 的。`/system-design` 在「子系統劃分」定案當下一次寫齊;`/subsys-design` 建檔時不動它,只有新增或廢棄子系統才改
  - 名冊列了、`subsystems/<slug>/` 不存在 = **已規劃未建檔**,是待辦(exit code 1),**不是**不一致;有資料夾、名冊沒列才是不一致
  - **分母必須來自規劃,不能來自產出**(本流程被修過最嚴重的一個洞):名冊若只收已建檔的,它就跟資料夾清單同義,雙向比對永遠成立,而還沒開工的那一大半在任何進度數字裡都不存在——報表於是做得愈少、看起來愈完整
- `system.md` 的「開發階段」表 —— 全專案唯一的**產品級分母**,狀態欄只認「未開始 / 進行中 / 已達成」。任何一階不是「已達成」,盤點就不得宣告專案完成
- `design.md` 的「模組群」表 —— 子系統內部的領域劃分,有多個平行領域(而非一條資料流管線上的幾個模組)時必填,狀態只有 `active` / `planned`。`planned` 那一群的契約與 feature 檔都還沒建,**不在該子系統的進度分母裡**,`/arch-audit status` 單獨列出。只有一個領域可整張表省略
- `features/F00x-<slug>.md`、`enhancements/E00x-<slug>.md`、`.design/features/G-F00x-<slug>.md` —— **一個功能的唯一權威,從它被決定要做的那一刻到它被廢棄,都在這一份檔**。它不是「spec 寫完才建的檔」:`/subsys-design` 決定要做這件事的當下就鑄號建檔,只寫 `## 契約` 一節(`planned`);`/spec-design` 往同一份檔追加 `## Laws` 等節(`specced`);收尾把 status 改 `done` 並回寫 `code-paths`;**之後任何改動都修訂這一份**(`rev` +1、`## 修訂記錄` 加一條),不開第二份檔。**沒有第二個地方記這個功能的任何事**——沒有路線圖的一列、沒有 `doc` 欄、沒有分開存放的契約文件、沒有「補做它的 E」
- `design.md` 的「功能總覽」表 —— **生成的**索引(`scan-status.mjs --write-index`,夾在 `<!-- BEGIN/END FEATURE INDEX -->` 之間)。手改無效,下次生成就蓋掉。它只答「這個子系統有哪些 feature、走到哪」,每一格的權威都在各自的 `F00x` 檔
- 每份 `design.md` 都要有 `parent: system`,讓任何讀者能從子系統回溯主架構

### 狀態與生命週期

一個 feature ＝ 一份檔,從搖籃到墳墓都在 `features/F00x-<slug>.md`。狀態不是一個「要記得改」的欄位,而是**這份檔寫到哪裡**:

| status | 意思 | 判準 | 誰推到這一格 |
|---|---|---|---|
| `planned` | 決定要做、邊界已定,還沒有規格 | 有 `## 契約`,沒有 `## Laws` | `/subsys-design`(批次鑄號建檔) |
| `specced` | 規格與骨架都在,還沒實作完 | 兩節都有 | `/spec-design` |
| `done` | 實作完成、測試過關 | frontmatter 明寫,且 `code-paths` 非空 | `/spec-impl`(委派模式由編排者) |
| `dropped` | 決定不做了 | frontmatter 明寫 | 人 |

**前兩格由檔案內容決定,說不了謊**:`## Laws` 只有 `/spec-design` 寫得出來,所以 `planned` 的檔不可能有 Laws,也不需要有人記得去改欄位。`done` 只能明寫,所以 `scan-status.mjs` 交叉檢查三種矛盾——說 `done` 卻沒有 `## Laws`、說 `planned` 卻有 Laws、`done` 而 `code-paths` 是空的。

`## 契約` 是 `/subsys-design` 的產出,**`/spec-design` 只能往下加節,不准改它**。裡面那條 `- **明確不做**` 是這個 feature 負向邊界的唯一紀錄:刪掉之後「當初為什麼沒把 X 收進來」就只能從 Laws 的沉默去猜,而**沉默不可區分於遺漏**。要改契約一律走 `/spec-redesign`,由它判定這次改動是否結構性(判準見那份 SKILL)。

`E00x` / `G-E00x` 走**同一條漏斗**:它們是規劃出來的功能(只是非核心),在 `/subsys-design` 鑄號建檔時就有 `## 契約`(含非核心判準),`planned` 起算。只有 `B00x` / `G-B00x` 沒有 `planned`:缺陷是看著既有程式碼提出來的,建檔當下就是 `open`。

`G-F00x` 多一格判準:`done` 要求分工表列的每一份 F 都 `done` **且**端到端測試綠;分工 F 有未 done 而 G-F 標 done,`scan-status.mjs` 列為不一致。

### 修訂(rev 與 REV)

**任何對既有功能的改動都修訂原檔**(分流判準見上方「六種分類與分流判準」)。修訂是 `/spec-redesign` 一次做完的事——定層級、改條文、留 REV、講明重委派誰——所以**沒有「修訂中」這個狀態**;改到一半的檔只存在於 git 工作區。

- frontmatter `rev: 0`(初版 0),每修訂一次 +1;原檔常駐一節 `## 修訂記錄`,一輪一條 `REV-n`,**只寫結論不寫過程**:

  ```markdown
  ## 修訂記錄
  - REV-1(2026-09-10,依 qa 提問「過期判定用哪個時鐘」):過期判定改用伺服器時鐘,不再讀客戶端時間
    - 動到:LAW-2 改寫、LAW-5 新增(時鐘偏移上限)、介面 `refresh(req)` 多一個 `now` 參數
    - 保護:REG-1(既有 session 在修訂前後都還能 refresh)
    - 重委派:qa(LAW-2、LAW-5、REG-1)、impl(`refresh`)
    - 連動:billing/F004-invoice-session 的 `## 契約` 同步(Level 2,design.md「模組間公開介面」§3)
  ```

  「依」欄寫**來源與那一句話**,不寫已經刪掉的條目編號:`qa 提問「…」`、`閘門 WAVE-2「…」`、`SPK-003-storage-engine`、或 `開發者:效能`。效能修訂把基準線寫進新的 law(「p95 ≤ 100ms,基準線 2026-09-18 量測 400ms」)
- **狀態機**:`done` 被修訂 → 退回 `specced`(文檔已是新版本、實作落後於它),`rev` +1;`planned` / `specced` 被修訂 → 狀態不變,`rev` +1。做完再推 `done`。沒被 REV 點名的 law 測試照樣綠,只重做被點名的
- **升版不是決定**:追加 REV 與 `rev` +1 是同一個動作,人不另外判斷。`rev` 只是 REV 條數的快取,腳本查兩者對不上就報不一致,所以它不會變成第二個真理
- **law 編號單調遞增,刪掉的號永久空缺**:REV 刪掉 LAW-3,之後新增的是 LAW-7 不是 LAW-3。`lint-laws-traceability.mjs` 的「幽靈引用」靠這條才抓得到「測試還在守一條已經不存在的 law」
- **`REG-n` 住在原檔**:修訂時「必須不變的既有行為」寫成回歸 law,和被修訂的 law 同一份檔
- **「知道要修、還沒修」用 GAP 記**:開發者自己發現設計有問題也寫一條(`## GAP-4(auth/F001-login / 開發者)`),那份檔就會被標 `⚠卡`、派工狀態變「卡住」、`/subsys-build` 會擋
- **GAP 結案與 ASM 裁決都是修訂,結案即刪**:寫 REV 的同一個動作刪掉條目,「依」欄把原句帶過去(`依 qa 提問「過期判定用哪個時鐘」`、`依 閘門 WAVE-2「session 存哪」`)。定案後的問題不需要被找回;留著只是干擾。`spec-gaps.md` 只裝 open 的,`## 待確認假設` 只裝還沒裁的,兩者空了就刪(節 / 檔)
- **下游不靠自己發現上游改過**,責任在改的人:簽名改了編譯器會告訴下游;語意改了(型別沒變、意思變了)由 `/spec-redesign` 用 `scan-status --doc` 拿反向依賴、逐份同步下游契約、寫進 REV 的「連動」欄。腳本補一條對帳當漏網之魚的提示(不進 exit code):X 依賴 Y,Y 最後一條 REV 晚於 X 的 `updated`,**而且那條 REV 的「連動」沒點名 X** → 「Y 修訂到 rev n 時沒有點名 X,X 也沒對過帳」。改的人有列到 X 就不報——提示消失的方式是上游盡到責任,不是下游 bump `updated`
- **腳本對帳**(進不一致):`rev` 與 REV 條數對不上;`done` 但最後一條 REV 晚於 `updated`;REV「動到」點名的 law 在檔裡不存在

過程(為什麼吵成這樣、否決了什麼)才進 `archive/<F00x-slug>-rev<n>-process.md`,規則見下一節。

### `done` 的收束(過程章節的退場)

推到 `done` 不只是把 status 改一個字,那是**這份檔從「工地」變成「規格」的那一刻**。工地上必要的東西——待確認假設、閘門裁決、修訂記錄、查證紀錄——收工之後價值遞減,但**沒有任何機制會刪它們**:程式碼被編譯器與測試逼著保持誠實,文檔沒有東西逼它。留著的代價不是佔版面,是**下一個讀者會把工地筆記讀成現況**——尤其是被委派出去、只讀得到這一份檔的 subagent,它沒有辦法質疑。

所以 `status` 改成 `done` 的**同一次動作**裡,過程章節要逐節處置完,三種去處:

| 章節 | 處置 |
|---|---|
| `## 待確認假設` | 推到 `done` 時**必須已經是空的**:每條 ASM 在閘門裁決當下就處置完(結論寫進 `## 不可逆決定` / 契約修訂行 / ADR,記一條 REV,刪掉條目)。還有條目 = 還沒裁,不能 `done` |
| `## 修訂記錄` | **常駐,不搬**。它是這份檔的版本史,一條 REV 只留結論(動到 / 保護 / 重委派 / 連動);修訂的討論過程才搬 `archive/<F00x-slug>-rev<n>-process.md` |
| `## 閘門裁決紀錄`、`## 已定案的委派判斷`、各種查證紀錄 | 整節搬進 `archive/<F00x-slug>-process.md` |
| `## 實作備註` | 只留**讀碼看不出來**的那幾條(為什麼繞路、踩過什麼坑、哪個外部行為不如文件所寫),其餘刪——讀碼看得出來的,碼是權威 |
| `build-log.md` 已驗收的階段 | 摺成一行結果(階段、波次數、feature 清單、閘門結論),細節搬 `archive/` |

**不留墓碑**。「已於 X 日裁決,不再是待確認假設」這種**留在原位**的註記是最糟的形式:它同時佔著版面又宣告自己無效,而讀者要讀完整條才知道可以跳過。裁決的結論有它該去的地方,搬過去,原地刪乾淨。

`archive/` 是**退場區,不是第二個規格區**:

- 檔案帶 `type: archive`、`parent: <子系統 slug>`,**不編號**
- `scan-status.mjs` 只讀子系統根層與 `features/` `enhancements/` `bugfixes/` 三個資料夾,所以存檔不進任何進度分母
- `scan-ids.mjs` 預設略過它(號已由現役文檔接手),`lint-laws-traceability.mjs` 也跳過——存檔裡的 law 不該再要求測試引用得到

判準一句話:**要留的是「三個月後有人問『當初為什麼』查得到答案」,不必留的是「當初怎麼吵到那個答案」。**

## 資料夾結構(專案內,樹狀)

設計文檔樹與系統架構樹同構:根節點是主專案架構,第二層是各 subsystem。

```
.design/
├── system.md                        # /system-design 產出:Level 1 主架構
├── subsystems/
│   └── <subsystem-slug>/            # 資料夾名 = 子系統 slug(英文 kebab-case)
│       ├── design.md                # /subsys-design 產出:Level 2 子系統架構(「功能總覽」由腳本生成,不手寫)
│       ├── build-log.md             # /subsys-build 產出:委派決策記錄與各波次執行結果(只有跑過才有)
│       ├── spec-gaps.md             # /spec-qa、實作 skill 追加:spec 模糊處待修訂清單(有 gap 才有)
│       ├── contract-<模組群>.md      # design.md「對外契約」的分冊(契約大到裝不下才拆;type: contract-part)
│       ├── decisions.md             # 訪談定案與否決理由(拆了分冊才有;type: decisions)
│       ├── archive/                 # done 收束時搬進來的過程章節(type: archive,不編號、不進分母)
│       │   ├── F001-<slug>-process.md
│       │   └── F001-<slug>-rev2-process.md   # 某一輪修訂的討論過程(結論留在 F001 的 ## 修訂記錄)
│       ├── features/
│       │   └── F001-<slug>.md       # 核心功能:/subsys-design 建檔(planned)→ /spec-design 補規格(specced);改動一律修訂本檔
│       ├── enhancements/
│       │   └── E001-<slug>.md       # 擴充功能(非核心):同一條漏斗,如 E001-remember-device.md
│       └── bugfixes/
│           └── B001-<slug>.md       # /bugfix 產出,如 B001-null-pointer-auth.md
├── contracts/
│   └── G-C001-<slug>.md             # 多方共用契約(兩份以上 G-F/G-E 共用,或兩個以上子系統共用且沒有 G-F 擁有那段互動)
├── features/
│   └── G-F001-<slug>.md             # 跨子系統核心功能:契約含分工表,各段是各子系統的 F(part-of 回鏈)
├── enhancements/
│   └── G-E001-<slug>.md             # 跨子系統擴充功能(同 G-F 形狀,非核心、不擋階段)
├── bugfixes/
│   └── G-B001-<slug>.md             # 跨子系統核心功能的障礙(/bugfix 產出,related-feature 指 G-F)
├── migration-v3.md                  # 只在遷移期間存在:既有 E 的分流帳本(type: migration,不編號、不進分母)
├── spec-gaps.md                     # 全域文檔的 spec 模糊處(有 gap 才有)
├── spikes/
│   └── SPK-001-<slug>.md            # 可行性驗證紀錄(/spike 產出;非任務文檔,程式碼在下面那個 sandbox)
└── adr/
    └── ADR-001-<slug>.md            # 架構決策紀錄,全局共用

spike/                               # 與 .design/ 同層:常駐的共用 sandbox(依賴檔、假資料、harness 放根層,不刪)
└── SPK-001-<slug>/                  # 只活在 open 期間,結案時刪、sha 留在文檔;候選比較時再分子資料夾;產品程式碼禁止 import
```

**舊版路徑相容**:0.6.0 起設計文檔才改放 `.design/`;專案只有舊版 `docs/arch/architecture.md` 體系時,提醒開發者用 `/system-design` 遷移,遷移前可照舊以舊檔為燈塔運作,但**不得在舊結構下新建文檔**。

## 命名與編號規則

- 檔名一律**英文 kebab-case**;內文一律**繁體中文**;日期一律 `YYYY-MM-DD`
- 編號**三位數**遞增。**任務文檔與 ADR 一律用這一行鑄號,不准自己數資料夾**:

  ```
  node "<S>/arch-audit/scripts/scan-ids.mjs" .design --claim <組> --slug <kebab-slug>
  ```

  組寫 `G-C` / `G-F` / `G-E` / `G-B` / `ADR` / `SPK` / `<子系統>/F` / `<子系統>/E` / `<子系統>/B`。腳本掃過所有分支與 worktree 之後配號,**並當場把檔案建在慣例位置**(`SPK` 另建同名的程式碼資料夾 `spike/SPK-00x-<slug>/`)(照本片「Metadata 標準」把該類文檔的 frontmatter 欄位寫齊,內容留空),印出三樣:`<id>`、檔案路徑、**全名**(`auth/F003-token-cache`——之後每一次提到這份文檔都用全名,見「文檔引用格式」)。內容由你接著填,第一件事是補 `description`。查現況用不帶 `--claim` 的同一支腳本(`--next` 只印下一個可用號,`--fetch` 連遠端一起看)。

  **F 與 E 的號在 `/subsys-design` 一次配齊**(那個子系統決定要做哪幾件事的當下),不是等到寫 spec 才一個一個配。一次一批反而**更不會撞號**:整批落在同一個 commit,而分散在幾週內、幾條分支上一次配一個才是撞號的溫床。只有 B 沒有規劃階段,提出當下才配。

  **配號與建檔必須是同一個動作**:掃描看得到的是檔案,你腦中記著的號碼別人看不到,「先算號、待會再建檔」中間那段空窗就是撞號發生的地方。**沒有任何 skill 可以用「掃資料夾取最大值 +1」自己配號**——那個做法看不到別的分支與 worktree,而兩份同號不同 slug 的檔案 merge 時不會衝突,會靜默地一起落地。其餘旗標跑 `--help`;理由與三個掃描來源寫在腳本檔頭。

  這只管**文檔 id**。檔案**內部**的條目(`LAW-` / `EX-` / `ASM-` / `GAP-` / `DEC-` / `SELF-` / `WAVE-` / `STEP-` / `REG-` / `RND-` / `REV-`)不走腳本——它們只在單一檔案內唯一,寫的人手上就有那個檔案。`S0`–`Sn` 也不走:它們在 `system.md` 同一張表裡,平行修改會產生真的 merge 衝突。
- **每個子系統自己一組編號**(F/E/B 各自獨立計數);**全域(G-)自己一組編號**;ADR 全局一組編號:
  - 子系統內:`F001`、`E001`、`B001`(features / enhancements / bugfixes 各自從 001 起算)
  - 全域:`G-C001`、`G-F001`、`G-E001`、`G-B001`(契約 / 核心功能 / 擴充功能 / 修復各自從 001 起算)
  - ADR:`ADR-001`;spike:`SPK-001`(全局一組,spike 常在還沒定子系統時就開)
- 檔名不放日期(日期在 frontmatter 的 `created` / `updated`)

## 編號與縮寫註冊表(唯一鑄號機關)

整套流程裡**所有**會被編號、被縮寫的東西都登記在這張表。三條鐵律:

1. **「單字母+數字」只保留給兩種東西**:任務 / 契約文檔 id(三位數)與開發階段 id(`S0`、`S1`…)。檔案**內**的條目(law、example、假設、gap、決策、波次…)一律用**詞首碼-數字**(`LAW-1`、`GAP-2`)——詞首碼自帶語意,不必靠上下文猜,也不會跟文檔 id 或專案自訂的名字撞號
2. **文檔 id 永不簡寫、位數永遠固定,而且永遠帶限定詞**:`E001` 就是 `E001`,任何場合都不准寫成 `E1`;`G-C001` 不准寫成 `GC1` 或 `C1`。一旦簡寫,三位數與單位數條目的區隔就消失,`E1` 到底是 Enhancement 001、Example 1 還是專案的階段 `E1` 沒有人分得出來。而**光有正確的號還是指不到東西**:每個子系統各有一組 `E001`,講給人聽時一律寫 `<子系統>/<id>-<slug>`(`pay/E001-money`),格式見下方「文檔引用格式」
3. **新增任何編號系統之前先查這張表**;首碼撞了就換詞首碼,不准共用。skill 自己的修訂也一樣——本表是修一次真實撞號修出來的:`L1` 曾同時是 Law 1 / Level 1 / 專案的 Layer 1,`E1` 曾同時是 Example 1 / `E001` 的簡寫 / 專案的階段 `E1`,`A1` 曾同時是待確認假設 1 / 檢查表 A1

| 首碼 / 寫法 | 格式 | 意思 | 作用域(在哪裡唯一) | 誰配號 |
|---|---|---|---|---|
| `F001` | 三位數 | feature 文檔(子系統核心功能) | 子系統內一組 | `scan-ids.mjs --claim` |
| `E001` | 三位數 | enhancement 文檔(子系統擴充功能) | 子系統內一組 | `scan-ids.mjs --claim` |
| `B001` | 三位數 | bugfix 文檔 | 子系統內一組 | `scan-ids.mjs --claim` |
| `G-C001` / `G-F001` / `G-E001` / `G-B001` | 三位數 | 全域契約 / 跨子系統核心功能 / 擴充功能 / 修復 | 全域各一組 | `scan-ids.mjs --claim` |
| `ADR-001` | 三位數 | 架構決策紀錄 | 全局一組 | `scan-ids.mjs --claim` |
| `SPK-001` | 三位數 | spike(可行性驗證)文檔,程式碼資料夾同名 | 全局一組 | `scan-ids.mjs --claim` |
| `S0`、`S1`… | 一~二位數 | **開發階段**(`system.md`「開發階段」表的階段 id) | 全專案固定 | `/system-design` |
| `A1`–`A10`、`B1`–`B4` | 固定清單 | `contract-readiness.md` 的檢查條(A 段 / B 段) | 那一份檢查表 | 固定,不配號 |
| `LAW-1` | 詞首碼 | spec 的 law(行為性質) | 單一 spec 檔內 | spec 角色 |
| `REG-1` | 詞首碼 | 修訂時保護既有行為的**回歸** law | 單一 spec 檔內 | spec 角色 / `/spec-redesign` |
| `REV-1` | 詞首碼 | 修訂輪次(`## 修訂記錄` 的一條;`rev` 欄 = 條數) | 單一 spec 檔內 | `/spec-redesign` |
| `EX-1` | 詞首碼 | spec 的 example | 單一 spec 檔內 | spec 角色 |
| `ASM-1` | 詞首碼 | 待確認假設 | 單一 spec 檔內 | spec 角色(委派模式) |
| `GAP-1` | 詞首碼 | spec-gaps 條目 | 單一 `spec-gaps.md` 內 | 編排者(委派)/ 本人(互動) |
| `DEC-1` | 詞首碼 | 委派決策(批次澄清的裁決) | 單一 `build-log.md` 內 | 編排者 |
| `SELF-1` | 詞首碼 | 自裁記錄(實作層級的自答) | 單一回報 / 自裁清單內 | spec subagent |
| `WAVE-1` | 詞首碼 | 委派展開的波次 | 單一子系統的展開內 | 編排者 |
| `STEP-1` | 詞首碼 | bugfix 的 TodoList 步驟(`dep:` 欄互相引用) | 單一 bugfix 文檔內 | `/bugfix` |
| `RND-1` | 詞首碼 | spike 的輪次(每輪自帶問題、判準、timebox、結果) | 單一 spike 文檔內 | `/spike`(委派模式由編排者) |
| `Level 1 / 2 / 3` | **全名** | 設計三層階梯(主架構 / 子系統 / spec) | 全流程 | 固定 |

- **`Level` 一律寫全名**,任何 skill 文檔與產出裡都不准縮寫成 `L1` / `L2` / `L3`——`L` 誰都不給,免得跟專案的 `Layer` 與舊寫法的 law 混在一起。專案自己的 `Layer 0–3` 之類是專案詞彙,不歸本表管,但**專案自訂縮寫不得與本表衝突**(`/system-design` 產出前檢查):想給階段取 `E0`–`E6` 就是撞了 `E001` 與 `EX-`,一律改用工具鏈保留的 `S0`–`Sn`
- **三支腳本在守這張表**(都在 `arch-audit/scripts/`):`lint-ids.mjs` 掃 markdown,揪出裸寫的「單字母+數字」——被禁的形式只准出現在反引號裡(那是「在講這個寫法」),裸寫就是真的拿它當識別碼在用;`id-map.mjs` 把本表畫成樹狀圖,不帶參數看慣例、給 `.design` 路徑看某個專案實際鑄過哪些號;`scan-ids.mjs` 跨分支與 worktree 盤點**已經被佔走的號**(見上方「命名與編號規則」),配號前跑它
- 舊專案文檔裡的 `L1`(law)、`E1`(example)、`G1`(gap)、`A1`(假設)照舊可讀,不強制回頭改;**新寫的一律用本表**。盤點腳本對 gap 條目同時認 `GAP-n` 與舊制 `G<n>`

### 文檔引用格式(frontmatter 欄位、內文、回報與腳本輸出)

`F001` / `E001` / `B001` 只在**自己的子系統內**唯一,所以裸寫的 `E001` 指不到任何東西:讀的人答不出「哪個子系統的哪一份文檔、在改什麼」。**任何場合都不准只寫裸 id**,差別只在要不要帶 slug:

| 場合 | 寫法 | 例 |
|---|---|---|
| frontmatter 的清單欄位(`depends-on`、`related-feature`…) | `<子系統>/<id>`,**同一個子系統內部也要帶** | `depends-on: [auth/F001, billing/F003]` |
| 內文、回報、定錨區塊、命令參數、腳本輸出 | `<子系統>/<id>-<slug>`(帶 slug,一眼看得出在做什麼) | `auth/F002-token-refresh` |
| 全域任務文檔 | `G-F001-<slug>` / `G-E001-<slug>` / `G-B001-<slug>`(frontmatter 欄位可只寫 `G-E001`) | `G-F001-checkout` |
| 全域契約 | **一律寫到條目**,不只寫文檔 id | `G-C001-session#SessionToken` |
| ADR | `ADR-00x-<slug>`(frontmatter 欄位可只寫 `ADR-003`) | `ADR-003-jwt` |
| spike | `SPK-00x-<slug>`(frontmatter 欄位可只寫 `SPK-003`);它的某一輪寫 `SPK-00x-<slug> 的 RND-2` | `SPK-003-storage-engine` |
| 檔案**內部**的條目(LAW / REG / EX / ASM / STEP / DEC / WAVE / REV) | `<擁有它的文檔全名> 的 <條目>` | `auth/F002-token-refresh 的 LAW-3` |
| 修訂後的文檔(講給人聽時帶版本) | `<全名>(rev n)`;引用欄位**不帶**版本,永遠指現況 | `auth/F001-login(rev 2)` |
| `spec-gaps.md` 的條目(每個子系統只有一份,不必寫檔名) | `<子系統>/<條目>`;全域的 gap 寫 `global/<條目>` | `auth/GAP-1` |
| 開發階段 | `<階段 id>(<階段名稱>)` | `S1(帳務上線)` |

**只有兩個地方寫裸 id**:文檔自己的 frontmatter `id:` 欄、以及檔名(`F002-token-refresh.md`)——那兩處的上下文就是那份檔案本身。

- **frontmatter 也要帶子系統前綴**,即使引用的是同一個子系統裡的文檔:那一欄會被 `scan-status.mjs` 讀出來、印進別的子系統的反向依賴清單裡,印出去之後就沒有「所在檔案」這個上下文了。腳本兩種寫法都解析得到(舊文檔不必回頭改),但同子系統寫成裸 id 會被列進「提示」
- **全域契約優先寫到條目**(`G-C001-session#SessionToken`):一份全域契約通常裝好幾個條目,只寫 `G-C001` 的話,`--doc` 查詢與 `/arch-audit` 的對帳都只知道「這裡用了那份文檔」,答不出「用了哪一條」——而契約改動幾乎都是**條目級**的
- **查詢腳本吃全名**:`scan-status.mjs --doc auth/F002-token-refresh`、`--doc auth/F002`、`--doc F002` 三種都查得到同一份文檔,所以回報裡寫全名不會讓下一個人複製貼上時出錯

## Metadata 標準(YAML frontmatter)

所有 `.design/` 文檔**開頭必須**是 YAML frontmatter,狀態掃描腳本只解析這一段。

### 任務文檔(feature / enhance / bugfix,含全域 G-)

```yaml
---
id: F001                 # 檔名編號前綴:F001 | E001 | B001 | G-F001 | G-E001 | G-B001
type: feature            # feature | enhance | bugfix
title: auth-login        # 檔名 slug
description: 以 JWT 實作使用者註冊、登入與權限驗證   # 一句話主軸,見下方規則
status: planned          # planned | specced | done | dropped(B 沒有 planned,建檔即 open)
rev: 0                   # 修訂輪次:初版 0,每次 /spec-redesign +1,= ## 修訂記錄 的 REV 條數
stage: S1                # feature 與 G-F:對應 system.md「開發階段」的階段 id(G-F 必填,它是階段的達成條件)
modules: []              # 僅 feature:負責模組(design.md「內部模組劃分」的模組名)
part-of: []              # 僅子系統 feature:承接哪份 G-F 的一段(如 [G-F001]);G-F 的分工表是權威,這一欄是索引
created: 2026-08-19
updated: 2026-08-19
depends-on: []           # 依賴的其他任務文檔(引用格式見上);空陣列 = 可平行開發
related-adr: []          # 相關 ADR id
related-feature: []      # bugfix 回鏈到出問題的 feature id(G-B 指 G-F)
code-paths: []           # 本文檔實際動到的程式碼路徑;建檔時留空,收尾與 status 一起回寫(見下)
---
```

- **`stage` 只有 feature 與 G-F 有**;`enhance` / `bugfix` 省略 `stage`(它們不擋階段,不掛在階段路線圖上)。`modules` / `part-of` 只有子系統 feature 有。狀態的判準與轉換見上方「狀態與生命週期」;`rev` 與 `## 修訂記錄` 的規則見「修訂(rev 與 REV)」
- `id` 必須與檔名的編號前綴一致(`F001-auth-login.md` → `id: F001`);`type` 必須與所在資料夾一致(features/ → feature、enhancements/ → enhance、bugfixes/ → bugfix)
- 文檔屬於哪個子系統由**檔案路徑**決定,不另設欄位;**全域 G- 文檔**須額外加 `subsystems: [subsys-a, subsys-b]` 列出參與 / 受影響的子系統。G-F 與 G-E 的 `## 契約` 另有**分工表**(子系統 / 負責的段 / 承接的 feature 全名),每一列指到的 F 要用 `part-of` 回鏈,腳本雙向對帳
- **`code-paths`**(必填,值可以是空陣列):這份文檔實際動到的程式碼路徑,專案根目錄起算、**以檔案為主**(`[src/Auth/Token.hs, src/Auth/Cache.hs]`),整個資料夾都由它產生時才寫目錄。子系統 `design.md` 的同名欄位是路徑**前綴**(答歸屬),這一欄是動過的檔案(答來歷);`scan-status.mjs --file <path>` 靠它反查
  - 建檔寫 `[]`,**收尾與 `status` 同一個動作**回寫:`/spec-impl`(feature / enhance)、`/bugfix`(bugfix)。委派模式下 impl 只在回報裡交出路徑清單,由編排者連同 `status` 填
  - 綁在 `status` 上是刻意的:單獨一條「記得更新索引」沒有任何東西會抱怨它沒做,一定會爛掉。`status` 是 `done` / `closed` 卻留著 `[]` 時,`/arch-audit status` 列進「提示」(不影響 exit code)

### 架構文檔(system / subsystem)

`system.md`:

```yaml
---
id: system
type: system
title: <project-slug>
description: <一句話,40 字內:這個專案在做什麼>
status: active
mode: greenfield         # greenfield(全新建立)| brownfield(維護型)
created: 2026-08-19
updated: 2026-08-19
subsystems: []           # 完整名冊:「子系統劃分」列到的每一個 slug,含還沒建 design.md 的
---
```

**`mode` 是專案級的常數**,`/system-design` 在訪談第一題定案、之後不再改(真的從全新變成有人在用時才改成 `brownfield`,並在 ADR 記一筆)。它決定**整類問題該不該問**:`greenfield` 禁止 migration 與向後相容的討論、禁止預留相容層,決策以專案未來性為第一優先;`brownfield` 反過來,migration 與既有呼叫端是必問。完整規則見 `boundary-rules.md`「專案模式」。缺這一欄時 `/arch-audit status` 會提示,執行的人要問開發者一次再回寫——**不准自己假設**。

`subsystems` 是**名冊**不是**成果清單**(理由見上方「文檔角色與權威來源」)。`/system-design` 在子系統劃分定案時一次寫齊;之後只有新增或廢棄子系統才動它。

```yaml
subsystems: [kernel, gameplay, frontend, shell, farm, magic, npc-life]   # ✅ 含未建檔的 farm / magic / npc-life
subsystems: [kernel, gameplay, frontend, shell]                          # ❌ 只列已建檔的 → 未開工的部分永遠不進分母
```

`subsystems/<slug>/design.md`:

```yaml
---
id: <subsystem-slug>     # 與資料夾名一致
type: subsystem
title: <subsystem-slug>
description: <一句話,40 字內:這個子系統負責什麼>
status: active
created: 2026-08-19
updated: 2026-08-19
parent: system           # 回鏈主架構(固定值)
related-adr: []
code-paths: []           # 選填:本子系統的程式碼落在哪些路徑(見下)
---
```

- `code-paths`(**選填**):本子系統的程式碼路徑前綴,相對於專案根目錄,如 `code-paths: [src/auth, src/middleware/auth]`。它是把檔案級的工具產出(程式碼知識圖、覆蓋率報告等)捲回子系統級的唯一依據——沒填的話只能靠「路徑片段 = slug」猜測,檔案歸屬可能整批錯。用得到 `_shared/codegraph.md` 的專案建議補上;不用那些工具的專案留空或整欄省略都可以,不影響任何既有流程

`subsystems/<slug>/build-log.md`(只有跑過 `/subsys-build` 才存在):

```yaml
---
id: <subsystem-slug>-build
type: build-log
title: <subsystem-slug>-build
description: <一句話,40 字內:這次委派展開了什麼>
status: in-progress     # in-progress | done
created: 2026-08-19
updated: 2026-08-19
parent: <subsystem-slug> # 回鏈所屬子系統的 design.md
---
```

`subsystems/<slug>/spec-gaps.md`(qa / impl 發現 spec 模糊時才存在;全域文檔的 gap 放 `.design/spec-gaps.md`,`id` 用 `global-gaps`、省略 `parent`):

```yaml
---
id: <subsystem-slug>-gaps
type: spec-gaps
title: <subsystem-slug>-gaps
description: <一句話,40 字內:這個子系統有哪些 spec 待釐清>
status: open            # 固定 open:這個檔只裝未結條目,空了就刪檔
created: 2026-08-19
updated: 2026-08-19
parent: <subsystem-slug> # 回鏈所屬子系統的 design.md
---
```

`subsystems/<slug>/` 的**分冊**(`design.md` 拆出去的部分;只有拆過才存在,判準見上方「文檔角色與權威來源」):

```yaml
---
id: <subsystem-slug>-contract-<模組群小寫>   # decisions.md 用 <subsystem-slug>-decisions
type: contract-part                          # 或 decisions
title: <與 id 相同>
description: <一句話,40 字內:這一份裝的是哪一群的契約 / 哪些定案>
status: active
created: 2026-09-01
updated: 2026-09-01
parent: <subsystem-slug>                     # 回鏈所屬子系統的 design.md;不編號,靠這一欄認親
---
```

分冊**不參與 F/E/B 編號**、不列入進度統計。`parent` 與所在資料夾不一致、或子系統根層出現不帶這兩種 `type` 的 `.md`,`scan-status.mjs` 會列為不一致。

內文格式(只追加、不改既有條目,修訂後回填狀態)見 `spec-roles.md`「spec-gaps 協議」。條目編號 `GAP-1`、`GAP-2`… 在該檔內遞增,不跨檔共用(舊制 `G1` 照舊可讀,新寫的用 `GAP-`,見「編號與縮寫註冊表」)。**委派模式下這個檔只由編排者寫**(建檔、配號、追加都是),subagent 一律只回報(理由見 `delegation.md` 第 4 條)。

### 全域契約文檔(G-C)

`contracts/G-C001-<slug>.md`——**多方共用、不屬於任何單一子系統**的契約(共用 DTO、跨子系統事件 schema、共同遵守的錯誤語意):

```yaml
---
id: G-C001
type: contract
title: <contract-slug>          # 檔名 slug
description: <一句話,40 字內:這份契約定義了什麼>
status: active                  # active | superseded | closed
created: 2026-08-19
updated: 2026-08-19
subsystems: [subsys-a, subsys-b] # 使用這份契約的子系統(至少兩個,否則它不該是全域的)
related-adr: []
---
```

固定章節:**定位與範圍** → **契約條目**(每個條目一個 `###`,標題 = 條目名稱,內含欄位表:名稱 / 型別 / **單位或值域** / 語意,規格同 `contract-readiness.md` A4)→ **使用者與方向**(哪個子系統產生、哪些消費)→ **變更紀律**。

四條規則:

1. **只在沒有任何一份 G-F / G-E 擁有那段互動時才建**。門檻是:**兩份以上 G-F / G-E 共用**,或**兩個以上子系統共用、而那段互動不屬於任何一份 G-F**(錯誤碼表、事件信封、id 格式這類慣例)。只被一份 G-F(含它的分工 F)用的型別**住那份 G-F 的 `## 介面`**,分工 F 引用 `G-F001-checkout#OrderId`;另建 G-C 是憑空多一層。只有一個子系統用的契約住那個子系統的 `design.md`
2. **升格 / 降格搬家留痕**:第二個消費者出現時,型別從 G-F 搬進 G-C,原 G-F 記一條 REV「`OrderId` 升格為 `G-C002-order#OrderId`,本檔改為引用」;只剩一個消費者時反向搬回,G-C 條目標 `superseded`。**同一時刻每個型別只有一個家**。`scan-status.mjs` 兩條提示(不進 exit code):G-C 的條目只被一份 G-F 或一個子系統引用 → 「該搬回」;某份 G-F `## 介面` 定義的型別被別份 G-F 引用 → 「該升格」
3. **不准塞進某一個子系統的 `design.md` 再讓別人引用**——那份 `design.md` 從此擁有一個不屬於它的事實,違反 `boundary-rules.md`「知識歸屬」(對帳條目見 `contract-readiness.md` B4)
4. 條目是**不可逆決定**:每次改動要在「變更紀律」段記下改了哪個條目、為什麼、影響哪些子系統;重大者開 ADR 並填進 `related-adr`

引用時**寫到條目**(`G-C001-session#SessionToken`),理由見上方引用格式表。

### ADR

```yaml
---
id: ADR-001
type: adr
title: <decision-slug>
description: <一句話,40 字內:這份 ADR 決定了什麼>
status: accepted         # proposed | accepted | superseded
created: 2026-08-19
updated: 2026-08-19
---
```

### spike 文檔(SPK)

`spikes/SPK-001-<slug>.md`(`/spike` 產出;程式碼在 `.design/` 同層的 sandbox `spike/SPK-001-<slug>/`,只活到結案):

```yaml
---
id: SPK-001
type: spike
title: <slug>
description: <一句話,40 字內:要驗證什麼>
status: open                 # open | concluded | dropped
verdict:                     # concluded 才填:feasible | infeasible | partial
created: 2026-09-04
updated: 2026-09-04
subsystems: []               # 相關子系統;還沒定子系統時留空(spike 常先於子系統)
feeds: []                    # 結論餵給哪些文檔(全名);concluded 時必填非空
related-adr: []
code-paths: [spike/SPK-001-<slug>]   # 固定同名資料夾(結案後已刪,配輪次的 sha 撈);只准指到 spike/ 底下
---
```

固定章節:**問題**(要回答什麼 / 為什麼讀原始碼答不出來 / 判準 / 下游)→ **輪次**(每輪一個 `### RND-n`,各自有要驗什麼、判準、timebox、做法、結果、sha、環境)→ **候選比較**(只有比較形態才有)→ **結論**(verdict / 一句話 / 學到什麼 / 餵給哪裡 / 沒驗到的)。版面在 `spike/templates/spike.md`。

三條規則:

1. **`status` 由結論決定**:`open` = 還有輪次沒判定;`concluded` = `## 結論` 填齊、`verdict` 與 `feeds` 都非空(`feeds` 寫全名,`scan-status.mjs` 查指不指得到文檔);`dropped` = 決定不做了(一句話寫為什麼)
2. **`code-paths` 只准指到 `spike/` 底下**,任務文檔(F/E/B)的 `code-paths` **不准**指進 `spike/`;產品原始碼不准 import `spike/`。三項 `lint-spikes.mjs` 查
3. **程式碼資料夾只活在 `open` 期間**:`concluded` / `dropped` 不准還有 `spike/SPK-00x-<slug>/`,`open` 必須有;結案刪除只走 `spike-close.mjs`(從全名算路徑、五道關才 `git rm -r --`)。`spike/` 根層的共用環境不編號、不刪、不歸任何一份 spike。刪掉的程式碼靠 `RND-n` 的 sha 撈:`git show <sha>:spike/SPK-00x-<slug>/<檔>`
4. **不進進度分母**:`open` 的在 `/arch-audit status` 單獨列出並計入 exit code,不進任何百分比

### 清單欄位格式(唯一寫法:行內陣列)

`depends-on`、`related-adr`、`related-feature`、`subsystems` 等清單欄位**一律寫成行內陣列**,空值寫 `[]`:

```yaml
depends-on: [auth/F001, billing/F003] # ✅ 唯一合規寫法(同子系統也帶前綴)
related-adr: []                       # ✅ 空清單
subsystems: [auth]                    # ✅ 單一元素也用陣列
```

```yaml
depends-on:                           # ❌ 不使用 YAML 區塊列表
  - auth/F001
```

- 理由:狀態掃描腳本只讀檔頭、只認行內陣列;兩種格式並存會讓清單被讀成空值,相依關係與權威清單就對不上
- 值含冒號 `:`、`#` 或空白時,該元素用雙引號括起來
- `/arch-audit status` 偵測到區塊列表會列進「frontmatter 格式不合規」並以 exit code 1 收場

### `description` 欄位規則(必填)

- **所有類型都要寫**:system / subsystem / adr / feature / enhance / bugfix / spike,一個都不能少
- **一句話**描述本文檔的**主軸**:繁體中文、40 字以內,不加句號;超過就是寫太細,砍掉細節只留主軸
- 只寫主題,不寫實作細節、不列步驟、不寫理由(那些屬於內文)
- 值含冒號 `:` 或 `#` 時整句用雙引號括起來(YAML 規則)
- 建立文檔時就要寫;除非文檔主題本身改變,否則後續修改不動這欄

| 類型 | 描述對象 | 範例 |
|---|---|---|
| system | 專案在做什麼 | `本地端 Markdown 筆記管理與全文檢索工具` |
| subsystem | 這個子系統負責什麼 | `全文檢索子系統:索引建立、查詢解析與排名` |
| adr | 決定了什麼 | `選用 SQLite FTS5 作為全文檢索引擎` |
| feature | 這個核心功能做什麼 | `以 JWT 實作使用者註冊、登入與權限驗證` |
| enhance | 這個擴充功能加了什麼(不是「改善什麼」——改善既有功能是修訂,不建檔) | `記住裝置,30 天內免二次驗證` |
| bugfix | 什麼壞了 | `並發寫入時索引損毀導致搜尋結果缺漏` |
| spike | 要驗證什麼 | `SQLite FTS5 在 50 萬筆筆記下的查詢延遲` |
