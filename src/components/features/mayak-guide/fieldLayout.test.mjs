// node --test src/components/features/mayak-guide/
// Проверка одна: раскладка партии не разъехалась и все жетоны лежат на поле, а не мимо.

import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_MM, DIRS, JETON_MM, jetonSlots, pxToMeters } from "./fieldLayout.mjs";

test("36 жетонов, по шесть на направление", () => {
    const slots = jetonSlots();
    assert.equal(slots.length, 36);
    assert.deepEqual(
        DIRS.map((_, dir) => slots.filter((slot) => slot.dir === dir).length),
        [6, 6, 6, 6, 6, 6]
    );
});

test("все жетоны попадают внутрь поля целиком", () => {
    const half = { x: BOARD_MM.w / 2000, z: BOARD_MM.h / 2000 };
    const radius = JETON_MM.diameter / 2000;

    for (const slot of jetonSlots()) {
        const { x, z } = pxToMeters(slot.point);
        assert.ok(Math.abs(x) + radius <= half.x, `${slot.id}: x=${x.toFixed(3)} вылез за край поля`);
        assert.ok(Math.abs(z) + radius <= half.z, `${slot.id}: z=${z.toFixed(3)} вылез за край поля`);
    }
});
