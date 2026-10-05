.PHONY: sync check test integration fmt

sync:
	uv sync
	uv run pre-commit install

# 和 CI 的檢測階段相同
check:
	uv run ruff check
	uv run ruff format --check
	uv run pyright
	uv run lint-imports
	uv run python -m scripts.check_laws
	uv run python -m scripts.check_glossary
	uv run python -m scripts.check_entries
	uv run python -m scripts.check_errors

test:
	uv run pytest

# 要連真的資料庫或服務的測試
integration:
	uv run pytest -m integration tests/integration

fmt:
	uv run ruff check --fix
	uv run ruff format
