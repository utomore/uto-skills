# __PROJECT__

這是什麼、結構、依賴方向與檢查見 @README.md；名詞見 @docs/glossary.md；決策見 docs/adr/（ADR-001 目標與技術基礎、ADR-002 專案管理、ADR-003 軟體架構、ADR-004 本地檢查、ADR-005 CI 與 CD）；還沒定的點子見 docs/backlog.md。
工作項目、里程碑、進度與狀態在 ADR-002 定的專案管理工具裡，不在這個 repo 的文件裡。
架構或設計上的新決策寫成一份新的 ADR（格式見 docs/adr/README.md）。

## 協作規則

- 對外用使用者語言，對內用領域的語言。領域裡的命名只用 `docs/glossary.md` 登記過的識別名；要用新名詞，先登記再命名。
- 還沒有人實作的領域不預先建立、不預先命名。
- 領域的資料夾是業務領域（名詞）；裡面的函數以動詞_名詞命名。
- 四層：api、cli → application → domains ← platform（ADR-003）。platform 只提供工具，沒有入口、不放業務規則。api 與 cli 是兩個對等的入口，每個入口都呼叫 `application/` 的一個 use case，use case 是唯一的接線處；use case 在它服務的領域 `feature.md` 的入口表宣告，每個 use case 都要有 cli 指令（cli 不經 api，直接呼叫 use case）。
- 領域丟出 `DomainError` 的子類別（dataclass，帶欄位），不寫給人看的訊息；訊息寫在兩個入口各自的 `TRANSLATIONS`：`src/__PACKAGE__/api/errors.py`（帶 HTTP 狀態）與 `src/__PACKAGE__/cli/errors.py`，各自翻給自己的使用者，兩張都不能漏（`check_errors`）。
- 某個領域才需要的依賴寫在該領域的 `ports.py`；`domains/_shared` 只放所有領域都用的東西。
- law 寫在領域 `laws.md` 的 `## Laws`，一行一條，以 `- LAW-<n>` 開頭；測試用 `@pytest.mark.law("LAW-<n>")` 標記。還沒實作的放 `## 候選`，實作時連同測試搬過去。
- 測試不是越多越好，也不設數量上限：功能的輪廓由 law 定（領域的 `laws.md`），測試是證明輪廓成立的證據。
  - 每條測試都要有歸屬：`<領域>/LAW-n`、`<領域>/EX-n`，或修 bug 的回歸測試（名字帶工作項目的編號）。歸屬不了的，抽成 law、改成例子，或刪掉。
  - 一條 law 原則上一條性質測試，產生器涵蓋 law 寫的定義域；拆成多條要說得出理由。
  - 例子少而有目的：每個例子說得出它示範輪廓的哪一處（典型、邊界、曾經壞過的地方），重複示範同一處的不留。
  - 新的或改寫的測試要有紅轉綠的證據：把實作改壞，它會紅才算數。
  - 回報與 PR 看品質不看條數：寫新增、改寫、作廢了哪些 law，紅轉綠的證據，有沒有沒歸屬的測試；不把總條數當進度。
- 改完跑 `make check` 與 `make test`（ADR-004）。
