# mkSkills 專案規則

本 repo 是 Claude Code plugin 的原始碼(`plugins/<plugin>/skills/…`)。SKILL.md、`_shared/`、`templates/` 是**規章**,被別的專案在執行時載入;它們的每一句話都會變成某個 session 的行為。

## 文檔一律宣告式

- **只寫當下事實。** 規章描述「現在的規則是什麼」,不描述「規則怎麼變成這樣」。禁止出現版本號(`2.2.1 之前`)、時間敘述(`以前`、`後來才補`)、舊制對照(`舊格式`、`v1 / v2`、`舊制照舊可讀`)、事故回憶(`本流程被修過`、`這條規則是照 X 補上的`)。
- **一個概念退場,就從所有規章裡消失。** 不留「已移除」「不再使用」的註記,不留只為相容舊寫法而存在的說明。腳本可以靜默容忍舊寫法,規章不提。
- **舊 → 新只准出現在兩個地方**:遷移工具本身(`migrate-*.mjs` 的檔頭與訊息)與 `arch-audit` SKILL.md 的遷移段。那是唯一以「不合規的樹怎麼變合規」為題的地方。
- **腳本的使用者可見訊息也是規章**(`--help`、提示、不一致訊息):同一條規則。程式碼註解不受此限。
- **不合規的輸入用條件句描述**,不稱它為舊版:寫「只有 `docs/arch/` 體系的專案 → …」,不寫「舊版 `docs/arch/`」。
- `wip/` 底下的設計稿是**紀錄**不是規章,可以有推理過程、決定紀錄與歷史;它不會被任何 session 載入。

改完規章跑一次這道,命中的每一條都要是專案自己的概念(例如 greenfield 禁問「舊格式」),不是規章自己的歷史:

```
grep -rn -E '2\.[0-9]\.[0-9]|以前|舊制|舊格式|舊文檔|舊專案|舊版|之前的流程|後來才|補上的|修過|修出來|曾同時|\bv1\b|\bv2\b|不再有|不再需要' --include=*.md plugins/dev-flow/skills | grep -v tests/
```

## 改了 `scripts/` 之後

```
bash plugins/dev-flow/skills/arch-audit/tests/run.sh          # golden 回歸 + 文檔四道檢查 + 煙霧測試 + --help
```

行為是刻意改的才 `--update` 重產 golden,並在 PR 說明為什麼變。另外四道文檔檢查可以單獨跑:`lint-commands.mjs`(文檔裡的指令與旗標腳本認不認得)、`doc-section.mjs --verify`(載入行點名的節還在不在)、`lint-ids.mjs plugins`(裸寫的單字母+數字;掃整個 repo 會撞到 `wip/` 的草稿)、`lint-laws.mjs`(範例 law 四格)。

## 版本與 PR

- dev-flow 的 `plugin.json` **不寫 `version`**:marketplace 是 git 來源,Claude Code 以 commit SHA 判斷更新,每次 merge 到 `main` 使用端跑 `claude plugin update dev-flow@uto-skills` 就拿到最新。寫了 `version` 反而會讓字串沒變的更新被快取擋住。何時恢復版號由使用者指定,不自行推算(全域規則)。
- `plugin.json` 與 `marketplace.json` 的 `description` 也是規章:宣告式,講現在有什麼,不講改了什麼。
- 合併後的 follow-up 從 `main` 開新分支、新 PR,不在已合併的分支上疊 commit。
- PR 內文照 `branch-pr` skill 的固定章節,繁體中文;標題英文。
