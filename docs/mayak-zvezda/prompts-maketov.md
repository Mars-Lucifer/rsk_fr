# Промпты для макетов ЗВЕЗДЫ

Шесть подходов к визуализации модели «ЗВЕЗДА-6» и цикла «Среда — Деятельность — Сознание».
Промпты нужны, чтобы **посмотреть на направление до того, как оно написано кодом**: диораму
забраковали дважды, второй раз уже после доводки света, — значит выбирать надо по картинке.

Обновлено: 26.08.2026

## Три правила, без которых макеты выйдут мусором

**1. Не просить генератор писать по-русски.** Кириллицу почти все модели курочат: получаются
похожие на буквы закорючки. Есть два выхода — просить английские подписи и мысленно подставлять
русские, либо просить макет без единой надписи, а текст поставить сверху потом. В промптах ниже
подписи английские, и это сделано намеренно.

**2. Просить «скриншот интерфейса», а не «иллюстрацию».** Формулировка `UI screenshot of a web
application` разворачивает модель в сторону чистой вёрстки: сетки, отступы, ровные линии. Без неё
выходит абстрактный постер, по которому ничего не решишь.

**3. Отношение сторон 16:9.** Объяснялка живёт на экране целиком, и макет должен быть той же
формы. Для варианта «Полоса» — наоборот, 9:16 или 3:4: он вертикальный.

Цвета проекта, если генератор их принимает: фон `#0B1020`, панели `#121A2E`, линии `#1E2A45`,
акцент `#D9A441`. Шесть лучей: `#FFC24B` янтарь, `#4BE0C8` бирюза, `#6B90FF` синий, `#C58BFF`
лиловый, `#B9F24B` лайм, `#FF7A5C` коралл.

---

## А. Звёздная карта

Радиальная сетка: шесть осей, шесть колец, профиль организации и витки спирали на луче.

```
UI screenshot of a data visualization dashboard, dark navy background #0B1020.
Centered radial chart: six axes radiating from the center at exactly 60 degrees apart,
six concentric hexagonal rings from small to large marking ordinal levels.
An irregular six-vertex polygon connects one point per axis at different ring distances,
filled with translucent blue, thin bright outline, small diamond markers at each vertex.
Each axis ends in a small colored circular badge with a single letter, and a short label
beside it. Badge colors in order: amber, teal, blue, violet, lime, coral.
One axis has a delicate glowing spiral spun around it, unwinding outward from the center
and crossing three rings, drawn as a thin luminous line.
On the left, a vertical ladder of six steps with numeric labels from -1 to +4,
the lower three filled, the upper three dim.
Faint starfield in the background. Precise editorial infographic style, thin strokes,
generous negative space, no 3D, no perspective, no people, no icons of buildings.
English labels only. 16:9.
```

**Что проверять на макете:** считаются ли шесть осей за секунду; не сливаются ли лучи в кашу
из-за цвета; видно ли, что кольца — это лестница, а не декоративные круги.

---

## Б. Развёртка

Одна вещь в двух проекциях: слева свёрнутая звезда, справа развёрнутая матрица.

```
UI screenshot of an analytics web page, dark navy background #0B1020, editorial layout.
Left half: a small radial hexagonal chart with six axes and an irregular filled polygon,
subdued, drawn as a thumbnail with a caption underneath.
Right half: a clean 6 by 6 grid of rounded square cells with generous gaps.
Each row is one color family — amber, teal, blue, violet, lime, coral — and within a row
the leftmost cells are saturated while the rest stay dark empty placeholders,
so each row reads as a progress bar of different length.
Row labels on the left as single letters, column headers on top as numbers -1 to +4.
Thin connecting lines suggest that the left chart unfolds into the right grid.
Swiss editorial infographic style, precise alignment, thin hairlines, lots of breathing room,
no 3D, no gradients on the cells, no illustrations. English labels only. 16:9.
```

**Что проверять:** читается ли связь между звездой и матрицей без подписи; не выглядит ли
матрица как таблица из отчёта.

---

## В. Полоса

Первый экран вертикального лонгрида: одна большая звезда и три строки текста.

```
Web page hero screen, near-black background #07090F, vertical composition.
A single large six-pointed star outline centered, drawn in one continuous thin amber line
#FFC24B, sharp points, slight outer glow, nothing filled.
Below it, one word in wide-tracked light capital letters, and a single quiet subtitle line
under it in muted warm gray. A small downward arrow at the bottom edge.
Enormous empty space around the star. Editorial magazine cover feeling,
restrained typography, no decoration, no icons, no gradients, no photos.
Six-pointed star must be a proper star polygon with alternating outer and inner points,
NOT two overlapping triangles. English text only. 3:4.
```

**Что проверять:** держит ли экран внимание без единой картинки; не превратилась ли звезда в
гексаграмму (две наложенные треугольные петли — чужой символ, в макете он не нужен).

---

## Г. Прибор «МАЯК»

Единственный вариант с настоящей объёмной картинкой: шестигранная башня-маяк.

```
Cinematic product render of a hexagonal glass and metal tower standing alone in darkness,
studio lighting, soft global illumination, shallow depth of field.
The tower is built of six stacked tiers; the lowest tiers glow warmly from within
while the upper tiers remain dark and empty glass, so the filling reads bottom to top.
Six vertical edges of the hexagon are lit with six different accent colors —
amber, teal, blue, violet, lime, coral — each edge glowing to a different height.
A thin luminous spiral wraps around the tower, rising with each turn.
Deep navy background #0B1020, subtle volumetric haze, faint reflection on the floor.
Premium industrial design language, matte metal and frosted glass, no text, no people,
no city, no ocean. 16:9.
```

**Что проверять:** понятно ли без подписи, что тиров шесть и что рёбра разной высоты — это
разные направления; не выглядит ли башня как «просто красивый объект», из которого модель
не вычитывается.

---

## Д. Поле под сеткой

Организация как система: частицы внутри измерительной полярной сетки.

```
Generative data art inside a precise measuring instrument, dark background #0B1020.
A polar grid divides the frame into six sectors and six concentric rings, thin cold lines,
tick marks and small numeric labels around the edge like a scientific dial.
Inside the grid lives a field of thousands of tiny glowing particles.
In one sector the particles are scattered chaotically in a dim cloud; in the neighboring
sectors they progressively organize into ordered lattices, brighter and more structured
toward the outer rings, ending in a crisp self-luminous mesh.
Additive light, no bloom haze, black negative space, no background texture.
Scientific instrument aesthetic, not a screensaver. Minimal English labels. 16:9.
```

**Что проверять:** видно ли, что порядок нарастает от сектора к сектору; не выглядит ли поле
как заставка; можно ли по картинке сказать, чем один сектор отличается от другого.

---

## Е. Плоский вектор

Язык современных объяснялок: плоские формы, крупные силуэты.

```
Flat vector explainer illustration, wide 16:9 frame, dark navy background #0B1020.
Six large simple geometric glyphs arranged in a ring around a central star shape:
rising steps, a circle with outward arcs, six dots stitched by one closed line,
a shield of two arcs, three bars of different height in a frame, a looping arrow.
Each glyph in one flat accent color — amber, teal, blue, violet, lime, coral —
drawn with uniform stroke weight, rounded corners, no outlines around shapes,
no gradients, no shadows.
Below, a row of six flat rounded blocks growing in height from left to right,
the first three filled, the last three outlined only.
Modern editorial explainer style, geometric and calm, no characters, no faces,
no isometric buildings, no office objects, no gears. Minimal English labels. 16:9.
```

**Что проверять:** не превратились ли глифы в клипарт; отличимы ли шесть значков друг от друга
с расстояния; держится ли единый стиль штриха.

---

## Как пользоваться результатом

Сгенерировать по два-три кадра на подход, положить рядом и выбрать **направление**, а не
конкретный кадр. Макет не станет продуктом: он нужен, чтобы ответить на один вопрос — хочется
на это смотреть или нет.

Дальше выбранное собирается кодом на настоящих данных модели. Наброски трёх подходов, собранные
без генерации, лежат на `/zvezda-proba` — их полезно открыть рядом с макетами: они показывают,
как подход выглядит с реальными русскими названиями лучей, которых генератор не напишет.
