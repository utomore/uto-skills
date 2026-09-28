"""驗收的證據對得上（ADR-006）。

docs/plan/M*.md 每條驗收的行尾可以寫「（證據：a、b）」，每一項是下面其中一種：

- `law:<領域或 platform>/LAW-<n>`：那份 laws.md 的「## Laws」有這條，而且單元的 domains 欄列了它。
- `test:<路徑>::<名稱>`：檔案存在；.py 裡有 `def <名稱>(`，其他檔案裡出現這個名稱。
- `<前綴>:<步驟>`：前綴在 _layout.PIPELINES 裡，對到的那份管線檔有 `id: <步驟>`。
- `check:<腳本>`：scripts/<腳本>.py 存在，而且 Makefile 的 check 跑它。
- `展示:<代號>`：人在 dev 或 stage 上看過；同一個里程碑檔的「## 展示紀錄」有一列的「展示」欄是
  `<REQ id>/<代號>`，才算數。代號在單元裡不重複。

寫錯的證據（找不到、格式不對）讓檢查失敗；展示還沒有紀錄不算錯，只是那條還沒有證據。
展示紀錄對不到任何一條驗收，也讓檢查失敗。
一條驗收寫的每一項證據都找得到，才算有證據。
單元的狀態由這裡推算：每條驗收都有證據是「完成」，有一部分是「進行中」，都沒有是「未開始」。

用法：uv run python -m scripts.check_evidence
"""

import re
from pathlib import Path

from scripts._common import (
    DOMAINS_DIR,
    REPO_ROOT,
    acceptance,
    demonstrated,
    listed_owners,
    report,
    requirement_rows,
    section,
)
from scripts._layout import PIPELINES

LAW_REF = re.compile(r"^law:([a-z_]+)/(LAW-\d+)$")
TEST_REF = re.compile(r"^test:(\S+?)::(\S+)$")
STEP_REF = re.compile(rf"^({'|'.join(map(re.escape, PIPELINES))}):([\w-]+)$")
CHECK_REF = re.compile(r"^check:(\w+)$")
DEMO_REF = re.compile(r"^展示:(\S+)$")
LAW_LINE = re.compile(r"^- (LAW-\d+)\b", re.MULTILINE)
STATES = ("完成", "進行中", "未開始")
KINDS = "、".join([*("law:", "test:"), *(f"{p}:" for p in PIPELINES), "check:", "展示:"])


def check(repo_root: Path = REPO_ROOT, domains_dir: Path = DOMAINS_DIR) -> list[str]:
    problems: list[str] = []
    rows = {row.get("id", ""): row for row in requirement_rows(repo_root)}
    for rid, items in acceptance(repo_root).items():
        where = rows[rid]["檔案"]
        for _, refs in items:
            for ref in refs:
                problem = _broken(ref, rows[rid], repo_root, domains_dir)
                if problem:
                    problems.append(f"{where}：{rid} 的證據「{ref}」{problem}")
    claimed: dict[str, set[str]] = {}
    for rid, items in acceptance(repo_root).items():
        keys = [
            f"{rid}/{m.group(1)}" for _, refs in items for r in refs if (m := DEMO_REF.match(r))
        ]
        for dup in sorted({k for k in keys if keys.count(k) > 1}):
            problems.append(f"{rows[rid]['檔案']}：展示的代號 {dup} 重複")
        claimed.setdefault(rows[rid]["檔案"], set()).update(keys)
    for name, demos in demonstrated(repo_root).items():
        for key in sorted(demos - claimed.get(name, set())):
            problems.append(f"{name}：展示紀錄的「{key}」對不到這個里程碑的任何一條驗收")
    return problems


def unit_counts(
    repo_root: Path = REPO_ROOT, domains_dir: Path = DOMAINS_DIR
) -> dict[str, tuple[str, int, int]]:
    """{REQ id: (狀態, 有證據的驗收條數, 驗收條數)}。"""
    result: dict[str, tuple[str, int, int]] = {}
    for rid, items in evidenced(repo_root, domains_dir).items():
        done = sum(ok for _, ok in items)
        total = len(items)
        state = "完成" if total and done == total else "進行中" if done else "未開始"
        result[rid] = (state, done, total)
    return result


def evidenced(
    repo_root: Path = REPO_ROOT, domains_dir: Path = DOMAINS_DIR
) -> dict[str, list[tuple[str, bool]]]:
    """{REQ id: [(驗收那一行, 這一條有沒有證據)]}。"""
    rows = {row.get("id", ""): row for row in requirement_rows(repo_root)}
    demos = demonstrated(repo_root)
    result: dict[str, list[tuple[str, bool]]] = {}
    for rid, items in acceptance(repo_root).items():
        row = rows[rid]
        shown = demos.get(row["檔案"], set())
        result[rid] = [
            (
                line,
                bool(refs)
                and all(_counts(ref, rid, row, shown, repo_root, domains_dir) for ref in refs),
            )
            for line, refs in items
        ]
    return result


def _counts(
    ref: str, rid: str, row: dict[str, str], shown: set[str], repo_root: Path, domains_dir: Path
) -> bool:
    if m := DEMO_REF.match(ref):
        return f"{rid}/{m.group(1)}" in shown
    return _broken(ref, row, repo_root, domains_dir) is None


def _broken(ref: str, row: dict[str, str], repo_root: Path, domains_dir: Path) -> str | None:
    """證據找得到回 None，找不到回原因。"""
    if DEMO_REF.match(ref):
        return None
    if m := LAW_REF.match(ref):
        return _broken_law(m.group(1), m.group(2), row, domains_dir)
    if m := TEST_REF.match(ref):
        return _broken_test(repo_root / m.group(1), m.group(2))
    if m := STEP_REF.match(ref):
        pipeline = PIPELINES[m.group(1)]
        path = repo_root / pipeline
        text = path.read_text(encoding="utf-8") if path.exists() else ""
        if not re.search(rf"^\s*(- )?id: {re.escape(m.group(2))}\s*$", text, re.MULTILINE):
            return f"在 {pipeline} 找不到這個步驟"
        return None
    if m := CHECK_REF.match(ref):
        name = m.group(1)
        if not (repo_root / "scripts" / f"{name}.py").exists():
            return f"找不到 scripts/{name}.py"
        makefile = repo_root / "Makefile"
        target = (
            _make_target(makefile.read_text(encoding="utf-8"), "check") if makefile.exists() else ""
        )
        if f"scripts.{name}" not in target:
            return "不在 make check 裡"
        return None
    return f"不是認得的證據（{KINDS}）"


def _broken_law(owner: str, law: str, row: dict[str, str], domains_dir: Path) -> str | None:
    laws = (
        domains_dir.parent / "platform" / "laws.md"
        if owner == "platform"
        else domains_dir / owner / "laws.md"
    )
    if not laws.exists():
        return f"找不到 {owner} 的 laws.md"
    if law not in LAW_LINE.findall(section(laws.read_text(encoding="utf-8"), "Laws")):
        return f"不在 {owner} 的 ## Laws"
    if owner not in listed_owners(row):
        return f"屬於 {owner}，但單元的 domains 欄沒有列 {owner}"
    return None


def _broken_test(path: Path, name: str) -> str | None:
    if not path.exists():
        return "的檔案不存在"
    text = path.read_text(encoding="utf-8")
    found = (
        re.search(rf"^\s*(async )?def {re.escape(name)}\(", text, re.MULTILINE)
        if path.suffix == ".py"
        else name in text
    )
    return None if found else f"的 {name} 不在檔案裡"


def _make_target(makefile: str, target: str) -> str:
    """Makefile 某個 target 的指令（到下一個空行為止）。"""
    lines = makefile.splitlines()
    try:
        start = lines.index(f"{target}:")
    except ValueError:
        return ""
    out: list[str] = []
    for line in lines[start + 1 :]:
        if not line.strip():
            break
        out.append(line)
    return "\n".join(out)


if __name__ == "__main__":
    raise SystemExit(report("check_evidence", check()))
