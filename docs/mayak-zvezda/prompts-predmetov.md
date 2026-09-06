# Промпты предметов: картинка → 3D

Шесть предметов, по одному на луч. Сначала генерируется изображение, потом оно уходит
в image-to-3D, готовый GLB кладётся в `public/zvezda-props/` и встаёт на тумбу.

Обновлено: 03.09.2026

## Почему эти промпты не похожи на промпты макетов

Картинка здесь — не результат, а сырьё для реконструкции поверхности. Поэтому почти всё
в блоке требований работает не на вид, а на то, чтобы модель потом собралась.

**Ракурс — три четверти сверху, не фронт.** Реконструктор достраивает невидимое по одному
кадру. С фронтального вида он не знает глубины и отдаёт барельеф — плоскую нашлёпку.
С трёх четвертей видны две грани и верх, и объём получается настоящим.

**Фон средне-серый, предмет светлый.** Соблазн сгенерировать белое на белом велик — у нас
же белый гипс. Делать так нельзя: реконструктор ищет силуэт по контрасту, а на белом фоне
белый предмет силуэта не имеет, и края расползаются. Цвет исходника всё равно не важен,
он стирается при загрузке.

**Тени под предметом быть не должно.** Падающая тень на кадре превращается в геометрию:
получается предмет, приваренный к тёмному пятну. Ровный рассеянный свет, контакт с полом
не показывать вовсе.

**Формы крупные, без тонких деталей.** Провода, спицы, тонкие штанги реконструируются
хуже всего — рвутся или слипаются. Всё, что тоньше пальца в масштабе предмета, лучше
не просить.

**Квадратный кадр.** Большинство image-to-3D ждёт 1:1 и режет прямоугольник по центру.

## Блок требований

Копируется в каждый промпт **дословно**, меняется только первая строка с предметом.

```
Single isolated object centered in frame, three-quarter view from slightly above,
so that the front, one side and the top surface are all visible.

Seamless plain mid-grey studio background, no floor line, no horizon, no cast shadow
under the object, no contact shadow.
Soft even diffuse studio lighting from the front-top, no hard shadows, no rim light.

The object is light warm grey, matte, unpainted, like a plaster or clay study model.
No gloss, no reflections, no glass, no transparency, no metal shine, no textures,
no decals, no branding.

Simple chunky forms with clear silhouette. No thin rods, no cables, no wires,
no lattice, no perforations, no fine detail thinner than a finger.

The whole object fits inside the frame with a clear margin on every side, nothing
is cropped. Nothing else in the picture — no props, no hands, no background objects.
No text, no letters, no numbers, no logos. Square 1:1.
```

## Шесть предметов

Первая строка каждого промпта, дальше идёт блок требований выше.

### knowledge.glb — Знания и навыки

```
A tablet computer standing upright on a simple thick desk stand, blank screen.
```

Проверить на кадре: подставка массивная, не тонкая нога; планшет читается прямоугольной
плитой, а не листом.

### interaction.glb — Внешние взаимодействия

```
A self-service kiosk terminal: a floor-standing pillar with a wide screen panel
tilted on top, solid closed body.
```

Проверить: корпус глухой, без ниш и щелей; экран наклонён и виден как отдельная плоскость.

### space.glb — Единое цифровое пространство

```
A slim server rack cabinet, a tall closed box with a few wide horizontal slots
across the front.
```

Проверить: пазы широкие и редкие. Если генератор нарисует частую решётку — переделать,
такое рвётся при реконструкции.

### security.glb — Защита данных

```
A chunky padlock with a thick rounded shackle, body closed and solid.
```

Проверить: дужка толстая и с просветом; тонкая дужка либо порвётся, либо слипнется
с корпусом.

### data.glb — Данные и аналитика

```
A wide computer monitor on a solid stand, with a simple bar chart of five bars
raised in relief on the screen.
```

Проверить: столбцы **выпуклые**, а не нарисованные. Плоский рисунок на экране в геометрию
не перейдёт, и модель придёт с пустой панелью.

### automation.glb — Автоматизация

```
A compact industrial robot arm on a round base, three thick segments folded
in a gentle S shape, simple gripper at the end.
```

Самый трудный предмет набора: у руки тонкие сочленения и много самоперекрытий. Просить
толстые сегменты и мягкий изгиб; сложенная поза реконструируется лучше вытянутой.

## Что проверить перед конвертацией

- предмет целиком в кадре, ничего не срезано;
- под предметом нет тени и нет линии пола;
- контраст с фоном виден: силуэт обводится глазом без усилий;
- нет тонких деталей, нет прозрачного, нет блеска;
- ни одной надписи.

Кадр, не прошедший хотя бы по одному пункту, дешевле перегенерировать, чем чинить модель
после реконструкции.

## После конвертации

GLB кладётся в `public/zvezda-props/` под именем луча: `knowledge.glb`, `interaction.glb`,
`space.glb`, `security.glb`, `data.glb`, `automation.glb`.

Проверка одним адресом:

```
/zvezda-prop?file=knowledge.glb
```

Смотрелка перекрашивает модель в наш гипс, подгоняет размер под свободное поле столешницы
и сажает подошвой на тумбу — сразу видно, годится форма или нет. Габарит и число
треугольников печатаются в консоль.

Качество у генератора ставить минимальное. Реконструкция по умолчанию отдаёт сотни тысяч
треугольников на предмет — при том, что весь наш набор мебели весит 4764.
