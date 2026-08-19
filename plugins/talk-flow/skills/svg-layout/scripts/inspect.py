#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["svgelements>=1.9", "fonttools>=4.50", "pypinyin>=0.53"]
# ///
"""inspect.py — 輸出架構圖的 scene digest(把絕對座標還原成關係)。

給 LLM 讀的精簡文字摘要,不是 JSON dump。所有幾何都是程式量測的結果:
巢狀 transform 已累積成絕對 bbox,文字寬度用 fontTools 量真實 advance
(中英混排逐字元分類,不用平均字寬);量不到字型時標記為 (est.)。

用法:
  uv run inspect.py diagram.svg
  uv run inspect.py diagram.svg --expand-paths
"""

from __future__ import annotations

import os
import sys

# 本檔名為 inspect.py,會遮蔽標準庫的 inspect(dataclasses 會 import 它)。
# 把腳本目錄移到 sys.path 最後:標準庫優先,_core 仍找得到。
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:] = [p for p in sys.path if os.path.abspath(p or os.getcwd()) != _HERE]
sys.path.append(_HERE)

import argparse  # noqa: E402
from math import gcd  # noqa: E402
from pathlib import Path as FsPath  # noqa: E402

from _core import (  # noqa: E402
    El, Sym, SvgDoc, TextMeasurer, dist, dist_point_to_box, infer_roles,
    label_text_of, num, seg_intersects_box, setup_stdout,
)

MIN_PADDING = 12.0
ENDPOINT_OK = 1.5
ALIGN_TOL = 2.0


def ratio_str(w: float, h: float) -> str:
    if not w or not h:
        return "?"
    a, b = int(round(w)), int(round(h))
    g = gcd(a, b) or 1
    ra, rb = a // g, b // g
    if rb and 1 <= ra / rb <= 3 and max(ra, rb) > 40:
        for cand in ((16, 9), (4, 3), (3, 2), (1, 1)):
            if abs(w / h - cand[0] / cand[1]) < 0.01:
                return f"{cand[0]}:{cand[1]}"
        return f"{w / h:.2f}:1"
    return f"{ra}:{rb}"


def edge_shape(el: El) -> str:
    pts = el.polypoints
    if el.tag == "line" or len(pts) < 3:
        return "straight"
    xs = {round(p[0], 1) for p in pts}
    ys = {round(p[1], 1) for p in pts}
    if len(xs) == 1 or len(ys) == 1:
        return "straight"
    if el.tag == "path" and ("C" in el.path_d.upper() or "Q" in el.path_d.upper()
                             or "A" in el.path_d.upper()):
        return "curved"
    segs = 0
    for i in range(1, len(pts) - 1):
        ax, ay = pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]
        bx, by = pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]
        if abs(ax * by - ay * bx) > 1.0:
            segs += 1
    return "orthogonal" if segs else "straight"


def turns_of(el: El) -> int:
    pts = [p for p in el.polypoints]
    dedup: list[tuple[float, float]] = []
    for p in pts:
        if not dedup or dist(p[0], p[1], dedup[-1][0], dedup[-1][1]) > 0.5:
            dedup.append(p)
    t = 0
    for i in range(1, len(dedup) - 1):
        ax, ay = dedup[i][0] - dedup[i - 1][0], dedup[i][1] - dedup[i - 1][1]
        bx, by = dedup[i + 1][0] - dedup[i][0], dedup[i + 1][1] - dedup[i][1]
        if abs(ax * by - ay * bx) > 1.0:
            t += 1
    return t


def label_of(el: El, doc: SvgDoc) -> El | None:
    for t in doc.rendered():
        if t.tag == "text" and t.owner is el:
            return t
    return None


def gaps(values: list[float], sizes: list[float]) -> list[float]:
    out = []
    for i in range(1, len(values)):
        out.append(values[i] - (values[i - 1] + sizes[i - 1]))
    return out


def cluster(vals: list[float], tol: float = 6.0) -> list[list[float]]:
    out: list[list[float]] = []
    for v in sorted(vals):
        if out and v - out[-1][-1] <= tol:
            out[-1].append(v)
        else:
            out.append([v])
    return out


def digest(doc: SvgDoc, S: Sym, expand_paths: bool) -> list[str]:
    lines: list[str] = []
    vb = doc.viewbox
    r = ratio_str(vb.w, vb.h)
    flag = S.ok if r in ("16:9", "4:3") else S.warn
    lines.append(f"canvas  viewBox=({num(vb.x)},{num(vb.y)},{num(vb.w)},{num(vb.h)})  "
                 f"ratio={r}  {flag}")
    lines.append("")

    nodes = [e for e in doc.rendered() if e.role == "node" and e.bbox]
    containers = [e for e in doc.rendered() if e.role == "container" and e.bbox]
    edges = [e for e in doc.rendered() if e.role == "edge"]

    # ---- 階層樹:container → node → label ---------------------------------- #
    placed: set[int] = set()
    for c in sorted(containers, key=lambda e: (e.bbox.y, e.bbox.x)):
        ctext = label_text_of(c, doc)
        lines.append(f'container {c.qname}  "{ctext}"  bbox={c.bbox.fmt()}')
        inner = [n for n in nodes if c.bbox.contains_box(n.bbox)]
        for n in sorted(inner, key=lambda e: (e.bbox.y, e.bbox.x)):
            placed.add(id(n))
            lines.extend(node_lines(n, doc, S, indent="  "))
    loose = [n for n in nodes if id(n) not in placed]
    if loose and containers:
        lines.append("")
    for n in sorted(loose, key=lambda e: (e.bbox.y, e.bbox.x)):
        lines.extend(node_lines(n, doc, S, indent=""))

    # ---- edges ------------------------------------------------------------ #
    if edges:
        lines.append("")
        lines.append(f"edges ({len(edges)})")
        width = max((len(e.qname) for e in edges), default=10)
        for e in sorted(edges, key=lambda x: (x.bbox.y if x.bbox else 0,
                                              x.bbox.x if x.bbox else 0)):
            shape = edge_shape(e)
            arrow = "" if e.directed else "  (no arrow)"
            lab = e.edge_label
            ltxt = (f'label="{lab.text}"@({num(lab.bbox.cx)},{num(lab.bbox.cy)})'
                    if lab and lab.bbox else "no label")
            lines.append(f"  {e.qname:<{width}}  {shape:<11} {ltxt}{arrow}")
            lines.extend(edge_detail(e, doc, S, nodes, edges, indent=" " * (4 + 3)))
            if expand_paths and e.path_d:
                lines.append(f"{' ' * 7}{S.sub} d: {e.path_d}")

    # ---- 未歸類元素 -------------------------------------------------------- #
    others = [e for e in doc.rendered()
              if e.role in ("unknown", "decoration") and e.tag != "text"]
    unsupported = [e for e in doc.rendered() if not e.supported]
    if others or unsupported:
        lines.append("")
        lines.append("unclassified")
        for e in others:
            bb = e.bbox.fmt() if e.bbox else "?"
            lines.append(f"  {e.role:<11} {e.qname}  <{e.tag}>  bbox={bb}  "
                         f"{S.warn} 角色不明,normalize 需人工確認")
        for e in unsupported:
            lines.append(f"  unsupported {e.qname}  <{e.tag}>  {S.warn} 本工具不解析此元素")

    # ---- layout ------------------------------------------------------------ #
    lines.append("")
    lines.append("layout")
    lines.extend(layout_lines(nodes, S))

    return lines


def node_lines(n: El, doc: SvgDoc, S: Sym, indent: str) -> list[str]:
    out = [f"{indent}node {n.qname:<24} bbox={n.bbox.fmt()}"]
    lab = label_of(n, doc)
    if lab is None or lab.bbox is None:
        out.append(f"{indent}  (no label)")
        return out
    est = {"exact": "", "subst": f" (subst. {lab.text_font})", "est": " (est.)"}[lab.text_source]
    size = f"{num(lab.font_size)}px"
    padl = lab.bbox.x - n.bbox.x
    padr = n.bbox.x2 - lab.bbox.x2
    padt = lab.bbox.y - n.bbox.y
    padb = n.bbox.y2 - lab.bbox.y2
    over = []
    if padl < 0:
        over.append(f"L by {num(-padl)}px")
    if padr < 0:
        over.append(f"R by {num(-padr)}px")
    if padt < 0:
        over.append(f"T by {num(-padt)}px")
    if padb < 0:
        over.append(f"B by {num(-padb)}px")
    if over:
        state = f"{S.warn} overflow " + ", ".join(over)
    elif min(padl, padr) < MIN_PADDING:
        state = f"{S.warn} tight (pad L{num(padl)} R{num(padr)}, min {num(MIN_PADDING)})"
    else:
        state = f"fits {S.ok} (pad L{num(padl)} R{num(padr)})"
    out.append(f'{indent}  label "{lab.text}"  w={num(lab.bbox.w)}px{est}  {size}  {state}')
    return out


def edge_detail(e: El, doc: SvgDoc, S: Sym, nodes: list[El], edges: list[El],
                indent: str) -> list[str]:
    out: list[str] = []
    if e.endpoints:
        (sx, sy), (tx, ty) = e.endpoints
        parts = []
        for who, pt, node in (("source", (sx, sy), e.edge_from), ("target", (tx, ty), e.edge_to)):
            if node is None or node.bbox is None:
                parts.append(f"{who} unattached {S.warn}")
                continue
            d = dist_point_to_box(node.bbox, pt[0], pt[1])
            if abs(d) <= ENDPOINT_OK:
                parts.append(f"{who} {num(abs(d))}px {S.ok}")
            elif d > 0:
                parts.append(f"{who} {num(d)}px {S.warn} (not touching)")
            else:
                parts.append(f"{who} -{num(-d)}px {S.warn} (overlaps node)")
        out.append(f"{indent}{S.sub} endpoint gap: " + "  ".join(parts))
    t = turns_of(e)
    if t > 2:
        out.append(f"{indent}{S.sub} {t} turns {S.warn} (>2 折,建議重排節點)")
    if e.edge_label and e.edge_label.bbox:
        lb = e.edge_label.bbox
        on_line = any(seg_intersects_box(e.polypoints[i], e.polypoints[i + 1], lb)
                      for i in range(len(e.polypoints) - 1))
        if on_line:
            out.append(f"{indent}{S.sub} label overlaps edge path {S.warn}")
    for n in nodes:
        if n is e.edge_from or n is e.edge_to or n.bbox is None:
            continue
        if any(seg_intersects_box(e.polypoints[i], e.polypoints[i + 1], n.bbox)
               for i in range(len(e.polypoints) - 1)):
            out.append(f"{indent}{S.sub} crosses {n.qname} bbox {S.warn}")
    return out


def layout_lines(nodes: list[El], S: Sym) -> list[str]:
    out: list[str] = []
    if not nodes:
        return ["  (no nodes)"]
    cols = cluster([n.bbox.x for n in nodes])
    rows = cluster([n.bbox.y for n in nodes])

    def axis_line(name: str, groups: list[list[float]], size_of) -> str:
        starts = [g[0] for g in groups]
        sizes = [max(size_of(v) for v in g) for g in groups]
        gs = gaps(starts, sizes)
        gtxt = "/".join(num(g) for g in gs) if gs else "-"
        uniform = (len(set(round(g, 1) for g in gs)) <= 1) if gs else True
        return (f"  {name:<7} {', '.join(num(s) for s in starts)}"
                f"   ({len(groups)} {'cols' if name == 'column x:' else 'rows'}, "
                f"gap {gtxt} {S.ok if uniform else S.warn})")

    def w_at(x):
        return max((n.bbox.w for n in nodes if abs(n.bbox.x - x) < 6), default=0)

    def h_at(y):
        return max((n.bbox.h for n in nodes if abs(n.bbox.y - y) < 6), default=0)

    out.append(axis_line("column x:", cols, w_at))
    out.append(axis_line("row    y:", rows, h_at))

    for dim, vals in (("widths", [n.bbox.w for n in nodes]), ("heights", [n.bbox.h for n in nodes])):
        groups: dict[float, int] = {}
        for v in vals:
            key = next((k for k in groups if abs(k - v) < 0.5), v)
            groups[key] = groups.get(key, 0) + 1
        desc = ", ".join(f"{num(k)} x{v}" for k, v in sorted(groups.items()))
        mark = f"{S.ok} uniform" if len(groups) == 1 else f"{S.warn} {len(groups)} distinct"
        out.append(f"  node {dim}:  {desc}  {mark}")
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="inspect.py",
        description="輸出 SVG 架構圖的 scene digest:絕對 bbox、標籤實測寬度、"
                    "edge 拓撲、對齊與間距關係。",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="範例:\n"
               "  uv run inspect.py diagram.svg\n"
               "  uv run inspect.py diagram.svg --expand-paths   # 展開 path 的 d\n",
    )
    ap.add_argument("svg", type=FsPath, help="輸入的 SVG 檔")
    ap.add_argument("--expand-paths", action="store_true",
                    help="展開 path 的 d 描述(預設只顯示 bbox 與轉折數)")
    ap.add_argument("--ascii", action="store_true", help="改用純 ASCII 符號輸出")
    ap.add_argument("--font-dir", type=FsPath, action="append", default=[],
                    help="額外的字型搜尋目錄(可重複)")
    args = ap.parse_args(argv)

    ascii_mode = setup_stdout(args.ascii)
    S = Sym(ascii_mode)
    if not args.svg.exists():
        print(f"{S.err} 找不到檔案:{args.svg}")
        return 2

    measurer = TextMeasurer(extra_font_dirs=list(args.font_dir))
    doc = SvgDoc(args.svg, measurer)
    infer_roles(doc)

    shaped = [e for e in doc.rendered()
              if e.tag in ("rect", "circle", "ellipse", "line", "polyline", "polygon",
                           "path", "text")]
    missing = [e for e in shaped if not e.el_id]
    unannotated = [e for e in shaped if not e.elem.get("data-role")]

    for line in digest(doc, S, args.expand_paths):
        print(line)

    notes: list[str] = []
    if missing:
        notes.append(f"{len(missing)} 個元素沒有 id — 先跑 "
                     f"`uv run normalize.py {args.svg.name} --in-place` 再回來 inspect;"
                     f"本次輸出以 <tag> 暫代,多輪對話中會漂移,不可作為修改依據")
    elif unannotated:
        notes.append(f"{len(unannotated)} 個元素沒有 data-role,以上角色為啟發式推論結果;"
                     f"跑 normalize.py 固化後推論才穩定")
    if measurer.missing_families:
        fams = ", ".join(sorted(measurer.missing_families))
        subs = ", ".join(f"{a} {S.arrow} {b}" for a, b in sorted(doc.substitutions))
        notes.append(f"本機找不到宣告的字型:{fams};已用替代字型實測({subs or '無'})。"
                     f"標記 (subst.) 者寬度為替代字型的真實 advance,與實際上台環境可能有差異;"
                     f"標記 (est.) 者為逐字元分類估算值。可用 --font-dir 指定字型目錄")
    for w in doc.warnings:
        notes.append(w)
    if notes:
        print()
        print("notes")
        for n in notes:
            print(f"  {S.warn} {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
