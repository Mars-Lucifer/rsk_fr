import assert from "node:assert/strict";
import test from "node:test";

import { BASE, GRID, LAYER, LEVEL_ROLES, ROLES, ZONE, matrix, sign } from "./signs.mjs";
import { LEVELS, RAYS } from "./zvezda.mjs";

// Границы фигуры в координатах сетки. Нужны, чтобы поймать знак, вылезший за виewBox:
// в SVG он не падает, а молча обрезается, и на матрице это читается как «кривой знак».
function bounds(shape) {
    switch (shape.k) {
        case "rect":
            return [shape.x, shape.y, shape.x + shape.w, shape.y + shape.h];
        case "circle":
            return [shape.cx - shape.r, shape.cy - shape.r, shape.cx + shape.r, shape.cy + shape.r];
        case "line":
        case "arrow":
            return [Math.min(shape.x1, shape.x2), Math.min(shape.y1, shape.y2), Math.max(shape.x1, shape.x2), Math.max(shape.y1, shape.y2)];
        case "arc":
            // Консервативно: габарит полной окружности. Дуга меньше, но если и круг влезает,
            // то влезает и она — а недооценить границу опаснее, чем переоценить.
            return [shape.cx - shape.r, shape.cy - shape.r, shape.cx + shape.r, shape.cy + shape.r];
        case "poly": {
            const pts = shape.points.split(" ").map((p) => p.split(",").map(Number));
            const xs = pts.map(([x]) => x);
            const ys = pts.map(([, y]) => y);
            return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
        }
        default:
            return null;
    }
}

test("матрица полная: шесть лучей на шесть уровней", () => {
    const rows = matrix();
    assert.equal(rows.length, RAYS.length);
    rows.forEach((row) => {
        assert.equal(row.cells.length, LEVELS.length);
        row.cells.forEach((cell, i) => {
            assert.ok(cell, `${row.ray.id}: клетка ${i + 1} пустая`);
            assert.ok(cell.shapes.length > 0, `${row.ray.id} ${cell.level}: знак без фигур`);
        });
    });
});

test("у каждого луча своя база, и она входит в каждую клетку", () => {
    RAYS.forEach((ray) => {
        const base = BASE[ray.id];
        assert.ok(base && base.length, `${ray.id}: базы нет`);
        LEVELS.forEach((level) => {
            const cell = sign(ray.id, level.n);
            // База идёт первой и целиком: луч обязан узнаваться на всех шести уровнях.
            assert.deepEqual(cell.shapes.slice(0, base.length), base, `${ray.id} ${level.n}: база подменена`);
        });
    });
});

test("уровень кодируется одинаково у всех лучей", () => {
    LEVELS.forEach((level) => {
        const layer = LAYER[level.n];
        assert.ok(layer, `уровень ${level.n}: слоя нет`);
        RAYS.forEach((ray) => {
            const cell = sign(ray.id, level.n);
            const tail = cell.shapes.slice(-layer.shapes.length);
            assert.deepEqual(tail, layer.shapes, `${ray.id} ${level.n}: слой уровня отличается от общего`);
        });
    });
});

test("роли набираются, а не переставляются: набор уровня включает набор предыдущего", () => {
    for (let n = 2; n <= LEVELS.length; n += 1) {
        const prev = LEVEL_ROLES[n - 1];
        const now = LEVEL_ROLES[n];
        prev.forEach((role) => assert.ok(now.includes(role), `уровень ${n} потерял роль ${role}`));
        now.forEach((role) => assert.ok(role in ROLES, `уровень ${n}: роль ${role} не описана`));
    }
    // Три перелома модели. Если они разъедутся, знаки будут рисовать не ту модель.
    assert.ok(!LEVEL_ROLES[2].includes("result") && LEVEL_ROLES[4].includes("result"), "результат обязан появляться на +2");
    assert.ok(!LEVEL_ROLES[4].includes("count") && LEVEL_ROLES[5].includes("count"), "счёт обязан появляться на +3");
    assert.ok(!LEVEL_ROLES[5].includes("initiative") && LEVEL_ROLES[6].includes("initiative"), "инициатива обязана появляться на +4");
});

test("бумага исчезает с уровня +2 и больше не возвращается", () => {
    // Прямоугольник 9 × 7 — лист бумаги. Он есть на первых двух уровнях и не должен
    // появляться дальше: результат стал электронным, это главный перелом шкалы.
    const paper = (shapes) => shapes.filter((s) => s.k === "rect" && s.w === 9 && s.h === 7).length;
    assert.ok(paper(LAYER[1].shapes) > 0, "на «Хаосе» бумаги нет — уровень читается неверно");
    assert.ok(paper(LAYER[2].shapes) > 0, "на «Информировании» бумага обязана остаться");
    [4, 5, 6].forEach((n) => assert.equal(paper(LAYER[n].shapes), 0, `уровень ${n}: бумага вернулась`));
});

test("слой уровня не наезжает на базу", () => {
    // Зоны разведены намеренно: база в середине, слой по краям. Пока они пересекались,
    // кольцо «замкнутого процесса» ложилось поверх предмета и клетка читалась кашей.
    // Бумага уровня −1 из проверки исключена: она лежит по низу вокруг предмета, это её место.
    const [bx1, by1, bx2, by2] = ZONE.base;
    Object.entries(LAYER).forEach(([level, layer]) => {
        if (Number(level) === 1) return;
        layer.shapes.forEach((shape) => {
            const b = bounds(shape);
            if (!b) return;
            const [x1, y1, x2, y2] = b;
            const overlaps = x1 < bx2 - 1 && x2 > bx1 + 1 && y1 < by2 - 1 && y2 > by1 + 1;
            assert.ok(!overlaps, `уровень ${level}: фигура ${shape.k} залезла в зону базы (${b.join(", ")})`);
        });
    });
});

test("ни один знак не выходит за сетку", () => {
    matrix().forEach(({ ray, cells }) => {
        cells.forEach((cell) => {
            cell.shapes.forEach((shape) => {
                const b = bounds(shape);
                if (!b) return;
                const [x1, y1, x2, y2] = b;
                assert.ok(x1 >= 0 && y1 >= 0 && x2 <= GRID && y2 <= GRID, `${ray.id} ${cell.level}: фигура ${shape.k} вне сетки (${b.join(", ")})`);
            });
        });
    });
});
