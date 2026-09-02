// Геометрия набросков. Чистые функции без React и без three: считаются в тесте, рисуются в SVG.
//
// Наброски нужны, чтобы выбрать подход глазами, а не по описанию. Поэтому данные здесь честные —
// те же шесть лучей и шесть уровней, что в модели, — а исполнение намеренно черновое.

import { LEVELS, RAYS } from "../model/zvezda.mjs";

// Тон на луч. Светлота у всех шести примерно одна (~65 L*), иначе один луч забивает остальные и
// читается как «главный», а по методике они равноправны.
//
// Два луча на букву «З» — Знания и Защита — разведены и по кругу, и по тону максимально далеко:
// янтарь против лилового. Буква их не различает, цвет обязан.
export const RAY_COLOR = {
    knowledge: "#ffc24b",
    interaction: "#4be0c8",
    space: "#6b90ff",
    security: "#c58bff",
    data: "#b9f24b",
    automation: "#ff7a5c",
};

export const INK = {
    bg: "#0b1020",
    panel: "#121a2e",
    grid: "#1e2a45",
    ring: "#2a3556",
    text: "#f4efe6",
    dim: "rgba(244,239,230,0.45)",
};

export const VIEW = 1000;
export const CENTER = VIEW / 2;

// Радиусы колец. Последний шаг больше остальных намеренно: шестой уровень в первоисточнике
// оговорён как визионерский, он не такая же ступень, и стоять вплотную к пятой не должен.
export const RING_R = [90, 140, 190, 240, 290, 346];

// Первый луч смотрит вверх, дальше против часовой — порядок задан буквами З-В-Е-З-Д-А
// и не сортируется.
export function rayAngle(index) {
    return -Math.PI / 2 + (index * Math.PI) / 3;
}

export function pointAt(angle, radius) {
    return [CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius];
}

// Вершина луча на уровне n (1..6). Уровень 0 означает «ещё не начали» и садится в центр.
export function vertex(rayIndex, level) {
    const r = level > 0 ? RING_R[level - 1] : 18;
    return pointAt(rayAngle(rayIndex), r);
}

export function ringPolygon(radius) {
    return RAYS.map((_, i) => pointAt(rayAngle(i), radius).map((v) => v.toFixed(1)).join(",")).join(" ");
}

export function profilePolygon(levels) {
    return levels.map((level, i) => vertex(i, level).map((v) => v.toFixed(1)).join(",")).join(" ");
}

// Витки спирали вдоль одного луча: от уровня 1 до текущего. Радиус растёт вместе с углом,
// поэтому виток не замыкается — конец каждого оборота оказывается на кольцо дальше начала.
// Именно незамкнутость и отличает спираль от круга, и её должно быть видно.
export function spiralPath(rayIndex, upTo, turns = 48) {
    const base = rayAngle(rayIndex);
    const points = [];
    for (let level = 1; level < upTo; level += 1) {
        const from = RING_R[level - 1];
        const to = RING_R[level];
        for (let s = 0; s <= turns; s += 1) {
            const t = s / turns;
            // Радиус растёт неравномерно: две трети оборота вершина почти стоит, рывок — в конце.
            // Это тезис методики: уровень поднимается, когда цикл пройден, а не когда завезли технику.
            const ramp = t < 2 / 3 ? 0.3 * (t / (2 / 3)) ** 1.6 : 0.3 + 0.7 * ((t - 2 / 3) / (1 / 3)) ** 0.8;
            points.push(pointAt(base + t * Math.PI * 2, from + (to - from) * ramp));
        }
    }
    return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

// Демонстрационный профиль: организация развита неравномерно, и это нормально — модель ровно
// про это. Ровная шестёрка выглядела бы как «всё хорошо» и ничего не объясняла.
export const DEMO_LEVELS = [3, 2, 4, 2, 3, 1];

export { LEVELS, RAYS };
