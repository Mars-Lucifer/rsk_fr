// node --test src/lib/mayakDay2Input.test.mjs
//
// Проверок две, и обе про то, из-за чего день ломается в зале, а не в коде.
//
// Первая: порядок номеров в паре не значит ничего. `14 13` и `13 14` обязаны
// дать один ключ — иначе в рантайме заведутся две записи на один узел,
// и аналитика посчитает шесть узлов вместо трёх.
//
// Вторая: неверный ввод обязан объяснять себя. Участник в 12:40 набирает
// `13 15`, и «не понял» ему не поможет — нужно «партнёр 13 это 14».

import test from "node:test";
import assert from "node:assert/strict";

import { parseDay2Input } from "./mayakDay2Input.js";

test("деталь открывается номером", () => {
    const result = parseDay2Input("13");
    assert.equal(result.ok, true);
    assert.equal(result.kind, "detail");
    assert.equal(result.key, "13");
    assert.equal(result.table, 1);
});

test("узел собирается любым разделителем и в любом порядке", () => {
    const keys = ["13 14", "13-14", "1314", "14 13", "13,14", "  13   14  "]
        .map((raw) => parseDay2Input(raw));
    for (const result of keys) {
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.equal(result.kind, "node");
        assert.equal(result.key, "13-14");
        assert.deepEqual(result.numbers, [13, 14]);
    }
});

test("переходник отличается от узла, но ключ пары тот же", () => {
    for (const raw of ["13 14 не сошлось", "1314 НЕ СОШЛИСЬ", "14-13 не сошёлся"]) {
        const result = parseDay2Input(raw);
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.equal(result.kind, "adapter");
        assert.equal(result.key, "13-14:adapter");
    }
});

test("изделие открывается словом стола и номером места сборки", () => {
    for (const raw of ["среда", "СРЕДА", " Среда "]) {
        const result = parseDay2Input(raw);
        assert.equal(result.ok, true);
        assert.equal(result.kind, "assembly");
        assert.equal(result.key, "10");
    }
    assert.equal(parseDay2Input("деятельность").key, "20");
    assert.equal(parseDay2Input("сознание").key, "30");
    assert.equal(parseDay2Input("30").kind, "assembly");
});

test("не-пара объясняет, кто чей партнёр", () => {
    const result = parseDay2Input("13 15");
    assert.equal(result.ok, false);
    assert.equal(result.reason, "not-partners");
    assert.match(result.hint, /14/);
});

test("номера с разных столов не соединяются", () => {
    const result = parseDay2Input("13 24");
    assert.equal(result.ok, false);
    assert.equal(result.reason, "different-tables");
});

test("несуществующий номер называется прямо", () => {
    const result = parseDay2Input("19");
    assert.equal(result.ok, false);
    assert.equal(result.reason, "no-such-number");
    assert.match(result.hint, /19/);
});

test("мусор и пустое не проходят молча", () => {
    assert.equal(parseDay2Input("").reason, "empty");
    assert.equal(parseDay2Input("   ").reason, "empty");
    assert.equal(parseDay2Input("абвгд").reason, "unknown");
    assert.equal(parseDay2Input("13 13").reason, "same-number");
    assert.equal(parseDay2Input("13 14 15").reason, "too-many");
    assert.equal(parseDay2Input("не сошлось").reason, "adapter-needs-pair");
    assert.equal(parseDay2Input("10 11").reason, "centre-in-pair");
});
