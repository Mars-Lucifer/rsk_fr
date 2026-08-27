import assert from "node:assert/strict";
import test from "node:test";

import { LESSONS, ROLE_DROP_ORDER, lessonById, tableSplit } from "./lessons.mjs";

test("группа кратна шести — все столы полные, роли не выпадают", () => {
    const split = tableSplit(18);
    assert.equal(split.tables, 3);
    assert.equal(split.full, 3);
    assert.equal(split.rest, 0);
    assert.deepEqual(split.dropped, []);
});

test("пятнадцать человек — три стола, на неполном выпадают три роли", () => {
    // Тот самый случай со встречи: «у нас 15 человек». Три стола, третий на три
    // человека, инспектор и капитан остаются.
    const split = tableSplit(15);
    assert.equal(split.tables, 3);
    assert.equal(split.rest, 3);
    assert.equal(split.dropped.length, 3);
    assert.ok(!split.dropped.includes("Инспектор"));
    assert.ok(!split.dropped.includes("Капитан"));
});

test("порядок выпадения ролей начинается с летописца", () => {
    assert.equal(ROLE_DROP_ORDER[0], "Летописец");
    assert.equal(tableSplit(11).dropped.length, 1);
    assert.deepEqual(tableSplit(11).dropped, ["Летописец"]);
});

test("один стол — предупреждение про кольцо проверки", () => {
    assert.match(tableSplit(6).warning, /кольца проверки нет/);
    assert.equal(tableSplit(18).warning, "");
});

test("пустая группа не даёт столов", () => {
    assert.deepEqual(tableSplit(0), { tables: 0, full: 0, rest: 0, dropped: [], warning: "" });
    assert.equal(tableSplit("").tables, 0);
    assert.equal(tableSplit(-4).tables, 0);
});

test("у каждого урока есть адрес и он совпадает с id", () => {
    LESSONS.forEach((lesson) => {
        assert.equal(lesson.url, `/mayak-guide/lesson/${lesson.id}`);
        assert.ok(lesson.blocks.length > 0);
        assert.equal(lessonById(lesson.id), lesson);
    });
    assert.equal(lessonById("нет такого"), null);
});
