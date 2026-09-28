from shop.domains._shared import Context


def list_orders(ctx: Context) -> list[int]:
    """沒有宣告權限項的 use case。"""
    return []
