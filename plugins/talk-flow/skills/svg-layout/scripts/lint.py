#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["svgelements>=1.9", "fonttools>=4.50", "pypinyin>=0.53"]
# ///
"""lint.py — 架構圖排版診斷。

每條 diagnostic 都含:嚴重度、涉及元素 id、問題描述、量化偏差值、建議修正方向
(只描述不執行)。規則可個別關閉,容差可調。

用法:
  uv run lint.py diagram.svg
  uv run lint.py diagram.svg --format json
  uv run lint.py diagram.svg --disable edge-crossing,aspect-ratio
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path as FsPath

from _core import (
    El, Sym, SvgDoc, TextMeasurer, dist_point_to_box, infer_roles, num,
    seg_intersects_box, seg_seg_intersect, setup_stdout,
)

RULES = [
    "text-overflow", "insufficient-padding", "presentation-tiny-text", "low-contrast",
    "edge-endpoint-gap", "edge-crosses-node", "edge-label-overlap", "arrow-missing",
    "edge-crossing", "inconsistent-node-size", "inconsistent-spacing", "near-alignment",
    "viewbox-overflow", "margin-violation", "aspect-ratio",
]

DEFAULTS = {
    "min-padding": 12.0,        # 標籤與 node 邊界的最小間距
    "min-font-size": 16.0,      # 以 1280x720 換算的投影可讀下限
    "endpoint-tol": 1.5,        # 連線端點可接受的貼合誤差
    "endpoint-pierce": 2.0,     # 允許穿入 node 的深度
    "near-align": 4.0,          # 0 < Δ < 此值 視為對齊 bug
    "size-tol": 0.20,           # 同層 node 尺寸差異比例上限
    "spacing-tol": 4.0,         # 同列/行間距不一致容差
    "margin": 24.0,             # 安全邊距
    "contrast": 4.5,            # WCAG AA
}


@dataclass
class Diag:
    rule: str
    severity: str               # error | warning | info
    elements: list[str]
    message: str
    measured: str
    suggestion: str
    extra: dict = field(default_factory=dict)


# --------------------------------------------------------------------------- #
# 顏色 / 對比
# --------------------------------------------------------------------------- #
NAMED = {
    "white": (255, 255, 255), "black": (0, 0, 0), "red": (255, 0, 0),
    "green": (0, 128, 0), "blue": (0, 0, 255), "gray": (128, 128, 128),
    "grey": (128, 128, 128), "silver": (192, 192, 192), "navy": (0, 0, 128),
    "orange": (255, 165, 0), "yellow": (255, 255, 0), "purple": (128, 0, 128),
    "teal": (0, 128, 128), "lime": (0, 255, 0), "maroon": (128, 0, 0),
}


def parse_color(raw: str | None) -> tuple[int, int, int] | None:
    if not raw:
        return None
    s = raw.strip().lower()
    if s in ("none", "transparent", "currentcolor", "inherit"):
        return None
    if s in NAMED:
        return NAMED[s]
    m = re.fullmatch(r"#([0-9a-f]{3})", s)
    if m:
        return tuple(int(c * 2, 16) for c in m.group(1))  # type: ignore[return-value]
    m = re.fullmatch(r"#([0-9a-f]{6})", s)
    if m:
        h = m.group(1)
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    m = re.match(r"rgba?\(([^)]+)\)", s)
    if m:
        parts = [p.strip() for p in m.group(1).split(",")[:3]]
        try:
            return tuple(int(float(p.rstrip("%")) * (2.55 if p.endswith("%") else 1))
                         for p in parts)  # type: ignore[return-value]
        except ValueError:
            return None
    return None


def luminance(rgb: tuple[int, int, int]) -> float:
    def ch(c: float) -> float:
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# --------------------------------------------------------------------------- #
# 規則
# --------------------------------------------------------------------------- #
def run_rules(doc: SvgDoc, cfg: dict, enabled: set[str]) -> list[Diag]:
    out: list[Diag] = []
    nodes = [e for e in doc.rendered() if e.role == "node" and e.bbox]
    edges = [e for e in doc.rendered() if e.role == "edge"]
    labels = [e for e in doc.rendered() if e.role == "label" and e.bbox]
    vb = doc.viewbox
    scale = max(vb.w / 1280.0, 0.0001)

    def on(rule: str) -> bool:
        return rule in enabled

    label_owner = {id(l): l.owner for l in labels}

    # ---- 文字與可讀性 --------------------------------------------------- #
    for lab in labels:
        # 字級過小與 node/container 無關,所有標籤(含邊標籤)都要查
        if on("presentation-tiny-text"):
            eff = lab.font_size / scale
            if eff < cfg["min-font-size"]:
                out.append(Diag(
                    "presentation-tiny-text", "warning", [lab.el_id or "?"],
                    f'標籤 "{lab.text}" 在投影時過小',
                    f"font-size {num(lab.font_size)}px,換算 1280x720 畫布後等效 "
                    f"{num(eff)}px,低於 {num(cfg['min-font-size'])}px",
                    f"字級提高到 {num(cfg['min-font-size'] * scale)}px 以上"))

        owner = label_owner[id(lab)]
        if owner is None or owner.bbox is None or owner.role not in ("node", "container"):
            continue
        ob, lb = owner.bbox, lab.bbox
        over = {"left": ob.x - lb.x, "right": lb.x2 - ob.x2,
                "top": ob.y - lb.y, "bottom": lb.y2 - ob.y2}
        hits = {k: v for k, v in over.items() if v > 0.5}
        if hits and on("text-overflow"):
            worst = max(hits.values())
            need = num(ob.w + 2 * worst + 2 * cfg["min-padding"])
            dirs = ", ".join(f"{k} {num(v)}px" for k, v in hits.items())
            out.append(Diag(
                "text-overflow", "error", [owner.el_id or "?", lab.el_id or "?"],
                f'標籤 "{lab.text}" 超出 {owner.qname} 邊界',
                f"溢出 {dirs};標籤寬 {num(lb.w)}px,node 寬 {num(ob.w)}px"
                + {"exact": "", "subst": f"(以替代字型 {lab.text_font} 實測)",
                   "est": "(字型缺失,寬度為估算值)"}[lab.text_source],
                f"將 {owner.qname} 寬度增至 {need}px,或縮短標籤文字,"
                f"或降低字級至 {num(lab.font_size * ob.w / max(lb.w, 1) * 0.85)}px 以下",
                {"overflow": {k: round(v, 1) for k, v in hits.items()}}))
        elif on("insufficient-padding"):
            padl, padr = lb.x - ob.x, ob.x2 - lb.x2
            pad = min(padl, padr)
            if 0 <= pad < cfg["min-padding"] - 0.05:      # 容忍浮點誤差,剛好達標不誤報
                out.append(Diag(
                    "insufficient-padding", "warning", [owner.el_id or "?", lab.el_id or "?"],
                    f'標籤 "{lab.text}" 與 {owner.qname} 邊界太擠',
                    f"左右內距 L{num(padl)}px R{num(padr)}px,低於 {num(cfg['min-padding'])}px",
                    f"將 {owner.qname} 寬度增至 "
                    f"{num(lb.w + 2 * cfg['min-padding'])}px 以上"))

        if on("low-contrast") and owner.role in ("node", "container"):
            fg = parse_color(lab.style.get("fill"))
            bg = parse_color(owner.style.get("fill"))
            if fg and bg:
                cr = contrast_ratio(fg, bg)
                if cr < cfg["contrast"]:
                    out.append(Diag(
                        "low-contrast", "warning", [lab.el_id or "?", owner.el_id or "?"],
                        f'標籤 "{lab.text}" 與 {owner.qname} 底色對比不足',
                        f"對比度 {cr:.2f}:1,未達 WCAG AA 的 {cfg['contrast']}:1",
                        "調深/調淺標籤色或 node 填色,投影環境建議對比 ≥ 4.5:1"))

    # ---- 連線品質 -------------------------------------------------------- #
    directed = [e for e in edges if e.directed]
    if on("arrow-missing") and directed and len(directed) < len(edges):
        for e in edges:
            if not e.directed:
                out.append(Diag(
                    "arrow-missing", "warning", [e.el_id or "?"],
                    f"{e.qname} 缺少箭頭 marker,與其他邊不一致",
                    f"全圖 {len(edges)} 條邊中 {len(directed)} 條有箭頭,本條沒有",
                    "補上 marker-end;若本條刻意為無向邊,請在設計文件說明"))

    for e in edges:
        if on("edge-endpoint-gap") and e.endpoints:
            for who, pt, node in (("起點", e.endpoints[0], e.edge_from),
                                  ("終點", e.endpoints[1], e.edge_to)):
                if node is None or node.bbox is None:
                    out.append(Diag(
                        "edge-endpoint-gap", "warning", [e.el_id or "?"],
                        f"{e.qname} 的{who}沒有連到任何 node",
                        f"端點 ({num(pt[0])},{num(pt[1])}) 附近找不到 node 邊界",
                        "把端點移到目標 node 邊界上,並在 normalize 後確認 "
                        "data-from/data-to 正確"))
                    continue
                d = dist_point_to_box(node.bbox, pt[0], pt[1])
                if d > cfg["endpoint-tol"]:
                    out.append(Diag(
                        "edge-endpoint-gap", "error", [e.el_id or "?", node.el_id or "?"],
                        f"{e.qname} 的{who}與 {node.qname} 邊界有間隙",
                        f"間隙 {num(d)}px(容差 {num(cfg['endpoint-tol'])}px)",
                        f"把{who}移到 {node.qname} 邊界上(貼齊後間隙 0px)"))
                elif -d > cfg["endpoint-pierce"]:
                    out.append(Diag(
                        "edge-endpoint-gap", "warning", [e.el_id or "?", node.el_id or "?"],
                        f"{e.qname} 的{who}穿入 {node.qname} 內部",
                        f"穿入 {num(-d)}px,超過容許的 {num(cfg['endpoint-pierce'])}px",
                        f"把{who}退回 {node.qname} 邊界"))

        if on("edge-crosses-node"):
            for n in nodes:
                if n is e.edge_from or n is e.edge_to or n.bbox is None:
                    continue
                if any(seg_intersects_box(e.polypoints[i], e.polypoints[i + 1], n.bbox)
                       for i in range(len(e.polypoints) - 1)):
                    out.append(Diag(
                        "edge-crosses-node", "error", [e.el_id or "?", n.el_id or "?"],
                        f"{e.qname} 穿過不相干的 {n.qname}",
                        f"線段與 {n.qname} bbox={n.bbox.fmt()} 相交",
                        f"改走正交繞線避開 {n.qname},或重排節點位置讓連線有直達路徑"))

        if on("edge-label-overlap") and e.edge_label and e.edge_label.bbox:
            lb = e.edge_label.bbox
            if any(seg_intersects_box(e.polypoints[i], e.polypoints[i + 1], lb)
                   for i in range(len(e.polypoints) - 1)):
                out.append(Diag(
                    "edge-label-overlap", "warning",
                    [e.edge_label.el_id or "?", e.el_id or "?"],
                    f'邊標籤 "{e.edge_label.text}" 壓在 {e.qname} 線段上',
                    f"標籤 bbox={lb.fmt()} 與線段相交",
                    "把標籤平移到線段一側(垂直偏移約 "
                    f"{num(lb.h * 0.8 + 4)}px),或加白底襯墊"))
            for other in nodes:
                if other.bbox and other.bbox.intersects(lb) and other is not e.edge_from \
                        and other is not e.edge_to:
                    out.append(Diag(
                        "edge-label-overlap", "warning",
                        [e.edge_label.el_id or "?", other.el_id or "?"],
                        f'邊標籤 "{e.edge_label.text}" 壓到 {other.qname}',
                        f"標籤 bbox={lb.fmt()} 與 node bbox={other.bbox.fmt()} 重疊",
                        f"將標籤移離 {other.qname}"))

    if on("edge-crossing"):
        seen: set[tuple[str, str]] = set()
        for i, a in enumerate(edges):
            for b in edges[i + 1:]:
                key = tuple(sorted((a.el_id or str(i), b.el_id or "?")))
                if key in seen:
                    continue
                crossed = False
                for m in range(len(a.polypoints) - 1):
                    for n2 in range(len(b.polypoints) - 1):
                        if seg_seg_intersect(a.polypoints[m], a.polypoints[m + 1],
                                             b.polypoints[n2], b.polypoints[n2 + 1]):
                            crossed = True
                            break
                    if crossed:
                        break
                if crossed:
                    seen.add(key)
                    out.append(Diag(
                        "edge-crossing", "warning", [a.el_id or "?", b.el_id or "?"],
                        f"{a.qname} 與 {b.qname} 交叉",
                        "兩條邊的線段實際相交",
                        "調整節點順序或改走繞線讓兩線分開;確實無法避免時加跨線符號"))

    # ---- 版面一致性 ------------------------------------------------------ #
    if on("inconsistent-node-size"):
        by_layer: dict[str, list[El]] = {}
        for n in nodes:
            key = n.elem.get("data-layer") or f"row@{round(n.bbox.cy / 40)}"
            by_layer.setdefault(key, []).append(n)
        for key, group in by_layer.items():
            if len(group) < 2:
                continue
            for dim, get in (("寬", lambda e: e.bbox.w), ("高", lambda e: e.bbox.h)):
                vals = [get(n) for n in group]
                lo, hi = min(vals), max(vals)
                if hi - lo < 0.5:
                    continue
                diff = (hi - lo) / hi
                sev = "warning" if diff < cfg["size-tol"] else "info"
                hint = "差距很小,多半是手誤而非刻意" if diff < cfg["size-tol"] else "差距明顯,確認是否刻意"
                out.append(Diag(
                    "inconsistent-node-size", sev,
                    [n.el_id or "?" for n in group],
                    f"同層 ({key}) node {dim}度不一致",
                    f"{dim} {num(lo)}–{num(hi)}px,差距 {diff * 100:.1f}%({hint})",
                    f"統一為 {num(hi)}px(以最大者為準)或改用能容納最長標籤的寬度"))

    if on("inconsistent-spacing"):
        for axis, key, size in (("列", lambda e: e.bbox.cy, lambda e: e.bbox.h),
                                ("行", lambda e: e.bbox.cx, lambda e: e.bbox.w)):
            groups: dict[int, list[El]] = {}
            for n in nodes:
                groups.setdefault(int(round(key(n) / 40)), []).append(n)
            for gk, group in groups.items():
                if len(group) < 3:
                    continue
                pos = sorted(group, key=lambda e: e.bbox.x if axis == "列" else e.bbox.y)
                gaps = []
                for i in range(1, len(pos)):
                    prev, cur = pos[i - 1], pos[i]
                    gaps.append((cur.bbox.x - prev.bbox.x2) if axis == "列"
                                else (cur.bbox.y - prev.bbox.y2))
                if max(gaps) - min(gaps) > cfg["spacing-tol"]:
                    out.append(Diag(
                        "inconsistent-spacing", "warning",
                        [n.el_id or "?" for n in pos],
                        f"同{axis}相鄰間距不一致",
                        f"間距序列 {', '.join(num(g) for g in gaps)}px,"
                        f"最大差 {num(max(gaps) - min(gaps))}px(容差 {num(cfg['spacing-tol'])}px)",
                        f"統一為 {num(sum(gaps) / len(gaps))}px 或以最常見值對齊"))
            _ = gk if groups else None

    if on("near-alignment"):
        boxed = [e for e in doc.rendered()
                 if e.role in ("node", "container") and e.bbox is not None]
        for i, a in enumerate(boxed):
            for b in boxed[i + 1:]:
                # 同一對元素的多條邊差同一個值時只報一次(通常是整體位移,不是六個 bug)
                hits = [(name, abs(va - vb2)) for name, va, vb2 in (
                    ("左緣", a.bbox.x, b.bbox.x), ("右緣", a.bbox.x2, b.bbox.x2),
                    ("上緣", a.bbox.y, b.bbox.y), ("下緣", a.bbox.y2, b.bbox.y2),
                    ("水平中線", a.bbox.cy, b.bbox.cy), ("垂直中線", a.bbox.cx, b.bbox.cx),
                ) if 0 < abs(va - vb2) < cfg["near-align"]]
                if not hits:
                    continue
                names = "、".join(n for n, _ in hits)
                worst = max(d for _, d in hits)
                axis = "垂直" if any(n in ("上緣", "下緣", "水平中線") for n, _ in hits) else "水平"
                out.append(Diag(
                    "near-alignment", "warning", [a.el_id or "?", b.el_id or "?"],
                    f"{a.qname} 與 {b.qname} 的{names}差一點點對齊",
                    f"差距 {'、'.join(num(d) for _, d in hits)}px"
                    f"(0 < Δ < {num(cfg['near-align'])}px,幾乎確定是 bug 而非設計)",
                    f"把兩者在{axis}方向對齊(位移 {num(worst)}px 即可齊平)"))

    if on("viewbox-overflow"):
        for e in doc.rendered():
            if e.bbox is None or e.role not in ("node", "container", "edge", "label"):
                continue
            b = e.bbox
            if b.x < vb.x - 0.5 or b.y < vb.y - 0.5 or b.x2 > vb.x2 + 0.5 or b.y2 > vb.y2 + 0.5:
                out.append(Diag(
                    "viewbox-overflow", "error", [e.el_id or "?"],
                    f"{e.qname} 超出 viewBox",
                    f"bbox={b.fmt()},viewBox={vb.fmt()}",
                    "把元素移回畫布內,或放大 viewBox(放大會讓其他元素相對變小)"))

    if on("margin-violation"):
        m = cfg["margin"]
        for e in doc.rendered():
            if e.bbox is None or e.role not in ("node", "container", "label"):
                continue
            b = e.bbox
            if b.x < vb.x - 0.5 or b.x2 > vb.x2 + 0.5:
                continue
            d = min(b.x - vb.x, vb.x2 - b.x2, b.y - vb.y, vb.y2 - b.y2)
            if 0 <= d < m:
                out.append(Diag(
                    "margin-violation", "info", [e.el_id or "?"],
                    f"{e.qname} 太貼近畫布邊緣",
                    f"最小邊距 {num(d)}px,低於安全邊距 {num(m)}px",
                    f"內縮至距邊 {num(m)}px 以上(投影時邊緣容易被裁切)"))

    if on("aspect-ratio"):
        r = vb.w / vb.h if vb.h else 0
        best = min((abs(r - a / b), f"{a}:{b}") for a, b in ((16, 9), (4, 3)))
        if best[0] > 0.08:
            out.append(Diag(
                "aspect-ratio", "info", ["<svg>"],
                "viewBox 比例偏離常見簡報比例",
                f"目前 {vb.w:g}x{vb.h:g} = {r:.2f}:1,最接近的 {best[1]} 差 {best[0]:.2f}",
                f"改成 {best[1]} 比例,嵌入投影片時不會留下不對稱留白"))

    order = {"error": 0, "warning": 1, "info": 2}
    out.sort(key=lambda d: (order[d.severity], d.rule))
    return out


# --------------------------------------------------------------------------- #
# 輸出
# --------------------------------------------------------------------------- #
def print_text(diags: list[Diag], doc: SvgDoc, path: FsPath, S: Sym,
               measurer: TextMeasurer) -> None:
    counts = {k: sum(1 for d in diags if d.severity == k) for k in ("error", "warning", "info")}
    print(f"{path.name}:{counts['error']} error / {counts['warning']} warning / "
          f"{counts['info']} info")
    if not diags:
        print(f"{S.ok} 沒有發現排版問題")
    icon = {"error": S.err, "warning": S.warn, "info": "i"}
    last = None
    for d in diags:
        if d.severity != last:
            print()
            last = d.severity
        print(f"{icon[d.severity]} [{d.rule}] {', '.join('#' + e for e in d.elements)}")
        print(f"    {d.message}")
        print(f"    量測:{d.measured}")
        print(f"    建議:{d.suggestion}")
    notes = []
    shaped = [e for e in doc.rendered() if e.tag in ("rect", "circle", "ellipse", "line",
                                                     "polyline", "polygon", "path", "text")]
    if any(not e.el_id for e in shaped):
        notes.append("有元素沒有 id,診斷中的識別碼不穩定 — 先跑 normalize.py")
    if measurer.missing_families:
        subs = ", ".join(f"{a} {S.arrow} {b}" for a, b in sorted(doc.substitutions))
        notes.append(f"本機找不到宣告字型({', '.join(sorted(measurer.missing_families))}),"
                     f"文字診斷改用替代字型實測({subs or '估算值'})")
    if notes:
        print()
        for n in notes:
            print(f"{S.warn} {n}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="lint.py",
        description="診斷 SVG 架構圖的排版問題(文字可讀性、連線品質、版面一致性)。",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="規則清單:\n  " + "\n  ".join(RULES) + "\n\n"
               "範例:\n"
               "  uv run lint.py diagram.svg\n"
               "  uv run lint.py diagram.svg --format json\n"
               "  uv run lint.py diagram.svg --disable edge-crossing --min-padding 16\n",
    )
    ap.add_argument("svg", type=FsPath, help="輸入的 SVG 檔")
    ap.add_argument("--format", choices=("text", "json"), default="text", help="輸出格式")
    ap.add_argument("--disable", default="", help="關閉的規則,逗號分隔")
    ap.add_argument("--only", default="", help="只跑這些規則,逗號分隔")
    ap.add_argument("--ascii", action="store_true", help="改用純 ASCII 符號輸出")
    ap.add_argument("--font-dir", type=FsPath, action="append", default=[],
                    help="額外的字型搜尋目錄(可重複)")
    for key, val in DEFAULTS.items():
        ap.add_argument(f"--{key}", type=float, default=val,
                        help=f"容差:{key}(預設 {val})")
    args = ap.parse_args(argv)

    ascii_mode = setup_stdout(args.ascii)
    S = Sym(ascii_mode)
    if not args.svg.exists():
        print(f"{S.err} 找不到檔案:{args.svg}")
        return 2

    enabled = set(RULES)
    if args.only:
        enabled = {r.strip() for r in args.only.split(",") if r.strip()}
    if args.disable:
        enabled -= {r.strip() for r in args.disable.split(",") if r.strip()}
    unknown = enabled - set(RULES)
    if unknown:
        print(f"{S.err} 未知規則:{', '.join(sorted(unknown))}")
        return 2

    cfg = {k: getattr(args, k.replace("-", "_")) for k in DEFAULTS}
    measurer = TextMeasurer(extra_font_dirs=list(args.font_dir))
    doc = SvgDoc(args.svg, measurer)
    infer_roles(doc)
    diags = run_rules(doc, cfg, enabled)

    if args.format == "json":
        print(json.dumps({
            "file": str(args.svg),
            "summary": {k: sum(1 for d in diags if d.severity == k)
                        for k in ("error", "warning", "info")},
            "fontMetricsExact": not measurer.missing_families,
            "diagnostics": [asdict(d) for d in diags],
        }, ensure_ascii=False, indent=2))
    else:
        print_text(diags, doc, args.svg, S, measurer)

    return 1 if any(d.severity == "error" for d in diags) else 0


if __name__ == "__main__":
    raise SystemExit(main())
