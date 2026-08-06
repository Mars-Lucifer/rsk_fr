// Проверка отвязки конкурса от колод: `node scripts/check-contest-bundle.mjs`.
//
// Ловит две вещи, которые ломаются молча: слаг `contest-N` начинает задевать
// обычные колоды, либо бандл урока перестаёт совпадать по форме с тем, что
// ждёт тренажёр (одна задача, явные границы, никаких материалов).

import assert from "node:assert";
import { buildContestSectionId, buildContestTaskBundle, getContestTrainerTask, parseContestSectionId } from "../src/lib/contestTrainerTasks.js";

// Слаг разбирается только у конкурса. Колоды тренажёра не задеваются.
assert.equal(parseContestSectionId("contest-3"), 3);
assert.equal(parseContestSectionId("1-100"), null);
assert.equal(parseContestSectionId("901-1000"), null);
assert.equal(parseContestSectionId("contest-0"), null);
assert.equal(parseContestSectionId("contest-x"), null);
assert.equal(parseContestSectionId(""), null);
assert.equal(parseContestSectionId(undefined), null);
assert.equal(buildContestSectionId(3), "contest-3");

// Бандл урока: ровно одна задача, границы заданы явно, материалов нет.
for (let lesson = 1; lesson <= 8; lesson++) {
    const bundle = buildContestTaskBundle(lesson);
    assert.ok(bundle, `урок ${lesson}: бандл не собрался`);
    assert.equal(bundle.sectionId, `contest-${lesson}`);
    assert.equal(bundle.tasks.length, 1, `урок ${lesson}: задача должна быть одна`);
    assert.equal(bundle.meta.rangeStart, 1);
    assert.equal(bundle.meta.rangeEnd, 1);

    const task = bundle.tasks[0];
    assert.equal(task.number, "1");
    assert.equal(task.contentType, getContestTrainerTask(lesson).format);
    assert.equal(task.hasFile || task.hasInstruction || task.hasMap || task.hasSource, false, `урок ${lesson}: материалов быть не должно`);
}

// Урока с таким номером нет — честный null, а не пустая карточка.
assert.equal(buildContestTaskBundle(9), null);
assert.equal(buildContestTaskBundle(0), null);

console.log("OK: 8 уроков, по одной задаче, без материалов, колоды не задеты");
