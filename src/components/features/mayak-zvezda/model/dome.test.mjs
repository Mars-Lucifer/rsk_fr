import assert from "node:assert/strict";
import test from "node:test";

import { CELLS } from "./artifacts.mjs";
import { LEVELS, RAYS } from "./zvezda.mjs";
import { R, bandTheta, blocks, rayMarker } from "./dome.mjs";

const ALL = blocks();

test("блок на каждый артефакт, и ни одного лишнего", () => {
    const expected = RAYS.reduce((sum, ray) => sum + LEVELS.reduce((s, l) => s + CELLS[ray.id][l.n].artifacts.length, 0), 0);
    assert.equal(ALL.length, expected);
    assert.equal(new Set(ALL.map((b) => b.key)).size, ALL.length);
});

test("все блоки лежат на сфере радиуса R", () => {
    for (const b of ALL) {
        const len = Math.hypot(...b.position);
        assert.ok(Math.abs(len - R) < 1e-9, `${b.key}: радиус ${len}`);
    }
});

test("ярус выше — блок выше, и купол не сходится в точку", () => {
    // Высота блока задаётся только ярусом, поэтому сравнение по одному лучу исчерпывающее.
    const byLevel = LEVELS.map((l) => ALL.find((b) => b.ray === "knowledge" && b.level === l.n).position[1]);
    for (let i = 1; i < byLevel.length; i += 1) assert.ok(byLevel[i] > byLevel[i - 1], `ярус ${i + 1} не выше предыдущего`);
    // Окулюс: верхний ярус не дотягивает до полюса, иначе блок вырождается в нить.
    assert.ok(byLevel.at(-1) < R * 0.95, "верхний ярус упёрся в полюс");
});

test("ширина блока положительна на всех ярусах", () => {
    for (const b of ALL) {
        assert.ok(b.size[0] > 0.02, `${b.key}: ширина ${b.size[0]}`);
        assert.ok(b.size[1] > 0.02, `${b.key}: высота ${b.size[1]}`);
    }
});

test("блоки одного луча стоят в своём секторе и не залезают в соседний", () => {
    for (const [r, ray] of RAYS.entries()) {
        for (const b of ALL.filter((x) => x.ray === ray.id)) {
            const phi = ((Math.atan2(b.position[2], b.position[0]) * 180) / Math.PI + 360) % 360;
            const from = r * 60;
            assert.ok(phi > from && phi < from + 60, `${b.key}: азимут ${phi.toFixed(1)} вне сектора ${from}..${from + 60}`);
        }
    }
});

test("метка луча стоит снаружи купола, но рядом с ним", () => {
    for (const ray of RAYS) {
        const len = Math.hypot(...rayMarker(ray.id, 3));
        assert.ok(len > R && len < R * 1.1, `${ray.id}: метка на радиусе ${len}`);
    }
});

test("полярный угол яруса убывает от основания к верху", () => {
    const thetas = LEVELS.map((l) => bandTheta(l.n));
    for (let i = 1; i < thetas.length; i += 1) assert.ok(thetas[i] < thetas[i - 1]);
    assert.ok(thetas[0] < 90, "нижний ярус не должен лежать ровно на экваторе");
});
