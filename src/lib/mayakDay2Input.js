// Разбор того, что участник второго дня набирает в одно поле.
//
// На столе лежит картон, в портале — одна строка ввода. Участник печатает то,
// что видит на тайле, и разбор решает, какую карточку открыть:
//
//     13                    деталь, такт 1
//     13 14                 узел, такт 2
//     13 14 не сошлось      переходник, такт 2
//     среда  ·  10          изделие, такт 3
//
// Полей ввода намеренно одно. Три отдельных — «номер», «пара», «слово» —
// заставили бы человека в 12:40 выбирать вкладку вместо работы.
//
// Разбор ничего не знает про то, какой луч под каким номером: номера — это
// координаты в сборке, а содержание даёт портал по ключу. Поэтому спор
// «13-14 против 15-16» на этот файл не влияет.

// Столы: десяток номера и слово, которым открывается изделие.
const TABLES = [
    { tens: 1, word: "среда" },
    { tens: 2, word: "деятельность" },
    { tens: 3, word: "сознание" },
];

// Пары зашиты в физику тайлов и здесь не обсуждаются.
const PARTNER_POSITION = { 1: 2, 2: 1, 3: 4, 4: 3, 5: 6, 6: 5 };

const tensOf = (number) => Math.floor(number / 10);
const positionOf = (number) => number % 10;
const isCentre = (number) => positionOf(number) === 0 && tensOf(number) >= 1 && tensOf(number) <= 3;
const isRay = (number) => {
    const pos = positionOf(number);
    return pos >= 1 && pos <= 6 && tensOf(number) >= 1 && tensOf(number) <= 3;
};

const fail = (reason, hint) => ({ ok: false, reason, hint });

/**
 * Привести набранное к разбираемому виду.
 *
 * Человек печатает второпях и по-разному: `13-14`, `13,14`, `1314`, «НЕ СОШЛОСЬ».
 * Всё это одно и то же, и придираться к разделителю здесь неуместно.
 */
function normalize(raw) {
    return String(raw ?? "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^a-zа-я0-9]+/g, " ")
        .trim();
}

/**
 * Числа из набранного. Слипшееся `1314` разворачивается в два номера:
 * на тайлах номера всегда двузначные, поэтому четыре цифры подряд — это пара.
 */
function extractNumbers(tokens) {
    const numbers = [];
    for (const token of tokens) {
        if (!/^\d+$/.test(token)) continue;
        if (token.length === 2) {
            numbers.push(Number(token));
        } else if (token.length === 4) {
            numbers.push(Number(token.slice(0, 2)), Number(token.slice(2)));
        } else {
            return null;                    // однозначное или пятизначное — не номер тайла
        }
    }
    return numbers;
}

/**
 * Разобрать ввод участника второго дня.
 *
 * @returns {{ok: true, kind: "detail"|"node"|"adapter"|"assembly",
 *            key: string, table: number, numbers: number[]}
 *          | {ok: false, reason: string, hint: string}}
 *
 * Ошибка возвращается с подсказкой, а не молча: набравший `13 15` должен узнать,
 * что партнёр тринадцатого — четырнадцатый, а не гадать, почему ничего не вышло.
 */
export function parseDay2Input(raw) {
    const text = normalize(raw);
    if (!text) return fail("empty", "Наберите номер с тайла");

    const tokens = text.split(" ");

    // «не сошлось», «не сошлись», «не сошёлся» — одна и та же пометка. Корень
    // берётся коротким: после замены ё на е «сошёлся» становится «сошелся»,
    // и «сошл» его уже не ловит.
    const brokenSeam = tokens.some((token) => token.includes("сош"));
    const words = tokens.filter((token) => /^[a-zа-я]+$/.test(token) && !token.includes("сош") && token !== "не");

    // Изделие открывается словом стола
    if (words.length) {
        const table = TABLES.find((t) => t.word === words[0]);
        if (!table || words.length > 1) {
            return fail("unknown", "Не понял. Наберите номер с тайла или слово стола");
        }
        if (brokenSeam) {
            return fail("adapter-needs-pair", "«Не сошлось» пишется про пару номеров, не про стол");
        }
        return { ok: true, kind: "assembly", key: String(table.tens * 10), table: table.tens, numbers: [table.tens * 10] };
    }

    const numbers = extractNumbers(tokens);
    if (numbers === null || numbers.length === 0) {
        if (brokenSeam) {
            return fail("adapter-needs-pair", "«Не сошлось» пишется про два номера: например, 13 14 не сошлось");
        }
        return fail("unknown", "Не понял. Наберите номер с тайла или слово стола");
    }

    const unknown = numbers.find((n) => !isRay(n) && !isCentre(n));
    if (unknown !== undefined) {
        return fail("no-such-number", `Тайла ${unknown} нет. Номера идут 11–16, 21–26, 31–36`);
    }

    if (numbers.length === 1) {
        const [number] = numbers;
        if (brokenSeam) {
            return fail("adapter-needs-pair", "«Не сошлось» пишется про два номера: например, 13 14 не сошлось");
        }
        if (isCentre(number)) {
            return { ok: true, kind: "assembly", key: String(number), table: tensOf(number), numbers: [number] };
        }
        return { ok: true, kind: "detail", key: String(number), table: tensOf(number), numbers: [number] };
    }

    if (numbers.length > 2) {
        return fail("too-many", "Узел собирается из двух номеров");
    }

    const [a, b] = numbers;
    if (a === b) {
        return fail("same-number", "Нужны два разных номера");
    }
    if (numbers.some(isCentre)) {
        return fail("centre-in-pair", "Место сборки открывается отдельно — словом стола или своим номером");
    }
    if (tensOf(a) !== tensOf(b)) {
        return fail("different-tables", `${a} и ${b} с разных столов — соединяются только свои`);
    }
    if (PARTNER_POSITION[positionOf(a)] !== positionOf(b)) {
        const partner = tensOf(a) * 10 + PARTNER_POSITION[positionOf(a)];
        return fail("not-partners", `${a} и ${b} не пара. Партнёр ${a} — это ${partner}`);
    }

    // Ключ всегда по возрастанию: `14 13` и `13 14` — один узел, и в рантайме
    // это обязана быть одна запись, иначе аналитика насчитает два.
    const [low, high] = a < b ? [a, b] : [b, a];
    const key = `${low}-${high}`;
    return {
        ok: true,
        kind: brokenSeam ? "adapter" : "node",
        key: brokenSeam ? `${key}:adapter` : key,
        table: tensOf(low),
        numbers: [low, high],
    };
}
