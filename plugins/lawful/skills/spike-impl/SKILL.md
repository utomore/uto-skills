---
name: spike-impl
description: lawful 的切片 — 拿一條里程碑(M-n-<slug>)與它的需求(含驗收)、全域 Law,開 build/M-n-<slug> 分支與工作樹,用實作從 shell 的進入點貫通到出口,做出一條跑得通的垂直切片;它同時是可行性驗證,走不通也是答案。從第一行程式碼就守全域 Law(領域不變量、四層的依賴方向與效果邊界、對外 I/O 只在 shell),要一個還沒有的模組單元就先跑 lawful:module;離場前 lint global 沒有紅、整套測試沒有因它變紅,並留下一份結構化的決策紀錄——為了達成這條里程碑的 Goal / Scope 而產生的實作決策(Goal / Scope、Entry、Decisions 每列 Decision / Reason / Constraint、Assumptions & Invariants、Faked / Unverified、Touched)——給 law-design。不寫 pipeline 文檔、不寫 law、不新增全域 Law。觸發詞:切片、垂直切片、spike、spike-impl、先做出來、貫通、做這條里程碑、可行性驗證、試一下、PoC、prototype、原型、跑跑看、實作、lawful spike-impl。Use when a milestone should first be made to work end to end in code, before any pipeline document or law is written.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs":*)
---

# lawful:spike-impl — 先貫通一條切片

> **核心**:The slice MUST make the milestone's Goal observably true end to end, MUST NOT violate a global Law, and MUST record every decision and every fake.(讓里程碑那一句話從進入點到出口看得到地成真;不違反全域 Law;每個決定與每一處假都留在決策紀錄。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike-impl --args '$ARGUMENTS' --part 1 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike-impl --args '$ARGUMENTS' --part 2 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike-impl --args '$ARGUMENTS' --part 3 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike-impl --args '$ARGUMENTS' --part 4 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike-impl --args '$ARGUMENTS' --part 5 --of 6`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike-impl --args '$ARGUMENTS' --part 6 --of 6`

上面這幾段(一份輸出切成幾段,每段一道指令;沒有內容的那幾道是空的)是載入 skill 時跑 `lawful brief spike-impl` 的輸出:規章、分支與工作樹(含有沒有 remote、建構中與殘留的 build 分支)、`.lawful/` 的樹、那條里程碑的目標檔與它的需求和驗收、`Cone.md` 全文(全域 Law 三區與專案約束都在裡面)、`modules.md` 全文、`lawful status` 裡講到這條里程碑的每一行。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:里程碑全名 `M-n-<slug>`。上面寫「目標未指定」就先定出目標,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/lawful.mjs" brief spike-impl <目標> --no-rules`;同一場裡目標文檔或專案現況變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<L>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一條里程碑的全名 `M-n-<slug>`;它的目標與需求(含驗收);全域 Law(`Cone.md`「全域 Law」區:領域不變量、四層、對外 I/O)與 `modules.md` 的模組單元 | `build/M-n-<slug>` 分支與工作樹上一條跑得通的切片,與 `.lawful/journal/M-n-<slug>.md` |

## 前置

- `lawful status`:這條里程碑在「今天能開幾條線」裡(它是該目標下一條還沒達成的里程碑、還沒有切片、有英文名、不是建構中)。沒有英文名 → `lawful:objective` 補;需求的驗收還是模板 → `lawful:project`。
- 在主線、與 origin 同步(`git fetch` 後 `git status -sb` 沒有 ahead / behind)、工作樹乾淨;里程碑、目標與需求因此都已在主線上。立案的變更還沒合進主線就先 `lawful:integrate`。
- 跟開發者確認一句:這一片要讓里程碑那一句話在哪個入口看得到(哪道指令、哪個請求、哪個檔案),以及 timebox。

## 步驟

0. **開分支**:`git worktree add -b build/M-n-<slug> ../<repo>.worktrees/M-n-<slug> HEAD`,記下 HEAD 的 sha(決策紀錄的 `base`)。之後每道指令的工作目錄都是這棵工作樹。
1. **先定落點,再寫第一行**:這一片從對外 I/O 的哪個入口進來、哪個出口出去;會新增哪些模組、各屬於哪個模組單元、住哪一層的樹(`boundary.md`「四層」「模組單元」)。要的單元 `modules.md` 上沒有,或有而沒宣告那一層 → 先 `lawful:module` 劃出來,再回來。新模組登記進建置設定。
2. **貫通**:由外而內打通一條最短的路,再由內而外補實。簽名、stage 怎麼拆、資料結構,邊做邊定,不先寫文檔。碰外界的步驟在 effect 層寫成描述(指令 ADT)並配一個純解譯器,真解譯器住 shell;types / effect / core 的模組寫匯出清單。需要假的就假(假資料、寫死的值、沒接上的真解譯器),**每假一處就在決策紀錄「Faked / Unverified」記一列**。
3. **記決定,不記過程**:決策紀錄是為了達成這條里程碑的 Goal / Scope 而產生的實作決策,不是流水帳。二選一的地方記進「Decisions」一列:Decision(決定了什麼)、Reason(為什麼)、Constraint(受什麼約束:全域 Law 的哪一條——領域不變量、四層的規則、對外 I/O 的契約——、需求的驗收或外部系統;全域 Law 擋掉了一個做法,就寫在這裡)、否決的做法、可不可逆、跨不跨文檔。程式碼裡當成成立的前提記進「Assumptions & Invariants」,刻意守的寫「刻意」,只是寫起來剛好這樣的寫「順手」。試了幾次、先寫哪個檔不記。
4. **碰到別人的東西**:要改別條已經在主線上的 pipeline 的簽名或型別 → 停那一項,它是那條 pipeline 的修訂(`lawful:revise`,在同一棵工作樹上),記進「Goal / Scope」的「明確沒做」或先去修訂再回來。
5. **離場四項**(`rules/roles.md`「切片」),逐項驗:
   - 「Entry」那道指令跑得起來,看得到里程碑那一句話的行為;
   - 建置指令過,`lawful lint global` 沒有紅(架構、契約、領域不變量三道);
   - 整套測試跑一次,輸出留檔,`lawful status --tests <log>`:既有的 law、需求的驗收與領域不變量沒有因為這一片變紅;
   - 照 `templates/journal.md` 把切片六節填完(「Verification」與「合併時要看」留給 build),`verdict: feasible`。
6. **commit** 在分支上,訊息帶 `M-n-<slug>`;程式碼與決策紀錄各自成 commit。
7. **走不通**:timebox 到了、或確定這個做法達不到那一句話 → `verdict: infeasible`,「Goal / Scope」寫試了什麼、卡在哪、下次之前要先知道什麼;commit 決策紀錄,交給 `lawful:integrate` 升成 ADR。不硬做、不把里程碑那一句話改小來配合。

## 收尾

回報:貫通了什麼(入口 → 出口)、怎麼跑(Entry)、假了幾處、幾條假設是順手的、哪條全域 Law 擋到了什麼、劃了哪些新的模組單元、離場四項各自的結果;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律是 `lawful:law-design M-n-<slug>`(對著這一片談 Law);走不通的是 `lawful:integrate`,再回 `lawful:objective` 重切這條里程碑。

## 邊界

不寫 pipeline 文檔、不寫 law、不寫帶歸屬的測試(自己的煙霧測試不標歸屬);不新增、不修改、不放寬全域 Law,也不為了跑得通而違反它(覺得某一條擋得沒道理,寫進 Decisions 的 Constraint 欄,那是整合時變更建議的材料);不改願景、需求、目標與四層那四句;不合併、不發 PR。這一版是草稿:它的用處是讓 Law 談得下去,之後被 refactor 整份重寫是正常結果。
