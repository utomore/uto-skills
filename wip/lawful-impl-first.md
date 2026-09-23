# lawful 收束到實作先行流程：CLI 與規章的共同契約

日期：2026-09-20。來源：`wip/impl-first-flow.md` §8–§11（開發者已拍板，lawful「照這一節」）；開發者 2026-09-20 追加：skill 名稱與 dev-flow 一樣、功能收束、需求不准叫 Law、全域 Law 三類全部搬進 `Cone.md`。藍本是 `plugins/dev-flow/` 現行的 rules / skills / lib。

## skill（13 個）

| 以前 | 現在 | 說明 |
|---|---|---|
| design | `project` | 立案：願景、需求與驗收、全域 Law 三區、專案約束、模組單元；不寫 pipeline |
| objective | `objective` | 目標 (What / Which)、里程碑 `M-n-<slug>`、調整；目標沒有 Law |
| module | `module` | 保留：spike-impl 途中切片要一個還沒有的模組單元時先跑它 |
| spike、impl | `spike-impl` | 一條里程碑一條垂直切片，分支 `build/M-n-<slug>`，主 session 自己做，寫決策紀錄 |
| pipeline | `law-design` | 對著切片 claim 出 pipeline，Stages 抄程式碼，laws 逐條拍板（要 / 不准 / 不在乎），`ready`，收尾自動接 build |
| build | `build` | conductor：對帳 → qa → 首跑 → refactor → 仲裁 → 驗收測試 → 收尾；達成改 `verified`；不開里程碑的分支（spike-impl 開的） |
| qa | `qa` | 不變；驗收測試是 `R-n#ACCEPT` / `INV-n#LAW` |
| impl | `refactor` | 依 law 調整或重寫實作；假的換成真的；不動宣告 |
| revise | `revise` | 文檔先行的修訂；先攤影響範圍、強制選項（含「不改」）；全域 Law 的變更由它落筆 |
| integrate / status / audit / study | 同名 | integrate 加仲裁、ADR、走不通的切片；設計分支退場，`plan/<slug>` |

lawful 沒有 abstract（共用的東西是「子流」pipeline，被引用的子流在消費者之前 build）。每份 SKILL.md 標題底下一句**核心**（英文 MUST 句加中文），步驟與它衝突時核心贏。

## `.lawful/` 樹

`Cone.md`、`objectives/`、`modules.md`（只剩「模組單元」表）、`pipelines/`、`gaps.md`、`journal/<鍵>.md`（只活在 build 分支）、`adr/`。`spikes/`、根目錄的 `spike/`、`SPK-00x`、`lawful spike close`、`templates/spike.md` 全部退場。

### Cone.md 的節序

```
## 願景
## 需求
### R-n:<一句話>
- 驗收:<一句可判定的話>
  - forall … / given … / |- …          (三行可有可無)
## 全域 Law
### 領域不變量
- INV-n [種類] <一句話>                   (三行可有可無;識別字只准 types 層的匯出與型別名;一條都沒有寫「無」)
### 架構:四層
- types:… / - effect:… / - core:… / - shell:…     (就是原本 modules.md「邊界」那四行)
### 契約:對外 I/O
| 名稱 | 方向 | 型別 / 效果 ADT | shell 模組 | 進入哪條 pipeline | 契約 |
## 專案約束                                 (不變)
```

- 契約欄：守這一端的 law，`P-00x#LAW-n` 或 `INV-n`，「、」分隔，沒有寫 `-`；指不到就 `lint io` 紅。
- 需求是**必須達成**，不是 law:`- 驗收:`；測試歸屬 `"R-n#ACCEPT"`；status 講「達成 / 未達成 / 未知」。寫了三行就只由測試判（沒測試 = 未知，`lint trace` 紅）；只有一句話的由「底下每個目標都達成」推得。蘊含說明退場。
- 目標沒有 Law：目標達成 = 里程碑全部達成。`O-n#LAW`、`lawful:build O-n`、`objective add --law` 退場。
- 領域不變量：測試歸屬 `"INV-n#LAW"`；`lawful:build INV-n` 只派 qa。
- Law 只有兩種範圍：全域 Law（三類，住 Cone.md 一區）與 scope law（pipeline 的 Laws 節）。law-design 只設計 scope law。
- CLI 靜默容忍的寫法（規章不提）：`- Law:` 當 `- 驗收:` 讀、`R-n#LAW` 當 `R-n#ACCEPT` 讀、`frozen` 當 `verified` 讀、`modules.md` 的「邊界」「對外 I/O」在 Cone.md 沒有對應小區時當同一區讀、里程碑只有 `M-n`。

### 目標檔

frontmatter `id` / `requirement` / `priority` / `updated`；標題；兩張表。里程碑第一格是全名 `M-n-<slug>`（`M-n` 全資料夾唯一、引用用它；slug 是切片分支與決策紀錄的鍵）。

### pipeline

`status`:`draft` / `ready` / `verified`。節不變（Brief、Stages、Laws、Examples、決定、修訂記錄）。要改 `verified` 的先「重開」回 `ready`（「決定」記一條「重開：<為什麼>」）。

### 分支

| 分支 | 誰開 | 鍵 |
|---|---|---|
| `plan/<slug>` | integrate 把主線上立案、目標與全域 Law 的變更帶走時 | kebab-case 英文 |
| `build/M-n-<slug>` | spike-impl | 里程碑全名 |
| `build/<pipeline 全名>` | revise（pipeline 已在主線上） | 被修訂的 pipeline |
| `build/R-n`、`build/INV-n` | build（只寫一條測試的那一波） | 那條驗收或領域不變量 |

`design/<全名>` 退場。

### 決策紀錄

`.lawful/journal/<鍵>.md`，與 dev-flow 同一個模板：frontmatter `key` / `branch` / `base` / `verdict`(`feasible` / `infeasible`)/ `updated`；節 Goal / Scope、Entry、Decisions（Decision / Reason / Constraint / 否決的做法 / 可逆 / 跨文檔）、Assumptions & Invariants、Faked / Unverified、Touched、Verification（含「首跑該紅」）、合併時要看。

### 未實作標記

「骨架」這個概念退場。adapter 的 `stub(marker)` 留著，叫**未實作標記**，只用在 `lawful:revise` 新增的 stage（Haskell:`error "P-00x#name not implemented"`；`undefined` 與 `error "… stub"` 也照認）。status 的 stage 狀態字：`未實作`（原「骨架」）。

## CLI

```
status [--tests <log> | --run] [--pipeline|--module|--json|--html]
module / claim <slug> [--kind] [--milestone <M-n>] / rename / sync / modules --gen / section / brief
requirement add <一句話> [--accept <句>]
invariant add <一句話> [--kind <種類>]
objective add <slug> <一句話> --requirement <R-n> --priority <1-4>
objective milestone <O-n> <slug> <一句話> [--bind <全名,全名>]
objective refinement <O-n> <一句話> --touch <全名,全名>
lint ids | boundary | sig | laws | trace | io | invariants | global | all
migrate laws [--write] / migrate cone [--write] / migrate from-dev-flow
```

- `lint invariants`：編號不重複、種類合法、三行只引用 types 層的匯出與型別名、寫了三行就有 `INV-n#LAW` 測試。`lint global` = boundary + io + invariants。`lint laws` 只查 pipeline 的 scope law 與需求驗收的三行（識別字是任何一條 pipeline 的 Stages 簽名或 types 層匯出，不准引用 `!` 列）。
- `claim` 配號時把 `git worktree list` 每一棵樹的 pipeline 都算進最大號；號段行照舊優先。
- status：第二行數字沒有「Law 成立」，改「需求 n 條，達成 m 條（測試 a、推得 b）」；多一張「全域 Law」表（三類各自的 lint 結果、契約欄指到的 law 幾條成立）；建構中的線從它的工作樹讀走到哪一步（只有決策紀錄 = 切片完成；有 `ready` 的 pipeline 而 law 沒有對應測試 = Law 已定；有測試有紅 = 調整中；全綠 = 達成，可整合）；Cone.md 沒有「全域 Law」區、需求寫著 Law、目標檔寫著 Law → 警訊指到 `lawful migrate laws`；「等決定」不再列 spike。
- `migrate laws [--write]`:`modules.md` 的「邊界」「對外 I/O」搬進 Cone.md「## 全域 Law」區（對外 I/O 表補契約欄 `-`），補「### 領域不變量」寫「無」；需求的 `- Law:` 改 `- 驗收:`、`- 蘊含:` 刪掉；目標檔的 `- Law:` 刪掉；里程碑補英文名（從第一條綁定的 pipeline 的 slug 推，沒綁的用目標的 slug 加序號）；`status: frozen` 改 `verified`；列出 `.lawful/spikes/` 與測試裡的 `O-n#LAW` 當「人要判」的清單。先印帳本，`--write` 才落地。
- `migrate cone` 產出的就是新長相（驗收、全域 Law 區、里程碑英文名）。
- brief 的 skill 表跟著改名；目標種類：pipeline 全名、里程碑全名 `M-n-<slug>`、`R-n` / `INV-n`、`RF-n`、不給。

## 規章檔 (`plugins/lawful/rules/`)

| 檔 | 節（`##`，brief 靠這些名字取節） |
|---|---|
| `README.md` | 名詞、每個 skill 讀什麼 |
| `pipelines.md` | `.lawful/`、Cone.md、願景、需求、目標與路線、pipeline、編號與引用、簽名怎麼寫、frontmatter 與 status、節、什麼要有 law、修訂 (REV)、提問 (GAP)、完成度、ADR |
| `laws.md`（新） | Law 與需求、全域 Law、全域 Law 的變更、Law 怎麼談、影響範圍與選項 |
| `boundary.md` | 四層、模組單元、模組表、效果的判定、對外 I/O、測試與邊界 |
| `roles.md` | 五個階段、分支與所有權、角色、委派、切片、首跑、驗收測試、qa 的交付、收尾、仲裁、測試跑幾次、決策紀錄、整合、委派模型 |
| `tooling.md` | CLI、status 報告、language adapter、跑東西的紀律、收尾定錨 |

## 夾具

全部換成新長相。新增一個 `preflow`（save-game 改動前的長相：`- Law:`、蘊含、目標 Law、modules.md 三節、`M-1`、`frozen`、`spikes/`）當 `migrate laws` 的輸入；`legacy`（system.md 樹）照舊給 `migrate cone`。`broken` 的每一道紅跟著新規則換（契約欄指不到 law、領域不變量只有一句話 / 引用了 core 的簽名 / 種類不合法 / 沒測試、里程碑沒有英文名、需求的驗收還是模板）。
