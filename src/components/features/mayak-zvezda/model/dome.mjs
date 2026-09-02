// Купол: организация как строение из блоков.
//
// Один блок — один артефакт из таблицы 8.0. Сектор купола — луч, ярус — уровень зрелости.
// Уровень организации это то, докуда купол достроен: ярусы до текущего стоят камнем, выше —
// только каркас. Комната показывала обстановку, купол показывает достроенность, а шкала ИЦЗ
// именно про неё.
//
// Ни three, ни React: геометрия считается в тесте без сцены. Ориентация блока здесь не
// вычисляется намеренно — её даёт `lookAt` на центр уже в сцене, это короче и устойчивее
// ручных углов Эйлера.

import { CELLS } from "./artifacts.mjs";
import { LEVELS, RAYS } from "./zvezda.mjs";

export const R = 1.5;

// Купол не сходится в точку: сверху остаётся окулюс. Две причины, обе не декоративные —
// у полюса блок вырождается в нить (ширина идёт как sin θ), а шестой уровень в первоисточнике
// визионерский, и «достроено наглухо» про него говорить нельзя.
const THETA_BASE = 90;
const THETA_TOP = 24;
const BAND = (THETA_BASE - THETA_TOP) / LEVELS.length;

// Зазор между блоками. Без него купол читается сплошной скорлупой, и то, что он собран
// из отдельных вещей, пропадает — а это и есть содержание.
const GAP = 0.88;

const rad = (deg) => (deg * Math.PI) / 180;

export function bandTheta(level) {
    return THETA_BASE - (level - 0.5) * BAND;
}

// Все блоки купола. Порядок устойчив: луч, потом уровень, потом позиция в ярусе.
export function blocks() {
    const out = [];
    RAYS.forEach((ray, r) => {
        LEVELS.forEach((level) => {
            const cell = CELLS[ray.id][level.n];
            const k = cell.artifacts.length;
            const theta = rad(bandTheta(level.n));
            const sin = Math.sin(theta);
            for (let i = 0; i < k; i += 1) {
                const phi = rad(r * 60 + ((i + 0.5) / k) * 60);
                out.push({
                    key: `${ray.id}-${level.n}-${i}`,
                    ray: ray.id,
                    level: level.n,
                    index: i,
                    artifact: cell.artifacts[i],
                    position: [R * sin * Math.cos(phi), R * Math.cos(theta), R * sin * Math.sin(phi)],
                    // Ширина блока сжимается вместе с ярусом: на окружности радиуса R·sinθ
                    // шестая часть круга делится на k блоков.
                    size: [((R * sin * Math.PI) / 3 / k) * GAP, ((R * rad(BAND)) * GAP), 0.075],
                });
            }
        });
    });
    return out;
}

// Точка, куда смотрит камера при выборе луча: середина сектора на текущем ярусе, отодвинутая
// наружу. Считается здесь, а не в сцене, чтобы её можно было проверить без рендера.
export function rayAnchor(rayId, level, out = 2.6) {
    const r = RAYS.findIndex((x) => x.id === rayId);
    const theta = rad(bandTheta(level));
    const phi = rad(r * 60 + 30);
    const sin = Math.sin(theta);
    return [out * sin * Math.cos(phi), out * Math.cos(theta), out * sin * Math.sin(phi)];
}

// Метка луча на поверхности купола: та же точка, но на самом куполе.
export function rayMarker(rayId, level) {
    return rayAnchor(rayId, level, R * 1.02);
}
