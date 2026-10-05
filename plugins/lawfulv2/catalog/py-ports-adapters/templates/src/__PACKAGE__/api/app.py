"""入口一：FastAPI。

create_app() 不連資料庫、不讀設定（ADR-003）：check_entries 要能在沒有資料庫的環境載入它比對路由。
/_ops/ 底下是維運的技術入口，不呼叫 use case、不必在任何 feature.md 宣告。
"""

from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="__PROJECT__")

    @app.get("/_ops/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app
