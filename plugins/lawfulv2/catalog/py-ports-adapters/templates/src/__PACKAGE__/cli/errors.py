"""領域的錯誤型別翻成終端機上的話（以 1 結束）。每個 DomainError 子類別都要有一列（check_errors）。"""

TRANSLATIONS: dict[type, str] = {}
