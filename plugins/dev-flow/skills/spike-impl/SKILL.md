---
name: spike-impl
description: dev-flow(有 .design/ 的專案)的切片:拿一條里程碑,在 build/M-n-<slug> 工作樹上用實作從入口貫通到出口,做出跑得通的垂直切片並留下決策紀錄;同時是可行性驗證,走不通也是答案。觸發詞:切片、spike、先做出來、貫通、做這條里程碑、可行性、試一下、PoC、prototype、原型。Use when a milestone should first be made to work end to end in code, before any feature document or law is written.
user-invocable: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs":*)
---

# dev-flow:spike-impl — 先貫通一條切片

> **核心**:The slice MUST make the milestone's Goal observably true end to end, MUST NOT violate a global Law, and MUST record every decision and every fake.(讓里程碑那一句話從入口到出口看得到地成真;不違反全域 Law;每個決定與每一處假都留在決策紀錄。) 步驟與這一句衝突時,這一句贏:停下,回報。

## 開工 context

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief spike-impl --args '$ARGUMENTS' --part 1 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief spike-impl --args '$ARGUMENTS' --part 2 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief spike-impl --args '$ARGUMENTS' --part 3 --of 4`

!`node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief spike-impl --args '$ARGUMENTS' --part 4 --of 4`

上面這幾段(一份輸出切成幾段,每段一道指令)是載入 skill 時跑 `devflow brief spike-impl` 的輸出:規章、分支與工作樹(有沒有 remote 也在裡面)、`.design/` 的樹、這條里程碑所在的需求檔全文(一句話、驗收、里程碑表)、`system.md` 全份、`modules.md`、status 報告(能開的線在裡面)。開工要讀的規章與專案現況都在這裡,不再另外讀。

目標:里程碑全名 `M-n-<slug>`。上面寫「目標未指定」就先定出目標,再跑一次 `node "${CLAUDE_PLUGIN_ROOT}/bin/devflow.mjs" brief spike-impl <目標> --no-rules`;同一場裡目標文檔變過也這樣重跑。看到的若是那道指令的原文而不是它的輸出,自己跑一次(不加 `--no-rules`)。下面步驟裡的 `<D>` 就是 `${CLAUDE_PLUGIN_ROOT}`。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 一條里程碑的全名 `M-n-<slug>`;它的需求(一句話與驗收);全域 Law(`system.md`「全域 Law」區:領域不變量、層的兩條規則、對外 I/O 的信任邊界)——區裡有什麼就守什麼,專案的第一片就是用來長出它的 | `build/M-n-<slug>` 分支與工作樹上一條跑得通的切片,與 `.design/journal/M-n-<slug>.md` |

## 前置

- `devflow status`:這條里程碑在「今天能開幾條線」裡(它是該需求下一條還沒達成的里程碑、還沒有切片、有英文名、不是建構中;同一條需求的後面幾條里程碑要等它達成)。沒有英文名、需求的驗收還是模板 → `dev-flow:require-design`。
- **專案的第一條切片單獨走完**(`roles.md`「分支與所有權」):`system.md`「全域 Law」三個小區都還是空的(領域不變量「無」、層表與對外 I/O 表沒有列),而別條切片已經在建構中(`devflow status`「今天能開幾條線」印的是「專案的第一條切片單獨走完:build/<鍵> …」那一句,這條里程碑不在能開的線裡)→ 停,等那一條抽出全域 Law 並合進主線,再開這一條。三個小區都是空的、也沒有別條切片在建構中 → 這一條就是第一片,照常開工。
- 在主線、與 origin 同步(`git fetch` 後 `git status -sb` 沒有 ahead / behind)、工作樹乾淨;里程碑與它的需求檔因此都已在主線上。立案、需求或全域 Law 的變更還沒合進主線就先 `dev-flow:integrate`。
- 跟開發者確認一句:這一片要讓里程碑那一句話在哪個入口看得到(哪道指令、哪個請求)——里程碑是使用者看得到、展示得出來的階段,這道指令之後就是決策紀錄的「Entry」——以及 timebox。

## 步驟

0. **開分支**:`git worktree add -b build/M-n-<slug> ../<repo>.worktrees/M-n-<slug> HEAD`,記下 HEAD 的 sha(決策紀錄的 `base`)。之後每道指令的工作目錄都是這棵工作樹。
1. **先定落點,再寫第一行**:這一片從對外 I/O 的哪個入口進來、哪個出口出去;會新增哪些檔案、各住哪一層。新檔案當場登記進 `.design/modules.md`。`untrusted` 的入口,第一個碰到資料的就是驗證。**全域 Law 區有什麼就守什麼**,從第一行程式碼起;專案的第一片就是用來長出它的:層表還沒有列 → 新檔案照樣登記、層欄留白,檔案怎麼分目錄照你判斷最站得住的分法做,並在決策紀錄「Decisions」記一列為什麼這樣分(`dev-flow:scope-laws` 拿它與開發者把層講定);對外 I/O 表還沒有列 → 跨過邊界的每一端記進「Touched」,內容由系統外面決定的入口照樣先驗證再用。
2. **貫通**:由外而內打通一條最短的路,再由內而外補實。簽名、步驟怎麼拆、資料結構,邊做邊定,不先寫文檔。取型別名、函式名時照專案根目錄 `CLAUDE.md`「## 名詞」節上的名詞(表上叫「訂單」的東西,型別就叫 `Order`,不另外發明一個叫法);這一節只讀不寫。需要假的就假(假資料、寫死的值、沒接上的外部系統),**每假一處就在決策紀錄「Faked / Unverified」記一列**。
3. **記決定,不記過程**:決策紀錄是為了達成這條里程碑的 Goal / Scope 而產生的實作決策,不是流水帳。二選一的地方記進「Decisions」一列:Decision(決定了什麼)、Reason(為什麼)、Constraint(受什麼約束:全域 Law 的哪一條——領域不變量、層的規則、對外 I/O 的契約——、需求的驗收或外部系統;全域 Law 擋掉了一個做法,就寫在這裡)、否決的做法、可不可逆、跨不跨文檔。程式碼裡當成成立的前提記進「Assumptions & Invariants」,刻意守的寫「刻意」,只是寫起來剛好這樣的寫「順手」。試了幾次、先寫哪個檔不記。
4. **碰到別人的東西**:要改別份已經在主線上的文檔的簽名或型別 → 停那一項,它是那份文檔的修訂(它既有的 law 不動走 `dev-flow:scope-revise <那份文檔的全名>`,要調整它既有的 law 走 `dev-flow:scope-laws <那份文檔的全名>`;在同一棵工作樹上),記進「Goal / Scope」的「明確沒做」或先去修訂再回來。用得到別份文檔已經有的 step → 直接呼叫既有的程式碼,不另寫一份;在「Touched」記下用了哪一份的哪個 step,`dev-flow:scope-laws` 會把它寫成引用(`features.md`「編號與引用」)。這條里程碑讓使用者看得到的階段是靠修訂既有的 feature 做到的 → 這裡只貫通新的那一段(新的出入口、最外層的客戶端),既有 step 的改動走上面那兩個修訂的 skill,來源寫這條 `M-n-<slug>`(`features.md`「願景、需求與里程碑」)。
5. **離場四項**(`rules/roles.md`「切片」),逐項驗:
   - 「Entry」那道指令跑得起來,看得到里程碑那一句話的行為;
   - 建置指令過,`devflow lint global` 沒有紅(架構、契約、領域不變量三道);
   - 整套測試跑一次,輸出留檔,`devflow status --tests <log>`:既有的 law、需求的驗收與領域不變量沒有因為這一片變紅;
   - 照 `templates/journal.md` 把切片六節填完(「Verification」與「合併時要看」留給 build),`verdict: feasible`。
6. **commit** 在分支上,訊息帶 `M-n-<slug>`;程式碼與決策紀錄各自成 commit。
7. **走不通**:timebox 到了、或確定這個做法達不到那一句話 → `verdict: infeasible`,「Goal / Scope」寫試了什麼、卡在哪、下次之前要先知道什麼;commit 決策紀錄,交給 `dev-flow:integrate` 升成 ADR。不硬做、不把里程碑那一句話改小來配合。

## 收尾

回報:貫通了什麼(入口 → 出口)、怎麼跑(Entry)、假了幾處、幾條假設是順手的、哪條全域 Law 擋到了什麼、離場四項各自的結果;附定錨區塊(`tooling.md`「收尾定錨」)。下一步一律是 `dev-flow:scope-laws M-n-<slug>`(對著這一片談 Law);走不通的是 `dev-flow:integrate`,再回 `dev-flow:require-design` 重切這條里程碑。

## 邊界

不寫 feature 文檔、不寫 law、不寫帶歸屬的測試(自己的煙霧測試不標歸屬);不新增、不修改、不放寬全域 Law,也不為了跑得通而違反它(覺得某一條擋得沒道理,寫進 Decisions 的 Constraint 欄,那是整合時變更建議的材料);不改需求檔(自己那條里程碑的綁定欄由 `dev-flow:scope-laws` 填)與層表;不合併、不發 PR。這一版是草稿:它的用處是讓 Law 談得下去,之後被 refactor 整份重寫是正常結果。
