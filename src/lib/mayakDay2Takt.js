// Автомат тактов второго дня: DETAIL → NODE → PRODUCT.
//
// Разделение обязанностей с разбором ввода:
//   mayakDay2Input  — ЧТО человек хочет открыть
//   mayakDay2Takt   — МОЖНО ЛИ это сейчас
//
// Такт считается по участнику, а не по столу: переход задан тем, что сдал он
// сам (ТЗ, раздел В2). И такт НЕ ПЕРЕПРЫГИВАЕТСЯ — ступень держит система,
// а не голос ведущего. Поэтому набравший номер пары до сдачи своей детали
// получает отказ, а не карточку узла.
//
// Такт нигде не хранится, а выводится из сданного — тем же приёмом, что фазы
// первого дня в mayakProgressModel. Флаг в базе разошёлся бы с табло ведущего,
// и разбирались бы в зале.

const PARTNER_POSITION = { 1: 2, 2: 1, 3: 4, 4: 3, 5: 6, 6: 5 };

const tensOf = (number) => Math.floor(number / 10);
const positionOf = (number) => number % 10;

// «Сдана» — только одобренная. Возврат на доработку тактом не считается:
// шов, который партнёр не принял, на сборке всплывёт в 15:25.
const DONE = new Set(["approved"]);

/**
 * Ключи, которые касаются этого участника.
 * Считаются из его номера, а не спрашиваются: пары зашиты в физику тайлов.
 */
export function day2KeysFor(myNumber) {
    const number = Number(myNumber);
    const position = positionOf(number);
    const partner = tensOf(number) * 10 + PARTNER_POSITION[position];
    const [low, high] = number < partner ? [number, partner] : [partner, number];
    return {
        detail: String(number),
        partner,
        node: `${low}-${high}`,
        adapter: `${low}-${high}:adapter`,
        assembly: String(tensOf(number) * 10),
        table: tensOf(number),
    };
}

/**
 * В каком такте участник.
 *
 * @param myNumber номер его тайла, например 13
 * @param tasks    состояния заданий: [{ key, status }, ...]
 */
export function computeDay2Takt({ myNumber, tasks = [] }) {
    const keys = day2KeysFor(myNumber);
    const statusOf = (key) => tasks.find((t) => t.key === key)?.status || null;
    const isDone = (key) => DONE.has(statusOf(key));

    const detailDone = isDone(keys.detail);
    const nodeDone = isDone(keys.node);

    if (!detailDone) {
        return {
            ...keys,
            takt: "DETAIL",
            index: 1,
            label: "Такт 1 · деталь",
            waitingFor: keys.detail,
        };
    }
    if (!nodeDone) {
        return {
            ...keys,
            takt: "NODE",
            index: 2,
            label: `Такт 2 · узел ${keys.node.replace("-", "+")}`,
            waitingFor: keys.node,
        };
    }
    return {
        ...keys,
        takt: "PRODUCT",
        index: 3,
        label: "Такт 3 · изделие",
        waitingFor: keys.assembly,
    };
}

/**
 * Можно ли открыть то, что разобрал парсер, в текущем такте.
 *
 * Отказ объясняется словами участника, а не кодом состояния: человек в зале
 * должен понять, что делать дальше, без ведущего.
 *
 * @param state   результат computeDay2Takt
 * @param parsed  результат parseDay2Input, уже с ok: true
 */
export function canOpenDay2({ state, parsed }) {
    if (parsed.table !== state.table) {
        return { ok: false, reason: "other-table", hint: `Это чужой стол. Ваш — ${state.table}` };
    }

    // Своя деталь открыта всегда: к ней возвращаются и на втором такте, чтобы
    // свериться, что именно отдаёшь партнёру.
    if (parsed.kind === "detail") {
        if (parsed.key !== state.detail) {
            return { ok: false, reason: "not-mine", hint: `Ваша деталь — ${state.detail}` };
        }
        return { ok: true };
    }

    if (parsed.kind === "node" || parsed.kind === "adapter") {
        if (parsed.key.split(":")[0] !== state.node) {
            return { ok: false, reason: "not-my-node", hint: `Ваш узел — ${state.node.replace("-", " ")}` };
        }
        if (state.takt === "DETAIL") {
            return { ok: false, reason: "too-early", hint: `Сначала сдайте свою деталь ${state.detail}` };
        }
        return { ok: true };
    }

    if (parsed.kind === "assembly") {
        if (state.takt !== "PRODUCT") {
            const missing = state.takt === "DETAIL" ? `деталь ${state.detail}` : `узел ${state.node.replace("-", " ")}`;
            return { ok: false, reason: "too-early", hint: `Сначала сдайте ${missing}` };
        }
        return { ok: true };
    }

    return { ok: false, reason: "unknown-kind", hint: "Не понял, что открыть" };
}
