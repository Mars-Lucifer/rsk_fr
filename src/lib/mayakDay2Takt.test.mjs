// node --test src/lib/mayakDay2Takt.test.mjs
//
// Главная проверка одна: такт НЕ ПЕРЕПРЫГИВАЕТСЯ. Участник, набравший номер
// пары до сдачи своей детали, обязан получить отказ с объяснением, а не
// карточку узла. Ступень — принцип конструкции дня, и держать её должна
// система: голос ведущего в зале на восемнадцать человек не держит ничего.
//
// Вторая: такт выводится из сданного и нигде не хранится. Поэтому фикстуры
// здесь — это просто списки статусов, без всякого поля «фаза».

import test from "node:test";
import assert from "node:assert/strict";

import { computeDay2Takt, canOpenDay2, day2KeysFor } from "./mayakDay2Takt.js";
import { parseDay2Input } from "./mayakDay2Input.js";

const open = (state, raw) => canOpenDay2({ state, parsed: parseDay2Input(raw) });

test("ключи считаются из номера, спрашивать не надо", () => {
    assert.deepEqual(day2KeysFor(13), {
        detail: "13", partner: 14, node: "13-14", adapter: "13-14:adapter", assembly: "10", table: 1,
    });
    // у чётного партнёр младше, а ключ узла всё равно по возрастанию
    assert.equal(day2KeysFor(14).node, "13-14");
    assert.equal(day2KeysFor(36).node, "35-36");
    assert.equal(day2KeysFor(21).assembly, "20");
});

test("пока деталь не сдана — такт первый", () => {
    for (const tasks of [[], [{ key: "13", status: "pending_review" }], [{ key: "13", status: "rejected" }]]) {
        const state = computeDay2Takt({ myNumber: 13, tasks });
        assert.equal(state.takt, "DETAIL");
        assert.equal(state.label, "Такт 1 · деталь");
    }
});

test("деталь сдана — такт второй, и в подписи стоит номер узла", () => {
    const state = computeDay2Takt({ myNumber: 13, tasks: [{ key: "13", status: "approved" }] });
    assert.equal(state.takt, "NODE");
    assert.equal(state.label, "Такт 2 · узел 13+14");
});

test("узел сдан — такт третий", () => {
    const state = computeDay2Takt({
        myNumber: 13,
        tasks: [{ key: "13", status: "approved" }, { key: "13-14", status: "approved" }],
    });
    assert.equal(state.takt, "PRODUCT");
    assert.equal(state.label, "Такт 3 · изделие");
});

test("такт не перепрыгивается: узел до сдачи детали закрыт", () => {
    const state = computeDay2Takt({ myNumber: 13, tasks: [] });
    const node = open(state, "13 14");
    assert.equal(node.ok, false);
    assert.equal(node.reason, "too-early");
    assert.match(node.hint, /13/);

    const assembly = open(state, "среда");
    assert.equal(assembly.ok, false);
    assert.equal(assembly.reason, "too-early");
});

test("изделие закрыто, пока не сдан узел", () => {
    const state = computeDay2Takt({ myNumber: 13, tasks: [{ key: "13", status: "approved" }] });
    const result = open(state, "среда");
    assert.equal(result.ok, false);
    assert.match(result.hint, /узел 13 14/);
});

test("своя деталь открыта и на втором такте — свериться, что отдаёшь", () => {
    const state = computeDay2Takt({ myNumber: 13, tasks: [{ key: "13", status: "approved" }] });
    assert.equal(open(state, "13").ok, true);
    assert.equal(open(state, "13 14").ok, true);
    assert.equal(open(state, "13 14 не сошлось").ok, true);
});

test("чужая деталь и чужой стол не открываются", () => {
    const state = computeDay2Takt({ myNumber: 13, tasks: [{ key: "13", status: "approved" }] });

    const foreign = open(state, "11");
    assert.equal(foreign.ok, false);
    assert.equal(foreign.reason, "not-mine");
    assert.match(foreign.hint, /13/);

    const otherTable = open(state, "23");
    assert.equal(otherTable.ok, false);
    assert.equal(otherTable.reason, "other-table");
});
