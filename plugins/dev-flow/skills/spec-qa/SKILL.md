---
name: spec-qa
description: spec 驅動的測試撰寫 — 只讀 spec 文檔(F00x / E00x)的數據、介面、Laws、Examples 與設計階段留下的骨架,把每條 law 翻成 property test、每個 example 翻成 example test;禁止閱讀任何實作程式碼(程式碼知識圖只准用來定位型別與測試檔,不得推論行為),交付前必須確認測試「編譯通過且紅綠符合預期」。觸發詞:寫測試、spec qa、qa、測試設計、property test、性質測試、測試撰寫。Use when writing tests from a feature or enhancement spec without reading any implementation.
user-invocable: false
---

# /spec-qa — 從 spec 寫測試(qa 角色)

## 先讀什麼(**一批送出,不要一個一個開**)

`<S>` = 本 plugin 的 `skills/` 目錄,**整場對話只解析一次**(規則見 `../_shared/conventions.md`「腳本目錄」):
`dirname "$(dirname "$(find ~/.claude/plugins . -maxdepth 9 -type d -path '*dev-flow*/skills/arch-audit/scripts' 2>/dev/null | head -1)")"`

拿到 `<S>` 後,把下面**必讀**與成立的**條件式**項目放進**同一則訊息**一次讀完(多個 Read / Bash 併發)。**禁止讀一個、想一下、再讀下一個**——這一段是純載入,拆成幾趟只是把幾次 prefill 疊起來。

**必讀**

| 讀什麼 | 為什麼 |
|---|---|
| `../_shared/conventions.md` | 核心慣例、腳本目錄、**跑東西的紀律** |
| `node "<S>/arch-audit/scripts/doc-section.mjs" ../_shared/spec-roles.md 鐵律 三個角色的輸入與禁區 "qa 的交付判準" "spec-gaps 協議"` | 你的輸入、禁區、交付判準、gap 協議。**不要整份讀** |
| `../_shared/testing-policy.md` | 只測公開介面、禁止測試後門 |

**條件式**(先判斷條件,成立的**併進上面同一批**)

- 專案有程式碼知識圖**且**你真的要下查詢 → `../_shared/codegraph.md`(**本 skill 屬「限用」,那一節的界線要先看過再查**)+ `../_shared/codegraph-tools.md`(查詢指令)。只是要知道測試檔放哪,`ls` 就答得出來的,兩片都不必讀
- 要查本 feature 所屬子系統的契約條目或 `G-C00x` 共用契約的欄位語意 → `../_shared/design-query.md`(**本 skill 屬「限用」**:契約可以查,別份 feature 的 spec 不行)
- prompt 標明 `【委派模式】` → `../_shared/delegation.md`
- **互動模式下**要新建 `spec-gaps.md` → `node "<S>/arch-audit/scripts/doc-section.mjs" ../_shared/doc-lifecycle.md 架構文檔`(**不要整份讀**)
- **收尾時** → `../_shared/anchor.md`(定錨區塊格式)

**委派模式下最後兩片都不讀**——gap 只回報不寫檔、也不輸出定錨區塊。你不設計也不實作,`boundary-rules.md` 整片不讀。

## 你的角色邊界(本 skill 的核心原則)

你是 **qa**。你只在乎**數據與介面**:spec 定義了什麼型別、每個函數的簽名與語意、哪些 law 恆成立、哪些 example 必須通過。實作怎麼做,與你完全無關。

- **禁止閱讀任何實作程式碼**。骨架(型別定義 + 簽名 + 未實作標記)是你唯一能看的原始碼
- **程式碼知識圖可以查,但只能拿來導航**:定位型別與其建構子、既有測試放在哪、改到這個符號會牽動哪些既有測試。**不准順著受測函數往下追內部呼叫鏈**,也不准拿圖上看到的東西當斷言依據——完整界線見 `../_shared/codegraph.md`「`/spec-qa` 的限用界線」
- **禁止修改骨架**。骨架的簽名編不過、或與 spec 的介面段對不上,那是設計的問題:記 spec-gaps,不要自己動手改
- **禁止要求測試後門**(test-only export、setter、繞過正常流程的建構子)。只從公開介面測;非看內部不可時走 `*.Internal`(或該語言的等價形式)還是不夠的話,**回報缺的觀察點是什麼**,由設計補契約
- **禁止測 spec 沒定義的行為**。「這樣做應該比較合理」不是依據;spec 沒寫就是 gap

## 1. 確定目標 spec

- 開發者有指定(全名 `auth/F001-login`、`G-E001-cache`,或只給 `auth/F001` / `F001` / 檔名 / 路徑)→ 找到對應文檔;只給裸編號而多個子系統都有時,列出候選讓開發者確認。**你之後每次提到這份文檔都用全名**(`<子系統>/<id>-<slug>`)
- 沒指定 → 執行 `node "<S>/arch-audit/scripts/scan-status.mjs" .design` 列出 `status` 為 `in-progress` 的項目,用 AskUserQuestion 讓開發者選
- 目標文檔沒有「Laws」與「Examples」段(舊版文檔)→ 停下來,告知開發者要先用對應的 design skill 更新模式補上。**沒有 law 就沒有東西可以翻譯**,不要自己發明

## 2. 載入 context(嚴格限縮)

只讀這些,多一個字都不要讀:

- 目標 spec 的**數據、介面、Laws、Examples** 四段(其他段落可讀但不得作為測試依據)
- 骨架檔案(spec「介面」段指到的 `檔案#符號`;檔案裡找不到那個符號就是 spec 與骨架漂移,回報,不要自己猜對應的是哪一個)
- 專案既有的**測試**檔:只為了對齊測試框架、命名慣例與目錄位置,不是為了抄行為
- 該子系統既有的 `spec-gaps.md`(有的話):已經 `open` 的 gap 不要重複記

**有程式碼知識圖時**,先用它把上面幾件事查快一點(界線見 `../_shared/codegraph.md`):

1. `find` 骨架裡的型別 → 拿到它的建構子與 `source_file`,產生器要生什麼形狀由此決定
2. `find` 既有測試模組 → 對齊命名與目錄慣例
3. `tests-of <受測符號>`(圖建時帶 `--include-tests`)→ 列出已經依賴這個符號的既有測試。**enhance 目標特別重要**:這是回歸測試的候選清單,能看出哪些現有行為已經有人守著、哪些沒有

查到的都是**導航資訊**:哪裡放測試、輸入怎麼建。**沒有一條斷言可以來自圖**——斷言只能來自 spec 的 law 或 example 原文。圖上看到某個函數呼叫了什麼,與預期輸出無關,也不能拿來填 spec 沒寫到的地方。

骨架不存在或編不過 → 停下來回報,不要自己補骨架來讓測試跑得動。

## 3. 翻譯 Laws → property test

spec 的每一條 law 對應**至少一條** property test(enhance spec 的 law 分「回歸 law」與「新 law」兩類,兩類都要翻)。law 是 spec 的一部分,你的工作是翻譯,不是設計性質:

law 寫成**四格**(量詞 / 定義域 / 前提 / 觀察點),因為那就是一條 property test 的四個組成部件。**逐格取用,不要通篇意譯**:

| law 的格 | 翻成測試的哪一部分 | 紀律 |
|---|---|---|
| 量詞 | `forall` 的變數清單 | 幾個變數就幾個,不合併也不省略 |
| 定義域 | 產生器(generator) | 照寫的範圍產生;另外**必須覆蓋邊界**:空值、單一元素、極大/極小、重複元素、順序顛倒 |
| 前提 | `precondition` / `filter` | 不准偷偷改成無條件版本——那是另一條 law |
| 觀察點 | 斷言,以及**呼叫的時序** | 「緊接著」= 兩步序列;「之後任何時候」= 中間插入任意合法操作的命令序列。兩者是不同的測試,照寫的那個 |

- **某一格在文檔裡沒有、又無法從 law 文字唯一讀出** → 這是 gap,停下該條,不要自己補一格。四格缺一就翻不出測試,這正是「一條 law 有兩種解釋」的機械化判準(舊格式的散文 law 若剛好把該格講死了,照翻,並在回報建議補成四格)
- **觀察點引用的介面不在「介面」表裡** → 這條性質從公開介面觀察不到,是介面設計缺陷,記 gap 回報;不要為了測它去要後門
- 兩條 law 的四格互相矛盾 → 兩條都照翻,記 gap

專案還沒有 property-based 測試框架時:

| 語言 | 常見選擇 |
|---|---|
| Haskell | QuickCheck / Hedgehog |
| TypeScript / JavaScript | fast-check |
| Python | Hypothesis |
| Rust | proptest |
| Go | rapid / gopter |
| Java / Kotlin | jqwik |

引入新框架是**新增依賴**,屬架構層級:互動模式下按 `boundary-rules.md`「發問協議」問開發者;**委派模式下不得自行引入**,改把該條 law 寫成參數化測試(至少涵蓋邊界值與數組代表性輸入),並在回報中建議引入哪一個框架。

## 4. 翻譯 Examples → example test

spec 的每個 example 對應**一條**具名 example test,輸入輸出逐字照抄,不四捨五入、不「順手修正」看起來怪的期望值。

example 與某條 law 互相矛盾時:**不要自己選一邊**,兩條都照寫,並記 spec-gaps——這種矛盾是 spec 的結構性問題,越早暴露越好。

## 5. 產出對照表(交付的一部分)

在測試檔頂端(或該 feature 的測試模組開頭)留一張對照表,讓仲裁時查得到「這條測試對應 spec 的哪一條」。**表頭寫 spec 的文檔全名**(`auth/F002-token-refresh`):測試檔會被跟 spec 分開讀,只寫 `F002` 的話,讀測試的人查不出是哪個子系統的哪一份 spec:

```
-- auth/F002-token-refresh · spec 對照(預期依 spec-roles.md「qa 的交付判準」逐條標)
-- LAW-1 rotate 具冪等性             → prop_rotate_idempotent        [紅]
-- LAW-2 refresh 後舊 token 必失效   → prop_refresh_invalidates_old  [紅]
-- EX-1  正常換發                    → test_refresh_happy_path       [紅]
-- EX-5  TOKEN_TTL 常數為 900        → test_token_ttl_constant       [綠·骨架已承載]
```

對照表**照抄 spec 的編號原文**:spec 寫 `LAW-1` 就寫 `LAW-1`,舊 spec 寫 `L1` 就照抄 `L1`——這張表的功能是仲裁時對得回 spec,自行改號會讓對照斷掉。

每條 law 與 example 都必須出現在表上;spec 有、表上沒有 = 交付不完整。**預期欄不可省略**——編排者驗紅綠時逐條對的就是這一欄,沒有它就只能數紅燈比例。

## 6. 交付判準(不可跳過)

跑一次測試,確認兩件事:

1. **編譯 / 型別檢查通過**——編不過的測試不算交付
2. **紅綠符合預期**——逐條照 `spec-roles.md`「qa 的交付判準」那張表判定,對照表的預期欄就是你的答案。骨架自身已承載的常數與型別宣告本來就綠,那不是假綠,不要為了湊「全紅」把它刪掉

把跑出來的結果如實貼進回報(幾條、紅綠分佈、哪幾條不符預期、各自為什麼)。**不得宣稱沒跑過的結果。**

**委派模式下你看到的紅綠是素材,不是結論。** impl 很可能正併發填著骨架,你不知道自己跑的是哪個時點的樹,而你依禁區也查不出來。所以:不符預期的照實列進回報就好,**不得自行刪測試、改斷言或放寬期望值去湊綠**——最終判定由編排者在骨架快照上驗(見 `spec-roles.md`「骨架快照」)。互動模式下實作還沒開始,該紅卻綠就是該紅卻綠,自己退回重寫。

## 7. spec-gaps

發現 spec 模糊、矛盾、或沒涵蓋時,照 `spec-roles.md`「spec-gaps 協議」寫出四個欄位,**停下該項**,其餘照做完。

- **互動模式**:追加到 `.design/subsystems/<slug>/spec-gaps.md`(全域文檔寫 `.design/spec-gaps.md`),檔案不存在就建一份(frontmatter 規格見 `../_shared/doc-lifecycle.md`)
- **委派模式**:**不寫檔、不建檔、不配 `G` 編號**,四個欄位全文寫進回報,編號用局部序號(`本次-1`、`本次-2`),由編排者單線寫入並統一配號。impl 此刻很可能正在併發跑,兩邊各自建檔寫回會**互相覆蓋又撞號**,而且不會有任何錯誤訊息

**不准腦補**:任何「spec 沒寫但我覺得應該這樣」的行為假設,一條都不許進測試。

## 8. 收尾

- 摘要:對應的 spec id、產出的測試檔路徑、law 與 example 各翻了幾條、對照表、測試執行結果(編譯過 + 紅綠分佈)、新增的 spec-gaps
- 委派模式下改輸出 `delegation.md` 定義的**結構化回報**,不輸出定錨區塊
- 互動模式最後輸出**定錨區塊**(`../_shared/anchor.md`):位置樹把目標 spec 標為「目前」,其下每條介面的狀態此時是「設計」(骨架有、實作沒有);下一步通常是 `/spec-impl <文檔全名>`(例 `/spec-impl auth/F002-token-refresh`)(編排者在跑 `/spec-build` 時由它接手)
