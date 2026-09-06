// Паритет коротких формулировок с первоисточником.
//
// Смысл теста один: короткая таблица обязана быть зеркалом дословной. Если методисты
// добавят в клетку пункт, а сюда его не перенесут, панель молча покажет старый набор —
// расхождение видно только этим сравнением.

import assert from "node:assert/strict";
import test from "node:test";

import { CELLS } from "../artifacts.mjs";
import { RAYS, LEVELS } from "../zvezda.mjs";
import { SHORT_CELLS, shortCell } from "./index.mjs";

test("у каждого луча и уровня есть короткая клетка", () => {
    RAYS.forEach((ray) => {
        assert.ok(SHORT_CELLS[ray.id], `${ray.id}: нет коротких формулировок`);
        LEVELS.forEach((lv) => {
            assert.ok(shortCell(ray.id, lv.n), `${ray.id} × ${lv.n}: клетка пустая`);
        });
    });
});

test("количество пунктов совпадает с дословной таблицей", () => {
    RAYS.forEach((ray) => {
        LEVELS.forEach((lv) => {
            const full = CELLS[ray.id][lv.n];
            const short = shortCell(ray.id, lv.n);
            assert.equal(short.artifacts.length, full.artifacts.length, `${ray.id} × ${lv.n}: артефактов не столько`);
            assert.equal(short.indicators.length, full.indicators.length, `${ray.id} × ${lv.n}: индикаторов не столько`);
        });
    });
});

test("короткое действительно короче: пункт до 60 знаков, шапка до 60", () => {
    RAYS.forEach((ray) => {
        LEVELS.forEach((lv) => {
            const short = shortCell(ray.id, lv.n);
            assert.ok(short.lead.length <= 60, `${ray.id} × ${lv.n}: шапка длиннее 60 знаков`);
            [...short.artifacts, ...short.indicators].forEach((line) => {
                assert.ok(line.length <= 60, `${ray.id} × ${lv.n}: «${line}» длиннее 60 знаков`);
            });
        });
    });
});
