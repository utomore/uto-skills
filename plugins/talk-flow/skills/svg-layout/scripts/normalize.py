#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["svgelements>=1.9", "fonttools>=4.50", "pypinyin>=0.53"]
# ///
"""normalize.py — 補齊語意化 id 與 data-* 角色標註(不動任何幾何值)。

這是 svg-layout 流程的前置步驟。它只寫入 `id`、`data-role`、`data-from`、
`data-to`、`data-layer`,絕不修改座標、尺寸、顏色或任何視覺屬性。

ID 穩定性是硬性要求:重跑時既有的 id 與 data-* 一律保留,只補未標註的元素;
拓撲改變也不重新分配既有 id。只有 --force-relabel 會重建(並警告)。

用法:
  uv run normalize.py diagram.svg --dry-run
  uv run normalize.py diagram.svg --in-place
  uv run normalize.py diagram.svg -o out.svg
"""

from __future__ import annotations

import argparse
from pathlib import Path as FsPath

from _core import (
    BOX_SHAPES, LINE_SHAPES, El, Sym, SvgDoc, TextMeasurer, has_fill, infer_roles,
    is_dashed, label_text_of, load_glossary, setup_stdout, slugify,
)

MANAGED_ATTRS = ("data-role", "data-from", "data-to", "data-layer")


def unique_id(base: str, taken: set[str]) -> str:
    if base not in taken:
        taken.add(base)
        return base
    i = 2
    while f"{base}-{i}" in taken:
        i += 1
    new = f"{base}-{i}"
    taken.add(new)
    return new


def layer_of(el: El, doc: SvgDoc) -> str | None:
    """以 node 的垂直位置推 data-layer(同一列視為同層)。"""
    nodes = [n for n in doc.rendered() if n.role == "node" and n.bbox is not None]
    if el.bbox is None or len(nodes) < 2:
        return None
    rows: list[float] = []
    for n in sorted(nodes, key=lambda e: e.bbox.cy):
        if not rows or abs(n.bbox.cy - rows[-1]) > max(n.bbox.h * 0.5, 20):
            rows.append(n.bbox.cy)
    for idx, ry in enumerate(rows):
        if abs(el.bbox.cy - ry) <= max(el.bbox.h * 0.5, 20):
            return f"row-{idx + 1}"
    return None


class Plan:
    """待寫入的變更(dry-run 時只印不寫)。"""

    def __init__(self) -> None:
        self.entries: list[tuple[str, str, str, str]] = []   # (target, attr, old, new)

    def set(self, el: El, attr: str, value: str, target_hint: str = "") -> None:
        old = el.elem.get(attr)
        if old == value:
            return
        target = target_hint or el.el_id or f"<{el.tag}>"
        self.entries.append((target, attr, old or "", value))
        el.elem.set(attr, value)

    def __len__(self) -> int:
        return len(self.entries)


def normalize(doc: SvgDoc, plan: Plan, force: bool, glossary: dict) -> list[str]:
    notes: list[str] = []

    if force:
        for el in doc.rendered():
            if el.tag in BOX_SHAPES | set(LINE_SHAPES) | {"text", "g"}:
                el.elem.attrib.pop("id", None)
                for a in MANAGED_ATTRS:
                    el.elem.attrib.pop(a, None)
        doc.by_id.clear()
        for el in doc.all:
            el.role = None
            el.role_from_attr = False

    infer_roles(doc)
    taken = {el.el_id for el in doc.all if el.el_id}

    containers = [e for e in doc.rendered() if e.role == "container"]
    nodes = [e for e in doc.rendered() if e.role == "node"]
    edges = [e for e in doc.rendered() if e.role == "edge"]
    labels = [e for e in doc.rendered() if e.role == "label"]
    unknowns = [e for e in doc.rendered() if e.role == "unknown"]

    # 1) container / node 先取 id(edge id 依賴 node id)
    for el in sorted(containers, key=lambda e: (e.bbox.y, e.bbox.x) if e.bbox else (0, 0)):
        if not el.el_id:
            text = label_text_of(el, doc)
            plan.set(el, "id", unique_id(f"container-{slugify(text or 'group', glossary)}", taken),
                     target_hint=f"<{el.tag} @{el.bbox.fmt() if el.bbox else '?'}>")
        plan.set(el, "data-role", "container")

    for el in sorted(nodes, key=lambda e: (e.bbox.y, e.bbox.x) if e.bbox else (0, 0)):
        if not el.el_id:
            text = label_text_of(el, doc)
            plan.set(el, "id", unique_id(f"node-{slugify(text or 'node', glossary)}", taken),
                     target_hint=f"<{el.tag} @{el.bbox.fmt() if el.bbox else '?'}>")
        plan.set(el, "data-role", "node")
        layer = layer_of(el, doc)
        if layer and not el.elem.get("data-layer"):
            plan.set(el, "data-layer", layer)

    # 2) edge:id 由端點 node id 推導
    for el in sorted(edges, key=lambda e: (e.bbox.y, e.bbox.x) if e.bbox else (0, 0)):
        src = el.edge_from.el_id if el.edge_from else None
        dst = el.edge_to.el_id if el.edge_to else None
        if not el.el_id:
            if src and dst:
                base = f"edge-{strip_prefix(src)}-to-{strip_prefix(dst)}"
            elif src or dst:
                base = f"edge-{strip_prefix(src or dst)}-to-unknown"
                notes.append(f"edge 只認出單邊端點,id={base}(請確認 data-to/data-from)")
            else:
                base = "edge-unknown"
                notes.append("有 edge 兩端都對不到 node,已標為 edge-unknown,請手動確認")
            plan.set(el, "id", unique_id(base, taken),
                     target_hint=f"<{el.tag} @{el.bbox.fmt() if el.bbox else '?'}>")
        plan.set(el, "data-role", "edge")
        if src:
            plan.set(el, "data-from", src)
        if dst:
            plan.set(el, "data-to", dst)

    # 3) label:依歸屬命名
    for el in labels:
        if not el.el_id:
            owner = el.owner
            if owner is not None and owner.el_id:
                base = f"{owner.el_id}-label"
            else:
                base = f"label-{slugify(el.text or 'text', glossary)}"
            plan.set(el, "id", unique_id(base, taken), target_hint=f'<text "{el.text}">')
        plan.set(el, "data-role", "label")

    # 4) 推不出來的一律 unknown,不硬猜
    for el in unknowns:
        if not el.el_id:
            plan.set(el, "id", unique_id(f"unknown-{el.tag}", taken),
                     target_hint=f"<{el.tag} @{el.bbox.fmt() if el.bbox else '?'}>")
        plan.set(el, "data-role", "unknown")
        notes.append(f"#{el.el_id} 角色推不出來,已標 data-role=\"unknown\" — 請手動改成正確角色")

    return notes


def strip_prefix(el_id: str) -> str:
    for p in ("node-", "container-"):
        if el_id.startswith(p):
            return el_id[len(p):]
    return el_id


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="normalize.py",
        description="補齊 SVG 架構圖的語意化 id 與 data-* 角色標註(不改動任何幾何值)。",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="範例:\n"
               "  uv run normalize.py diagram.svg --dry-run     # 只看會改什麼\n"
               "  uv run normalize.py diagram.svg --in-place    # 就地寫回\n"
               "  uv run normalize.py diagram.svg -o out.svg    # 另存\n",
    )
    ap.add_argument("svg", type=FsPath, help="輸入的 SVG 檔")
    ap.add_argument("-o", "--output", type=FsPath, help="輸出檔路徑")
    ap.add_argument("--in-place", action="store_true", help="就地覆寫輸入檔")
    ap.add_argument("--dry-run", action="store_true", help="只印出將要做的變更,不寫檔")
    ap.add_argument("--force-relabel", action="store_true",
                    help="重建所有 id 與 data-*(會破壞既有引用,慎用)")
    ap.add_argument("--glossary", type=FsPath, help="額外的中英詞彙表 JSON(中文詞 → slug)")
    ap.add_argument("--ascii", action="store_true", help="改用純 ASCII 符號輸出")
    args = ap.parse_args(argv)

    ascii_mode = setup_stdout(args.ascii)
    S = Sym(ascii_mode)

    if not args.svg.exists():
        print(f"{S.err} 找不到檔案:{args.svg}")
        return 2
    if not (args.dry_run or args.in_place or args.output):
        print(f"{S.err} 請指定 --dry-run、--in-place 或 -o/--output 其中之一")
        return 2

    glossary = load_glossary(args.glossary)
    doc = SvgDoc(args.svg, TextMeasurer())
    plan = Plan()

    if args.force_relabel:
        print(f"{S.warn} --force-relabel:所有 id 與 data-* 將被重建,"
              f"既有引用(inspect 輸出、lint 報告、外部連結)會失效\n")

    notes = normalize(doc, plan, args.force_relabel, glossary)

    before = sum(1 for el in doc.all if el.el_id)
    print(f"{args.svg.name}:{len(doc.rendered())} 個可見元素,"
          f"{len(plan)} 項待寫入屬性")
    if not plan:
        print(f"{S.ok} 已經標註完整,無需變更")
    else:
        print()
        width = max((len(t) for t, _, _, _ in plan.entries), default=10)
        for target, attr, old, new in plan.entries:
            change = f"{old} {S.arrow} {new}" if old else new
            print(f"  {target:<{width}}  {attr}={change}")

    if notes:
        print()
        for n in dict.fromkeys(notes):
            print(f"  {S.warn} {n}")

    if args.dry_run:
        print(f"\n{S.ok} dry-run:未寫入任何檔案")
        return 0

    out = args.svg if args.in_place else args.output
    doc.write(out)
    print(f"\n{S.ok} 已寫入 {out}(僅 id 與 data-*;幾何值未變動)")
    print(f"  {S.arrow} 下一步:uv run inspect_svg.py {out}")
    _ = before
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
