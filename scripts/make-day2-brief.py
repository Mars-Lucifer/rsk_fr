"""Техническое задание для типографии — тот файл, который уходит в запрос.

Отдельно от SPEC.md намеренно: SPEC — внутренний паспорт, там открытые вопросы,
ссылки на код и решения, подставленные по умолчанию. Подрядчику нужно другое:
что изготовить, из чего, в каком количестве и что указать в ответе.

    python scripts/make-day2-brief.py [--out docs/trainer-day2/tiles]

Кириллица — системным Arial: Manrope в проекте лежит в woff2, reportlab его
не читает, а тащить сюда конвертацию ради двух страниц текста незачем.
"""

import argparse
import math
import os

from reportlab.lib.colors import Color
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

MM = 72.0 / 25.4
W, H = A4
MARGIN = 20 * MM

ACROSS_FLATS = 80.0
ACROSS_CORNERS = ACROSS_FLATS * 2 / math.sqrt(3)
SIDE = ACROSS_FLATS / math.sqrt(3)

INK = Color(0.10, 0.10, 0.10)
MUTED = Color(0.42, 0.42, 0.40)
RULE = Color(0.80, 0.79, 0.76)

FONT_CANDIDATES = [
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
     "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
]


def register_fonts():
    for regular, bold in FONT_CANDIDATES:
        if os.path.exists(regular) and os.path.exists(bold):
            pdfmetrics.registerFont(TTFont("Body", regular))
            pdfmetrics.registerFont(TTFont("Body-Bold", bold))
            return
    raise SystemExit("не нашёл системный шрифт с кириллицей")


class Page:
    """Курсор по странице: пишет сверху вниз и сам переносит на новую."""

    def __init__(self, pdf):
        self.pdf = pdf
        self.y = H - MARGIN

    def space(self, mm):
        self.y -= mm * MM

    def _room(self, need_mm):
        if self.y - need_mm * MM < MARGIN:
            self.pdf.showPage()
            self.y = H - MARGIN

    def title(self, text, size=15):
        self._room(12)
        self.pdf.setFont("Body-Bold", size)
        self.pdf.setFillColor(INK)
        self.pdf.drawString(MARGIN, self.y - size, text)
        self.y -= size + 5 * MM

    def head(self, text):
        self._room(10)
        self.space(2)
        self.pdf.setFont("Body-Bold", 10.5)
        self.pdf.setFillColor(INK)
        self.pdf.drawString(MARGIN, self.y - 10.5, text)
        self.y -= 10.5 + 2.5 * MM

    def text(self, body, size=9.5, color=INK, indent=0.0, leading=4.6):
        """Абзац с переносом по ширине полосы."""
        self.pdf.setFont("Body", size)
        self.pdf.setFillColor(color)
        limit = W - 2 * MARGIN - indent * MM
        line = ""
        for word in body.split():
            probe = (line + " " + word).strip()
            if pdfmetrics.stringWidth(probe, "Body", size) > limit and line:
                self._room(leading + 2)
                self.pdf.setFont("Body", size)
                self.pdf.setFillColor(color)
                self.pdf.drawString(MARGIN + indent * MM, self.y - size, line)
                self.y -= leading * MM
                line = word
            else:
                line = probe
        if line:
            self._room(leading + 2)
            self.pdf.setFont("Body", size)
            self.pdf.setFillColor(color)
            self.pdf.drawString(MARGIN + indent * MM, self.y - size, line)
            self.y -= leading * MM

    def bullet(self, body):
        # Место резервируется под две строки сразу: иначе дефис успевает
        # напечататься внизу страницы, а текст уезжает на следующую.
        self._room(12)
        self.pdf.setFont("Body", 9.5)
        self.pdf.setFillColor(MUTED)
        self.pdf.drawString(MARGIN + 1 * MM, self.y - 9.5, "—")
        self.text(body, indent=6)

    def row(self, left, right):
        self._room(6)
        self.pdf.setFont("Body", 9.5)
        self.pdf.setFillColor(MUTED)
        self.pdf.drawString(MARGIN, self.y - 9.5, left)
        self.pdf.setFont("Body-Bold", 9.5)
        self.pdf.setFillColor(INK)
        self.pdf.drawString(MARGIN + 62 * MM, self.y - 9.5, right)
        self.y -= 5.6 * MM

    def rule(self):
        self._room(4)
        self.pdf.setStrokeColor(RULE)
        self.pdf.setLineWidth(0.4)
        self.pdf.line(MARGIN, self.y, W - MARGIN, self.y)
        self.y -= 3 * MM


def draw_hex(pdf, cx, cy, across_flats_mm):
    """Чертёж гекса с плоским верхом и простановкой трёх размеров."""
    r = across_flats_mm / math.sqrt(3) * MM
    inradius = across_flats_mm / 2 * MM
    pts = [(cx + r * math.cos(math.radians(90 - 60 * i)),
            cy + r * math.sin(math.radians(90 - 60 * i))) for i in range(6)]

    path = pdf.beginPath()
    path.moveTo(*pts[0])
    for p in pts[1:]:
        path.lineTo(*p)
    path.close()
    pdf.setStrokeColor(INK)
    pdf.setLineWidth(1.0)
    pdf.drawPath(path, stroke=1, fill=0)

    pdf.setStrokeColor(MUTED)
    pdf.setLineWidth(0.4)
    pdf.setFont("Body", 8)
    pdf.setFillColor(MUTED)

    # между гранями — горизонталь через центр
    pdf.line(cx - inradius, cy, cx + inradius, cy)
    pdf.drawCentredString(cx, cy + 2 * MM, f"{ACROSS_FLATS:.0f} мм между гранями")

    # между вершинами — вертикаль с выносом влево, за габарит: подпись поперёк
    # самой линии наезжала бы на нижнюю грань
    pdf.line(cx, cy - r, cx, cy + r)
    lead = cx - inradius - 12 * MM
    pdf.line(lead, cy - r, cx, cy - r)
    pdf.line(lead, cy + r, cx, cy + r)
    pdf.line(lead + 2 * MM, cy - r, lead + 2 * MM, cy + r)
    pdf.drawRightString(lead, cy - 1.2 * MM, f"{ACROSS_CORNERS:.1f} мм")

    # сторона
    pdf.drawString(cx + inradius + 3 * MM, cy + r * 0.45,
                   f"сторона {SIDE:.2f} мм")

    # вылет
    bleed_r = (across_flats_mm / 2 + 3) / math.sqrt(3) * 2 * MM / 2 * math.sqrt(3) / math.sqrt(3)
    pdf.setDash(2, 2)
    pdf.setStrokeColor(MUTED)
    pdf.rect(cx - (across_flats_mm / math.sqrt(3) + 3) * MM,
             cy - (across_flats_mm / 2 + 3) * MM,
             2 * (across_flats_mm / math.sqrt(3) + 3) * MM,
             2 * (across_flats_mm / 2 + 3) * MM, stroke=1, fill=0)
    pdf.setDash()
    pdf.drawCentredString(cx, cy - (across_flats_mm / 2 + 3) * MM - 7 * MM,
                          "штриховая рамка — обрезной формат страницы макета, вылет 3 мм")


def build(out_dir):
    register_fonts()
    path = os.path.join(out_dir, "ТЗ_для_типографии.pdf")
    pdf = canvas.Canvas(path, pagesize=A4)
    pdf.setTitle("Гексагональные тайлы 80 мм — техническое задание")
    page = Page(pdf)

    page.title("Шестиугольные тайлы 80 мм — запрос коммерческого предложения")
    page.text(
        "Комплект реквизита для деловой игры: 21 шестиугольная фишка. Изделие многоразовое, "
        "используется на выездных сессиях много раз в течение нескольких лет — участники берут "
        "фишки со стола руками, двигают и складывают в кольцо.",
        color=MUTED)
    page.space(2)
    page.rule()

    page.head("1. Геометрия")
    page.row("Форма", "правильный шестиугольник, плоский верх")
    page.row("Между гранями", f"{ACROSS_FLATS:.0f} мм")
    page.row("Между вершинами", f"{ACROSS_CORNERS:.1f} мм")
    page.row("Длина стороны", f"{SIDE:.2f} мм")
    page.row("Скругление вершин", "R3 мм (обсуждаемо)")
    page.row("Количество в комплекте", "21 шт (21 уникальный макет)")

    page.space(3)
    draw_hex(pdf, W / 2, page.y - 48 * MM, ACROSS_FLATS)
    page.y -= 100 * MM

    page.head("2. Тиражи для расчёта")
    page.text("Просим посчитать три позиции отдельно — нам важно увидеть, где начинается экономия.")
    page.row("1 комплект", "21 деталь")
    page.row("5 комплектов", "105 деталей")
    page.row("20 комплектов", "420 деталей")

    page.head("3. Варианты исполнения")
    page.text(
        "Просим оценить оба и подсказать, какой в вашем производстве выгоднее на таком тираже.")
    page.space(1)
    page.text("Вариант А — дерево", size=9.5)
    page.bullet("берёзовая фанера ФК, 4 мм, шлифованная, сорт 1/2")
    page.bullet("УФ-печать прямо по материалу: белила плюс CMYK, односторонняя")
    page.bullet("защитный лак поверх печати")
    page.bullet("рез контура лазером или фрезой")
    page.space(1)
    page.text("Вариант Б — картон", size=9.5)
    page.bullet("переплётный (обложечный) картон 2 мм")
    page.bullet("кашировка отпечатком с одной стороны, матовая ламинация")
    page.bullet("фигурный рез: вырубка штампом либо планшетный плоттер — на ваше усмотрение")

    page.head("4. Что мы передаём")
    page.bullet("PDF, 21 страница, по одному тайлу на странице, формат страницы "
                f"{ACROSS_CORNERS + 6:.3f} × {ACROSS_FLATS + 6:.0f} мм")
    page.bullet("цветовая модель CMYK, значения плашек заданы явно")
    page.bullet("вылет 3 мм по всему контуру")
    page.bullet("контур реза — отдельная плашка спот-цветом CutContour, толщина 0,25 pt")
    page.bullet("весь текст в кривых, шрифты не требуются")
    page.bullet("тот же контур отдельным файлом SVG — если рез идёт лазером или плоттером")
    page.bullet("при необходимости соберём раскладку под ваш формат листа")

    page.head("5. Что просим указать в предложении")
    page.text("Отдельными строками, а не одной суммой — иначе не с чем сравнивать.")
    page.bullet("материал, печать, рез, лак или ламинация, приладки — каждое своей строкой")
    page.bullet("разовая оснастка, если она нужна: вырубной штамп, приладка, подготовка раскладки")
    page.bullet("минимальный чек по каждой операции: изделие занимает около 0,16 м² печати "
                "на комплект — считаете по факту или есть минимум в 1 м²")
    page.bullet("срок изготовления по каждому тиражу")
    page.bullet("цена сигнального образца до тиража и срок его изготовления")
    page.bullet("для варианта А: нужен ли праймер под УФ-печать по фанере, компенсируете ли "
                "контур на ширину реза, даёте ли светлую кромку после лазера")
    page.bullet("допуск совмещения печати и реза")
    page.bullet("цены с НДС или без и на какую дату актуален прайс")

    page.head("6. Что важно в эксплуатации")
    page.bullet("фишку берут со стола щипком много раз за сессию — важна жёсткость и толщина, "
                "за которую можно ухватиться")
    page.bullet("реквизит ездит между городами, лежит в коробке — не должен коробиться от влажности")
    page.bullet("крупный номер на фишке читается через стол с 3-4 метров, поэтому важен контраст "
                "печати; на светлом материале без белил номер потеряется")
    page.bullet("фишки складывают в кольцо вплотную друг к другу: важно, чтобы рез был точным "
                "и соседние грани сходились без заметного зазора")

    pdf.showPage()
    pdf.save()
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="docs/trainer-day2/tiles")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    print("готово:", build(args.out))


if __name__ == "__main__":
    main()
