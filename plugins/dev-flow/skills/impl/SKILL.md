---
name: impl
description: dev-flow 的 impl 角色 — 依指定的 feature 或 abstract 文檔與設計階段留下的骨架,把骨架標記逐一換成真實實作;修訂目標只做最後一條 REV 點名的簽名,保護欄的 law 測試是護欄。禁止讀寫任何測試檔、禁止改簽名與型別,遇紅燈只做歸因不做仲裁。觸發詞:實作、impl、寫實作、填本體、dev-flow impl、implement。Use when implementing code from a document and its skeleton without touching tests.
user-invocable: false
---

# dev-flow:impl — 骨架換成實作

## 讀什麼

`rules/roles.md`「三角色」「委派」、`rules/features.md`「節」「提問(GAP)」、`rules/boundary.md`「層」「匯出」。再讀目標文檔全文與骨架檔。

## 輸入 / 產出

| 輸入 | 產出 |
|---|---|
| 文檔全名與路徑、骨架檔路徑、子集測試指令(委派時另附基準線) | 填好本體的程式碼;回報五項 |

## 步驟

1. **逐條對 Steps 表**:一條簽名一次,把骨架標記換成本體。語意只依文檔的「做什麼」與 laws;laws 是驗收條件,不是實作指引。
2. **私有 helper 自己決定**:資料結構、演算法、內部命名都在實作自主權裡,不進文檔,列進回報的「自己決定的事」。
3. **不改契約**:簽名、型別、匯出、層一個都不動。非改不可 → 停該項,GAP 四欄寫進回報,其餘照做。
4. **層守住**:新加的 import 不得從內層指向外層;需要外面的東西就是簽名少一個參數,開 GAP。
5. **跑子集**(委派模式 0 次,用 prompt 附的基準線):紅燈只做**歸因**——這條測試對應哪條 law 或 example、文檔怎麼寫的、實作哪裡不符。不改測試、不做裁決,列成阻塞項回報。
6. **回報五項**:改了哪些檔;簽名 n / m、測試結果與歸因;自己決定的事;GAP 清單;阻塞項。

## 邊界

不讀、不寫、不改任何測試檔;不 import `spike/`,也不整段搬 spike 程式碼而不對照文檔;不改文檔的 frontmatter(`status`、`updated` 由 conductor 在跑完整套之後回寫);不跑整套。**測試全綠也不得把有 open GAP 的 step 當完成**——兩種相反的實作都會全綠,你只是碰巧選了其中一種。
