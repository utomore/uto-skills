"""對內用領域的語言：每個領域資料夾的名稱都要先登記在 docs/glossary.md 的「識別名」欄。

用法：uv run python -m scripts.check_glossary
"""

from pathlib import Path

from scripts._common import DOMAINS_DIR, REPO_ROOT, domain_names, report, table_rows


def check(repo_root: Path = REPO_ROOT, domains_dir: Path = DOMAINS_DIR) -> list[str]:
    path = repo_root / "docs" / "glossary.md"
    if not path.exists():
        return ["找不到 docs/glossary.md"]
    identifiers = {
        row.get("識別名", "") for row in table_rows(path.read_text(encoding="utf-8"))
    } - {"", "-"}
    return [
        f"領域 {d} 不在 glossary.md 的識別名欄；先登記名詞再建資料夾"
        for d in domain_names(domains_dir)
        if d not in identifiers
    ]


if __name__ == "__main__":
    raise SystemExit(report("check_glossary", check()))
