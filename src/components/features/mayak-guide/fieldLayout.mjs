// Геометрия поля «МЫ»: одни и те же числа нужны и 2D-плееру (проценты от растра),
// и 3D-сцене (миллиметры), поэтому они лежат отдельно от компонентов.
//
// Растр public/mayak-guide/pole_my.png (1400×1105) снят с того же макета, что и вектор
// public/mayak-guide/field-ya.svg: его viewBox 1984.25×1559.06 pt = 700×550 мм.
// Отсюда масштаб растра — 0.5 мм на пиксель, и координаты клеток переводятся в метры
// без отдельного обмера поля.
//
// Формат .mjs выбран сознательно: модуль чистый (ни JSX, ни React), поэтому его
// запускает и вебпак Next, и `node --test` для fieldLayout.test.mjs.

export const VB_W = 1400;
export const VB_H = 1105;

// Обмеры набора. Поле снято с вектора, реквизит — оценка по растру: калибровочные
// ручки, а не истина. Появятся фото набора с линейкой — правим здесь, сцена подхватит.
export const BOARD_MM = { w: 700, h: 550, thickness: 5 };
export const JETON_MM = { diameter: 40, thickness: 3 };

// Левые верхние углы планшетов тактов.
export const TACTS = [
    { label: "Такт 1", x: 37, y: 242 },
    { label: "Такт 2", x: 372, y: 242 },
    { label: "Такт 3", x: 37, y: 656 },
    { label: "Такт 4", x: 372, y: 656 },
];

// Шаг сетки 3×3 внутри планшета такта (снят по линиям сетки поля).
export const CELL_DX = 99;
export const CELL_DY = 98;
export const CELL_X0 = 58;
export const CELL_Y0 = 122;

export function cellPoint(tact, index) {
    return {
        x: tact.x + CELL_X0 + (index % 3) * CELL_DX,
        y: tact.y + CELL_Y0 + Math.floor(index / 3) * CELL_DY,
    };
}

// Порядок направлений совпадает с раскладкой карточек на поле: сверху вниз, слева направо.
export const DIRS = [
    // deck — центр паза направления на поле (панель 206×291), стопка ложится ровно в него.
    // jeton: цветная сторона; серая рубашка того же направления — следующий файл набора.
    { id: "knowledge", name: "Знания и навыки", color: "#e7a847", jeton: 1, deck: { x: 829, y: 201 } },
    { id: "external", name: "Внешние взаимодействия", color: "#cd5f44", jeton: 3, deck: { x: 1047, y: 201 } },
    { id: "space", name: "Единое цифровое пространство", color: "#9fc9d3", jeton: 7, deck: { x: 1265, y: 201 } },
    { id: "security", name: "Защита данных", color: "#90c743", jeton: 5, deck: { x: 828, y: 501 } },
    { id: "analytics", name: "Данные и аналитика", color: "#0eb4e9", jeton: 9, deck: { x: 1046, y: 501 } },
    { id: "automation", name: "Автоматизация", color: "#245a94", jeton: 11, deck: { x: 1264, y: 501 } },
];

// План каждого такта: какое направление легло в каждую из девяти клеток.
// Сумма по всем тактам — ровно 6 задач на направление, 36 жетонов и 36 звёзд.
export const PLANS = [
    [0, 3, 1, 4, 2, 5, 0, 1, 4],
    [2, 5, 0, 3, 1, 4, 3, 5, 2],
    [1, 4, 0, 2, 5, 3, 0, 1, 2],
    [5, 2, 3, 0, 4, 1, 4, 5, 3],
];

// Карт в разделе этапа «МЫ»: шесть, ровно по числу задач направления за партию.
// Четыре такта по девять задач дают 36 карт — стопки кончаются одновременно с полем.
export const CARDS_PER_DECK = 6;

// Стопки этапа «МЫ»: шесть разделов колоды заданий по направлениям.
// back — обложка направления из набора «Маяк ВУЗЫ», faces — лица заданий.
export const MY_STACKS = DIRS.map((dir) => ({
    id: dir.id,
    name: dir.name,
    color: dir.color,
    at: dir.deck,
    back: `/mayak-guide/deck-my/${dir.id}-back.png`,
    faces: Array.from({ length: CARDS_PER_DECK }, (_, i) => `/mayak-guide/deck-my/${dir.id}-${i + 1}.jpg`),
}));

// Трек индекса цифровой зрелости: строка — направление, столбец — закрытая задача.
// Числа не подобраны на глаз, а обмерены по растру поля «МЫ»: клетки трека — светло-серые
// плашки 46 × 45 px, их границы находятся порогом по цвету, центры берутся серединой
// найденных полос. Шаг по строкам был 56.2 при настоящих 56.8, и нижние ряды уезжали
// из клеток на пару пикселей растра.
export const STAR_X0 = 885.5;
export const STAR_DX = 81.6;
export const STAR_Y0 = 730;
export const STAR_DY = 56.8;

export function starPoint(dirIndex, column) {
    return { x: STAR_X0 + column * STAR_DX, y: STAR_Y0 + dirIndex * STAR_DY };
}

// Полная раскладка партии: 36 жетонов с координатами клеток.
export function jetonSlots() {
    return PLANS.flatMap((plan, tactIndex) =>
        plan.map((dir, cell) => ({
            id: `${tactIndex}-${cell}`,
            tact: tactIndex,
            cell,
            dir,
            point: cellPoint(TACTS[tactIndex], cell),
        }))
    );
}

// Пиксель растра → метры сцены: центр поля в нуле, X вправо, Z вниз (от игрока).
export function pxToMeters(point) {
    return {
        x: (point.x / VB_W - 0.5) * (BOARD_MM.w / 1000),
        z: (point.y / VB_H - 0.5) * (BOARD_MM.h / 1000),
    };
}
