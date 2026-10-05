"""入口二：Typer，和 api 對等、直接呼叫同一個 use case。

app 建立時不連資料庫、不讀設定（ADR-003）。`ops` 群組是維運的技術入口，不呼叫 use case、不必在任何 feature.md 宣告。
"""

import typer

app = typer.Typer(no_args_is_help=True)
ops = typer.Typer(help="維運的技術指令")
app.add_typer(ops, name="ops")


@ops.command("health")
def health() -> None:
    typer.echo("ok")
