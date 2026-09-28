.PHONY: check test progress

# 和 CI 的檢測階段相同
check:
	uv run ruff check
	uv run pyright
	uv run lint-imports
	uv run python -m scripts.check_laws
	uv run python -m scripts.check_evidence
	uv run python -m scripts.check_glossary
	uv run python -m scripts.check_entries
	uv run python -m scripts.check_errors

test:
	uv run pytest

progress:
	uv run python -m scripts.report_progress $(M)
