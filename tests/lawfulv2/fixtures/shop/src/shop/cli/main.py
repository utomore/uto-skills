"""入口二：Typer，和 api 對等、直接呼叫同一個 use case。app 建立時不連資料庫、不讀設定。"""

import typer

app = typer.Typer()
order = typer.Typer()
ops = typer.Typer()
app.add_typer(order, name="order")
app.add_typer(ops, name="ops")


@order.command("place")
def place(item: list[int]) -> None:
    typer.echo(sum(item))


@ops.command("health")
def health() -> None:
    typer.echo("ok")
