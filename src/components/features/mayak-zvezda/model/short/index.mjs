// Короткие формулировки клеток «луч × уровень» — то, что читает панель сцены.
//
// Дословные строки методики лежат в ../artifacts.mjs и остаются источником истины: их
// перегенерируют из docx при следующей редакции, и правка там затрётся. Здесь — сжатие тех же
// строк до размера, который читается за секунду с экрана: по пункту на строку, без «Отсутствие
// утверждённой...» и без слова «целевой», цифра и знак сохранены дословно.
//
// Соответствие построчное: n-й пункт здесь — это n-й пункт там. Тест на паритет длин лежит
// рядом, в short.test.mjs.

import automation from "./automation.mjs";
import data from "./data.mjs";
import interaction from "./interaction.mjs";
import knowledge from "./knowledge.mjs";
import security from "./security.mjs";
import space from "./space.mjs";

export const SHORT_CELLS = { knowledge, interaction, space, security, data, automation };

export function shortCell(rayId, n) {
    return SHORT_CELLS[rayId]?.[n] ?? null;
}

// Критерий перехода на уровень — той же длины, что и остальная панель. Дословные формулировки
// лежат в TRANSITIONS первоисточника; здесь ключ — номер уровня, НА который поднимаются.
export const SHORT_TRANSITIONS = {
    2: "3 из 6 базовых артефактов: сайт, сеть, антивирус, регламент ИБ, учёт",
    3: "Полный комплект базовых артефактов по всем шести лучам",
    4: "3 из 6 процессов сквозные, с электронным результатом",
    5: "4 из 6 систем интеллектуальные: прогноз, рекомендации, модели",
    6: "4 из 6 систем проактивные: автоинтервенции и упреждение",
};

export function shortTransitionTo(n) {
    return SHORT_TRANSITIONS[n] ?? null;
}
