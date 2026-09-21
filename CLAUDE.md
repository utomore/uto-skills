# mkSkills 專案規則

本 repo 是 Claude Code plugin 的原始碼(`plugins/<plugin>/skills/…`)。SKILL.md、`rules/`、`_shared/`、`templates/` 是**規章**,被別的專案在執行時載入;它們的每一句話都會變成某個 session 的行為。

## 文檔一律宣告式

- **只寫當下事實。** 規章描述「現在的規則是什麼」,不描述「規則怎麼變成這樣」。禁止出現版本號(`2.2.1 之前`)、時間敘述(`以前`、`後來才補`)、舊制對照(`舊格式`、`v1 / v2`、`舊制照舊可讀`)、事故回憶(`本流程被修過`、`這條規則是照 X 補上的`)。
- **一個概念退場,就從所有規章裡消失。** 不留「已移除」「不再使用」的註記,不留只為相容舊寫法而存在的說明。腳本可以靜默容忍舊寫法,規章不提。
- **舊 → 新只准出現在兩個地方**:遷移工具本身(`lib/commands/migrate.mjs` 的檔頭與輸出)與各 plugin 的 `kickoff` skill 裡叫人去跑它的那一句。那是唯一以「不合規的樹怎麼變合規」為題的地方。
- **腳本的使用者可見訊息也是規章**(`--help`、提示、不一致訊息):同一條規則。程式碼註解不受此限。
- **不合規的輸入用條件句描述**,不稱它為舊版:寫「只有 `docs/arch/` 體系的專案 → …」,不寫「舊版 `docs/arch/`」。
- `wip/` 底下的設計稿是**紀錄**不是規章,可以有推理過程、決定紀錄與歷史;它不會被任何 session 載入。

改完規章跑一次這道,命中的每一條都要是專案自己的概念,不是規章自己的歷史:

```
grep -rn -E '2\.[0-9]\.[0-9]|以前|舊制|舊格式|舊文檔|舊專案|舊版|之前的流程|後來才|補上的|修過|修出來|曾同時|\bv1\b|\bv2\b|不再有|不再需要' --include=*.md plugins/ | grep -v tests/
```

## 測試、夾具、範例住 repo 根目錄的 `tests/`

`plugins/<plugin>/` 底下只放會裝到使用者電腦的東西:規章、skills、模板、腳本。測試、夾具、範例一律在 `tests/<plugin>/`,marketplace 的 `source` 不涵蓋它們。

改了 `plugins/dev-flow/{bin,lib,templates}/` 或 `plugins/lawful/{bin,lib}/` 之後:

```
bash tests/dev-flow/run.sh                # dev-flow:夾具的 golden 回歸 + --help,brief 點名的規章節都在(節改了名會紅,brief 的 golden 用 --no-rules 所以不跟著規章變)、每個 skill 載到的規章都在字數上限以內(超過代表它拿了別人的工作)、規章與 SKILL.md 裡「<檔>.md「<節>」」的交叉引用都指得到那一節、brief 每一段都在一道注入指令的大小上限以內而且接起來一個字不少、十三份 SKILL.md 與 brief 的 skill 名單一一對上而且 frontmatter 讀得成(description 裡有「冒號加空白」整個 skill 就不會被載入)、注入行與 allowed-tools 寫對,`migrate laws` 與 `migrate requirements` 兩種先後接連跑落地的樹都相同、專案根目錄 `CLAUDE.md` 的「## 名詞」節的讀法(檔案不存在與沒有這一節是同一條警訊、這一節以外的表不會被當成名詞表),另外真的開一個 repo 驗殘留的 build 分支、切片的工作樹(claim 跨工作樹配號、status 讀出分支走到哪一步)與靠修訂達成的里程碑的工作樹(先印待修訂,寫了引用它的 REV 之後往下走)、專案的第一條切片單獨走完(全域 Law 三區都空而已經有切片在建構中時不列別的切片,立了一條之後照常列),層表還沒有列的樹 lint boundary / sig / laws 不紅;fixtures/shop 同時是 .design 的完整範例
bash tests/lawful/run.sh                  # lawful:九個夾具的 golden 回歸 + --help,brief 點名的規章節都在、每個 skill 載到的規章都在字數上限以內、規章與 SKILL.md 的交叉引用都指得到那一節、brief 每一段都在一道注入指令的大小上限以內而且接起來一個字不少、十四份 SKILL.md 與 brief 的 skill 名單一一對上而且 frontmatter 讀得成、六道注入行與 allowed-tools 寫對、三道 migrate(cone、laws、requirements)以任何先後接連跑落地的樹都相同、專案根目錄 `CLAUDE.md` 的「## 名詞」節的讀法,另外真的開一個 repo 驗靠修訂達成的里程碑的工作樹與專案的第一條切片單獨走完(直接拿模板 Cone 開樹,空的全域 Law 區不紅、不列警訊)(brief 的 golden 一樣用 --no-rules);fixtures/save-game 同時是 .lawful 的完整範例
```

改了 `ci/dev-flow/contract.mjs` 或 `ci/lawful/contract.mjs`:

```
bash tests/ci/run.sh                      # 契約檢查腳本:--lint-only 對兩邊的夾具各跑一次,看 exit code 與關鍵訊息
```

`ci/dev-flow/` 與 `ci/lawful/` 是給使用者複製到自己專案的 CI 範本,兩套各自獨立(各有 `contract.mjs`、GitHub Actions、GitLab CI、CODEOWNERS、README);它們不裝進 plugin,但腳本的使用者可見訊息與 README 一樣是規章。

改了 `templates/status-board.html` 還要多跑這一道:

```
bash tests/board/run.sh                   # 看板在真的 Chrome 裡點過一遍:點選、拖曳、縮排、走線、相依頁籤、約束頁籤(契約欄的弧線用 `shop` 與 `save-game` 兩個夾具驗)
```

`tests/board/` 用 Node 內建的 WebSocket 直接講 CDP 開一個 headless Chrome,不裝套件;找不到 Chrome 就用 `CHROME_PATH` 指到執行檔。看板的行為只有這一道守得住 —— 另外兩道是 CLI 的文字比對,不會開頁面。

行為是刻意改的才 `--update` 重產 golden,並在 PR 說明為什麼變。夾具本身也是規章的一部分。夾具根目錄的 `CLAUDE.md` 是夾具的一部分(那棵樹的名詞表),不是給這個 repo 的指示;migrate 的輸入夾具故意不放它,「沒有 ## 名詞 節」的警訊在它們的 status 出現。dev-flow:`shop` 示範一棵全綠的樹(根目錄 `CLAUDE.md` 的名詞節有四個名詞、型別欄都是夾具程式碼裡真的有的型別,需求一條一個檔住 `requirements/`,有優先、三行式的驗收與 `R-1#ACCEPT` 驗收測試、里程碑有英文名與怎麼驗欄、驗收記錄有一列已驗收(全綠的樹要人簽過才是已驗收),第三條里程碑 `M-3-settle-total` 綁既有的 `F-001-checkout`、靠修訂它達成,`F-001` 的 REV 依欄引用它所以算達成,`system.md` 的「全域 Law」區三類齊全:一條領域不變量有 `INV-1#LAW` 測試、層表、對外 I/O 表的契約欄指到守它的 law,「Constraint」節五類都寫了,`settle` 這個 step 與它的 law 只住 `F-001-checkout`,`F-002-refund` 在模組欄註明「見 F-001-checkout」引用它),`blank` 是剛從模板複製出來一個字都沒填的樹(佔位符列不准被當成真的,名詞節的佔位符列也一樣:節在、表是空的,不警告;「全域 Law」三區是空的——領域不變量「無」、層表與對外 I/O 表只有表頭——不紅、不列警訊,那是第一條切片抽出全域 Law 之前的樣子),`shaky` 讓每一道紅與每一條警訊各出現一次(含名詞表一列的型別在程式碼裡找不到、同一個名詞出現兩列、領域不變量沒有三行、有三行而沒測試又引用了 feature 的簽名、編號重複與種類不合法、契約欄指不到 law、里程碑沒有英文名、里程碑編號重複、需求的驗收還是模板、寫了三行沒測試、需求的優先不合法、需求沒有里程碑、需求檔沒有 frontmatter、檔名與 frontmatter 對不上、引用的那一份沒有這個 step、兩份文檔各寫了同名的 step 都沒註明「見」、簽過驗收而證據翻掉的需求(待重審)、靠修訂達成而還沒有 REV 引用的里程碑(待修訂)、靠修訂達成卻沒有英文名的里程碑、驗收引用進入點、兩份 ADR 同號、號段重疊與 owner 的號不在區間內、測試輸出裡有這棵樹沒有測試承接的結果),`py-svc` / `go-svc` / `rs-svc` 各證明一個 adapter(含需求驗收測試歸屬的字串與識別字兩種寫法;各自的需求都有怎麼驗欄與一列已驗收,才維持全綠),`fullstack` 是前端 TypeScript 加後端 Python 住同一棵樹(language 欄是「目錄 = adapter」清單、三道指令每側一組、兩份測試輸出各用自己的 adapter 解析後合併;三條需求,其中一條的 feature 引用另一條的 feature,status 的「依賴」欄因此印得出東西),`flat` 是里程碑還擠在一份 `objectives.md`、`system.md` 也還沒有「全域 Law」區的樹,給 `migrate requirements` 與 `migrate laws` 當輸入,`goals` 是需求住 `system.md`「## 需求」節、里程碑住 `objectives/` 的樹(一條需求有兩個目標檔、一條沒有、一個目標檔對不到需求),status 照讀、`migrate requirements` 把它換成 `requirements/`,`tuned` 是已經住 `requirements/`、需求檔卻還帶調整表的樹(status 照讀成靠修訂達成的里程碑、警訊指到 `migrate requirements`、寫檔的指令停下;`migrate requirements` 把每一列換成里程碑並改寫 REV 依欄的引用),`legacy` 是 `subsystems/` 體系的遷移帳本輸入,`shared-doc` 是有一份文檔住在 `abstracts/` 底下、被兩份 feature 引用的樹(CLI 靜默照讀,當成不被里程碑綁定的文檔),`team` 是 `system.md` 有號段行的樹(claim 從自己的區間配號並寫 owner,email 不在號段行上就停)。lawful:`save-game` 是完整範例(根目錄 `CLAUDE.md` 的名詞節有四個名詞、型別欄都是夾具程式碼裡真的有的型別,需求一條一個檔住 `requirements/`,有優先、三行式的驗收與 `R-1#ACCEPT` 驗收測試、里程碑有英文名與怎麼驗欄、一條靠修訂既有 pipeline 達成而還待修訂的里程碑,`Cone.md` 的「全域 Law」區三類齊全:一條領域不變量有 `INV-1#LAW` 測試、四層、對外 I/O 表的契約欄指到守它的 law,「Constraint」節五類都寫了),`broken` 讓每一道紅與每一條警訊各出現一次(`R-5-save-browse` 是證據齊了、還沒有人審的那一條:接 `stale.log` 跑才看得到待審核與它的怎麼驗欄警訊;含名詞表一列的型別在程式碼裡找不到、同一個名詞出現兩列、需求的驗收還是模板、領域不變量沒有三行、有三行而沒測試又引用了 core 的簽名、編號重複與種類不合法、契約欄指不到 law、里程碑沒有英文名、里程碑編號重複、簽過驗收而證據翻掉的需求(待重審)、證據齊了等人工審核而里程碑沒有怎麼驗欄的需求、需求的優先不合法、需求沒有里程碑、需求檔沒有 frontmatter、檔名與 frontmatter 對不上、靠修訂達成卻沒有英文名的里程碑、簽名裡升格的建構子打錯字而正確的 `'Ctor` 與 `SomeTypeRep` 不紅、context 是沒括號的多參數約束的 class 與只在 import 清單裡點名的型別不紅、兩份 ADR 同號、號段重疊與 owner 的號不在區間內、測試輸出裡有這棵樹沒有測試承接的結果),`verified-ref` / `run-cmd` / `refs` / `templated` 各證明一件事(引用排在後面的 verified subflow,以及兩條靠修訂達成的里程碑——一條的 REV 已經引用它所以達成、一條待修訂、指令欄帶說明、沒有 adapter 的引用圖——兩條需求,其中一條的 pipeline 引用另一條的,status 的「依賴」欄因此印得出東西——、剛 claim 的模板),`preflow` 是需求還住 `Cone.md` 的「## 需求」節而且寫著 Law、里程碑住 `objectives/`(一條需求有兩個目標檔、一條沒有、一個目標檔對不到需求)、目標有 Law、「邊界」與「對外 I/O」住 `modules.md`、里程碑只有編號、pipeline 的 `kind` 還是中文值的樹,給 `migrate laws` 與 `migrate requirements` 當輸入,status 照讀,`tuned` 是已經住 `requirements/`、需求檔卻還帶調整表的樹,給 `migrate requirements` 當輸入並驗照讀,`legacy` 是只有 `system.md` 的樹,給 `migrate cone` 當輸入,`team` 是 `Cone.md` 有號段行的樹(claim 從自己的區間配號並寫 owner,email 不在號段行上就停)。

## 版本與 PR

- dev-flow 與 lawful 的 `plugin.json` **不寫 `version`**:marketplace 是 git 來源,Claude Code 以 commit SHA 判斷更新,每次 merge 到 `main` 使用端跑 `claude plugin update dev-flow@uto-skills` 就拿到最新。寫了 `version` 反而會讓字串沒變的更新被快取擋住。何時恢復版號由使用者指定,不自行推算(全域規則)。
- `plugin.json` 與 `marketplace.json` 的 `description` 也是規章:宣告式,講現在有什麼,不講改了什麼。
- 合併後的 follow-up 從 `main` 開新分支、新 PR,不在已合併的分支上疊 commit。
- PR 內文照 `integrate` skill 的固定章節,繁體中文;標題英文。
