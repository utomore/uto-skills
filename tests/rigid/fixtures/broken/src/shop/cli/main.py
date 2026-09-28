import typer

app = typer.Typer()
order = typer.Typer()
ops = typer.Typer()
app.add_typer(order, name="order")
app.add_typer(ops, name="ops")


@order.command("place")
def place(item: list[int]) -> None:
    typer.echo(sum(item))


@order.command("list")
def list_() -> None:
    """沒有任何 feature.md 宣告的指令。"""
    typer.echo("")


@ops.command("health")
def health() -> None:
    typer.echo("ok")
