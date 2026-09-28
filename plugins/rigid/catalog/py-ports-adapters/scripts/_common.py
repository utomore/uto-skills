"""檢查腳本共用的小工具：讀 Markdown 表格、列出領域、讀開發計畫、回報結果。專案的形狀在 _layout.py。"""

import re
import sys
from collections.abc import Iterable
from pathlib import Path

from scripts._layout import PACKAGE

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "src" / PACKAGE
DOMAINS_DIR = SRC_DIR / "domains"
PLAN_DIR = REPO_ROOT / "docs" / "plan"


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


REQ_REF = re.compile(r"\bREQ-\d{3}\b")
PHASE_LINE = re.compile(r"^- 階段：(\S+)", re.MULTILINE)


def plan_files(repo_root: Path) -> list[Path]:
    return sorted((repo_root / "docs" / "plan").glob("M*.md"))


def requirement_rows(repo_root: Path) -> list[dict[str, str]]:
    """docs/plan/M*.md 第一張表的每一列（可開發單元）。

    另外補上三個欄位：`里程碑` 取自檔名（M3-orders.md → M3），
    `階段` 取自檔案裡的「- 階段：」，`檔案` 是檔名。
    """
    rows: list[dict[str, str]] = []
    for path in plan_files(repo_root):
        text = path.read_text(encoding="utf-8")
        phase = PHASE_LINE.search(text)
        for row in table_rows(text):
            row["里程碑"] = path.name.split("-", 1)[0].removesuffix(".md")
            row["階段"] = phase.group(1) if phase else "-"
            row["檔案"] = path.name
            rows.append(row)
    return rows


def milestone_order(milestone: str) -> float:
    """M1、M2…M10 依數字排；不是 M 開頭的排最後。"""
    try:
        return float(milestone.removeprefix("M"))
    except ValueError:
        return float("inf")


EVIDENCE = re.compile(r"（證據：([^）]*)）\s*$")


def acceptance(repo_root: Path) -> dict[str, list[tuple[str, list[str]]]]:
    """docs/plan/M*.md 每個單元的驗收：{REQ id: [(驗收那一行, [證據…])]}。

    驗收是 `## REQ-xxx` 底下 `- ` 開頭的行；證據寫在行尾的「（證據：a、b）」，沒寫就是空的。
    """
    result: dict[str, list[tuple[str, list[str]]]] = {}
    for path in plan_files(repo_root):
        text = path.read_text(encoding="utf-8")
        for row in table_rows(text):
            rid = row.get("id", "")
            items: list[tuple[str, list[str]]] = []
            for line in section(text, rid).splitlines():
                if not line.startswith("- "):
                    continue
                found = EVIDENCE.search(line)
                refs = [r.strip() for r in found.group(1).split("、")] if found else []
                items.append((line, [r for r in refs if r]))
            result[rid] = items
    return result


def demonstrated(repo_root: Path) -> dict[str, set[str]]:
    """每個里程碑檔「## 展示紀錄」表的「展示」欄：{檔名: {"REQ-003/部署dev", …}}。"""
    return {
        path.name: {row.get("展示", "") for row in table_rows(section(text, "展示紀錄"))}
        for path in plan_files(repo_root)
        for text in [path.read_text(encoding="utf-8")]
    }


def listed_owners(row: dict[str, str]) -> set[str]:
    """一列需求的 domains 欄拆成名稱集合；`-` 或空白回空集合。"""
    listed = row.get("domains", "").strip()
    if listed in ("", "-"):
        return set()
    return {n.strip() for n in listed.split(",") if n.strip()}


def law_lines(laws_text: str) -> list[tuple[str, str]]:
    """laws.md 裡 `## Laws` 與 `## 候選` 的每一條（`- ` 開頭的行），回傳 (節名, 行)。"""
    return [
        (heading, line)
        for heading in ("Laws", "候選")
        for line in section(laws_text, heading).splitlines()
        if line.startswith("- ")
    ]


def report(name: str, problems: Iterable[str]) -> int:
    problems = list(problems)
    for p in problems:
        print(f"[{name}] {p}", file=sys.stderr)
    return 1 if problems else 0
