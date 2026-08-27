// node --test src/components/features/mayak-guide/guideRules.test.mjs
//
// Правила прохождения проверяются не глазами: маршрут из пятнадцати тактов, и ошибка в
// одном переходе видна только на живом занятии, когда шестеро уже сели за стол.

import test from "node:test";
import assert from "node:assert/strict";

import { TYPE_IDS, acceptBlocker, allowedCells, canMove, nextTakt, pendingSeats, specPath, taktDeals, targetCell } from "./guideRules.mjs";

const seat = (index, extra = {}) => ({ index, memberId: `m${index}`, name: `И${index + 1}`, cell: null, typeId: "", ...extra });
const room = (extra = {}) => ({ phase: 0, taktIndex: 0, seats: [seat(0), seat(1)], ...extra });

test("в начале открыт только СТАРТ", () => {
    const r = room();
    assert.deepEqual(allowedCells(r, r.seats[0]), ["start"]);
    assert.equal(canMove(r, r.seats[0], "start"), true);
    assert.equal(canMove(r, r.seats[0], "inner:0"), false);
    assert.equal(canMove(r, r.seats[0], "type:video:ray:2"), false, "прыжок на финиш закрыт");
});

test("стоящему на клетке такта ходить некуда", () => {
    const r = room({ seats: [seat(0, { cell: "start" })] });
    assert.deepEqual(allowedCells(r, r.seats[0]), []);
});

test("внутренний круг обходится по часовой, такт за тактом", () => {
    for (let takt = 0; takt < 4; takt += 1) {
        const r = room({ phase: 1, taktIndex: takt });
        assert.deepEqual(allowedCells(r, r.seats[0]), [`inner:${takt}`]);
        assert.equal(canMove(r, r.seats[0], `inner:${(takt + 2) % 4}`), false, "прыжок через такт закрыт");
    }
});

test("кольцо типов идёт в порядке TYPES", () => {
    TYPE_IDS.forEach((id, takt) => {
        const r = room({ phase: 2, taktIndex: takt });
        assert.deepEqual(allowedCells(r, r.seats[0]), [`type:${id}:sector`]);
    });
});

test("на специализации открыт только свой луч", () => {
    const mine = seat(0, { typeId: "audio", cell: "type:audio:sector" });
    const r = room({ phase: 3, taktIndex: 1, seats: [mine] });
    assert.deepEqual(allowedCells(r, mine), ["type:audio:ray:0"]);
    assert.equal(canMove(r, mine, "type:text:ray:0"), false, "чужой луч закрыт");
});

test("без выбранного типа на специализации ходить некуда", () => {
    const r = room({ phase: 3, taktIndex: 0, seats: [seat(0)] });
    assert.deepEqual(allowedCells(r, r.seats[0]), []);
    assert.match(acceptBlocker(r), /направление/);
});

test("путь специализации — сектор и три гекса луча", () => {
    assert.deepEqual(specPath("data"), [
        "type:data:sector",
        "type:data:ray:0",
        "type:data:ray:1",
        "type:data:ray:2",
    ]);
});

test("такты идут по фазам и кончаются итогом", () => {
    const chain = [];
    let cursor = { phase: 0, taktIndex: 0 };
    for (let guard = 0; guard < 40 && cursor; guard += 1) {
        chain.push(`${cursor.phase}:${cursor.taktIndex}`);
        cursor = nextTakt({ ...room(), ...cursor });
    }
    assert.equal(chain.length, 16, "1 сбор + 4 внутренних + 6 кольца + 4 специализации + итог");
    assert.equal(chain.at(0), "0:0");
    assert.equal(chain.at(-1), "4:0", "последняя — фаза итога");
    assert.equal(nextTakt({ ...room(), phase: 4, taktIndex: 0 }), null, "после итога ходов нет");
});

test("карты такта: команде одна, на специализации каждому своя", () => {
    assert.deepEqual(taktDeals({ ...room(), phase: 1, taktIndex: 0 }), [{ stack: "start", slot: "team" }]);
    assert.deepEqual(taktDeals({ ...room(), phase: 2, taktIndex: 3 }), [{ stack: "interactive", slot: "team" }]);

    const seats = [seat(0, { typeId: "text" }), seat(1, { typeId: "data" }), seat(2, { memberId: "" })];
    const deals = taktDeals({ ...room(), phase: 3, taktIndex: 0, seats });
    assert.deepEqual(deals, [
        { stack: "text", slot: "seat", seatIndex: 0 },
        { stack: "data", slot: "seat", seatIndex: 1 },
    ], "пустому месту карта не выдаётся");
});

test("сбор на СТАРТ карт не выдаёт", () => {
    assert.deepEqual(taktDeals(room()), []);
});

test("в специализацию не пускают без выбранных направлений", () => {
    // Последний такт кольца: следующий шаг — расхождение по лучам, и карты придут из
    // стопок выбранных типов. Без типа стол остался бы пустым.
    const last = room({ phase: 2, taktIndex: 5, seats: [seat(0, { cell: "type:video:sector" }), seat(1, { cell: "type:video:sector" })] });
    assert.match(acceptBlocker(last), /направление/);

    const chosen = room({
        phase: 2,
        taktIndex: 5,
        seats: [seat(0, { cell: "type:video:sector", typeId: "text" }), seat(1, { cell: "type:video:sector", typeId: "data" })],
    });
    assert.equal(acceptBlocker(chosen), "");
});

test("такт не принимается, пока команда не собралась", () => {
    const waiting = room({ phase: 1, taktIndex: 0, seats: [seat(0, { cell: "inner:0" }), seat(1, { cell: "start" })] });
    assert.match(acceptBlocker(waiting), /Не дошли: И2/);

    const ready = room({ phase: 1, taktIndex: 0, seats: [seat(0, { cell: "inner:0" }), seat(1, { cell: "inner:0" })] });
    assert.equal(acceptBlocker(ready), "");
    assert.deepEqual(pendingSeats(ready), []);
});

test("пустые места не держат такт", () => {
    const r = room({ phase: 1, taktIndex: 0, seats: [seat(0, { cell: "inner:0" }), { index: 1, memberId: "", cell: null }] });
    assert.equal(acceptBlocker(r), "");
});

test("на итоге клетка не открывается", () => {
    const r = room({ phase: 4, taktIndex: 0 });
    assert.equal(targetCell(r, r.seats[0]), null);
    assert.deepEqual(allowedCells(r, r.seats[0]), []);
});
