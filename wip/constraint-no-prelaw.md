# Law 只從實作抽出來;`## Constraint` 節

2026-09-20 使用者拍板,dev-flow 與 lawful 一起做,分支 `feat/constraint-no-prelaw`。這份是紀錄,不是規章。

## 起因
使用者問「Laws 一行跟三行差別」,追到「領域不變量可以先只有一句話」這個狀態。查 git:

- `0b1ae7f`(09-20 00:34):全域 Law 在立案時定,立案時沒有程式碼,所以「先只留一句話,型別出現再寫成三行」。
- `0a6ac12`(09-20 20:20,PR #83):使用者拍板全域 Law 一律從切片抽上去。「只有一句話」的狀態失去了來源,卻沒有跟著消失,而是被掛到一個新造的入口「不強迫、但允許先立」底下。設計稿 `wip/global-laws-extracted.md` 把它列在「保留的」,沒有標成使用者的決定。

## 使用者的決定(原話)
- 「驗收沒問題,只要是使用者驗收,就可以由使用者來說明讓 requirement 完成。」→ 驗收那一套不動。
- 「不允許先立 Laws,Laws 必須要從實作抽出來,由使用者與 LLM 共同設計。用來約束實作用的,確保重要功能保持一致。先立 Laws 根本不合理,沒有實際遇到情況,怎麼可能訂的出好的法規。」
- 「system.md, Cone.md 新增 ## Constraint 限制章節裡面寫著明確的限制,如使用的語言,版本。編譯器版本,套件需求等等。或環境。比較偏向是硬性規範,變數命名寫法,函數命名寫法等等,軟體開發的一些寫法。在 kickoff 中可以事先定義,或者事後補充。」
- 「constraint 在乎的應該只會有 spike-impl 與 qa,這是我認為,你可以參考看看。」
- 「專案約束就是 Constraint,意思相同。統一改成 Constraint。」「語言與工具就是 Constraint,也請統一。」

## 做了什麼
- **先立退場**:兩個 plugin 的 `laws.md`、`roles.md`、`tooling.md`、`features.md` / `pipelines.md`、`README.md`,`global-laws`(「先立一句」整節換成「沒有出處的不立」)、`scope-laws`(第 8 步只剩驗收那一半)、`kickoff`、`build`、`status`、`integrate`、`require-design`,`ci/*/README.md`。全域 Law 的來源剩:`scope-laws` 列的候選、開發者點名的一條既有 scope law、`integrate` 的建議經批准。
- **CLI**:領域不變量沒有三行,`lint invariants` 從訊息改成紅;`status` 的判定來源與警訊改字(「沒有三行」「沒有測試」);`invariant add` 印的下一步改成「把出處的三行照搬過來」;看板圖例那一句跟著改。
- **`## Constraint` 一節**:dev-flow 的「語言與工具」與 lawful 的「專案約束」都併進它。一節裝兩種東西:硬性限制(語言與版本、編譯器與執行環境、套件與框架、環境、命名與寫法;類別可以自己加)與工具要讀的那幾行(三道指令、追加清單、忽略目錄、號段、優先;lawful 另有語言、模組前綴、原始碼根目錄)。`kickoff` 問、寫,之後補或改也回 `kickoff`。它不是 law:沒有三行、沒有測試、不從切片抽;CLI 對限制那幾行不做任何檢查。lawful 原本的「套件與框架」那一行就是限制的一類,留在同一節。
- **CLI 的讀法**:讀「## Constraint」;節名是「語言與工具」/「專案約束」的樹靜默照讀(`design.mjs`、`brief.mjs`、各道 migrate 找節的地方)。使用者可見訊息一律講「Constraint」;migrate 補優先那一行時印那棵樹實際的節名。各道 migrate 不改節名——節名不合規的樹由 `kickoff` 的前置改。dev-flow 的 `flat`、lawful 的 `preflow` 兩個夾具留著原本的節名,守靜默照讀那條路。
- **誰照做**:`spike-impl`(讀得到整份 `system.md` / `Cone.md`)、`qa`、`refactor`(`brief` 把「Constraint」那一塊也給它們:dev-flow 的 `tools` 塊、lawful 的 `constraints` 塊)。使用者的看法是只有 spike-impl 與 qa;加 refactor 的理由:它會調整甚至整份重寫實作、把假的換成真的,會加套件、取新名字。要拿掉就是 `brief.mjs` 的 `BLOCKS` 一格加上 `refactor` SKILL.md 的兩句。
- **決策紀錄的 `Constraint` 欄**:原本就有(這個決定受什麼約束),現在也可以指到「Constraint」節的哪一項。

## 留給使用者判的
- `refactor` 要不要照做 Constraint(見上)。
- `lint invariants` 對編號重複的那一條,行號指到同號的第一條(既有行為,新的「沒有三行」那一條紅沿用同一個行號)。
