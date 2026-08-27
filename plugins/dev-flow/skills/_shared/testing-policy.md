# 測試政策

`_shared/conventions.md` 的分片(原屬 `boundary-rules.md`)。**要寫或改測試時讀這份**:`/spec-qa`(主要讀者)、`/bugfix`(自己寫重現測試)、`/arch-audit`(檢查測試後門)。

走 spec 驅動流程的實作 skill(`/spec-impl`)**不寫也不讀測試**,不需要讀本片。

- **測試不在依賴圖裡**:「X 不能被依賴」管的是 production 模組之間的 import;測試 import X 不違反此規則,不要為此發問
- **預設只測公開介面**:純函式給輸入看輸出;代數性質用 property-based 測 law
- 需要測內部時走 `*.Internal`(或該語言的等價形式):測試可以 import,production 模組不准 import
- **禁止為測試在核心層開後門**(test-only export、setter、繞過正常流程的建構子)。不開後門就測不到 = 介面設計缺陷,停下來回報,並指出缺的觀察點是什麼
