# 邊界

functional core / imperative shell。邊界的唯一宣告是模組表;`lawful lint boundary` 拿 import 圖與簽名對它。

## 四層

層是模組的屬性,意義是依賴方向:

| 層 | 裝什麼 | 禁止 | 可以 import |
|---|---|---|---|
| **types** | 純值型別、強型別標籤、狀態的 ADT、smart constructor | 函數以外的東西;import 上層 | types |
| **effects** | 效果的**描述**:指令 ADT(純資料)、smart constructor、對描述的純函數(建構、組合、最佳化、檢視、instance) | 把描述變成執行:簽名出現效果型別、import shell 或 IO 模組 | types、effects |
| **pure** | pipeline 的 stage 本體:純轉換 | 簽名出現效果型別;import shell 或 IO 模組 | types、effects、pure |
| **shell** | 解譯器、進入點、平台驅動:唯一出現效果的地方 | 無 | 全部 |

## 模組表

`.design/modules.md`,一張表,是邊界不是進度表:

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

- 簽名是否碰到效果由 adapter 的 `isEffectful` 判(Haskell:`IO` 出現在簽名)。
- IO 模組黑名單由 adapter 的 `ioModules` 給預設,`system.md`「語言與工具」可追加。
- 效果的**描述**是純資料,住 effects;**執行**它的解譯器住 shell。同一個效果在兩層各有一個名字,不共用模組。

## 對外 I/O

`system.md`「對外 I/O」表列出每個跨過 shell 邊界的入口與出口:名稱、方向、型別或效果 ADT、shell 模組、進入哪條 pipeline。

- 每條里程碑 pipeline 的兩端都要對得到這張表的某一列。
- 表上的型別與效果 ADT 住 types 或 effects,不住 shell。

## 測試與邊界

- 測試不在依賴圖裡:測試 import 任何層都不算違規。
- 預設只測公開匯出;需要測內部走 `*.Internal`(測試可 import,production 模組不准)。
- 禁止為測試在核心層開後門(test-only export、setter、繞過正常流程的建構子)。不開後門就測不到 = 簽名設計缺陷,開 GAP 指出缺的觀察點。
