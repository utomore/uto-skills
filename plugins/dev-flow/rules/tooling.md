# 工具

## CLI

一支 CLI `devflow`,入口 `bin/devflow.mjs`。`<D>` 是 plugin 根目錄,一場對話解析一次:

```bash
dirname "$(dirname "$(find ~/.claude/plugins . -maxdepth 8 -type f -path '*dev-flow/bin/devflow.mjs' 2>/dev/null | head -1)")"
```

之後每道指令寫解析出來的實際路徑:`node "<D>/bin/devflow.mjs" <子命令> …`,在專案根目錄(有 `.design/` 的那層)執行。

| 子命令 | 做什麼 |
|---|---|
| `status [--tests <log> \| --run]` | 派工報告。laws 綠幾條要有測試輸出:`--tests` 給留檔的輸出,`--run` 在專案根目錄跑 `system.md` 的整套指令;兩者都沒給、或輸出裡一條 `F-00x#LAW-n` 標記都沒有,就列「未跑」並在開頭寫明 |
| `status --doc <F-00x>` / `--module <路徑>` | 一份文檔的 step 與 law 逐條狀態 / 住在該檔案或目錄的所有 step 的狀態 |
| `claim feature\|abstract\|spike\|adr <slug> [--description <句>]` | 鑄號建檔(feature 與 abstract 是 `status: draft`);feature 另在 `system.md` Features 表加一列,spike 另建 `spike/SPK-00x-<slug>/` |
| `lint boundary` | import 方向 vs 層表;內層 import 外層即紅;非最外層 import IO 模組即紅;未登記與幽靈檔案即紅 |
| `lint sig` | Steps 簽名(含 `o` 列與 `!` 列)vs 程式碼簽名,而且要匯出;`=` 列與 `o` 列不在最外層、`!` 列在最外層、feature 恰好一列 `!`、abstract 沒有;abstract 沒有消費者即紅;feature 引用 feature 即紅;同名簽名在兩份文檔都沒註明「見」即紅;願望 step 列待實作不算紅;簽名一致但檔案不同列「搬家」 |
| `sync` | 把「搬家」的 step 模組欄改成程式碼裡的實際檔案(同層才改,跨層列紅要走 REV) |
| `lint laws` | 三行齊全、種類合法、`\|-` 的識別字對得到 Steps 簽名 / 最內層匯出 / 型別名 / 標準函式庫 / `system.md` 的詞彙追加、`=` 列至少被一條 law 引用、`!` 列不被引用、example 指得到 law |
| `lint trace` | laws / examples ↔ 測試歸屬:未翻譯、幽靈引用即紅;沒有歸屬的測試檔列成內部測試,不算紅 |
| `lint io` | 對外 I/O 表:方向、feature 存在且是 feature、模組在最外層且程式碼裡有、信任欄、`untrusted` 的入口有驗證 step;文檔的秘密字面值;最外層沒登記的出入口 |
| `lint all` | 以上全部 |
| `modules --gen` | 從程式碼補模組表缺的檔案,層欄留白 |
| `section <file> <節>…` | 取節 |
| `spike close <SPK-00x>` | 檢查 verdict / feeds / sha 齊全,刪 `spike/SPK-00x-<slug>/` |
| `migrate <.design>` | 盤點 `subsystems/` 體系的 `.design`,印一份帳本,不改任何檔:每份任務文檔的介面在程式碼裡對到幾條、四格 law 翻成三行草稿、共用簽名列成 abstract 候選、退場清單、人要判的清單 |

exit code:`status` 盤點 = 驗收(有未達成或 open GAP 即 1),`status --doc` / `--module` = 查得到 0、查不到 1;`lint` 一律 0 / 1。

## status 報告

給開發者讀的派工報告,版面固定:

1. 今天能開幾條線:`ready`、沒 open GAP、引用的 abstract 沒卡的文檔
2. 卡住的:停在 GAP 的 step、等重派、等 abstract
3. 等決定:open 的 GAP、open 的 spike、`draft` 的文檔
4. 牽動誰:誰引用了這份的簽名
5. 待實作:按檔案列願望 step、找不到的 step、本體還是骨架的 step
6. 修訂熱點:REV 條數最多的三份與最後一條、被兩份以上引用的 abstract。**這一段答的是穩定度**:一直在改的地方就是設計還沒收斂的地方
7. 警訊:`frozen` 而紅、REV 沒解凍紀錄、只有一個消費者的 abstract、未登記檔案、簽名不一致、還是模板
8. 建議路線

分母是 `system.md`「Features」表的份數。

## 測試歸屬

每條 law 與 example 至少一條測試,測試宣告歸屬 `F-00x#LAW-n`。歸屬有兩種寫法,同一個意思:

| 寫法 | 用在 | 例 |
|---|---|---|
| 字串 `F-001#LAW-1` | 測試名可以是任意字串 | `describe("F-001#LAW-1 …")`、`t.Run("F-001#LAW-1", …)` |
| 識別字 `f_001__law_1` | 測試名必須是識別字(`-` 換 `_`,`#` 換 `__`,大小寫不拘) | `def test_f_001__law_1_rotate(…)`、`fn f_001__law_1_rotate()` |

一條測試只放一個歸屬字串,測試輸出才對得回來。`devflow lint trace` 兩種都認。

## language adapter

`system.md` 的 `language` 選 adapter;語言相關的事全部走 adapter,讀取層不認識任何語言:

| adapter 提供 | 用在 |
|---|---|
| `signatures(file)`:頂層與方法的簽名,正規化成 `name(T1, T2): R` | `lint sig`、`status` |
| `exports(file)`:對外匯出的名字 | `lint sig` |
| `typeNames(file)`:型別、列舉成員 | `lint laws`、`lint io` |
| `stubs(file)`:本體還是骨架標記的名字 | `status` |
| `imports(file)`:import 的目標 | `lint boundary`、`lint io` |
| `ioModules`:預設 IO 模組黑名單 | `lint boundary`、`lint io` |
| `testMarkers(file)`:測試檔裡的歸屬 | `lint trace` |
| `testResults(log)`:測試輸出 → 每個歸屬綠 / 紅 / pending | `status` |
| `stdlib`:law 裡可直接用的標準函式庫名 | `lint laws` |
| `stub(marker)`:帶 `F-00x#name` 的骨架本體 | conductor 寫骨架 |

現有 adapter:

| adapter | 副檔名 | 匯出 | 骨架 | 測試輸出 |
|---|---|---|---|---|
| `typescript`(含 javascript) | `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` | `export` | `throw new Error(…)` | jest / vitest / mocha |
| `python` | `.py` | `__all__`,沒寫就是不以底線開頭的 | `raise NotImplementedError` | pytest / unittest |
| `go` | `.go` | 大寫開頭 | `panic(…)` | `go test -v` |
| `rust` | `.rs` | `pub` | `todo!()` | `cargo test` |

- 模組的身分是**相對專案根目錄的檔案路徑**。import 的目標:相對路徑直接相加;`a/b`、`a.b`、`a::b` 這種至少兩段的,拿尾段去對專案裡的檔案與資料夾;單段的(`os`、`fmt`、`react`)一律當外部套件。
- **型別註記可有可無的語言**(Python、JavaScript)照樣對得到帳:程式碼那一側沒有註記時,只比名字與參數個數,`lint sig` 列 info 說明只對到這兩樣。
- Rust 的 `#[cfg(test)] mod` 不算產品程式碼:它的 `use` 與 `fn` 不進簽名與 import 圖,但裡面的歸屬標記照樣掃得到。
- 沒有 adapter 的語言:`lint sig` 與 `lint boundary` 印「此語言尚無 adapter」跳過,其餘照常。

## 跑東西的紀律

測試、建置、lint 都照三道關:

1. **該不該跑**:輸出會改變接下來做什麼才跑。不拿測試判「文檔與程式碼哪邊過期」(看 `updated` 與原始碼);不為了回報裡的一個數字而跑。
2. **是不是重跑**:輸入沒變就沿用上次輸出並寫「沿用」。有變只跑涵蓋得到改動的範圍;整套一個迴圈一次(roles.md「測試跑幾次」)。
3. **輸出留檔**:`<指令> > <log> 2>&1; tail -20 <log>`,之後從檔案 grep。同一道指令連續失敗兩次,第三次前先換做法。

## 收尾定錨

每個 skill 的收尾,回報最後附這四段,不超過一個畫面。委派模式的 subagent 不輸出。

1. **位置樹**:`system.md` → 每份 feature 一行(達成 / 進行中 / 未開工)→ 目前文檔展開到 step 與 law,各標簽名在不在、law 綠不綠;引用到的 abstract 掛在它底下。目前節點標 `◀ 目前`。全部寫全名。
2. **完成度**兩行:產品(feature 達成 n / m · 文檔達成 n / m · 待實作 step n)、本次(目前文檔簽名 m / n · laws g / k)。數字只來自 `devflow status` 與實際跑過的測試;沒跑寫「沿用 <哪一次>」或「未跑」。
3. **主軸檢查**:本次對應哪份文檔的哪個 step 或 law;偏離清單(簽名與 Steps 不符、內層 import 外層、測試後門、未登記檔案、open GAP、動了文檔沒寫的東西、兩份 feature 開始寫同一段而沒走 refactor),每條附位置與建議;沒有寫「無」。
4. **下一步**:一條具體命令(參數寫全名)加一句為什麼;最多兩條替代。下一步必須從樹上推得出來。
