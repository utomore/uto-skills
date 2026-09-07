# 邊界

依賴方向的唯一宣告是 `system.md` 的層表加 `modules.md` 的模組表;`devflow lint boundary` 拿 import 圖對它。

## 層

層是**檔案**的屬性,意義是依賴方向。層由專案自己命名、自己決定幾層,寫在 `system.md`「層」表,**由內而外**排:

```markdown
| 層 | 裝什麼 |
|---|---|
| domain | 純值型別、規則、不變量 |
| application | 用例的組裝:把 domain 的東西串成一條 |
| adapter | 外部系統的實作:資料庫、HTTP 客戶端、檔案系統 |
| entry | 程序進入點:路由、CLI、排程、UI 事件 |
```

規則兩條,不再多:

1. **內層不准 import 外層。** 同層與更內層都可以。
2. **最外層(表的最後一列)是唯一能做對外 I/O 的層。** 其他層 import 到 IO 模組即紅。

一層也可以(小工具就別分層);兩層以上就要排出順序,順序本身就是規章。層名沒有保留字,`domain / application / adapter / entry` 只是一組常見的名字。

## 模組表

`.design/modules.md`,一張表,是邊界不是進度表:

```markdown
| 路徑 | 層 |
|---|---|
| `src/domain/**` | domain |
| `src/app/**` | application |
| `src/infra/**`、`src/db/**` | adapter |
| `src/entry/**`、`src/main.ts` | entry |
```

- 路徑是**相對專案根目錄的檔案路徑**,`目錄/**` 通配底下所有檔案,最長的樣式贏(`src/domain/**` 比 `src/**` 精確)。
- 路徑欄由 `devflow modules --gen` 從程式碼生成(一個檔一列),人只填層欄,再自己把同層的合併成 `目錄/**` 一列。
- 程式碼有、表上沒有的檔案 → 未登記;表上有、程式碼沒有的 → 幽靈。兩者都是 `lint boundary` 的紅。
- 檔案沒有完成狀態。檔案的進度 = 它裝的所有 step 的狀態:`devflow status --module <路徑>` 列出哪些文檔的哪些 step 住在那裡、簽名在不在、laws 綠了幾條。

## IO 模組

「什麼算對外 I/O」由 adapter 的 `ioModules` 預設清單判(檔案系統、網路、行程、資料庫客戶端);專案自己的客戶端或封裝寫進 `system.md`「IO 模組追加」。

有純 API 的函式庫不在名單上——它們的效果由住在哪一層擋,不由名字擋。

## 匯出

step 與觀察點都要是**該檔案對外匯出的名字**,程式碼才對得到帳(`lint sig` 對帳)。各語言的匯出:

| 語言 | 匯出 |
|---|---|
| TypeScript / JavaScript | `export` 標的名字、`export { … }` |
| Python | `__all__`;沒寫就是「不以底線開頭的都算」 |
| Go | 大寫開頭 |
| Rust | `pub` |

只為 law 觀察而匯出、沒有其他消費者的簽名,照樣算匯出;**匯出一個函數給 law 觀察不是後門。**

## 對外 I/O

`system.md`「對外 I/O」表列出每個跨過最外層邊界的入口與出口:

```markdown
| 名稱 | 方向 | 型別 | 模組 | 進入哪份 feature | 信任 | 驗證 |
|---|---|---|---|---|---|---|
| POST /auth/refresh | in | `RefreshReq` | `src/entry/routes.ts` | F-002-token-refresh | untrusted | `parseRefresh` |
| 換發結果 | out | `TokenPair` | `src/entry/routes.ts` | F-002-token-refresh | trusted | - |
```

- **信任**:`untrusted` = 這一端的內容由系統外面決定(使用者輸入、第三方回應、讀進來的檔案);`trusted` = 由系統自己產生。
- **驗證**:`untrusted` 的 `in` 列必須指名一個做驗證的 step,而那個 step 要在該 feature 的 Steps 表裡。`in` 之後第一個碰到資料的東西就是它。
- 每份 feature 的兩端都要對得到這張表;表上的文檔必須是 feature,不能是 abstract。
- 表上的模組在模組表是最外層;型別不住最外層(邊界換了才不必跟著改)。

`devflow lint io` 對帳以上,外加三條安全:

1. `untrusted` 的 `in` 列沒有驗證 step,或驗證 step 不在 Steps 表裡 → 紅
2. Laws 的三行與 Examples 的輸入輸出出現密碼 / 金鑰 / token 樣式的字面值 → 紅。**秘密不進文檔**,example 用假名或型別描述
3. 最外層裡 import 了 IO 模組、卻沒有出現在對外 I/O 表的檔案 → info「可能是沒登記的出入口」

## 測試與邊界

- 測試不在依賴圖裡:測試 import 任何層都不算違規。
- 預設只測公開匯出;需要測內部,把那個簽名列成 `o` 列並匯出,或用該語言的內部可見性(Rust 的 `pub(crate)`、TypeScript 的 `internal` 慣例、Python 的底線名加 `__all__`)。
- **禁止為測試在內層開後門**(test-only setter、繞過正常流程的建構子、把不變量的檢查關掉的旗標)。不開後門就測不到 = 簽名設計缺陷,開 GAP 指出缺的觀察點。
