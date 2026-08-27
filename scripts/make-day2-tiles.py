"""Печатные оригиналы тайлов второго дня МАЯК ОКО.

Двадцать один тайл: три стола по семь. Шесть лучей кольцом и место сборки
в центре — номера 11-16 и 10 у стола Среда, 21-26 и 20 у Деятельности,
31-36 и 30 у Сознания.

Конструкция взята с фотографии готового набора: белое поле, цвет в шестиугольном
значке, крупный номер, название под ним.

Соединение показано ОБВОДКОЙ ГРАНИ. Тайл обводит своим цветом те грани, по
которым он с кем-то соединяется: луч обводит две — к партнёру и к центру,
место сборки обводит все шесть, потому что соединяется со всеми. Сложили тайлы —
на шве встретились две цветные полосы, и видно, что стык правильный.

Тайлы НЕ поворачиваются: кольцо читают с одной стороны, раскладка у всех
одинаковая. Различается только то, какие грани обведены.

Краска и рисунок значков лучей берутся из печатного оригинала жетонов первого
дня («Жетоны (с правками).pdf», CMYK) — значок ставится штампом исходной
страницы, поэтому он буквально тот же. Значки трёх столов пока растровые,
их готовит scripts/extract_center_icons.py — см. «чего не хватает» в паспорте.

Цифры и названия — контурами из Manrope wght=800 (public/fonts/*.woff2).
Шрифт в PDF не вшивается: текст сразу в кривых.

Запуск:
    python scripts/extract_center_icons.py     # один раз, значки столов
    python scripts/make-day2-tiles.py
"""

import argparse
import io
import math
import os
import re
import sys

import fitz
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.basePen import BasePen
from reportlab.lib.colors import CMYKColor, CMYKColorSep
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.pdfgen.canvas import FILL_NON_ZERO

# ─────────────────────────── геометрия, мм ───────────────────────────

ACROSS_FLATS = 80.0                      # между противоположными гранями
R = ACROSS_FLATS / math.sqrt(3)          # 46.188, он же длина стороны
INRADIUS = ACROSS_FLATS / 2              # 40, от центра до середины грани
ACROSS_CORNERS = 2 * R                   # 92.376
BLEED = 3.0                              # вылет, как у жетонов первого дня

PAGE_W = ACROSS_CORNERS + 2 * BLEED
PAGE_H = ACROSS_FLATS + 2 * BLEED
CX, CY = PAGE_W / 2, PAGE_H / 2

EDGE_W = 4.0                             # ширина обводки грани

BADGE_FLATS = 24.0                       # шестиугольный значок луча
GLYPH_SIZE = 13.0                        # рисунок внутри значка
BADGE_BOTTOM = CY + 5.0                  # значок привязан нижней гранью:
                                         # у центра он крупнее, и привязка за
                                         # центр двигала бы номер

NUM_CAP = 17.0
NUM_CY = CY - 9.0

TEXT_CAP = 3.0
TEXT_TOP = CY - 22.0                     # середина первой строки
LINE_H = 4.4
TEXT_TRACK = 0.5                         # разрядка, мм на промежуток
TEXT_GAP = 3.0                           # от текста до обводки грани
MAX_LINES = 3

MM = 72.0 / 25.4

# ─────────────────────────── лучи и столы ───────────────────────────
#
# Порядок мест в кольце — по часовой стрелке от верхнего: он же порядок номеров
# 11..16. Взят с фотографии набора.
#
# ВНИМАНИЕ, расхождение с методичкой. Промпты (03_ПРОМПТЫ_LLM.md, каркас
# развёртки) объявляют 13 · Единое цифровое пространство и 14 · Защита данных,
# а 15-16 отдают Аналитике и Автоматизации. На фотографии набора эти две пары
# номерами поменяны местами. Состав пар одинаков в обоих вариантах — расходится
# только то, какая пара носит 13-14, а какая 15-16. Портал выдаёт карточку по
# номеру, поэтому каркас развёртки обязан быть приведён к тому же порядку.
#
# cmyk — литералы оператора `k` из оригинала, не пересчёт из RGB: плашка значка
# обязана совпасть с фоном штампа до последней цифры, иначе проступит квадрат.

RAYS = [
    {"pos": 1, "id": "knowledge",  "label": "ЗНАНИЯ И НАВЫКИ",              "page": 0,  "cmyk": (0.074, 0.359, 0.828, 0.008)},
    {"pos": 2, "id": "external",   "label": "ВНЕШНИЕ ВЗАИМОДЕЙСТВИЯ",       "page": 2,  "cmyk": (0.145, 0.750, 0.789, 0.035)},
    {"pos": 3, "id": "analytics",  "label": "ДАННЫЕ И АНАЛИТИКА",           "page": 8,  "cmyk": (0.707, 0.070, 0.000, 0.000)},
    {"pos": 4, "id": "automation", "label": "АВТОМАТИЗАЦИЯ",                "page": 10, "cmyk": (0.918, 0.691, 0.164, 0.027)},
    {"pos": 5, "id": "space",      "label": "ЕДИНОЕ ЦИФРОВОЕ ПРОСТРАНСТВО", "page": 6,  "cmyk": (0.367, 0.086, 0.133, 0.000)},
    {"pos": 6, "id": "security",   "label": "ЗАЩИТА ДАННЫХ",                "page": 4,  "cmyk": (0.484, 0.000, 0.969, 0.000)},
]

# Цвета столов — триколор: Среда белая, Деятельность голубая, Сознание красное.
# Решение заказчика, прежний изумруд снят как чужой брендинг.
#
# Белым тайл покрасить нельзя — он и так белый, поэтому Среда идёт серым, и серый
# взят не любой: это краска рубашек жетонов первого дня, то есть уже цвет набора.
#
# Голубой и красный НЕ равны краскам лучей намеренно. Луч 13 голубой (0EB4EA),
# луч 12 терракотовый (CE5F44); если стол покрасить теми же, обводка перестанет
# отвечать на вопрос «с кем соединяешься» — одна и та же краска будет значить
# то луч, то центр. Поэтому взяты флажные: синее насыщеннее лучевого голубого,
# красное чище лучевой терракоты.
# icon_ink — чем рисован значок внутри плашки. По умолчанию белый, но на светлой
# плашке Среды белое не видно, поэтому там тёмно-серый.
# edge_cmyk — чем обведены грани. Обычно тем же, что плашка; у Среды задаётся
# отдельно, потому что #E9ECEE на белом поле не читается вовсе.
TABLES = [
    # Среда — F3F3F3 и на плашке значка, и на обводке граней. Задано одним К
    # вместо трёх красок: нейтральный светлый серый из C+M+Y ловит цветной
    # оттенок при малейшем несовмещении, а на ровной заливке это видно сразу.
    # Рисунок на такой плашке белым не виден, поэтому он тёмно-серый.
    {"tens": 1, "label": "СРЕДА",        "icon": "sreda",       "cmyk": (0.00, 0.00, 0.00, 0.05),
     "icon_ink": (0.00, 0.00, 0.00, 0.75)},
    {"tens": 2, "label": "ДЕЯТЕЛЬНОСТЬ", "icon": "deyatelnost", "cmyk": (1.00, 0.60, 0.00, 0.00)},
    {"tens": 3, "label": "СОЗНАНИЕ",     "icon": "soznanie",    "cmyk": (0.08, 0.95, 0.90, 0.00)},
]

# Место в кольце стоит под углом 90-60(pos-1) от центра кольца. Отсюда обе грани,
# по которым тайл с кем-то соединяется.
PARTNER_EDGE = {1: -30.0, 2: 150.0, 3: -150.0, 4: 30.0, 5: 90.0, 6: 270.0}
CENTER_EDGE = {p: (90 - 60 * (p - 1) + 180) % 360 for p in range(1, 7)}
ALL_EDGES = [30.0, 90.0, 150.0, 210.0, 270.0, 330.0]

TILE_FILL = CMYKColor(0, 0, 0, 0)        # поле — чистая бумага, без краски
BLACK = CMYKColor(0, 0, 0, 1)            # чистый К, не составной чёрный

ICON_DIR = "data/mayak-day2-icons"


def tiles():
    """21 тайл. Пары зашиты в физику: 11+12, 13+14, 15+16, и так на трёх столах.

    Цвет обводки называет ТОГО, С КЕМ соединяешься, а не себя:

    - грань к центру у всех шести лучей — цвет стола. Она продолжает обводку
      места сборки, и вокруг центра получается сплошное кольцо одного цвета;
    - грань к партнёру — двойная, обе краски пары. Половина, что ближе к центру
      кольца, всегда несёт цвет нечётного луча, дальняя — цвет чётного. Правило
      одно на обоих партнёров, поэтому через шов половины совпадают.
    """
    out = []
    for table in TABLES:
        out.append({
            "number": table["tens"] * 10,
            "partner": None,
            "label": table["label"],
            "cmyk": table["cmyk"],
            "center": True,
            "icon": ("png", os.path.join(ICON_DIR, table["icon"] + ".png")),
            "icon_ink": table.get("icon_ink"),
            "edges": [{"angle": a, "solid": table.get("edge_cmyk", table["cmyk"])}
                      for a in ALL_EDGES],
        })
        by_pos = {r["pos"]: r for r in RAYS}
        for ray in RAYS:
            pos = ray["pos"]
            odd, even = (pos, pos + 1) if pos % 2 else (pos - 1, pos)
            partner_edge = PARTNER_EDGE[pos]
            center_edge = CENTER_EDGE[pos]
            out.append({
                "number": table["tens"] * 10 + pos,
                "partner": table["tens"] * 10 + (even if pos == odd else odd),
                "label": ray["label"],
                "cmyk": ray["cmyk"],
                "center": False,
                "icon": ("pdf", ray["page"]),
                "icon_ink": None,
                "edges": [
                    {"angle": center_edge,
                     "solid": table.get("edge_cmyk", table["cmyk"])},
                    {"angle": partner_edge,
                     # общая вершина двух обведённых граней — та, что ближе
                     # к центру кольца; от неё и отсчитывается ближняя половина
                     "shared_vertex": shared_vertex(partner_edge, center_edge),
                     "near": by_pos[odd]["cmyk"],
                     "far": by_pos[even]["cmyk"]},
                ],
            })
    return out


def shared_vertex(edge_a, edge_b):
    """Угол вершины, общей у двух соседних граней."""
    diff = (edge_b - edge_a + 180) % 360 - 180
    return edge_a + diff / 2


# ─────────────────────────── текст контурами ───────────────────────────

class _Pen(BasePen):
    def __init__(self, glyphset):
        super().__init__(glyphset)
        self.ops = []

    def _moveTo(self, p):
        self.ops.append(("m", p))

    def _lineTo(self, p):
        self.ops.append(("l", p))

    def _curveToOne(self, p1, p2, p3):
        self.ops.append(("c", p1, p2, p3))

    def _closePath(self):
        self.ops.append(("z",))


class Type:
    """Контуры Manrope на wght=800.

    Шрифт в public/fonts разложен по подмножествам Google Fonts: цифры лежат
    в латинском файле, кириллица — в своём. Берутся оба, символ ищется в том,
    где он есть.
    """

    def __init__(self, paths):
        self.fonts = []
        for p in paths:
            font = TTFont(p)
            if "fvar" in font:
                font = instancer.instantiateVariableFont(font, {"wght": 800})
            self.fonts.append({"glyphs": font.getGlyphSet(),
                               "cmap": font.getBestCmap(),
                               "hmtx": font["hmtx"]})
        # высота цифры меряется по контуру: у Manrope цифры не дотягивают до
        # capHeight из OS/2, и заказанный кегль вышел бы мельче
        self.cap = self._extent("0")

    def _find(self, ch):
        for f in self.fonts:
            if ord(ch) in f["cmap"]:
                return f, f["cmap"][ord(ch)]
        raise KeyError(f"нет глифа для {ch!r} ни в одном подмножестве Manrope")

    def _trace(self, ch):
        f, name = self._find(ch)
        pen = _Pen(f["glyphs"])
        f["glyphs"][name].draw(pen)
        return pen.ops, f["hmtx"][name][0]

    def _extent(self, ch):
        ops, _ = self._trace(ch)
        ys = [p[1] for op in ops if op[0] != "z" for p in op[1:]]
        return max(ys) - min(ys)

    def _layout(self, text, cap_mm, track):
        scale = cap_mm / self.cap
        traced, width = [], 0.0
        for i, ch in enumerate(text):
            ops, adv = self._trace(ch)
            traced.append((ops, width))
            width += adv * scale + (track if i < len(text) - 1 else 0.0)
        return traced, width, scale

    def width(self, text, cap_mm, track=0.0):
        return self._layout(text, cap_mm, track)[1]

    def draw(self, c, text, cx, cy, cap_mm, color, track=0.0):
        traced, width, scale = self._layout(text, cap_mm, track)
        c.saveState()
        c.setFillColor(color)
        c.translate((cx - width / 2) * MM, (cy - cap_mm / 2) * MM)
        c.scale(MM, MM)
        p = c.beginPath()
        for ops, dx in traced:
            for op in ops:
                if op[0] == "z":
                    p.close()
                    continue
                pts = [(dx + x * scale, y * scale) for x, y in op[1:]]
                if op[0] == "m":
                    p.moveTo(*pts[0])
                elif op[0] == "l":
                    p.lineTo(*pts[0])
                else:
                    p.curveTo(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1])
        # Ненулевое правило, а не умолчание reportlab: у Manrope на wght=800
        # контуры глифа перекрываются, и при чётно-нечётном перекрытия гасят
        # друг друга — в «2», «3» и «А» появляются белые треугольники.
        c.drawPath(p, stroke=0, fill=1, fillMode=FILL_NON_ZERO)
        c.restoreState()


# ─────────────────────────── раскладка текста ───────────────────────────

def half_width(dy):
    """Половина ширины шестиугольника на высоте dy от его центра.

    К краям тайл сужается вдвое против габарита, и длинные названия проверять
    по 92 мм нельзя — внизу остаётся около 57.
    """
    return R - (R / 2) * (abs(dy) / INRADIUS)


def room(dy):
    """Сколько места под текст на этой высоте: за вычетом обводки грани."""
    return 2 * (half_width(dy) - EDGE_W - TEXT_GAP)


def wrap(type_, text, cap=TEXT_CAP, track=TEXT_TRACK):
    """Разбить название на строки, которые влезают в сужение тайла.

    Перебираются варианты в одну, две и три строки: чем выше строка, тем шире
    место, поэтому разбивка на две строки может пройти там, где на три — нет.
    Берётся первый вариант, который поместился целиком.
    """
    words = text.split()
    for n in range(1, MAX_LINES + 1):
        widths = [room(TEXT_TOP - i * LINE_H - CY) for i in range(n)]
        lines, i = [], 0
        for w in words:
            if i >= n:
                break
            cur = lines[i] if i < len(lines) else ""
            probe = (cur + " " + w).strip()
            if not cur or type_.width(probe, cap, track) <= widths[i]:
                if i < len(lines):
                    lines[i] = probe
                else:
                    lines.append(probe)
            else:
                i += 1
                if i >= n:
                    break
                lines.append(w)
        else:
            if all(type_.width(l, cap, track) <= widths[k] for k, l in enumerate(lines)):
                return lines
    raise ValueError(f"«{text}» не помещается даже в {MAX_LINES} строки")


# ─────────────────────────── рисование тайла ───────────────────────────

def hex_points(cx, cy, radius):
    """Плоский верх: вершины на 0°, 60°, ... 300°."""
    return [(cx + radius * math.cos(math.radians(a)),
             cy + radius * math.sin(math.radians(a))) for a in range(0, 360, 60)]


def hex_path(c, cx, cy, radius):
    p = c.beginPath()
    pts = hex_points(cx, cy, radius)
    p.moveTo(pts[0][0] * MM, pts[0][1] * MM)
    for x, y in pts[1:]:
        p.lineTo(x * MM, y * MM)
    p.close()
    return p


def vertex(angle):
    return (CX + R * math.cos(math.radians(angle)), CY + R * math.sin(math.radians(angle)))


def band(c, angle, t0, t1, color, mitre0=True, mitre1=True):
    """Кусок обводки вдоль грани, от доли t0 до доли t1 её длины.

    Наружу уходит на вылет, чтобы после высечки лечь заподлицо с краем. На стыке
    двух обведённых граней конец удлиняется на ус: угол шестиугольника 120°,
    без уса в углу осталась бы выемка. На стыке двух половин одной грани ус не
    нужен — там куски просто встык.
    """
    a = math.radians(angle)
    nx, ny = math.cos(a), math.sin(a)                       # наружу
    va, vb = vertex(angle - 30), vertex(angle + 30)
    ex, ey = vb[0] - va[0], vb[1] - va[1]
    length = math.hypot(ex, ey)
    ux, uy = ex / length, ey / length
    mitre = EDGE_W / math.tan(math.radians(60))

    p0 = (va[0] + ex * t0, va[1] + ey * t0)
    p1 = (va[0] + ex * t1, va[1] + ey * t1)
    m0 = mitre if mitre0 else 0.0
    m1 = mitre if mitre1 else 0.0

    pts = [
        (p0[0] + nx * BLEED, p0[1] + ny * BLEED),
        (p1[0] + nx * BLEED, p1[1] + ny * BLEED),
        (p1[0] - nx * EDGE_W + ux * m1, p1[1] - ny * EDGE_W + uy * m1),
        (p0[0] - nx * EDGE_W - ux * m0, p0[1] - ny * EDGE_W - uy * m0),
    ]
    c.setFillColor(CMYKColor(*color))
    path = c.beginPath()
    path.moveTo(pts[0][0] * MM, pts[0][1] * MM)
    for x, y in pts[1:]:
        path.lineTo(x * MM, y * MM)
    path.close()
    c.drawPath(path, stroke=0, fill=1)


def draw_edge(c, spec):
    """Обводка одной грани: сплошная или двойная, по половине на партнёра."""
    angle = spec["angle"]
    if "solid" in spec:
        band(c, angle, 0.0, 1.0, spec["solid"])
        return

    # Ближняя половина — та, что упирается в общую вершину с гранью к центру.
    # В этой вершине сходится кольцо цвета стола, и оно должно замкнуться без
    # разрыва, поэтому парная полоса в угол не лезет: ус с этой стороны снят,
    # а сама она рисуется раньше зелёной и уходит под неё.
    # Ус снимается только у ближнего конца — того, что упирается в общую вершину
    # с кольцом стола. У дальнего он нужен: там сходятся парные полосы двух
    # тайлов, и без уса на внешнем углу кольца остаётся незакрашенный клин.
    # В середине грани ус не нужен: половины встают встык.
    near_at_start = abs(((spec["shared_vertex"] - (angle - 30)) + 180) % 360 - 180) < 1e-6
    if near_at_start:
        band(c, angle, 0.0, 0.5, spec["near"], mitre0=False, mitre1=False)
        band(c, angle, 0.5, 1.0, spec["far"], mitre0=False, mitre1=True)
    else:
        band(c, angle, 0.0, 0.5, spec["far"], mitre0=True, mitre1=False)
        band(c, angle, 0.5, 1.0, spec["near"], mitre0=False, mitre1=False)


def draw_tile(c, tile, type_, cut=False):
    """cut=True — вид «как после высечки»: всё лишнее срезано по контуру.

    Печатному файлу нужен вылет и линия реза, а макету в Figma — ровно
    шестиугольник, иначе прямоугольные поля налезают друг на друга.
    """
    ink = CMYKColor(*tile["cmyk"])

    if cut:
        c.saveState()
        c.clipPath(hex_path(c, CX, CY, R), stroke=0, fill=0)

    c.setFillColor(TILE_FILL)
    c.rect(0, 0, PAGE_W * MM, PAGE_H * MM, stroke=0, fill=1)

    if cut:
        # Служебный контур для Figma: поле белое, и необведённые грани иначе
        # не видно — тайлы не за что состыковать. Рисуется ДО обводок, чтобы
        # они его перекрыли: поверх полосы он читался бы как светлая щель.
        # В печатный PDF не попадает, там грань задаёт краска CutContour.
        c.setStrokeColor(CMYKColor(0, 0, 0, 0.15))
        c.setLineWidth(0.3 * MM)
        c.drawPath(hex_path(c, CX, CY, R), stroke=1, fill=0)

    # Парная полоса раньше, кольцо стола позже: на общей вершине зелёное
    # обязано пройти поверх, иначе кольцо вокруг центра рвётся на углу.
    for spec in sorted(tile["edges"], key=lambda s: "solid" in s):
        draw_edge(c, spec)

    # Плашка одна на все тайлы, включая место сборки: у центра она была крупнее
    # и вылезала из общего ритма.
    c.setFillColor(ink)
    c.drawPath(hex_path(c, CX, BADGE_BOTTOM + BADGE_FLATS / 2, BADGE_FLATS / math.sqrt(3)),
               stroke=0, fill=1)
    # рисунок внутри значка ставится позже, в place_icons

    type_.draw(c, str(tile["number"]), CX, NUM_CY, NUM_CAP, BLACK)
    for i, line in enumerate(wrap(type_, tile["label"])):
        type_.draw(c, line, CX, TEXT_TOP - i * LINE_H, TEXT_CAP, BLACK, track=TEXT_TRACK)

    if cut:
        c.restoreState()
        return

    # Линия высечки живёт отдельной краской с именем CutContour: RIP типографии
    # снимает её в форму штампа и не выводит на печатные пластины.
    c.setStrokeColor(CMYKColorSep(0, 1, 0, 0, spotName="CutContour"))
    c.setLineWidth(0.25)
    c.drawPath(hex_path(c, CX, CY, R), stroke=1, fill=0)


# ─────────────────────────── значки ───────────────────────────

def icon_clip(page):
    """Квадрат вокруг значка в координатах страницы оригинала жетонов.

    Отбрасываются два прямоугольника во всю страницу: плашка цвета луча и белый
    квадрат 125 pt под ней — направляющая обреза, она невидима.
    """
    shapes = [d["rect"] for d in page.get_drawings() if d["rect"].width <= 124]
    if not shapes:
        raise RuntimeError("значок не найден на странице оригинала")
    box = shapes[0]
    for r in shapes[1:]:
        box |= r
    side = max(box.width, box.height)
    cx, cy = (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2
    return fitz.Rect(cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2)


def icon_png(path, ink):
    """Растровый значок в нужной краске.

    Файл лежит белой заливкой по маске. Если краска задана, та же маска
    заливается ею — так значок Среды становится тёмным на светлой плашке.
    """
    if ink is None:
        with open(path, "rb") as f:
            return f.read()
    from PIL import Image
    c, m, y, k = ink
    rgb = tuple(round(255 * (1 - v) * (1 - k)) for v in (c, m, y))
    src = Image.open(path).convert("RGBA")
    out = Image.new("RGBA", src.size, rgb + (0,))
    out.putalpha(src.getchannel("A"))
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()


def place_icons(base_pdf, src_path, tiles_list):
    """Значки лучей — штампом из оригинала, значки столов — картинкой.

    Штамп переносит вектор как есть, вместе с краской: пересборка контуров
    ломала остриё стрелок «по кругу». Штамп несёт квадрат фона цвета луча —
    квадрат меньше вписанного в значок (сторона до 0.732 от размера значка
    между гранями), а краска фона та же, поэтому его не видно.

    Значки столов пока существуют только растром, см. extract_center_icons.py.
    """
    src = fitz.open(src_path)
    dst = fitz.open(stream=base_pdf, filetype="pdf")
    clips = {r["page"]: icon_clip(src[r["page"]]) for r in RAYS}

    for i, tile in enumerate(tiles_list):
        cy = BADGE_BOTTOM + BADGE_FLATS / 2
        size = GLYPH_SIZE
        half = size / 2
        # у fitz начало координат сверху, у reportlab снизу
        target = fitz.Rect((CX - half) * MM, (PAGE_H - cy - half) * MM,
                           (CX + half) * MM, (PAGE_H - cy + half) * MM)
        kind, ref = tile["icon"]
        if kind == "pdf":
            dst[i].show_pdf_page(target, src, ref, clip=clips[ref])
        else:
            dst[i].insert_image(target, stream=icon_png(ref, tile.get("icon_ink")),
                                keep_proportion=True)

    src.close()
    return dst


# ─────────────────────────── файлы ───────────────────────────

BUSY = []


def put(path, data):
    """Записать файл, не уронив сборку, если он открыт в просмотрщике.

    Windows держит открытый PDF и не отдаёт его на перезапись. Раньше сборка
    падала целиком, хотя занят один файл из сорока трёх.
    """
    try:
        with open(path, "wb") as f:
            f.write(data)
        return True
    except PermissionError:
        BUSY.append(path)
        return False


def write_svg(page, path, w_mm=PAGE_W, h_mm=PAGE_H):
    """Страница PDF → SVG для Figma.

    Figma не открывает PDF. Размер задаётся из расчёта десять единиц на
    миллиметр: тайл читается как 800 единиц между гранями, и линейка совпадает
    с паспортом без пересчёта. Цвет в SVG только RGB — это копия для макета,
    в типографию идёт PDF.
    """
    svg = page.get_svg_image(text_as_path=True)
    head = svg[:svg.index(">") + 1]
    fixed = re.sub(r'width="[\d.]+"', f'width="{w_mm * 10:.2f}"', head, count=1)
    fixed = re.sub(r'height="[\d.]+"', f'height="{h_mm * 10:.2f}"', fixed, count=1)
    put(path, (fixed + svg[len(head):]).encode("utf-8"))


def build(tiles_list, type_, src, cut=False):
    """Собрать все страницы и вернуть слепок PDF."""
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(PAGE_W * MM, PAGE_H * MM))
    c.setTitle("МАЯК ОКО · тайлы второго дня")
    for tile in tiles_list:
        draw_tile(c, tile, type_, cut=cut)
        c.showPage()
    c.save()

    doc = place_icons(buf.getvalue(), src, tiles_list)
    # reportlab объявляет Helvetica в каждой странице, даже когда текста нет:
    # у нас всё контурами. Незашитый шрифт в описи ресурсов — повод для
    # препресса остановить заказ, поэтому опись чистится.
    for page in doc:
        doc.xref_set_key(page.xref, "Resources/Font", "null")
    data = doc.tobytes(garbage=4, clean=True, deflate=True)
    doc.close()
    return data


def write_cut_svgs(data, out_dir, tiles_list):
    """Гексы «как после высечки»: обрезанные по контуру, без вылета и реза."""
    os.makedirs(out_dir, exist_ok=True)
    box = fitz.Rect((CX - R) * MM, (CY - INRADIUS) * MM,
                    (CX + R) * MM, (CY + INRADIUS) * MM)

    doc = fitz.open(stream=data, filetype="pdf")
    for i, tile in enumerate(tiles_list):
        doc[i].set_cropbox(box)
        write_svg(doc[i], os.path.join(out_dir, f"hex-{tile['number']}.svg"),
                  ACROSS_CORNERS, ACROSS_FLATS)

    gap = 12.0
    cols, rows = 7, 3
    step_x, step_y = (ACROSS_CORNERS + gap) * MM, (ACROSS_FLATS + gap) * MM
    sheet = fitz.open()
    page = sheet.new_page(width=step_x * cols, height=step_y * rows)
    for i in range(len(tiles_list)):
        x, y = (i % cols) * step_x, (i // cols) * step_y
        page.show_pdf_page(
            fitz.Rect(x, y, x + ACROSS_CORNERS * MM, y + ACROSS_FLATS * MM), doc, i)
    write_svg(page, os.path.join(out_dir, "hexes-all.svg"),
              (ACROSS_CORNERS + gap) * cols, (ACROSS_FLATS + gap) * rows)
    sheet.close()
    doc.close()


def render_assembly(pdf_data, out_png, dpi=80):
    """Три кольца: шесть лучей вокруг места сборки.

    Это и схема, и проверка. У партнёров обводки граней обязаны встретиться
    на одном шве, а вокруг центра обводка стола обязана сомкнуться в кольцо.
    Разошлось — ошибка грани, и видно её здесь, а не на тираже.
    """
    from PIL import Image, ImageDraw

    px = lambda v: v * dpi / 25.4
    doc = fitz.open(stream=pdf_data, filetype="pdf")

    ring = 2 * INRADIUS
    cell = 2 * (ring + R) + 10
    sheet = Image.new("RGB", (int(px(cell * 3)), int(px(cell))), "white")

    mask = None
    for t in range(len(TABLES)):
        base = t * 7
        for k in range(7):
            pm = doc[base + k].get_pixmap(dpi=dpi)
            tile = Image.frombytes("RGB", (pm.width, pm.height), pm.samples).convert("RGBA")
            if mask is None:
                mask = Image.new("L", tile.size, 0)
                ImageDraw.Draw(mask).polygon(
                    [(px(x), px(y)) for x, y in hex_points(PAGE_W / 2, PAGE_H / 2, R)], fill=255)
            tile.putalpha(mask)

            cx, cy = px(cell * (t + 0.5)), px(cell / 2)
            if k:                                   # место k стоит под углом 90-60(k-1)
                phi = math.radians(-90 + 60 * (k - 1))
                cx += px(ring) * math.cos(phi)
                cy += px(ring) * math.sin(phi)
            sheet.paste(tile, (int(cx - tile.width / 2), int(cy - tile.height / 2)), tile)

    doc.close()
    buf = io.BytesIO()
    sheet.save(buf, format="PNG")
    put(out_png, buf.getvalue())


# ─────────────────────────── проверки ───────────────────────────

def check(tiles_list):
    assert len(tiles_list) == 21, len(tiles_list)
    numbers = [t["number"] for t in tiles_list]
    assert len(set(numbers)) == 21, "номера обязаны быть уникальны"

    by_number = {t["number"]: t for t in tiles_list}
    for t in tiles_list:
        if t["center"]:
            assert len(t["edges"]) == 6, "место сборки обведено не по всем граням"
            continue
        back = by_number[t["partner"]]
        assert back["partner"] == t["number"], f"партнёрство не взаимно у {t['number']}"
        assert len(t["edges"]) == 2, f"у {t['number']} обведено не две грани"
        kinds = {("solid" in e) for e in t["edges"]}
        assert kinds == {True, False}, f"у {t['number']} нет пары «сплошная + двойная»"

    # Обводки партнёров обязаны встретиться на одной грани. Место p стоит под
    # углом 90-60(p-1) от центра кольца, считая против часовой в математических
    # координатах — то есть по часовой на глаз, от верхнего места.
    ring = 2 * INRADIUS
    for a_pos, b_pos in ((1, 2), (3, 4), (5, 6)):
        pa, pb = [(ring * math.cos(math.radians(90 - 60 * (p - 1))),
                   ring * math.sin(math.radians(90 - 60 * (p - 1)))) for p in (a_pos, b_pos)]
        for src, dst, pos in ((pa, pb, a_pos), (pb, pa, b_pos)):
            want = math.degrees(math.atan2(dst[1] - src[1], dst[0] - src[0])) % 360
            assert abs((want - PARTNER_EDGE[pos] % 360 + 180) % 360 - 180) < 1e-6, \
                f"обводка места {pos} смотрит не на партнёра"
        # и грань к центру обязана смотреть ровно на центр кольца
        for src, pos in ((pa, a_pos), (pb, b_pos)):
            want = math.degrees(math.atan2(-src[1], -src[0])) % 360
            assert abs((want - CENTER_EDGE[pos] + 180) % 360 - 180) < 1e-6, \
                f"грань к центру у места {pos} смотрит не туда"

    assert EDGE_W < INRADIUS, "обводка шире тайла"
    assert BADGE_BOTTOM > NUM_CY + NUM_CAP / 2, "номер заходит за значок"
    assert BADGE_BOTTOM + BADGE_FLATS < CY + INRADIUS, "значок вылезает за верхнюю грань"
    assert GLYPH_SIZE <= 0.732 * BADGE_FLATS, "рисунок не влезает в плашку"
    assert NUM_CY - NUM_CAP / 2 > TEXT_TOP + TEXT_CAP / 2, "номер налезает на название"
    assert TEXT_TOP - (MAX_LINES - 1) * LINE_H - TEXT_CAP / 2 > CY - INRADIUS + EDGE_W, \
        "нижняя строка залезает на обводку грани"


def check_labels(type_):
    """Каждое название обязано разложиться по строкам и влезть в сужение тайла."""
    for label in [r["label"] for r in RAYS] + [t["label"] for t in TABLES]:
        lines = wrap(type_, label)
        assert len(lines) <= MAX_LINES, label
        assert " ".join(lines) == label, f"«{label}» потерялось при переносе"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.expanduser(
        r"~\Downloads\Telegram Desktop\Жетоны (с правками).pdf"))
    ap.add_argument("--out", default="docs/trainer-day2/tiles")
    args = ap.parse_args()

    if not os.path.exists(args.src):
        sys.exit(f"нет исходника жетонов: {args.src}")
    for table in TABLES:
        icon = os.path.join(ICON_DIR, table["icon"] + ".png")
        if not os.path.exists(icon):
            sys.exit(f"нет значка стола: {icon}\nсначала: python scripts/extract_center_icons.py")

    tiles_list = tiles()
    check(tiles_list)

    type_ = Type([
        "public/fonts/manrope-xn7gYHE41ni1AdIRggexSg.woff2",    # латиница и цифры
        "public/fonts/manrope-xn7gYHE41ni1AdIRggOxSuXd.woff2",  # кириллица
    ])
    check_labels(type_)

    os.makedirs(args.out, exist_ok=True)

    combined = os.path.join(args.out, "day2-tiles.pdf")
    data = build(tiles_list, type_, args.src)

    # Всё остальное считается из этого слепка, а не перечитывается с диска:
    # тогда один занятый файл не мешает собрать остальные.
    doc = fitz.open(stream=data, filetype="pdf")
    put(combined, data)

    for i, tile in enumerate(tiles_list):
        one = fitz.open()
        one.insert_pdf(doc, from_page=i, to_page=i)
        put(os.path.join(args.out, f"tile-{tile['number']}.pdf"), one.tobytes())
        one.close()

    cols, rows = 7, 3
    sheet = fitz.open()
    pw, ph = PAGE_W * MM, PAGE_H * MM
    page = sheet.new_page(width=pw * cols, height=ph * rows)
    for i in range(len(tiles_list)):
        x, y = (i % cols) * pw, (i // cols) * ph
        page.show_pdf_page(fitz.Rect(x, y, x + pw, y + ph), doc, i)
    put(os.path.join(args.out, "preview.png"), page.get_pixmap(dpi=90).tobytes("png"))

    svg_dir = os.path.join(args.out, "svg")
    os.makedirs(svg_dir, exist_ok=True)
    for i, tile in enumerate(tiles_list):
        write_svg(doc[i], os.path.join(svg_dir, f"tile-{tile['number']}.svg"))
    write_svg(page, os.path.join(svg_dir, "all-tiles.svg"), PAGE_W * cols, PAGE_H * rows)

    sheet.close()
    doc.close()

    write_cut_svgs(build(tiles_list, type_, args.src, cut=True),
                   os.path.join(svg_dir, "hex"), tiles_list)
    render_assembly(data, os.path.join(args.out, "assembly.png"))

    print(f"готово: {combined}, {len(tiles_list)} тайлов")
    print(f"svg для Figma: {svg_dir}")
    if BUSY:
        print("\nне записаны — открыты в другой программе:")
        for path in BUSY:
            print("   ", path)
    print(f"страница {PAGE_W:.3f} x {PAGE_H:.3f} мм, обрез {ACROSS_CORNERS:.3f} x {ACROSS_FLATS:.1f}, вылет {BLEED} мм")


if __name__ == "__main__":
    main()
