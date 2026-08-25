// node --test src/lib/mayakProgressModel.test.mjs
// Проверка одна: прогресс части «Я» считается по номеру карты и по раскладке
// колоды, а не по позиции в массиве и не по зашитым числам базовой раскладки.
//
// Тренажёр раскладывает колоду по ГЛОБАЛЬНЫМ индексам: у 401-500 первые 400
// ячеек — заглушки. Поэтому фикстуры здесь такие же, с пустым хвостом: на
// секционном массиве старый код проходил, а на боевом промахивался в пустоту.

import test from "node:test";
import assert from "node:assert/strict";

import { computeTrainerYaProgress, detectDeckLayout, DECK_LAYOUTS } from "./mayakProgressModel.js";

const EMPTY_CARD = { number: "", title: "", contentType: "" };

// Колода из шестёрок: вводные, затем шесть форматов по шесть карт с картой
// настроения после каждого блока, затем направления «Мы».
function buildDeck({ rangeStart, startCards }) {
    const formats = ["Текст", "Аудио", "Изображение", "Интерактив", "Видео", "Данные"];
    const cards = [];
    for (let i = 0; i < startCards; i += 1) cards.push({ contentType: "Старт" });
    formats.forEach((format) => {
        for (let i = 0; i < 6; i += 1) cards.push({ contentType: format });
        cards.push({ contentType: `${format} - Карта настроения` });
    });
    while (cards.length < 100) cards.push({ contentType: "Знания и навыки" });

    // Раскладка как в тренажёре: массив по глобальным индексам.
    const padded = new Array(rangeStart - 1 + 100).fill(null).map(() => ({ ...EMPTY_CARD }));
    cards.slice(0, 100).forEach((card, i) => {
        padded[rangeStart - 1 + i] = { ...card, number: String(rangeStart + i) };
    });
    return padded;
}

// numbers — номера заданий колоды (не позиции), как их хранит рантайм сессии.
function participantWith(numbers, sectionId, extra = {}) {
    return {
        sectionId,
        yaDirection: "",
        taskStates: numbers.map((n) => ({ taskNumber: String(n), taskIndex: n - 1, status: "approved" })),
        ...extra,
    };
}

const BASE_DECK = buildDeck({ rangeStart: 401, startCards: 9 });
const SPO_DECK = buildDeck({ rangeStart: 1, startCards: 6 });
const SPO_SHIFTED_DECK = buildDeck({ rangeStart: 201, startCards: 6 });

test("базовая колода не с единицы: форматы засчитываются", () => {
    // 401-404 — вводные, 410-411 — текст, 417 — аудио.
    const result = computeTrainerYaProgress({
        participant: participantWith([401, 402, 403, 404, 410, 411, 417], "401-500"),
        tasks: BASE_DECK,
        fallbackSectionId: "401-500",
    });

    assert.equal(result.phase, "CONTENT_TYPES");
    assert.equal(result.count, 2);
    assert.deepEqual(result.completedTypes.sort(), ["аудио", "текст"]);
});

test("колода СПО: карты 7-9 идут в зачёт формата", () => {
    // У СПО текст начинается с 7-й карты. Старая жёсткая граница (с 10-й)
    // эти три карты пропускала, и формат не закрывался.
    const result = computeTrainerYaProgress({
        participant: participantWith([1, 2, 3, 4, 7, 8], "1-100"),
        tasks: SPO_DECK,
        fallbackSectionId: "1-100",
    });

    assert.equal(result.phase, "CONTENT_TYPES");
    assert.deepEqual(result.completedTypes, ["текст"]);
});

test("колода СПО не с единицы считается так же", () => {
    const result = computeTrainerYaProgress({
        participant: participantWith([201, 202, 203, 204, 207, 214], "201-300"),
        tasks: SPO_SHIFTED_DECK,
        fallbackSectionId: "201-300",
    });

    assert.equal(result.count, 2);
    assert.deepEqual(result.completedTypes.sort(), ["аудио", "текст"]);
});

test("на СПО текстовые карты не закрывают фазу «Старт»", () => {
    // Вводных у СПО шесть, карты 7-10 — уже текст. Раньше окно старта тянулось
    // до 10-й карты, и четыре текстовых задания переводили фазу дальше.
    const result = computeTrainerYaProgress({
        participant: participantWith([7, 8, 9, 10], "1-100"),
        tasks: SPO_DECK,
        fallbackSectionId: "1-100",
    });

    assert.equal(result.phase, "START");
    assert.equal(result.count, 0);
});

test("вводные карты закрывают «Старт» на обеих раскладках", () => {
    const spo = computeTrainerYaProgress({
        participant: participantWith([1, 2, 3], "1-100"),
        tasks: SPO_DECK,
        fallbackSectionId: "1-100",
    });
    assert.equal(spo.phase, "START");
    assert.equal(spo.count, 3);

    const base = computeTrainerYaProgress({
        participant: participantWith([401, 402, 403, 404], "401-500"),
        tasks: BASE_DECK,
        fallbackSectionId: "401-500",
    });
    assert.equal(base.phase, "CONTENT_TYPES");
});

test("карта настроения по стандарту закрывает свой формат", () => {
    const result = computeTrainerYaProgress({
        participant: participantWith([401, 402, 403, 404, 416], "401-500"),
        tasks: BASE_DECK,
        fallbackSectionId: "401-500",
    });

    assert.deepEqual(result.completedTypes, ["текст"]);
});

test("часть «Мы»: цель считается по колоде, а не по позициям массива", () => {
    const numbers = [401, 402, 403, 404];
    for (let n = 410; n <= 450; n += 1) numbers.push(n); // все шесть форматов
    for (let n = 452; n <= 455; n += 1) numbers.push(n); // задания «Мы»

    const result = computeTrainerYaProgress({
        participant: participantWith(numbers, "401-500", { yaDirection: "текст" }),
        tasks: BASE_DECK,
        fallbackSectionId: "401-500",
    });

    assert.equal(result.phase, "WE_INDEX");
    assert.equal(result.hasStar, true);
    assert.ok(result.target > 0, "цель части «Мы» должна быть больше нуля");
    assert.equal(result.count, 4);
});

test("старые записи рантайма без taskNumber считаются по индексу", () => {
    const participant = {
        sectionId: "401-500",
        yaDirection: "",
        taskStates: [401, 402, 403, 404, 410].map((n) => ({ taskIndex: n - 1, status: "approved" })),
    };

    const result = computeTrainerYaProgress({ participant, tasks: BASE_DECK, fallbackSectionId: "401-500" });
    assert.deepEqual(result.completedTypes, ["текст"]);
});

test("раскладка определяется по колоде", () => {
    const byNumber = (deck) => new Map(deck.filter((c) => c.number).map((c) => [c.number, c]));

    assert.equal(detectDeckLayout(byNumber(SPO_DECK), 1).key, DECK_LAYOUTS.spo.key);
    assert.equal(detectDeckLayout(byNumber(SPO_SHIFTED_DECK), 201).key, DECK_LAYOUTS.spo.key);
    assert.equal(detectDeckLayout(byNumber(BASE_DECK), 401).key, DECK_LAYOUTS.base.key);
    // Неразмеченная колода — прежнее поведение, базовая раскладка.
    assert.equal(detectDeckLayout(new Map(), 501).key, DECK_LAYOUTS.base.key);
});
