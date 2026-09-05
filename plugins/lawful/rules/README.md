# lawful 規章

`lawful` 替純函數式專案(functional core / imperative shell)做 spec 驅動開發,不限語言。文檔的單位是 **pipeline**:一段 input → 純轉換 → output 的資料流,stage 是住在程式碼裡的簽名,laws 是測試存在之前的性質。

`rules/` 四份主題規章是每條規則唯一的住處;skill 只寫步驟並用檔名加節名引用,不重述。

| 檔 | 主題 |
|---|---|
| `pipelines.md` | `.lawful/` 樹、system.md、pipeline 文檔的節、laws、REV、GAP、願望 stage、完成度、ADR、spike |
| `boundary.md` | 四層、模組表、效果的判定、對外 I/O、測試與邊界 |
| `roles.md` | 兩個階段、conductor / qa / impl、委派、收尾、仲裁、測試跑幾次 |
| `tooling.md` | CLI 子命令與 exit code、status 報告版面、language adapter、跑東西的紀律、收尾定錨 |

## 名詞

| 名詞 | 在哪 |
|---|---|
| pipeline、stage、`=` 列 / 純的整條、`!` 列 / 進入點、`o` 列 / 觀察點、里程碑、子流 | pipelines.md「pipeline」 |
| 全名、`P-00x#name`、`P-00x#LAW-n` | pipelines.md「編號與引用」 |
| `draft` / `ready` / `frozen`、解凍 | pipelines.md「frontmatter 與 status」 |
| Brief、Stages、Laws、law 種類、Examples、決定 | pipelines.md「節」 |
| 什麼要有 law、自由度、內部支架 | pipelines.md「什麼要有 law」 |
| REV、動到 / 保護 / 重委派 | pipelines.md「修訂(REV)」 |
| GAP、`gaps.md` | pipelines.md「提問(GAP)」 |
| 願望 stage、進底層 / 留本地 | pipelines.md「願望 stage」 |
| 簽名 m / n、骨架 s、laws g / k、達成 | pipelines.md「完成度」 |
| law 種類(`invariant` … `total`、`commute`)、class 法則 | pipelines.md「節」「什麼要有 law」 |
| ADR、spike、SPK、RND、verdict、feeds | pipelines.md「ADR」「spike」 |
| types / effects / pure / shell、效果 ADT、匯出清單 | boundary.md「四層」 |
| 模組表、未登記、幽靈、`--module` | boundary.md「模組表」 |
| 效果型別、IO 模組、`isEffectful`、純解譯器、真解譯器 | boundary.md「效果的判定」 |
| 對外 I/O、`lint io` | boundary.md「對外 I/O」 |
| `*.Internal`、後門 | boundary.md「測試與邊界」 |
| conductor、qa、impl | roles.md「三角色」 |
| 委派、回報五項 | roles.md「委派」 |
| 骨架、`stub`、基線 | roles.md「骨架與基線」 |
| 產生器、shrink、覆蓋率、案例數上限 | roles.md「qa 的交付」 |
| 波末收尾 | roles.md「收尾」 |
| 仲裁四分流 | roles.md「仲裁」 |
| `<L>`、子命令、exit code | tooling.md「CLI」 |
| adapter | tooling.md「language adapter」 |
| 三道關 | tooling.md「跑東西的紀律」 |
| 定錨區塊 | tooling.md「收尾定錨」 |

## 每個 skill 讀什麼

`<L>` 解析一次(tooling.md「CLI」);節用 `node "<L>/bin/lawful.mjs" section <檔> <節>…` 取,一次讀完。

| skill | 必讀 |
|---|---|
| `lawful:design` | pipelines.md「`.lawful/`」「system.md」「ADR」;boundary.md 全份;tooling.md「language adapter」「收尾定錨」 |
| `lawful:pipeline` | pipelines.md「pipeline」「編號與引用」「frontmatter 與 status」「節」「什麼要有 law」「願望 stage」;boundary.md「模組表」;tooling.md「收尾定錨」 |
| `lawful:build` | roles.md 全份;pipelines.md「提問(GAP)」「修訂(REV)」「完成度」;tooling.md「CLI」「跑東西的紀律」「收尾定錨」 |
| `lawful:qa` | roles.md「三角色」「委派」「qa 的交付」;pipelines.md「節」「什麼要有 law」「提問(GAP)」;boundary.md「測試與邊界」 |
| `lawful:impl` | roles.md「三角色」「委派」;pipelines.md「節」「提問(GAP)」;boundary.md「四層」 |
| `lawful:revise` | pipelines.md「frontmatter 與 status」「修訂(REV)」「提問(GAP)」;tooling.md「收尾定錨」 |
| `lawful:status` | tooling.md「CLI」「status 報告」「收尾定錨」;pipelines.md「完成度」 |
| `lawful:audit` | tooling.md「CLI」(含 `sync`);boundary.md 全份;pipelines.md「節」「什麼要有 law」「完成度」 |
| `lawful:spike` | pipelines.md「spike」;roles.md「委派」「spike」;tooling.md「跑東西的紀律」 |

prompt 標明委派模式的執行另讀 roles.md「委派」,不讀「收尾定錨」。
