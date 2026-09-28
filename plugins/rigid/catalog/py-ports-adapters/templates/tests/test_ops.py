"""兩個入口建得起來、維運的技術入口在：create_app() 與 cli 的 app 建立時不做任何 I/O（ADR-002）。"""

from typer.testing import CliRunner

from __PACKAGE__.api.app import create_app
from __PACKAGE__.cli.main import app


def test_api_has_the_health_endpoint_and_builds_without_io() -> None:
    assert "/_ops/health" in create_app().openapi()["paths"]


def test_cli_health_says_ok() -> None:
    result = CliRunner().invoke(app, ["ops", "health"])
    assert result.exit_code == 0
    assert result.output.strip() == "ok"
