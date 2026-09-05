# 邊界

functional core / imperative shell。邊界的唯一宣告是模組表;`lawful lint boundary` 拿 import 圖與簽名對它。

## 四層

層是模組的屬性,意義是依賴方向:

| 層 | 裝什麼 | 禁止 | 可以 import |
|---|---|---|---|
| **types** | 純值型別、強型別標籤、狀態的 ADT、smart constructor、存取子、instance | smart constructor 與存取子以外的轉換邏輯(住 pure);import 上層 | types |
| **effects** | 效果的**描述**:指令 ADT(純資料)、smart constructor、對描述的純函數(建構、組合、最佳化、檢視、instance)、把描述跑在純資料上的**純解譯器** | 把描述變成執行:簽名出現效果型別、import shell 或 IO 模組 | types、effects |
| **pure** | pipeline 的 stage 本體:純轉換、`=` 列 | 簽名出現效果型別;import shell 或 IO 模組 | types、effects、pure |
| **shell** | 真解譯器、`!` 列的進入點、平台驅動:唯一出現效果的地方 | 無 | 全部 |

types / effects / pure 的每個模組都有匯出清單;沒寫匯出清單的模組整個公開,`lint boundary` 算紅。

## 模組表

`.lawful/modules.md`,一張表,是邊界不是進度表:

```markdown
| 模組 | 層 |
|---|---|
| `Math`、`Id`、`World` | types |
| `Effect.Render`、`Effect.Audio` | effects |
| `Physics.*`、`Animation.*`、`ECS.*` | pure |
| `Host.*`、`RHI.*`、`Audio.Backend` | shell |
```

- 模組欄由 `lawful modules --gen` 從程式碼生成;人只填層欄。`*` 通配一個前綴底下的所有模組。
- 程式碼有、表上沒有的模組 → 未登記;表上有、程式碼沒有的 → 幽靈。兩者都是 `lint boundary` 的紅。
- 模組沒有完成狀態。模組的進度 = 它裝的所有 stage 的狀態:`lawful status --module M` 列出全專案哪些 pipeline 的哪些 stage 住在 M、簽名在不在、laws 綠了幾條。

## 效果的判定

- 簽名是否碰到效果由 adapter 的 `isEffectful` 判:效果型別出現在簽名(Haskell:`IO`、`IOE`、`MonadIO`、`MonadUnliftIO`、`STM`、`IORef`、`MVar`、`TVar`);`system.md`「語言與工具」的「效果型別追加」可加(例如專案自己的 `App` monad)。
- 效果系統的描述型別(`Eff es`、`Sem r`、`Free f`、自家的指令 ADT)不是效果:它是純資料,住 effects;帶著 `IOE :> es` 這種執行能力的才算效果。
- IO 模組黑名單由 adapter 的 `ioModules` 給預設:繞過型別系統的逃生口(`unsafePerformIO`、`Debug.Trace`、FFI)與只有效果的模組;有純 API 的模組(`System.Random` 的 `StdGen`、`Data.Time` 的 `UTCTime`)不在名單上,它們的效果由簽名擋。`system.md`「語言與工具」可追加。
- 效果的**描述**是純資料,住 effects;**執行**它的真解譯器住 shell。同一個效果在兩層各有一個名字,不共用模組。
- 每個效果描述配一個**純解譯器**(把描述跑在記憶體裡的資料上:`Map FilePath ByteString` 當檔案系統、固定序列當時鐘),住 effects 或 pure。它是觀察點:里程碑 `=` 列的 law 靠它寫,qa 不必碰 IO。

## 對外 I/O

`system.md`「對外 I/O」表列出每個跨過 shell 邊界的入口與出口:名稱、方向、型別或效果 ADT、shell 模組、進入哪條 pipeline。

- 每條里程碑 pipeline 的兩端都要對得到這張表的某一列;表上的 pipeline 必須是里程碑。
- 表上的 shell 模組在模組表是 shell 層;型別與效果 ADT 住 types 或 effects,不住 shell。
- `lawful lint io` 對帳以上三條。

## 測試與邊界

- 測試不在依賴圖裡:測試 import 任何層都不算違規。
- 預設只測公開匯出;需要測內部走 `*.Internal`(`M.Internal` 只准 `M` 自己與測試 import,其他 production 模組不准;`lint boundary` 對帳)。
- stage 與觀察點都要是匯出的簽名,程式碼才對得到帳(`lint sig` 對帳)。有 production 消費者的住公開模組;只為 law 觀察而匯出、沒有 production 消費者的,住 `*.Internal`。匯出一個純函數給 law 觀察不是後門。
- 禁止為測試在核心層開後門(test-only export、setter、繞過正常流程的建構子)。不開後門就測不到 = 簽名設計缺陷,開 GAP 指出缺的觀察點。
