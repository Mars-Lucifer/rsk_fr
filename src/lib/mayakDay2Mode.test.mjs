// node --test src/lib/mayakDay2Mode.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { isDay2Section, findDay2TaskIndex, formatDay2TaskNumber, day2AccentColors } from "./mayakDay2Mode.js";

test("режим включается слогом секции, а не номером", () => {
    assert.equal(isDay2Section("day2"), true);
    assert.equal(isDay2Section(" day2 "), true);
    assert.equal(isDay2Section("201-300"), false);
    assert.equal(isDay2Section(null), false);
});

test("карточка ищется по номеру, включая узел и переходник", () => {
    const tasks = [{ number: "10" }, { number: "13" }, { number: "13-14" }, { number: "13-14:adapter" }];
    assert.equal(findDay2TaskIndex(tasks, "13"), 1);
    assert.equal(findDay2TaskIndex(tasks, "13-14"), 2);
    // Переходник — отдельная карточка: срезать суффикс значит показать
    // на «не сошлось» тот же экран, что и на «сошлось».
    assert.equal(findDay2TaskIndex(tasks, "13-14:adapter"), 3);
    assert.equal(findDay2TaskIndex(tasks, "99"), -1);
});

test("у всех шести лучей есть цвет из общего источника", () => {
    // Если в fieldLayout.mjs переименуют направление, падает здесь — а не в зале
    // серой карточкой при оранжевом тайле в руке.
    for (let tile = 11; tile <= 16; tile += 1) {
        const colors = day2AccentColors(tile);
        assert.equal(colors.length, 1, `луч ${tile} остался без цвета`);
        assert.match(colors[0], /^#[0-9a-f]{6}$/i);
    }
    // Один и тот же луч на трёх столах — один цвет: номер это координата.
    assert.deepEqual(day2AccentColors(13), day2AccentColors(23));
    assert.deepEqual(day2AccentColors(13), day2AccentColors(33));
});

test("у узла и переходника полоса из двух цветов, как грань на картоне", () => {
    const node = day2AccentColors("13-14");
    assert.equal(node.length, 2);
    assert.deepEqual(node, [...day2AccentColors(13), ...day2AccentColors(14)]);
    assert.deepEqual(day2AccentColors("13-14:adapter"), node);
});

test("изделие красится в цвет стола, а не луча", () => {
    assert.equal(day2AccentColors(10).length, 1);
    assert.notDeepEqual(day2AccentColors(10), day2AccentColors(20));
    assert.notDeepEqual(day2AccentColors(20), day2AccentColors(30));
    assert.deepEqual(day2AccentColors("нет"), []);
});

test("служебный ключ переходника не показывается человеку как есть", () => {
    assert.equal(formatDay2TaskNumber("13-14:adapter"), "13-14 · переходник");
    // Первому дню функция ничего не меняет.
    assert.equal(formatDay2TaskNumber("13-14"), "13-14");
    assert.equal(formatDay2TaskNumber("47"), "47");
    assert.equal(formatDay2TaskNumber(null), "");
});
