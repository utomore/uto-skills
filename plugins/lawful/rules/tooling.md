# 工具

## CLI

一支 CLI `lawful`,入口 `bin/lawful.mjs`。`<L>` 是 plugin 根目錄,一場對話解析一次:

```bash
dirname "$(dirname "$(find ~/.claude/plugins . -maxdepth 8 -type f -path '*lawful/bin/lawful.mjs' 2>/dev/null | head -1)")"
```

之後每道指令寫解析出來的實際路徑:`node "<L>/bin/lawful.mjs" <子命令> …`,在專案根目錄(有 `.lawful/` 的那層)執行。

| 子命令 | 做什麼 |
|---|---|
| `status [--tests <log> \| --run]` | 派工報告。laws 綠幾條要有測試輸出:`--tests` 給留檔的輸出,`--run` 跑 `system.md` 的整套指令;兩者都沒給就列「未跑」 |
| `status --pipeline <P-00x>` / `--module <M>` | 一條 pipeline 的 stage 與 law 逐條狀態 / 住在該模組的所有 stage 的狀態 |
| `claim <slug> [--description <句>]` | 鑄號建 pipeline 檔(`status: draft`),`system.md` Pipelines 表加一列,類別欄由人填 |
| `lint boundary` | import 與簽名 vs 模組表;types / effects / pure 命中效果即紅;未登記與幽靈模組即紅 |
| `lint sig` | Stages 簽名 vs 程式碼簽名,逐字;願望 stage 列待實作不算紅;簽名一致但模組不同列「搬家」 |
| `sync` | 把「搬家」的 stage 模組欄改成程式碼的實際模組(同層才改,跨層列紅要走 REV) |
| `lint laws` | 三行齊全、種類合法、`\|-` 的識別字對得到 Stages 簽名、types 層匯出或 adapter 的標準函式庫清單、example 指得到 law |
| `lint trace` | laws / examples ↔ 測試歸屬:未翻譯、幽靈引用即紅;沒有歸屬的測試檔列成內部測試,不算紅 |
| `lint all` | 以上全部 |
| `modules --gen` | 從程式碼生成模組表骨架,層欄留白;已有的表保留層欄、只補新模組 |
| `section <file> <節>…` | 取節 |
| `spike close <SPK-00x>` | 檢查 verdict / feeds / sha 齊全,刪 `spike/SPK-00x-<slug>/` |
| `migrate from-dev-flow <.design> [--write <file>] [--ignore <dir,dir>]` | 盤點 `subsystems/<slug>/` 體系的 `.design`,印一份帳本,不改任何檔:每份 F / E / G-* 的介面簽名在程式碼裡對到幾條、四格 law 翻成三行草稿(散文的標「需形式化」)、按簽名所在模組分組並建議 `claim` 的 slug、開發階段表列成里程碑候選、退場清單、人要判的清單。分組、里程碑切法、law 形式化由人做 |

exit code:`status` 盤點 = 驗收(有未達成或 open GAP 即 1),`status --pipeline` / `--module` = 查得到 0、查不到 1;`lint` 一律 0 / 1。

## status 報告

給開發者讀的派工報告,版面固定:

1. 今天能開幾條線:`ready`、沒 open GAP、引用的子流沒卡的 pipeline
2. 卡住的:停在 GAP 的 stage、等重派、等子流
3. 等決定:open 的 GAP、open 的 spike、`draft` 的 pipeline
4. 牽動誰:誰引用了這條的簽名
5. 待實作:按模組列願望 stage
6. 警訊:`frozen` 而紅、REV 沒解凍紀錄、未登記模組、簽名不一致
7. 建議路線

分母是 `system.md`「Pipelines」表的 pipeline 數與里程碑數。

## language adapter

`system.md` 的 `language` 選 adapter;語言相關的事全部走 adapter,讀取層不認識任何語言:

| adapter 提供 | 用在 |
|---|---|
| `signatures(file)`:頂層簽名(名字、型別文字、模組) | `lint sig`、`status` |
| `imports(file)`:import 的模組 | `lint boundary` |
| `isEffectful(signature)`:簽名是否碰到效果 | `lint boundary` |
| `ioModules`:預設 IO 模組黑名單 | `lint boundary` |
| `testMarkers(file)`:測試檔裡的 `P-00x#LAW-n` / `P-00x#EX-n` 歸屬 | `lint trace` |
| `testResults(log)`:測試輸出 → 每個歸屬標記綠 / 紅 / pending | `status` |
| `stdlib`:law 裡可直接用的標準函式庫函數 | `lint laws` |
| `stub`:未實作本體 | conductor 寫骨架 |

Haskell adapter:`.hs`;簽名認欄位 0 的頂層簽名(含運算子、多行)、record 欄位(存取子型別 `Record -> 欄位型別`,Stages 表照這個寫)、`class` 底下的方法;不認 `instance` 底下的方法與函數本體 `where` 裡的區域函數;`import` 行;`IO` 出現在簽名即效果;歸屬只認字串字面值 `"P-00x#LAW-n"`;測試輸出認 hspec(specdoc)與 tasty 兩種版面,標記可以是群組名或單一測試名;`stub` = `undefined`。沒有 adapter 的語言:`lint sig` 與 `lint boundary` 印「此語言尚無 adapter」跳過,其餘照常。

## 跑東西的紀律

測試、建置、lint 都照三道關:

1. **該不該跑**:輸出會改變接下來做什麼才跑。不拿測試判「文檔與程式碼哪邊過期」(看 `updated` 與原始碼);不為了回報裡的一個數字而跑。
2. **是不是重跑**:輸入沒變就沿用上次輸出並寫「沿用」。有變只跑涵蓋得到改動的範圍;整套一個迴圈一次(roles.md「測試跑幾次」)。
3. **輸出留檔**:`<指令> > <log> 2>&1; tail -20 <log>`,之後從檔案 grep。同一道指令連續失敗兩次,第三次前先換做法。

## 收尾定錨

每個 skill 的收尾,回報最後附這四段,不超過一個畫面。委派模式的 subagent 不輸出。

1. **位置樹**:`system.md` → 里程碑 pipeline 各一行(達成 / 進行中 / 未開工)→ 目前 pipeline 展開到 stage 與 law,各標簽名在不在、law 綠不綠;目前節點標 `◀ 目前`。全部寫全名。
2. **完成度**兩行:產品(里程碑達成 n / m · pipeline 達成 n / m · 待實作 stage n)、本次(目前 pipeline 簽名 m / n · laws g / k)。數字只來自 `lawful status` 與實際跑過的測試;沒跑寫「沿用 <哪一次>」或「未跑」。
3. **主軸檢查**:本次對應哪條 pipeline 的哪個 stage 或 law;偏離清單(簽名與 Stages 不符、import 越層、測試後門、未登記模組、open GAP、動了文檔沒寫的東西),每條附位置與建議;沒有寫「無」。
4. **下一步**:一條具體命令(參數寫全名)加一句為什麼;最多兩條替代。下一步必須從樹上推得出來。
