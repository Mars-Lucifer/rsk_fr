// Проверки таблицы артефактов. Файл сгенерирован из docx, и ошибка разбора здесь молчалива:
// пустая клетка даёт пустую панель, а не падение, и заметить это можно только кликнув в неё.

import assert from "node:assert/strict";
import test from "node:test";

import { CELLS, TRANSITIONS, cellOf, transitionTo } from "./artifacts.mjs";
import { LEVELS, RAYS } from "./zvezda.mjs";

test("тридцать шесть клеток: каждый луч на каждом уровне", () => {
    assert.deepEqual(Object.keys(CELLS).sort(), RAYS.map((r) => r.id).sort());
    for (const ray of RAYS) {
        for (const level of LEVELS) {
            const cell = cellOf(ray.id, level.n);
            assert.ok(cell, `нет клетки ${ray.id} × ${level.n}`);
            assert.ok(cell.artifacts.length >= 4, `${ray.id} × ${level.n}: артефактов ${cell.artifacts.length}`);
            assert.ok(cell.indicators.length >= 4, `${ray.id} × ${level.n}: индикаторов ${cell.indicators.length}`);
            assert.ok(cell.lead.length > 20, `${ray.id} × ${level.n}: пустая шапка`);
        }
    }
});

test("нижний уровень описан через отсутствие, остальные — через наличие", () => {
    // В первоисточнике клетки уровня −1 состоят из «Отсутствие…» и «Все вручную…»: Хаос
    // определяется тем, чего нет. Отсюда галочки на всех уровнях, кроме первого, и крестики
    // на первом — если разбор перепутает, интерфейс будет утверждать обратное методике.
    for (const ray of RAYS) {
        const chaos = cellOf(ray.id, 1).artifacts.join(" ");
        assert.match(chaos, /Отсутств|вручную|только|стихийно|разрозненн|интуитивно|стикер/i, `${ray.id}: уровень −1 не читается как отсутствие`);
    }
});

test("критерии перехода покрывают все пять переходов", () => {
    assert.equal(TRANSITIONS.length, LEVELS.length - 1);
    for (let n = 2; n <= LEVELS.length; n += 1) {
        const step = transitionTo(n);
        assert.ok(step, `нет критерия перехода на уровень ${n}`);
        assert.equal(step.from, n - 1);
        assert.ok(step.static.length > 20 && step.dynamic.length > 20);
    }
    assert.equal(transitionTo(1), null, "на нижний уровень не переходят");
});

test("шапки клеток различны: одинаковая строка означает ошибку сжатия", () => {
    const leads = RAYS.flatMap((r) => LEVELS.map((l) => cellOf(r.id, l.n).lead));
    assert.equal(new Set(leads).size, leads.length);
});
