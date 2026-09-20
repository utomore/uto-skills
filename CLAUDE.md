# mkSkills 專案規則

本 repo 是 Claude Code plugin 的原始碼(`plugins/<plugin>/skills/…`)。SKILL.md、`rules/`、`_shared/`、`templates/` 是**規章**,被別的專案在執行時載入;它們的每一句話都會變成某個 session 的行為。

## 文檔一律宣告式

- **只寫當下事實。** 規章描述「現在的規則是什麼」,不描述「規則怎麼變成這樣」。禁止出現版本號(`2.2.1 之前`)、時間敘述(`以前`、`後來才補`)、舊制對照(`舊格式`、`v1 / v2`、`舊制照舊可讀`)、事故回憶(`本流程被修過`、`這條規則是照 X 補上的`)。
- **一個概念退場,就從所有規章裡消失。** 不留「已移除」「不再使用」的註記,不留只為相容舊寫法而存在的說明。腳本可以靜默容忍舊寫法,規章不提。
- **舊 → 新只准出現在兩個地方**:遷移工具本身(`lib/commands/migrate.mjs` 的檔頭與輸出)與各 plugin 立案的 skill(dev-flow 的 `kickoff`、lawful 的 `project`)裡叫人去跑它的那一句。那是唯一以「不合規的樹怎麼變合規」為題的地方。
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
bash tests/dev-flow/run.sh                # dev-flow:夾具的 golden 回歸 + --help,brief 點名的規章節都在(節改了名會紅,brief 的 golden 用 --no-rules 所以不跟著規章變)、brief 每一段都在一道注入指令的大小上限以內而且接起來一個字不少、十三份 SKILL.md 與 brief 的 skill 名單一一對上而且 frontmatter 讀得成(description 裡有「冒號加空白」整個 skill 就不會被載入)、注入行與 allowed-tools 寫對,另外真的開一個 repo 驗殘留的 build 分支與切片的工作樹(claim 跨工作樹配號、status 讀出分支走到哪一步);fixtures/shop 同時是 .design 的完整範例
bash tests/lawful/run.sh                  # lawful:九個夾具的 golden 回歸 + --help,brief 點名的規章節都在、brief 每一段都在一道注入指令的大小上限以內而且接起來一個字不少、十三份 SKILL.md 的注入行與 allowed-tools 寫對(brief 的 golden 一樣用 --no-rules);fixtures/save-game 同時是 .lawful 的完整範例
```

改了 `ci/dev-flow/contract.mjs` 或 `ci/lawful/contract.mjs`:

```
bash tests/ci/run.sh                      # 契約檢查腳本:--lint-only 對兩邊的夾具各跑一次,看 exit code 與關鍵訊息
```

`ci/dev-flow/` 與 `ci/lawful/` 是給使用者複製到自己專案的 CI 範本,兩套各自獨立(各有 `contract.mjs`、GitHub Actions、GitLab CI、CODEOWNERS、README);它們不裝進 plugin,但腳本的使用者可見訊息與 README 一樣是規章。

改了 `templates/status-board.html` 還要多跑這一道:

```
bash tests/board/run.sh                   # 看板在真的 Chrome 裡點過一遍:點選、拖曳、縮排、走線、相依頁籤
```

`tests/board/` 用 Node 內建的 WebSocket 直接講 CDP 開一個 headless Chrome,不裝套件;找不到 Chrome 就用 `CHROME_PATH` 指到執行檔。看板的行為只有這一道守得住 —— 另外兩道是 CLI 的文字比對,不會開頁面。

行為是刻意改的才 `--update` 重產 golden,並在 PR 說明為什麼變。夾具本身也是規章的一部分。dev-flow:`shop` 示範一棵全綠的樹(需求一條一個檔住 `requirements/`,有優先、三行式的驗收與 `R-1#ACCEPT` 驗收測試、里程碑有英文名,`system.md` 的「全域 Law」區三類齊全:一條領域不變量有 `INV-1#LAW` 測試、層表、對外 I/O 表的契約欄指到守它的 law,兩份 feature 共用一份 abstract),`blank` 是剛從模板複製出來一個字都沒填的樹(佔位符列不准被當成真的),`shaky` 讓每一道紅與每一條警訊各出現一次(含領域不變量只有一句話、寫了三行沒測試又引用了 feature 的簽名、編號重複與種類不合法、契約欄指不到 law、里程碑沒有英文名、里程碑編號重複、需求的驗收還是模板、寫了三行沒測試、需求的優先不合法、需求沒有里程碑、需求檔沒有 frontmatter、檔名與 frontmatter 對不上、調整動到里程碑沒綁過的 feature、驗收引用進入點、兩份 ADR 同號、號段重疊與 owner 的號不在區間內、測試輸出裡有這棵樹沒有測試承接的結果),`py-svc` / `go-svc` / `rs-svc` 各證明一個 adapter(含需求驗收測試歸屬的字串與識別字兩種寫法),`fullstack` 是前端 TypeScript 加後端 Python 住同一棵樹(language 欄是「目錄 = adapter」清單、三道指令每側一組、兩份測試輸出各用自己的 adapter 解析後合併),`flat` 是里程碑還擠在一份 `objectives.md`、`system.md` 也還沒有「全域 Law」區的樹,給 `migrate requirements` 與 `migrate laws` 當輸入,`goals` 是需求住 `system.md`「## 需求」節、里程碑住 `objectives/` 的樹(一條需求有兩個目標檔、一條沒有、一個目標檔對不到需求),status 照讀、`migrate requirements` 把它換成 `requirements/`,`legacy` 是 `subsystems/` 體系的遷移帳本輸入,`team` 是 `system.md` 有號段行的樹(claim 從自己的區間配號並寫 owner,email 不在號段行上就停)。lawful:`save-game` 是完整範例(需求有三行式的驗收與 `R-1#ACCEPT` 驗收測試、里程碑有英文名、一條待修訂的調整,`Cone.md` 的「全域 Law」區三類齊全:一條領域不變量有 `INV-1#LAW` 測試、四層、對外 I/O 表的契約欄指到守它的 law),`broken` 讓每一道紅與每一條警訊各出現一次(含需求的驗收還是模板、領域不變量只有一句話、寫了三行沒測試又引用了 core 的簽名、編號重複與種類不合法、契約欄指不到 law、里程碑沒有英文名、調整動到里程碑沒綁過的 pipeline、簽名裡升格的建構子打錯字而正確的 `'Ctor` 與 `SomeTypeRep` 不紅、context 是沒括號的多參數約束的 class 與只在 import 清單裡點名的型別不紅、兩份 ADR 同號、號段重疊與 owner 的號不在區間內、測試輸出裡有這棵樹沒有測試承接的結果),`verified-ref` / `run-cmd` / `refs` / `templated` 各證明一件事(引用排在後面的 verified 子流與進行中的調整、指令欄帶說明、沒有 adapter 的引用圖、剛 claim 的模板),`preflow` 是需求還寫著 Law、目標有 Law、「邊界」與「對外 I/O」住 `modules.md`、里程碑只有編號的樹,給 `migrate laws` 當輸入,`legacy` 是只有 `system.md` 的樹,給 `migrate cone` 當輸入,`team` 是 `Cone.md` 有號段行的樹(claim 從自己的區間配號並寫 owner,email 不在號段行上就停)。

## 版本與 PR

- dev-flow 與 lawful 的 `plugin.json` **不寫 `version`**:marketplace 是 git 來源,Claude Code 以 commit SHA 判斷更新,每次 merge 到 `main` 使用端跑 `claude plugin update dev-flow@uto-skills` 就拿到最新。寫了 `version` 反而會讓字串沒變的更新被快取擋住。何時恢復版號由使用者指定,不自行推算(全域規則)。
- `plugin.json` 與 `marketplace.json` 的 `description` 也是規章:宣告式,講現在有什麼,不講改了什麼。
- 合併後的 follow-up 從 `main` 開新分支、新 PR,不在已合併的分支上疊 commit。
- PR 內文照 `integrate` skill 的固定章節,繁體中文;標題英文。
