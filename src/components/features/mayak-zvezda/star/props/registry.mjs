// Реестр предметов на тумбах: тридцать шесть штук, шесть лучей на шесть уровней зрелости.
//
// Сами предметы живут в <луч>.mjs — по файлу на луч, шесть сборок в каждом. Внутри луча
// уровни сравниваются друг с другом (силуэт, высота, материал, доля акцента), а между лучами
// их держит вместе общая мастерская shared.mjs: одно стекло, один лазер, одни волны.
//
// Здесь только сборка ключей вида `<луч><уровень>` (knowledge1 … automation6). Props.js ищет
// предмет по такому ключу и больше о предметах ничего не знает — набор меняется, не трогая
// сцену. Файл намеренно .mjs без React: так его читает и сцена, и тест посадки props.test.mjs.

import automation from "./automation.mjs";
import data from "./data.mjs";
import interaction from "./interaction.mjs";
import knowledge from "./knowledge.mjs";
import security from "./security.mjs";
import space from "./space.mjs";

const BY_RAY = { knowledge, interaction, space, security, data, automation };

export function propId(rayId, level) {
    return `${rayId}${level}`;
}

export const TEST_PROPS = Object.fromEntries(
    Object.entries(BY_RAY).flatMap(([ray, levels]) => Object.entries(levels).map(([n, build]) => [propId(ray, n), build]))
);
