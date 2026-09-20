# dev-flow 專案的 CI

一條 PR 進來,CI 對帳 `.design/` 與程式碼、跑建置、跑整套測試,任一紅就合不進主線。不需要任何 AI。

```
ci/dev-flow/
├── contract.mjs              # 一道指令做完四件事;CI 跑它,本機也能跑同一道
├── github/
│   ├── contract.yml          # → 你的專案 .github/workflows/contract.yml
│   └── CODEOWNERS            # → 你的專案 .github/CODEOWNERS
└── gitlab/
    ├── .gitlab-ci.yml        # → 你的專案 .gitlab-ci.yml
    └── CODEOWNERS            # → 你的專案 .gitlab/CODEOWNERS
```

## contract.mjs 做什麼

```
node ci/dev-flow/contract.mjs [--root <專案根目錄>] [--lint-only]
```

| 步驟 | 做什麼 | 紅了擋不擋 |
|---|---|---|
| 1 契約對帳 | `devflow lint ids`、`boundary`、`sig`、`laws`、`io`、`invariants`(`boundary`、`io`、`invariants` 三道就是全域 Law 的三類) | 擋 |
| 1 契約對帳 | `lint trace` 的幽靈引用(測試引用的編號文檔裡沒有)與 `status: verified` 文檔沒有測試承接的 law | 擋:幽靈引用什麼時候都是錯;verified 是建置全綠後才改的,它的 law 理應都有測試 |
| 1 契約對帳 | `lint trace` 其餘(`ready` 文檔的 law 還沒翻譯、需求的驗收還沒有驗收測試)與領域不變量寫了三行卻沒有測試 | 只印:測試可以晚一條 PR 才到(剛批准的領域不變量,測試在下一波 build) |
| 1 契約對帳 | `status: draft` 文檔的紅 | 只印:draft 是還在討論的文檔,改成 `ready` 的那條 PR 起才擋;`lint ids` 查的是檔案本身,兩份 draft 同號照擋 |
| 2 建置 | `system.md`「語言與工具」的建置指令 | 擋 |
| 3 整套測試 | 宣告的整套測試指令,輸出留檔;多語言專案每側一道 | 擋 |
| 4 派工報告 | 拿測試輸出跑 `devflow status` | 只印:它答的是「全部達成了沒」,不是「這條 PR 對不對」 |

建置與測試的指令從 `system.md` 讀,CI 設定檔裡不用再寫一次。uto-skills 被 clone 在專案底下時,它自己的檔案會自動加進忽略目錄,不會被當成專案的原始碼。

在本機跑同一道:

```bash
node <uto-skills>/ci/dev-flow/contract.mjs               # 在專案根目錄
node <uto-skills>/ci/dev-flow/contract.mjs --lint-only   # 只對帳,不建置不跑測試
```

## GitHub

1. 複製 `github/contract.yml` 到專案的 `.github/workflows/contract.yml`。
2. `ref` 釘在 uto-skills 的一個 tag(範本寫的是目前的 tag,要升級就換);工具鏈那段留下你的語言、刪掉其他。
3. 複製 `github/CODEOWNERS` 到 `.github/CODEOWNERS`,把 `@architect` 換成架構負責人的帳號。
4. Settings → Branches → 主線的 branch protection 勾三項:
   - **Require status checks to pass**,選 `contract`
   - **Require branches to be up to date before merging**:兩條 PR 都綠、合在一起會紅時,第二條被要求先更新再重跑
   - **Require review from Code Owners**:動到 `system.md`、`objectives/`、`modules.md` 的 PR 要架構負責人 approve

一天十幾條 PR、大家一直在等 update branch 的時候,再開 merge queue,流程不用改。

## GitLab

1. 複製 `gitlab/.gitlab-ci.yml` 到專案根目錄;已經有 `.gitlab-ci.yml` 就把 `contract` job 貼進去,或用 `include` 引入。
2. `UTO_SKILLS_REF` 釘在 uto-skills 的一個 tag(範本寫的是目前的 tag,要升級就換;分支與 commit SHA 也能填);`image` 照你的語言換,image 沒有 node 就打開裝 node 那行。
3. 複製 `gitlab/CODEOWNERS` 到 `.gitlab/CODEOWNERS`,換帳號。
4. Settings → Merge requests 勾 **Pipelines must succeed**;Settings → Repository → Protected branches 對主線勾 **Require approval from code owners**。

GitLab 的 merge trains 對應 GitHub 的 merge queue,同樣等到需要再開。

## 常見問題

**PR 只有一份新的 draft 文檔,CI 會紅嗎?** 不會。draft 文檔的紅只印不擋。改成 `ready` 的那條 PR 起,它的每一列都要對得上程式碼。

**只改立案的 PR(`plan/<slug>`:需求、領域不變量、目標、里程碑)會紅嗎?** 不會。它只動 `.design/`;里程碑還沒有切片、領域不變量還只有一句話,都是警訊不是紅。

**一條里程碑的 PR 什麼時候才進得來?** 它在自己的 `build/M-n-<slug>` 分支上從切片做到每條 law 成立,`dev-flow:integrate` 才收它、整套綠了才發 PR;CI 看到的已經是達成的狀態,每一列都要對得上程式碼。

**多語言專案?** `system.md` 的 `language` 欄寫 `[web = typescript, api = python]`、三道指令每側一組,腳本每側各跑一道、報告合併。CI 的工具鏈兩種都要裝。

**要不要接 AI 審查?** 這裡的檢查都是確定性的,先跑一陣子看紅的分佈。真的要加,接的是讀 `.design/` 的 `dev-flow:audit`,不是通用的 code review bot。
