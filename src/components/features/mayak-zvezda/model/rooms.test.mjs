// Проверки модели комнаты без запуска сцены. Ловят то, чего не видно кадром: уровень без
// строки в LIGHT падает на light.exposure ещё до первого рендера, а опечатка в имени модели
// даёт молчаливый 404 и пустое место в комнате.
//
// Запуск: node --test src/components/features/mayak-zvezda/model/rooms.test.mjs

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { LEVELS, MAX_LEVEL, RAYS } from "./zvezda.mjs";
import { LEVEL_PROPS, LIGHT, OWN_PROPS, PRELOAD, SCREEN_ON, diffLevels, propKey, sceneProps, scenePeople } from "./rooms.mjs";
import { PHASES, STEPS } from "./story.mjs";

const KIT_DIR = join(import.meta.dirname, "..", "..", "..", "..", "..", "public", "zvezda-kit");

test("лучей ровно шесть, id уникальны, буква — нет", () => {
    assert.equal(RAYS.length, 6);
    assert.equal(new Set(RAYS.map((ray) => ray.id)).size, 6);
    // «З» стоит у Знаний и у Защиты: если буквы вдруг стали уникальными, кто-то переименовал луч.
    assert.ok(new Set(RAYS.map((ray) => ray.letter)).size < 6);
});

test("уровней шесть, нумерация 1..6 сплошная, шкала ИЦЗ идёт от −1 до +4", () => {
    assert.equal(LEVELS.length, MAX_LEVEL);
    assert.deepEqual(
        LEVELS.map((level) => level.n),
        [1, 2, 3, 4, 5, 6]
    );
    assert.deepEqual(
        LEVELS.map((level) => level.icz),
        [-1, 0, 1, 2, 3, 4]
    );
    assert.ok(LEVELS.at(-1).visionary, "шестой уровень визионерский, это оговорено в первоисточнике");
});

test("у каждого уровня есть и обстановка, и свет, и состояние экрана", () => {
    for (const { n } of LEVELS) {
        assert.ok(Array.isArray(LEVEL_PROPS[n]) && LEVEL_PROPS[n].length > 0, `нет обстановки уровня ${n}`);
        assert.ok(LIGHT[n], `нет строки света уровня ${n}`);
        assert.equal(typeof SCREEN_ON[n], "boolean", `не сказано, горит ли экран на уровне ${n}`);
        for (const key of ["key", "keyIntensity", "fill", "fillIntensity", "hemi", "env", "exposure", "saturation", "contrast", "bloom"]) {
            assert.equal(typeof LIGHT[n][key], key === "key" || key === "fill" ? "string" : "number", `${key} уровня ${n}`);
        }
    }
});

test("ключ по уровням растёт, а не падает", () => {
    // В прежней схеме ключ убывал, и кадр к шестому уровню становился площе первого — ровно
    // наоборот замыслу «выше уровень, светлее и собраннее». Проверка держит направление хода.
    for (let n = 2; n <= MAX_LEVEL; n += 1) {
        assert.ok(LIGHT[n].keyIntensity >= LIGHT[n - 1].keyIntensity, `ключ уровня ${n} слабее предыдущего`);
        assert.ok(LIGHT[n].fillIntensity > LIGHT[n - 1].fillIntensity, `заливка уровня ${n} не выросла`);
        assert.ok(LIGHT[n].env > LIGHT[n - 1].env, `окружение уровня ${n} не выросло`);
    }
});

test("каждая модель существует на диске", () => {
    const missing = [];
    for (const [n, props] of Object.entries(LEVEL_PROPS)) {
        for (const prop of props) {
            if (OWN_PROPS[prop.name]) continue;
            if (!existsSync(join(KIT_DIR, `${prop.name}.glb`))) missing.push(`${prop.name} (уровень ${n})`);
        }
    }
    assert.deepEqual(missing, []);
});

test("теги лучей ссылаются на существующие лучи", () => {
    const ids = new Set(RAYS.map((ray) => ray.id));
    for (const [n, props] of Object.entries(LEVEL_PROPS)) {
        for (const prop of props) {
            if (prop.ray === undefined) continue;
            assert.ok(ids.has(prop.ray), `уровень ${n}: неизвестный луч ${prop.ray} у ${prop.name}`);
        }
    }
});

test("ключи предметов внутри уровня уникальны", () => {
    for (const [n, props] of Object.entries(LEVEL_PROPS)) {
        const keys = props.map(propKey);
        assert.equal(new Set(keys).size, keys.length, `уровень ${n}: два предмета с одним ключом`);
    }
});

test("каждый переход что-то меняет, и меняет заметно", () => {
    for (let n = 1; n < MAX_LEVEL; n += 1) {
        const { arriving, leaving } = diffLevels(n, n + 1);
        assert.ok(arriving.length + leaving.length > 0, `переход ${n}→${n + 1} ничего не меняет`);
    }
});

test("порядок фаз — канон Среда → Деятельность → Сознание", () => {
    assert.deepEqual(
        PHASES.map((phase) => phase.id),
        ["environment", "activity", "mind"]
    );
});

test("у каждого шага истории есть подпись и выдержка", () => {
    for (const step of STEPS) {
        assert.ok(step.caption && step.caption.length > 10, `пустая подпись шага ${step.id}`);
        assert.ok(step.hold > 0, `нулевая выдержка шага ${step.id}`);
        assert.ok(LIGHT[step.light], `шаг ${step.id} просит свет уровня ${step.light}, которого нет`);
    }
});

test("уровень поднимается в конце цикла, а не в начале", () => {
    for (const step of STEPS) {
        if (step.phase === "mind") assert.equal(step.light, step.level + 1, `${step.id}: свет должен уехать на следующий уровень`);
        else assert.equal(step.light, step.level, `${step.id}: свет обязан остаться на текущем уровне`);
    }
});

test("такт «Сознание» и покой следующего уровня — одна и та же комната", () => {
    for (let n = 1; n < MAX_LEVEL; n += 1) {
        const mind = sceneProps(n, "mind").map((prop) => prop.key).sort();
        const rest = sceneProps(n + 1, "rest").map((prop) => prop.key).sort();
        assert.deepEqual(mind, rest, `переход ${n}→${n + 1}: после «Сознания» комната не совпала с покоем`);
    }
});

test("в «Среде» привезённое лежит на полу, в «Деятельности» его несут", () => {
    for (let n = 1; n < MAX_LEVEL; n += 1) {
        const { arriving } = diffLevels(n, n + 1);
        if (!arriving.length) continue;

        const staged = sceneProps(n, "environment").filter((prop) => prop.arriving);
        assert.equal(staged.length, arriving.length);
        for (const prop of staged) {
            assert.equal(prop.at[1], 0, `уровень ${n}: привезённое обязано стоять на полу, а не на столе`);
            assert.equal(prop.carrier, null, `уровень ${n}: в «Среде» вещь никто не несёт`);
        }

        const carried = sceneProps(n, "activity").filter((prop) => prop.arriving);
        for (const prop of carried) {
            assert.equal(typeof prop.carrier, "number", `уровень ${n}: в «Деятельности» вещь несёт человек`);
        }
    }
});

test("ничто не ездит само: у всего, что движется, есть несущий", () => {
    for (let n = 1; n < 6; n += 1) {
        for (const waypoint of [0, 1]) {
            const props = sceneProps(n, "activity", waypoint);
            for (const prop of props) {
                // Предмет либо стоит на своём месте, либо у кого-то в руках, либо гаснет.
                const still = !prop.arriving && !prop.gone;
                const held = typeof prop.carrier === "number";
                const fading = Boolean(prop.fade);
                const staged = prop.arriving && prop.carrier == null;
                assert.ok(still || held || fading || staged, `уровень ${n}, половина ${waypoint}: ${prop.key} движется сам по себе`);
            }
        }
    }
});

test("в первой половине такта выносят старое, во второй приносят новое", () => {
    const first = sceneProps(1, "activity", 0);
    const second = sceneProps(1, "activity", 1);

    assert.ok(first.some((prop) => prop.gone && typeof prop.carrier === "number"), "старое обязано уходить в руках");
    assert.ok(first.every((prop) => !prop.arriving || prop.carrier == null), "за новым ещё не пришли");

    assert.ok(second.some((prop) => prop.arriving && typeof prop.carrier === "number"), "новое обязано приходить в руках");
    assert.ok(second.every((prop) => !prop.gone || prop.fade), "вынесенное гаснет, а не улетает");
});

test("люди в «Деятельности» получают точку пикапа, в «Сознании» — общий взгляд", () => {
    const activity = scenePeople(1, "activity");
    assert.equal(activity.length, 3);
    for (const person of activity) assert.ok(Array.isArray(person.pickup));

    const mind = scenePeople(1, "mind");
    for (const person of mind) assert.ok(Array.isArray(person.look), "в «Сознании» все смотрят в одну точку");
});

test("список преднагрузки покрывает все модели набора и не тянет свою геометрию", () => {
    const used = new Set(
        Object.values(LEVEL_PROPS)
            .flatMap((props) => props.map((prop) => prop.name))
            .filter((name) => !OWN_PROPS[name])
    );
    for (const name of used) assert.ok(PRELOAD.includes(name), `${name} не преднагружается — комната мигнёт пустой`);
    for (const name of Object.keys(OWN_PROPS)) assert.ok(!PRELOAD.includes(name), `${name} — своя геометрия, грузить нечего`);
});
