# dev-flow 重建:system.md → features → refactor 出 abstract

日期:2026-09-07
狀態:設計定案,本次實作
取代:`dev-flow-core-feature-model.md` 那一版模型(子系統 / 六種分類 / planned-specced-done / rev 欄)整套退場

---

## 0. 一句話

**文檔的單位是 feature,它直接掛在 `system.md` 底下,沒有子系統這一層;feature 之間長出來的共同部分由 `refactor` 收整成 abstract,被收整的每一份 feature 記一條 REV。進度不是欄位,由 CLI 從程式碼與測試推導。**

---

## 1. 為什麼砍

砍之前的 dev-flow 是 11,261 行,lawful 是 2,883 行,兩者做的是同一件事。差距不在功能,在**同一條規則被寫進幾個地方**:

| 現象 | 數字 |
|---|---|
| `_shared/` 共用片 | 13 份 1,500 行;`doc-lifecycle.md` 一份 512 行,自己附一張「你要做什麼 → 讀哪幾節」對照表才讀得動 |
| 腳本 | 15 支 4,500 行;`scan-status.mjs` 一支 2,310 行 |
| 文檔分類 | F / E / B / G-F / G-E / G-B 六種,各自一套判準、一套資料夾、一套生命週期 |
| 狀態 | `planned / specced / done / dropped` 四格 + `rev` 欄 + `## 修訂記錄` 條數,三者互相對帳 |
| 進度欄位 | `status`、`code-paths`、`modules`、`part-of`、`stage`、功能總覽索引表 —— 全部要有人記得改 |

根因兩條:

1. **狀態是欄位,不是推導出來的。** 只要有一格要人手動維護,它就會過期,於是需要第二條規則去對帳那一格,再需要第三條去對帳那條對帳。
2. **子系統是強制的中間層。** 一個 feature 必須先屬於某個子系統才有地方住,於是每個子系統要有 `design.md`、模組群表、契約就緒度 A1–A10、build-log,而「跨子系統的功能」又得再開 G-F / G-E / G-C 一整組。層級是為了裝東西而存在,不是因為東西真的分層。

## 2. 決定

| # | 題目 | 裁決 |
|---|---|---|
| 1 | 子系統這一層 | **拿掉。** feature 直接掛 `system.md`;歸屬靠模組表的層與路徑,不靠資料夾 |
| 2 | 跨子系統的 G-F / G-E / G-C | **拿掉。** 沒有子系統就沒有「跨」;共用的東西由 refactor 收整成 abstract |
| 3 | E(擴充功能)與 B(缺陷) | **拿掉。** E 是 feature;bug = 某條 law 在現況下不成立,law 在就修碼、不在就補 law 走 REV,沒有 bug 文檔 |
| 4 | `planned / specced / done` | **拿掉,換成 `draft / ready / frozen`。** 那三格是進度,進度由 `devflow status` 從程式碼與測試推;`status` 欄只放人才知道的決定 |
| 5 | `rev` 欄 | **拿掉。** 它是 `## 修訂記錄` 條數的快取,快取就要對帳;直接數條目 |
| 6 | `code-paths`、`modules`、`part-of`、功能總覽索引 | **拿掉。** 程式碼在哪由簽名對帳查得到 |
| 7 | 四格 law(量詞 / 定義域 / 前提 / 觀察點) | **換成 lawful 的三行純 ASCII。** 四格是散文,機器對不了帳;三行的識別字要對得到 Steps 簽名,`lint laws` 擋 |
| 8 | 簽名怎麼寫才能跨語言 | **正規式 `name(T1, T2): R`。** 文檔寫這一種,adapter 負責把各語言的宣告正規化成它。參數名不進簽名(改名是實作自由) |
| 9 | 模組怎麼指認 | **相對檔案路徑。** package / crate / dotted module 各語言不一致,路徑一致。模組表的樣式是 `src/domain/**` |
| 10 | 四層(types / effects / pure / shell) | **換成專案自己宣告的層,由內而外。** 規則固定一句:內層不准 import 外層;最外層是唯一能做對外 I/O 的層 |
| 11 | 建構期三角色 | **留。** conductor 帶 qa 與 impl,兩邊互不可見,照 lawful 的 `roles.md` |
| 12 | 契約就緒度 A1–A10 / B1–B4、build-log、ASM / SELF / DEC / WAVE | **拿掉。** 前者是「文檔寫完了沒」的清單,現在由 `lint` 回答;後者是編排過程的審計軌跡,定案後沒有人讀 |
| 13 | 舊 `.design/subsystems/` 樹 | `devflow migrate` 印帳本,不改檔 |

## 3. abstract:refactor 的產物

feature 之間會長出同一段能力。現況的做法是「誰先寫誰擁有」,於是那段能力住在一個歷史偶然決定的地方,第二個消費者只能引用它,而改它要去修一份跟自己無關的 feature。

新做法:`refactor` 把那段抽出來成 `A-00x-<slug>`,原本各自寫的那幾列改成「見 A-00x-<slug>」,每一份被動到的 feature 記一條 REV。

**abstract 的存在條件是「被兩份以上文檔引用」。** 這一條要機械化,不然 abstract 會變成第二個垃圾桶:

- 零個消費者 → `lint sig` 紅(死的抽象)
- 一個消費者 → `status` 警訊「收整沒有成立,搬回 F-00x」

feature 有恰好一列 `!`(對外進入點),abstract 沒有。這就是兩者唯一的形狀差別,`lint sig` 照這條對帳。

## 4. 讓 law 在命令式語言裡也成立

lawful 的三行是純函數式的:`|-` 行是一個等式。命令式語言的性質幾乎都帶時序(「換發成功**之後**,舊 id 失效」)。加**一句**規則就夠:

> `given` 行的呼叫先發生,`|-` 行在其後求值。

純函數的情況下順序無關,這句話是 no-op;有狀態的情況下它就是時序。不必為此新增 law 種類,不必新增語法。

法的寫法從 Haskell 的併置改成呼叫式(`rotate(t, s)`),與正規化簽名同一套語法。

## 5. 安全度:寫進對外 I/O 表,不做泛泛的檢查

`audit` 要答「安全嗎」。泛泛的安全審查產出的是通用建議,對這個專案沒有作用。改成掛在已經存在的那張表上:

`system.md` 的對外 I/O 表加兩欄 **信任**(trusted / untrusted)與 **驗證**(哪個 step 做驗證)。`lint io` 對帳三條:

1. `untrusted` 的 `in` 列必須指名一個驗證 step,而它要在該 feature 的 Steps 表裡
2. Examples 與 Laws 的字面值不准出現密碼 / 金鑰 / token 樣式的字串
3. 最外層裡 import 了 IO 模組、卻沒有出現在對外 I/O 表的檔案 → 可能是沒登記的出入口

三條都是這個專案自己的事實,不是通用清單。剩下的判斷(驗證 step 有沒有 law、進入點有沒有繞過 `=` 列)留給 `audit` 的人判段。

## 6. 穩定度

`status` 已經有分母與紅綠。穩定度多的是一件事:**哪裡一直在改**。報告加一行「修訂熱點」——REV 條數最多的三份文檔與最後修訂日,加上被引用最多的 abstract(改它會牽動誰)。不另開指令。

## 7. skills

| skill | 做什麼 |
|---|---|
| `project` | `system.md`(目的、語言與工具、層、對外 I/O、Features 表)、`modules.md`、ADR |
| `feature` | `devflow claim` 建一份 feature,討論到 `ready`:Steps、Laws、Examples、決定 |
| `refactor` | 找出兩份以上 feature 的共同部分,抽成 abstract,原檔改引用並各記一條 REV |
| `build` | conductor:骨架 → qa → 基線 → impl → 仲裁 → 收尾 |
| `qa` / `impl` | 兩個委派角色,互不可見 |
| `revise` | 回答 GAP、改一份文檔,寫 REV |
| `status` | 派工報告 |
| `audit` | 對帳 + 穩定度 + 安全度 |
| `spike` | 要跑了才知道的問題 |
| `branch-pr` / `study` | 不碰文檔模型,只改壞掉的引用 |

## 8. adapters

第一批 TypeScript / JavaScript、Python、Go、Rust。每個 adapter 只回答機械問題:頂層與方法的簽名(正規化成 `name(T1, T2): R`)、匯出、還是 stub 的名字、import(相對的解析成路徑)、型別與列舉名、測試歸屬標記、測試輸出的紅綠。

沒有 adapter 的語言:`lint sig` / `lint boundary` 印「此語言尚無 adapter」跳過,其餘照常。

**型別註記可有可無的語言**(Python、JS)不因此失去對帳:程式碼那一側沒有註記時,只比名字與參數個數,並列 info 說明只對到這兩樣。有註記就逐字比。
