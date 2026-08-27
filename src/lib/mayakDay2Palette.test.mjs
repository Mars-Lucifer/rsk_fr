// node --test src/lib/mayakDay2Palette.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { day2AccentColors } from "./mayakDay2Palette.js";

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
