"""svg-layout 共用核心:文件模型、絕對幾何、字型度量、角色推論、語意化 ID。

設計要點:
- XML 結構用 ElementTree 自行走訪(normalize 需要寫回屬性,必須保有 1:1 的
  元素對應);路徑幾何與 transform 字串解析交給 svgelements,不自己寫 parser。
- 文字寬度一律用 fontTools 量真實 advance;量不到才退回估算,並標記 exact=False。
- 角色推論只在元素沒有 data-role 時執行;有標註一律以標註為準。
"""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path as FsPath

from svgelements import Matrix
from svgelements import Path as SvgPath

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"

SUPPORTED_TAGS = {
    "svg", "g", "rect", "circle", "ellipse", "line", "polyline", "polygon",
    "path", "text", "tspan", "use", "marker",
}
# 這些容器不參與版面(僅供引用)
NON_RENDERED = {"defs", "marker", "symbol", "clipPath", "mask", "linearGradient",
                "radialGradient", "pattern", "filter", "style", "title", "desc", "metadata"}

SHAPE_TAGS = {"rect", "circle", "ellipse", "line", "polyline", "polygon", "path"}
BOX_SHAPES = {"rect", "circle", "ellipse", "polygon"}
LINE_SHAPES = {"path", "line", "polyline"}

INHERITED_PROPS = (
    "font-size", "font-family", "font-weight", "fill", "stroke", "stroke-width",
    "stroke-dasharray", "text-anchor", "dominant-baseline", "alignment-baseline",
    "letter-spacing", "opacity",
)


# --------------------------------------------------------------------------- #
# 基本幾何
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class Box:
    x: float
    y: float
    w: float
    h: float

    @property
    def x2(self) -> float:
        return self.x + self.w

    @property
    def y2(self) -> float:
        return self.y + self.h

    @property
    def cx(self) -> float:
        return self.x + self.w / 2

    @property
    def cy(self) -> float:
        return self.y + self.h / 2

    def contains_point(self, px: float, py: float, tol: float = 0.0) -> bool:
        return (self.x - tol <= px <= self.x2 + tol) and (self.y - tol <= py <= self.y2 + tol)

    def contains_box(self, other: "Box", tol: float = 0.5) -> bool:
        return (self.x - tol <= other.x and self.y - tol <= other.y
                and self.x2 + tol >= other.x2 and self.y2 + tol >= other.y2)

    def intersects(self, other: "Box", tol: float = 0.0) -> bool:
        return not (other.x > self.x2 + tol or other.x2 < self.x - tol
                    or other.y > self.y2 + tol or other.y2 < self.y - tol)

    def union(self, other: "Box") -> "Box":
        x = min(self.x, other.x)
        y = min(self.y, other.y)
        return Box(x, y, max(self.x2, other.x2) - x, max(self.y2, other.y2) - y)

    def fmt(self) -> str:
        return f"({num(self.x)},{num(self.y)},{num(self.w)},{num(self.h)})"


def num(v: float) -> str:
    """數值格式化:整數不留小數,其餘留一位。"""
    if v is None:
        return "?"
    r = round(float(v), 1)
    return str(int(r)) if abs(r - int(r)) < 1e-9 else str(r)


def transform_point(m: Matrix, x: float, y: float) -> tuple[float, float]:
    return (m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f)


def box_from_corners(m: Matrix, x: float, y: float, w: float, h: float) -> Box:
    pts = [transform_point(m, x, y), transform_point(m, x + w, y),
           transform_point(m, x, y + h), transform_point(m, x + w, y + h)]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return Box(min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))


def dist(ax: float, ay: float, bx: float, by: float) -> float:
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


def dist_point_to_box(box: Box, px: float, py: float) -> float:
    """點到矩形邊界的距離;點在內部時回傳負值(穿入深度)。"""
    dx = max(box.x - px, 0.0, px - box.x2)
    dy = max(box.y - py, 0.0, py - box.y2)
    if dx == 0.0 and dy == 0.0:
        inside = min(px - box.x, box.x2 - px, py - box.y, box.y2 - py)
        return -inside
    return (dx * dx + dy * dy) ** 0.5


def seg_intersects_box(p1: tuple[float, float], p2: tuple[float, float], box: Box) -> bool:
    """線段是否穿過矩形(Liang-Barsky)。"""
    x1, y1 = p1
    x2, y2 = p2
    dx, dy = x2 - x1, y2 - y1
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x1 - box.x), (dx, box.x2 - x1), (-dy, y1 - box.y), (dy, box.y2 - y1)):
        if p == 0:
            if q < 0:
                return False
        else:
            t = q / p
            if p < 0:
                if t > t1:
                    return False
                t0 = max(t0, t)
            else:
                if t < t0:
                    return False
                t1 = min(t1, t)
    return t0 <= t1


def seg_seg_intersect(a1, a2, b1, b2) -> bool:
    """兩線段是否真正交叉(共端點不算)。"""
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    for p in (a1, a2):
        for q in (b1, b2):
            if dist(p[0], p[1], q[0], q[1]) < 1e-6:
                return False
    d1, d2 = cross(b1, b2, a1), cross(b1, b2, a2)
    d3, d4 = cross(a1, a2, b1), cross(a1, a2, b2)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))


# --------------------------------------------------------------------------- #
# 字型度量
# --------------------------------------------------------------------------- #
CJK_RANGES = (
    (0x1100, 0x115F), (0x2E80, 0x303E), (0x3041, 0x33FF), (0x3400, 0x4DBF),
    (0x4E00, 0x9FFF), (0xA000, 0xA4CF), (0xAC00, 0xD7A3), (0xF900, 0xFAFF),
    (0xFE30, 0xFE4F), (0xFF00, 0xFF60), (0xFFE0, 0xFFE6), (0x20000, 0x2FA1F),
)


def is_cjk(ch: str) -> bool:
    cp = ord(ch)
    return any(lo <= cp <= hi for lo, hi in CJK_RANGES)


# 無字型檔時的每字元寬度(em 比例),依類別分開算,不用平均字寬
_EST_WIDTH = {
    "cjk": 1.0, "space": 0.28, "digit": 0.55, "upper": 0.66, "lower": 0.52,
    "punct": 0.32, "other": 0.55,
}


def _est_class(ch: str) -> str:
    if is_cjk(ch):
        return "cjk"
    if ch.isspace():
        return "space"
    if ch.isdigit():
        return "digit"
    if ch.isalpha():
        return "upper" if ch.isupper() else "lower"
    if not ch.isalnum():
        return "punct"
    return "other"


FONT_DIRS = [
    FsPath("C:/Windows/Fonts"),
    FsPath.home() / "AppData/Local/Microsoft/Windows/Fonts",
    FsPath("/System/Library/Fonts"), FsPath("/System/Library/Fonts/Supplemental"),
    FsPath("/Library/Fonts"), FsPath.home() / "Library/Fonts",
    FsPath("/usr/share/fonts"), FsPath("/usr/local/share/fonts"),
    FsPath.home() / ".fonts",
]

# 常見 family → 檔名關鍵字(找不到時用檔名比對,避免掃描所有字型的 name table)
FAMILY_HINTS = {
    "notosanstc": ["notosanstc", "notosanscjk", "notosanstc-regular"],
    "notosanssc": ["notosanssc", "notosanscjk"],
    "notosans": ["notosans", "notosans-regular"],
    "pingfangtc": ["pingfang"], "pingfangsc": ["pingfang"], "pingfang": ["pingfang"],
    "microsoftjhenghei": ["msjh", "microsoftjhenghei"],
    "microsoftyahei": ["msyh", "microsoftyahei"],
    "heitisc": ["stheiti", "heiti"], "heititc": ["stheiti", "heiti"],
    "arial": ["arial"], "helvetica": ["helvetica", "arial"],
    "helveticaneue": ["helveticaneue", "helvetica", "arial"],
    "timesnewroman": ["times"], "georgia": ["georgia"],
    "sansserif": ["arial", "helvetica", "notosans", "dejavusans"],
    "serif": ["times", "georgia", "dejavuserif"],
    "monospace": ["menlo", "consola", "dejavusansmono", "couriernew"],
    "menlo": ["menlo"], "consolas": ["consola"], "couriernew": ["courier"],
    "jetbrainsmono": ["jetbrainsmono", "menlo"],
}

# 宣告字型不存在時,用來量 CJK 字元的實際替代字型(依序嘗試)
CJK_FALLBACKS = [
    "PingFang TC", "PingFang SC", "Hiragino Sans GB", "Heiti TC", "STHeiti Light",
    "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans CJK TC", "Noto Sans TC",
    "Songti SC", "SimHei",
]
# 宣告字型不存在時的拉丁字母替代字型
LATIN_FALLBACKS = ["Arial", "Helvetica", "DejaVu Sans", "Liberation Sans", "Verdana"]


def _norm_family(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


class TextMeasurer:
    """以真實 font metrics 量測文字寬度;量不到才估算並標記。"""

    def __init__(self, extra_font_dirs: list[FsPath] | None = None) -> None:
        self._index: dict[str, FsPath] | None = None
        self._fonts: dict[str, object] = {}
        self._extra_dirs = extra_font_dirs or []
        self.missing_families: set[str] = set()

    def _build_index(self) -> dict[str, FsPath]:
        if self._index is not None:
            return self._index
        idx: dict[str, FsPath] = {}
        for d in self._extra_dirs + FONT_DIRS:
            if not d.exists():
                continue
            try:
                for f in d.rglob("*"):
                    if f.suffix.lower() in (".ttf", ".otf", ".ttc", ".otc"):
                        key = _norm_family(f.stem)
                        idx.setdefault(key, f)
            except (OSError, PermissionError):
                continue
        self._index = idx
        return idx

    def _find_font_file(self, family: str) -> FsPath | None:
        idx = self._build_index()
        key = _norm_family(family)
        if key in idx:
            return idx[key]
        for hint in FAMILY_HINTS.get(key, []):
            if hint in idx:
                return idx[hint]
            for k, v in idx.items():
                if k.startswith(hint):
                    return v
        for k, v in idx.items():
            if k.startswith(key) and key:
                return v
        return None

    def _load(self, family: str):
        key = _norm_family(family)
        if key in self._fonts:
            return self._fonts[key]
        font = None
        path = self._find_font_file(family)
        if path is not None:
            try:
                from fontTools.ttLib import TTFont, TTCollection
                if path.suffix.lower() in (".ttc", ".otc"):
                    coll = TTCollection(str(path), lazy=True)
                    font = coll.fonts[0]
                else:
                    font = TTFont(str(path), lazy=True, fontNumber=0)
                font.__dict__["_cmap_cache"] = font.getBestCmap()
                font.__dict__["_upem"] = font["head"].unitsPerEm
                font.__dict__["_hmtx"] = font["hmtx"]
            except Exception:
                font = None
        self._fonts[key] = font
        return font

    def families(self, font_family: str | None) -> list[str]:
        if not font_family:
            return ["sans-serif"]
        return [f.strip().strip('"').strip("'") for f in font_family.split(",") if f.strip()]

    def _advance(self, font, ch: str) -> float | None:
        """單一字元在該字型的 advance(em 比例);字型沒有這個字回 None。"""
        gname = font.__dict__["_cmap_cache"].get(ord(ch))
        if gname is None:
            return None
        try:
            return font.__dict__["_hmtx"][gname][0] / font.__dict__["_upem"]
        except KeyError:
            return None

    def _fallback_font(self, ch: str):
        """替代字型:CJK 與拉丁分開找,找到就回 (font, family)。"""
        pool = CJK_FALLBACKS if is_cjk(ch) else LATIN_FALLBACKS
        for fam in pool:
            key = _norm_family(fam)
            if key in self._fonts and self._fonts[key] is None:
                continue
            font = self._load(fam)
            if font is not None and self._advance(font, ch) is not None:
                return font, fam
        return None, None

    def measure(self, text: str, font_size: float, font_family: str | None,
                letter_spacing: float = 0.0) -> tuple[float, float, float, str, str]:
        """量測文字。

        回傳 (width, ascent, descent, source, used_font):
          source = "exact"(宣告字型實測)/ "subst"(替代字型實測)/ "est"(逐字元估算)
        """
        if not text:
            return (0.0, font_size * 0.8, font_size * 0.2, "exact", "")

        primary = None
        used_family = ""
        for fam in self.families(font_family):
            primary = self._load(fam)
            if primary is not None:
                used_family = fam
                break
            self.missing_families.add(fam)

        total_em = 0.0
        substituted = False
        estimated = False
        subst_family = ""
        for ch in text:
            adv = self._advance(primary, ch) if primary is not None else None
            if adv is None:
                fb, fam = self._fallback_font(ch)
                if fb is not None:
                    adv = self._advance(fb, ch)
                    substituted = True
                    subst_family = subst_family or (fam or "")
            if adv is None:
                adv = _EST_WIDTH[_est_class(ch)]
                estimated = True
            total_em += adv

        width = total_em * font_size + letter_spacing * max(len(text) - 1, 0)

        metric_font = primary
        if metric_font is None:
            fb, fam = self._fallback_font("A")
            metric_font = fb
            used_family = used_family or (fam or "")
        if metric_font is not None:
            try:
                upem = metric_font.__dict__["_upem"]
                hhea = metric_font["hhea"]
                ascent = hhea.ascent / upem * font_size
                descent = abs(hhea.descent) / upem * font_size
            except Exception:
                ascent, descent = font_size * 0.8, font_size * 0.2
        else:
            ascent, descent = font_size * 0.8, font_size * 0.2

        if estimated:
            source = "est"
        elif substituted or primary is None:
            source = "subst"
            used_family = subst_family or used_family
        else:
            source = "exact"
        return (width, ascent, descent, source, used_family)


# --------------------------------------------------------------------------- #
# 文件模型
# --------------------------------------------------------------------------- #
@dataclass
class El:
    elem: ET.Element
    tag: str
    parent: "El | None"
    depth: int
    ctm: Matrix
    style: dict
    children: list["El"] = field(default_factory=list)
    bbox: Box | None = None
    text: str = ""
    text_exact: bool = True
    text_source: str = "exact"      # exact | subst | est
    text_font: str = ""
    font_size: float = 0.0
    endpoints: tuple[tuple[float, float], tuple[float, float]] | None = None
    polypoints: list[tuple[float, float]] = field(default_factory=list)
    seg_count: int = 0
    path_d: str = ""
    supported: bool = True
    role: str | None = None          # 最終角色(data-role 或推論結果)
    role_from_attr: bool = False
    owner: "El | None" = None        # label 歸屬的 node/edge
    edge_from: "El | None" = None
    edge_to: "El | None" = None
    edge_label: "El | None" = None
    directed: bool = False

    @property
    def el_id(self) -> str | None:
        return self.elem.get("id")

    @property
    def qname(self) -> str:
        return f"#{self.el_id}" if self.el_id else f"<{self.tag}>"


def localname(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def parse_style(elem: ET.Element, inherited: dict) -> dict:
    st = dict(inherited)
    raw = elem.get("style", "")
    decls = {}
    for part in raw.split(";"):
        if ":" in part:
            k, v = part.split(":", 1)
            decls[k.strip()] = v.strip()
    for prop in INHERITED_PROPS:
        if elem.get(prop) is not None:
            st[prop] = elem.get(prop)
        if prop in decls:
            st[prop] = decls[prop]
    for prop in ("marker-end", "marker-start"):
        st[prop] = decls.get(prop, elem.get(prop))
    return st


def to_float(v, default: float = 0.0) -> float:
    if v is None:
        return default
    try:
        return float(re.sub(r"(px|pt|em|%)$", "", str(v).strip()))
    except ValueError:
        return default


def font_size_of(style: dict, parent_size: float = 16.0) -> float:
    raw = style.get("font-size")
    if raw is None:
        return parent_size
    s = str(raw).strip()
    if s.endswith("em"):
        return to_float(s, 1.0) * parent_size
    if s.endswith("%"):
        return to_float(s, 100.0) / 100 * parent_size
    return to_float(s, parent_size)


def parse_points(raw: str) -> list[tuple[float, float]]:
    nums = [float(n) for n in re.findall(r"-?\d*\.?\d+(?:e-?\d+)?", raw or "")]
    return list(zip(nums[0::2], nums[1::2]))


class SvgDoc:
    """解析後的 SVG:保有 XML 元素、絕對 bbox 與角色。"""

    def __init__(self, path: FsPath, measurer: TextMeasurer | None = None) -> None:
        self.path = path
        ET.register_namespace("", SVG_NS)
        ET.register_namespace("xlink", XLINK_NS)
        self.tree = ET.parse(str(path))
        self.root_elem = self.tree.getroot()
        self.measurer = measurer or TextMeasurer()
        self.by_id: dict[str, El] = {}
        self.all: list[El] = []
        self.warnings: list[str] = []
        self.substitutions: set[tuple[str, str]] = set()
        self.viewbox = self._parse_viewbox()
        self.root = self._walk(self.root_elem, None, Matrix(), {}, 0)
        self._index()

    # -- 解析 ------------------------------------------------------------- #
    def _parse_viewbox(self) -> Box:
        vb = self.root_elem.get("viewBox")
        if vb:
            n = [float(x) for x in re.findall(r"-?\d*\.?\d+", vb)]
            if len(n) == 4:
                return Box(*n)
        return Box(0, 0, to_float(self.root_elem.get("width"), 1280),
                   to_float(self.root_elem.get("height"), 720))

    def _walk(self, elem: ET.Element, parent: El | None, ctm: Matrix,
              style: dict, depth: int) -> El:
        tag = localname(elem.tag)
        st = parse_style(elem, style)
        tf = elem.get("transform")
        if tf:
            try:
                ctm = Matrix(ctm) * Matrix(tf)
            except Exception:
                self.warnings.append(f"無法解析 transform=\"{tf}\"({tag})")
        el = El(elem=elem, tag=tag, parent=parent, depth=depth, ctm=ctm, style=st)
        el.supported = tag in SUPPORTED_TAGS or tag in NON_RENDERED
        self.all.append(el)
        if tag not in NON_RENDERED or tag == "marker":
            for child in list(elem):
                if localname(child.tag) in NON_RENDERED and localname(child.tag) != "marker":
                    self._walk(child, el, ctm, st, depth + 1)
                    continue
                el.children.append(self._walk(child, el, ctm, st, depth + 1))
        self._measure(el)
        return el

    def _measure(self, el: El) -> None:
        m, tag = el.ctm, el.tag
        if tag == "rect":
            el.bbox = box_from_corners(m, to_float(el.elem.get("x")), to_float(el.elem.get("y")),
                                       to_float(el.elem.get("width")), to_float(el.elem.get("height")))
        elif tag == "circle":
            cx, cy, r = (to_float(el.elem.get("cx")), to_float(el.elem.get("cy")),
                         to_float(el.elem.get("r")))
            el.bbox = box_from_corners(m, cx - r, cy - r, 2 * r, 2 * r)
        elif tag == "ellipse":
            cx, cy = to_float(el.elem.get("cx")), to_float(el.elem.get("cy"))
            rx, ry = to_float(el.elem.get("rx")), to_float(el.elem.get("ry"))
            el.bbox = box_from_corners(m, cx - rx, cy - ry, 2 * rx, 2 * ry)
        elif tag == "line":
            p1 = transform_point(m, to_float(el.elem.get("x1")), to_float(el.elem.get("y1")))
            p2 = transform_point(m, to_float(el.elem.get("x2")), to_float(el.elem.get("y2")))
            el.endpoints = (p1, p2)
            el.polypoints = [p1, p2]
            el.seg_count = 1
            el.bbox = Box(min(p1[0], p2[0]), min(p1[1], p2[1]),
                          abs(p2[0] - p1[0]), abs(p2[1] - p1[1]))
        elif tag in ("polyline", "polygon"):
            pts = [transform_point(m, x, y) for x, y in parse_points(el.elem.get("points", ""))]
            if pts:
                el.polypoints = pts
                el.endpoints = (pts[0], pts[-1])
                el.seg_count = max(len(pts) - 1, 0)
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                el.bbox = Box(min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))
        elif tag == "path":
            d = el.elem.get("d", "")
            el.path_d = d
            try:
                p = SvgPath(d) * m
                bb = p.bbox()
                if bb:
                    el.bbox = Box(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1])
                el.seg_count = max(len(p) - 1, 0)
                el.endpoints = ((float(p.point(0.0).x), float(p.point(0.0).y)),
                                (float(p.point(1.0).x), float(p.point(1.0).y)))
                el.polypoints = [(float(p.point(t / 24).x), float(p.point(t / 24).y))
                                 for t in range(25)]
            except Exception:
                self.warnings.append(f"無法解析 path d(id={el.el_id or '?'})")
        elif tag in ("text", "tspan"):
            self._measure_text(el)
        elif tag == "use":
            href = el.elem.get(f"{{{XLINK_NS}}}href") or el.elem.get("href") or ""
            ref = href.lstrip("#")
            dx, dy = to_float(el.elem.get("x")), to_float(el.elem.get("y"))
            target = None
            for cand in self.all:
                if cand.el_id == ref:
                    target = cand
                    break
            if target is not None and target.bbox is not None:
                b = target.bbox
                el.bbox = Box(b.x + dx, b.y + dy, b.w, b.h)
            else:
                self.warnings.append(f"<use> 指向 #{ref},找不到目標或目標無幾何")
        elif tag in ("g", "svg", "marker"):
            boxes = [c.bbox for c in el.children if c.bbox is not None]
            if boxes:
                acc = boxes[0]
                for b in boxes[1:]:
                    acc = acc.union(b)
                el.bbox = acc

    def _measure_text(self, el: El) -> None:
        own = "".join(el.elem.itertext()).strip()
        el.text = re.sub(r"\s+", " ", own)
        size = font_size_of(el.style, 16.0)
        fam = el.style.get("font-family")
        ls = to_float(el.style.get("letter-spacing"), 0.0)
        w, asc, desc, source, used = self.measurer.measure(el.text, size, fam, ls)
        el.text_source = source
        el.text_font = used
        el.text_exact = source == "exact"
        if source != "exact" and used:
            self.substitutions.add((str(fam or "?"), used))
        x = to_float(el.elem.get("x"))
        y = to_float(el.elem.get("y"))
        anchor = (el.style.get("text-anchor") or "start").strip()
        if anchor == "middle":
            x -= w / 2
        elif anchor == "end":
            x -= w
        baseline = (el.style.get("dominant-baseline") or el.style.get("alignment-baseline")
                    or "alphabetic").strip()
        if baseline in ("middle", "central"):
            top = y - (asc + desc) / 2          # y 是視覺中線
        elif baseline in ("hanging", "text-before-edge"):
            top = y                              # y 是文字頂端
        elif baseline in ("text-after-edge", "bottom"):
            top = y - (asc + desc)               # y 是文字底端
        else:
            top = y - asc                        # alphabetic:y 是基線
        el.bbox = box_from_corners(el.ctm, x, top, w, asc + desc)
        el.font_size = size

    def _index(self) -> None:
        for el in self.all:
            if el.el_id:
                self.by_id[el.el_id] = el

    # -- 查詢 ------------------------------------------------------------- #
    def rendered(self) -> list[El]:
        """會被畫出來的元素(排除 defs/marker 內部)。"""
        out = []
        for el in self.all:
            if el.tag in NON_RENDERED:
                continue
            p, skip = el.parent, False
            while p is not None:
                if p.tag in NON_RENDERED:
                    skip = True
                    break
                p = p.parent
            if not skip:
                out.append(el)
        return out

    def by_role(self, role: str) -> list[El]:
        return [e for e in self.rendered() if e.role == role]

    def write(self, out: FsPath) -> None:
        out.parent.mkdir(parents=True, exist_ok=True)
        self.tree.write(str(out), encoding="utf-8", xml_declaration=True)
        raw = out.read_text(encoding="utf-8")
        out.write_text(raw + ("\n" if not raw.endswith("\n") else ""), encoding="utf-8")


# --------------------------------------------------------------------------- #
# 角色推論
# --------------------------------------------------------------------------- #
def has_fill(el: El) -> bool:
    f = (el.style.get("fill") or "").strip().lower()
    return f not in ("", "none", "transparent")


def is_dashed(el: El) -> bool:
    d = (el.style.get("stroke-dasharray") or "").strip().lower()
    return d not in ("", "none")


def has_arrow(el: El) -> bool:
    return bool((el.style.get("marker-end") or "").strip())


ENDPOINT_TOL = 14.0


def infer_roles(doc: SvgDoc, endpoint_tol: float = ENDPOINT_TOL) -> None:
    """填入 el.role;有 data-role 屬性者直接採用,不再推論。"""
    rendered = [e for e in doc.rendered() if e.tag in SHAPE_TAGS | {"text", "g", "use"}]
    for el in rendered:
        attr = el.elem.get("data-role")
        if attr:
            el.role = attr
            el.role_from_attr = True

    texts = [e for e in rendered if e.tag == "text"]
    shapes = [e for e in rendered if e.tag in SHAPE_TAGS and e.bbox is not None]
    boxish = [e for e in shapes if e.tag in BOX_SHAPES]
    linish = [e for e in shapes if e.tag in LINE_SHAPES]

    # 1) container:bbox 完整包住 ≥2 個其他 box,且無填色或虛線
    for el in boxish:
        if el.role:
            continue
        inner = [o for o in boxish if o is not el and el.bbox.contains_box(o.bbox)]
        if len(inner) >= 2 and (not has_fill(el) or is_dashed(el)):
            el.role = "container"

    # 2) node:有填色的 box,bbox 內含 text,且不是 container
    for el in boxish:
        if el.role:
            continue
        holds_text = any(el.bbox.contains_point(t.bbox.cx, t.bbox.cy)
                         for t in texts if t.bbox is not None)
        if holds_text and has_fill(el):
            el.role = "node"
    nodes = [e for e in boxish if e.role == "node"]

    # 3) edge:線狀元素兩端貼近 node 邊界(或有箭頭)
    for el in linish:
        if el.role:
            if el.role == "edge":
                _attach_edge_ends(el, nodes, endpoint_tol)
            continue
        if el.endpoints is None:
            continue
        near = _attach_edge_ends(el, nodes, endpoint_tol)
        if near >= 2 or (has_arrow(el) and near >= 1):
            el.role = "edge"
            el.directed = has_arrow(el)
        elif has_arrow(el):
            el.role = "edge"
            el.directed = True
        else:
            el.role = "unknown"
    for el in linish:
        if el.role == "edge":
            el.directed = el.directed or has_arrow(el)

    # 4) label:text 歸屬到 node / container / edge
    edges = [e for e in linish if e.role == "edge"]
    for t in texts:
        if not t.role:
            t.role = "label"
        if t.bbox is None:
            continue
        owner = None
        for n in nodes:
            if n.bbox.contains_point(t.bbox.cx, t.bbox.cy):
                owner = n
                break
        if owner is None:
            # container 的標題必須緊貼容器上緣,否則容器內的任何文字都會被誤收
            for c in boxish:
                if (c.role == "container" and c.bbox.contains_point(t.bbox.cx, t.bbox.cy, tol=4)
                        and abs(t.bbox.y - c.bbox.y) < 48):
                    owner = c
                    break
        if owner is None:
            # 用「標籤方框到線」的距離,不是中心點距離 —— 邊標籤通常刻意擺在線的一側
            best, bestd = None, max(endpoint_tol * 3, 40.0)
            for e in edges:
                d = min((dist_point_to_box(t.bbox, px, py) for px, py in e.polypoints),
                        default=1e9)
                if d < bestd:
                    best, bestd = e, d
            if best is not None:
                owner = best
                best.edge_label = t
        t.owner = owner

    # 5) 其餘可辨識形狀但無角色者
    for el in shapes:
        if not el.role:
            el.role = "unknown"


def _attach_edge_ends(el: El, nodes: list[El], tol: float) -> int:
    if el.endpoints is None:
        return 0
    (sx, sy), (tx, ty) = el.endpoints
    src = _nearest_node(nodes, sx, sy, tol)
    dst = _nearest_node(nodes, tx, ty, tol)
    if src is not None and src is dst:
        dst = None
    el.edge_from, el.edge_to = src, dst
    return sum(1 for x in (src, dst) if x is not None)


def _nearest_node(nodes: list[El], px: float, py: float, tol: float) -> El | None:
    best, bestd = None, tol
    for n in nodes:
        d = abs(dist_point_to_box(n.bbox, px, py))
        if d <= bestd:
            best, bestd = n, d
    return best


# --------------------------------------------------------------------------- #
# 語意化 slug
# --------------------------------------------------------------------------- #
GLOSSARY = {
    "訂單": "order", "服務": "service", "認證": "auth", "鑑權": "auth", "授權": "authorization",
    "閘道": "gateway", "網關": "gateway", "閘道器": "gateway", "資料庫": "database",
    "數據庫": "database", "資料": "data", "數據": "data", "快取": "cache", "緩存": "cache",
    "使用者": "user", "用戶": "user", "會員": "member", "註冊": "registry", "登錄": "registry",
    "發現": "discovery", "中心": "center", "佇列": "queue", "隊列": "queue",
    "訊息": "message", "消息": "message", "監控": "monitoring", "日誌": "log", "紀錄": "log",
    "前端": "frontend", "後端": "backend", "客戶端": "client", "伺服器": "server",
    "服務器": "server", "負載平衡": "load-balancer", "負載均衡": "load-balancer",
    "檔案": "file", "文件": "file", "儲存": "storage", "存儲": "storage", "支付": "payment",
    "商品": "product", "庫存": "inventory", "管理": "admin", "系統": "system",
    "模組": "module", "模塊": "module", "介面": "interface", "接口": "interface",
    "應用": "app", "集群": "cluster", "節點": "node", "排程": "scheduler", "調度": "scheduler",
    "任務": "task", "工作流": "workflow", "引擎": "engine", "平台": "platform",
    "分析": "analytics", "搜尋": "search", "搜索": "search", "通知": "notification",
    "郵件": "mail", "簡訊": "sms", "讀寫": "read-write", "讀取": "read", "寫入": "write",
    "驗證": "verify", "請求": "request", "回應": "response", "響應": "response",
    "同步": "sync", "非同步": "async", "異步": "async", "轉發": "forward", "路由": "router",
    "設定": "config", "配置": "config", "部署": "deploy", "測試": "test",
    "生產": "production", "環境": "environment", "正式": "production", "預備": "staging",
    "開發": "dev", "網路": "network", "網絡": "network", "安全": "security",
    "權限": "permission", "角色": "role", "報表": "report", "統計": "stats",
    "上傳": "upload", "下載": "download", "圖片": "image", "影片": "video",
    "第三方": "third-party", "外部": "external", "內部": "internal", "主": "primary",
    "從": "replica", "備援": "standby", "叢集": "cluster",
}
_MAX_TERM = max(len(k) for k in GLOSSARY)


def slugify(text: str, glossary: dict | None = None) -> str:
    """中英混排 → kebab-case slug;中文優先查詞彙表,查不到用拼音。"""
    gl = dict(GLOSSARY)
    if glossary:
        gl.update(glossary)
    max_term = max([len(k) for k in gl] + [1])
    tokens: list[str] = []
    i, n = 0, len(text)
    buf: list[str] = []

    def flush_ascii() -> None:
        if buf:
            tokens.extend(re.findall(r"[a-z0-9]+", "".join(buf).lower()))
            buf.clear()

    while i < n:
        ch = text[i]
        if is_cjk(ch):
            flush_ascii()
            matched = False
            for length in range(min(max_term, n - i), 0, -1):
                term = text[i:i + length]
                if term in gl:
                    tokens.extend(gl[term].split("-"))
                    i += length
                    matched = True
                    break
            if not matched:
                try:
                    from pypinyin import lazy_pinyin
                    tokens.extend(lazy_pinyin(ch))
                except Exception:
                    tokens.append(f"u{ord(ch):x}")
                i += 1
        else:
            buf.append(ch)
            i += 1
    flush_ascii()
    slug = "-".join(t for t in tokens if t)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or "unnamed"


def load_glossary(path: FsPath | None) -> dict:
    if path is None:
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- #
# 輸出符號 / 終端
# --------------------------------------------------------------------------- #
class Sym:
    def __init__(self, ascii_mode: bool) -> None:
        self.ok = "OK" if ascii_mode else "✓"
        self.warn = "!" if ascii_mode else "⚠"
        self.err = "X" if ascii_mode else "✗"
        self.arrow = "->" if ascii_mode else "→"
        self.sub = "\\-" if ascii_mode else "↳"
        self.ascii = ascii_mode


def setup_stdout(ascii_mode: bool) -> bool:
    """回傳最終是否用 ascii 模式(終端不支援 UTF-8 時自動降級)。"""
    if ascii_mode:
        return True
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        "✓⚠→↳".encode(sys.stdout.encoding or "utf-8")
        return False
    except (LookupError, UnicodeEncodeError, ValueError):
        return True


def label_text_of(el: El, doc: SvgDoc) -> str:
    """取某元素(node/container)的標籤文字。"""
    for t in doc.rendered():
        if t.tag == "text" and t.owner is el:
            return t.text
    if el.bbox is not None:
        for t in doc.rendered():
            if t.tag == "text" and t.bbox is not None and el.bbox.contains_point(t.bbox.cx, t.bbox.cy):
                return t.text
    return ""
