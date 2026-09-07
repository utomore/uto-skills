# mkSkills 專案規則

本 repo 是 Claude Code plugin 的原始碼(`plugins/<plugin>/skills/…`)。SKILL.md、`rules/`、`_shared/`、`templates/` 是**規章**,被別的專案在執行時載入;它們的每一句話都會變成某個 session 的行為。

## 文檔一律宣告式

- **只寫當下事實。** 規章描述「現在的規則是什麼」,不描述「規則怎麼變成這樣」。禁止出現版本號(`2.2.1 之前`)、時間敘述(`以前`、`後來才補`)、舊制對照(`舊格式`、`v1 / v2`、`舊制照舊可讀`)、事故回憶(`本流程被修過`、`這條規則是照 X 補上的`)。
- **一個概念退場,就從所有規章裡消失。** 不留「已移除」「不再使用」的註記,不留只為相容舊寫法而存在的說明。腳本可以靜默容忍舊寫法,規章不提。
- **舊 → 新只准出現在兩個地方**:遷移工具本身(`lib/commands/migrate.mjs` 的檔頭與輸出)與各 plugin `project` / `design` skill 裡叫人去跑它的那一句。那是唯一以「不合規的樹怎麼變合規」為題的地方。
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
bash tests/dev-flow/run.sh                # dev-flow:七個夾具的 golden 回歸 + --help;fixtures/shop 同時是 .design 的完整範例
bash tests/lawful/run.sh                  # lawful:三個夾具的 golden 回歸 + --help;fixtures/save-game 同時是 .lawful 的完整範例
```

行為是刻意改的才 `--update` 重產 golden,並在 PR 說明為什麼變。夾具本身也是規章的一部分:`shop` 示範一棵全綠的樹(兩份 feature 共用一份 abstract),`blank` 是剛從模板複製出來一個字都沒填的樹(佔位符列不准被當成真的),`shaky` 讓每一道紅與每一條警訊各出現一次,`py-svc` / `go-svc` / `rs-svc` 各證明一個 adapter,`legacy` 是舊 `subsystems/` 樹的遷移帳本輸入。

## 版本與 PR

- dev-flow 與 lawful 的 `plugin.json` **不寫 `version`**:marketplace 是 git 來源,Claude Code 以 commit SHA 判斷更新,每次 merge 到 `main` 使用端跑 `claude plugin update dev-flow@uto-skills` 就拿到最新。寫了 `version` 反而會讓字串沒變的更新被快取擋住。何時恢復版號由使用者指定,不自行推算(全域規則)。
- `plugin.json` 與 `marketplace.json` 的 `description` 也是規章:宣告式,講現在有什麼,不講改了什麼。
- 合併後的 follow-up 從 `main` 開新分支、新 PR,不在已合併的分支上疊 commit。
- PR 內文照 `branch-pr` skill 的固定章節,繁體中文;標題英文。
