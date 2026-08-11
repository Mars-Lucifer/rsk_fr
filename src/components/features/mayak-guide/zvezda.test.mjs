// node --test src/components/features/mayak-guide/*.test.mjs
//
// Каталогом, как написано в шапке fieldLayout.test.mjs, на текущем Node не запускается:
// он пытается загрузить каталог как модуль и падает с MODULE_NOT_FOUND. Нужна маска.
//
// Проверяется то, что легко разъезжается при правках руками: состав модели ЗВЕЗДЫ,
// порядок фаз цикла и связность истории кадров с фазами и файлами.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { LEVELS, RAYS, TOTAL_TASKS, levelByStars } from "./zvezda.mjs";
import { PHASES, SHIFTS, nextPhase } from "./ssd.mjs";
import { FRAMES, MAX_LEVEL, ORG_KINDS, holdOf } from "./levelStory.mjs";

test("шесть направлений, id уникальны, буквы — нет", () => {
    assert.equal(RAYS.length, 6);
    assert.equal(new Set(RAYS.map((ray) => ray.id)).size, 6);
    // «З» стоит у Знаний и у Защиты: если буквы вдруг стали уникальными, кто-то
    // переименовал направление и сломал соответствие аббревиатуре ЗВЕЗДА.
    assert.equal(new Set(RAYS.map((ray) => ray.letter)).size, 5);
    assert.deepEqual(RAYS.map((ray) => ray.letter).join(""), "ЗВЕЗДА");
});

test("шесть уровней, сетка задач 3/3/5/5/7/7, всего 180", () => {
    assert.equal(LEVELS.length, 6);
    assert.deepEqual(LEVELS.map((level) => level.stars), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(LEVELS.map((level) => level.perRay), [3, 3, 5, 5, 7, 7]);
    assert.equal(TOTAL_TASKS, 180);
    assert.equal(levelByStars(3).id, "system");
    assert.equal(levelByStars(9), null);
    // Шестой уровень в первоисточнике оговорён как визионерский, не как обычная ступень.
    assert.equal(LEVELS.at(-1).visionary, true);
});

test("три фазы цикла в неизменном порядке, цикл замкнут", () => {
    assert.deepEqual(PHASES.map((phase) => phase.id), ["environment", "mind", "activity"]);
    assert.equal(nextPhase("activity").id, "environment");
    assert.equal(nextPhase("нет такой"), null);
    // Переходы разной природы: один внутрь, другой наружу.
    assert.deepEqual(SHIFTS.map((shift) => shift.dir), ["внутрь", "наружу"]);
});





test("кадры истории: файлы на месте, уровень растёт только в конце цикла", () => {
    const publicDir = fileURLToPath(new URL("../../../../public", import.meta.url));
    const phaseIds = new Set(PHASES.map((phase) => phase.id));

    for (const [index, frame] of FRAMES.entries()) {
        assert.ok(existsSync(publicDir + frame.src), `кадр ${index}: нет файла ${frame.src}`);
        assert.ok(frame.phase === null || phaseIds.has(frame.phase), `кадр ${index}: фазы ${frame.phase} нет`);
        assert.ok(frame.level >= 1 && frame.level <= MAX_LEVEL, `кадр ${index}: уровень вне шкалы`);
        assert.ok(frame.caption.length > 0, `кадр ${index}: пустая подпись`);
        assert.ok(holdOf(frame) >= 3000, `кадр ${index}: выдержка короче трёх секунд`);
    }

    // Пока цикл не пройден целиком, уровень не поднимается: технику завезли — это ещё не
    // новый уровень. Значит уровень меняется только на кадре покоя, никогда на фазе.
    for (let index = 1; index < FRAMES.length; index += 1) {
        if (FRAMES[index].level === FRAMES[index - 1].level) continue;
        assert.equal(FRAMES[index].phase, null, `кадр ${index}: уровень поднялся посреди цикла`);
    }

    // Все три фазы должны быть в истории, иначе переход показан неполным.
    assert.deepEqual(
        FRAMES.filter((frame) => frame.phase).map((frame) => frame.phase),
        ["environment", "mind", "activity"]
    );

    // Типов организации несколько и они разные — на одном универсальность не показать.
    assert.ok(ORG_KINDS.length >= 3);
    assert.equal(new Set(ORG_KINDS).size, ORG_KINDS.length);
});
