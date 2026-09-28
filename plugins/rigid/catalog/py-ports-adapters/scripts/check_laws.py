"""需求、領域文件與 law 測試對得上。

1. docs/plan/M*.md 的每一個單元：id 是 REQ-<三位數> 且在所有里程碑裡不重複；
   domains 欄是 `-`，或以逗號分隔的領域名與 _layout.NON_DOMAIN_OWNERS 裡的名字；
   列出的領域都要有資料夾。
2. 每個領域資料夾都有 feature.md 與 laws.md。
3. 領域資料夾裡的測試檔只能叫 test_<領域>.py 或 test_<領域>_<主題>.py。
4. laws.md「## Laws」的每條 law（`- LAW-<n>` 開頭的行）不重複，
   且至少有一個測試標了 @pytest.mark.law("LAW-<n>")；測試標的 law 必須存在。
   「## 候選」不能帶 LAW 編號：實作時連同測試搬進 ## Laws 才編號。
5. 領域與 platform 的 laws.md 裡，law 或候選提到的每一個 REQ-<三位數> 都存在，
   而且那條需求的 domains 欄列了這個領域（或 platform）。標不標 REQ 由寫的人決定。

用法：uv run python -m scripts.check_laws
"""

import ast
import re
from pathlib import Path

from scripts._common import (
    DOMAINS_DIR,
    REPO_ROOT,
    REQ_REF,
    domain_names,
    law_lines,
    listed_owners,
    report,
    requirement_rows,
    section,
)
from scripts._layout import NON_DOMAIN_OWNERS

LAW_LINE = re.compile(r"^- (LAW-\d+)\b", re.MULTILINE)
LAW_ID = re.compile(r"^LAW-\d+$")
REQ_ID = re.compile(r"^REQ-\d{3}$")


def check(repo_root: Path = REPO_ROOT, domains_dir: Path = DOMAINS_DIR) -> list[str]:
    problems: list[str] = []
    domains = domain_names(domains_dir)
    problems += _check_requirements(repo_root, set(domains))
    owners = {row.get("id", ""): listed_owners(row) for row in requirement_rows(repo_root)}
    for d in domains:
        problems += _check_domain(domains_dir / d)
        problems += _check_requirement_refs(d, domains_dir / d / "laws.md", owners)
    platform_laws = domains_dir.parent / "platform" / "laws.md"
    problems += _check_requirement_refs("platform", platform_laws, owners)
    return problems


def _check_requirements(repo_root: Path, domains: set[str]) -> list[str]:
    if not (repo_root / "docs" / "plan").is_dir():
        return ["找不到 docs/plan"]
    problems: list[str] = []
    seen: set[str] = set()
    for row in requirement_rows(repo_root):
        rid, where = row.get("id", ""), row["檔案"]
        if not REQ_ID.match(rid):
            problems.append(f"{where}：id「{rid}」不是 REQ-<三位數>")
        if rid in seen:
            problems.append(f"{where}：{rid} 重複")
        seen.add(rid)
        for name in sorted(listed_owners(row)):
            if name not in domains and name not in NON_DOMAIN_OWNERS:
                problems.append(f"{where}：{rid} 列的領域 {name} 沒有資料夾")
    return problems


def _check_domain(domain_dir: Path) -> list[str]:
    name = domain_dir.name
    problems: list[str] = []
    for doc in ("feature.md", "laws.md"):
        if not (domain_dir / doc).exists():
            problems.append(f"{name}：缺少 {doc}")
    laws_path = domain_dir / "laws.md"
    laws_text = laws_path.read_text(encoding="utf-8") if laws_path.exists() else ""
    law_ids = LAW_LINE.findall(section(laws_text, "Laws"))
    if LAW_LINE.search(section(laws_text, "候選")):
        problems.append(f"{name}：候選不能用 LAW 編號，實作時連同測試搬進 ## Laws 才編號")
    for dup in sorted({i for i in law_ids if law_ids.count(i) > 1}):
        problems.append(f"{name}：laws.md 的 {dup} 重複")

    tested: set[str] = set()
    for test_file in sorted(domain_dir.glob("test_*.py")):
        stem = test_file.stem
        if stem != f"test_{name}" and not stem.startswith(f"test_{name}_"):
            problems.append(
                f"{name}：測試檔 {test_file.name} 要叫 test_{name}.py 或 test_{name}_<主題>.py"
            )
        for law in _tagged_laws(test_file):
            if not LAW_ID.match(law):
                problems.append(f"{name}：{test_file.name} 標了格式不對的 law「{law}」")
            elif law not in law_ids:
                problems.append(f"{name}：{test_file.name} 標了 laws.md 裡沒有的 {law}")
            tested.add(law)

    for law in sorted(set(law_ids) - tested, key=lambda i: int(i.split("-")[1])):
        problems.append(f"{name}：{law} 沒有任何測試")
    return problems


def _check_requirement_refs(owner: str, laws_path: Path, owners: dict[str, set[str]]) -> list[str]:
    """law 或候選提到的 REQ 要存在，且那條需求的 domains 欄列了 owner。"""
    if not laws_path.exists():
        return []
    problems: list[str] = []
    for _, line in law_lines(laws_path.read_text(encoding="utf-8")):
        for rid in REQ_REF.findall(line):
            if rid not in owners:
                problems.append(f"{owner}：laws.md 提到的 {rid} 不在 docs/plan")
            elif owner not in owners[rid]:
                problems.append(
                    f"{owner}：laws.md 提到 {rid}，但 {rid} 的 domains 欄沒有列 {owner}"
                )
    return problems


def _tagged_laws(test_file: Path) -> list[str]:
    """找出所有 @pytest.mark.law(...) 的字串參數。"""
    tree = ast.parse(test_file.read_text(encoding="utf-8"), filename=str(test_file))
    found: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef):
            continue
        for dec in node.decorator_list:
            if (
                isinstance(dec, ast.Call)
                and isinstance(dec.func, ast.Attribute)
                and dec.func.attr == "law"
                and isinstance(dec.func.value, ast.Attribute)
                and dec.func.value.attr == "mark"
            ):
                for arg in dec.args:
                    if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                        found.append(arg.value)
    return found


if __name__ == "__main__":
    raise SystemExit(report("check_laws", check()))
