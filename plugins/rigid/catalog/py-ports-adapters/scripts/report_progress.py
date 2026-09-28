"""單元的進度：由驗收的證據推算（ADR-006），按階段與里程碑彙總。只報告，不擋合併。

每個單元歸成一種狀態：
- 完成：每一條驗收都有證據。
- 進行中：有一部分驗收有證據。
- 未開始：沒有任何一條驗收有證據。
什麼算證據見 scripts/check_evidence.py。

用法：
  uv run python -m scripts.report_progress          # 每個里程碑一列
  uv run python -m scripts.report_progress M3       # 列出 M3 的每一個單元
"""

import sys
from collections import Counter
from pathlib import Path

from scripts._common import DOMAINS_DIR, REPO_ROOT, milestone_order, requirement_rows
from scripts.check_evidence import STATES, unit_counts


def summary(repo_root: Path = REPO_ROOT, domains_dir: Path = DOMAINS_DIR) -> str:
    counts = unit_counts(repo_root, domains_dir)
    groups: dict[tuple[str, str], Counter[str]] = {}
    for row in requirement_rows(repo_root):
        key = (row.get("階段", "-"), row.get("里程碑", "-"))
        groups.setdefault(key, Counter())[counts[row.get("id", "")][0]] += 1
    lines = [
        "| 階段 | 里程碑 | 單元 | " + " | ".join(STATES) + " |",
        "|---" * (3 + len(STATES)) + "|",
    ]
    for (phase, milestone), c in sorted(groups.items(), key=lambda kv: milestone_order(kv[0][1])):
        cells = " | ".join(str(c[s]) for s in STATES)
        lines.append(f"| {phase} | {milestone} | {sum(c.values())} | {cells} |")
    return "\n".join(lines)


def detail(milestone: str, repo_root: Path = REPO_ROOT, domains_dir: Path = DOMAINS_DIR) -> str:
    counts = unit_counts(repo_root, domains_dir)
    lines = ["| id | 狀態 | 有證據的驗收 | domains | 單元 |", "|---|---|---|---|---|"]
    for row in requirement_rows(repo_root):
        if row.get("里程碑") == milestone:
            rid = row.get("id", "")
            state, done, total = counts[rid]
            owners, unit = row.get("domains", "-"), row.get("單元", "")
            lines.append(f"| {rid} | {state} | {done}/{total} | {owners} | {unit} |")
    return "\n".join(lines)


if __name__ == "__main__":
    print(detail(sys.argv[1]) if len(sys.argv) > 1 else summary())
