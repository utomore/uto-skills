# 邊界

functional core / imperative shell。邊界的唯一宣告是模組表;`lawful lint boundary` 拿 import 圖與簽名對它。

## 四層

層是模組的屬性,意義是依賴方向:

| 層 | 裝什麼 | 禁止 | 可以 import |
|---|---|---|---|
| **types** | 純值型別、強型別標籤、狀態的 ADT、smart constructor、存取子、instance | smart constructor 與存取子以外的轉換邏輯(住 core);import 上層 | types |
| **effect** | 效果的**描述**:指令 ADT(純資料)、smart constructor、對描述的純函數(建構、組合、最佳化、檢視、instance)、把描述跑在純資料上的**純解譯器** | 把描述變成執行:簽名出現效果型別、import shell 或 IO 模組 | types、effect |
| **core** | pipeline 的 stage 本體:純轉換、`=` 列 | 簽名出現效果型別;import shell 或 IO 模組 | types、effect、core |
| **shell** | 真解譯器、`!` 列的進入點、平台驅動:唯一出現效果的地方 | 無 | 全部 |

types / effect / core 的每個模組都有匯出清單;沒寫匯出清單的模組整個公開,`lint boundary` 算紅。

## 模組單元

模組表一列是一個**模組單元**:一段有名字的職責。程式碼裡它是一個命名空間,`Weft.Render` 底下的東西都歸它。

**層不是命名規範,是編譯期的維護框架**:一層一棵原始碼樹,四棵樹各是建置系統的一個子函式庫(Haskell:cabal sub-library),`build-depends` 照四層的方向宣告一次。一個檔屬於哪一層,看它住在哪棵樹 —— 模組名裡不寫層,誰能 import 誰由編譯器擋:

```
src-effect/Weft/Render.hs        Weft.Render        effect  ← 這一層的門面
src-effect/Weft/Render/View.hs   Weft.Render.View   effect
src-effect/Weft/Render/Font.hs   Weft.Render.Font   effect
src-shell/Weft/Render/GL.hs      Weft.Render.GL     shell   ← 同一個單元,另一棵樹
src-types/Weft/Render/Color.hs   Weft.Render.Color  types
```

- 一個單元在一層裡要幾個檔、叫什麼名字,由 pipeline 的 Stages 決定,規章不規定。
- **門面**是與單元同名的那個模組(`src-effect/Weft/Render.hs`),把單元的公開面重新匯出。要不要有隨意,有就只能有一個。它預設住最上層,因為只有最上層 import 得到底下每一層、重新匯出得了整個單元;門面住哪一層,就只有那一層以上的消費者用得到這個名字,所以主要被下層消費的單元(型別給別人的 types 層用的)把門面放低一點。`lawful module --facade [層]` 建它。
- 單元不巢狀:`Weft.Render` 在表上,`Weft.Render.View` 就不能另外列一列 —— 它是 `Weft.Render` 的一部分。
- 一個模組名只准一個檔:同名的兩個檔(尤其分在兩棵樹裡)在子函式庫之間會撞名,`lint boundary` 算紅。
- 檔案位置要對得上模組名:`Weft.Render.View` 的檔是 `<那一層的樹>/Weft/Render/View.hs`。
- **模組前綴**與**原始碼根目錄**寫在 `system.md`「語言與工具」。原始碼根目錄是一個帶 `<層>` 的樣式,預設 `src-<層>`。

模組單元先劃、pipeline 後走:`lawful module` 只決定名字、範圍與有哪幾層,在每一層的樹裡開好資料夾,不放任何模組。單元裡的簽名一律由 pipeline 的 Stages 表長出來(`pipelines.md`「pipeline」),pipeline 要在既有單元裡加、改、搬東西不必回頭動模組表。宣告了層卻還沒有程式碼是架構先行的常態,`lint boundary` 列成訊息不算紅。

## 模組表

`.lawful/modules.md`,一張表,是邊界不是進度表:

```markdown
| 模組 | 層 | 職責 |
|---|---|---|
| `Weft.Math` | types | 向量、矩陣與角度 |
| `Weft.Render` | types、effect、shell | 畫面指令的描述與它的真解譯器 |
| `Weft.Physics` | types、effect、core | 剛體、碰撞偵測與步進 |
| `Main` | shell | 可執行檔進入點 |
```

- 一列一個模組單元:模組欄是單元名,層欄是它有哪幾層(「、」分隔),職責欄一句話寫它負責什麼、範圍到哪。三欄都要填,`lint boundary` 對帳。
- 列由 `lawful module` 寫;既有程式碼用 `lawful modules --gen` 從模組名推出單元與層,職責欄留白由人填。
- `lint boundary` 的紅:層欄的值不在四層裡;職責欄空的;單元住在另一個單元底下;程式碼有、表上沒有(未登記);模組的檔不在任何一棵原始碼樹底下;模組所在那棵樹的層沒有列在它那一列;檔案位置對不上模組名;同一個模組名有兩個檔。表上有、程式碼還沒有的單元或層列成訊息,不算紅。
- 模組沒有完成狀態。模組的進度 = 它裝的所有 stage 的狀態:`lawful status --module M` 列出全專案哪些 pipeline 的哪些 stage 住在 M、簽名在不在、laws 綠了幾條;M 給單元名就是整個單元。

## 效果的判定

- 簽名是否碰到效果由 adapter 的 `isEffectful` 判:效果型別出現在簽名(Haskell:`IO`、`IOE`、`MonadIO`、`MonadUnliftIO`、`STM`、`IORef`、`MVar`、`TVar`);`system.md`「語言與工具」的「效果型別追加」可加(例如專案自己的 `App` monad)。
- 效果系統的描述型別(`Eff es`、`Sem r`、`Free f`、自家的指令 ADT)不是效果:它是純資料,住 effect;帶著 `IOE :> es` 這種執行能力的才算效果。
- IO 模組黑名單由 adapter 的 `ioModules` 給預設:繞過型別系統的逃生口(`unsafePerformIO`、`Debug.Trace`、FFI)與只有效果的模組;有純 API 的模組(`System.Random` 的 `StdGen`、`Data.Time` 的 `UTCTime`)不在名單上,它們的效果由簽名擋。`system.md`「語言與工具」可追加。
- 效果的**描述**是純資料,住 effect;**執行**它的真解譯器住 shell。同一個效果在同一個單元的兩層各有一個名字,不共用模組。
- 每個效果描述配一個**純解譯器**(把描述跑在記憶體裡的資料上:`Map FilePath ByteString` 當檔案系統、固定序列當時鐘),住 effect 或 core。它是觀察點:IO 介面 `=` 列的 law 靠它寫,qa 不必碰 IO。

## 對外 I/O

`system.md`「對外 I/O」表列出每個跨過 shell 邊界的入口與出口:名稱、方向、型別或效果 ADT、shell 模組、進入哪條 pipeline。

- 每條 IO 介面的兩端都要對得到這張表的某一列;表上的 pipeline 必須是 IO 介面。
- 表上的 shell 模組在模組表是 shell 層;型別與效果 ADT 住 types 或 effect,不住 shell。
- `lawful lint io` 對帳以上三條。

## 測試與邊界

- 測試不在依賴圖裡:測試 import 任何層都不算違規。
- 預設只測公開匯出;需要測內部走 `*.Internal`(`M.Internal` 只准 `M` 自己與測試 import,其他 production 模組不准;`lint boundary` 對帳)。
- stage 與觀察點都要是匯出的簽名,程式碼才對得到帳(`lint sig` 對帳)。有 production 消費者的住公開模組;只為 law 觀察而匯出、沒有 production 消費者的,住 `*.Internal`。匯出一個純函數給 law 觀察不是後門。
- 禁止為測試在核心層開後門(test-only export、setter、繞過正常流程的建構子)。不開後門就測不到 = 簽名設計缺陷,開 GAP 指出缺的觀察點。
