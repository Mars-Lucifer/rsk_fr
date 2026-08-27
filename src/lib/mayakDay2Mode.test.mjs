// node --test src/lib/mayakDay2Mode.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { isDay2Section, findDay2TaskIndex, formatDay2TaskNumber } from "./mayakDay2Mode.js";

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

test("служебный ключ переходника не показывается человеку как есть", () => {
    assert.equal(formatDay2TaskNumber("13-14:adapter"), "13-14 · переходник");
    // Первому дню функция ничего не меняет.
    assert.equal(formatDay2TaskNumber("13-14"), "13-14");
    assert.equal(formatDay2TaskNumber("47"), "47");
    assert.equal(formatDay2TaskNumber(null), "");
});
