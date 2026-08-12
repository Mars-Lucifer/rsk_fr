// Проверка гейта дашборда по колоде: мастерский дашборд и кнопка в тренажёре
// показываются только при dashboardReady === true.
//
//   node scripts/mayak-deck-gate-check.mjs
//
// Проверяется сам валидатор — та единственная величина, по которой гейт решает:
// пустая колода и неполная закрыты, полная открыта. Сервер не нужен.

import { validateDeckStandard, YA_FORMAT_TYPES, WE_DIRECTIONS } from "../src/lib/mayakProgressModel.js";

let failed = 0;
const check = (name, ok, detail = "") => {
    console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failed += 1;
};

const deckOf = (types) => types.map((contentType, index) => ({ number: 8001 + index, contentType }));

const full = deckOf([
    "Старт",
    ...YA_FORMAT_TYPES.map((f) => f.label),
    ...WE_DIRECTIONS.map((d) => d.label),
]);

const empty = validateDeckStandard([]);
check("пустая колода закрыта", empty.dashboardReady === false, empty.issues.join("; "));

const untyped = validateDeckStandard(full.map((task) => ({ ...task, contentType: "" })));
check("колода без contentType закрыта", untyped.dashboardReady === false, untyped.issues.join("; "));

const partial = validateDeckStandard(full.slice(0, 8));
check("неполная колода закрыта", partial.dashboardReady === false, partial.issues.join("; "));

const ready = validateDeckStandard(full);
check("полная колода открыта", ready.dashboardReady === true, ready.issues.join("; ") || "без замечаний");
check("распознаны все 6 форматов «Я»", ready.formats.length === YA_FORMAT_TYPES.length, `${ready.formats.length}`);
check("распознаны все 6 направлений «Мы»", ready.directions.length === WE_DIRECTIONS.length, `${ready.directions.length}`);

// Боевые колоды пишут типы синонимами: СПО-колоды — «Статика»/«Динамика».
const synonyms = deckOf([
    "Старт",
    "Текст",
    "Аудио",
    "Статика",
    "Интерактив",
    "Динамика",
    "Данные",
    ...WE_DIRECTIONS.map((d) => d.label),
]);
const bySynonyms = validateDeckStandard(synonyms);
check("колода на синонимах открыта", bySynonyms.dashboardReady === true, bySynonyms.issues.join("; ") || "без замечаний");

console.log(failed ? `\nПровалено проверок: ${failed}` : "\nВсё зелёное");
process.exit(failed ? 1 : 0);
