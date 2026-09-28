"""入口一：FastAPI。create_app() 不連資料庫、不讀設定。"""

from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI()

    @app.post("/orders")
    def post_orders() -> dict[str, int]:
        return {"total": 0}

    @app.get("/_ops/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app
