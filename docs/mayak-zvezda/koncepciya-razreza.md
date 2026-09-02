# Концепция «Разрез»

Как показать модель ЗВЕЗДА и цикл ССД, не воюя с потолком реального времени.

Обновлено: 28.08.2026

## Одним предложением

Организация — это **разрез помещения**: снята передняя стена и потолок, видно внутрь.
Разрез один и тот же на всех уровнях, камера не двигается, меняется только наполнение —
и поэтому разница между двумя кадрами читается как **изменение организации**, а не как
новая картинка.

## Почему именно разрез

Три причины, и ни одна не про красоту:

1. **Форма уже принята и уже проверена.** Решение «одно помещение в нескольких состояниях,
   а не башня с ярусами» записано 11.08 в `docs/zvezda-3d/README.md`. Пять кадров этого
   разреза лежат в `public/zvezda/`, и это единственная картинка направления, которую ни разу
   не назвали убогой.
2. **Разрез буквально отвечает на вопрос методики.** ЗВЕЗДА описывает, что у организации
   внутри. Разрез показывает внутренности — совпадение формы и содержания, а не метафора.
3. **Фиксированная камера превращает набор картинок в сравнение.** Два кадра подряд с одной
   точки — это диф. Два красивых кадра с разных точек — это две картинки, между которыми
   зритель ничего не вычитает.

## Что отсюда следует для стека

Картинка — **генерённый рендер**, не реальное время. Причина названа в старых доках честно
и подтвердилась дважды:

> Потолок 3D. До генерённого рендера живая сцена не дойдёт: непрямого света в реальном
> времени нет. Бесплатные ступени качества исчерпаны.

Значит разделение труда такое:

| Кто | Что делает | Почему он |
|---|---|---|
| Генератор | комната, свет, люди, предметы — один кадр на состояние | непрямой свет, материалы, глубина резкости бесплатно |
| Код | звезда-шкала, фазы, подписи, подсветка луча, переходы, тайминг | это векторный слой, его дёшево довести до красоты |
| Модель (`rooms.mjs`) | что на каком уровне стоит, что приезжает и уезжает, куда светит | 595 строк и 17 тестов, уже написано и не зависит от картинки |

Реальное время выкидывается целиком: `Scene.js` (531 строка) в этой концепции не нужен.

## Экран

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│              КАДР-РАЗРЕЗ на весь экран                   │
│              (генерённый рендер, 16:9)                   │
│                                                          │
│   ┌────────┐                                             │
│   │ звезда │  ← шкала: шесть лучей, докуда дошли          │
│   └────────┘                                             │
│                                                          │
│                          ┌──────────────────────────┐    │
│   ● Среда ○ Деятельность ○ Сознание   ← такт цикла   │    │
│   «Завезли технику. Работают по-старому.»            │    │
│                          └──────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

Слой поверх кадра, всё — SVG и DOM. Кроссфейд двух кадров при переходе, слой движется
непрерывно.

## Что меняется по уровням

Взято из `LEVEL_PROPS` в `model/rooms.mjs`, не выдумано под картинку.

| Ур. | ИЦЗ | Что в комнате | Что ушло |
|---|---|---|---|
| 1 | −1 Хаос | пузатые мониторы, стопки бумаги, шесть коробок на полу, стеллаж с папками нараспашку | — |
| 2 | 0 Информирование | плоские экраны, клавиатуры, экран на дальней стене, растение | коробки, бумага, ЭЛТ |
| 3 | +1 Транзакция | первый ноутбук, вешалка у входа, тумба с лампой | открытый стеллаж с папками |
| 4 | +2 Электронный результат | два ноутбука, серверная стойка, второй экран под дашборд на боковой стене | шкаф с бумагой |
| 5 | +3 Интеллект | три ноутбука, голосовой помощник у стойки, оба экрана живут | стационарные мониторы |
| 6 | +4 Проактивность | одно место освободилось, журнальный столик в освободившемся пятне, торшер | третье рабочее место |

Свет растёт вместе с уровнем: от тёплого оранжевого при −1 до почти нейтрального белого при
+4. Таблица `LIGHT` уже задаёт это числами — в промпт они переводятся словами.

Ключ шестого уровня: **меньше работы руками, а не больше техники**. В первоисточнике он
оговорён как визионерский. Кадр, где на +4 больше всего железа, врёт про модель.

## Три такта внутри перехода

Канон — Среда → Деятельность → Сознание. Уровень поднимается **в конце**, не в начале.

| Такт | Что на кадре | Что нельзя рисовать |
|---|---|---|
| **Среда** | привезённое стоит у стены нераспакованным, люди работают по-старому и на него не смотрят | распакованное, подключённое, использующееся |
| **Деятельность** | люди на ногах: один несёт коробку к стене, другой — новый экран к столу, третий отключает старое. Кабели, беспорядок в движении | смазку движения, пустую комнату |
| **Сознание** | всё установлено, пол чист, трое стоят вместе лицом к экрану на стене. На градус светлее | людей на местах поодиночке |

Комната на кадре «Сознание» = комната на кадре «покой» следующего уровня. Это экономит кадр
и одновременно является утверждением методики: освоенное становится нормой.

## Сколько кадров

| Объём | Кадров | Что покрывает |
|---|---|---|
| Есть сейчас | 5 | один переход 1 → 2 |
| Минимум для показа | 9 | два перехода, 1 → 3 |
| Полный | 21 | шесть уровней покоя + пять переходов по три такта |

21 = 6 покоя + 5 × 3 такта, причём «Сознание» переиспользуется как покой следующего уровня.

## Риски

**Консистентность.** Главный и единственный настоящий риск. Двадцать один кадр обязан быть
одной комнатой: сдвинулась камера или поехал цвет стены — и переход читается как склейка
двух разных офисов, то есть ровно то, что концепция должна показать, ломается. Лечится
генерацией **правкой мастер-кадра**, а не с нуля (см. промпты ниже).

**Кириллица.** Генераторы её курочат. Ни одной надписи на кадре: экраны тёмные или
абстрактные, подписи ставит код поверх.

**Нет движения внутри кадра.** Люди не ходят, а перескакивают между кадрами. Компенсируется
слоем: он движется непрерывно, и внимание держит он.

---

# Промпты

## 0. Планка

Первым делом — **один кадр без всяких ограничений**, чтобы увидеть, куда вообще дотягивается
медиум. Он не пойдёт в продукт, он нужен, чтобы понять, о каком качестве разговор.

```
A cinematic isometric cutaway of a small modern office room, like a beautifully lit
architectural miniature floating in dark empty space. Ceiling and front wall removed,
two remaining walls cut clean with visible thickness. Warm afternoon daylight pours
through a window with horizontal blinds, casting long soft light stripes across a
wooden floor. Three desks, three office workers seen from behind, a screen on the wall.
Physically based materials, soft indirect global illumination, gentle ambient occlusion
in every corner and seam, shallow depth of field with tilt-shift falloff at the frame
edges, subtle dust in the light beam.
Muted warm palette, matte surfaces, no gloss, no reflections.
Photoreal miniature diorama quality, extremely detailed, 8k render.
No text, no letters, no signage, no logos, no UI. 16:9.
```

## 1. Мастер-кадр

Дальше — блочная схема. **Блок КОНСТАНТА копируется дословно во все двадцать один промпт**,
меняется только блок СОСТОЯНИЕ и блок СВЕТ. Это единственный приём, который держит комнату
одинаковой.

### Блок КОНСТАНТА (не менять ни слова)

```
Isometric cutaway of one small office room, camera fixed at 35 degrees elevation and
45 degrees azimuth, near-orthographic lens, no perspective distortion.
Ceiling and front wall removed, interior fully visible. Only the left wall and the back
wall remain, cut cleanly with visible wall thickness.
Square floor of three by three tiles, warm brown wood, color #8D6440.
Walls warm off-white plaster, color #CDBDAA.
One window with horizontal blinds in the middle of the left wall, warm daylight falling
through it onto the floor in soft stripes.
Three wooden desks with office chairs. Three seated adult office workers in plain
clothes — one in light cream, one in dark navy, one in dark green — seen from behind
and three-quarter, faces not visible, no facial detail.
Soft indirect global illumination, gentle ambient occlusion in corners and seams,
shallow depth of field, tilt-shift blur at the frame edges so the room reads as a
miniature model. Matte realistic materials, no gloss, no reflections.
Dark charcoal void #1A1614 outside the room, room floating, no ground plane beyond it,
no other buildings, no sky.
No text, no letters, no signage, no logos, no UI, no labels anywhere.
16:9.
```

### Блоки СОСТОЯНИЕ по уровням

**Уровень −1 «Хаос»** — он же мастер-кадр, с него начинать:

```
STATE: bulky CRT monitors on all three desks. Tall stacks of paper and folders on every
desk. Six cardboard boxes on the floor along the walls, some open and overflowing with
documents. One open shelving unit crammed with binders against the left wall. One closed
cabinet against the back wall. A full wastebasket. A round rug. The room is cluttered,
nothing is put away, the floor is barely walkable.
LIGHT: dim and warm orange, deep shadows in the corners, low overall exposure, the
window is the only real light source.
```

**Уровень 0 «Информирование»:**

```
STATE: flat modern monitors and keyboards on all three desks. No paper stacks anywhere.
No cardboard boxes at all — the floor is clear. One large dark flat screen mounted on
the back wall. A closed cabinet, one open shelving unit, a potted plant on the floor,
a small plant on top of the cabinet, a round rug.
LIGHT: warmer and one step brighter than the previous frame, shadows softer.
```

**Уровень +1 «Транзакция»:**

```
STATE: one open laptop on the first desk, flat monitors on the other two. A dark flat
screen on the back wall. No open shelving anymore. A coat rack standing in the near
corner by the entrance. A small side cabinet with a table lamp against the right edge.
Two potted plants, a round rug.
LIGHT: another step brighter, light neutral warm, shadows open and soft.
```

**Уровень +2 «Электронный результат»:**

```
STATE: two open laptops and one desktop monitor. A slim black server rack standing
against the back wall where the cabinet used to be. Two dark flat screens — one on the
back wall, one mounted on the left wall showing an abstract dark dashboard surface with
faint colored bars and no readable text. Coat rack, side cabinet with lamp, three potted
plants, a round rug.
LIGHT: bright, near-neutral warm daylight, light shadows.
```

**Уровень +3 «Интеллект»:**

```
STATE: three open laptops, no desktop monitors left anywhere. Server rack against the
back wall. A small smart speaker on the side cabinet. Both wall screens softly lit.
Coat rack, four potted plants, a round rug. The floor is completely clear.
LIGHT: bright and clean, almost neutral white daylight.
```

**Уровень +4 «Проактивность»:**

```
STATE: only two desks are occupied, each with a laptop. The third desk stands empty and
moved aside. In the freed floor space, a low coffee table with two soft chairs. Server
rack, smart speaker, both wall screens softly lit, a floor lamp in the corner, plants,
a round rug. The room reads as calm and half-empty — less work done by hand, not more
equipment.
LIGHT: brightest of the set, soft even white daylight, minimal shadow, airy.
```

### Блоки ТАКТ

Ставятся **поверх состояния уровня**, с которого начинается переход. Каждый — правка
предыдущего кадра, а не новая генерация.

**Среда:**

```
Same room, same camera, same furniture and same people as the previous image. Change only
this: three or four new unopened items now stand on the floor along the back wall, still
in packaging and shrink wrap, not installed, not plugged in. The people are still working
at their old desks and nobody looks at the new items. Everything else identical.
```

**Деятельность:**

```
Same room, same camera. The people are up and moving: one carries a cardboard box toward
the back wall, one carries a new monitor toward a desk, one is unplugging an old device.
Loose cables visible, a few items sitting out of place on the floor, the room is mid-move.
Clear crisp figures in motion, no motion blur.
```

**Сознание:**

```
Same room, same camera. The move is finished: every new item is installed in its place,
the floor is completely clear, nothing left in packaging. The three people stand together
in the middle of the room, all facing the screen on the back wall. Calm and settled.
One step brighter than the previous image.
```

## Правила генерации

1. **Мастер-кадр генерится с нуля, остальные двадцать — правкой.** Режим image edit /
   img2img от уже принятого кадра. Генерация каждого кадра заново гарантированно даст
   двадцать одну разную комнату — это не риск, это исход.
2. **Seed фиксировать** и записывать рядом с кадром. Без записанного seed повторить удачный
   кадр нельзя.
3. **Блок КОНСТАНТА копировать буквально**, включая шестнадцатеричные цвета. Перефразировка
   двигает камеру.
4. **Ни одной надписи.** Экраны тёмные или абстрактные. Весь текст ставит код поверх.
5. **По три кандидата на кадр**, выбирать не «красивее», а «та же комната».

## Что проверять на кадре

- камера не сдвинулась: оконный проём и угол стен на том же месте, что в мастер-кадре;
- цвет пола и стен не поплыл;
- люди на своих местах и в той же одежде;
- предметы соответствуют колонке «Что в комнате» — иначе картинка расходится с моделью,
  а подписи ставит модель;
- на шестом уровне комната **пустее**, а не богаче;
- нет ни одной буквы.
