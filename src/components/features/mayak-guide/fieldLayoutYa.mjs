// Геометрия поля «Я» — те же числа, что у 2D-плеера FieldPlayerYa.
//
// Координаты сняты из векторного исходника набора (public/mayak-guide/field-ya.svg,
// viewBox 1984 × 1559 pt = 700 × 550 мм). В 3D полотно показывает растр pole_ya.png
// (1400 × 1101): это тот же макет, нормированные габариты «ромашки» у вектора и растра
// сходятся до 0.15 % — проверено по границам белой фигуры. Поэтому доли viewBox
// переносятся в метры сцены напрямую, без отдельного обмера растра.
//
// Формат .mjs — как у fieldLayout.mjs: модуль чистый, его тянет и вебпак Next,
// и `node --test`.

import { BOARD_MM } from "./fieldLayout.mjs";

export const VB_W = 1984;
export const VB_H = 1559;

// Центральный гекс СТАРТ: отсюда миплы начинают партию.
export const CENTER = { x: 1186, y: 782 };

// Внутреннее кольцо: четыре ячейки вокруг центра, обход по часовой стрелке —
// вправо, вниз, влево, вверх. Из верхней ячейки команда выходит на кольцо типов.
//
// Радиус снят с самого макета, а не подобран: по pole_ya.png кольцо занимает полосу
// от 114 до 216 px viewBox от центра (внутри — гекс СТАРТ, снаружи — белый зазор перед
// кольцом типов). Середина полосы — 160. Прежние 107 попадали на кромку гекса, и шесть
// миплов вставали не в ячейку, а на сам СТАРТ.
const INNER_R = 160;
export const INNER = [
    { x: CENTER.x + INNER_R, y: CENTER.y },
    { x: CENTER.x, y: CENTER.y + INNER_R },
    { x: CENTER.x - INNER_R, y: CENTER.y },
    { x: CENTER.x, y: CENTER.y - INNER_R },
];

// Шесть типов контента. У каждого: ячейка на внешнем кольце (sector), крупный гекс
// с иконкой под стопку карт (deck) и луч специализации из трёх гексов (ray).
export const TYPES = [
    { id: "text", name: "Текст", color: "#0eb4e9", sector: { x: 1185, y: 515 }, deck: { x: 1465, y: 309 }, ray: [{ x: 1186, y: 379 }, { x: 1186, y: 251 }, { x: 1186, y: 124 }] },
    { id: "audio", name: "Аудио", color: "#cd5f44", sector: { x: 1413, y: 635 }, deck: { x: 1732, y: 782 }, ray: [{ x: 1535, y: 580 }, { x: 1646, y: 517 }, { x: 1756, y: 453 }] },
    { id: "image", name: "Изображение", color: "#245a94", sector: { x: 1413, y: 927 }, deck: { x: 1454, y: 1250 }, ray: [{ x: 1535, y: 983 }, { x: 1646, y: 1047 }, { x: 1756, y: 1111 }] },
    { id: "interactive", name: "Интерактив", color: "#9fc9d3", sector: { x: 1187, y: 1049 }, deck: { x: 911, y: 1256 }, ray: [{ x: 1186, y: 1185 }, { x: 1186, y: 1312 }, { x: 1186, y: 1440 }] },
    { id: "data", name: "Данные", color: "#90c743", sector: { x: 960, y: 928 }, deck: { x: 640, y: 782 }, ray: [{ x: 837, y: 983 }, { x: 727, y: 1047 }, { x: 617, y: 1111 }] },
    { id: "video", name: "Видео", color: "#e7a847", sector: { x: 959, y: 637 }, deck: { x: 914, y: 309 }, ray: [{ x: 837, y: 580 }, { x: 727, y: 517 }, { x: 617, y: 453 }] },
];

// Стопка раздела «Старт» лежит в верхнем правом углу поля, как на столе. Под неё
// печатного паза нет, поэтому координата подобрана так, чтобы карта 104 × 145 мм
// целиком помещалась на полотне: край стопки не должен свисать с кромки.
export const START_DECK = { x: 1800, y: 232 };

// Цвета шести миплов — по числу участников команды.
export const MEEPLE_COLORS = ["#2f6fd0", "#c9503f", "#1d2126", "#e2a03f", "#6aa838", "#eef1f4"];

// Карт в стопке. Числа разные, потому что разные и разделы печатного набора.
//
// Тип контента отдаёт за партию ровно пять заданий: одно на внешнем круге, где команда
// решает его вместе и сдаёт инспектору, и четыре на специализации. Столько же в разделе
// и есть — шесть лиц в PDF минус «карта настроения», которая заданием не является и в
// сцене не участвует. Запаса нет: пятая раздача выбирает раздел досуха.
//
// «Старт» берётся из комплекта СПО, там шесть заданий и карты настроения нет. Разыгрывают
// из них четыре — по числу ячеек внутреннего кольца, — остальные видно по толщине стопки.
export const TYPE_CARDS = 5;
export const START_CARDS = 6;

// Второй набор — «ФЕДЕРАЦИЯ» (карты №4xx): регионы и ведомства вместо вузовских кейсов.
// Он полнее: «Старт» девять карт вместо шести, у каждой своя рубашка, а в типе шесть
// заданий — первое приходит из отдельного файла «База типы», за ним пять из раздела.
// Седьмая карта раздела — «карта настроения»; она заданием не является, в раздачу не
// идёт и лежит рядом файлом -mood.
export const YA_DECKS = {
    vuz: { id: "vuz", name: "ВУЗЫ", dir: "/mayak-guide/deck-ya", start: START_CARDS, type: TYPE_CARDS },
    fed: { id: "fed", name: "Федерация", dir: "/mayak-guide/deck-ya-fed", start: 9, type: 6 },
};

// Пиксель viewBox → метры сцены: центр поля в нуле, X вправо, Z вниз (от игрока).
export function pxToMeters(point) {
    return {
        x: (point.x / VB_W - 0.5) * (BOARD_MM.w / 1000),
        z: (point.y / VB_H - 0.5) * (BOARD_MM.h / 1000),
    };
}

// Центр «ромашки» в метрах. Он НЕ совпадает с центром полотна: левую треть поля
// занимает чёрная панель с названием и легендой, поэтому фигура сдвинута вправо на 68 мм.
// Всё, что считается «от центра поля» — прежде всего разворот стопок наружу, — должно
// отсчитываться отсюда, иначе стопки встают мимо своих лепестков.
export const CENTRE_M = pxToMeters(CENTER);

// Сдвиг от центра поля наружу: карту кладут рядом с ячейкой, чтобы её не закрывали миплы.
export function outward(point, distance) {
    const dx = point.x - CENTER.x;
    const dy = point.y - CENTER.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: point.x + (dx / length) * distance, y: point.y + (dy / length) * distance };
}

// Шесть фишек в ячейке: сетка 3 × 2 компактнее кольца и не выходит на соседние гексы.
export function cluster(point, index, spread = 1) {
    const column = index % 3;
    const row = Math.floor(index / 3);
    return {
        x: point.x + (column - 1) * 30 * spread,
        y: point.y + (row - 0.5) * 34 * spread,
    };
}

// Ячейки поля под ярлыками. Живому столу нужно называть клетку строкой: сервер комнаты
// геометрии не знает и хранит именно ярлык («inner:2», «type:text:ray:1»), а точку по
// нему считает сцена. Демо ходит по тем же координатам напрямую — список собран из них
// же, поэтому два режима не могут разъехаться при калибровке поля.
// Форма клетки — не украшение, а её печатный контур. Подсветка обязана лечь ровно на
// то, что нарисовано, иначе игрок целится в круг, а фишка встаёт в гекс. Числа сняты с
// растра public/mayak-guide/pole_ya.png связными компонентами и радиальным профилем от
// центра фигуры, а не подобраны: гексы лучей вышли 133 × 119 (плоским верхом, R ≈ 66),
// центральный СТАРТ — выше, чем шире (вершиной вверх, R ≈ 110), а оба круга оказались
// не рядами гексов, а секторами кольца.
//
// Углы отсчитываются от «вправо» по часовой стрелке — та же система, что у координат
// поля, где Y растёт вниз.
const HEX_START = { kind: "hex", r: 110, pointy: true };
const HEX_RAY = { kind: "hex", r: 66, pointy: false };
// Секторы нарезаны ровно: внутренний круг по 90°, кольцо типов по 60° — границы найдены
// сменой цвета соседних секторов, а не на глаз. Из каждого вычтен зазор, которым они
// разделены на печати: подсветка во всю ширину сектора наезжала на белую границу.
const innerSector = (deg) => ({ kind: "sector", r0: 114, r1: 215, mid: deg, span: 82 });
const typeSector = (deg) => ({ kind: "sector", r0: 229, r1: 336, mid: deg, span: 57 });

// Внутренний круг обходится по часовой стрелке от правой ячейки; кольцо типов начинается
// с верхнего сектора «Текст» и идёт тем же обходом, шагом 60°.
const INNER_DEG = [0, 90, 180, 270];

export const CELLS = [
    { id: "start", label: "СТАРТ", at: CENTER, shape: HEX_START },
    ...INNER.map((point, index) => ({
        id: `inner:${index}`,
        label: `Внутренний круг ${index + 1}`,
        at: point,
        shape: innerSector(INNER_DEG[index]),
    })),
    ...TYPES.flatMap((type, order) => [
        { id: `type:${type.id}:sector`, label: type.name, at: type.sector, shape: typeSector(-90 + order * 60) },
        ...type.ray.map((point, index) => ({
            id: `type:${type.id}:ray:${index}`,
            label: `${type.name} · луч ${index + 1}`,
            at: point,
            shape: HEX_RAY,
        })),
    ]),
];

// Контур клетки в метрах сцены, точками на плоскости стола. Секторы строятся от центра
// фигуры (CENTER), гексы — вокруг собственной точки, поэтому обе формы отдаются уже
// готовым списком вершин: сцене остаётся сделать из них полигон и обводку.
// inset — насколько контур ужать внутрь клетки, в единицах viewBox. Нужен рамке: линия
// в WebGL всегда толщиной в один пиксель, сколько ей ни задавай, поэтому обводка клетки
// делается не линией, а кольцом между внешним и ужатым контуром.
export function cellOutline(id, inset = 0) {
    const cell = CELL_BY_ID.get(id);
    if (!cell) return null;
    const shape = cell.shape;

    if (shape.kind === "hex") {
        // Гекс «вершиной вверх» повёрнут на 30° относительно «плоского верха».
        const turn = shape.pointy ? Math.PI / 6 : 0;
        const r = Math.max(4, shape.r - inset);
        return Array.from({ length: 6 }, (_, i) => {
            const a = turn + (i * Math.PI) / 3;
            return pxToMeters({ x: cell.at.x + Math.cos(a) * r, y: cell.at.y + Math.sin(a) * r });
        });
    }

    // Сектор кольца: наружная дуга слева направо, внутренняя обратно. Шаг 4° — на глаз
    // дуга уже гладкая, а вершин втрое меньше, чем при градусном шаге.
    //
    // Ужимается сектор со всех четырёх сторон одинаково: по радиусу напрямую, по углу —
    // через длину дуги, иначе у внутреннего края рамка получается заметно толще.
    const r0 = shape.r0 + inset;
    const r1 = Math.max(r0 + 4, shape.r1 - inset);
    const shrink = inset === 0 ? 0 : (inset / ((r0 + r1) / 2)) * (180 / Math.PI);
    const span = Math.max(4, shape.span - shrink * 2);
    const a0 = ((shape.mid - span / 2) * Math.PI) / 180;
    const a1 = ((shape.mid + span / 2) * Math.PI) / 180;
    const steps = Math.max(2, Math.round(span / 4));
    const arc = (radius, from, to) =>
        Array.from({ length: steps + 1 }, (_, i) => {
            const a = from + ((to - from) * i) / steps;
            return pxToMeters({ x: CENTER.x + Math.cos(a) * radius, y: CENTER.y + Math.sin(a) * radius });
        });
    return [...arc(r1, a0, a1), ...arc(r0, a1, a0)];
}

const CELL_BY_ID = new Map(CELLS.map((cell) => [cell.id, cell]));

// Ярлык ячейки → точка в метрах сцены. index раздвигает шестерых внутри одной клетки:
// на общей ячейке фишки не должны вставать друг в друга.
export function cellToMeters(id, index = 0, spread = 0.9) {
    const cell = CELL_BY_ID.get(id);
    if (!cell) return null;
    return pxToMeters(cluster(cell.at, index, spread));
}

// Стопки этапа «Я»: раздел «Старт» плюс шесть типов контента.
// back — рубашка (обложка раздела из набора), faces — лица заданий.
export function yaStacks(deckId = "vuz") {
    const deck = YA_DECKS[deckId] || YA_DECKS.vuz;
    return [
        {
            id: "start",
            name: "Старт",
            color: "#245a94",
            at: START_DECK,
            // Единственная стопка «Я», лежащая не в пазу-лепестке, а на краю поля:
            // разворачивать её «от центра» незачем, она лежит ровно, как на столе.
            spin: 0,
            back: `${deck.dir}/start-back.png`,
            faces: Array.from({ length: deck.start }, (_, i) => `${deck.dir}/start-${i + 1}.jpg`),
        },
        ...TYPES.map((type) => ({
            id: type.id,
            name: type.name,
            color: type.color,
            at: type.deck,
            back: `${deck.dir}/${type.id}-back.png`,
            faces: Array.from({ length: deck.type }, (_, i) => `${deck.dir}/${type.id}-${i + 1}.jpg`),
        })),
    ];
}

export const YA_STACKS = yaStacks();
