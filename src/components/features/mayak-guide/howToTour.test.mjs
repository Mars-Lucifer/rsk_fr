import { strict as assert } from "node:assert";
import test from "node:test";

import { buildTrainerHowTo, pickSampleTask } from "./howToTour.mjs";

const card = (number, extra = {}) => ({ number, ...extra });

const FILE = { hasFile: true, file: "3.docx" };
const INSTR = { hasInstruction: true, instruction: "3.pdf" };
const SOURCE = { hasSource: true, sourceLink: "https://example" };

test("для разбора берётся карта с материалами, а не первая по счёту", () => {
    const tasks = [
        card(1),
        card(2, SOURCE),
        card(3, { ...FILE, ...INSTR, ...SOURCE, toolLink1: "https://qwen", toolName1: "Qwen" }),
        card(4, INSTR),
    ];

    const sample = pickSampleTask(tasks);
    assert.equal(sample.number, 3);
    assert.equal(sample.index, 2);
    assert.equal(sample.toolName, "Qwen");
});

test("флаг без файла не считается материалом — кнопки для него рантайм не рисует", () => {
    const tasks = [card(1, { hasFile: true, file: "" }), card(2, INSTR)];

    const sample = pickSampleTask(tasks);
    assert.equal(sample.number, 2);
    assert.equal(sample.hasFile, false);
});

test("карта ищется только среди разрешённых доступу", () => {
    const rich = { ...FILE, toolLink1: "https://qwen", toolName1: "Qwen" };
    const tasks = [card(1, rich), card(2), card(3, INSTR)];

    // Богатая карта вне диапазона: goToTask её всё равно не откроет.
    const sample = pickSampleTask(tasks, { from: 1, to: 2 });
    assert.equal(sample.number, 3);
});

test("пустая колода не ломает разбор — шаги остаются, материалы становятся необязательными", () => {
    assert.equal(pickSampleTask([]), null);
    assert.equal(pickSampleTask(null), null);

    const steps = buildTrainerHowTo(null);
    const materials = steps.filter((step) => ["Инструкция", "Доп.материал"].includes(step.match));
    assert.equal(materials.length, 2);
    assert.ok(materials.every((step) => step.optional));
});

test("у карты без файла шага про доп.материал нет — разбор не обещает кнопку, которой нет", () => {
    const steps = buildTrainerHowTo({ index: 0, number: 12, hasInstruction: true, hasFile: false, hasSource: false, toolName: "" });
    const titles = steps.map((step) => step.title);

    assert.ok(titles.some((title) => title.includes("«Инструкция»")));
    assert.ok(!titles.some((title) => title.includes("«Доп.материал»")));
    assert.ok(!titles.some((title) => title.includes("Глазик")));
    assert.ok(titles[0].includes("№12"));
});
