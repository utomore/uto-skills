"""領域丟出的錯誤一律是 DomainError 的子類別。

子類別用 dataclass 帶欄位，說明「發生了什麼」，用領域的語言命名；
不寫給使用者看的訊息，訊息只在每個入口的錯誤翻譯表。
dataclass 不能 frozen：Python 丟出例外時要寫入 __traceback__，frozen 會失敗。
"""


class DomainError(Exception):
    pass
