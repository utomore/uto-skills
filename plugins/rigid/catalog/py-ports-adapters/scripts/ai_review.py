"""PR 的 AI 審查：每一層只放它該放的東西（ADR-002 的分層表）。

機器能確定的規則（依賴方向、入口、錯誤翻譯、law）在 `make check`；這裡只審機器判斷不了的那一段：
「這段 if 是格式檢查還是業務判斷」「這段邏輯該不該搬進領域」。規則直接讀 ADR-002 的表，不另外維護一份。
只看 src/<PACKAGE>/ 的改動；只留落在新增行上的發現。永遠不擋合併：任何錯誤印 AI_REVIEW_FAILED 與原因，exit 0。

用法：
  python -m scripts.ai_review prompt [--base main] [--diff <檔>]
      印出給模型的提示詞（rigid:review 在本機用：架構師的 session 自己當模型）。
  python -m scripts.ai_review run --cmd "<指令>" [--base main] [--diff <檔>] [--post <PR 號>]
      把提示詞從 stdin 餵給指令（例如 `claude -p`），讀它回的 JSON，印出發現；--post 用 gh 在 PR 上留一則 review，
      每個發現一條 inline comment。CI 接這一道，決定權在人。
diff 預設是 `git diff <base>...HEAD`；--diff 給一份存好的 diff 檔。
"""

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import cast

from scripts._common import REPO_ROOT
from scripts._layout import PACKAGE

ADR = REPO_ROOT / "docs" / "adr" / "ADR-002-code-design.md"
PROMPT = Path(__file__).with_name("ai_review_prompt.md")
SRC_PREFIX = f"src/{PACKAGE}/"
MAX_DIFF_BYTES = 200_000
FILE_HEADER = re.compile(r"^diff --git a/(\S+) b/(\S+)$")
HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")


@dataclass(frozen=True)
class Finding:
    file: str
    line: int
    layer: str
    rule: str
    reason: str
    move_to: str

    def body(self) -> str:
        rule = self.rule.removeprefix("不放：")
        return f"**{self.layer} 不放：{rule}**\n\n{self.reason}\n\n該搬去：`{self.move_to}`"


# ---------- diff ----------


def diff_text(base: str, diff_file: str | None) -> str:
    if diff_file:
        return Path(diff_file).read_text(encoding="utf-8")
    result = subprocess.run(
        ["git", "diff", f"{base}...HEAD"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git diff 失敗：{result.stderr.strip()}")
    return result.stdout


def keep_src_files(diff: str) -> str:
    """只留 src/<PACKAGE>/ 底下的檔案區塊。"""
    kept: list[str] = []
    keep = False
    for line in diff.splitlines(keepends=True):
        m = FILE_HEADER.match(line.rstrip("\n"))
        if m:
            keep = m.group(2).startswith(SRC_PREFIX)
        if keep:
            kept.append(line)
    return "".join(kept)


def added_lines(diff: str) -> dict[str, set[int]]:
    """每個檔案在新版裡新增或修改的行號；發現只能落在這些行。"""
    result: dict[str, set[int]] = {}
    current = ""
    new_line = 0
    for line in diff.splitlines():
        if m := FILE_HEADER.match(line):
            current = m.group(2)
            result.setdefault(current, set())
            continue
        if m := HUNK.match(line):
            new_line = int(m.group(1))
            continue
        if not current or line.startswith(("---", "+++")):
            continue
        if line.startswith("+"):
            result[current].add(new_line)
            new_line += 1
        elif line.startswith("-"):
            continue
        else:
            new_line += 1
    return result


def annotate(diff: str) -> str:
    """每一行前面標上它在新檔案裡的行號（刪掉的行標 `-`），模型就不必自己數。"""
    out: list[str] = []
    new_line = 0
    in_file = False
    for line in diff.splitlines():
        if FILE_HEADER.match(line):
            in_file = True
            out.append(line)
            continue
        if m := HUNK.match(line):
            new_line = int(m.group(1))
            out.append(line)
            continue
        if not in_file or line.startswith(("---", "+++")):
            out.append(line)
            continue
        if line.startswith("-"):
            out.append(f"    -|{line}")
            continue
        out.append(f"{new_line:5d}|{line}")
        new_line += 1
    return "\n".join(out) + "\n"


# ---------- 規則與 prompt ----------


def rules_table(adr_text: str) -> str:
    """ADR-002 決策裡「| 層 | 放什麼 | 不放什麼 |」那張表，原樣拿來當規則。"""
    rows = [line for line in adr_text.splitlines() if line.startswith(("| 層 |", "| `"))]
    header = next((i for i, r in enumerate(rows) if r.startswith("| 層 |")), None)
    if header is None:
        raise RuntimeError(f"{ADR.name} 找不到分層表")
    return "\n".join([rows[header], "|---|---|---|", *rows[header + 1 :]])


def build_prompt(diff: str, rules: str, template: str) -> str:
    return template.replace("{RULES}", rules).replace("{DIFF}", annotate(diff))


def parse_findings(text: str) -> list[Finding]:
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        raise RuntimeError("模型的回覆裡沒有 JSON 物件")
    data = cast(dict[str, object], json.loads(text[start : end + 1]))
    items = cast(list[dict[str, object]], data.get("findings", []))
    return [
        Finding(
            file=str(i.get("file", "")),
            line=int(cast(int, i.get("line", 0))),
            layer=str(i.get("layer", "")),
            rule=str(i.get("rule", "")),
            reason=str(i.get("reason", "")),
            move_to=str(i.get("move_to", "")),
        )
        for i in items
    ]


def on_added_lines(
    findings: list[Finding], added: dict[str, set[int]]
) -> tuple[list[Finding], list[Finding]]:
    """（留下的、丟掉的）：只留檔案在 diff 裡、行號是新增行的發現。"""
    kept = [f for f in findings if f.line in added.get(f.file, set())]
    dropped = [f for f in findings if f not in kept]
    return kept, dropped


def prepare(base: str, diff_file: str | None) -> tuple[str, dict[str, set[int]]] | None:
    """（提示詞、新增行）；src 沒有改動回 None。"""
    diff = keep_src_files(diff_text(base, diff_file))
    if not diff.strip():
        return None
    if len(diff.encode("utf-8")) > MAX_DIFF_BYTES:
        raise RuntimeError(f"diff 超過 {MAX_DIFF_BYTES} bytes，這條 PR 太大，人審")
    rules = rules_table(ADR.read_text(encoding="utf-8"))
    template = PROMPT.read_text(encoding="utf-8")
    return build_prompt(diff, rules, template), added_lines(diff)


# ---------- 輸出 ----------


def render(kept: list[Finding], dropped: list[Finding]) -> str:
    lines = [f"# 發現（{len(kept)}）"]
    for f in kept:
        lines.append(f"{f.file}:{f.line}  {f.layer} 不放：{f.rule.removeprefix('不放：')}")
        lines.append(f"  {f.reason}")
        lines.append(f"  該搬去：{f.move_to}")
    if dropped:
        lines.append(f"# 丟掉（{len(dropped)}，不在新增行上）")
        for f in dropped:
            lines.append(f"{f.file}:{f.line}")
    return "\n".join(lines)


def post(pr: str, kept: list[Finding]) -> None:
    """用 gh 在 PR 上留一則 review（COMMENT，不 approve 也不 request changes），每個發現一條 inline comment。"""
    repo = subprocess.run(
        ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    ).stdout.strip()
    body = {
        "event": "COMMENT",
        "body": (
            f"AI review：{len(kept)} 個發現（只審 ADR-002 的分層表，不擋合併）"
            if kept
            else "AI review：沒有發現（只審 ADR-002 的分層表）"
        ),
        "comments": [
            {"path": f.file, "line": f.line, "side": "RIGHT", "body": f.body()} for f in kept
        ],
    }
    subprocess.run(
        ["gh", "api", f"repos/{repo}/pulls/{pr}/reviews", "--method", "POST", "--input", "-"],
        input=json.dumps(body),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="ai_review")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("prompt", "run"):
        p = sub.add_parser(name)
        p.add_argument("--base", default="main")
        p.add_argument("--diff", default=None)
        if name == "run":
            p.add_argument("--cmd", required=True)
            p.add_argument("--post", default=None)
    args = parser.parse_args(argv)
    try:
        prepared = prepare(args.base, args.diff)
        if prepared is None:
            print("src 沒有改動，不審")
            return 0
        prompt, added = prepared
        if args.command == "prompt":
            print(prompt, end="")
            return 0
        reply = subprocess.run(
            args.cmd,
            shell=True,
            input=prompt,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        if reply.returncode != 0:
            detail = reply.stderr.strip()
            raise RuntimeError(
                f"模型指令失敗（exit {reply.returncode}）{'：' + detail if detail else ''}"
            )
        kept, dropped = on_added_lines(parse_findings(reply.stdout), added)
        print(render(kept, dropped))
        if args.post:
            post(args.post, kept)
        return 0
    except Exception as e:  # noqa: BLE001 — 這一步永遠不讓建置失敗
        print(f"AI_REVIEW_FAILED {e}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
