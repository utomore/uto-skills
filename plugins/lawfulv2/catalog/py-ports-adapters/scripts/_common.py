"""檢查腳本共用的小工具：讀 Markdown 表格、列出領域、讀 law、回報結果。專案的形狀在 _layout.py。"""

import sys
from collections.abc import Iterable
from pathlib import Path

from scripts._layout import PACKAGE

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "src" / PACKAGE
DOMAINS_DIR = SRC_DIR / "domains"


def domain_names(domains_dir: Path) -> list[str]:
    """領域資料夾的名稱；底線開頭的（_shared）與 __pycache__ 不算。"""
    return sorted(
        p.name for p in domains_dir.iterdir() if p.is_dir() and not p.name.startswith("_")
    )


def section(text: str, heading: str) -> str:
    """回傳 `## heading` 到下一個 `## ` 之間的內容；沒有這一節回空字串。"""
    out: list[str] = []
    inside = False
    for line in text.splitlines():
        if line.startswith("## "):
            if inside:
                break
            inside = line[3:].strip() == heading
            continue
        if inside:
            out.append(line)
    return "\n".join(out)


def table_rows(text: str) -> list[dict[str, str]]:
    """讀第一張 Markdown 表格，每一列回傳 {欄名: 值}，值去掉前後空白與反引號。"""
    rows: list[dict[str, str]] = []
    header: list[str] | None = None
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|"):
            if header is not None:
                break
            continue
        cells = [c.strip().strip("`").strip() for c in stripped.strip("|").split("|")]
        if header is None:
            header = cells
        elif all(set(c) <= set("-: ") for c in cells):
            continue
        else:
            rows.append(dict(zip(header, cells, strict=False)))
    return rows


def report(name: str, problems: Iterable[str]) -> int:
    problems = list(problems)
    for p in problems:
        print(f"[{name}] {p}", file=sys.stderr)
    return 1 if problems else 0
