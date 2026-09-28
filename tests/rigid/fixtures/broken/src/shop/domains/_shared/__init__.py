"""所有領域共用的最小集合：Context 與 DomainError。

這裡寫好之後幾乎不再變動。某個領域才需要的依賴，寫在那個領域自己的 ports.py。
"""

from shop.domains._shared.context import Actor, Clock, Context, Logger
from shop.domains._shared.errors import DomainError

__all__ = ["Actor", "Clock", "Context", "DomainError", "Logger"]
