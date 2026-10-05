from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI()

    @app.post("/orders")
    def post_orders() -> dict[str, int]:
        return {"total": 0}

    @app.get("/orders")
    def get_orders() -> list[int]:
        return []

    @app.get("/orders/{order_id}")
    def get_order(order_id: str) -> dict[str, str]:
        """沒有任何 feature.md 宣告的路由。"""
        return {"order_id": order_id}

    @app.get("/_ops/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app
