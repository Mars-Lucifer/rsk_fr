"""Вынуть белые рисунки центральных значков из сгенерированных PNG.

Значки трёх столов пока существуют только картинкой. Здесь из неё вырезается
сам рисунок: внутри цветного шестиугольника всё белое — это он. На выходе PNG
с прозрачным фоном и белой заливкой, который кладётся в тайл поверх плашки.

Это времянка. В печатном оригинале шесть значков лучей — вектор, взятый
штампом из «Жетоны (с правками).pdf», и три центральных обязаны стать такими же.
Пока они растровые, и в паспорте это записано.

Запуск:
    python scripts/extract_center_icons.py
"""

import os
import sys

from PIL import Image, ImageDraw

OUT = "data/mayak-day2-icons"

# откуда что берётся: файл, номер шестиугольника слева направо, имя на выходе
SOURCES = [
    (r"~\Downloads\ChatGPT Image 27 авг. 2026 г., 16_15_51.png", 1, "sreda"),
    (r"~\Downloads\ChatGPT Image 27 авг. 2026 г., 16_06_16.png", 1, "soznanie"),
    (r"~\Downloads\ChatGPT Image 27 авг. 2026 г., 16_15_51.png", 0, "deyatelnost"),
]


def hex_boxes(img):
    """Границы цветных шестиугольников, слева направо.

    Фон картинки белый, шестиугольники залиты плотным цветом — значит колонка
    считается «занятой», если в ней есть достаточно насыщенные пиксели.
    """
    w, h = img.size
    px = img.load()
    step = max(1, h // 400)
    busy = []
    for x in range(w):
        found = False
        for y in range(0, h, step):
            r, g, b = px[x, y][:3]
            if max(r, g, b) - min(r, g, b) > 40 and max(r, g, b) < 240:
                found = True
                break
        busy.append(found)

    boxes, start = [], None
    for x, flag in enumerate(busy + [False]):
        if flag and start is None:
            start = x
        elif not flag and start is not None:
            if x - start > w // 20:                 # отсеять точки и артефакты
                boxes.append((start, x))
            start = None
    return boxes


def glyph(img, x0, x1):
    """Белый рисунок внутри шестиугольника, как маска с мягким краем.

    Прозрачность берётся из яркости, а не порогом: порог даёт зубец на дуге,
    а мягкий край при печати на 800 dpi незаметен.
    """
    crop = img.crop((x0, 0, x1, img.size[1])).convert("RGB")
    w, h = crop.size
    px = crop.load()

    # Белый рисунок и белый фон вокруг плашки по цвету неразличимы, поэтому фон
    # отделяется связностью: он касается края кадра, рисунок заперт внутри
    # цветного шестиугольника. Заливаем от четырёх углов и вычитаем залитое.
    white = Image.new("L", (w, h), 0)
    wp = white.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            wp[x, y] = 255 if max(r, g, b) > 200 and max(r, g, b) - min(r, g, b) < 30 else 0

    for corner in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if wp[corner] == 255:
            ImageDraw.floodfill(white, corner, 128)

    alpha = white.point(lambda v: 255 if v == 255 else 0)

    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    out.paste((255, 255, 255), (0, 0, w, h), alpha)
    out.putalpha(alpha)

    box = alpha.getbbox()
    if not box:
        raise RuntimeError("белый рисунок не найден")
    out = out.crop(box)

    side = max(out.size)                            # в квадрат, чтобы не тянуло
    square = Image.new("RGBA", (side, side), (255, 255, 255, 0))
    square.paste(out, ((side - out.size[0]) // 2, (side - out.size[1]) // 2), out)
    return square


def main():
    os.makedirs(OUT, exist_ok=True)
    for path, index, name in SOURCES:
        full = os.path.expanduser(path)
        if not os.path.exists(full):
            sys.exit(f"нет исходника: {full}")
        img = Image.open(full).convert("RGB")
        boxes = hex_boxes(img)
        if index >= len(boxes):
            sys.exit(f"в {os.path.basename(full)} найдено {len(boxes)} значков, "
                     f"а нужен номер {index}")
        icon = glyph(img, *boxes[index])
        dst = os.path.join(OUT, f"{name}.png")
        icon.save(dst)
        print(f"{name}: {icon.size[0]}x{icon.size[1]} -> {dst}")


if __name__ == "__main__":
    main()
