# __PROJECT__

結構、依賴方向與檢查見 @README.md；名詞見 @docs/glossary.md；開發計畫見 docs/plan/README.md（做一個單元只讀它與那個里程碑的檔案）；決策見 docs/adr/。
架構或設計上的新決策寫成一份新的 ADR（格式見 docs/adr/README.md）。

## 協作規則

- 對外用使用者語言，對內用領域的語言。領域裡的命名只用 `docs/glossary.md` 登記過的識別名；要用新名詞，先登記再命名。
- 還沒有人實作的領域不預先建立、不預先命名。
- 領域的資料夾是業務領域（名詞）；裡面的函數以動詞_名詞命名。
- 四層：api、cli → application → domains ← platform（ADR-002）。platform 只提供工具，沒有入口、不放業務規則。api 與 cli 是兩個對等的入口，每個入口都呼叫 `application/` 的一個 use case，use case 是唯一的接線處；use case 在它服務的領域 `feature.md` 的入口表宣告，每個 use case 都要有 cli 指令（cli 不經 api，直接呼叫 use case）。
- 領域丟出 `DomainError` 的子類別（dataclass，帶欄位），不寫給人看的訊息；訊息寫在兩個入口各自的 `TRANSLATIONS`：`src/__PACKAGE__/api/errors.py`（帶 HTTP 狀態）與 `src/__PACKAGE__/cli/errors.py`，各自翻給自己的使用者，兩張都不能漏（`check_errors`）。
- 某個領域才需要的依賴寫在該領域的 `ports.py`；`domains/_shared` 只放所有領域都用的東西。
- law 寫在領域 `laws.md` 的 `## Laws`，一行一條，以 `- LAW-<n>` 開頭；測試用 `@pytest.mark.law("LAW-<n>")` 標記。還沒實作的放 `## 候選`，實作時連同測試搬過去。law 守的是哪條需求就在行裡寫 `REQ-<三位數>`，那條需求的 domains 欄要列這個領域。
- 單元的每條驗收做完，在那一行行尾寫「（證據：…）」（ADR-006）；人看過的在里程碑檔的「## 展示紀錄」記一列。`make progress` 看每個里程碑幾個單元完成。
- 改完跑 `make check` 與 `make test`。
