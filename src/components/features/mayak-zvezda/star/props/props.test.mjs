// Посадка предметов на тумбу: тридцать шесть сборок, шесть лучей на шесть уровней.
//
// Тест ловит ровно то, что видно на кадре и не видно в коде: предмет, вылезший за поле тумбы
// на цветное кольцо, и предмет, утопленный в столешницу — «проходящий насквозь». Ни то, ни
// другое не ошибка Three.js: сборки процедурные, никто их под тумбу не масштабирует, и
// уехавшая на 0.1 координата обнаруживается только глазами. Теперь — здесь.

import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { PEDESTAL } from "../../model/platform.mjs";
import { LEVELS, RAYS } from "../../model/zvezda.mjs";
import { TEST_PROPS, propId } from "./registry.mjs";

// Поле тумбы — до внутреннего края цветного кольца: предмет, дошедший до кольца, его и
// перечёркивает.
const FIELD = PEDESTAL.rimRadius - PEDESTAL.rimThickness;
// Запас на качание парящих предметов и на то, что кольцо всё же читается ободком.
const MAX_HEIGHT = 1.0;

function boundsOf(build) {
    const box = new THREE.Box3().setFromObject(build());
    return box;
}

test("каждому лучу и уровню отвечает свой предмет", () => {
    RAYS.forEach((ray) => {
        LEVELS.forEach((lv) => {
            const id = propId(ray.id, lv.n);
            assert.equal(typeof TEST_PROPS[id], "function", `${id}: предмета нет`);
        });
    });
});

test("предмет умещается в поле тумбы и не наезжает на цветное кольцо", () => {
    RAYS.forEach((ray) => {
        LEVELS.forEach((lv) => {
            const id = propId(ray.id, lv.n);
            const b = boundsOf(TEST_PROPS[id]);
            const reach = Math.max(Math.abs(b.min.x), Math.abs(b.max.x), Math.abs(b.min.z), Math.abs(b.max.z));
            assert.ok(reach <= FIELD, `${id}: вылезает за поле на ${(reach - FIELD).toFixed(3)} (${reach.toFixed(3)} против ${FIELD.toFixed(3)})`);
        });
    });
});

test("предмет стоит на столешнице, а не проходит сквозь неё", () => {
    RAYS.forEach((ray) => {
        LEVELS.forEach((lv) => {
            const id = propId(ray.id, lv.n);
            const b = boundsOf(TEST_PROPS[id]);
            assert.ok(b.min.y >= -0.002, `${id}: уходит под столешницу на ${(-b.min.y).toFixed(3)}`);
            assert.ok(b.max.y <= MAX_HEIGHT, `${id}: выше потолка сцены (${b.max.y.toFixed(3)})`);
        });
    });
});

test("шкала высоты работает: чем выше уровень, тем выше предмет — и никаких близнецов", () => {
    RAYS.forEach((ray) => {
        const tops = LEVELS.map((lv) => boundsOf(TEST_PROPS[propId(ray.id, lv.n)]).max.y);
        // Уровни −1 и 0 лежат на поле, дальше предмет растёт. Строгой монотонности не
        // требуем — требуем, чтобы верх шкалы был заметно выше её низа.
        assert.ok(tops[5] > tops[0] + 0.2, `${ray.id}: +4 не выше −1 (${tops[5].toFixed(2)} против ${tops[0].toFixed(2)})`);
        assert.ok(tops[3] > tops[1] + 0.1, `${ray.id}: +2 не отличается по высоте от 0`);
        // Соседние уровни не должны совпадать по габариту с точностью до сантиметра: это
        // первый признак, что предмет просто скопировали.
        for (let i = 1; i < tops.length; i += 1) {
            assert.ok(Math.abs(tops[i] - tops[i - 1]) > 0.01, `${ray.id}: уровни ${i} и ${i + 1} одной высоты — похоже на дубль`);
        }
    });
});
